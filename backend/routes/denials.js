const express = require('express');
const router = express.Router();

// Get all denials
router.get('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { patientId, claimId, insurancePayerId, status, appealStatus, priority } = req.query;

    let query = `
      SELECT d.*,
             CONCAT(pat.first_name, ' ', pat.last_name) as patient_name,
             c.claim_number,
             c.amount as claim_amount,
             ip.name as insurance_payer_name,
             ip.payer_id as insurance_payer_code
      FROM denials d
      LEFT JOIN patients pat ON d.patient_id::text = pat.id::text
      LEFT JOIN claims c ON d.claim_id::text = c.id::text
      LEFT JOIN insurance_payers ip ON d.insurance_payer_id::text = ip.id::text
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (patientId) {
      query += ` AND d.patient_id::text = $${paramIndex}::text`;
      params.push(patientId);
      paramIndex++;
    }

    if (claimId) {
      query += ` AND d.claim_id::text = $${paramIndex}::text`;
      params.push(claimId);
      paramIndex++;
    }

    if (insurancePayerId) {
      query += ` AND d.insurance_payer_id::text = $${paramIndex}::text`;
      params.push(insurancePayerId);
      paramIndex++;
    }

    if (status) {
      query += ` AND d.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (appealStatus) {
      query += ` AND d.appeal_status = $${paramIndex}`;
      params.push(appealStatus);
      paramIndex++;
    }

    if (priority) {
      query += ` AND d.priority = $${paramIndex}`;
      params.push(priority);
      paramIndex++;
    }

    query += ` ORDER BY
      CASE d.priority
        WHEN 'urgent' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 4
      END,
      d.appeal_deadline ASC NULLS LAST,
      d.created_at DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching denials:', error);
    res.status(500).json({ error: 'Failed to fetch denials' });
  }
});

// Get single denial
router.get('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      `SELECT d.*,
              CONCAT(pat.first_name, ' ', pat.last_name) as patient_name,
              c.claim_number,
              c.amount as claim_amount,
              c.service_date,
              ip.name as insurance_payer_name,
              ip.payer_id as insurance_payer_code
       FROM denials d
       LEFT JOIN patients pat ON d.patient_id::text = pat.id::text
       LEFT JOIN claims c ON d.claim_id::text = c.id::text
       LEFT JOIN insurance_payers ip ON d.insurance_payer_id::text = ip.id::text
       WHERE d.id::text = $1::text`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Denial not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching denial:', error);
    res.status(500).json({ error: 'Failed to fetch denial' });
  }
});

// Get denials by claim
router.get('/claim/:claimId', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      `SELECT d.*,
              ip.name as insurance_payer_name
       FROM denials d
       LEFT JOIN insurance_payers ip ON d.insurance_payer_id::text = ip.id::text
       WHERE d.claim_id::text = $1::text
       ORDER BY d.denial_date DESC`,
      [req.params.claimId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching denials for claim:', error);
    res.status(500).json({ error: 'Failed to fetch denials for claim' });
  }
});

// Get denials approaching appeal deadline (within 30 days)
router.get('/alerts/deadline', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      `SELECT d.*,
              CONCAT(pat.first_name, ' ', pat.last_name) as patient_name,
              c.claim_number,
              ip.name as insurance_payer_name,
              (d.appeal_deadline - CURRENT_DATE) as days_until_deadline
       FROM denials d
       LEFT JOIN patients pat ON d.patient_id::text = pat.id::text
       LEFT JOIN claims c ON d.claim_id::text = c.id::text
       LEFT JOIN insurance_payers ip ON d.insurance_payer_id::text = ip.id::text
       WHERE d.appeal_deadline IS NOT NULL
         AND d.appeal_deadline >= CURRENT_DATE
         AND d.appeal_deadline <= CURRENT_DATE + INTERVAL '30 days'
         AND d.appeal_status IN ('not_appealed', 'appeal_pending')
         AND d.status NOT IN ('resolved', 'written_off')
       ORDER BY d.appeal_deadline ASC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching denial deadline alerts:', error);
    res.status(500).json({ error: 'Failed to fetch denial deadline alerts' });
  }
});

