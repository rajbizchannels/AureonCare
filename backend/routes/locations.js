// Sites (locations) — CRUD for the physical places a tenant operates from.
//
// Reads are open to any authenticated user: scheduling, inventory and (later) camps all
// need the site list. Mutations are admin-only, matching routes/appointment-types.js.

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { enforceActiveBilling } = require('../middleware/planEnforcement');
const { LOCATION_TYPES } = require('../utils/locations');

router.use(authenticate);
router.use(enforceActiveBilling); // SEC-05 S11: read-only when subscription past_due/canceled

const toCamelCase = (obj) => {
  const out = {};
  for (const key in obj) out[key.replace(/_([a-z])/g, (g) => g[1].toUpperCase())] = obj[key];
  return out;
};

// Tables that carry location_id. Used to explain a refused delete in terms the caller can
// act on, instead of a bare "location is in use".
const REFERENCING_TABLES = [
  { table: 'appointments', label: 'appointments' },
  { table: 'inventory_stock_movements', label: 'stock movements' },
  { table: 'doctor_availability', label: 'provider availability entries' },
  { table: 'clinic_working_hours', label: 'working-hours entries' },
];

/** Shared field validation for create/update. Returns an error string, or null. */
function validate({ name, locationType, country, latitude, longitude }, { requireName }) {
  if (requireName && (!name || !String(name).trim())) return 'Name is required';
  if (name !== undefined && name !== null && String(name).trim().length > 255) {
    return 'Name must be 255 characters or fewer';
  }
  if (locationType != null && !LOCATION_TYPES.includes(locationType)) {
    return `locationType must be one of: ${LOCATION_TYPES.join(', ')}`;
  }
  if (country != null && String(country).length !== 2) {
    return 'country must be a 2-letter ISO-3166 code';
  }
  if (latitude != null && (Number.isNaN(Number(latitude)) || Math.abs(Number(latitude)) > 90)) {
    return 'latitude must be a number between -90 and 90';
  }
  if (longitude != null && (Number.isNaN(Number(longitude)) || Math.abs(Number(longitude)) > 180)) {
    return 'longitude must be a number between -180 and 180';
  }
  return null;
}

// ── reads ────────────────────────────────────────────────────────────────────────────

// GET /api/locations?includeInactive=true&type=camp
router.get('/', async (req, res) => {
  try {
    const db = req.db || req.app.locals.pool;
    const { includeInactive, type } = req.query;

    const where = [];
    const params = [];
    if (includeInactive !== 'true') where.push('is_active = true');
    if (type) { params.push(type); where.push(`location_type = $${params.length}`); }

    const { rows } = await db.query(
      `SELECT * FROM locations
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        ORDER BY is_primary DESC, name ASC`,
      params
    );
    res.json(rows.map(toCamelCase));
  } catch (error) {
    console.error('Error fetching locations:', error);
    res.status(500).json({ error: 'Failed to fetch locations', detail: error.message });
  }
});

// GET /api/locations/primary — the default site. Declared before /:id so "primary" is not
// parsed as an id.
router.get('/primary', async (req, res) => {
  try {
    const db = req.db || req.app.locals.pool;
    const { rows } = await db.query(
      'SELECT * FROM locations WHERE is_primary AND is_active LIMIT 1'
    );
    if (!rows.length) {
      return res.status(404).json({
        error: 'NoPrimaryLocation',
        message: 'This practice has no active primary site. Set one in Admin → Locations.',
      });
    }
    res.json(toCamelCase(rows[0]));
  } catch (error) {
    console.error('Error fetching primary location:', error);
    res.status(500).json({ error: 'Failed to fetch primary location', detail: error.message });
  }
});

// GET /api/locations/:id
router.get('/:id', async (req, res) => {
  try {
    const db = req.db || req.app.locals.pool;
    const { rows } = await db.query('SELECT * FROM locations WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Location not found' });
    res.json(toCamelCase(rows[0]));
  } catch (error) {
    console.error('Error fetching location:', error);
    res.status(500).json({ error: 'Failed to fetch location', detail: error.message });
  }
});

// ── writes ───────────────────────────────────────────────────────────────────────────

// POST /api/locations
router.post('/', authorize('admin'), async (req, res) => {
  const {
    name, locationType, address, city, state, country, postalCode,
    phone, email, latitude, longitude, timezone, notes, isActive,
  } = req.body || {};

  const invalid = validate(req.body || {}, { requireName: true });
  if (invalid) return res.status(400).json({ error: invalid });

  try {
    const db = req.db || req.app.locals.pool;
    const { rows } = await db.query(
      `INSERT INTO locations
         (name, location_type, address, city, state, country, postal_code,
          phone, email, latitude, longitude, timezone, notes, is_active)
       VALUES ($1, COALESCE($2,'clinic'), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
               COALESCE($14, true))
       RETURNING *`,
      [String(name).trim(), locationType || null, address || null, city || null,
       state || null, country || null, postalCode || null, phone || null, email || null,
       latitude ?? null, longitude ?? null, timezone || null, notes || null,
       isActive === undefined ? null : isActive]
    );
    // A new site is never primary implicitly — promoting one is an explicit action, so
    // that "which site is the default" never changes as a side effect of adding a venue.
    res.status(201).json(toCamelCase(rows[0]));
  } catch (error) {
    console.error('Error creating location:', error);
    res.status(500).json({ error: 'Failed to create location', code: error.code, detail: error.detail || error.message });
  }
});

