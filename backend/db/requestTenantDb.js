// SEC-05 Model D — route sweep: per-request tenant-scoped DB (req.db).
//
// Gives each request a `.query(text, params)` interface that runs against the caller's
// tenant schema. Implemented as a single pooled client checked out lazily on first use,
// with search_path pinned to the tenant schema, and released when the response ends.
// node-pg queues queries on a client, so Promise.all of req.db.query(...) is safe
// (serialized on the one connection).
//
// Because the default tenant's schema is 'public'/'tenant_default' and the database
// default search_path already points there, req.db is behaviourally identical to the
// old shared pool for the single existing tenant — the sweep is behaviour-preserving
// now and becomes the isolation boundary once multiple tenants exist.

const SAFE_SCHEMA = /^[a-z_][a-z0-9_]*$/;

/**
 * @param {import('pg').Pool} pool
 * @param {string} schemaName  tenant schema (e.g. 'tenant_default')
 * @param {import('http').ServerResponse} [res]  response, for lifecycle-based release
 */
function makeTenantDb(pool, schemaName, res) {
  if (!SAFE_SCHEMA.test(String(schemaName || ''))) {
    throw new Error(`Unsafe tenant schema name: ${JSON.stringify(schemaName)}`);
  }
  let clientPromise = null;
  let client = null;
  let released = false;

  const release = () => {
    if (released) return;
    released = true;
    if (client) {
      const c = client; client = null;
      Promise.resolve()
        .then(() => c.query('RESET search_path'))
        .catch(() => {})
        .finally(() => { try { c.release(); } catch (_) { /* ignore */ } });
    }
  };

  const ensure = () => {
    if (!clientPromise) {
      clientPromise = (async () => {
        const c = await pool.connect();
        try {
          await c.query(`SET search_path TO ${schemaName}, public, control`);
        } catch (e) {
          try { c.release(); } catch (_) { /* ignore */ }
          throw e;
        }
        client = c;
        // If the response already finished before the client was ready, release now.
        if (released) { try { c.release(); } catch (_) {} client = null; }
        return c;
      })();
      if (res && typeof res.on === 'function') {
        res.on('finish', release);
        res.on('close', release);
      }
    }
    return clientPromise;
  };

  return {
    schemaName,
    query: async (text, params) => (await ensure()).query(text, params),
    // For transaction blocks (BEGIN/COMMIT): reuse the request's client; do NOT release
    // it yourself — it is released when the response ends.
    getClient: ensure,
    release,
  };
}

module.exports = { makeTenantDb };
