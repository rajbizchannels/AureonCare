// Public self-serve signup: choose a plan, pay, get a workspace.
//
// The flow is a two-phase commit across our database and Stripe:
//
//   POST /api/signup            -> validate, store a signup intent, return a Checkout URL
//   (customer pays on Stripe's hosted page — no card data reaches this application)
//   webhook checkout.session.completed -> provision the tenant and the admin user
//   GET  /api/signup/:id/status -> the success page polls this until the workspace is ready
//
// Nothing is provisioned before payment is confirmed, and provisioning is driven by the
// signed webhook rather than by the browser returning to the success URL — a customer who
// closes the tab still gets their workspace, and a forged success redirect gets nothing.

const express = require('express');
const rateLimit = require('express-rate-limit');
const { storeFor } = require('../middleware/rateLimitStore');
const { checkNewPassword } = require('../utils/passwordPolicy');
const { hashPassword } = require('../services/tenantProvisioning');
const billing = require('../services/platformBilling');
const { sendDbError } = require('../utils/dbErrors');

const router = express.Router();

// Signup creates Stripe objects and bcrypt hashes, both expensive; and it reveals whether
// an email is already registered, so it must not be cheap to enumerate.
const signupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many signup attempts. Please try again later.' },
  store: storeFor('signup'),
});

/**
 * A missing table or column here means migration 075 has not been applied — the single
 * most likely reason for a 500 on a freshly deployed signup flow. Say so, rather than
 * leaving an operator to guess from a generic error.
 */
const SCHEMA_ERRORS = new Set(['42703', '42P01', '3F000']);
function schemaOutOfDate(err, res, what) {
  if (!err || !SCHEMA_ERRORS.has(err.code)) return false;
  console.error(
    `[signup] ${what} failed: the database schema is out of date (${err.code}: ${err.message}).\n` +
    '  Migration 075_self_serve_signup.sql has almost certainly not been applied.\n' +
    '  Run: node backend/run-migrations.js'
  );
  res.status(503).json({
    error: 'Signup is not available yet: the database schema is out of date. Please contact support.',
  });
  return true;
}

const APP_URL = () =>
  (process.env.FRONTEND_URL || 'http://localhost:3000').split(',')[0].trim().replace(/\/$/, '');

// A plan can be started as a free trial without a card when it is active, priced (not the
// on-premises licence) and has trial days. It can be bought straight away through Stripe
// Checkout when it is also marked self-serve and linked to a Stripe price.
const TRIAL_ELIGIBLE = `is_active = true AND COALESCE(trial_days, 0) > 0 AND COALESCE(price, 0) > 0`;
const CHECKOUT_ELIGIBLE = `is_active = true AND self_serve = true AND stripe_price_id IS NOT NULL AND COALESCE(price, 0) > 0`;

/**
 * Plans offered on the signup page, with what each allows: a free trial, checkout, or both.
 * ?currency=eur or ?country=ES picks, per tier, the variant in that currency when the platform
 * offers one, else the tier's default (services/planCatalog.js).
 */
router.get('/plans', async (req, res) => {
  try {
    const { rows } = await req.app.locals.pool.query(
      `SELECT id, name, display_name, description, price, currency, billing_cycle,
              max_users, max_providers, max_patients, features, trial_days, free_months,
              (${TRIAL_ELIGIBLE}) AS can_trial, (${CHECKOUT_ELIGIBLE}) AS can_checkout,
              COALESCE(to_jsonb(sp)->>'tier', name) AS tier,
              COALESCE((to_jsonb(sp)->>'is_tier_default')::boolean, true) AS is_tier_default
         FROM public.subscription_plans sp
        WHERE (${TRIAL_ELIGIBLE}) OR (${CHECKOUT_ELIGIBLE})
        ORDER BY price ASC NULLS FIRST, id ASC`
    );
    const { pickForCurrency, currencyForCountry } = require('../services/planCatalog');
    const wanted = /^[a-z]{3}$/i.test(String(req.query.currency || '')) ? String(req.query.currency).toLowerCase()
      : currencyForCountry(req.query.country);
    res.json(pickForCurrency(rows, wanted));
  } catch (err) {
    if (schemaOutOfDate(err, res, 'loading plans')) return;
    console.error('[signup] plans error:', err);
    res.status(500).json({ error: 'Failed to load plans' });
  }
});

