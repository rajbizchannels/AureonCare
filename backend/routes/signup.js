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
const { validatePassword } = require('../utils/passwordPolicy');
const { hashPassword } = require('../services/tenantProvisioning');
const billing = require('../services/platformBilling');

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

/** Plans a customer may actually buy: active, self-serve, and mapped to a Stripe price. */
router.get('/plans', async (req, res) => {
  try {
    const { rows } = await req.app.locals.pool.query(
      `SELECT id, name, display_name, description, price, billing_cycle,
              max_users, max_providers, max_patients, features, trial_days
         FROM public.subscription_plans
        WHERE is_active = true AND self_serve = true AND stripe_price_id IS NOT NULL
        ORDER BY price ASC NULLS FIRST, id ASC`
    );
    res.json(rows);
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
  const pw = validatePassword(password);
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
      `SELECT id, name, stripe_price_id, trial_days
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
        trialDays: plan.trial_days,
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
    res.status(500).json({ error: 'Signup failed. Please try again.' });
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
