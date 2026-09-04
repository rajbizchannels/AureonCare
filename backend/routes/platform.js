// SEC-05 Model D — Step S10: control-plane console API (/api/platform).
//
// Super-admin surface, isolated from the tenant app. Operators authenticate against
// control.operators (separate secret), manage the tenant fleet and subscriptions, and
// have NO standing access to tenant PHI — reading a tenant's data requires an explicit,
// time-boxed, justified break-glass session, and every action is written to the
// append-only control.audit_log.

const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { storeFor } = require('../middleware/rateLimitStore');
let speakeasy;
try { speakeasy = require('speakeasy'); } catch (_) { speakeasy = null; } // MFA optional if lib absent

// Express 4 does not catch rejections from `async` handlers: an unhandled rejection
// terminates the PROCESS, taking the clinical application down with it — a single missing
// column here would 500 the console and then kill the API for every patient-facing screen.
// Most handlers in this file were written without try/catch, so rather than rely on each
// one remembering, every handler registered on this router is wrapped once, here.
const baseRouter = express.Router();
const wrapHandler = (h) =>
  (typeof h === 'function' && h.length < 4
    ? (req, res, next) => { try { return Promise.resolve(h(req, res, next)).catch(next); } catch (e) { return next(e); } }
    : h);
const router = new Proxy(baseRouter, {
  get(target, prop, recv) {
    const orig = Reflect.get(target, prop, recv);
    if (typeof orig === 'function' && ['get', 'post', 'put', 'patch', 'delete', 'use', 'all'].includes(prop)) {
      return (...args) => orig.call(target, ...args.map(wrapHandler));
    }
    return typeof orig === 'function' ? orig.bind(target) : orig;
  },
});
const { signPlatformToken, requirePlatformAdmin, requireSecret, requireOperatorRole } = require('../middleware/platformAuth');
const { logPlatformAction } = require('../services/platformAudit');
const { withTenant } = require('../db/tenantClient');
const { BCRYPT_COST, validatePassword } = require('../utils/passwordPolicy');
const { invalidateEntitlements } = require('../services/entitlements');
const { provisionTenant } = require('../services/tenantProvisioning');
const billing = require('../services/platformBilling');
const ledger = require('../services/billingLedger');
const { issuePlatformCookies, clearPlatformCookies } = require('../utils/authCookies');

const clientIp = (req) => req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || null;

// ── Operator login (rate limited) ─────────────────────────────────────────────
const loginLimiter = rateLimit({
  store: storeFor('platform-login'),  // SEC-21: shared across instances
  windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ error: 'Too many attempts. Try again later.' }),
});

