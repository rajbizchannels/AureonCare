const express = require('express');
const router = express.Router();

// Get all patients
router.get('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(`
      SELECT *, CONCAT(first_name, ' ', last_name) as name
      FROM patients 
      ORDER BY last_name, first_name
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching patients:', error);
    res.status(500).json({ error: 'Failed to fetch patients' });
  }
});

// Get single patient
router.get('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      'SELECT * FROM patients WHERE id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching patient:', error);
    res.status(500).json({ error: 'Failed to fetch patient' });
  }
});

// Create new patient
router.post('/', async (req, res) => {
  const { 
    first_name, last_name, mrn, dob, gender, phone, email, 
    address, city, state, zip, insurance, insurance_id, status 
  } = req.body;
  
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      `INSERT INTO patients 
       (first_name, last_name, mrn, dob, gender, phone, email, 
        address, city, state, zip, insurance, insurance_id, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
       RETURNING *`,
      [first_name, last_name, mrn, dob, gender, phone, email, 
       address, city, state, zip, insurance, insurance_id, status || 'Active']
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating patient:', error);
    res.status(500).json({ error: 'Failed to create patient' });
  }
});

// Update patient
router.put('/:id', async (req, res) => {
  const { 
    first_name, last_name, mrn, dob, gender, phone, email, 
    address, city, state, zip, insurance, insurance_id, status 
  } = req.body;
  
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      `UPDATE patients 
       SET first_name = $1, last_name = $2, mrn = $3, dob = $4, gender = $5, 
           phone = $6, email = $7, address = $8, city = $9, state = $10, 
           zip = $11, insurance = $12, insurance_id = $13, status = $14, updated_at = NOW()
       WHERE id = $15
       RETURNING *`,
      [first_name, last_name, mrn, dob, gender, phone, email, 
       address, city, state, zip, insurance, insurance_id, status, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating patient:', error);
    res.status(500).json({ error: 'Failed to update patient' });
  }
});

// Delete patient
router.delete('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      'DELETE FROM patients WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    res.json({ message: 'Patient deleted successfully' });
  } catch (error) {
    console.error('Error deleting patient:', error);
    res.status(500).json({ error: 'Failed to delete patient' });
  }
});

module.exports = router;