const express = require('express');
const crypto = require('crypto');
const router = express.Router();

// ─── Signature verification ───────────────────────────────────────────────────
// Stripe sends a `Stripe-Signature` header containing a timestamp and one or
// more HMAC-SHA256 signatures.  We must verify using the RAW request body
// (before any JSON parsing), which is why this route is mounted before
// express.json() in server.js.

const TOLERANCE_SECONDS = 300; // 5 minutes — Stripe's own default

/**
 * Resolve the active webhook secret.
 * Priority: per-subscriber DB value → platform env var.
 */
async function resolveWebhookSecret(pool) {
  try {
    const result = await pool.query(
      'SELECT webhook_secret, use_platform_integration FROM stripe_integration_settings LIMIT 1'
    );
    const row = result.rows[0];
    if (!row) return null;

    if (row.use_platform_integration) {
      return process.env.AC_STRIPE_WHS || process.env.STRIPE_WEBHOOK_SECRET || null;
    }
    return row.webhook_secret || null;
  } catch {
    // Table may not exist yet — fall back to env var
    return process.env.AC_STRIPE_WHS || process.env.STRIPE_WEBHOOK_SECRET || null;
  }
}

/**
 * Verify the Stripe-Signature header against the raw body.
 * Returns the parsed event object or throws on failure.
 */
function verifyAndParseEvent(rawBody, sigHeader, secret) {
  if (!sigHeader) throw new Error('Missing Stripe-Signature header');
  if (!secret)    throw new Error('Webhook secret not configured');

  // Parse header: t=<timestamp>,v1=<sig>[,v1=<sig>...]
  const parts = {};
  sigHeader.split(',').forEach((part) => {
    const [key, value] = part.split('=');
    if (key === 'v1') {
      parts.v1 = parts.v1 || [];
      parts.v1.push(value);
    } else {
      parts[key] = value;
    }
  });

  if (!parts.t || !parts.v1) throw new Error('Invalid Stripe-Signature format');

  const timestamp = parseInt(parts.t, 10);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > TOLERANCE_SECONDS) {
    throw new Error(`Webhook timestamp too old (${Math.abs(now - timestamp)}s)`);
  }

  const payload = `${parts.t}.${rawBody}`;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');

  const matched = parts.v1.some((sig) =>
    crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))
  );
  if (!matched) throw new Error('Stripe signature mismatch');

  return JSON.parse(rawBody);
}

// ─── Event handlers ───────────────────────────────────────────────────────────

async function handlePaymentIntentSucceeded(pool, paymentIntent) {
  const { id, amount, charges } = paymentIntent;
  const charge = charges?.data?.[0];

  const amountDecimal = (amount / 100).toFixed(2);
  const cardLast4  = charge?.payment_method_details?.card?.last4   || null;
  const cardBrand  = charge?.payment_method_details?.card?.brand    || null;
  const receiptUrl = charge?.receipt_url                            || null;

  // Update any payment row that holds this PaymentIntent as its transaction_id
  const result = await pool.query(`
    UPDATE payments
    SET payment_status = 'completed',
        payment_date   = NOW(),
        card_last_four = COALESCE($1, card_last_four),
        card_brand     = COALESCE($2, card_brand),
        notes          = COALESCE(notes || ' | Receipt: ' || $3, notes),
        updated_at     = NOW()
    WHERE transaction_id = $4
    RETURNING id, patient_id, claim_id
  `, [cardLast4, cardBrand, receiptUrl, id]);

  if (result.rowCount === 0) {
    // No existing payment row — create one so the event isn't lost
    const paymentNumber = `STRIPE-${id.slice(-8).toUpperCase()}`;
    await pool.query(`
      INSERT INTO payments (
        payment_number, amount, payment_method, payment_status,
        transaction_id, card_last_four, card_brand, payment_date,
        description, created_at, updated_at
      ) VALUES ($1, $2, 'card', 'completed', $3, $4, $5, NOW(),
                'Stripe payment (webhook)', NOW(), NOW())
      ON CONFLICT (payment_number) DO NOTHING
    `, [paymentNumber, amountDecimal, id, cardLast4, cardBrand]);
  }

  // If this PaymentIntent is linked to a billing invoice, mark it paid
  if (result.rows[0]?.claim_id) {
    await pool.query(`
      UPDATE billing_invoices
      SET status     = 'paid',
          paid_date  = NOW(),
          updated_at = NOW()
      WHERE claim_id::text = $1::text AND status <> 'paid'
    `, [result.rows[0].claim_id]).catch(() => {}); // ignore if table doesn't exist
  }

  console.log(`[stripe-webhook] payment_intent.succeeded: ${id} ($${amountDecimal})`);
}