router.post('/login', loginLimiter, async (req, res) => {
  try {
    requireSecret();
    const pool = req.app.locals.pool;
    const { email, password, mfaCode } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const { rows } = await pool.query(
      'SELECT * FROM control.operators WHERE email = $1',
      [String(email).toLowerCase()]
    );
    const op = rows[0];
    // Constant-ish time: always run a compare (dummy when the operator is absent).
    const hash = op ? op.password_hash : '$2a$12$C6UzMDM.H6dfI/f/IKcEeO3z8kU0m9Yb0aH3mHqz9uJm8lTgqQG0K';
    const ok = await bcrypt.compare(password, hash);
    if (!op || !ok || op.status !== 'active') {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (op.mfa_enabled) {
      if (!speakeasy) return res.status(500).json({ error: 'MFA required but unavailable on server' });
      const valid = mfaCode && speakeasy.totp.verify({ secret: op.mfa_secret, encoding: 'base32', token: String(mfaCode), window: 1 });
      if (!valid) return res.status(401).json({ error: 'Valid MFA code required' });
    }

    await pool.query('UPDATE control.operators SET last_login = now() WHERE id = $1', [op.id]);
    const token = signPlatformToken(op);
    await logPlatformAction(pool, { operatorId: op.id, action: 'operator.login', targetType: 'operator', targetId: op.id, ip: clientIp(req) });
    // Deliver the session as an HttpOnly cookie scoped to /api/platform so the console
    // never holds the token in JS-readable storage; csrfToken is echoed in X-CSRF-Token.
    const csrfToken = issuePlatformCookies(res, token);
    res.json({ token, csrfToken, operator: { id: op.id, email: op.email, name: op.name, mfaEnabled: op.mfa_enabled } });
  } catch (e) {
    if (e.statusCode === 503) return res.status(503).json({ error: e.message });
    console.error('Operator login error:', e);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Everything below requires an authenticated operator.
router.use(requirePlatformAdmin);

// Sign out: clear the operator cookies. Bumping token_version would additionally revoke
// every device for this operator; that is deliberately a separate admin action.
router.post('/logout', async (req, res) => {
  clearPlatformCookies(res);
  await logPlatformAction(req.app.locals.pool, {
    operatorId: req.operator.id, action: 'operator.logout',
    targetType: 'operator', targetId: req.operator.id, ip: clientIp(req),
  });
  res.json({ message: 'Signed out' });
});

// Who am I — lets the console restore its session after a reload without storing anything.
router.get('/me', (req, res) => res.json({ operator: req.operator }));

// ── MFA enrollment ────────────────────────────────────────────────────────────
router.post('/mfa/enroll', async (req, res) => {
  if (!speakeasy) return res.status(500).json({ error: 'MFA library unavailable' });
  const pool = req.app.locals.pool;
  const secret = speakeasy.generateSecret({ name: `AureonCare Platform (${req.operator.email})` });
  await pool.query('UPDATE control.operators SET mfa_secret = $1 WHERE id = $2', [secret.base32, req.operator.id]);

  // Two ways to enrol, because they need DIFFERENT values and mixing them up is the usual
  // failure: a QR encodes the whole otpauth:// URL, while manual entry takes the base32
  // SECRET only. Pasting the URL into Google Authenticator's "setup key" field is rejected
  // as containing illegal characters — base32 is A-Z and 2-7, so ':' '/' '?' '=' are not
  // valid. The QR is rendered server-side as a data: URI; the console's CSP allows
  // img-src data: but not a third-party QR script.
  let qrDataUrl = null;
  try {
    qrDataUrl = await require('qrcode').toDataURL(secret.otpauth_url, { margin: 1, width: 220 });
  } catch (e) {
    console.warn('[platform] QR generation failed, manual entry still available:', e.message);
  }

  res.json({
    otpauthUrl: secret.otpauth_url,
    base32: secret.base32,
    qrDataUrl,
    account: req.operator.email,
    issuer: 'AureonCare Platform',
    note: 'Scan the QR, or type the base32 key manually. Then verify a code to enable.',
  });
});

router.post('/mfa/verify', async (req, res) => {
  if (!speakeasy) return res.status(500).json({ error: 'MFA library unavailable' });
  const pool = req.app.locals.pool;
  const { code } = req.body || {};
  const { rows } = await pool.query('SELECT mfa_secret FROM control.operators WHERE id = $1', [req.operator.id]);
  const valid = rows[0]?.mfa_secret && code &&
    speakeasy.totp.verify({ secret: rows[0].mfa_secret, encoding: 'base32', token: String(code), window: 1 });
  if (!valid) return res.status(400).json({ error: 'Invalid code' });
  await pool.query('UPDATE control.operators SET mfa_enabled = true WHERE id = $1', [req.operator.id]);
  await logPlatformAction(pool, { operatorId: req.operator.id, action: 'operator.mfa_enabled', targetType: 'operator', targetId: req.operator.id, ip: clientIp(req) });
  res.json({ message: 'MFA enabled' });
});

// ── Tenant fleet management ───────────────────────────────────────────────────
router.get('/tenants', async (req, res) => {
  const pool = req.app.locals.pool;
  const { rows } = await pool.query(
    `SELECT t.*, (SELECT count(*) FROM public.users u WHERE u.practice_id = t.practice_id) AS user_count
       FROM control.tenants t ORDER BY t.created_at ASC`);
  res.json(rows);
});

router.get('/tenants/:id', async (req, res) => {
  const pool = req.app.locals.pool;
  const { rows } = await pool.query('SELECT * FROM control.tenants WHERE id = $1', [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Tenant not found' });
  res.json(rows[0]);
});

router.post('/tenants', requireOperatorRole('support'), async (req, res) => {
  const pool = req.app.locals.pool;
  const { name, planTier, planId, country, timezone } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name is required' });

  try {
    // Shared with the self-serve signup path so an operator-created tenant is identical to
    // a customer-created one — including the control.subscriptions row, whose absence made
    // entitlement checks fall open to the legacy global settings.
    const { tenant } = await provisionTenant(pool, {
      name, planTier, planId, country, timezone,
    });
    await logPlatformAction(pool, { operatorId: req.operator.id, action: 'tenant.create',
      targetType: 'tenant', targetId: tenant.id, tenantId: tenant.id,
      detail: { name, schema: tenant.schema_name }, ip: clientIp(req) });
    res.status(201).json(tenant);
  } catch (e) {
    console.error('Tenant create error:', e);
    res.status(500).json({ error: 'Failed to create tenant' });
  }
});

async function setTenantStatus(req, res, status, action) {
  const pool = req.app.locals.pool;
  const { rows } = await pool.query(
    'UPDATE control.tenants SET status = $1, updated_at = now() WHERE id = $2 RETURNING *',
    [status, req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Tenant not found' });
  await logPlatformAction(pool, { operatorId: req.operator.id, action, targetType: 'tenant', targetId: req.params.id, tenantId: req.params.id, ip: clientIp(req) });
  res.json(rows[0]);
}
router.post('/tenants/:id/suspend', requireOperatorRole('support'), (req, res) => setTenantStatus(req, res, 'suspended', 'tenant.suspend'));
router.post('/tenants/:id/resume', requireOperatorRole('support'), (req, res) => setTenantStatus(req, res, 'active', 'tenant.resume'));

// ── Platform audit log (read) ─────────────────────────────────────────────────
router.get('/audit', async (req, res) => {
  const pool = req.app.locals.pool;
  const limit = Math.min(parseInt(req.query.limit || '100', 10), 500);
  const offset = parseInt(req.query.offset || '0', 10);
  const { rows } = await pool.query(
    `SELECT a.*, o.email AS operator_email
       FROM control.audit_log a LEFT JOIN control.operators o ON o.id = a.operator_id
      ORDER BY a.created_at DESC LIMIT $1 OFFSET $2`, [limit, offset]);
  res.json(rows);
});

// ── Break-glass: time-boxed, justified access to one tenant ───────────────────
router.post('/tenants/:id/break-glass', requireOperatorRole('support'), async (req, res) => {
  const pool = req.app.locals.pool;
  const { reason, ttlMinutes } = req.body || {};
  if (!reason || String(reason).trim().length < 8) {
    return res.status(400).json({ error: 'A justification (reason, >= 8 chars) is required' });
  }
  const ttl = Math.min(Math.max(parseInt(ttlMinutes || '30', 10), 1), 240); // 1..240 min
  const t = await pool.query("SELECT id FROM control.tenants WHERE id = $1", [req.params.id]);
  if (t.rows.length === 0) return res.status(404).json({ error: 'Tenant not found' });

  const { rows } = await pool.query(
    `INSERT INTO control.break_glass_sessions (operator_id, tenant_id, reason, expires_at)
     VALUES ($1, $2, $3, now() + ($4 || ' minutes')::interval) RETURNING *`,
    [req.operator.id, req.params.id, String(reason).trim(), String(ttl)]);
  await logPlatformAction(pool, { operatorId: req.operator.id, action: 'break_glass.start',
    targetType: 'tenant', targetId: req.params.id, tenantId: req.params.id, detail: { reason, ttlMinutes: ttl }, ip: clientIp(req) });
  res.status(201).json(rows[0]);
});

router.post('/break-glass/:sessionId/end', async (req, res) => {
  const pool = req.app.locals.pool;
  const { rows } = await pool.query(
    `UPDATE control.break_glass_sessions SET revoked_at = now()
      WHERE id = $1 AND operator_id = $2 AND revoked_at IS NULL RETURNING *`,
    [req.params.sessionId, req.operator.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Active session not found' });
  await logPlatformAction(pool, { operatorId: req.operator.id, action: 'break_glass.end',
    targetType: 'tenant', targetId: rows[0].tenant_id, tenantId: rows[0].tenant_id, ip: clientIp(req) });
  res.json(rows[0]);
});

// Read a tenant's OWN audit log — allowed ONLY with an active break-glass session, and
// the read itself is audited. This is how a super-admin reviews tenant activity.
router.get('/tenants/:id/tenant-audit', async (req, res) => {
  const pool = req.app.locals.pool;
  const bg = await pool.query(
    `SELECT 1 FROM control.break_glass_sessions
      WHERE operator_id = $1 AND tenant_id = $2 AND revoked_at IS NULL AND expires_at > now() LIMIT 1`,
    [req.operator.id, req.params.id]);
  if (bg.rows.length === 0) {
    return res.status(403).json({ error: 'An active break-glass session is required to read tenant data' });
  }
  const t = await pool.query('SELECT schema_name FROM control.tenants WHERE id = $1', [req.params.id]);
  if (t.rows.length === 0) return res.status(404).json({ error: 'Tenant not found' });

  await logPlatformAction(pool, { operatorId: req.operator.id, action: 'break_glass.read_audit',
    targetType: 'tenant', targetId: req.params.id, tenantId: req.params.id, ip: clientIp(req) });
  const out = await withTenant(pool, t.rows[0].schema_name, (c) =>
    c.query('SELECT id, action_type, resource_type, resource_name, user_email, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 200'));
  res.json(out.rows);
});

// ── Subscriptions & entitlements (S11) ────────────────────────────────────────
const VALID_SUB_STATUS = new Set(['trialing', 'active', 'past_due', 'canceled']);

// Plan catalog (shared).
router.get('/plans', async (req, res) => {
  const pool = req.app.locals.pool;
  const { rows } = await pool.query(
    `SELECT id, name, display_name, description, price, currency, billing_cycle,
            max_users, max_patients, max_providers, features, is_active, self_serve,
            stripe_price_id, stripe_product_id, trial_days
       FROM public.subscription_plans ORDER BY is_active DESC, price NULLS FIRST, id`);
  res.json(rows);
});

// Create a plan. Deactivated plans are still listed (is_active is a column, not a filter),
// so retiring a plan never breaks the tenants already subscribed to it.
router.post('/plans', requireOperatorRole('billing'), async (req, res) => {
  const pool = req.app.locals.pool;
  const {
    name, displayName, description, price, currency, billingCycle,
    maxUsers, maxProviders, maxPatients, trialDays, isActive,
  } = req.body || {};

  const slug = String(name || '').trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_');
  if (!slug) return res.status(400).json({ error: 'A plan name is required.' });
  if (!displayName || !String(displayName).trim()) {
    return res.status(400).json({ error: 'A display name is required.' });
  }
  if (price == null || Number.isNaN(Number(price)) || Number(price) < 0) {
    return res.status(400).json({ error: 'Price must be a non-negative number.' });
  }

  try {
    const dup = await pool.query('SELECT 1 FROM public.subscription_plans WHERE name = $1', [slug]);
    if (dup.rows.length) return res.status(409).json({ error: `A plan named "${slug}" already exists.` });

    const { rows } = await pool.query(
      `INSERT INTO public.subscription_plans
         (name, display_name, description, price, currency, billing_cycle,
          max_users, max_providers, max_patients, trial_days, is_active, self_serve)
       VALUES ($1,$2,$3,$4,COALESCE(LOWER($5),'usd'),COALESCE($6,'monthly'),
               COALESCE($7,-1),COALESCE($8,-1),COALESCE($9,-1),COALESCE($10,0),
               COALESCE($11,true), false)
       RETURNING *`,
      [slug, String(displayName).trim(), description || null, Number(price), currency || null,
       billingCycle || null,
       maxUsers == null ? null : Number(maxUsers),
       maxProviders == null ? null : Number(maxProviders),
       maxPatients == null ? null : Number(maxPatients),
       trialDays == null ? null : Number(trialDays),
       typeof isActive === 'boolean' ? isActive : null]
    );
    // self_serve starts false on purpose: a plan is not sellable until it has a Stripe
    // price, which is a separate, deliberate step.
    await logPlatformAction(pool, { operatorId: req.operator.id, action: 'plan.create',
      targetType: 'plan', targetId: String(rows[0].id), detail: { name: slug, price }, ip: clientIp(req) });
    res.status(201).json(rows[0]);
  } catch (e) {
    console.error('Plan create error:', e);
    res.status(500).json({ error: 'Failed to create plan' });
  }
});

/**
 * Create the plan's Product and Price in Stripe and record the ids.
 *
 * This is what removes the copy-and-paste step: an operator no longer has to build the
 * price in the Stripe dashboard and paste its id back. Stripe Prices are immutable, so a
 * push after a price change mints a NEW price and archives the old one — existing
 * subscribers keep billing at the price they agreed to; only new customers see the new one.
 */
router.post('/plans/:id/stripe', requireOperatorRole('billing'), async (req, res) => {
  const pool = req.app.locals.pool;
  if (!billing.isConfigured()) {
    return res.status(503).json({ error: 'Platform billing is not configured (set AC_STRIPE_SK).' });
  }
  try {
    const { rows } = await pool.query('SELECT * FROM public.subscription_plans WHERE id = $1', [req.params.id]);
    const plan = rows[0];
    if (!plan) return res.status(404).json({ error: 'Plan not found' });

    const result = await billing.pushPlanToStripe({
      name: plan.display_name || plan.name,
      description: plan.description,
      amount: plan.price,
      currency: plan.currency || 'usd',
      billingCycle: plan.billing_cycle,
      productId: plan.stripe_product_id,
      previousPriceId: plan.stripe_price_id,
    });

    const { rows: updated } = await pool.query(
      `UPDATE public.subscription_plans
          SET stripe_product_id = $2, stripe_price_id = $3, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 RETURNING *`,
      [plan.id, result.productId, result.priceId]
    );
    await logPlatformAction(pool, { operatorId: req.operator.id, action: 'plan.push_to_stripe',
      targetType: 'plan', targetId: String(plan.id),
      detail: { priceId: result.priceId, archived: result.archivedPriceId }, ip: clientIp(req) });
    res.json({ ...updated[0], archivedPriceId: result.archivedPriceId });
  } catch (e) {
    if (e.statusCode) return res.status(e.statusCode).json({ error: e.message });
    console.error('Plan Stripe push error:', e);
    // Surface Stripe's own message: an operator can act on "No such product" but not on
    // a generic failure.
    res.status(502).json({ error: e.message || 'Stripe rejected the request.' });
  }
});

// Make a plan buyable from the public signup page. This is the only platform-side step in
// self-serve onboarding: a plan needs a Stripe Price before a customer can check out. It
// is configured once per plan, not per customer — no operator is involved in a signup.
router.put('/plans/:id', requireOperatorRole('billing'), async (req, res) => {
  const pool = req.app.locals.pool;
  const {
    selfServe, stripePriceId, trialDays, isActive, displayName, description, price,
    currency, billingCycle, freeMonths,
    // Renaming the KEY is separate from the display name: plan_name is snapshotted onto
    // control.subscriptions, so a rename has to carry through or the console shows one
    // name and the subscription another.
    name,
  } = req.body || {};
  // A plan key is an identifier: lower-case, underscore-separated, and unique.
  let cleanKey = null;
  if (name != null && String(name).trim() !== '') {
    cleanKey = String(name).trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_');
    const clash = await req.app.locals.pool.query(
      'SELECT 1 FROM public.subscription_plans WHERE name = $1 AND id <> $2', [cleanKey, req.params.id]);
    if (clash.rows.length) return res.status(409).json({ error: `A plan named "${cleanKey}" already exists.` });
  }

  // Guard against the common mistake: ticking "sell self-serve" with no price attached
  // would leave the plan invisible on the signup page with no explanation.
  if (selfServe && !stripePriceId) {
    const { rows: cur } = await req.app.locals.pool.query(
      'SELECT stripe_price_id FROM public.subscription_plans WHERE id = $1', [req.params.id]);
    if (!cur.length || !cur[0].stripe_price_id) {
      return res.status(400).json({
        error: 'This plan has no Stripe price yet. Use "Create in Stripe" first, or paste a price id.',
      });
    }
  }
  try {
    const { rows } = await pool.query(
      `UPDATE public.subscription_plans
          SET self_serve = COALESCE($2, self_serve),
              stripe_price_id = CASE WHEN $3::text IS NOT NULL THEN NULLIF($3,'') ELSE stripe_price_id END,
              trial_days = COALESCE($4, trial_days),
              free_months = COALESCE($11, free_months),
              name = COALESCE($12, name),
              is_active = COALESCE($5, is_active),
              display_name = COALESCE($6, display_name),
              description = COALESCE($7, description),
              price = COALESCE($8, price),
              currency = COALESCE(LOWER($9), currency),
              billing_cycle = COALESCE($10, billing_cycle),
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *`,
      [req.params.id, typeof selfServe === 'boolean' ? selfServe : null,
       stripePriceId === undefined ? null : String(stripePriceId),
       trialDays === undefined || trialDays === null ? null : Number(trialDays),
       typeof isActive === 'boolean' ? isActive : null,
       displayName || null, description === undefined ? null : description,
       price == null || price === '' ? null : Number(price),
       currency || null, billingCycle || null,
       freeMonths == null || freeMonths === '' ? null : Number(freeMonths),
       cleanKey]
    );
    if (!rows.length) return res.status(404).json({ error: 'Plan not found' });
    if (cleanKey) {
      // Carry the rename onto every subscription holding the old snapshot, so the console
      // and the tenant's own settings page agree on what the plan is called.
      await pool.query(
        'UPDATE control.subscriptions SET plan_name = $2, updated_at = now() WHERE plan_id = $1',
        [req.params.id, cleanKey]);
    }
    await logPlatformAction(pool, { operatorId: req.operator.id, action: 'plan.update',
      targetType: 'plan', targetId: String(req.params.id),
      detail: { selfServe, stripePriceId, trialDays, isActive }, ip: clientIp(req) });
    res.json(rows[0]);
  } catch (e) {
    console.error('Plan update error:', e);
    res.status(500).json({ error: 'Failed to update plan' });
  }
});

router.get('/tenants/:id/subscription', async (req, res) => {
  const pool = req.app.locals.pool;
  const { rows } = await pool.query(
    `SELECT s.*, sp.display_name AS plan_display_name
       FROM control.subscriptions s
       LEFT JOIN public.subscription_plans sp ON sp.id = s.plan_id
      WHERE s.tenant_id = $1`, [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Subscription not found' });
  res.json(rows[0]);
});

// Assign/update a tenant's subscription (plan, status, seats, Stripe ids).
/**
 * What moving this tenant to `planId` costs right now, prorated. Read-only.
 * Lets an operator quote a customer before making the change.
 */
router.get('/tenants/:id/subscription/preview/:planId', async (req, res) => {
  const pool = req.app.locals.pool;
  const { rows } = await pool.query(
    `SELECT s.stripe_subscription_id, p.stripe_price_id
       FROM control.subscriptions s
       CROSS JOIN public.subscription_plans p
      WHERE s.tenant_id = $1 AND p.id = $2`,
    [req.params.id, req.params.planId]
  );
  if (!rows.length) return res.status(404).json({ error: 'Tenant or plan not found' });
  const { stripe_subscription_id: subId, stripe_price_id: priceId } = rows[0];
  if (!subId || !priceId || !billing.isConfigured()) {
    return res.json({ prorated: false, amountDue: 0, lines: [] });
  }
  const preview = await billing.previewPlanChange({ subscriptionId: subId, newPriceId: priceId });
  res.json({ prorated: true, ...preview });
});

router.put('/tenants/:id/subscription', requireOperatorRole('billing'), async (req, res) => {
  const pool = req.app.locals.pool;
  const {
    planId, status, seats, stripeCustomerId, stripeSubscriptionId, currentPeriodEnd,
    enforcementEnabled,
    // When true (the default for a plan change), the change is pushed to Stripe and
    // prorated rather than only recorded here. Set false to correct our records without
    // touching billing — for example when reconciling after a manual Stripe change.
    pushToStripe = true, prorationDate,
  } = req.body || {};
  if (status && !VALID_SUB_STATUS.has(status)) {
    return res.status(400).json({ error: `status must be one of ${[...VALID_SUB_STATUS].join(', ')}` });
  }
  const tenant = await pool.query('SELECT id, practice_id FROM control.tenants WHERE id = $1', [req.params.id]);
  if (tenant.rows.length === 0) return res.status(404).json({ error: 'Tenant not found' });
  const { practice_id } = tenant.rows[0];

  let planName = null;
  let prorated = false;
  if (planId != null) {
    const p = await pool.query(
      'SELECT name, stripe_price_id FROM public.subscription_plans WHERE id = $1', [planId]);
    if (p.rows.length === 0) return res.status(400).json({ error: 'Unknown planId' });
    planName = p.rows[0].name;

    // Move the money first. Recording a plan the customer is not actually being billed for
    // is how a tenant ends up on a higher tier for free — the same ordering the
    // tenant-facing change uses.
    const { rows: cur } = await pool.query(
      'SELECT plan_id, stripe_subscription_id FROM control.subscriptions WHERE tenant_id = $1',
      [req.params.id]);
    const existing = cur[0];
    const changingPlan = existing && existing.plan_id !== planId;
    const subId = stripeSubscriptionId || (existing && existing.stripe_subscription_id);

    if (pushToStripe && changingPlan && subId && p.rows[0].stripe_price_id && billing.isConfigured()) {
      await billing.changeSubscriptionPlan({
        subscriptionId: subId,
        newPriceId: p.rows[0].stripe_price_id,
        prorationDate: prorationDate ? Number(prorationDate) : undefined,
      });
      prorated = true;
      await ledger.recordEvent({
        tenantId: req.params.id, practiceId: practice_id,
        eventType: 'subscription.changed',
        stripeObjectId: `${subId}:plan:${planId}:${Date.now()}`,
        description: `Operator moved tenant to ${planName} (prorated)`,
      });
    }
  }

  // Upsert the subscription; COALESCE keeps existing values when a field is omitted.
  const { rows } = await pool.query(
    `INSERT INTO control.subscriptions
       (tenant_id, practice_id, plan_id, plan_name, status, seats, stripe_customer_id,
        stripe_subscription_id, current_period_end, enforcement_enabled)
     VALUES ($1,$2,$3,$4,COALESCE($5,'active'),COALESCE($6,0),$7,$8,$9,COALESCE($10,true))
     ON CONFLICT (tenant_id) DO UPDATE SET
       plan_id = COALESCE($3, control.subscriptions.plan_id),
       plan_name = COALESCE($4, control.subscriptions.plan_name),
       status = COALESCE($5, control.subscriptions.status),
       seats = COALESCE($6, control.subscriptions.seats),
       stripe_customer_id = COALESCE($7, control.subscriptions.stripe_customer_id),
       stripe_subscription_id = COALESCE($8, control.subscriptions.stripe_subscription_id),
       current_period_end = COALESCE($9, control.subscriptions.current_period_end),
       enforcement_enabled = COALESCE($10, control.subscriptions.enforcement_enabled),
       updated_at = now()
     RETURNING *`,
    [req.params.id, practice_id, planId ?? null, planName, status ?? null,
     seats ?? null, stripeCustomerId ?? null, stripeSubscriptionId ?? null,
     currentPeriodEnd ?? null, enforcementEnabled ?? null]);

  invalidateEntitlements(practice_id);
  await logPlatformAction(pool, { operatorId: req.operator.id, action: 'subscription.update',
    targetType: 'tenant', targetId: req.params.id, tenantId: req.params.id,
    detail: { planId, status, seats, prorated }, ip: clientIp(req) });
  res.json({ ...rows[0], prorated });
});

// ── Billing & accounting ──────────────────────────────────────────────────────
// Revenue reporting reads the local ledger (control.billing_events) rather than querying
// Stripe per page: it is fast, it survives a rotated key, and it is what an accountant can
// reconcile against. Stripe stays the system of record for the money itself.

router.get('/billing/summary', async (req, res) => {
  res.json(await ledger.summary());
});

router.get('/billing/events', async (req, res) => {
  res.json(await ledger.events({
    tenantId: req.query.tenantId || null,
    limit: req.query.limit,
    offset: req.query.offset,
  }));
});

/** Per-tenant revenue: what each is contracted for, and what has actually been collected. */
router.get('/billing/tenants', async (req, res) => {
  res.json(await ledger.perTenantTotals());
});

/** A tenant's invoices, live from Stripe — the authoritative document list. */
router.get('/tenants/:id/invoices', async (req, res) => {
  const pool = req.app.locals.pool;
  const { rows } = await pool.query(
    'SELECT stripe_customer_id FROM control.subscriptions WHERE tenant_id = $1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Tenant not found' });
  const customerId = rows[0].stripe_customer_id;
  if (!customerId || !billing.isConfigured()) {
    return res.json({ linked: false, invoices: [] });
  }
  res.json({ linked: true, invoices: await billing.listInvoices(customerId) });
});

/** Outstanding balances — who owes money and how long it has been outstanding. */
router.get('/billing/aging', async (req, res) => {
  res.json(await ledger.aging());
});

/** One tenant's full billing picture: totals, ledger, and what has been granted. */
router.get('/tenants/:id/billing', async (req, res) => {
  res.json(await ledger.tenantDetail(req.params.id));
});

/** The ledger as CSV, for an accountant. Read-only, so any operator may take it. */
router.get('/billing/export.csv', async (req, res) => {
  const csv = await ledger.exportCsv({ from: req.query.from || null, to: req.query.to || null });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="billing-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(csv);
});

/**
 * Post a manual credit or debit — a goodwill credit, a written-off invoice, an
 * out-of-band bank transfer.
 *
 * This does NOT move money in Stripe: it records that money moved, so the books reconcile.
 * A reason is mandatory and the operator is recorded, because an adjustment nobody signed
 * for is not an accounting record. Uses the strict writer so a failure is reported rather
 * than swallowed.
 */
router.post('/billing/adjustments', requireOperatorRole('billing'), async (req, res) => {
  const pool = req.app.locals.pool;
  const { tenantId, amount, currency = 'usd', reason, kind = 'credit' } = req.body || {};
  if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
  if (!reason || String(reason).trim().length < 10) {
    return res.status(400).json({ error: 'A reason of at least 10 characters is required.' });
  }
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) {
    return res.status(400).json({ error: 'Amount must be a positive number.' });
  }
  if (!['credit', 'debit'].includes(kind)) {
    return res.status(400).json({ error: "kind must be 'credit' or 'debit'." });
  }

  const t = await pool.query('SELECT practice_id FROM control.tenants WHERE id = $1', [tenantId]);
  if (!t.rows.length) return res.status(404).json({ error: 'Tenant not found' });

  // A credit REDUCES what the tenant owes us, so it is negative in the ledger — the same
  // sign convention as a refund. A debit is money in.
  const minor = Math.round(value * 100) * (kind === 'credit' ? -1 : 1);
  const row = await ledger.recordEventStrict({
    tenantId, practiceId: t.rows[0].practice_id,
    eventType: `adjustment.${kind}`,
    stripeObjectId: `adj_${crypto.randomUUID()}`,
    amountMinor: minor, currency: String(currency).toLowerCase(),
    description: String(reason).trim().slice(0, 500),
    operatorId: req.operator.id,
  });
  await logPlatformAction(pool, { operatorId: req.operator.id, action: `billing.adjustment.${kind}`,
    targetType: 'tenant', targetId: tenantId, tenantId,
    detail: { amount: value, currency, reason }, ip: clientIp(req) });
  res.status(201).json({ ...row, amount: minor / 100, kind });
});

// ── Coupons ───────────────────────────────────────────────────────────────────

router.get('/coupons', async (req, res) => {
  if (!billing.isConfigured()) return res.json({ configured: false, coupons: [] });
  res.json({ configured: true, coupons: await billing.listCoupons() });
});

/**
 * Create a coupon and its promotion code, optionally restricted to specific plans.
 * Restriction is by Stripe product, which is why a plan must have been pushed to Stripe
 * before it can be named here.
 */
router.post('/coupons', requireOperatorRole('billing'), async (req, res) => {
  const pool = req.app.locals.pool;
  if (!billing.isConfigured()) {
    return res.status(503).json({ error: 'Platform billing is not configured (set AC_STRIPE_SK).' });
  }
  const { code, percentOff, amountOff, currency, duration, durationInMonths,
          maxRedemptions, expiresAt, planIds = [], name } = req.body || {};
  if (!code || !/^[A-Za-z0-9_-]{3,40}$/.test(String(code).trim())) {
    return res.status(400).json({ error: 'Code must be 3-40 characters, letters, digits, - or _.' });
  }

  let productIds = [];
  if (Array.isArray(planIds) && planIds.length) {
    const { rows } = await pool.query(
      'SELECT id, display_name, stripe_product_id FROM public.subscription_plans WHERE id = ANY($1)',
      [planIds.map(Number)]);
    const missing = rows.filter((r) => !r.stripe_product_id);
    if (missing.length) {
      return res.status(400).json({
        error: `These plans have no Stripe product yet — use "Create in Stripe" first: ${missing.map((m) => m.display_name).join(', ')}`,
      });
    }
    productIds = rows.map((r) => r.stripe_product_id);
  }

  const out = await billing.createCoupon({
    code, percentOff, amountOff, currency, duration, durationInMonths,
    maxRedemptions, expiresAt, productIds, name,
  });
  await logPlatformAction(pool, { operatorId: req.operator.id, action: 'coupon.create',
    targetType: 'coupon', targetId: out.couponId,
    detail: { code: out.code, percentOff, amountOff, duration, planIds }, ip: clientIp(req) });
  res.status(201).json(out);
});

router.post('/coupons/:promotionCodeId/deactivate', requireOperatorRole('billing'), async (req, res) => {
  const pool = req.app.locals.pool;
  if (!billing.isConfigured()) return res.status(503).json({ error: 'Platform billing is not configured.' });
  await billing.deactivateCoupon(req.params.promotionCodeId);
  await logPlatformAction(pool, { operatorId: req.operator.id, action: 'coupon.deactivate',
    targetType: 'coupon', targetId: req.params.promotionCodeId, ip: clientIp(req) });
  res.json({ success: true });
});

// ── Free months ───────────────────────────────────────────────────────────────

/**
 * Give a tenant N months free. Applied in Stripe as a 100%-off discount on their
 * subscription and recorded locally with the reason and the operator who granted it.
 */
router.post('/tenants/:id/free-months', requireOperatorRole('billing'), async (req, res) => {
  const pool = req.app.locals.pool;
  const { months, reason } = req.body || {};
  if (!reason || String(reason).trim().length < 10) {
    return res.status(400).json({ error: 'A reason of at least 10 characters is required.' });
  }
  const { rows } = await pool.query(
    'SELECT stripe_subscription_id FROM control.subscriptions WHERE tenant_id = $1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Tenant has no subscription record.' });
  const subId = rows[0].stripe_subscription_id;
  if (!subId || !billing.isConfigured()) {
    return res.status(409).json({
      error: 'This tenant is not billed through Stripe, so there is nothing to discount.',
    });
  }

  const out = await billing.grantFreeMonths({ subscriptionId: subId, months, reason });
  await pool.query(
    `INSERT INTO control.subscription_grants (tenant_id, grant_type, months, stripe_coupon_id, reason, operator_id)
     VALUES ($1,'free_months',$2,$3,$4,$5)`,
    [req.params.id, out.months, out.couponId, String(reason).trim(), req.operator.id]);
  await logPlatformAction(pool, { operatorId: req.operator.id, action: 'subscription.free_months',
    targetType: 'tenant', targetId: req.params.id, tenantId: req.params.id,
    detail: { months: out.months, reason, couponId: out.couponId }, ip: clientIp(req) });
  res.status(201).json(out);
});

// ── Operators ─────────────────────────────────────────────────────────────────
// Owner-only. Managing who can reach the console — and with what power — is the one thing
// a billing or support operator must not be able to do for themselves.

router.get('/operators', requireOperatorRole('owner'), async (req, res) => {
  const { rows } = await req.app.locals.pool.query(
    `SELECT id, email, name, role, status, mfa_enabled, last_login, created_at
       FROM control.operators ORDER BY created_at`);
  res.json(rows);
});

router.post('/operators', requireOperatorRole('owner'), async (req, res) => {
  const pool = req.app.locals.pool;
  const { email, password, name, role = 'readonly' } = req.body || {};
  if (!['owner', 'billing', 'support', 'readonly'].includes(role)) {
    return res.status(400).json({ error: 'Unknown role.' });
  }
  const clean = String(email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) {
    return res.status(400).json({ error: 'A valid email address is required.' });
  }
  const pw = validatePassword(password);
  if (!pw.valid) return res.status(400).json({ error: pw.message });

  const hash = await bcrypt.hash(password, BCRYPT_COST);
  const { rows } = await pool.query(
    `INSERT INTO control.operators (email, password_hash, name, role, status)
     VALUES ($1,$2,$3,$4,'active')
     ON CONFLICT (email) DO NOTHING
     RETURNING id, email, name, role, status, created_at`,
    [clean, hash, name || null, role]);
  if (!rows.length) return res.status(409).json({ error: 'An operator with that email already exists.' });

  await logPlatformAction(pool, { operatorId: req.operator.id, action: 'operator.create',
    targetType: 'operator', targetId: rows[0].id, detail: { email: clean, role }, ip: clientIp(req) });
  res.status(201).json(rows[0]);
});

router.put('/operators/:id', requireOperatorRole('owner'), async (req, res) => {
  const pool = req.app.locals.pool;
  const { role, status } = req.body || {};
  if (role && !['owner', 'billing', 'support', 'readonly'].includes(role)) {
    return res.status(400).json({ error: 'Unknown role.' });
  }
  if (status && !['active', 'disabled'].includes(status)) {
    return res.status(400).json({ error: "status must be 'active' or 'disabled'." });
  }

  // Never let the last active owner be demoted or disabled — that would lock everyone out
  // of operator management permanently, with no way back short of database surgery.
  if ((role && role !== 'owner') || status === 'disabled') {
    const { rows: owners } = await pool.query(
      "SELECT id FROM control.operators WHERE role = 'owner' AND status = 'active'");
    if (owners.length === 1 && owners[0].id === req.params.id) {
      return res.status(409).json({ error: 'This is the last active owner. Promote another operator first.' });
    }
  }

  const { rows } = await pool.query(
    `UPDATE control.operators
        SET role = COALESCE($2, role),
            status = COALESCE($3, status),
            -- Any change to role or status revokes that operator's live sessions: a
            -- demotion that leaves an 8-hour token holding the old power is not a demotion.
            token_version = token_version + 1,
            updated_at = now()
      WHERE id = $1
      RETURNING id, email, name, role, status`,
    [req.params.id, role || null, status || null]);
  if (!rows.length) return res.status(404).json({ error: 'Operator not found' });

  await logPlatformAction(pool, { operatorId: req.operator.id, action: 'operator.update',
    targetType: 'operator', targetId: req.params.id, detail: { role, status }, ip: clientIp(req) });
  res.json(rows[0]);
});

// Anything a handler throws lands here as JSON, not as Express's HTML error page — and,
// critically, not as a process exit. A missing column almost always means a migration has
// not been applied, so say that rather than emitting a bare 500.
baseRouter.use((err, req, res, _next) => {
  const missingSchema = err && (err.code === '42703' || err.code === '42P01');
  if (missingSchema) {
    console.error(`[platform] schema out of date (${err.code}): ${err.message}\n` +
      '  Run: node backend/run-migrations.js');
    // Name the missing object. This route is operator-only and already authenticated, so
    // the detail leaks nothing a platform admin cannot see — and without it the message is
    // unactionable, especially after `--adopt`, which marks migrations applied WITHOUT
    // running them and so can hide a file the database never actually received.
    return res.status(503).json({
      error: `The database schema is out of date: ${err.message}. ` +
        'Run the pending migrations (node backend/run-migrations.js). If that reports ' +
        'nothing to do, an earlier migration was recorded by --adopt but never applied — ' +
        're-run that file directly.',
      pgCode: err.code,
    });
  }
  // Validation and conflict errors thrown from the billing service carry a statusCode.
  // Without this they surfaced as a bare 500, so "a repeating coupon needs
  // durationInMonths" looked like a server fault rather than a correctable mistake.
  if (err && err.statusCode >= 400 && err.statusCode < 500) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  console.error('[platform] unhandled error:', err);
  // Stripe rejections are actionable ("No such coupon"), so pass the message through as a
  // 502 rather than hiding it — this route is operator-only and already authenticated.
  if (err && (err.type || '').startsWith('Stripe')) {
    return res.status(502).json({ error: err.message });
  }
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = baseRouter;
