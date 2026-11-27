// Card payments from patients, through Stripe Connect (migration 110).
//
// Each practice connects ITS OWN Stripe account (a Standard connected account): the practice
// is the merchant, its name is on the patient's card statement, the money lands in its own
// Stripe balance and it handles its own refunds and disputes in its own Stripe dashboard.
// AureonCare never holds patient money and never sees a card: the patient pays on Stripe's
// hosted Checkout page, created as a DIRECT CHARGE on the practice's account (the
// Stripe-Account header), so the platform is not the merchant of record.
//
// The platform's own account (services/platformBilling.js) stays what it was: practices paying
// for AureonCare. Both use the platform secret key; Connect calls add { stripeAccount }.
//
// Optional platform fee: AC_CONNECT_FEE_BPS (basis points of each payment, default 0) is taken
// as an application fee on the direct charge. Leave it 0 unless the pricing says otherwise.

const platformBilling = require('./platformBilling');
const { practiceCurrency } = require('./planCatalog');

// Stripe amounts are in the currency's smallest unit; these have none (or Stripe treats them so).
const ZERO_DECIMAL = new Set(['bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf']);
const THREE_DECIMAL = new Set(['bhd', 'jod', 'kwd', 'omr', 'tnd']);
const factor = (cur) => (ZERO_DECIMAL.has(cur) ? 1 : THREE_DECIMAL.has(cur) ? 1000 : 100);
const toMinor = (amount, cur) => {
  const f = factor(cur);
  const v = Math.round(Number(amount) * f);
  return THREE_DECIMAL.has(cur) ? Math.round(v / 10) * 10 : v; // Stripe wants the last digit 0
};
const fromMinor = (minor, cur) => Number(minor) / factor(cur);

const feeBps = () => {
  const n = parseInt(process.env.AC_CONNECT_FEE_BPS || '0', 10);
  return Number.isFinite(n) && n > 0 && n < 10000 ? n : 0;
};

const err = (status, message, code) => Object.assign(new Error(message), { statusCode: status, code });

async function loadPractice(pool, practiceId) {
  const { rows: [p] } = await pool.query(
    `SELECT id, name, email, country, stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled,
            stripe_details_submitted, stripe_account_updated_at
       FROM public.practices WHERE id::text = $1::text`, [practiceId]);
  if (!p) throw err(404, 'Practice not found');
  return p;
}

const view = (p) => ({
  connected: Boolean(p.stripe_account_id),
  accountId: p.stripe_account_id || null,
  chargesEnabled: Boolean(p.stripe_charges_enabled),
  payoutsEnabled: Boolean(p.stripe_payouts_enabled),
  detailsSubmitted: Boolean(p.stripe_details_submitted),
  // ready = patients can pay; anything else means "finish setting up in Stripe".
  ready: Boolean(p.stripe_account_id && p.stripe_charges_enabled),
  updatedAt: p.stripe_account_updated_at || null,
  platformConfigured: platformBilling.isConfigured(),
  feeBps: feeBps(),
});

async function status(pool, practiceId) {
  return view(await loadPractice(pool, practiceId));
}

async function saveAccount(pool, account) {
  const { rows: [p] } = await pool.query(
    `UPDATE public.practices SET stripe_charges_enabled = $2, stripe_payouts_enabled = $3,
            stripe_details_submitted = $4, stripe_account_updated_at = now()
      WHERE stripe_account_id = $1 RETURNING *`,
    [account.id, Boolean(account.charges_enabled), Boolean(account.payouts_enabled), Boolean(account.details_submitted)]);
  return p || null;
}

/**
 * Connect (or finish connecting) the practice's Stripe account. Creates the Standard account on
 * first use, then returns a one-time Stripe onboarding link. The practice can sign in to an
 * existing Stripe account on that page or open a new one.
 */
