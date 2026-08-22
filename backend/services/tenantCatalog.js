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

module.exports = { listTenants, getDefaultTenant, getTenantById, getBaselineConfig };
