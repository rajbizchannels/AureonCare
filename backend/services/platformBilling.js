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

// Read at call time, not at module load. Freezing the value in a module-level const means
// that if this module is ever required before the environment is populated — dotenv running
// later, a bundler hoisting the import, a platform that injects variables after cold start —
// the process reports "not configured" for its whole life, no matter what the environment
// actually holds. Reading lazily costs one property lookup and removes that failure mode.
const secretKey = () =>
  (process.env.AC_STRIPE_SK || process.env.STRIPE_SECRET_KEY || '').trim() || null;

let client = null;
let clientKey = null;
function stripe() {
  const key = secretKey();
  if (!key) {
    const e = new Error('Platform billing is not configured (set AC_STRIPE_SK).');
    e.statusCode = 503;
    throw e;
  }
  // Rebuild if the key changed, so a rotated key takes effect without a restart.
  if (!client || clientKey !== key) {
    // No apiVersion pin. The SDK is built against a specific API version and shapes its
    // requests for it; pinning an OLDER version makes the library send parameters — and
    // call endpoints — that version does not know. invoices.createPreview, used by both
    // proration previews, only exists from 2025-03-31, so a 2024 pin made it 404 as an
    // unrecognised URL and surface as a 502.
    client = new Stripe(key);
    clientKey = key;
  }
  return client;
}

const isConfigured = () => Boolean(secretKey());

/**
 * What this PROCESS can see, for diagnosing "I set it in the dashboard but it says
 * unconfigured". Never returns key material — only whether each value is present, and which
 * Stripe mode the key is for, since a test key against live data (or the reverse) is the
 * other common cause of things silently not working.
 */
function configStatus() {
  const key = secretKey();
  const webhook = (process.env.AC_STRIPE_WHS || process.env.STRIPE_WEBHOOK_SECRET || '').trim();
  const mode = !key ? null : key.startsWith('sk_live') || key.startsWith('rk_live') ? 'live'
    : key.startsWith('sk_test') || key.startsWith('rk_test') ? 'test' : 'unrecognised';
  return {
    secretKeyPresent: Boolean(key),
    secretKeyVar: process.env.AC_STRIPE_SK ? 'AC_STRIPE_SK'
      : process.env.STRIPE_SECRET_KEY ? 'STRIPE_SECRET_KEY' : null,
    mode,
    // Length only — enough to spot a truncated paste without revealing the key.
    secretKeyLength: key ? key.length : 0,
    webhookSecretPresent: Boolean(webhook),
    webhookSecretLooksRight: webhook ? webhook.startsWith('whsec_') : false,
    frontendUrl: process.env.FRONTEND_URL || null,
    nodeEnv: process.env.NODE_ENV || null,
  };
}

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

/**
 * Map our billing_cycle wording onto a Stripe recurring interval.
 * Returns null for a cycle Stripe cannot express as a subscription.
 */
function recurringFor(billingCycle) {
  switch (String(billingCycle || 'monthly').toLowerCase()) {
    case 'monthly': return { interval: 'month' };
    case 'quarterly': return { interval: 'month', interval_count: 3 };
    case 'yearly':
    case 'annual':
    case 'annually': return { interval: 'year' };
    case 'weekly': return { interval: 'week' };
    default: return null;
  }
}

/**
 * Create (or update) the Stripe Product for a plan and attach a new Price to it.
 *
 * Stripe Prices are immutable — an amount cannot be edited — so every push creates a NEW
 * Price and, when asked, archives the one it replaces. The Product is reused across
 * pushes so a plan's price history stays under one product rather than scattering a
 * product per price change.
 *
 * @returns {Promise<{productId: string, priceId: string, archivedPriceId: string|null}>}
 */