async function startOnboarding(pool, practiceId, { returnUrl, refreshUrl, email } = {}) {
  const stripe = platformBilling.stripe();
  const p = await loadPractice(pool, practiceId);
  let accountId = p.stripe_account_id;
  if (!accountId) {
    const country = /^[A-Z]{2}$/.test(String(p.country || '').toUpperCase()) ? String(p.country).toUpperCase() : undefined;
    const account = await stripe.accounts.create({
      type: 'standard',
      ...(country ? { country } : {}),
      ...((email || p.email) ? { email: email || p.email } : {}),
      business_profile: { name: p.name || undefined },
      metadata: { practice_id: String(p.id) },
    });
    accountId = account.id;
    // Only set it if still empty, so two admins clicking at once keep the first account.
    const { rows } = await pool.query(
      `UPDATE public.practices SET stripe_account_id = $2, stripe_account_updated_at = now()
        WHERE id::text = $1::text AND stripe_account_id IS NULL RETURNING stripe_account_id`, [practiceId, accountId]);
    if (!rows[0]) accountId = (await loadPractice(pool, practiceId)).stripe_account_id;
  }
  const link = await stripe.accountLinks.create({
    account: accountId, type: 'account_onboarding', return_url: returnUrl, refresh_url: refreshUrl || returnUrl,
  });
  return { url: link.url, accountId };
}

/** Re-read the account from Stripe (after onboarding returns, or on "Refresh"). */
async function refresh(pool, practiceId) {
  const p = await loadPractice(pool, practiceId);
  if (!p.stripe_account_id) return view(p);
  const account = await platformBilling.stripe().accounts.retrieve(p.stripe_account_id);
  return view((await saveAccount(pool, account)) || p);
}

/**
 * Stop taking card payments here. The Stripe account itself is the practice's and stays as it
 * is (payments, payouts and refunds carry on in its Stripe dashboard); open pay links stop working
 * the next time someone opens them, because the webhook no longer matches the practice.
 */
async function disconnect(pool, practiceId) {
  await pool.query(
    `UPDATE public.practices SET stripe_account_id = NULL, stripe_charges_enabled = false,
            stripe_payouts_enabled = false, stripe_details_submitted = false, stripe_account_updated_at = now()
      WHERE id::text = $1::text`, [practiceId]);
  return status(pool, practiceId);
}

/**
 * A Stripe Checkout link for what is still owed on an invoice, charged directly on the practice's
 * account. Any earlier open link for the invoice is expired first, so a patient cannot pay twice
 * through two links. `db` is the practice's tenant connection.
 */
async function createPayLink(pool, db, practiceId, invoiceId, { successUrl, cancelUrl } = {}) {
  const p = await loadPractice(pool, practiceId);
  if (!p.stripe_account_id) throw err(409, 'Card payments are not set up. An admin connects Stripe under Settings → Card payments.', 'not_connected');
  if (!p.stripe_charges_enabled) throw err(409, 'Stripe has not enabled card payments for this practice yet. Finish the Stripe setup under Settings → Card payments.', 'not_ready');

  const { rows: [inv] } = await db.query(
    `SELECT i.*, pt.email AS patient_email FROM billing_invoices i LEFT JOIN patients pt ON pt.id = i.patient_id WHERE i.id = $1`, [invoiceId]);
  if (!inv) throw err(404, 'Invoice not found');
  if (['paid', 'cancelled', 'canceled', 'void', 'draft'].includes(String(inv.status))) {
    throw err(409, inv.status === 'draft' ? 'Send the invoice before asking for payment.' : `This invoice is ${inv.status}.`, 'not_payable');
  }
  const balance = Number(inv.balance_due != null ? inv.balance_due : Number(inv.total_amount) - Number(inv.amount_paid || 0));
  const currency = (await practiceCurrency(pool, practiceId)) || 'eur';
  const amount = toMinor(balance, currency);
  if (!(amount > 0)) throw err(409, 'Nothing is owed on this invoice.', 'not_payable');

  const stripe = platformBilling.stripe();
  const onAccount = { stripeAccount: p.stripe_account_id };
  if (inv.pay_link_session_id && inv.pay_link_expires_at && new Date(inv.pay_link_expires_at) > new Date()) {
    try { await stripe.checkout.sessions.expire(inv.pay_link_session_id, {}, onAccount); } catch (_) { /* already completed or expired */ }
  }

  const meta = { aureoncare_kind: 'invoice', practice_id: String(p.id), invoice_id: String(inv.id), invoice_number: String(inv.invoice_number || '') };
  const fee = feeBps() ? Math.floor((amount * feeBps()) / 10000) : 0;
  const expiresAt = Math.floor(Date.now() / 1000) + 23 * 3600; // Checkout allows up to 24 h
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    // The line says only "Invoice INV-…": a receipt should not name the care given.
    line_items: [{ quantity: 1, price_data: { currency, unit_amount: amount, product_data: { name: `Invoice ${inv.invoice_number || ''}`.trim() } } }],
    payment_intent_data: { metadata: meta, ...(fee ? { application_fee_amount: fee } : {}) },
    metadata: meta,
    client_reference_id: String(inv.id),
    ...(inv.patient_email ? { customer_email: inv.patient_email } : {}),
    success_url: successUrl,
    cancel_url: cancelUrl || successUrl,
    expires_at: expiresAt,
  }, onAccount);

  await db.query(
    `UPDATE billing_invoices SET pay_link_url = $2, pay_link_session_id = $3, pay_link_expires_at = to_timestamp($4), updated_at = now() WHERE id = $1`,
    [inv.id, session.url, session.id, expiresAt]);
  return { url: session.url, sessionId: session.id, expiresAt: new Date(expiresAt * 1000).toISOString(), amount: fromMinor(amount, currency), currency };
}

