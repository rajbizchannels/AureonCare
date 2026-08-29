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
  return [await defaultTenant(pool)];
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
  registerIdentity, defaultTenant,
};
