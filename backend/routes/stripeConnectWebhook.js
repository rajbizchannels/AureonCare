const express = require('express');
const { verifyAndParseEvent } = require('./stripeWebhook');
const connect = require('../services/stripeConnect');

const router = express.Router();

/**
 * POST /api/stripe-connect-webhook — events from practices' connected Stripe accounts.
 *
 * Registered in the Stripe dashboard as a CONNECT webhook ("Events on connected accounts"), with
 * its own signing secret in AC_STRIPE_CONNECT_WHS. Every event carries `account` (the practice's
 * acct_…). Handled:
 *   checkout.session.completed / checkout.session.async_payment_succeeded → payment on the invoice
 *   charge.refunded → the refund on the card payment and its invoice
 *   account.updated → whether the practice can take card payments yet
 * Mounted with express.raw() before the JSON parser, for the signature check.
 */
router.post('/', async (req, res) => {
  const pool = req.app.locals.pool;
  const secret = (process.env.AC_STRIPE_CONNECT_WHS || '').trim() || null;
  let event;
  try {
    event = verifyAndParseEvent(Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body || ''), req.headers['stripe-signature'], secret);
  } catch (e) {
    console.error('[stripe-connect] verification failed:', e.message);
    return res.status(400).json({ error: e.message });
  }
  try {
    let result = { handled: false };
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        result = await connect.recordCheckoutPayment(pool, event);
        break;
      case 'charge.refunded':
        result = await connect.recordRefund(pool, event);
        break;
      case 'account.updated':
        await connect.saveAccount(pool, event.data.object);
        result = { handled: true };
        break;
      default:
        break;
    }
    return res.json({ received: true, ...result });
  } catch (e) {
    // 500 so Stripe retries; recording is idempotent on the Checkout Session id.
    console.error('[stripe-connect] handling', event.type, 'failed:', e.message);
    return res.status(500).json({ error: 'Failed to process event' });
  }
});

module.exports = router;
