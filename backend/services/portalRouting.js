// SEC-05 Model D — portal tenant routing (Option D, hardened).
//
// Resolves "which tenant schema?" for portal requests, whose two entry points (login by
// email, session validation by token) both happen before any tenant is known.
//
// All access to the shared routing tables goes through the SECURITY DEFINER functions
// from migration 074 — the app role holds no table privileges on them, so these tables
// cannot be enumerated or dumped through the application.
//
// Every function degrades to the DEFAULT tenant when routing is unavailable (pepper not
// configured, migration not applied, or a legacy row with no route). That keeps a
// single-tenant install working unchanged while multi-tenant installs route correctly.

const { emailHmac, isConfigured, KEY_VERSION } = require('../utils/blindIndex');

/** Schema name for a tenant id. */
async function schemaForTenant(pool, tenantId) {
  if (!tenantId) return null;
  const { rows } = await pool.query('SELECT schema_name FROM control.tenants WHERE id = $1', [tenantId]);
  return rows[0]?.schema_name || null;
}

/** The default tenant's { tenantId, schemaName } — the fallback for un-routed requests. */
async function defaultTenant(pool) {
  try {
    const { rows } = await pool.query(
      "SELECT id, schema_name FROM control.tenants WHERE slug = 'default' LIMIT 1"
    );
    if (rows.length === 0) return { tenantId: null, schemaName: 'public' };
    return { tenantId: rows[0].id, schemaName: rows[0].schema_name || 'public' };
  } catch (_) {
    return { tenantId: null, schemaName: 'public' };
  }
}

/**
 * Tenant for a portal session token hash. Falls back to the default tenant for sessions
 * created before routing existed.
 * @returns {Promise<{tenantId: string|null, schemaName: string}>}
 */
async function tenantForSession(pool, tokenHash) {
  try {
    const { rows } = await pool.query('SELECT control.resolve_portal_session($1) AS tenant_id', [tokenHash]);
    const tenantId = rows[0]?.tenant_id;
    if (tenantId) {
      const schemaName = await schemaForTenant(pool, tenantId);
      if (schemaName) return { tenantId, schemaName };
    }
  } catch (err) {
    console.warn('[portalRouting] session route unavailable, using default tenant:', err.message);
  }
  return defaultTenant(pool);
}

/**
 * Candidate tenants for a login email, narrowed via the blind index. Credentials MUST
 * still be verified inside each candidate — this only decides where to look.
 * @returns {Promise<Array<{tenantId: string|null, schemaName: string}>>}
 */
