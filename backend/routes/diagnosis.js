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

// Get all diagnosis records
router.get('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { patient_id } = req.query;

    let query = `
      SELECT d.*,
             pat.first_name || ' ' || pat.last_name as patient_name,
             prov.first_name || ' ' || prov.last_name as provider_name
      FROM diagnosis d
      LEFT JOIN patients pat ON d.patient_id = pat.id
      LEFT JOIN providers prov ON d.provider_id = prov.id
    `;

    const params = [];
    if (patient_id) {
      query += ' WHERE d.patient_id = $1';
      params.push(patient_id);
    }

    query += ' ORDER BY d.diagnosed_date DESC, d.id DESC';

    const result = await pool.query(query, params);
    const diagnoses = result.rows.map(toCamelCase);
    res.json(diagnoses);
  } catch (error) {
    console.error('Error fetching diagnoses:', error);
    res.status(500).json({ error: 'Failed to fetch diagnoses' });
  }
});

// Get diagnoses for a specific patient
router.get('/patient/:patientId', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      `SELECT d.*,
              prov.first_name || ' ' || prov.last_name as provider_name
       FROM diagnosis d
       LEFT JOIN providers prov ON d.provider_id = prov.id
       WHERE d.patient_id = $1
       ORDER BY d.diagnosed_date DESC, d.id DESC`,
      [req.params.patientId]
    );

    const diagnoses = result.rows.map(toCamelCase);
    res.json(diagnoses);
  } catch (error) {
    console.error('Error fetching patient diagnoses:', error);
    res.status(500).json({ error: 'Failed to fetch patient diagnoses' });
  }
});

// Get single diagnosis
router.get('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      `SELECT d.*,
              pat.first_name || ' ' || pat.last_name as patient_name,
              prov.first_name || ' ' || prov.last_name as provider_name
       FROM diagnosis d
       LEFT JOIN patients pat ON d.patient_id = pat.id
       LEFT JOIN providers prov ON d.provider_id = prov.id
       WHERE d.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Diagnosis not found' });
    }

    res.json(toCamelCase(result.rows[0]));
  } catch (error) {
    console.error('Error fetching diagnosis:', error);
    res.status(500).json({ error: 'Failed to fetch diagnosis' });
  }
});

// Create new diagnosis
router.post('/', async (req, res) => {
  const {
    patientId,
    providerId,
    appointmentId,
    diagnosisCode,
    diagnosisName,
    description,
    severity,
    status,
    diagnosedDate,
    notes
  } = req.body;

  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      `INSERT INTO diagnosis (
        patient_id, provider_id, appointment_id, diagnosis_code,
        diagnosis_name, description, severity, status, diagnosed_date, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        patientId,
        providerId,
        appointmentId,
        diagnosisCode,
        diagnosisName,
        description,
        severity,
        status || 'Active',
        diagnosedDate || new Date().toISOString().split('T')[0],
        notes
      ]
    );
    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (error) {
    console.error('Error creating diagnosis:', error);
    res.status(500).json({ error: 'Failed to create diagnosis' });
  }
});

// Update diagnosis
router.put('/:id', async (req, res) => {
  const {
    diagnosisCode,
    diagnosisName,
    description,
    severity,
    status,
    notes
  } = req.body;

  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      `UPDATE diagnosis SET
        diagnosis_code = COALESCE($1, diagnosis_code),
        diagnosis_name = COALESCE($2, diagnosis_name),
        description = COALESCE($3, description),
        severity = COALESCE($4, severity),
        status = COALESCE($5, status),
        notes = COALESCE($6, notes),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING *`,
      [diagnosisCode, diagnosisName, description, severity, status, notes, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Diagnosis not found' });
    }

    res.json(toCamelCase(result.rows[0]));
  } catch (error) {
    console.error('Error updating diagnosis:', error);
    res.status(500).json({ error: 'Failed to update diagnosis' });
  }
});

// Delete diagnosis
router.delete('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      'DELETE FROM diagnosis WHERE id = $1 RETURNING *',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Diagnosis not found' });
    }

    res.json({ message: 'Diagnosis deleted successfully' });
  } catch (error) {
    console.error('Error deleting diagnosis:', error);
    res.status(500).json({ error: 'Failed to delete diagnosis' });
  }
});

module.exports = router;
