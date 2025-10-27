const express = require('express');
const router = express.Router();

// Helper function to convert snake_case to camelCase
const toCamelCase = (obj) => {
  const newObj = {};
  for (const key in obj) {
    const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
    newObj[camelKey] = obj[key];
  }
  return newObj;
};

// Get all prescriptions
router.get('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { patient_id } = req.query;

    let query = `
      SELECT p.*,
             pat.first_name || ' ' || pat.last_name as patient_name,
             prov.first_name || ' ' || prov.last_name as provider_name
      FROM prescriptions p
      LEFT JOIN patients pat ON p.patient_id = pat.id
      LEFT JOIN providers prov ON p.provider_id = prov.id
    `;

    const params = [];
    if (patient_id) {
      query += ' WHERE p.patient_id = $1';
      params.push(patient_id);
    }

    query += ' ORDER BY p.prescribed_date DESC, p.id DESC';

    const result = await pool.query(query, params);
    const prescriptions = result.rows.map(toCamelCase);
    res.json(prescriptions);
  } catch (error) {
    console.error('Error fetching prescriptions:', error);
    res.status(500).json({ error: 'Failed to fetch prescriptions' });
  }
});

// Get single prescription
router.get('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      `SELECT p.*,
              pat.first_name || ' ' || pat.last_name as patient_name,
              prov.first_name || ' ' || prov.last_name as provider_name
       FROM prescriptions p
       LEFT JOIN patients pat ON p.patient_id = pat.id
       LEFT JOIN providers prov ON p.provider_id = prov.id
       WHERE p.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Prescription not found' });
    }

    res.json(toCamelCase(result.rows[0]));
  } catch (error) {
    console.error('Error fetching prescription:', error);
    res.status(500).json({ error: 'Failed to fetch prescription' });
  }
});

// Create new prescription
router.post('/', async (req, res) => {
  const {
    patientId,
    providerId,
    appointmentId,
    medicationName,
    dosage,
    frequency,
    duration,
    instructions,
    refills,
    status,
    prescribedDate
  } = req.body;

  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      `INSERT INTO prescriptions (
        patient_id, provider_id, appointment_id, medication_name,
        dosage, frequency, duration, instructions, refills,
        status, prescribed_date
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        patientId,
        providerId,
        appointmentId,
        medicationName,
        dosage,
        frequency,
        duration,
        instructions,
        refills || 0,
        status || 'Active',
        prescribedDate || new Date().toISOString().split('T')[0]
      ]
    );
    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (error) {
    console.error('Error creating prescription:', error);
    res.status(500).json({ error: 'Failed to create prescription' });
  }
});

// Update prescription
router.put('/:id', async (req, res) => {
  const {
    medicationName,
    dosage,
    frequency,
    duration,
    instructions,
    refills,
    status
  } = req.body;

  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      `UPDATE prescriptions SET
        medication_name = COALESCE($1, medication_name),
        dosage = COALESCE($2, dosage),
        frequency = COALESCE($3, frequency),
        duration = COALESCE($4, duration),
        instructions = COALESCE($5, instructions),
        refills = COALESCE($6, refills),
        status = COALESCE($7, status),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $8
      RETURNING *`,
      [medicationName, dosage, frequency, duration, instructions, refills, status, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Prescription not found' });
    }

    res.json(toCamelCase(result.rows[0]));
  } catch (error) {
    console.error('Error updating prescription:', error);
    res.status(500).json({ error: 'Failed to update prescription' });
  }
});

// Delete prescription
router.delete('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      'DELETE FROM prescriptions WHERE id = $1 RETURNING *',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Prescription not found' });
    }

    res.json({ message: 'Prescription deleted successfully' });
  } catch (error) {
    console.error('Error deleting prescription:', error);
    res.status(500).json({ error: 'Failed to delete prescription' });
  }
});

module.exports = router;
