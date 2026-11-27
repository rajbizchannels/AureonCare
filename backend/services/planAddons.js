/**
 * Extra providers and extra locations for a practice (tier billing, migration 108).
 *
 *   usage(pool, db, practiceId) → { plan, providers, locations, storage, billedByStripe }
 *     each of providers / locations: { included, extra, limit, max, used, price, canBuy }
 *   setAddons(pool, db, practiceId, { extraProviders?, extraLocations? }) → usage after the change
 *     Validates against the tier (no extras on Essentials; never above the cap; never below what is
 *     in use), then — for a practice Stripe bills — sets the add-on quantities on its subscription
 *     (prorated on the next invoice) BEFORE recording them, so an entitlement never moves without
 *     the money. Practices not billed by Stripe (trials, invoiced manually) are recorded only;
 *     a trial's extras are added to the Stripe Checkout when it subscribes.
 *   syncFromStripe(pool, subscription) — the webhook: quantities changed in Stripe are recorded.
 */
const billing = require('./platformBilling');
const { invalidateEntitlements, tierLimit } = require('./entitlements');

class AddonError extends Error { constructor(status, message) { super(message); this.status = status; } }

const UNLIMITED = -1;

async function load(pool, practiceId) {
  const { rows: [r] } = await pool.query(
    `SELECT s.tenant_id, s.status, s.seats, COALESCE((to_jsonb(s)->>'extra_locations')::int, 0) AS extra_locations,
            s.stripe_subscription_id, p.*
       FROM control.subscriptions s LEFT JOIN public.subscription_plans p ON p.id = s.plan_id
      WHERE s.practice_id = $1`, [practiceId]);
  if (!r) throw new AddonError(409, 'This practice has no subscription record. Contact support.');
  return r;
}

async function providersInUse(pool, practiceId) {
  const { rows: [{ n }] } = await pool.query(
    `SELECT count(*)::int AS n FROM public.memberships m JOIN public.users u ON u.id = m.user_id
      WHERE m.practice_id = $1 AND m.role = 'doctor' AND m.status = 'active' AND u.status = 'active'`, [practiceId]);
  return n;
}
async function locationsInUse(db) {
  try { return (await db.query('SELECT count(*)::int AS n FROM locations WHERE is_active IS NOT FALSE')).rows[0].n; } catch { return 0; }
}

/**
 * Files AureonCare hosts for the practice, in bytes: its message attachments and public-profile
 * photos. Documents and records go to the practice's own cloud storage
 * (bring-your-own-key) and do not count; platform backups are not per practice.
 */
async function storageUsed(pool, db, practiceId) {
  let total = 0;
  try {
    total += Number((await db.query(
      // The practice's own message attachments (its schema, migration 111).
      'SELECT COALESCE(sum(size_bytes), 0)::bigint AS b FROM message_attachments')).rows[0].b) || 0;
  } catch { /* messaging not set up */ }
  try {
    total += Number((await pool.query('SELECT COALESCE(sum(octet_length(bytes)), 0)::bigint AS b FROM public.practice_profile_photos WHERE practice_id = $1', [practiceId])).rows[0].b) || 0;
  } catch { /* profiles not set up */ }
  return total;
}

function describe(included, extra, cap, used, price) {
  const limit = included == null ? null : tierLimit(included, cap, extra);
  return {
    included, extra: extra || 0, limit, max: cap == null ? null : cap, used,
    price: price == null ? null : Number(price),
    canBuy: included != null && price != null && Number(price) > 0 && (cap === UNLIMITED || cap == null || limit < cap),
  };
}

async function usage(pool, db, practiceId) {
  const r = await load(pool, practiceId);
  const pUsed = await providersInUse(pool, practiceId);
  const lUsed = await locationsInUse(db);
  const bytes = await storageUsed(pool, db, practiceId);
  return {
    plan: { id: r.id, name: r.name, displayName: r.display_name, currency: r.currency, billingCycle: r.billing_cycle },
    providers: describe(r.included_providers ?? null, r.seats, r.max_providers, pUsed, r.extra_provider_price),
    locations: describe(r.included_locations ?? null, r.extra_locations, r.max_locations, lUsed, r.extra_location_price),
    storage: { usedBytes: bytes, limitGb: r.storage_gb ?? null },
    billedByStripe: Boolean(r.stripe_subscription_id) && r.status !== 'canceled',
  };
}

