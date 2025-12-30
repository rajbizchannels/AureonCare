const express = require('express');
const router = express.Router();

// Get all payment postings
router.get('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { patientId, claimId, insurancePayerId, status } = req.query;

    let query = `
      SELECT pp.*,
             CONCAT(pat.first_name, ' ', pat.last_name) as patient_name,
             c.claim_number,
             ip.name as insurance_payer_name,
             ip.payer_id as insurance_payer_code
      FROM payment_postings pp
      LEFT JOIN patients pat ON pp.patient_id::text = pat.id::text
      LEFT JOIN claims c ON pp.claim_id::text = c.id::text
      LEFT JOIN insurance_payers ip ON pp.insurance_payer_id::text = ip.id::text
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (patientId) {
      query += ` AND pp.patient_id::text = $${paramIndex}::text`;
      params.push(patientId);
      paramIndex++;
    }

    if (claimId) {
      query += ` AND pp.claim_id::text = $${paramIndex}::text`;
      params.push(claimId);
      paramIndex++;
    }

    if (insurancePayerId) {
      query += ` AND pp.insurance_payer_id::text = $${paramIndex}::text`;
      params.push(insurancePayerId);
      paramIndex++;
    }

    if (status) {
      query += ` AND pp.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY pp.posting_date DESC, pp.created_at DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching payment postings:', error);
    res.status(500).json({ error: 'Failed to fetch payment postings' });
  }
});

// Get single payment posting
router.get('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      `SELECT pp.*,
              CONCAT(pat.first_name, ' ', pat.last_name) as patient_name,
              c.claim_number,
              c.amount as claim_amount,
              ip.name as insurance_payer_name,
              ip.payer_id as insurance_payer_code
       FROM payment_postings pp
       LEFT JOIN patients pat ON pp.patient_id::text = pat.id::text
       LEFT JOIN claims c ON pp.claim_id::text = c.id::text
       LEFT JOIN insurance_payers ip ON pp.insurance_payer_id::text = ip.id::text
       WHERE pp.id::text = $1::text`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Payment posting not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching payment posting:', error);
    res.status(500).json({ error: 'Failed to fetch payment posting' });
  }
});

// Get payment postings by claim
router.get('/claim/:claimId', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      `SELECT pp.*,
              ip.name as insurance_payer_name
       FROM payment_postings pp
       LEFT JOIN insurance_payers ip ON pp.insurance_payer_id::text = ip.id::text
       WHERE pp.claim_id::text = $1::text
       ORDER BY pp.posting_date DESC`,
      [req.params.claimId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching payment postings for claim:', error);
    res.status(500).json({ error: 'Failed to fetch payment postings for claim' });
  }
});

// Create new payment posting
router.post('/', async (req, res) => {
  const {
    posting_number,
    claim_id,
    patient_id,
    insurance_payer_id,
    check_number,
    check_date,
    payment_amount,
    allowed_amount,
    deductible_amount,
    coinsurance_amount,
    copay_amount,
    adjustment_amount,
    adjustment_reason,
    adjustment_code,
    posting_date,
    status,
    payment_method,
    era_number,
    eob_number,
    notes,
    internal_notes,
    posted_by
  } = req.body;

  try {
    const pool = req.app.locals.pool;

    const result = await pool.query(
      `INSERT INTO payment_postings
       (posting_number, claim_id, patient_id, insurance_payer_id, check_number, check_date,
        payment_amount, allowed_amount, deductible_amount, coinsurance_amount, copay_amount,
        adjustment_amount, adjustment_reason, adjustment_code, posting_date, status,
        payment_method, era_number, eob_number, notes, internal_notes, posted_by,
        created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, NOW(), NOW())
       RETURNING *`,
      [
        posting_number,
        claim_id,
        patient_id,
        insurance_payer_id,
        check_number,
        check_date,
        payment_amount,
        allowed_amount,
        deductible_amount || 0,
        coinsurance_amount || 0,
        copay_amount || 0,
        adjustment_amount || 0,
        adjustment_reason,
        adjustment_code,
        posting_date,
        status || 'posted',
        payment_method || 'check',
        era_number,
        eob_number,
        notes,
        internal_notes,
        posted_by
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating payment posting:', error);
    res.status(500).json({ error: 'Failed to create payment posting' });
  }
});

// Update payment posting
router.put('/:id', async (req, res) => {
  const {
    posting_number,
    claim_id,
    patient_id,
    insurance_payer_id,
    check_number,
    check_date,
    payment_amount,
    allowed_amount,
    deductible_amount,
    coinsurance_amount,
    copay_amount,
    adjustment_amount,
    adjustment_reason,
    adjustment_code,
    posting_date,
    status,
    payment_method,
    era_number,
    eob_number,
    notes,
    internal_notes,
    posted_by
  } = req.body;

  try {
    const pool = req.app.locals.pool;

    const result = await pool.query(
      `UPDATE payment_postings
       SET posting_number = COALESCE($1, posting_number),
           claim_id = COALESCE($2, claim_id),
           patient_id = COALESCE($3, patient_id),
           insurance_payer_id = COALESCE($4, insurance_payer_id),
           check_number = COALESCE($5, check_number),
           check_date = COALESCE($6, check_date),
           payment_amount = COALESCE($7, payment_amount),
           allowed_amount = COALESCE($8, allowed_amount),
           deductible_amount = COALESCE($9, deductible_amount),
           coinsurance_amount = COALESCE($10, coinsurance_amount),
           copay_amount = COALESCE($11, copay_amount),
           adjustment_amount = COALESCE($12, adjustment_amount),
           adjustment_reason = COALESCE($13, adjustment_reason),
           adjustment_code = COALESCE($14, adjustment_code),
           posting_date = COALESCE($15, posting_date),
           status = COALESCE($16, status),
           payment_method = COALESCE($17, payment_method),
           era_number = COALESCE($18, era_number),
           eob_number = COALESCE($19, eob_number),
           notes = COALESCE($20, notes),
           internal_notes = COALESCE($21, internal_notes),
           posted_by = COALESCE($22, posted_by),
           updated_at = NOW()
       WHERE id::text = $23::text
       RETURNING *`,
      [
        posting_number,
        claim_id,
        patient_id,
        insurance_payer_id,
        check_number,
        check_date,
        payment_amount,
        allowed_amount,
        deductible_amount,
        coinsurance_amount,
        copay_amount,
        adjustment_amount,
        adjustment_reason,
        adjustment_code,
        posting_date,
        status,
        payment_method,
        era_number,
        eob_number,
        notes,
        internal_notes,
        posted_by,
        req.params.id
      ]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Payment posting not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating payment posting:', error);
    res.status(500).json({ error: 'Failed to update payment posting' });
  }
});

// Delete payment posting
router.delete('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      'DELETE FROM payment_postings WHERE id::text = $1::text RETURNING *',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Payment posting not found' });
    }
    res.json({ message: 'Payment posting deleted successfully' });
  } catch (error) {
    console.error('Error deleting payment posting:', error);
    res.status(500).json({ error: 'Failed to delete payment posting' });
  }
});

module.exports = router;
