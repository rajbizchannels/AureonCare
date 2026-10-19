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
async function getTenantEntitlements(pool, practiceId) {
  if (!practiceId) return null;
  const c = _cache.get(practiceId);
  if (c && Date.now() - c.ts < TTL_MS) return c.ent;

  let rows;
  try {
    ({ rows } = await pool.query(
      `SELECT s.status, s.seats, s.enforcement_enabled, s.current_period_end,
              sp.name AS plan_name, sp.max_users, sp.max_patients, sp.max_providers, sp.features
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
  const status = r.status || 'active';
  const providerLimit = (r.max_providers === UNLIMITED || r.max_providers == null)
    ? (r.max_providers ?? null)
    : r.max_providers + (r.seats || 0);
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
    isReadOnly: status === 'past_due' || status === 'canceled',
    providerLimit,
  };
  _cache.set(practiceId, { ent, ts: Date.now() });
  return ent;
}

function invalidateEntitlements(practiceId) {
  if (practiceId) _cache.delete(practiceId); else _cache.clear();
}

module.exports = { getTenantEntitlements, invalidateEntitlements, UNLIMITED };
