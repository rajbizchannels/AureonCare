const express = require('express');
const router = express.Router();
const vendorIntegrationManager = require('../services/vendorIntegrations');

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
    claim_number, patient_id, payer, amount, status,
    service_date, diagnosis_codes, procedure_codes, notes, preapproval_id
  } = req.body;

  try {
    const pool = req.app.locals.pool;

    const result = await pool.query(
      `INSERT INTO claims
       (claim_number, patient_id, payer, amount, status,
        service_date, diagnosis_codes, procedure_codes, notes, preapproval_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
       RETURNING *`,
      [claim_number, patient_id, payer, amount, status || 'pending',
       service_date, diagnosis_codes, procedure_codes, notes, preapproval_id || null]
    );

    const claim = result.rows[0];

    // Submit to Optum clearinghouse if enabled and submit_to_clearinghouse is requested
    if (req.body.submitToClearinghouse && vendorIntegrationManager.isVendorEnabled('optum')) {
      try {
        // Get patient, provider, and payer details
        const patientResult = await pool.query(
          'SELECT * FROM users WHERE id = $1',
          [patient_id]
        );
        const providerResult = await pool.query(
          'SELECT * FROM users WHERE id = $1',
          [req.body.provider_id || req.userId] // Use provider from request or current user
        );
        const payerResult = await pool.query(
          'SELECT * FROM insurance_payers WHERE id = $1',
          [req.body.payer_id]
        );

        // Parse diagnosis and procedure codes if they're strings
        const parsedDiagnosisCodes = typeof diagnosis_codes === 'string'
          ? JSON.parse(diagnosis_codes)
          : (diagnosis_codes || []);
        const parsedProcedureCodes = typeof procedure_codes === 'string'
          ? JSON.parse(procedure_codes)
          : (procedure_codes || []);

        const optum = vendorIntegrationManager.getOptum();

        const claimData = {
          ...claim,
          patient_id: patient_id,
          provider_id: req.body.provider_id || req.userId,
          payer_id: req.body.payer_id,
          patient: patientResult.rows[0],
          provider: providerResult.rows[0],
          payer: payerResult.rows.length > 0 ? payerResult.rows[0] : { payer_id: payer },
          claim_type: req.body.claim_type || 'professional',
          claim_amount: amount,
          service_date: service_date,
          service_date_end: req.body.service_date_end || service_date,
          diagnosis_codes: parsedDiagnosisCodes.map(code => ({
            code: typeof code === 'string' ? code : code.code,
            display: typeof code === 'object' ? code.display : ''
          })),
          procedure_codes: parsedProcedureCodes.map(code => ({
            code: typeof code === 'string' ? code : code.code,
            display: typeof code === 'object' ? code.display : '',
            charge: typeof code === 'object' ? code.charge : 0,
            quantity: typeof code === 'object' ? code.quantity : 1
          }))
        };

        const vendorResponse = await optum.submitClaim(claimData);

        if (vendorResponse.success) {
          // Update claim with clearinghouse information
          await pool.query(`
            UPDATE claims
            SET
              clearinghouse_claim_id = $1,
              clearinghouse_status = $2,
              submitted_to_clearinghouse_at = $3,
              clearinghouse_response = $4,
              status = 'submitted'
            WHERE id = $5
          `, [
            vendorResponse.clearinghouseClaimId,
            vendorResponse.status,
            vendorResponse.submittedAt,
            JSON.stringify(vendorResponse.response),
            claim.id
          ]);

          claim.clearinghouse_claim_id = vendorResponse.clearinghouseClaimId;
          claim.clearinghouse_status = vendorResponse.status;
          claim.status = 'submitted';

          // Log transaction
          await vendorIntegrationManager.logTransaction('optum', 'claim_submit', {
            request: claimData,
            response: vendorResponse.response,
            status: 'success',
            externalId: vendorResponse.clearinghouseClaimId,
            internalReferenceId: claim.id,
            patientId: patient_id
          });
        } else {
          // Log failed transaction
          await vendorIntegrationManager.logTransaction('optum', 'claim_submit', {
            request: claimData,
            response: vendorResponse.response,
            status: 'failed',
            error: vendorResponse.error,
            internalReferenceId: claim.id,
            patientId: patient_id
          });

          claim.clearinghouse_error = vendorResponse.error;
        }
      } catch (vendorError) {
        console.error('Error submitting claim to Optum:', vendorError);
        claim.clearinghouse_error = vendorError.message;
        // Don't fail the request if clearinghouse submission fails
      }
    }

    res.status(201).json(claim);
  } catch (error) {
    console.error('Error creating claim:', error);
    res.status(500).json({ error: 'Failed to create claim' });
  }
});

// Update claim
router.put('/:id', async (req, res) => {
  const {
    claim_number, patient_id, payer, amount, status,
    service_date, diagnosis_codes, procedure_codes, notes
  } = req.body;

  try {
    const pool = req.app.locals.pool;

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
      [claim_number, patient_id, payer, amount, status,
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