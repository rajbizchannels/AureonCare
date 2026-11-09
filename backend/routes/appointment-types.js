const express = require('express');
const router = express.Router();
const { authenticate, authorize, optionalAuth } = require('../middleware/auth');
const { sendDbError } = require('../utils/dbErrors');

// Helper function to convert snake_case to camelCase
const toCamelCase = (obj) => {
  const newObj = {};
  for (const key in obj) {
    const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
    newObj[camelKey] = obj[key];
  }
  return newObj;
};

// Get all active appointment types.
//
// `optionalAuth` is what makes this work at all. The route carried no middleware, on the
// reasoning that the public booking page needs it without a session — but no middleware
// also means no req.db, so it fell back to the application pool, whose search_path is
// pinned to `public`. Since migration 066 moved the tenant tables out of `public`, every
// call returned 42P01 and the route answered 500 for EVERYONE, signed in or not. That took
// out the appointment type dropdown in the booking form and the whole Appointment Types
// admin screen.
//
// optionalAuth attaches the tenant context when there is a session and lets the request
// through when there is not, so staff screens work now.
//
// STILL BROKEN FOR AN ANONYMOUS CALLER, and deliberately left so rather than papered over:
// without a session there is no tenant to read, and guessing one would serve another
// practice's data. The public booking page has to name its tenant — the way
// /api/scheduling/booking-config/slug/:slug is meant to — and every public endpoint in
// that flow shares this gap. Fixing it is a change to how public booking identifies a
// practice, not a middleware tweak.
router.get('/', optionalAuth, async (req, res) => {
  try {
  // No session means no tenant, and there is no honest way to pick one. Said plainly with
  // a 409 rather than left to fail as a 500: a server error tells the caller nothing and
  // reads as "the server is broken" when the real answer is "this request has to say which
  // practice it is for".
  if (!req.db) {
    return res.status(409).json({
      error: 'No practice context',
      message: 'Appointment types are per practice. Sign in, or use the public booking '
        + 'endpoints that identify the practice by its booking slug.',
    });
  }
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const result = await pool.query(`
      SELECT * FROM appointment_types
      WHERE is_active = true
      ORDER BY display_order ASC, name ASC
    `);

    const types = result.rows.map(toCamelCase);
    res.json(types);
  } catch (error) {
    console.error('Error fetching appointment types:', error);
    res.status(500).json({ error: 'Failed to fetch appointment types' });
  }
});

// Get all appointment types (admin only - includes inactive)
router.get('/all', authenticate, authorize('admin'), async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const result = await pool.query(`
      SELECT * FROM appointment_types
      ORDER BY display_order ASC, name ASC
    `);

    const types = result.rows.map(toCamelCase);
    res.json(types);
  } catch (error) {
    console.error('Error fetching all appointment types:', error);
    res.status(500).json({ error: 'Failed to fetch appointment types' });
  }
});

// Get single appointment type
// Same as GET / above: no middleware meant no req.db, and a guaranteed 500.
router.get('/:id', optionalAuth, async (req, res) => {
  try {
  // No session means no tenant, and there is no honest way to pick one. Said plainly with
  // a 409 rather than left to fail as a 500: a server error tells the caller nothing and
  // reads as "the server is broken" when the real answer is "this request has to say which
  // practice it is for".
  if (!req.db) {
    return res.status(409).json({
      error: 'No practice context',
      message: 'Appointment types are per practice. Sign in, or use the public booking '
        + 'endpoints that identify the practice by its booking slug.',
    });
  }
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { id } = req.params;

    const result = await pool.query(
      'SELECT * FROM appointment_types WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment type not found' });
    }

    res.json(toCamelCase(result.rows[0]));
  } catch (error) {
    console.error('Error fetching appointment type:', error);
    res.status(500).json({ error: 'Failed to fetch appointment type' });
  }
});

// Create appointment type (admin only)
router.post('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { name, description, durationMinutes, color, isActive, displayOrder } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const result = await pool.query(`
      INSERT INTO appointment_types
        (name, description, duration_minutes, color, is_active, display_order)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      name,
      description || null,
      durationMinutes || 30,
      color || '#3B82F6',
      isActive !== undefined ? isActive : true,
      displayOrder || 0
    ]);

    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (error) {
    console.error('Error creating appointment type:', error);
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({ error: 'Appointment type with this name already exists' });
    }
    // A constraint the request broke is the caller's to fix, not a server fault.
    if (sendDbError(res, error, 'Failed to create appointment type')) return;
    res.status(500).json({ error: 'Failed to create appointment type' });
  }
});

// Update appointment type (admin only)
router.put('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { id } = req.params;
    const { name, description, durationMinutes, color, isActive, displayOrder } = req.body;

    const result = await pool.query(`
      UPDATE appointment_types
      SET
        -- A user edit makes this row the practice's own; a specialty-pack upgrade must
        -- never overwrite it afterwards (tenant/007, services/specialtyPack.js).
        is_customised = true,
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        duration_minutes = COALESCE($3, duration_minutes),
        color = COALESCE($4, color),
        is_active = COALESCE($5, is_active),
        display_order = COALESCE($6, display_order),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING *
    `, [name, description, durationMinutes, color, isActive, displayOrder, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment type not found' });
    }

    res.json(toCamelCase(result.rows[0]));
  } catch (error) {
    console.error('Error updating appointment type:', error);
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({ error: 'Appointment type with this name already exists' });
    }
    // A constraint the request broke is the caller's to fix, not a server fault.
    if (sendDbError(res, error, 'Failed to update appointment type')) return;
    res.status(500).json({ error: 'Failed to update appointment type' });
  }
});

// Delete appointment type (admin only)
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { id } = req.params;

    // Check if type is in use
    const usageCheck = await pool.query(
      'SELECT COUNT(*) FROM appointments WHERE appointment_type = (SELECT name FROM appointment_types WHERE id = $1)',
      [id]
    );

    if (parseInt(usageCheck.rows[0].count) > 0) {
      return res.status(400).json({
        error: 'Cannot delete appointment type that is in use',
        message: 'This appointment type is being used by existing appointments. Consider deactivating it instead.'
      });
    }

    const result = await pool.query(
      'DELETE FROM appointment_types WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment type not found' });
    }

    res.json({
      success: true,
      message: 'Appointment type deleted successfully',
      appointmentType: toCamelCase(result.rows[0])
    });
  } catch (error) {
    console.error('Error deleting appointment type:', error);
    // A constraint the request broke is the caller's to fix, not a server fault.
    if (sendDbError(res, error, 'Failed to delete appointment type')) return;
    res.status(500).json({ error: 'Failed to delete appointment type' });
  }
});

module.exports = router;
