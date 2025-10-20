const express = require('express');
const router = express.Router();

// Get all claims
router.get('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(`
      SELECT c.*, 
             CONCAT(p.first_name, ' ', p.last_name) as patient
      FROM claims c
      LEFT JOIN patients p ON c.patient_id = p.id
      ORDER BY c.date DESC
    `);
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
      'SELECT * FROM claims WHERE id = $1',
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
    claim_no, patient_id, payer, payer_id, amount, status, 
    date, service_date, diagnosis_codes, procedure_codes, notes 
  } = req.body;
  
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      `INSERT INTO claims 
       (claim_no, patient_id, payer, payer_id, amount, status, 
        date, service_date, diagnosis_codes, procedure_codes, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
       RETURNING *`,
      [claim_no, patient_id, payer, payer_id, amount, status || 'Pending', 
       date, service_date, JSON.stringify(diagnosis_codes), JSON.stringify(procedure_codes), notes]
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
    claim_no, patient_id, payer, payer_id, amount, status, 
    date, service_date, diagnosis_codes, procedure_codes, notes 
  } = req.body;
  
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      `UPDATE claims 
       SET claim_no = $1, patient_id = $2, payer = $3, payer_id = $4, 
           amount = $5, status = $6, date = $7, service_date = $8, 
           diagnosis_codes = $9, procedure_codes = $10, notes = $11, updated_at = NOW()
       WHERE id = $12
       RETURNING *`,
      [claim_no, patient_id, payer, payer_id, amount, status, 
       date, service_date, JSON.stringify(diagnosis_codes), JSON.stringify(procedure_codes), notes, req.params.id]
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
      'DELETE FROM claims WHERE id = $1 RETURNING *',
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