// Site (location) helpers.
//
// `location_id` is nullable on appointments and inventory_stock_movements by design:
// tenant/005 does not backfill those tables because they grow without bound and tenant
// migrations run in a single transaction. So NULL means "the tenant's primary site", and
// every read that needs a concrete site resolves it through here rather than each caller
// inventing its own fallback.

const LOCATION_TYPES = ['clinic', 'camp', 'mobile', 'partner'];

/** The tenant's primary site id, or null when the tenant has no primary row. */
async function primaryLocationId(db) {
  const { rows } = await db.query(
    'SELECT id FROM locations WHERE is_primary AND is_active LIMIT 1'
  );
  return rows.length ? rows[0].id : null;
}

/** The tenant's primary site row, or null. */
async function primaryLocation(db) {
  const { rows } = await db.query(
    'SELECT * FROM locations WHERE is_primary AND is_active LIMIT 1'
  );
  return rows.length ? rows[0] : null;
}

/**
 * Resolve an explicit site id, falling back to the primary site when it is null or
 * undefined. Use on write paths that accept an optional site.
 */
async function resolveLocationId(db, locationId) {
  if (locationId) return locationId;
  return primaryLocationId(db);
}

/**
 * Validate a site id belongs to this tenant and is usable. Returns the row, or throws an
 * Error carrying `status` and `code` so routes can surface the specific reason — a bare
 * "invalid location" costs a round trip to diagnose.
 */
async function assertUsableLocation(db, locationId) {
  const { rows } = await db.query('SELECT * FROM locations WHERE id = $1', [locationId]);
  if (!rows.length) {
    const err = new Error('Location not found in this practice');
    err.status = 404; err.code = 'LocationNotFound';
    throw err;
  }
  if (!rows[0].is_active) {
    const err = new Error(`Location "${rows[0].name}" is deactivated`);
    err.status = 409; err.code = 'LocationInactive';
    throw err;
  }
  return rows[0];
}

module.exports = {
  LOCATION_TYPES,
  primaryLocationId,
  primaryLocation,
  resolveLocationId,
  assertUsableLocation,
};