// PUT /api/locations/:id
router.put('/:id', authorize('admin'), async (req, res) => {
  const {
    name, locationType, address, city, state, country, postalCode,
    phone, email, latitude, longitude, timezone, notes, isActive,
  } = req.body || {};

  const invalid = validate(req.body || {}, { requireName: false });
  if (invalid) return res.status(400).json({ error: invalid });

  try {
    const db = req.db || req.app.locals.pool;

    // Deactivating the primary site would leave the tenant with no default — refuse, and
    // say what to do instead.
    if (isActive === false) {
      const { rows: cur } = await db.query(
        'SELECT is_primary, name FROM locations WHERE id = $1', [req.params.id]
      );
      if (!cur.length) return res.status(404).json({ error: 'Location not found' });
      if (cur[0].is_primary) {
        return res.status(409).json({
          error: 'PrimaryLocationRequired',
          message: `"${cur[0].name}" is the primary site and cannot be deactivated. Make another site primary first.`,
        });
      }
    }

    const { rows } = await db.query(
      `UPDATE locations SET
         name          = COALESCE($1, name),
         location_type = COALESCE($2, location_type),
         address       = COALESCE($3, address),
         city          = COALESCE($4, city),
         state         = COALESCE($5, state),
         country       = COALESCE($6, country),
         postal_code   = COALESCE($7, postal_code),
         phone         = COALESCE($8, phone),
         email         = COALESCE($9, email),
         latitude      = COALESCE($10, latitude),
         longitude     = COALESCE($11, longitude),
         timezone      = COALESCE($12, timezone),
         notes         = COALESCE($13, notes),
         is_active     = COALESCE($14, is_active),
         updated_at    = CURRENT_TIMESTAMP
       WHERE id = $15
       RETURNING *`,
      [name ? String(name).trim() : null, locationType || null, address ?? null,
       city ?? null, state ?? null, country ?? null, postalCode ?? null, phone ?? null,
       email ?? null, latitude ?? null, longitude ?? null, timezone ?? null, notes ?? null,
       isActive === undefined ? null : isActive, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Location not found' });
    res.json(toCamelCase(rows[0]));
  } catch (error) {
    console.error('Error updating location:', error);
    res.status(500).json({ error: 'Failed to update location', code: error.code, detail: error.detail || error.message });
  }
});

// POST /api/locations/:id/make-primary
router.post('/:id/make-primary', authorize('admin'), async (req, res) => {
  // Transaction via req.db.query('BEGIN'), not pool.connect(): req.db exposes
  // query/getClient/release but no connect(), and its wrapper re-pins search_path with
  // SET LOCAL immediately after BEGIN. That pin is what keeps the whole block on one
  // backend under Supabase's transaction pooler, where a session-level SET does not
  // survive to the next statement.
  const db = req.db || req.app.locals.pool;
  let open = false;
  try {
    await db.query('BEGIN');
    open = true;

    const { rows: target } = await db.query(
      'SELECT id, name, is_active FROM locations WHERE id = $1 FOR UPDATE', [req.params.id]
    );
    if (!target.length) {
      await db.query('ROLLBACK'); open = false;
      return res.status(404).json({ error: 'Location not found' });
    }
    if (!target[0].is_active) {
      await db.query('ROLLBACK'); open = false;
      return res.status(409).json({
        error: 'LocationInactive',
        message: `"${target[0].name}" is deactivated — reactivate it before making it primary.`,
      });
    }

    // Clear first, then set. uq_locations_single_primary is checked at statement end, so
    // this order never trips it; the reverse order would.
    await db.query('UPDATE locations SET is_primary = false, updated_at = CURRENT_TIMESTAMP WHERE is_primary');
    const { rows } = await db.query(
      'UPDATE locations SET is_primary = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [req.params.id]
    );

    await db.query('COMMIT'); open = false;
    res.json(toCamelCase(rows[0]));
  } catch (error) {
    if (open) await db.query('ROLLBACK').catch(() => {});
    console.error('Error setting primary location:', error);
    res.status(500).json({ error: 'Failed to set primary location', code: error.code, detail: error.detail || error.message });
  }
});

// DELETE /api/locations/:id
//
// The FK is ON DELETE SET NULL, so a hard delete would silently detach history. Refuse
// when anything references the site and name the counts, so the caller can deactivate
// instead of discovering the damage later.
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const db = req.db || req.app.locals.pool;
    const { id } = req.params;

    const { rows: cur } = await db.query(
      'SELECT id, name, is_primary FROM locations WHERE id = $1', [id]
    );
    if (!cur.length) return res.status(404).json({ error: 'Location not found' });
    if (cur[0].is_primary) {
      return res.status(409).json({
        error: 'PrimaryLocationRequired',
        message: `"${cur[0].name}" is the primary site and cannot be deleted. Make another site primary first.`,
      });
    }

    const references = [];
    for (const { table, label } of REFERENCING_TABLES) {
      const { rows } = await db.query(
        `SELECT COUNT(*)::int AS n FROM ${table} WHERE location_id = $1`, [id]
      );
      if (rows[0].n > 0) references.push({ label, count: rows[0].n });
    }

    if (references.length) {
      return res.status(409).json({
        error: 'LocationInUse',
        message: `"${cur[0].name}" is referenced by ${references.map((r) => `${r.count} ${r.label}`).join(', ')}. Deactivate it instead of deleting it.`,
        references,
      });
    }

    const { rows } = await db.query('DELETE FROM locations WHERE id = $1 RETURNING *', [id]);
    res.json({ success: true, location: toCamelCase(rows[0]) });
  } catch (error) {
    console.error('Error deleting location:', error);
    res.status(500).json({ error: 'Failed to delete location', code: error.code, detail: error.detail || error.message });
  }
});

module.exports = router;
