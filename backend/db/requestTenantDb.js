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

  // Transaction-control statements the caller issues itself, which must not be wrapped.
  const TX_STMT = /^\s*(BEGIN|START\s+TRANSACTION|COMMIT|END|ROLLBACK)\b/i;
  const TX_OPEN = /^\s*(BEGIN|START\s+TRANSACTION)\b/i;
  const setLocalPath = `SET LOCAL search_path TO ${schemaName}, public, control`;
  let inTx = false;

  return {
    schemaName,
    /**
     * Run a statement against the caller's tenant schema.
     *
     * The search_path is pinned INSIDE a transaction for every statement, not once on the
     * connection. That looks redundant against a direct connection, and it is — but this
     * app is deployed against Supabase's transaction pooler (see db.js), where a session
     * SET does not survive to the next statement: the pooler hands each statement to
     * whichever backend is free, so `SET search_path` lands on one connection and the query
     * that depends on it runs on another. Every tenant table then resolves against the
     * default path and fails with 42P01 — intermittently, because sometimes the same
     * backend is reused, which is what made this look like missing tables.
     *
     * A transaction is the unit the pooler will not split, so the pin and the statement are
     * guaranteed to reach the same backend. The cost is two extra round trips per query;
     * pointing AC_PG_URI at the session pooler or the direct connection would remove the
     * need, but correctness must not depend on which connection string is configured.
     */
    query: async (text, params) => {
      const c = await ensure();
      const sql = String(text);

      // Caller-managed transaction: pin once, just after their BEGIN, and stay out of the
      // way until they close it.
      if (TX_STMT.test(sql)) {
        const result = await c.query(sql, params);
        if (TX_OPEN.test(sql)) {
          inTx = true;
          await c.query(setLocalPath);
        } else {
          inTx = false;
        }
        return result;
      }
      if (inTx) return c.query(sql, params);

      await c.query('BEGIN');
      try {
        await c.query(setLocalPath);
        const result = await c.query(sql, params);
        await c.query('COMMIT');
        return result;
      } catch (err) {
        await c.query('ROLLBACK').catch(() => {});
        throw err;
      }
    },
    // For transaction blocks (BEGIN/COMMIT): reuse the request's client; do NOT release
    // it yourself — it is released when the response ends.
    getClient: ensure,
    release,
  };
}

module.exports = { makeTenantDb };
