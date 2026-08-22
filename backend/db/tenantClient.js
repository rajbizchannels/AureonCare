// SEC-05 Model D — Step S3: per-request tenant-scoped DB access.
//
// In schema-per-tenant, a request's queries must run with search_path pointing at
// that tenant's schema. node-pg's pool hands out a fresh connection per query, so
// scoping is done by checking out ONE client, setting its search_path, running the
// request's queries on it, then resetting + releasing.
//
// Routes adopt these helpers during the later query sweep. Until then, the default
// tenant's schema_name is 'public', so withTenant(pool, 'public', …) is behaviourally
// identical to today's pool.query — S3 changes no existing behaviour.

// Schema names come from the control catalog (our own data), but validate anyway —
// search_path cannot be parameterised, so the identifier is interpolated.
const SAFE_SCHEMA = /^[a-z_][a-z0-9_]*$/;

function assertSchema(schemaName) {
  if (typeof schemaName !== 'string' || !SAFE_SCHEMA.test(schemaName)) {
    throw new Error(`Unsafe tenant schema name: ${JSON.stringify(schemaName)}`);
  }
  return schemaName;
}

/**
 * Check out a client, point search_path at the tenant schema (falling back to public
 * and including control for shared lookups), run fn(client), then reset + release.
 * @param {import('pg').Pool} pool
 * @param {string} schemaName tenant schema (e.g. 'public' or 'tenant_<uuid>')
 * @param {(client: import('pg').PoolClient) => Promise<any>} fn
 */
async function withTenant(pool, schemaName, fn) {
  assertSchema(schemaName);
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO ${schemaName}, public, control`);
    return await fn(client);
  } finally {
    // Reset before returning to the pool so a leaked connection can't carry a tenant's
    // search_path into another request.
    try { await client.query('SET search_path TO public, control'); } catch (_) { /* ignore */ }
    client.release();
  }
}

/** Convenience: run a single scoped query and return the pg result. */
async function tenantQuery(pool, schemaName, text, params) {
  return withTenant(pool, schemaName, (client) => client.query(text, params));
}

module.exports = { withTenant, tenantQuery, assertSchema };
