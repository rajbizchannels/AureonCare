const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireModuleAccess } = require('../middleware/modulePermissions');
const router = express.Router();
router.use(authenticate);
// Fine-grained permissions, enforced. The method decides the action (GET=view,
// POST=create, PUT/PATCH=edit, DELETE=delete); an administrator edits this under
// Admin Panel -> Roles & Permissions. Absent grants fall back to the role defaults in
// utils/permissionRegistry.js, so this changes nothing until somebody edits something.
router.use(requireModuleAccess('rcm', 'claims'));
router.use(require('../middleware/planEnforcement').enforceActiveBilling); // SEC-05 S11: read-only when subscription past_due/canceled
// SEC-37: vendor clients are per practice — resolved from this request's tenant.
const { vendorsFor } = require('../services/vendorIntegrations');
const notificationService = require('../services/notificationService');
const { insertNumbered } = require('../utils/recordNumbers');
const { sendDbError } = require('../utils/dbErrors');
const scrubber = require('../services/claimScrubber'); // pre-submission checks (rules + AI review)

// ── Pre-submission check ("scrubbing") ──────────────────────────────────────────────────────
// POST /scrub            a claim not saved yet (the claim form, before saving): { ...claim, ai? }
// POST /:id/scrub        a saved claim; the result is stored and gates submission
// POST /:id/scrub/override { reason } — admin / billing manager accept a failed check, recorded
router.post('/scrub', async (req, res) => {
  try {
    const body = req.body || {};
    res.json({ scrub: await scrubber.scrub(req, { ...body, id: body.id || null }, { ai: body.ai !== false }) });
  } catch (error) {
    console.error('Error checking claim:', error);
    res.status(500).json({ error: 'The claim could not be checked.' });
  }
});

router.post('/:id/scrub', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool;
    const { rows: [claim] } = await pool.query('SELECT * FROM claims WHERE id::text = $1::text', [req.params.id]);
    if (!claim) return res.status(404).json({ error: 'Claim not found' });
    const result = await scrubber.scrub(req, { ...claim, payer_id: (req.body && req.body.payer_id) || null }, { ai: !(req.body && req.body.ai === false) });
    await scrubber.record(pool, claim.id, result);
    res.json({ scrub: result });
  } catch (error) {
    console.error('Error checking claim:', error);
    res.status(500).json({ error: 'The claim could not be checked.' });
  }
});

