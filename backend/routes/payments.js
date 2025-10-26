const express = require('express');
const router = express.Router();

// Get all payments
router.get('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { patientId, claimId, status } = req.query;

    let query = `
      SELECT p.*,
             CONCAT(pat.first_name, ' ', pat.last_name) as patient_name,
             c.claim_number
      FROM payments p
      LEFT JOIN patients pat ON p.patient_id::text = pat.id::text
      LEFT JOIN claims c ON p.claim_id::text = c.id::text
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (patientId) {
      query += ` AND p.patient_id::text = $${paramIndex}::text`;
      params.push(patientId);
      paramIndex++;
    }

    if (claimId) {
      query += ` AND p.claim_id::text = $${paramIndex}::text`;
      params.push(claimId);
      paramIndex++;
    }

    if (status) {
      query += ` AND p.payment_status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY p.created_at DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// Get single payment
router.get('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      `SELECT p.*,
              CONCAT(pat.first_name, ' ', pat.last_name) as patient_name,
              c.claim_number
       FROM payments p
       LEFT JOIN patients pat ON p.patient_id::text = pat.id::text
       LEFT JOIN claims c ON p.claim_id::text = c.id::text
       WHERE p.id::text = $1::text`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching payment:', error);
    res.status(500).json({ error: 'Failed to fetch payment' });
  }
});

// Create new payment
router.post('/', async (req, res) => {
  const {
    payment_number,
    patient_id,
    claim_id,
    amount,
    payment_method,
    payment_status,
    transaction_id,
    card_last_four,
    card_brand,
    payment_date,
    description,
    notes
  } = req.body;

  try {
    const pool = req.app.locals.pool;

    const result = await pool.query(
      `INSERT INTO payments
       (payment_number, patient_id, claim_id, amount, payment_method, payment_status,
        transaction_id, card_last_four, card_brand, payment_date, description, notes,
        created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
       RETURNING *`,
      [
        payment_number,
        patient_id,
        claim_id,
        amount,
        payment_method,
        payment_status || 'pending',
        transaction_id,
        card_last_four,
        card_brand,
        payment_date,
        description,
        notes
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating payment:', error);
    res.status(500).json({ error: 'Failed to create payment' });
  }
});

// Update payment
router.put('/:id', async (req, res) => {
  const {
    payment_number,
    patient_id,
    claim_id,
    amount,
    payment_method,
    payment_status,
    transaction_id,
    card_last_four,
    card_brand,
    payment_date,
    description,
    notes
  } = req.body;

  try {
    const pool = req.app.locals.pool;

    const result = await pool.query(
      `UPDATE payments
       SET payment_number = COALESCE($1, payment_number),
           patient_id = COALESCE($2, patient_id),
           claim_id = COALESCE($3, claim_id),
           amount = COALESCE($4, amount),
           payment_method = COALESCE($5, payment_method),
           payment_status = COALESCE($6, payment_status),
           transaction_id = COALESCE($7, transaction_id),
           card_last_four = COALESCE($8, card_last_four),
           card_brand = COALESCE($9, card_brand),
           payment_date = COALESCE($10, payment_date),
           description = COALESCE($11, description),
           notes = COALESCE($12, notes),
           updated_at = NOW()
       WHERE id::text = $13::text
       RETURNING *`,
      [
        payment_number,
        patient_id,
        claim_id,
        amount,
        payment_method,
        payment_status,
        transaction_id,
        card_last_four,
        card_brand,
        payment_date,
        description,
        notes,
        req.params.id
      ]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating payment:', error);
    res.status(500).json({ error: 'Failed to update payment' });
  }
});

// Delete payment
router.delete('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      'DELETE FROM payments WHERE id::text = $1::text RETURNING *',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    res.json({ message: 'Payment deleted successfully' });
  } catch (error) {
    console.error('Error deleting payment:', error);
    res.status(500).json({ error: 'Failed to delete payment' });
  }
});

module.exports = router;