// Create new denial
router.post('/', async (req, res) => {
  const {
    denial_number,
    claim_id,
    patient_id,
    insurance_payer_id,
    denial_date,
    denial_amount,
    denied_service_date,
    denial_reason_code,
    denial_reason_description,
    denial_category,
    appeal_status,
    appeal_deadline,
    appeal_submitted_date,
    appeal_decision_date,
    appeal_outcome,
    appeal_amount_recovered,
    status,
    resolution_date,
    resolution_notes,
    eob_number,
    era_number,
    supporting_documents,
    assigned_to,
    priority,
    notes,
    internal_notes,
    created_by
  } = req.body;

  try {
    const pool = req.app.locals.pool;

    const result = await pool.query(
      `INSERT INTO denials
       (denial_number, claim_id, patient_id, insurance_payer_id, denial_date, denial_amount,
        denied_service_date, denial_reason_code, denial_reason_description, denial_category,
        appeal_status, appeal_deadline, appeal_submitted_date, appeal_decision_date, appeal_outcome,
        appeal_amount_recovered, status, resolution_date, resolution_notes, eob_number, era_number,
        supporting_documents, assigned_to, priority, notes, internal_notes, created_by,
        created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, NOW(), NOW())
       RETURNING *`,
      [
        denial_number,
        claim_id,
        patient_id,
        insurance_payer_id,
        denial_date,
        denial_amount,
        denied_service_date,
        denial_reason_code,
        denial_reason_description,
        denial_category,
        appeal_status || 'not_appealed',
        appeal_deadline,
        appeal_submitted_date,
        appeal_decision_date,
        appeal_outcome,
        appeal_amount_recovered || 0,
        status || 'open',
        resolution_date,
        resolution_notes,
        eob_number,
        era_number,
        supporting_documents ? JSON.stringify(supporting_documents) : null,
        assigned_to,
        priority || 'medium',
        notes,
        internal_notes,
        created_by
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating denial:', error);
    res.status(500).json({ error: 'Failed to create denial' });
  }
});

// Update denial
router.put('/:id', async (req, res) => {
  const {
    denial_number,
    claim_id,
    patient_id,
    insurance_payer_id,
    denial_date,
    denial_amount,
    denied_service_date,
    denial_reason_code,
    denial_reason_description,
    denial_category,
    appeal_status,
    appeal_deadline,
    appeal_submitted_date,
    appeal_decision_date,
    appeal_outcome,
    appeal_amount_recovered,
    status,
    resolution_date,
    resolution_notes,
    eob_number,
    era_number,
    supporting_documents,
    assigned_to,
    priority,
    notes,
    internal_notes,
    created_by
  } = req.body;

  try {
    const pool = req.app.locals.pool;

    const result = await pool.query(
      `UPDATE denials
       SET denial_number = COALESCE($1, denial_number),
           claim_id = COALESCE($2, claim_id),
           patient_id = COALESCE($3, patient_id),
           insurance_payer_id = COALESCE($4, insurance_payer_id),
           denial_date = COALESCE($5, denial_date),
           denial_amount = COALESCE($6, denial_amount),
           denied_service_date = COALESCE($7, denied_service_date),
           denial_reason_code = COALESCE($8, denial_reason_code),
           denial_reason_description = COALESCE($9, denial_reason_description),
           denial_category = COALESCE($10, denial_category),
           appeal_status = COALESCE($11, appeal_status),
           appeal_deadline = COALESCE($12, appeal_deadline),
           appeal_submitted_date = COALESCE($13, appeal_submitted_date),
           appeal_decision_date = COALESCE($14, appeal_decision_date),
           appeal_outcome = COALESCE($15, appeal_outcome),
           appeal_amount_recovered = COALESCE($16, appeal_amount_recovered),
           status = COALESCE($17, status),
           resolution_date = COALESCE($18, resolution_date),
           resolution_notes = COALESCE($19, resolution_notes),
           eob_number = COALESCE($20, eob_number),
           era_number = COALESCE($21, era_number),
           supporting_documents = COALESCE($22, supporting_documents),
           assigned_to = COALESCE($23, assigned_to),
           priority = COALESCE($24, priority),
           notes = COALESCE($25, notes),
           internal_notes = COALESCE($26, internal_notes),
           created_by = COALESCE($27, created_by),
           updated_at = NOW()
       WHERE id::text = $28::text
       RETURNING *`,
      [
        denial_number,
        claim_id,
        patient_id,
        insurance_payer_id,
        denial_date,
        denial_amount,
        denied_service_date,
        denial_reason_code,
        denial_reason_description,
        denial_category,
        appeal_status,
        appeal_deadline,
        appeal_submitted_date,
        appeal_decision_date,
        appeal_outcome,
        appeal_amount_recovered,
        status,
        resolution_date,
        resolution_notes,
        eob_number,
        era_number,
        supporting_documents ? JSON.stringify(supporting_documents) : null,
        assigned_to,
        priority,
        notes,
        internal_notes,
        created_by,
        req.params.id
      ]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Denial not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating denial:', error);
    res.status(500).json({ error: 'Failed to update denial' });
  }
});

// Delete denial
router.delete('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      'DELETE FROM denials WHERE id::text = $1::text RETURNING *',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Denial not found' });
    }
    res.json({ message: 'Denial deleted successfully' });
  } catch (error) {
    console.error('Error deleting denial:', error);
    res.status(500).json({ error: 'Failed to delete denial' });
  }
});

module.exports = router;
