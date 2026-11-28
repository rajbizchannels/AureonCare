const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const connect = require('../services/stripeConnect');

/**
 * /api/card-payments — a practice connecting its own Stripe account so patients can pay invoices
 * by card (services/stripeConnect.js). Admins only. Pay links themselves are made under
 * /api/billing/invoices/:id/pay-link and in the patient portal.
 */
const router = express.Router();
router.use(authenticate);
router.use(requireAdmin);

const appUrl = () => (process.env.FRONTEND_URL || 'http://localhost:3000').split(',')[0].trim().replace(/\/$/, '');
const practiceOf = (req) => (req.tenant && req.tenant.practiceId) || (req.user && req.user.practice_id);
// The platform's Stripe account has not been signed up for Connect (or not in this mode — test
// and live are enabled separately). Nothing a practice can fix: the operator enables Connect.
const connectNotEnabled = (e) => /signed up for Connect|enable Connect|platform-profile|connect\/onboarding/i.test(String(e && e.message));

const fail = (res, e, what) => {
  // Stripe's own errors first: they carry Stripe's HTTP status (often 400), which is about our
  // platform request, not something the practice sent.
  if (e.type && /^Stripe/.test(e.type)) {
    if (connectNotEnabled(e)) {
      console.error('[card-payments] Stripe Connect is not enabled on the platform Stripe account (for this key\'s mode). '
        + 'Enable it at https://dashboard.stripe.com/connect (and /test/connect for test keys), then try again.');
      return res.status(503).json({ code: 'connect_not_enabled',
        error: 'Card payments are not switched on for AureonCare yet. Please try again later or contact AureonCare support.' });
    }
    console.error(`[card-payments] ${what}: Stripe ${e.type}: ${e.message}`);
    return res.status(502).json({ error: 'Stripe could not complete this just now. Please try again in a few minutes.' });
  }
  if (e.statusCode && e.statusCode < 500) return res.status(e.statusCode).json({ error: e.message, code: e.code });
  if (e.statusCode === 503) return res.status(503).json({ error: e.message });
  console.error(`[card-payments] ${what}:`, e.message);
  return res.status(500).json({ error: `Failed to ${what}` });
};

router.get('/', async (req, res) => {
  try { res.json(await connect.status(req.app.locals.pool, practiceOf(req))); } catch (e) { fail(res, e, 'load card payments'); }
});

// Start, or finish, connecting Stripe. Returns Stripe's onboarding page to send the admin to.
router.post('/connect', async (req, res) => {
  try {
    const back = `${appUrl()}/?card_payments=1`;
    const out = await connect.startOnboarding(req.app.locals.pool, practiceOf(req), {
      returnUrl: `${back}&stripe=return`, refreshUrl: `${back}&stripe=refresh`, email: req.user && req.user.email,
    });
    res.json(out);
  } catch (e) { fail(res, e, 'start Stripe onboarding'); }
});

router.post('/refresh', async (req, res) => {
  try { res.json(await connect.refresh(req.app.locals.pool, practiceOf(req))); } catch (e) { fail(res, e, 'refresh Stripe status'); }
});

router.delete('/', async (req, res) => {
  try { res.json(await connect.disconnect(req.app.locals.pool, practiceOf(req))); } catch (e) { fail(res, e, 'disconnect Stripe'); }
});

module.exports = router;
module.exports.fail = fail;
module.exports.appUrl = appUrl;
