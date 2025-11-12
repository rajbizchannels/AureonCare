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
             CONCAT(pr.first_name, ' ', pr.last_name) as doctor,
             pr.first_name as provider_first_name,
             pr.last_name as provider_last_name,
             pr.specialization as provider_specialization
      FROM appointments a
      LEFT JOIN patients p ON a.patient_id::text = p.id::text
      LEFT JOIN providers pr ON a.provider_id::text = pr.id::text
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
  let {
    patient_id, user_id, provider_id, practice_id, appointment_type,
    start_time, end_time, duration_minutes, reason, notes, status
  } = req.body;

  try {
    const pool = req.app.locals.pool;

    console.log('Creating appointment with:', { patient_id, user_id, appointment_type, start_time });

    // If user_id is provided instead of patient_id, look up the patient
    if (!patient_id && user_id) {
      console.log('Looking up patient by user_id:', user_id);
      const patientLookup = await pool.query(
        'SELECT id FROM patients WHERE user_id::text = $1::text OR id::text = $1::text',
        [user_id]
      );

      console.log('Patient lookup result:', patientLookup.rows);

      if (patientLookup.rows.length > 0) {
        patient_id = patientLookup.rows[0].id;
        console.log('Found patient_id:', patient_id);
      } else {
        console.error('No patient found for user_id:', user_id);
        return res.status(404).json({
          error: 'Patient record not found for this user. Please contact support.',
          details: `No patient record found for user ID: ${user_id}`
        });
      }
    }

    // If patient_id is provided, verify it exists
    if (patient_id) {
      console.log('Verifying patient_id exists:', patient_id);
      const patientCheck = await pool.query(
        'SELECT id, first_name, last_name FROM patients WHERE id::text = $1::text',
        [patient_id]
      );

      console.log('Patient verification result:', patientCheck.rows);

      if (patientCheck.rows.length === 0) {
        console.error('Patient not found:', patient_id);
        return res.status(404).json({
          error: 'Patient record not found. Please contact support.',
          details: `Patient ID ${patient_id} does not exist in the system.`
        });
      }

      console.log('Patient verified:', patientCheck.rows[0]);
    }

    if (!patient_id) {
      console.error('No patient_id could be determined');
      return res.status(400).json({ error: 'patient_id or user_id is required' });
    }

    // Validate provider_id if provided
    if (provider_id && provider_id !== '' && provider_id !== 'null' && provider_id !== 'undefined') {
      console.log('Validating provider_id:', provider_id);

      // Check if provider exists in providers table
      const providerCheck = await pool.query(
        'SELECT id, first_name, last_name, user_id FROM providers WHERE id::text = $1::text',
        [provider_id]
      );

      if (providerCheck.rows.length === 0) {
        console.warn('Provider not found in providers table:', provider_id);

        // Check if this ID exists in users table (indicates migration issue)
        const userCheck = await pool.query(
          'SELECT id FROM users WHERE id::text = $1::text',
          [provider_id]
        );

        if (userCheck.rows.length > 0) {
          console.error('Provider ID exists in users table but not in providers table.');
          console.error('This indicates a database schema issue. Please run: npm run migrate');
          return res.status(500).json({
            error: 'Database schema mismatch detected',
            details: 'The provider reference exists in users table but not in providers table. Please contact administrator to run database migrations.',
            code: 'SCHEMA_MISMATCH'
          });
        }

        // Provider doesn't exist anywhere - set to null and allow appointment without provider
        console.warn('Provider not found anywhere - Setting provider_id to NULL');
        provider_id = null;
      } else {
        console.log('Provider verified:', providerCheck.rows[0]);
      }
    } else {
      // Convert empty string, 'null', or 'undefined' to actual NULL
      console.log('Provider ID is empty or invalid, setting to NULL:', provider_id);
      provider_id = null;
    }

    // Check for scheduling conflicts with the same doctor
    if (provider_id && start_time) {
      const conflictCheck = await pool.query(
        `SELECT a.id,
                CONCAT(pr.first_name, ' ', pr.last_name) as doctor,
                CONCAT(p.first_name, ' ', p.last_name) as patient
         FROM appointments a
         LEFT JOIN providers pr ON a.provider_id::text = pr.id::text
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
    }

    // Log the final values being inserted
    console.log('Inserting appointment with values:', {
      patient_id,
      provider_id,
      practice_id,
      appointment_type,
      start_time,
      end_time,
      duration_minutes,
      reason,
      status: status || 'scheduled'
    });

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

    // Check if this is a foreign key constraint violation
    if (error.code === '23503' && error.constraint === 'appointments_provider_id_fkey') {
      console.error('Foreign key constraint violation on provider_id');
      console.error('This usually means the database schema needs to be updated.');
      console.error('Please run: npm run migrate');

      return res.status(500).json({
        error: 'Database schema issue detected',
        details: 'The appointments table has an outdated foreign key constraint. Please run database migrations to fix this issue. Contact your system administrator.',
        technicalDetails: 'Foreign key constraint "appointments_provider_id_fkey" is pointing to the wrong table. Run: npm run migrate',
        code: 'FK_CONSTRAINT_ERROR'
      });
    }

    res.status(500).json({ error: 'Failed to create appointment', details: error.message });
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