async function handlePaymentIntentFailed(pool, paymentIntent) {
  const { id, last_payment_error } = paymentIntent;
  const reason = last_payment_error?.message || 'Payment declined';

  await pool.query(`
    UPDATE payments
    SET payment_status = 'failed',
        notes          = COALESCE(notes || ' | Failure: ' || $1, 'Failure: ' || $1),
        updated_at     = NOW()
    WHERE transaction_id = $2
  `, [reason, id]);

  console.log(`[stripe-webhook] payment_intent.payment_failed: ${id} — ${reason}`);
}

async function handleCheckoutSessionCompleted(pool, session) {
  const { id, payment_intent, amount_total, customer_details } = session;
  const amountDecimal = ((amount_total || 0) / 100).toFixed(2);

  // If we stored the session ID as the transaction_id, update it now
  // and replace with the real PaymentIntent ID for future lookups.
  await pool.query(`
    UPDATE payments
    SET payment_status = 'completed',
        payment_date   = NOW(),
        transaction_id = COALESCE($1, transaction_id),
        notes          = COALESCE(notes || ' | Checkout: ' || $2, 'Checkout: ' || $2),
        updated_at     = NOW()
    WHERE transaction_id = $3 OR transaction_id = $1
  `, [payment_intent, id, id]);

  console.log(`[stripe-webhook] checkout.session.completed: ${id} ($${amountDecimal})`);
}

async function handleChargeRefunded(pool, charge) {
  const { payment_intent, amount_refunded } = charge;
  const refundDecimal = ((amount_refunded || 0) / 100).toFixed(2);

  await pool.query(`
    UPDATE payments
    SET payment_status = 'refunded',
        notes          = COALESCE(notes || $1, $1),
        updated_at     = NOW()
    WHERE transaction_id = $2
  `, [` | Refunded $${refundDecimal} via Stripe`, payment_intent]);

  console.log(`[stripe-webhook] charge.refunded: pi=${payment_intent} refund=$${refundDecimal}`);
}

async function handleDisputeCreated(pool, dispute) {
  const { id, charge, amount, reason } = dispute;
  const amountDecimal = ((amount || 0) / 100).toFixed(2);

  // Append a dispute note to the payment record — do NOT auto-flip status,
  // disputes can be won.
  await pool.query(`
    UPDATE payments
    SET notes      = COALESCE(notes || $1, $1),
        updated_at = NOW()
    FROM (
      SELECT id AS payment_id FROM payments WHERE transaction_id = $2 LIMIT 1
    ) sub
    WHERE payments.id = sub.payment_id
  `, [` | DISPUTE ${id}: ${reason} ($${amountDecimal}) — action required`, charge])
    .catch(() => {}); // charge ID lookup; best-effort

  console.warn(`[stripe-webhook] charge.dispute.created: ${id} ($${amountDecimal}) reason=${reason}`);
}

// ─── Route ────────────────────────────────────────────────────────────────────

// NOTE: This route MUST receive the raw body for signature verification.
// It is mounted in server.js BEFORE express.json() with express.raw().
router.post('/', async (req, res) => {
  const pool = req.app.locals.pool;
  const rawBody = req.body; // Buffer (set by express.raw in server.js)
  const sigHeader = req.headers['stripe-signature'];

  let event;
  try {
    const secret = await resolveWebhookSecret(pool);
    event = verifyAndParseEvent(rawBody.toString('utf8'), sigHeader, secret);
  } catch (err) {
    console.error('[stripe-webhook] Verification failed:', err.message);
    return res.status(400).json({ error: err.message });
  }

  // Respond immediately — Stripe expects a 2xx within 30 s
  res.json({ received: true });

  // Process asynchronously so a slow DB write doesn't time out Stripe
  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(pool, event.data.object);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(pool, event.data.object);
        break;
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(pool, event.data.object);
        break;
      case 'charge.refunded':
        await handleChargeRefunded(pool, event.data.object);
        break;
      case 'charge.dispute.created':
        await handleDisputeCreated(pool, event.data.object);
        break;
      default:
        // Unhandled event types are silently acknowledged
        break;
    }
  } catch (err) {
    // Log but don't re-send a response — we already replied 200
    console.error(`[stripe-webhook] Error processing ${event.type}:`, err);
  }
});

module.exports = router;
