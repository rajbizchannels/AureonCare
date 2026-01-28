const express = require('express');
const router = express.Router();

// Get all insurance payers
router.get('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { active_only } = req.query;

    let query = `
      SELECT *
      FROM insurance_payers
    `;

    if (active_only === 'true') {
      query += ` WHERE is_active = true`;
    }

    query += ` ORDER BY name`;

    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching insurance payers:', error);
    res.status(500).json({ error: 'Failed to fetch insurance payers' });
  }
});

// Get single insurance payer by ID
router.get('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      'SELECT * FROM insurance_payers WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Insurance payer not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching insurance payer:', error);
    res.status(500).json({ error: 'Failed to fetch insurance payer' });
  }
});

// Get insurance payer by payer_id
router.get('/payer/:payerId', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      'SELECT * FROM insurance_payers WHERE payer_id = $1',
      [req.params.payerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Insurance payer not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching insurance payer:', error);
    res.status(500).json({ error: 'Failed to fetch insurance payer' });
  }
});

// Create new insurance payer
router.post('/', async (req, res) => {
  const {
    payer_id,
    name,
    payer_type,
    phone,
    email,
    website,
    address,
    city,
    state,
    zip_code,
    contact_person,
    contact_phone,
    contact_email,
    claim_submission_method,
    claim_submission_address,
    electronic_payer_id,
    timely_filing_limit,
    prior_authorization_required,
    accepts_assignment,
    notes,
    is_active
  } = req.body;

  try {
    const pool = req.app.locals.pool;

    // Check if payer_id already exists
    const existing = await pool.query(
      'SELECT id FROM insurance_payers WHERE payer_id = $1',
      [payer_id]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Payer ID already exists' });
    }

    const result = await pool.query(
      `INSERT INTO insurance_payers (
        payer_id, name, payer_type, phone, email, website,
        address, city, state, zip_code, contact_person,
        contact_phone, contact_email, claim_submission_method,
        claim_submission_address, electronic_payer_id,
        timely_filing_limit, prior_authorization_required,
        accepts_assignment, notes, is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      RETURNING *`,
      [
        payer_id,
        name,
        payer_type || 'insurance',
        phone,
        email,
        website,
        address,
        city,
        state,
        zip_code,
        contact_person,
        contact_phone,
        contact_email,
        claim_submission_method || 'electronic',
        claim_submission_address,
        electronic_payer_id,
        timely_filing_limit || 365,
        prior_authorization_required || false,
        accepts_assignment !== false,
        notes,
        is_active !== false
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating insurance payer:', error);
    res.status(500).json({ error: 'Failed to create insurance payer' });
  }
});

// Update insurance payer
router.put('/:id', async (req, res) => {
  const {
    name,
    payer_type,
    phone,
    email,
    website,
    address,
    city,
    state,
    zip_code,
    contact_person,
    contact_phone,
    contact_email,
    claim_submission_method,
    claim_submission_address,
    electronic_payer_id,
    timely_filing_limit,
    prior_authorization_required,
    accepts_assignment,
    notes,
    is_active
  } = req.body;

  try {
    const pool = req.app.locals.pool;

    const result = await pool.query(
      `UPDATE insurance_payers SET
        name = COALESCE($1, name),
        payer_type = COALESCE($2, payer_type),
        phone = COALESCE($3, phone),
        email = COALESCE($4, email),
        website = COALESCE($5, website),
        address = COALESCE($6, address),
        city = COALESCE($7, city),
        state = COALESCE($8, state),
        zip_code = COALESCE($9, zip_code),
        contact_person = COALESCE($10, contact_person),
        contact_phone = COALESCE($11, contact_phone),
        contact_email = COALESCE($12, contact_email),
        claim_submission_method = COALESCE($13, claim_submission_method),
        claim_submission_address = COALESCE($14, claim_submission_address),
        electronic_payer_id = COALESCE($15, electronic_payer_id),
        timely_filing_limit = COALESCE($16, timely_filing_limit),
        prior_authorization_required = COALESCE($17, prior_authorization_required),
        accepts_assignment = COALESCE($18, accepts_assignment),
        notes = COALESCE($19, notes),
        is_active = COALESCE($20, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $21
      RETURNING *`,
      [
        name,
        payer_type,
        phone,
        email,
        website,
        address,
        city,
        state,
        zip_code,
        contact_person,
        contact_phone,
        contact_email,
        claim_submission_method,
        claim_submission_address,
        electronic_payer_id,
        timely_filing_limit,
        prior_authorization_required,
        accepts_assignment,
        notes,
        is_active,
        req.params.id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Insurance payer not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating insurance payer:', error);
    res.status(500).json({ error: 'Failed to update insurance payer' });
  }
});

// Delete insurance payer (soft delete by setting is_active to false)
router.delete('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;

    // Check if payer is used in any claims
    const claimsCheck = await pool.query(
      `SELECT COUNT(*) as count
       FROM claims
       WHERE payer IN (
         SELECT name FROM insurance_payers WHERE id = $1
       )`,
      [req.params.id]
    );

    const claimCount = parseInt(claimsCheck.rows[0].count);

    if (claimCount > 0) {
      // Soft delete if used in claims
      const result = await pool.query(
        'UPDATE insurance_payers SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
        [req.params.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Insurance payer not found' });
      }

      res.json({
        message: 'Insurance payer deactivated (referenced in claims)',
        payer: result.rows[0],
        claimCount
      });
    } else {
      // Hard delete if not used
      const result = await pool.query(
        'DELETE FROM insurance_payers WHERE id = $1 RETURNING *',
        [req.params.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Insurance payer not found' });
      }

      res.json({ message: 'Insurance payer deleted successfully' });
    }
  } catch (error) {
    console.error('Error deleting insurance payer:', error);
    res.status(500).json({ error: 'Failed to delete insurance payer' });
  }
});

module.exports = router;
