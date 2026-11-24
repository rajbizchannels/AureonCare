// SEC-05 Model D — Step S11: tenant entitlement resolution.
//
// Resolves a tenant's effective plan + limits + billing status from the control plane
// (control.subscriptions joined to the public.subscription_plans catalog). Cached
// per practice for a short TTL. Defensive: if the control plane isn't present yet
// (migrations not applied), returns null and callers fail open.

const UNLIMITED = -1;
const _cache = new Map(); // practiceId -> { ent, ts }
const TTL_MS = 30 * 1000;

/**
 * @returns {Promise<null | {
 *   planName, maxUsers, maxPatients, maxProviders, seats, features,
 *   status, enforcementEnabled, currentPeriodEnd,
 *   isActive, isReadOnly, providerLimit
 * }>}
 */
/**
 * How many of something (providers, locations) a practice may have.
 * Tier plans (migration 108): the included number plus what was bought, never above the cap
 * (-1 = no cap). Older plans with no included number: the cap plus what was bought, as before.
 */
function tierLimit(included, cap, bought) {
  const extra = Number(bought) || 0;
  if (included == null) {
    if (cap == null || cap === UNLIMITED) return cap ?? null;
    return cap + extra;
  }
  const want = included + extra;
  return cap == null || cap === UNLIMITED ? want : Math.min(cap, want);
}

async function getTenantEntitlements(pool, practiceId) {
  if (!practiceId) return null;
  const c = _cache.get(practiceId);
  if (c && Date.now() - c.ts < TTL_MS) return c.ent;

  let rows;
  try {
    ({ rows } = await pool.query(
      `SELECT s.status, s.seats, s.enforcement_enabled, s.current_period_end, s.trial_end, s.stripe_subscription_id,
              sp.name AS plan_name, sp.max_users, sp.max_patients, sp.max_providers, sp.features,
              (to_jsonb(sp)->>'included_providers')::int AS included_providers,
              (to_jsonb(sp)->>'included_locations')::int AS included_locations,
              (to_jsonb(sp)->>'max_locations')::int AS max_locations,
              (to_jsonb(sp)->>'storage_gb')::int AS storage_gb,
              COALESCE((to_jsonb(s)->>'extra_locations')::int, 0) AS extra_locations
         FROM control.subscriptions s
         LEFT JOIN public.subscription_plans sp ON sp.id = s.plan_id
        WHERE s.practice_id = $1
        LIMIT 1`,
      [practiceId]
    ));
  } catch (_) {
    return null; // control plane absent -> fail open
  }
  if (rows.length === 0) return null;

  const r = rows[0];
  // A free trial not billed by Stripe ends on its own date: after it the workspace is
  // read-only (nothing is lost) until the practice subscribes. Stripe-billed trials are
  // ended by Stripe's own webhook instead.
  const trialOver = r.status === 'trialing' && !r.stripe_subscription_id && r.trial_end && new Date(r.trial_end) < new Date();
  const status = trialOver ? 'trial_expired' : (r.status || 'active');
  const providerLimit = tierLimit(r.included_providers, r.max_providers, r.seats);
  const locationLimit = r.included_locations == null ? null : tierLimit(r.included_locations, r.max_locations, r.extra_locations);
  const ent = {
    planName: r.plan_name || null,
    maxUsers: r.max_users ?? null,
    maxPatients: r.max_patients ?? null,
    maxProviders: r.max_providers ?? null,
    seats: r.seats || 0,
    features: r.features || {},
    status,
    enforcementEnabled: r.enforcement_enabled !== false,
    currentPeriodEnd: r.current_period_end || null,
    isActive: status === 'active' || status === 'trialing',
    isReadOnly: status === 'past_due' || status === 'canceled' || status === 'trial_expired',
    trialEnd: r.trial_end || null,
    providerLimit,
    includedProviders: r.included_providers ?? null,
    locationLimit,
    includedLocations: r.included_locations ?? null,
    maxLocations: r.max_locations ?? null,
    extraLocations: r.extra_locations || 0,
    storageGb: r.storage_gb ?? null,
  };
  _cache.set(practiceId, { ent, ts: Date.now() });
  return ent;
}

function invalidateEntitlements(practiceId) {
  if (practiceId) _cache.delete(practiceId); else _cache.clear();
}

module.exports = { getTenantEntitlements, invalidateEntitlements, tierLimit, UNLIMITED };
