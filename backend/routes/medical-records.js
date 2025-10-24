const express = require('express');
const router = express.Router();

// Get all medical records
router.get('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { patientId } = req.query;

    let query = `
      SELECT
        mr.*,
        json_build_object(
          'id', p.id,
          'first_name', p.first_name,
          'last_name', p.last_name,
          'mrn', p.mrn
        ) as patient,
        json_build_object(
          'id', u.id,
          'first_name', u.first_name,
          'last_name', u.last_name,
          'specialty', u.specialty
        ) as provider
      FROM medical_records mr
      LEFT JOIN patients p ON mr.patient_id = p.id
      LEFT JOIN users u ON mr.provider_id = u.id
    `;

    const params = [];
    if (patientId) {
      query += ' WHERE mr.patient_id = $1';
      params.push(patientId);
    }

    query += ' ORDER BY mr.record_date DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching medical records:', error);
    res.status(500).json({ error: 'Failed to fetch medical records' });
  }
});

// Get single medical record
router.get('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { id } = req.params;

    const result = await pool.query(`
      SELECT
        mr.*,
        json_build_object(
          'id', p.id,
          'first_name', p.first_name,
          'last_name', p.last_name,
          'mrn', p.mrn
        ) as patient,
        json_build_object(
          'id', u.id,
          'first_name', u.first_name,
          'last_name', u.last_name,
          'specialty', u.specialty
        ) as provider
      FROM medical_records mr
      LEFT JOIN patients p ON mr.patient_id = p.id
      LEFT JOIN users u ON mr.provider_id = u.id
      WHERE mr.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Medical record not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching medical record:', error);
    res.status(500).json({ error: 'Failed to fetch medical record' });
  }
});

// Create medical record
router.post('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const {
      patientId,
      providerId,
      recordType,
      recordDate,
      title,
      description,
      diagnosis,
      treatment,
      medications,
      attachments
    } = req.body;

    const result = await pool.query(`
      INSERT INTO medical_records (
        patient_id,
        provider_id,
        record_type,
        record_date,
        title,
        description,
        diagnosis,
        treatment,
        medications,
        attachments
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      patientId,
      providerId,
      recordType,
      recordDate,
      title,
      description,
      diagnosis,
      treatment,
      JSON.stringify(medications),
      JSON.stringify(attachments)
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating medical record:', error);
    res.status(500).json({ error: 'Failed to create medical record' });
  }
});

// Update medical record
router.put('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { id } = req.params;
    const {
      recordType,
      recordDate,
      title,
      description,
      diagnosis,
      treatment,
      medications,
      attachments
    } = req.body;

    const result = await pool.query(`
      UPDATE medical_records
      SET
        record_type = COALESCE($1, record_type),
        record_date = COALESCE($2, record_date),
        title = COALESCE($3, title),
        description = COALESCE($4, description),
        diagnosis = COALESCE($5, diagnosis),
        treatment = COALESCE($6, treatment),
        medications = COALESCE($7, medications),
        attachments = COALESCE($8, attachments),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $9
      RETURNING *
    `, [
      recordType,
      recordDate,
      title,
      description,
      diagnosis,
      treatment,
      JSON.stringify(medications),
      JSON.stringify(attachments),
      id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Medical record not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating medical record:', error);
    res.status(500).json({ error: 'Failed to update medical record' });
  }
});

// Delete medical record
router.delete('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM medical_records WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Medical record not found' });
    }

    res.json({ message: 'Medical record deleted successfully', id: result.rows[0].id });
  } catch (error) {
    console.error('Error deleting medical record:', error);
    res.status(500).json({ error: 'Failed to delete medical record' });
  }
});

module.exports = router;