/** Preview a coupon before checkout, so the customer sees the discount on our page too. */
router.get('/promo/:code', signupLimiter, async (req, res) => {
  if (!billing.isConfigured()) return res.status(503).json({ error: 'Billing is not configured' });
  try {
    const promo = await billing.describePromotionCode(req.params.code);
    if (!promo) return res.status(404).json({ error: 'That promotion code is not valid.' });
    res.json(promo);
  } catch (err) {
    console.error('[signup] promo lookup error:', err.message);
    res.status(502).json({ error: 'Could not check that code right now.' });
  }
});

router.post('/', signupLimiter, async (req, res) => {
  const pool = req.app.locals.pool;
  const {
    practiceName, email, password, firstName, lastName,
    planId, country, timezone, promoCode,
  } = req.body || {};

  if (!practiceName || !String(practiceName).trim()) {
    return res.status(400).json({ error: 'Practice name is required' });
  }
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) {
    return res.status(400).json({ error: 'A valid email address is required' });
  }
  const pw = await checkNewPassword(password);
  if (!pw.valid) return res.status(400).json({ error: pw.message });
  if (!billing.isConfigured()) {
    return res.status(503).json({ error: 'Signup is not available right now.' });
  }

  try {
    const existing = await pool.query('SELECT 1 FROM public.users WHERE LOWER(email) = $1', [cleanEmail]);
    if (existing.rows.length) {
      return res.status(409).json({
        error: 'An account with that email already exists. Please sign in instead.',
      });
    }

    const { rows: planRows } = await pool.query(
      `SELECT id, name, stripe_price_id, trial_days, free_months
         FROM public.subscription_plans
        WHERE is_active = true AND self_serve = true AND stripe_price_id IS NOT NULL
          AND ($1::int IS NULL OR id = $1)
        ORDER BY price ASC NULLS FIRST, id ASC LIMIT 1`,
      [planId ? Number(planId) : null]
    );
    const plan = planRows[0];
    if (!plan) return res.status(400).json({ error: 'That plan is not available for signup.' });

    const passwordHash = await hashPassword(password);

    // Replace any abandoned attempt for this email — the partial unique index allows only
    // one pending intent per address.
    await pool.query(
      `UPDATE control.signup_intents SET status = 'expired'
        WHERE LOWER(email) = $1 AND status = 'pending'`,
      [cleanEmail]
    );

    const { rows: ir } = await pool.query(
      `INSERT INTO control.signup_intents
         (email, practice_name, first_name, last_name, password_hash, plan_id, country, timezone)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [cleanEmail, String(practiceName).trim(), firstName || null, lastName || null,
       passwordHash, plan.id, country || null, timezone || null]
    );
    const intentId = ir[0].id;

    let session;
    try {
      session = await billing.createSubscriptionCheckout({
        priceId: plan.stripe_price_id,
        email: cleanEmail,
        clientReferenceId: intentId,
        // Free months are authored in months but Stripe Checkout takes days, so the
        // larger of the two is sent. Keeping both lets the console say "2 free months"
        // while the API still receives the day count it requires.
        trialDays: Math.max(Number(plan.trial_days) || 0, (Number(plan.free_months) || 0) * 30),
        promoCode: promoCode || null,
        successUrl: `${APP_URL()}/signup/complete?intent=${intentId}`,
        cancelUrl: `${APP_URL()}/signup?cancelled=1`,
      });
    } catch (err) {
      await pool.query(
        `UPDATE control.signup_intents SET status='failed', failure_reason=$2 WHERE id=$1`,
        [intentId, String(err.message).slice(0, 500)]
      );
      const status = err.statusCode === 400 ? 400 : 502;
      return res.status(status).json({
        error: status === 400 ? err.message : 'Could not start checkout. Please try again.',
      });
    }

    await pool.query(
      'UPDATE control.signup_intents SET stripe_checkout_session_id = $2 WHERE id = $1',
      [intentId, session.id]
    );

    res.status(201).json({ intentId, checkoutUrl: session.url });
  } catch (err) {
    if (schemaOutOfDate(err, res, 'signup')) return;
    console.error('[signup] error:', err);
    // A constraint the request broke is the caller's to fix, not a server fault.
    if (sendDbError(res, err, 'Signup failed. Please try again.')) return;
    res.status(500).json({ error: 'Signup failed. Please try again.' });
  }
});

// ── Free trial, no card ──────────────────────────────────────────────────────────
//
//   POST /api/signup/trial            { practiceName, email, password, firstName?, lastName?, planId?, country?, timezone?, sampleData? }
//                                     → 202: a confirmation link is emailed; nothing is created yet
//   GET  /api/signup/trial/verify?t=  the link: creates the workspace as 'trialing' (with sample
//                                     data unless declined) and sends the person to sign in
//
// The email is proven before anything is provisioned, so nobody can open a workspace in
// someone else's name. Only SHA-256 of the link token is stored; the link works once, for 24 h.
const crypto = require('crypto');
const sha = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
const verifyLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false,
  store: storeFor('signup-verify'), skip: () => process.env.AC_RL_TEST_BYPASS === '1' && process.env.NODE_ENV !== 'production' });

router.post('/trial', signupLimiter, async (req, res) => {
  const pool = req.app.locals.pool;
  const { practiceName, email, password, firstName, lastName, planId, country, timezone, sampleData } = req.body || {};
  if (!practiceName || !String(practiceName).trim()) return res.status(400).json({ error: 'Practice name is required' });
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) return res.status(400).json({ error: 'A valid email address is required' });
  const pw = await checkNewPassword(password);
  if (!pw.valid) return res.status(400).json({ error: pw.message });
  try {
    const existing = await pool.query('SELECT 1 FROM public.users WHERE LOWER(email) = $1', [cleanEmail]);
    if (existing.rows.length) return res.status(409).json({ error: 'An account with that email already exists. Please sign in instead.' });
    const { rows: [plan] } = await pool.query(
      `SELECT id, display_name, name, trial_days FROM public.subscription_plans
        WHERE ${TRIAL_ELIGIBLE} AND ($1::int IS NULL OR id = $1)
        ORDER BY price ASC NULLS FIRST, id ASC LIMIT 1`, [planId ? Number(planId) : null]);
    if (!plan) return res.status(400).json({ error: 'That plan has no free trial.' });

    const token = crypto.randomBytes(32).toString('base64url');
    await pool.query(`UPDATE control.signup_intents SET status = 'expired' WHERE LOWER(email) = $1 AND status = 'pending'`, [cleanEmail]);
    await pool.query(
      `INSERT INTO control.signup_intents
         (email, practice_name, first_name, last_name, password_hash, plan_id, country, timezone, kind, verify_token_hash, sample_data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'trial',$9,$10)`,
      [cleanEmail, String(practiceName).trim().slice(0, 200), firstName || null, lastName || null, await hashPassword(password),
       plan.id, country ? String(country).slice(0, 2).toUpperCase() : null, timezone || null, sha(token), sampleData !== false]);

    const { sendEmail, buildEmailHtml, emailButton, escapeHtml } = require('../services/notificationService');
    const link = `${APP_URL()}/api/signup/trial/verify?t=${token}`;
    await sendEmail(cleanEmail, 'Confirm your email to start your AureonCare trial', buildEmailHtml(
      'Start your free trial', '#08B39C', `Hello${firstName ? ` ${escapeHtml(firstName)}` : ''},`,
      `Confirm your email address and your <strong>${escapeHtml(String(practiceName).trim())}</strong> workspace will be ready in seconds — ${plan.trial_days} days free, no card needed.`,
      [['Plan', plan.display_name || plan.name], ['Trial', `${plan.trial_days} days`]],
      emailButton(link, 'Confirm and start my trial') + '<p style="font-size:13px;color:#64748B">The link works once, for 24 hours. If you did not ask for this, ignore this email.</p>',
      { practiceName: 'AureonCare' })).catch((e) => console.error('[signup] trial email failed:', e.message));
    res.status(202).json({ sent: true, trialDays: plan.trial_days });
  } catch (err) {
    if (schemaOutOfDate(err, res, 'starting a trial')) return;
    console.error('[signup] trial error:', err);
    res.status(500).json({ error: 'Could not start the trial. Please try again.' });
  }
});

router.get('/trial/verify', verifyLimiter, async (req, res) => {
  const pool = req.app.locals.pool;
  const back = (q) => res.redirect(303, `${APP_URL()}/?${q}`);
  try {
    // Claim the intent: only one click provisions, however often the link is opened.
    const { rows: [intent] } = await pool.query(
      `UPDATE control.signup_intents SET status = 'provisioning', verify_token_hash = NULL
        WHERE verify_token_hash = $1 AND kind = 'trial' AND status = 'pending' AND expires_at > now()
        RETURNING *`, [sha(req.query.t || '')]);
    if (!intent) return back('trial=expired');
    const { rows: [plan] } = await pool.query('SELECT trial_days FROM public.subscription_plans WHERE id = $1', [intent.plan_id]);
    const trialEnd = new Date(Date.now() + (Number(plan && plan.trial_days) || 14) * 86400000);
    try {
      const { provisionTenant } = require('../services/tenantProvisioning');
      const { tenant, adminUserId } = await provisionTenant(pool, {
        name: intent.practice_name, planId: intent.plan_id, country: intent.country, timezone: intent.timezone,
        subscription: { status: 'trialing', trialEnd, currentPeriodEnd: trialEnd },
        admin: { email: intent.email, passwordHash: intent.password_hash, firstName: intent.first_name, lastName: intent.last_name },
      });
      await pool.query(`UPDATE control.signup_intents SET status = 'completed', tenant_id = $2, completed_at = now() WHERE id = $1`, [intent.id, tenant.id]);
      await pool.query(
        `INSERT INTO control.audit_log (operator_id, action, target_type, target_id, tenant_id, detail)
         VALUES (NULL, 'tenant.self_serve_trial', 'tenant', $1, $1, $2)`,
        [tenant.id, JSON.stringify({ email: intent.email, practice: intent.practice_name, adminUserId, trialEnd })]).catch(() => {});
      if (intent.sample_data) {
        await require('../services/sampleData').seedSampleData(pool, { practiceId: tenant.practice_id, schemaName: tenant.schema_name, userId: adminUserId })
          .catch((e) => console.error('[signup] sample data failed (the workspace is fine):', e.message));
      }
      return back('trial=ready');
    } catch (err) {
      await pool.query(`UPDATE control.signup_intents SET status = 'failed', failure_reason = $2 WHERE id = $1`, [intent.id, String(err.message).slice(0, 500)]).catch(() => {});
      console.error('[signup] trial provisioning failed:', err);
      return back('trial=failed');
    }
  } catch (err) {
    console.error('[signup] trial verify error:', err);
    return back('trial=failed');
  }
});

/**
 * Poll target for the post-checkout page. Returns only the state of the signup — never the
 * email, plan, or any other stored detail — because the intent id travels in a URL and may
 * be seen by anyone the customer forwards the link to.
 */
router.get('/:id/status', async (req, res) => {
  if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) {
    return res.status(400).json({ error: 'Invalid signup reference' });
  }
  try {
    const { rows } = await req.app.locals.pool.query(
      'SELECT status FROM control.signup_intents WHERE id = $1', [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Signup not found' });
    res.json({ status: rows[0].status, ready: rows[0].status === 'completed' });
  } catch (err) {
    if (schemaOutOfDate(err, res, 'checking signup status')) return;
    console.error('[signup] status error:', err);
    res.status(500).json({ error: 'Failed to check signup status' });
  }
});

module.exports = router;