/**
 * A paid Checkout Session on a connected account → a billing payment on the invoice. Trusts the
 * session's metadata only when the account that sent the event is the one connected to that
 * practice. Idempotent: Stripe retries, and completed + async_payment_succeeded can both arrive.
 */
async function recordCheckoutPayment(pool, event) {
  const s = event.data && event.data.object;
  const m = (s && s.metadata) || {};
  if (!s || m.aureoncare_kind !== 'invoice' || s.payment_status !== 'paid') return { recorded: false, reason: 'not_invoice_payment' };
  const { rows: [p] } = await pool.query(
    'SELECT id FROM public.practices WHERE id::text = $1::text AND stripe_account_id = $2', [m.practice_id, event.account || '']);
  if (!p) { console.warn('[stripe-connect] payment for an account not connected to that practice; ignored', s.id); return { recorded: false, reason: 'account_mismatch' }; }
  const { rows: [t] } = await pool.query("SELECT schema_name FROM control.tenants WHERE practice_id = $1 AND status = 'active'", [p.id]);
  const schema = t && t.schema_name;
  if (!schema || !/^[a-z_][a-z0-9_]*$/.test(schema)) return { recorded: false, reason: 'no_tenant' };

  const currency = String(s.currency || 'eur').toLowerCase();
  const amount = fromMinor(s.amount_total, currency);
  const intent = typeof s.payment_intent === 'string' ? s.payment_intent : (s.payment_intent && s.payment_intent.id) || null;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL search_path TO ${schema}, public, control`);
    const { rows: [inv] } = await client.query('SELECT id, patient_id FROM billing_invoices WHERE id = $1 FOR UPDATE', [m.invoice_id]);
    if (!inv) { await client.query('ROLLBACK'); return { recorded: false, reason: 'no_invoice' }; }
    const number = (await client.query('SELECT generate_billing_payment_number() AS num')).rows[0].num;
    const { rows: [pay] } = await client.query(
      `INSERT INTO billing_payments (payment_number, invoice_id, patient_id, amount, payment_method, payment_date, status,
                                     transaction_id, reference_number, notes, stripe_payment_intent_id, stripe_checkout_session_id)
       VALUES ($1, $2, $3, $4, 'credit_card', now(), 'completed', $5, $6, 'Paid online by card (Stripe)', $5, $6)
       ON CONFLICT (stripe_checkout_session_id) WHERE stripe_checkout_session_id IS NOT NULL DO NOTHING
       RETURNING id`, [number, inv.id, inv.patient_id, amount, intent, s.id]);
    if (!pay) { await client.query('ROLLBACK'); return { recorded: false, reason: 'duplicate' }; }
    await client.query(
      `UPDATE billing_invoices SET
         amount_paid = amount_paid + $1,
         balance_due = GREATEST(total_amount - (amount_paid + $1), 0),
         status = CASE WHEN total_amount <= (amount_paid + $1) THEN 'paid' WHEN (amount_paid + $1) > 0 THEN 'partially_paid' ELSE status END,
         pay_link_url = CASE WHEN pay_link_session_id = $3 THEN NULL ELSE pay_link_url END,
         pay_link_session_id = CASE WHEN pay_link_session_id = $3 THEN NULL ELSE pay_link_session_id END,
         pay_link_expires_at = CASE WHEN pay_link_session_id = $3 THEN NULL ELSE pay_link_expires_at END,
         updated_at = now()
       WHERE id = $2`, [amount, inv.id, s.id]);
    await client.query('COMMIT');
    return { recorded: true, paymentId: pay.id, invoiceId: inv.id, amount };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/**
 * A refund made in the practice's Stripe dashboard → the card payment and its invoice. Stripe sends
 * the charge with its running total refunded, so only the difference since the last event is applied:
 * repeats change nothing and several partial refunds add up.
 */
async function recordRefund(pool, event) {
  const ch = event.data && event.data.object;
  const intent = ch && (typeof ch.payment_intent === 'string' ? ch.payment_intent : ch.payment_intent && ch.payment_intent.id);
  if (!ch || !intent || !event.account) return { recorded: false, reason: 'not_a_card_payment' };
  const { rows: [t] } = await pool.query(
    `SELECT t.schema_name FROM public.practices p JOIN control.tenants t ON t.practice_id = p.id AND t.status = 'active'
      WHERE p.stripe_account_id = $1`, [event.account]);
  const schema = t && t.schema_name;
  if (!schema || !/^[a-z_][a-z0-9_]*$/.test(schema)) return { recorded: false, reason: 'account_not_connected' };
  const refunded = fromMinor(ch.amount_refunded || 0, String(ch.currency || 'eur').toLowerCase());
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL search_path TO ${schema}, public, control`);
    const { rows: [pay] } = await client.query(
      'SELECT id, invoice_id, amount, refunded_amount FROM billing_payments WHERE stripe_payment_intent_id = $1 FOR UPDATE', [intent]);
    if (!pay) { await client.query('ROLLBACK'); return { recorded: false, reason: 'no_payment' }; }
    const total = Math.min(refunded, Number(pay.amount));
    const delta = Math.round((total - Number(pay.refunded_amount || 0)) * 100) / 100;
    if (!(delta > 0)) { await client.query('ROLLBACK'); return { recorded: false, reason: 'already_recorded' }; }
    await client.query(
      `UPDATE billing_payments SET refunded_amount = $2,
              status = CASE WHEN $2 >= amount THEN 'refunded' ELSE 'partially_refunded' END,
              notes = concat_ws(E'\n', notes, $3::text), updated_at = now()
        WHERE id = $1`, [pay.id, total, `Refunded ${total} in Stripe`]);
    if (pay.invoice_id) {
      await client.query(
        `UPDATE billing_invoices SET
           amount_paid = GREATEST(amount_paid - $1, 0),
           balance_due = total_amount - GREATEST(amount_paid - $1, 0),
           status = CASE WHEN GREATEST(amount_paid - $1, 0) <= 0 THEN 'sent'
                         WHEN GREATEST(amount_paid - $1, 0) < total_amount THEN 'partially_paid' ELSE status END,
           updated_at = now()
         WHERE id = $2`, [delta, pay.invoice_id]);
    }
    await client.query('COMMIT');
    return { recorded: true, paymentId: pay.id, refunded: total, delta };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { recordRefund, status, startOnboarding, refresh, disconnect, createPayLink, recordCheckoutPayment, saveAccount, toMinor, fromMinor, feeBps };
