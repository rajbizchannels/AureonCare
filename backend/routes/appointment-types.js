const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');

// Helper function to convert snake_case to camelCase
const toCamelCase = (obj) => {
  const newObj = {};
  for (const key in obj) {
    const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
    newObj[camelKey] = obj[key];
  }
  return newObj;
};

// Get all active appointment types (public - no auth required for booking)
router.get('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
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
    const pool = req.app.locals.pool;
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
router.get('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
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
    const pool = req.app.locals.pool;
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
    res.status(500).json({ error: 'Failed to create appointment type' });
  }
});

// Update appointment type (admin only)
router.put('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { id } = req.params;
    const { name, description, durationMinutes, color, isActive, displayOrder } = req.body;

    const result = await pool.query(`
      UPDATE appointment_types
      SET
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
    res.status(500).json({ error: 'Failed to update appointment type' });
  }
});

// Delete appointment type (admin only)
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const pool = req.app.locals.pool;
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
    res.status(500).json({ error: 'Failed to delete appointment type' });
  }
});

module.exports = router;
