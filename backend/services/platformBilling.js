// Platform billing — clinics paying US for the service.
//
// Deliberately separate from routes/stripeSettings.js and the per-tenant Stripe
// configuration, which is a DIFFERENT relationship: that is a clinic collecting money from
// its own patients, keyed on that clinic's own Stripe account. Charging a subscription
// against a tenant's connected account would take a clinic's money into its own Stripe
// balance and never reach us. Platform billing therefore reads ONLY the env-configured
// platform credentials and never the stripe_integration_settings table.
//
// Card details are never seen by this application: signup redirects to Stripe's hosted
// Checkout page, which collects and stores the card. That keeps the deployment in PCI
// SAQ-A rather than SAQ-D, which matters a great deal for a healthcare product.

const Stripe = require('stripe');

const SECRET = process.env.AC_STRIPE_SK || process.env.STRIPE_SECRET_KEY || null;

let client = null;
function stripe() {
  if (!SECRET) {
    const e = new Error('Platform billing is not configured (set AC_STRIPE_SK).');
    e.statusCode = 503;
    throw e;
  }
  if (!client) client = new Stripe(SECRET, { apiVersion: '2024-06-20' });
  return client;
}

const isConfigured = () => Boolean(SECRET);

/**
 * Create a hosted Checkout Session for a new subscription.
 *
 * `clientReferenceId` is the signup intent id — it is how the webhook maps the completed
 * payment back to the pending signup. It is a random uuid, not guessable, and carries no
 * personal data through Stripe.
 */
async function createSubscriptionCheckout({
  priceId, email, clientReferenceId, successUrl, cancelUrl, trialDays, promoCode,
}) {
  const params = {
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: email,
    client_reference_id: clientReferenceId,
    success_url: successUrl,
    cancel_url: cancelUrl,
    // Stripe's own promotion-code UI. Coupons are managed in the Stripe dashboard rather
    // than mirrored into our database, so there is one source of truth for what a code is
    // worth and how often it may be used.
    allow_promotion_codes: true,
    subscription_data: {},
    // Survives retries: Stripe returns the original session instead of creating a second
    // one if the customer double-submits.
    idempotencyKey: `signup_${clientReferenceId}`,
  };
  if (trialDays > 0) params.subscription_data.trial_period_days = trialDays;

  // A code passed from our own form is applied directly; the Checkout page still lets the
  // customer enter one themselves.
  if (promoCode) {
    const promo = await findPromotionCode(promoCode);
    if (!promo) {
      const e = new Error('That promotion code is not valid.');
      e.statusCode = 400;
      throw e;
    }
    params.discounts = [{ promotion_code: promo.id }];
    delete params.allow_promotion_codes; // Stripe rejects both together
  }

  const { idempotencyKey, ...body } = params;
  return stripe().checkout.sessions.create(body, { idempotencyKey });
}

/** Look up an active promotion code by its customer-facing string. Null if unusable. */
async function findPromotionCode(code) {
  const list = await stripe().promotionCodes.list({ code: String(code).trim(), active: true, limit: 1 });
  return list.data[0] || null;
}

/**
 * What a promotion code is worth, for showing the customer before they pay.
 * Returns null rather than throwing so a bad code is a form message, not an error page.
 */
async function describePromotionCode(code) {
  const promo = await findPromotionCode(code);
  if (!promo) return null;
  const c = promo.coupon || {};
  return {
    code: promo.code,
    percentOff: c.percent_off || null,
    amountOff: c.amount_off != null ? c.amount_off / 100 : null,
    currency: c.currency || null,
    duration: c.duration || null,
    durationInMonths: c.duration_in_months || null,
  };
}

const retrieveCheckoutSession = (id) =>
  stripe().checkout.sessions.retrieve(id, { expand: ['subscription'] });

module.exports = {
  isConfigured, createSubscriptionCheckout, findPromotionCode,
  describePromotionCode, retrieveCheckoutSession,
};
