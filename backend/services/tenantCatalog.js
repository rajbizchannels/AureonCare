// SEC-05 Model D — Step S1: tenant control-plane read helpers.
//
// Thin, read-only accessors over the `control` schema (migration 063). Nothing here
// is wired into the request path yet — tenant resolution + search_path scoping arrive
// in S3. These exist so later steps (S3 middleware, S5 migration runner) share one
// source of truth for the tenant catalog and shipped config baseline.

/**
 * List all tenants in the control catalog.
 * @param {import('pg').Pool} pool
 * @param {{ status?: string }} [opts] optional status filter (e.g. 'active')
 */
async function listTenants(pool, opts = {}) {
  const params = [];
  let sql = 'SELECT * FROM control.tenants';
  if (opts.status) {
    params.push(opts.status);
    sql += ' WHERE status = $1';
  }
  sql += ' ORDER BY created_at ASC';
  const { rows } = await pool.query(sql, params);
  return rows;
}

/** Fetch the seeded default tenant (represents the pre-multi-tenant install). */
async function getDefaultTenant(pool) {
  const { rows } = await pool.query("SELECT * FROM control.tenants WHERE slug = 'default' LIMIT 1");
  return rows[0] || null;
}

/** Fetch a tenant by its id. */
async function getTenantById(pool, id) {
  const { rows } = await pool.query('SELECT * FROM control.tenants WHERE id = $1 LIMIT 1', [id]);
  return rows[0] || null;
}

/**
 * Read the shipped config baseline as a plain object { key: value }.
 * Per-tenant overrides (S6) layer on top of this at read time.
 */
async function getBaselineConfig(pool) {
  const { rows } = await pool.query('SELECT key, value FROM control.config_baseline');
  return rows.reduce((acc, r) => { acc[r.key] = r.value; return acc; }, {});
}

// ── Cached resolver: user → tenant (used by auth on every request) ────────────
// Small in-process cache keyed by user id (short TTL) so per-request tenant lookup
// is usually a cache hit. Defensive by contract: callers wrap this in try/catch so a
// missing control schema / practice_id column (migrations not yet applied) degrades
// to the default tenant instead of failing auth.
const _userTenantCache = new Map(); // userId -> { practiceId, tenantId, schemaName, ts }
const RESOLVE_TTL_MS = 60 * 1000;

/**
 * Resolve the tenant for a user id. Returns { practiceId, tenantId, schemaName } or
 * null if it cannot be determined. schemaName defaults to 'public' when a user has a
 * practice with no matching active tenant row.
 * @param {import('pg').Pool} pool
 * @param {string} userId
 */
async function resolveTenantForUser(pool, userId) {
  if (!userId) return null;
  const cached = _userTenantCache.get(userId);
  if (cached && Date.now() - cached.ts < RESOLVE_TTL_MS) return cached;

  const { rows } = await pool.query(
    `SELECT u.practice_id,
            t.id                         AS tenant_id,
            COALESCE(t.schema_name, 'public') AS schema_name
     FROM public.users u
     LEFT JOIN control.tenants t
       ON t.practice_id = u.practice_id AND t.status = 'active'
     WHERE u.id = $1`,
    [userId]
  );
  if (rows.length === 0) return null;
  const v = {
    practiceId: rows[0].practice_id || null,
    tenantId: rows[0].tenant_id || null,
    schemaName: rows[0].schema_name || 'public',
    ts: Date.now()
  };
  _userTenantCache.set(userId, v);
  return v;
}

/** Clear a user's cached tenant (call after changing their practice_id). */
function invalidateUserTenant(userId) { _userTenantCache.delete(userId); }

module.exports = {
  listTenants, getDefaultTenant, getTenantById, getBaselineConfig,
  resolveTenantForUser, invalidateUserTenant
};
