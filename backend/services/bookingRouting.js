// SEC-30: which practice a public booking link belongs to.
//
// Reads and writes control.booking_slug_route only through the SECURITY DEFINER functions
// from migration 089, so the least-privilege app role needs no rights on control.*.

const SLUG = /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/;

const isValidSlug = (slug) => typeof slug === 'string' && SLUG.test(slug);

/** @returns {Promise<{tenantId, schemaName, providerId}|null>} only for an active practice */
async function resolveBookingSlug(pool, slug) {
  if (!isValidSlug(slug)) return null;
  const { rows } = await pool.query(
    'SELECT tenant_id, schema_name, provider_id FROM control.resolve_booking_slug($1)', [slug]);
  if (!rows[0]) return null;
  return { tenantId: rows[0].tenant_id, schemaName: rows[0].schema_name, providerId: String(rows[0].provider_id) };
}

/** @returns {Promise<boolean>} false when another practice already owns the slug */
async function registerBookingSlug(pool, slug, tenantId, providerId) {
  const { rows } = await pool.query(
    'SELECT control.register_booking_slug($1, $2, $3) AS ok', [slug, tenantId, providerId]);
  return Boolean(rows[0] && rows[0].ok);
}

async function forgetBookingSlug(pool, slug, tenantId) {
  await pool.query('SELECT control.forget_booking_slug($1, $2)', [slug, tenantId]);
}

/**
 * The calling tenant's id. req.tenant normally carries it; when the tenant was resolved
 * without one, look it up by schema (schema_name is unique in control.tenants).
 */
async function tenantIdFor(pool, req) {
  if (req.tenant && req.tenant.tenantId) return req.tenant.tenantId;
  const schema = req.tenant && req.tenant.schemaName;
  if (!schema) return null;
  const { rows } = await pool.query('SELECT id FROM control.tenants WHERE schema_name = $1', [schema]);
  return rows[0] ? rows[0].id : null;
}

module.exports = { isValidSlug, resolveBookingSlug, registerBookingSlug, forgetBookingSlug, tenantIdFor };
