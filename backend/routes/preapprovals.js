const express = require('express');
const router = express.Router();
const vendorIntegrationManager = require('../services/vendorIntegrations');

// Get all preapprovals
router.get('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { patientId } = req.query;

    let query = `
      SELECT p.*,
             CONCAT(pat.first_name, ' ', pat.last_name) as patient_name,
             ip.name as insurance_payer_name,
             ip.payer_id as insurance_payer_code
      FROM preapprovals p
      LEFT JOIN patients pat ON p.patient_id::text = pat.id::text
      LEFT JOIN insurance_payers ip ON p.insurance_payer_id::text = ip.id::text
    `;

    const params = [];
    if (patientId) {
      query += ` WHERE p.patient_id::text = $1::text`;
      params.push(patientId);
    }

    query += ` ORDER BY p.created_at DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching preapprovals:', error);
    res.status(500).json({ error: 'Failed to fetch preapprovals' });
  }
});

// Get single preapproval
router.get('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      `SELECT p.*,
              CONCAT(pat.first_name, ' ', pat.last_name) as patient_name,
              ip.name as insurance_payer_name,
              ip.payer_id as insurance_payer_code
       FROM preapprovals p
       LEFT JOIN patients pat ON p.patient_id::text = pat.id::text
       LEFT JOIN insurance_payers ip ON p.insurance_payer_id::text = ip.id::text
       WHERE p.id::text = $1::text`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Preapproval not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching preapproval:', error);
    res.status(500).json({ error: 'Failed to fetch preapproval' });
  }
});

// Check clearinghouse integration status
router.get('/check-clearinghouse/status', async (req, res) => {
  try {
    const isOptumEnabled = vendorIntegrationManager.isVendorEnabled('optum');
    res.json({
      hasClearinghouse: isOptumEnabled,
      clearinghouseName: isOptumEnabled ? 'Optum' : null
    });
  } catch (error) {
    console.error('Error checking clearinghouse status:', error);
    res.status(500).json({ error: 'Failed to check clearinghouse status' });
  }
});

// Create new preapproval request
router.post('/', async (req, res) => {
  const {
    preapproval_number,
    patient_id,
    insurance_payer_id,
    requested_service,
    diagnosis_codes,
    procedure_codes,
    service_start_date,
    service_end_date,
    estimated_cost,
    clinical_notes,
    submitToClearinghouse
  } = req.body;

  try {
    const pool = req.app.locals.pool;

    // Create the preapproval record
    const result = await pool.query(
      `INSERT INTO preapprovals
       (preapproval_number, patient_id, insurance_payer_id, requested_service,
        diagnosis_codes, procedure_codes, service_start_date, service_end_date,
        estimated_cost, clinical_notes, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'Pending', NOW(), NOW())
       RETURNING *`,
      [
        preapproval_number,
        patient_id,
        insurance_payer_id,
        requested_service,
        diagnosis_codes,
        procedure_codes,
        service_start_date,
        service_end_date,
        estimated_cost,
        clinical_notes
      ]
    );

    const preapproval = result.rows[0];

    // Submit to Optum clearinghouse if enabled and requested
    if (submitToClearinghouse && vendorIntegrationManager.isVendorEnabled('optum')) {
      try {
        // Get patient, provider, and payer details
        const patientResult = await pool.query(
          'SELECT * FROM users WHERE id = $1',
          [patient_id]
        );
        const providerResult = await pool.query(
          'SELECT * FROM users WHERE id = $1',
          [req.body.provider_id || req.userId]
        );
        const payerResult = await pool.query(
          'SELECT * FROM insurance_payers WHERE id = $1',
          [insurance_payer_id]
        );

        // Parse diagnosis and procedure codes if they're strings
        const parsedDiagnosisCodes = typeof diagnosis_codes === 'string'
          ? JSON.parse(diagnosis_codes)
          : (diagnosis_codes || []);
        const parsedProcedureCodes = typeof procedure_codes === 'string'
          ? JSON.parse(procedure_codes)
          : (procedure_codes || []);

        const optum = vendorIntegrationManager.getOptum();

        // Build preapproval request data
        const preapprovalData = {
          ...preapproval,
          patient_id: patient_id,
          provider_id: req.body.provider_id || req.userId,
          payer_id: insurance_payer_id,
          patient: patientResult.rows[0],
          provider: providerResult.rows[0],
          payer: payerResult.rows.length > 0 ? payerResult.rows[0] : null,
          request_type: 'prior_authorization',
          service_start_date: service_start_date,
          service_end_date: service_end_date,
          diagnosis_codes: parsedDiagnosisCodes.map(code => ({
            code: typeof code === 'string' ? code : code.code,
            display: typeof code === 'object' ? code.display : ''
          })),
          procedure_codes: parsedProcedureCodes.map(code => ({
            code: typeof code === 'string' ? code : code.code,
            display: typeof code === 'object' ? code.display : '',
            charge: typeof code === 'object' ? code.charge : estimated_cost,
            quantity: typeof code === 'object' ? code.quantity : 1
          }))
        };

        // Submit preapproval request to clearinghouse
        // Note: Using eligibility endpoint as proxy for authorization request
        // In production, you would use a dedicated prior authorization endpoint
        const vendorResponse = await optum.verifyEligibility({
          patientId: patient_id,
          payerId: payerResult.rows[0]?.payer_id,
          serviceDate: service_start_date,
          serviceCodes: parsedProcedureCodes.map(code =>
            typeof code === 'string' ? code : code.code
          )
        });

        if (vendorResponse.success) {
          // Update preapproval with clearinghouse information
          await pool.query(`
            UPDATE preapprovals
            SET
              clearinghouse_request_id = $1,
              clearinghouse_status = $2,
              submitted_to_clearinghouse_at = $3,
              clearinghouse_response = $4,
              status = 'Submitted'
            WHERE id = $5
          `, [
            vendorResponse.requestId || preapproval_number,
            vendorResponse.status || 'submitted',
            new Date(),
            JSON.stringify(vendorResponse.response),
            preapproval.id
          ]);

          preapproval.clearinghouse_request_id = vendorResponse.requestId;
          preapproval.clearinghouse_status = vendorResponse.status;
          preapproval.status = 'Submitted';

          // Log transaction
          await vendorIntegrationManager.logTransaction('optum', 'prior_authorization', {
            request: preapprovalData,
            response: vendorResponse.response,
            status: 'success',
            externalId: vendorResponse.requestId,
            internalReferenceId: preapproval.id,
            patientId: patient_id
          });
        } else {
          // Log failed transaction
          await vendorIntegrationManager.logTransaction('optum', 'prior_authorization', {
            request: preapprovalData,
            response: vendorResponse.response,
            status: 'failed',
            error: vendorResponse.error,
            internalReferenceId: preapproval.id,
            patientId: patient_id
          });

          preapproval.clearinghouse_error = vendorResponse.error;
        }
      } catch (vendorError) {
        console.error('Error submitting preapproval to clearinghouse:', vendorError);
        preapproval.clearinghouse_error = vendorError.message;
        // Don't fail the request if clearinghouse submission fails
      }
    }

    res.status(201).json(preapproval);
  } catch (error) {
    console.error('Error creating preapproval:', error);
    res.status(500).json({ error: 'Failed to create preapproval' });
  }
});

// Update preapproval
router.put('/:id', async (req, res) => {
  const {
    status,
    authorization_number,
    approved_by,
    approval_valid_until,
    denied_reason,
    clinical_notes
  } = req.body;

  try {
    const pool = req.app.locals.pool;

    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (status !== undefined) {
      updates.push(`status = $${paramCount}`);
      values.push(status);
      paramCount++;
    }
    if (authorization_number !== undefined) {
      updates.push(`authorization_number = $${paramCount}`);
      values.push(authorization_number);
      paramCount++;
    }
    if (approved_by !== undefined) {
      updates.push(`approved_by = $${paramCount}`, `approved_at = NOW()`);
      values.push(approved_by);
      paramCount++;
    }
    if (approval_valid_until !== undefined) {
      updates.push(`approval_valid_until = $${paramCount}`);
      values.push(approval_valid_until);
      paramCount++;
    }
    if (denied_reason !== undefined) {
      updates.push(`denied_reason = $${paramCount}`);
      values.push(denied_reason);
      paramCount++;
    }
    if (clinical_notes !== undefined) {
      updates.push(`clinical_notes = $${paramCount}`);
      values.push(clinical_notes);
      paramCount++;
    }

    updates.push('updated_at = NOW()');
    values.push(req.params.id);

    const result = await pool.query(
      `UPDATE preapprovals
       SET ${updates.join(', ')}
       WHERE id::text = $${paramCount}::text
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Preapproval not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating preapproval:', error);
    res.status(500).json({ error: 'Failed to update preapproval' });
  }
});

// Delete preapproval
router.delete('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      'DELETE FROM preapprovals WHERE id::text = $1::text RETURNING *',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Preapproval not found' });
    }
    res.json({ message: 'Preapproval deleted successfully' });
  } catch (error) {
    console.error('Error deleting preapproval:', error);
    res.status(500).json({ error: 'Failed to delete preapproval' });
  }
});

module.exports = router;
