const express = require('express');
const router = express.Router();

// Get all appointments
router.get('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(`
      SELECT a.*,
             CONCAT(p.first_name, ' ', p.last_name) as patient,
             CONCAT(pr.first_name, ' ', pr.last_name) as doctor
      FROM appointments a
      LEFT JOIN patients p ON a.patient_id::text = p.id::text
      LEFT JOIN providers pr ON a.provider_id::text = pr.id::text
      ORDER BY a.date DESC, a.time DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// Get single appointment
router.get('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      'SELECT * FROM appointments WHERE id::text = $1::text',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching appointment:', error);
    res.status(500).json({ error: 'Failed to fetch appointment' });
  }
});

// Create new appointment
router.post('/', async (req, res) => {
  const { patient_id, provider_id, date, time, type, duration, reason, notes, status } = req.body;
  
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      `INSERT INTO appointments 
       (patient_id, provider_id, date, time, type, duration, reason, notes, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
       RETURNING *`,
      [patient_id, provider_id, date, time, type, duration, reason, notes, status || 'Scheduled']
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating appointment:', error);
    res.status(500).json({ error: 'Failed to create appointment' });
  }
});

// Update appointment
router.put('/:id', async (req, res) => {
  const { patient_id, provider_id, date, time, type, duration, reason, notes, status } = req.body;
  
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      `UPDATE appointments
       SET patient_id = $1, provider_id = $2, date = $3, time = $4,
           type = $5, duration = $6, reason = $7, notes = $8, status = $9, updated_at = NOW()
       WHERE id::text = $10::text
       RETURNING *`,
      [patient_id, provider_id, date, time, type, duration, reason, notes, status, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating appointment:', error);
    res.status(500).json({ error: 'Failed to update appointment' });
  }
});

// Delete appointment
router.delete('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      'DELETE FROM appointments WHERE id::text = $1::text RETURNING *',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }
    res.json({ message: 'Appointment deleted successfully' });
  } catch (error) {
    console.error('Error deleting appointment:', error);
    res.status(500).json({ error: 'Failed to delete appointment' });
  }
});

module.exports = router;