async function pushPlanToStripe({
  name, description, amount, currency = 'usd', billingCycle,
  productId = null, previousPriceId = null, archivePrevious = true,
}) {
  const s = stripe();

  const recurring = recurringFor(billingCycle);
  if (!recurring) {
    const e = new Error(`Billing cycle "${billingCycle}" cannot be sold as a Stripe subscription.`);
    e.statusCode = 400;
    throw e;
  }
  const cents = Math.round(Number(amount) * 100);
  if (!Number.isFinite(cents) || cents < 0) {
    const e = new Error('Plan price must be a non-negative number to push to Stripe.');
    e.statusCode = 400;
    throw e;
  }
  // A zero-amount recurring price is legal in Stripe but would let anyone provision a
  // tenant for nothing through the public signup page. Refuse it explicitly.
  if (cents === 0) {
    const e = new Error('A plan priced at 0 cannot be sold self-serve. Set a price first.');
    e.statusCode = 400;
    throw e;
  }

  let product;
  if (productId) {
    // Keep the Stripe-side name/description in step with ours; harmless if unchanged.
    product = await s.products.update(productId, { name, description: description || undefined });
  } else {
    product = await s.products.create({ name, description: description || undefined });
  }

  const price = await s.prices.create({
    product: product.id,
    unit_amount: cents,
    currency: String(currency).toLowerCase(),
    recurring,
  });

  // Archiving is deliberate rather than deletion: Stripe will not delete a Price that
  // subscriptions reference, and existing subscribers must keep billing at the price they
  // agreed to. Archiving only stops it being offered to NEW customers.
  let archivedPriceId = null;
  if (archivePrevious && previousPriceId && previousPriceId !== price.id) {
    try {
      await s.prices.update(previousPriceId, { active: false });
      archivedPriceId = previousPriceId;
    } catch (err) {
      // Not fatal: the new price is live either way.
      console.warn('[platformBilling] could not archive previous price:', err.message);
    }
  }

  return { productId: product.id, priceId: price.id, archivedPriceId };
}


/**
 * Preview what changing a subscription to `newPriceId` costs right now.
 *
 * Stripe computes the proration itself — crediting the unused remainder of the current
 * period and charging the new plan pro rata — so this asks Stripe rather than reimplementing
 * that arithmetic, which is where a home-grown "prorata" calculation usually goes wrong
 * (mid-period upgrades, trials, existing credit balance, tax).
 *
 * @returns {Promise<{amountDue: number, currency: string, prorationDate: number, lines: Array}>}
 */
async function previewPlanChange({ subscriptionId, newPriceId }) {
  const s = stripe();
  const sub = await s.subscriptions.retrieve(subscriptionId);
  const itemId = sub.items.data[0] && sub.items.data[0].id;
  if (!itemId) {
    const e = new Error('That subscription has no billable item to change.');
    e.statusCode = 409;
    throw e;
  }
  const prorationDate = Math.floor(Date.now() / 1000);
  const preview = await s.invoices.createPreview({
    customer: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
    subscription: subscriptionId,
    subscription_details: {
      items: [{ id: itemId, price: newPriceId }],
      proration_behavior: 'create_prorations',
      proration_date: prorationDate,
    },
  });
  return {
    amountDue: (preview.amount_due || 0) / 100,
    currency: preview.currency,
    prorationDate,
    // Only the proration lines — the ones that explain the credit and the new charge.
    lines: (preview.lines?.data || [])
      .filter((l) => l.proration)
      .map((l) => ({ description: l.description, amount: (l.amount || 0) / 100 })),
  };
}

/**
 * Move a subscription onto a different price, prorated.
 *
 * `proration_behavior: 'create_prorations'` is what makes the change pro rata: Stripe
 * credits the unused part of the old plan and bills the new one for the remainder of the
 * period. The credit/charge lands on the next invoice rather than being taken immediately,
 * which is the conventional SaaS behaviour and avoids surprise card charges mid-period.
 */
async function changeSubscriptionPlan({ subscriptionId, newPriceId, prorationDate }) {
  const s = stripe();
  const sub = await s.subscriptions.retrieve(subscriptionId);
  const itemId = sub.items.data[0] && sub.items.data[0].id;
  if (!itemId) {
    const e = new Error('That subscription has no billable item to change.');
    e.statusCode = 409;
    throw e;
  }
  return s.subscriptions.update(subscriptionId, {
    items: [{ id: itemId, price: newPriceId }],
    proration_behavior: 'create_prorations',
    // Pin to the timestamp the customer was quoted, so the amount they confirmed is the
    // amount they are billed even if they sat on the confirmation for a while.
    ...(prorationDate ? { proration_date: prorationDate } : {}),
  });
}

/** A customer's invoices, newest first — the authoritative document list from Stripe. */
async function listInvoices(customerId, limit = 24) {
  const list = await stripe().invoices.list({ customer: customerId, limit });
  return list.data.map((i) => ({
    id: i.id,
    number: i.number,
    status: i.status,
    amountDue: (i.amount_due || 0) / 100,
    amountPaid: (i.amount_paid || 0) / 100,
    currency: i.currency,
    created: i.created,
    periodEnd: i.period_end,
    hostedInvoiceUrl: i.hosted_invoice_url,
    invoicePdf: i.invoice_pdf,
  }));
}


// ── Coupons ───────────────────────────────────────────────────────────────────
// Coupons live in Stripe, not mirrored here: one source of truth for what a code is worth
// and how many times it may be redeemed. A coupon is the discount; a promotion code is the
// customer-facing string that applies it. Creating both together is what makes a code
// usable at checkout.