async function candidateTenantsForEmail(pool, email) {
  if (isConfigured()) {
    try {
      const { rows } = await pool.query(
        'SELECT tenant_id FROM control.resolve_portal_tenants($1)', [emailHmac(email)]
      );
      if (rows.length > 0) {
        const out = [];
        for (const r of rows) {
          const schemaName = await schemaForTenant(pool, r.tenant_id);
          if (schemaName) out.push({ tenantId: r.tenant_id, schemaName });
        }
        if (out.length > 0) return out;
      }
    } catch (err) {
      console.warn('[portalRouting] identity route unavailable, using default tenant:', err.message);
    }
  }
  // No identity route yet (accounts from before routing, or never signed in to the portal):
  // the practices on the person's own account — users.practice_id and their memberships —
  // plus the default practice. Precise, and never a search of every practice. A successful
  // sign-in registers the route, so this is a one-time path per person.
  const out = [];
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT t.id AS tenant_id, t.schema_name
         FROM public.users u
         LEFT JOIN public.memberships m ON m.user_id = u.id AND m.status = 'active'
         JOIN control.tenants t ON t.practice_id IN (u.practice_id, m.practice_id) AND t.status = 'active'
        WHERE LOWER(u.email) = LOWER($1)`, [String(email || '').trim()]);
    for (const r of rows) out.push({ tenantId: r.tenant_id, schemaName: r.schema_name });
  } catch (err) {
    if (err.code === '42P01') {
      // before memberships (093): users.practice_id only
      try {
        const { rows } = await pool.query(
          `SELECT t.id AS tenant_id, t.schema_name FROM public.users u
             JOIN control.tenants t ON t.practice_id = u.practice_id AND t.status = 'active'
            WHERE LOWER(u.email) = LOWER($1)`, [String(email || '').trim()]);
        for (const r of rows) out.push({ tenantId: r.tenant_id, schemaName: r.schema_name });
      } catch (_) { /* default only */ }
    } else {
      console.warn('[portalRouting] account practice lookup failed:', err.message);
    }
  }
  const def = await defaultTenant(pool);
  if (def && !out.some((c) => c.schemaName === def.schemaName) && !(def.schemaName === 'public' && out.length)) out.push(def);
  return out;
}

/**
 * Every active tenant, cheapest-first for a bounded search. Used only as a last resort by
 * the social portal login, which has a user id but no email route to narrow with.
 * @returns {Promise<Array<{tenantId: string, schemaName: string}>>}
 */
async function allActiveTenants(pool, limit = 100) {
  try {
    // `limit = null` means every active tenant. The default cap is a sensible guard for
    // callers that just want a sample, but it is NOT safe for a search that has to find a
    // specific person: ordered oldest-first, a cap silently excludes the newest practices,
    // and a patient at the 101st could not sign in socially at all.
    const { rows } = await pool.query(
      limit == null
        ? `SELECT id, schema_name FROM control.tenants
            WHERE status = 'active' AND schema_name IS NOT NULL
            ORDER BY created_at ASC`
        : `SELECT id, schema_name FROM control.tenants
            WHERE status = 'active' AND schema_name IS NOT NULL
            ORDER BY created_at ASC LIMIT $1`,
      limit == null ? [] : [limit]
    );
    return rows.map((r) => ({ tenantId: r.id, schemaName: r.schema_name }));
  } catch (err) {
    console.warn('[portalRouting] tenant enumeration failed:', err.message);
    return [];
  }
}

/**
 * Search order for a portal login that knows the patient's id but cannot narrow by email:
 * the blind-index candidates first (one query, usually exactly right), then the default
 * tenant, then every other active tenant. Deduplicated, so a hit is never checked twice.
 */
/**
 * The tenant a given user belongs to, looked up directly.
 *
 * WHY THIS EXISTS. The social portal login used to find a patient's tenant by PROBING
 * tenants in turn, and the final fallback in that order — allActiveTenants — is capped at
 * 100, oldest first. On a deployment with more than a hundred practices, a patient at the
 * 101st could not sign in socially at all: every probe missed, and the handler then read a
 * field off the undefined patient and answered 500. Silent, and ordered by the age of the
 * practice, so it would have looked like "social login is broken for some clinics".
 *
 * `users` is an identity-plane table in `public` carrying practice_id, and control.tenants
 * is keyed by the same practice, so the answer is one join away. No enumeration, no cap,
 * and it does not care how many practices exist.
 */
async function tenantForUser(pool, userId) {
  if (!userId) return null;
  try {
    const { rows } = await pool.query(
      `SELECT t.id, t.schema_name
         FROM public.users u
         JOIN control.tenants t ON t.practice_id = u.practice_id
        WHERE u.id = $1 AND t.status = 'active' AND t.schema_name IS NOT NULL
        LIMIT 1`, [userId]);
    return rows[0] ? { tenantId: rows[0].id, schemaName: rows[0].schema_name } : null;
  } catch (err) {
    console.warn('[portalRouting] could not resolve tenant for user:', err.message);
    return null;
  }
}

async function searchOrderForPatient(pool, email, userId = null) {
  const seen = new Set();
  const out = [];
  const add = (t) => {
    if (t && t.tenantId && !seen.has(t.tenantId)) { seen.add(t.tenantId); out.push(t); }
  };
  // The exact answer first, when the caller knows whose session this is. Everything
  // below is a search, and the last step of that search is capped.
  if (userId) add(await tenantForUser(pool, userId));
  if (email) (await candidateTenantsForEmail(pool, email)).forEach(add);
  add(await defaultTenant(pool));
  // EVERY active tenant, not the oldest hundred. This is the step that has to be
  // exhaustive: the paths above are hints, and when they all miss — a patient whose user
  // row carries no practice_id, or whose portal identity has not been registered yet,
  // which is every patient's FIRST social login — this is the only thing standing between
  // them and a refused sign-in. Each probe is a primary-key lookup and the loop stops at
  // the first hit, so the cost is paid only by logins the hints could not place.
  (await allActiveTenants(pool, null)).forEach(add);
  return out;
}

/** Record where a session lives, so the next request can route without touching PHI. */
async function registerSession(pool, tokenHash, tenantId, expiresAt) {
  if (!tenantId) return;
  try {
    await pool.query('SELECT control.register_portal_session($1, $2, $3)', [tokenHash, tenantId, expiresAt]);
  } catch (err) {
    console.warn('[portalRouting] could not register session route:', err.message);
  }
}

/** Drop a session route (logout / expiry). */
async function forgetSession(pool, tokenHash) {
  try {
    await pool.query('SELECT control.forget_portal_session($1)', [tokenHash]);
  } catch (err) {
    console.warn('[portalRouting] could not remove session route:', err.message);
  }
}

/** Record that this email can sign in at this tenant (called when a portal is enabled). */
async function registerIdentity(pool, email, tenantId) {
  if (!tenantId || !isConfigured() || !email) return;
  try {
    await pool.query('SELECT control.register_portal_identity($1, $2, $3)', [emailHmac(email), tenantId, KEY_VERSION]);
  } catch (err) {
    console.warn('[portalRouting] could not register identity route:', err.message);
  }
}

module.exports = {
  tenantForSession, candidateTenantsForEmail, registerSession, forgetSession,
  registerIdentity, defaultTenant, allActiveTenants, searchOrderForPatient, tenantForUser,
};
