/**
 * Plan prices: the PLATFORM catalogue (public.subscription_plans) is the source of truth.
 *
 *   platform ──push──▶ Stripe      pushPlanPrice(): mints a Stripe Price for the plan's current
 *                                  amount/currency/cycle and archives the old one (Stripe prices
 *                                  are immutable). Runs automatically when an operator changes a
 *                                  linked plan's price, and from "Create in Stripe".
 *   platform ──push──▶ practices   every practice reads the catalogue (Subscription page, signup,
 *                                  entitlements), so a price change shows at once; practices billed
 *                                  by Stripe are moved to the new price at their next renewal by
 *                                  applyPriceToSubscribers() — nobody is charged mid-period.
 *
 * Nothing is ever read back from Stripe into the catalogue.
 */
const billing = require('./platformBilling');

/** Push the plan's catalogue price to Stripe. → updated plan row + archivedPriceId */
async function pushPlanPrice(pool, planId) {
  const { rows: [plan] } = await pool.query('SELECT * FROM public.subscription_plans WHERE id = $1', [planId]);
  if (!plan) { const e = new Error('Plan not found'); e.statusCode = 404; throw e; }
  const result = await billing.pushPlanToStripe({
    name: plan.display_name || plan.name,
    description: plan.description,
    amount: plan.price,
    currency: plan.currency || 'eur',
    billingCycle: plan.billing_cycle,
    productId: plan.stripe_product_id,
    previousPriceId: plan.stripe_price_id,
  });
  const { rows: [updated] } = await pool.query(
    `UPDATE public.subscription_plans
        SET stripe_product_id = $2, stripe_price_id = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 RETURNING *`, [plan.id, result.productId, result.priceId]);
  return { plan: updated, archivedPriceId: result.archivedPriceId };
}

/**
 * Move every practice billed by Stripe on this plan to the plan's current Stripe price, from
 * its next renewal. → { checked, moved, unchanged, skipped, errors: [{ practiceId, error }] }
 */
async function applyPriceToSubscribers(pool, planId) {
  const { rows: [plan] } = await pool.query('SELECT id, stripe_price_id FROM public.subscription_plans WHERE id = $1', [planId]);
  if (!plan) { const e = new Error('Plan not found'); e.statusCode = 404; throw e; }
  if (!plan.stripe_price_id) { const e = new Error('This plan has no Stripe price yet. Use "Create in Stripe" first.'); e.statusCode = 400; throw e; }
  const { rows: subs } = await pool.query(
    `SELECT practice_id, stripe_subscription_id FROM control.subscriptions
      WHERE plan_id = $1 AND stripe_subscription_id IS NOT NULL AND status <> 'canceled'`, [planId]);
  const out = { checked: subs.length, moved: 0, unchanged: 0, skipped: 0, errors: [] };
  for (const s of subs) {
    try {
      const r = await billing.movePriceAtRenewal({ subscriptionId: s.stripe_subscription_id, newPriceId: plan.stripe_price_id });
      if (r.changed) out.moved += 1; else if (r.skipped) out.skipped += 1; else out.unchanged += 1;
    } catch (e) {
      out.errors.push({ practiceId: s.practice_id, error: e.message });
    }
  }
  return out;
}

/** Practices read entitlements through a short cache; drop it so catalogue changes show at once. */
function refreshPractices() {
  try { require('./entitlements').invalidateEntitlements(); } catch { /* best effort */ }
}

module.exports = { pushPlanPrice, applyPriceToSubscribers, refreshPractices };
