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

const retrieveCheckoutSession = (id) =>
  stripe().checkout.sessions.retrieve(id, { expand: ['subscription'] });

module.exports = {
  isConfigured, createSubscriptionCheckout, findPromotionCode,
  describePromotionCode, retrieveCheckoutSession, pushPlanToStripe, recurringFor,
  previewPlanChange, changeSubscriptionPlan,
};