async function setAddons(pool, db, practiceId, { extraProviders, extraLocations }) {
  const r = await load(pool, practiceId);
  const now = await usage(pool, db, practiceId);
  const want = {
    provider: extraProviders === undefined ? r.seats || 0 : Number(extraProviders),
    location: extraLocations === undefined ? r.extra_locations || 0 : Number(extraLocations),
  };
  for (const [kind, n] of Object.entries(want)) {
    if (!Number.isInteger(n) || n < 0 || n > 500) throw new AddonError(400, `Extra ${kind}s must be a whole number from 0.`);
  }
  const check = (kind, info, n) => {
    if (n === info.extra) return;
    if (info.included == null) throw new AddonError(409, `This plan does not sell extra ${kind}s. Contact support.`);
    if (n > info.extra && !(info.price > 0)) throw new AddonError(409, `Your plan does not offer extra ${kind}s — move to a larger plan.`);
    const limit = tierLimit(info.included, info.max, n);
    if (info.max != null && info.max !== UNLIMITED && info.included + n > info.max) {
      throw new AddonError(409, `Your plan allows up to ${info.max} ${kind}s in total (${info.included} included + ${info.max - info.included} extra). Move to a larger plan for more.`);
    }
    if (limit < info.used) throw new AddonError(409, `You have ${info.used} active ${kind}s; deactivate some before reducing to ${limit}.`);
  };
  check('provider', now.providers, want.provider);
  check('location', now.locations, want.location);

  // Money first: for a practice Stripe bills, set the quantities on the subscription before the
  // entitlement changes. If Stripe refuses, nothing is recorded.
  if (now.billedByStripe && billing.isConfigured()) {
    await billing.setSubscriptionAddons({ subscriptionId: r.stripe_subscription_id, addons: {
      provider: { priceId: r.stripe_provider_price_id || null, quantity: want.provider },
      location: { priceId: r.stripe_location_price_id || null, quantity: want.location },
    } });
  }
  await pool.query(
    `UPDATE control.subscriptions SET seats = $2, extra_locations = $3, updated_at = now() WHERE practice_id = $1`,
    [practiceId, want.provider, want.location]);
  invalidateEntitlements(practiceId);
  return usage(pool, db, practiceId);
}

/** Stripe → our record: the add-on quantities on a subscription Stripe reports (webhook). */
async function syncFromStripe(pool, subscription) {
  if (!subscription || !subscription.id || !subscription.items) return;
  const q = billing.addonQuantities(subscription);
  const { rows } = await pool.query(
    `UPDATE control.subscriptions SET seats = $2, extra_locations = $3, updated_at = now()
      WHERE stripe_subscription_id = $1 AND (seats IS DISTINCT FROM $2 OR extra_locations IS DISTINCT FROM $3)
      RETURNING practice_id`, [subscription.id, q.provider, q.location]);
  for (const r of rows) invalidateEntitlements(r.practice_id);
}

/**
 * Room for `addBytes` more hosted files? → null when it fits (or the plan has no storage limit),
 * else the message to show. Fails open: a failed check never blocks an upload.
 */
async function storageRoom(pool, db, practiceId, addBytes) {
  try {
    const ent = await require('./entitlements').getTenantEntitlements(pool, practiceId);
    if (!ent || !ent.enforcementEnabled || ent.storageGb == null || ent.storageGb === UNLIMITED) return null;
    const limit = ent.storageGb * 1024 ** 3;
    const used = await storageUsed(pool, db, practiceId);
    if (used + (Number(addBytes) || 0) <= limit) return null;
    return `Your plan includes ${ent.storageGb} GB of file storage and ${(used / 1024 ** 3).toFixed(2)} GB is used. Remove old attachments or move to a larger plan.`;
  } catch (e) {
    console.error('[planAddons] storage check failed:', e.message);
    return null;
  }
}

module.exports = { usage, setAddons, syncFromStripe, storageUsed, storageRoom, AddonError };