router.post('/:id/scrub/override', async (req, res) => {
  try {
    const role = req.user && req.user.role;
    if (!['admin', 'billing_manager'].includes(role)) return res.status(403).json({ error: 'Only an admin or billing manager can override a failed claim check.' });
    const reason = String((req.body && req.body.reason) || '').trim();
    if (reason.length < 10) return res.status(400).json({ error: 'Give a reason (at least 10 characters) — it is kept with the claim.' });
    const pool = req.db || req.app.locals.pool;
    const { rows: [c] } = await pool.query('SELECT scrub_status, scrubbed_at, updated_at FROM claims WHERE id::text = $1::text', [req.params.id]);
    if (!c) return res.status(404).json({ error: 'Claim not found' });
    if (!c.scrubbed_at || (c.updated_at && new Date(c.updated_at) > new Date(c.scrubbed_at))) {
      return res.status(409).json({ error: 'Check the claim first — it has changed since its last check.' });
    }
    if (c.scrub_status !== 'failed') return res.status(409).json({ error: 'Only a failed check needs an override.' });
    await pool.query('UPDATE claims SET scrub_override_by = $1, scrub_override_reason = $2 WHERE id::text = $3::text',
      [req.user.id, reason.slice(0, 1000), req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error overriding claim check:', error);
    res.status(500).json({ error: 'Could not record the override.' });
  }
});

// Get all claims
router.get('/', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
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
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
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
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request

    const insertClaim = (q, number) => q.query(
      `INSERT INTO claims
       (claim_number, patient_id, payer, amount, status,
        service_date, diagnosis_codes, procedure_codes, notes, preapproval_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
       RETURNING *`,
      [number, patient_id, payer, amount, status || 'pending',
       service_date, diagnosis_codes, procedure_codes, notes, preapproval_id || null]
    );
    // The server numbers new claims (utils/recordNumbers.js explains why the browser no
    // longer does). An explicit number is still honoured, for imports and integrations.
    const result = claim_number
      ? await insertClaim(pool, claim_number)
      : await insertNumbered(pool, { table: 'claims', column: 'claim_number', prefix: 'CLM' }, insertClaim);

    const claim = result.rows[0];

    // Submitting straight away: the claim is checked first (rules; the AI review runs from the
    // claim screen), and a claim with errors is saved but NOT sent.
    let gate = null;
    if (req.body.submitToClearinghouse) {
      const result = await scrubber.scrub(req, { ...claim, payer_id: req.body.payer_id || null }, { ai: false });
      await scrubber.record(pool, claim.id, result);
      claim.scrub = result;
      if (result.status === 'failed') {
        gate = result;
        claim.clearinghouse_error = 'Not submitted: the claim check found errors. Fix them and submit again.';
      }
    }

    // Submit to Optum clearinghouse if enabled and submit_to_clearinghouse is requested
    if (!gate && req.body.submitToClearinghouse && (await vendorsFor(req)).isVendorEnabled('optum')) {
      try {
        // Get patient, provider, and payer details
        // The chart is in `patients` (users holds staff logins) — reading users sent the claim
        // without the patient's details.
        const patientResult = await pool.query(
          'SELECT * FROM patients WHERE id::text = $1::text',
          [patient_id]
        );
        const providerResult = await pool.query(
          'SELECT id, first_name, last_name, email, phone FROM users WHERE id::text = $1::text',
          [req.body.provider_id || (req.user && req.user.id)] // Use provider from request or current user
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

        const optum = (await vendorsFor(req)).getOptum();

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
          await (await vendorsFor(req)).logTransaction('optum', 'claim_submit', {
            request: claimData,
            response: vendorResponse.response,
            status: 'success',
            externalId: vendorResponse.clearinghouseClaimId,
            internalReferenceId: claim.id,
            patientId: patient_id
          });
        } else {
          // Log failed transaction
          await (await vendorsFor(req)).logTransaction('optum', 'claim_submit', {
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

    // Send notifications (non-blocking)
    notificationService.dispatch(pool, 'claim.created', { claim, patient_id }).catch(() => {});
  } catch (error) {
    console.error('Error creating claim:', error);
    // A constraint the request broke is the caller's to fix, not a server fault.
    if (sendDbError(res, error, 'Failed to create claim')) return;
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
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request

    // Marking a claim Submitted needs a clean check of what is being submitted: no changes in
    // the same request, and a check since the last change with no errors (or an override).
    if (status && /^submitted$/i.test(String(status))) {
      const { rows: [cur] } = await pool.query('SELECT status FROM claims WHERE id::text = $1::text', [req.params.id]);
      if (cur && !/^submitted$/i.test(String(cur.status || ''))) {
        const changing = [patient_id, payer, amount, service_date, diagnosis_codes, procedure_codes].some((v) => v !== undefined && v !== null);
        if (changing) return res.status(409).json({ error: 'Save the changes and check the claim before submitting it.', scrubRequired: true });
        const blocked = await scrubber.requireCleanScrub(pool, req.params.id);
        if (blocked) return res.status(blocked.status).json(blocked.body);
      }
    }

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
    const updatedClaim = result.rows[0];
    res.json(updatedClaim);

    // Send status change notification (non-blocking)
    if (status) {
      notificationService.dispatch(pool, 'claim.status_changed', {
        claim: updatedClaim,
        patient_id: updatedClaim.patient_id,
        old_status: 'previous',
      }).catch(() => {});
    }
  } catch (error) {
    console.error('Error updating claim:', error);
    // A constraint the request broke is the caller's to fix, not a server fault.
    if (sendDbError(res, error, 'Failed to update claim')) return;
    res.status(500).json({ error: 'Failed to update claim' });
  }
});

// Delete claim
router.delete('/:id', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
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
    // A constraint the request broke is the caller's to fix, not a server fault.
    if (sendDbError(res, error, 'Failed to delete claim')) return;
    res.status(500).json({ error: 'Failed to delete claim' });
  }
});

module.exports = router;