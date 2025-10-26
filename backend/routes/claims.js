const express = require('express');
const router = express.Router();

// Get all claims
router.get('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { patientId } = req.query;

    let query = `
      SELECT c.*,
             CONCAT(p.first_name, ' ', p.last_name) as patient
      FROM claims c
      LEFT JOIN patients p ON c.patient_id::text = p.id::text
    `;

    const params = [];
    if (patientId) {
      query += ` WHERE c.patient_id::text = $1::text`;
      params.push(patientId);
    }

    query += ` ORDER BY c.service_date DESC NULLS LAST, c.created_at DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching claims:', error);
    res.status(500).json({ error: 'Failed to fetch claims' });
  }
});

// Get single claim
router.get('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      'SELECT * FROM claims WHERE id::text = $1::text',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Claim not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching claim:', error);
    res.status(500).json({ error: 'Failed to fetch claim' });
  }
});

// Create new claim
router.post('/', async (req, res) => {
  const {
    claim_no, claim_number, patient_id, payer, amount, status,
    service_date, diagnosis_codes, procedure_codes, notes
  } = req.body;

  try {
    const pool = req.app.locals.pool;
    // Use claim_number field (database column name), fall back to claim_no for compatibility
    const claimNum = claim_number || claim_no;

    const result = await pool.query(
      `INSERT INTO claims
       (claim_number, patient_id, payer, amount, status,
        service_date, diagnosis_codes, procedure_codes, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
       RETURNING *`,
      [claimNum, patient_id, payer, amount, status || 'pending',
       service_date, diagnosis_codes, procedure_codes, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating claim:', error);
    res.status(500).json({ error: 'Failed to create claim' });
  }
});

// Update claim
router.put('/:id', async (req, res) => {
  const {
    claim_no, claim_number, patient_id, payer, amount, status,
    service_date, diagnosis_codes, procedure_codes, notes
  } = req.body;

  try {
    const pool = req.app.locals.pool;
    // Use claim_number field (database column name), fall back to claim_no for compatibility
    const claimNum = claim_number || claim_no;

    const result = await pool.query(
      `UPDATE claims
       SET claim_number = COALESCE($1, claim_number),
           patient_id = COALESCE($2, patient_id),
           payer = COALESCE($3, payer),
           amount = COALESCE($4, amount),
           status = COALESCE($5, status),
           service_date = COALESCE($6, service_date),
           diagnosis_codes = COALESCE($7, diagnosis_codes),
           procedure_codes = COALESCE($8, procedure_codes),
           notes = COALESCE($9, notes),
           updated_at = NOW()
       WHERE id::text = $10::text
       RETURNING *`,
      [claimNum, patient_id, payer, amount, status,
       service_date, diagnosis_codes, procedure_codes, notes, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Claim not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating claim:', error);
    res.status(500).json({ error: 'Failed to update claim' });
  }
});

// Delete claim
router.delete('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      'DELETE FROM claims WHERE id::text = $1::text RETURNING *',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Claim not found' });
    }
    res.json({ message: 'Claim deleted successfully' });
  } catch (error) {
    console.error('Error deleting claim:', error);
    res.status(500).json({ error: 'Failed to delete claim' });
  }
});

module.exports = router;