/** Every promotion code with the coupon it applies, newest first. */
async function listCoupons(limit = 50) {
  const list = await stripe().promotionCodes.list({ limit, expand: ['data.coupon'] });
  return list.data.map((pc) => ({
    promotionCodeId: pc.id,
    code: pc.code,
    active: pc.active,
    timesRedeemed: pc.times_redeemed,
    maxRedemptions: pc.max_redemptions,
    expiresAt: pc.expires_at,
    couponId: pc.coupon?.id,
    percentOff: pc.coupon?.percent_off || null,
    amountOff: pc.coupon?.amount_off != null ? pc.coupon.amount_off / 100 : null,
    currency: pc.coupon?.currency || null,
    duration: pc.coupon?.duration,
    durationInMonths: pc.coupon?.duration_in_months || null,
    appliesToProducts: pc.coupon?.applies_to?.products || null,
  }));
}

/**
 * Create a coupon plus its promotion code.
 *
 * `productIds` restricts the discount to specific plans (Stripe's applies_to.products).
 * Without it a code discounts anything, which is rarely what "a coupon for the Pro plan"
 * is meant to mean.
 */
async function createCoupon({
  code, percentOff, amountOff, currency = 'usd', duration = 'once', durationInMonths,
  maxRedemptions, expiresAt, productIds = [], name,
}) {
  const s = stripe();
  if ((percentOff == null) === (amountOff == null)) {
    const e = new Error('Give exactly one of percentOff or amountOff.');
    e.statusCode = 400; throw e;
  }
  if (duration === 'repeating' && !(durationInMonths > 0)) {
    const e = new Error('A repeating coupon needs durationInMonths.');
    e.statusCode = 400; throw e;
  }

  const couponParams = { duration, name: name || code };
  if (percentOff != null) couponParams.percent_off = Number(percentOff);
  else {
    couponParams.amount_off = Math.round(Number(amountOff) * 100);
    couponParams.currency = String(currency).toLowerCase();
  }
  if (duration === 'repeating') couponParams.duration_in_months = Number(durationInMonths);
  if (productIds.length) couponParams.applies_to = { products: productIds };

  const coupon = await s.coupons.create(couponParams);

  const promoParams = { coupon: coupon.id, code: String(code).trim().toUpperCase() };
  if (maxRedemptions) promoParams.max_redemptions = Number(maxRedemptions);
  if (expiresAt) promoParams.expires_at = Math.floor(new Date(expiresAt).getTime() / 1000);
  const promo = await s.promotionCodes.create(promoParams);

  return { couponId: coupon.id, promotionCodeId: promo.id, code: promo.code };
}

/**
 * Stop a promotion code being redeemed.
 *
 * Deactivates the CODE, not the coupon: customers already on a discount keep it, which is
 * what you want when withdrawing an offer rather than clawing one back.
 */
async function deactivateCoupon(promotionCodeId) {
  return stripe().promotionCodes.update(promotionCodeId, { active: false });
}

/**
 * Give an existing subscription N free months.
 *
 * Implemented as a 100%-off coupon repeating for N months, applied to that subscription
 * only. The alternative — moving trial_end — silently voids the current period's invoice
 * and resets billing anchors on an already-paying customer; a discount leaves the billing
 * cycle intact and shows up on the invoice as a line the customer can see.
 */
async function grantFreeMonths({ subscriptionId, months, reason }) {
  const s = stripe();
  const n = Number(months);
  if (!Number.isInteger(n) || n < 1 || n > 36) {
    const e = new Error('Free months must be a whole number between 1 and 36.');
    e.statusCode = 400; throw e;
  }
  const coupon = await s.coupons.create({
    percent_off: 100,
    duration: n === 1 ? 'once' : 'repeating',
    ...(n === 1 ? {} : { duration_in_months: n }),
    name: `${n} free month${n === 1 ? '' : 's'}`,
    metadata: { reason: String(reason || '').slice(0, 500) },
  });
  await s.subscriptions.update(subscriptionId, { coupon: coupon.id });
  return { couponId: coupon.id, months: n };
}

const retrieveCheckoutSession = (id) =>
  stripe().checkout.sessions.retrieve(id, { expand: ['subscription'] });

module.exports = {
  isConfigured, createSubscriptionCheckout, findPromotionCode,
  describePromotionCode, retrieveCheckoutSession, pushPlanToStripe, recurringFor,
  previewPlanChange, changeSubscriptionPlan, listInvoices,
  listCoupons, createCoupon, deactivateCoupon, grantFreeMonths, configStatus,
};
