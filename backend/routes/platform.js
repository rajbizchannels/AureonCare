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

const router = express.Router();
const { signPlatformToken, requirePlatformAdmin, requireSecret } = require('../middleware/platformAuth');
const { logPlatformAction } = require('../services/platformAudit');
const { withTenant } = require('../db/tenantClient');
const { BCRYPT_COST, validatePassword } = require('../utils/passwordPolicy');
const { invalidateEntitlements } = require('../services/entitlements');
const { provisionTenant } = require('../services/tenantProvisioning');
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
  res.json({ otpauthUrl: secret.otpauth_url, base32: secret.base32, note: 'Verify a code at /mfa/verify to enable.' });
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

router.post('/tenants', async (req, res) => {
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
router.post('/tenants/:id/suspend', (req, res) => setTenantStatus(req, res, 'suspended', 'tenant.suspend'));
router.post('/tenants/:id/resume', (req, res) => setTenantStatus(req, res, 'active', 'tenant.resume'));

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
router.post('/tenants/:id/break-glass', async (req, res) => {
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
    `SELECT id, name, display_name, price, billing_cycle, max_users, max_patients, max_providers,
            features, self_serve, stripe_price_id, trial_days
       FROM public.subscription_plans WHERE is_active = true ORDER BY price NULLS FIRST, id`);
  res.json(rows);
});

// Make a plan buyable from the public signup page. This is the only platform-side step in
// self-serve onboarding: a plan needs a Stripe Price before a customer can check out. It
// is configured once per plan, not per customer — no operator is involved in a signup.
router.put('/plans/:id', async (req, res) => {
  const pool = req.app.locals.pool;
  const { selfServe, stripePriceId, trialDays } = req.body || {};
  if (selfServe && !stripePriceId) {
    return res.status(400).json({ error: 'A Stripe price id is required to sell a plan self-serve.' });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE public.subscription_plans
          SET self_serve = COALESCE($2, self_serve),
              stripe_price_id = CASE WHEN $3::text IS NOT NULL THEN NULLIF($3,'') ELSE stripe_price_id END,
              trial_days = COALESCE($4, trial_days),
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id, name, display_name, price, self_serve, stripe_price_id, trial_days`,
      [req.params.id, typeof selfServe === 'boolean' ? selfServe : null,
       stripePriceId === undefined ? null : String(stripePriceId),
       trialDays === undefined || trialDays === null ? null : Number(trialDays)]
    );
    if (!rows.length) return res.status(404).json({ error: 'Plan not found' });
    await logPlatformAction(pool, { operatorId: req.operator.id, action: 'plan.update',
      targetType: 'plan', targetId: String(req.params.id),
      detail: { selfServe, stripePriceId, trialDays }, ip: clientIp(req) });
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
router.put('/tenants/:id/subscription', async (req, res) => {
  const pool = req.app.locals.pool;
  const { planId, status, seats, stripeCustomerId, stripeSubscriptionId, currentPeriodEnd, enforcementEnabled } = req.body || {};
  if (status && !VALID_SUB_STATUS.has(status)) {
    return res.status(400).json({ error: `status must be one of ${[...VALID_SUB_STATUS].join(', ')}` });
  }
  const tenant = await pool.query('SELECT id, practice_id FROM control.tenants WHERE id = $1', [req.params.id]);
  if (tenant.rows.length === 0) return res.status(404).json({ error: 'Tenant not found' });
  const { practice_id } = tenant.rows[0];

  let planName = null;
  if (planId != null) {
    const p = await pool.query('SELECT name FROM public.subscription_plans WHERE id = $1', [planId]);
    if (p.rows.length === 0) return res.status(400).json({ error: 'Unknown planId' });
    planName = p.rows[0].name;
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
    detail: { planId, status, seats }, ip: clientIp(req) });
  res.json(rows[0]);
});

module.exports = router;
