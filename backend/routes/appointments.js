const express = require('express');
const router = express.Router();

// Get all appointments
router.get('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { patientId } = req.query;

    let query = `
      SELECT a.*,
             CONCAT(p.first_name, ' ', p.last_name) as patient,
             CONCAT(u.first_name, ' ', u.last_name) as doctor
      FROM appointments a
      LEFT JOIN patients p ON a.patient_id::text = p.id::text
      LEFT JOIN users u ON a.provider_id::text = u.id::text
    `;

    const params = [];
    if (patientId) {
      query += ` WHERE a.patient_id::text = $1::text`;
      params.push(patientId);
    }

    query += ` ORDER BY a.start_time DESC`;

    const result = await pool.query(query, params);
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
  const {
    patient_id, provider_id, practice_id, appointment_type,
    start_time, end_time, duration_minutes, reason, notes, status
  } = req.body;

  try {
    const pool = req.app.locals.pool;

    // Check for scheduling conflicts with the same doctor
    const conflictCheck = await pool.query(
      `SELECT a.id,
              CONCAT(u.first_name, ' ', u.last_name) as doctor,
              CONCAT(p.first_name, ' ', p.last_name) as patient
       FROM appointments a
       LEFT JOIN users u ON a.provider_id::text = u.id::text
       LEFT JOIN patients p ON a.patient_id::text = p.id::text
       WHERE a.provider_id::text = $1::text
         AND a.start_time = $2
         AND a.status NOT IN ('cancelled', 'completed')`,
      [provider_id, start_time]
    );

    if (conflictCheck.rows.length > 0) {
      const conflict = conflictCheck.rows[0];
      return res.status(409).json({
        error: `Doctor ${conflict.doctor} already has an appointment with ${conflict.patient} at this time`
      });
    }

    const result = await pool.query(
      `INSERT INTO appointments
       (patient_id, provider_id, practice_id, appointment_type, start_time, end_time,
        duration_minutes, reason, notes, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
       RETURNING *`,
      [patient_id, provider_id, practice_id, appointment_type, start_time, end_time,
       duration_minutes, reason, notes, status || 'scheduled']
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating appointment:', error);
    res.status(500).json({ error: 'Failed to create appointment' });
  }
});

// Update appointment
router.put('/:id', async (req, res) => {
  const {
    patient_id, provider_id, practice_id, appointment_type,
    start_time, end_time, duration_minutes, reason, notes, status
  } = req.body;

  try {
    const pool = req.app.locals.pool;

    // Check for scheduling conflicts with the same doctor (excluding current appointment)
    const conflictCheck = await pool.query(
      `SELECT a.id,
              CONCAT(u.first_name, ' ', u.last_name) as doctor,
              CONCAT(p.first_name, ' ', p.last_name) as patient
       FROM appointments a
       LEFT JOIN users u ON a.provider_id::text = u.id::text
       LEFT JOIN patients p ON a.patient_id::text = p.id::text
       WHERE a.provider_id::text = $1::text
         AND a.start_time = $2
         AND a.id::text != $3::text
         AND a.status NOT IN ('cancelled', 'completed')`,
      [provider_id, start_time, req.params.id]
    );

    if (conflictCheck.rows.length > 0) {
      const conflict = conflictCheck.rows[0];
      return res.status(409).json({
        error: `Doctor ${conflict.doctor} already has an appointment with ${conflict.patient} at this time`
      });
    }

    const result = await pool.query(
      `UPDATE appointments
       SET patient_id = $1, provider_id = $2, practice_id = $3, appointment_type = $4,
           start_time = $5, end_time = $6, duration_minutes = $7, reason = $8,
           notes = $9, status = $10, updated_at = NOW()
       WHERE id::text = $11::text
       RETURNING *`,
      [patient_id, provider_id, practice_id, appointment_type, start_time, end_time,
       duration_minutes, reason, notes, status, req.params.id]
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