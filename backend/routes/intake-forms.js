const express = require('express');
const router = express.Router();

// ============================================================================
// PATIENT INTAKE FORMS ROUTES
// ============================================================================

// Get all intake forms
router.get('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { patient_id, status, form_type } = req.query;

    let query = `
      SELECT
        pif.*,
        p.first_name || ' ' || p.last_name as patient_name,
        p.mrn,
        u.first_name || ' ' || u.last_name as reviewed_by_name
      FROM patient_intake_forms pif
      LEFT JOIN patients p ON pif.patient_id = p.id
      LEFT JOIN users u ON pif.reviewed_by = u.id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (patient_id) {
      query += ` AND pif.patient_id = $${paramIndex++}`;
      params.push(patient_id);
    }

    if (status) {
      query += ` AND pif.status = $${paramIndex++}`;
      params.push(status);
    }

    if (form_type) {
      query += ` AND pif.form_type = $${paramIndex++}`;
      params.push(form_type);
    }

    query += ' ORDER BY pif.created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching intake forms:', error);
    res.status(500).json({ error: 'Failed to fetch intake forms' });
  }
});

// Get single intake form
router.get('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      `SELECT
        pif.*,
        p.first_name || ' ' || p.last_name as patient_name,
        p.mrn,
        u.first_name || ' ' || u.last_name as reviewed_by_name
      FROM patient_intake_forms pif
      LEFT JOIN patients p ON pif.patient_id = p.id
      LEFT JOIN users u ON pif.reviewed_by = u.id
      WHERE pif.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Intake form not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching intake form:', error);
    res.status(500).json({ error: 'Failed to fetch intake form' });
  }
});

// Create new intake form
router.post('/', async (req, res) => {
  const {
    patient_id,
    form_type,
    form_name,
    form_data,
    status,
    notes,
    attachments
  } = req.body;

  try {
    const pool = req.app.locals.pool;

    const result = await pool.query(
      `INSERT INTO patient_intake_forms
       (patient_id, form_type, form_name, form_data, status, notes, attachments, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING *`,
      [
        patient_id,
        form_type,
        form_name,
        JSON.stringify(form_data || {}),
        status || 'draft',
        notes,
        JSON.stringify(attachments || [])
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating intake form:', error);
    res.status(500).json({ error: 'Failed to create intake form' });
  }
});

// Update intake form
router.put('/:id', async (req, res) => {
  const {
    form_type,
    form_name,
    form_data,
    status,
    reviewed_by,
    notes,
    attachments
  } = req.body;

  try {
    const pool = req.app.locals.pool;

    // Build dynamic update query
    const updateFields = [];
    const params = [];
    let paramIndex = 1;

    if (form_type !== undefined) {
      updateFields.push(`form_type = $${paramIndex++}`);
      params.push(form_type);
    }

    if (form_name !== undefined) {
      updateFields.push(`form_name = $${paramIndex++}`);
      params.push(form_name);
    }

    if (form_data !== undefined) {
      updateFields.push(`form_data = $${paramIndex++}`);
      params.push(JSON.stringify(form_data));
    }

    if (status !== undefined) {
      updateFields.push(`status = $${paramIndex++}`);
      params.push(status);

      // Auto-set submitted_at or reviewed_at based on status
      if (status === 'submitted') {
        updateFields.push(`submitted_at = NOW()`);
      } else if (status === 'reviewed' || status === 'approved' || status === 'rejected') {
        updateFields.push(`reviewed_at = NOW()`);
      }
    }

    if (reviewed_by !== undefined) {
      updateFields.push(`reviewed_by = $${paramIndex++}`);
      params.push(reviewed_by);
    }

    if (notes !== undefined) {
      updateFields.push(`notes = $${paramIndex++}`);
      params.push(notes);
    }

    if (attachments !== undefined) {
      updateFields.push(`attachments = $${paramIndex++}`);
      params.push(JSON.stringify(attachments));
    }

    updateFields.push(`updated_at = NOW()`);
    params.push(req.params.id);

    const result = await pool.query(
      `UPDATE patient_intake_forms
       SET ${updateFields.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Intake form not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating intake form:', error);
    res.status(500).json({ error: 'Failed to update intake form' });
  }
});

// Delete intake form
router.delete('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      'DELETE FROM patient_intake_forms WHERE id = $1 RETURNING *',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Intake form not found' });
    }

    res.json({ message: 'Intake form deleted successfully' });
  } catch (error) {
    console.error('Error deleting intake form:', error);
    res.status(500).json({ error: 'Failed to delete intake form' });
  }
});

// ============================================================================
// PATIENT INTAKE FLOWS ROUTES
// ============================================================================

// Get all intake flows
router.get('/flows', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { patient_id, status, flow_type } = req.query;

    let query = `
      SELECT
        pif.*,
        p.first_name || ' ' || p.last_name as patient_name,
        p.mrn
      FROM patient_intake_flows pif
      LEFT JOIN patients p ON pif.patient_id = p.id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (patient_id) {
      query += ` AND pif.patient_id = $${paramIndex++}`;
      params.push(patient_id);
    }

    if (status) {
      query += ` AND pif.status = $${paramIndex++}`;
      params.push(status);
    }

    if (flow_type) {
      query += ` AND pif.flow_type = $${paramIndex++}`;
      params.push(flow_type);
    }

    query += ' ORDER BY pif.created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching intake flows:', error);
    res.status(500).json({ error: 'Failed to fetch intake flows' });
  }
});

// Get single intake flow
router.get('/flows/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      `SELECT
        pif.*,
        p.first_name || ' ' || p.last_name as patient_name,
        p.mrn
      FROM patient_intake_flows pif
      LEFT JOIN patients p ON pif.patient_id = p.id
      WHERE pif.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Intake flow not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching intake flow:', error);
    res.status(500).json({ error: 'Failed to fetch intake flow' });
  }
});

// Create new intake flow
router.post('/flows', async (req, res) => {
  const {
    patient_id,
    flow_name,
    flow_type,
    total_steps,
    current_step,
    step_data,
    expires_at,
    notes
  } = req.body;

  try {
    const pool = req.app.locals.pool;

    const result = await pool.query(
      `INSERT INTO patient_intake_flows
       (patient_id, flow_name, flow_type, total_steps, current_step, step_data, expires_at, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
       RETURNING *`,
      [
        patient_id,
        flow_name,
        flow_type,
        total_steps,
        current_step || 1,
        JSON.stringify(step_data || {}),
        expires_at,
        notes
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating intake flow:', error);
    res.status(500).json({ error: 'Failed to create intake flow' });
  }
});

// Update intake flow
router.put('/flows/:id', async (req, res) => {
  const {
    current_step,
    steps_completed,
    step_data,
    status,
    notes
  } = req.body;

  try {
    const pool = req.app.locals.pool;

    const updateFields = [];
    const params = [];
    let paramIndex = 1;

    if (current_step !== undefined) {
      updateFields.push(`current_step = $${paramIndex++}`);
      params.push(current_step);
    }

    if (steps_completed !== undefined) {
      updateFields.push(`steps_completed = $${paramIndex++}`);
      params.push(JSON.stringify(steps_completed));
    }

    if (step_data !== undefined) {
      updateFields.push(`step_data = $${paramIndex++}`);
      params.push(JSON.stringify(step_data));
    }

    if (status !== undefined) {
      updateFields.push(`status = $${paramIndex++}`);
      params.push(status);

      if (status === 'completed') {
        updateFields.push(`completed_at = NOW()`);
      }
    }

    if (notes !== undefined) {
      updateFields.push(`notes = $${paramIndex++}`);
      params.push(notes);
    }

    updateFields.push(`updated_at = NOW()`);
    params.push(req.params.id);

    const result = await pool.query(
      `UPDATE patient_intake_flows
       SET ${updateFields.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Intake flow not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating intake flow:', error);
    res.status(500).json({ error: 'Failed to update intake flow' });
  }
});

// Delete intake flow
router.delete('/flows/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      'DELETE FROM patient_intake_flows WHERE id = $1 RETURNING *',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Intake flow not found' });
    }

    res.json({ message: 'Intake flow deleted successfully' });
  } catch (error) {
    console.error('Error deleting intake flow:', error);
    res.status(500).json({ error: 'Failed to delete intake flow' });
  }
});

// ============================================================================
// PATIENT CONSENT FORMS ROUTES
// ============================================================================

// Get all consent forms
router.get('/consents', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { patient_id, status, consent_type } = req.query;

    let query = `
      SELECT
        pcf.*,
        p.first_name || ' ' || p.last_name as patient_name,
        p.mrn
      FROM patient_consent_forms pcf
      LEFT JOIN patients p ON pcf.patient_id = p.id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (patient_id) {
      query += ` AND pcf.patient_id = $${paramIndex++}`;
      params.push(patient_id);
    }

    if (status) {
      query += ` AND pcf.status = $${paramIndex++}`;
      params.push(status);
    }

    if (consent_type) {
      query += ` AND pcf.consent_type = $${paramIndex++}`;
      params.push(consent_type);
    }

    query += ' ORDER BY pcf.created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching consent forms:', error);
    res.status(500).json({ error: 'Failed to fetch consent forms' });
  }
});

// Get single consent form
router.get('/consents/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      `SELECT
        pcf.*,
        p.first_name || ' ' || p.last_name as patient_name,
        p.mrn
      FROM patient_consent_forms pcf
      LEFT JOIN patients p ON pcf.patient_id = p.id
      WHERE pcf.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Consent form not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching consent form:', error);
    res.status(500).json({ error: 'Failed to fetch consent form' });
  }
});

// Create new consent form
router.post('/consents', async (req, res) => {
  const {
    patient_id,
    consent_type,
    consent_title,
    consent_description,
    consent_content,
    version,
    expires_at,
    parent_guardian_name,
    parent_guardian_relation,
    metadata
  } = req.body;

  try {
    const pool = req.app.locals.pool;

    const result = await pool.query(
      `INSERT INTO patient_consent_forms
       (patient_id, consent_type, consent_title, consent_description, consent_content,
        version, expires_at, parent_guardian_name, parent_guardian_relation, metadata, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
       RETURNING *`,
      [
        patient_id,
        consent_type,
        consent_title,
        consent_description,
        consent_content,
        version || '1.0',
        expires_at,
        parent_guardian_name,
        parent_guardian_relation,
        JSON.stringify(metadata || {})
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating consent form:', error);
    res.status(500).json({ error: 'Failed to create consent form' });
  }
});

// Update consent form (including signature)
router.put('/consents/:id', async (req, res) => {
  const {
    status,
    signature_data,
    signature_method,
    witness_name,
    witness_signature,
    ip_address,
    user_agent,
    revocation_reason,
    metadata
  } = req.body;

  try {
    const pool = req.app.locals.pool;

    const updateFields = [];
    const params = [];
    let paramIndex = 1;

    if (status !== undefined) {
      updateFields.push(`status = $${paramIndex++}`);
      params.push(status);

      if (status === 'signed') {
        updateFields.push(`signed_at = NOW()`);
      } else if (status === 'revoked') {
        updateFields.push(`revoked_at = NOW()`);
      }
    }

    if (signature_data !== undefined) {
      updateFields.push(`signature_data = $${paramIndex++}`);
      params.push(signature_data);
    }

    if (signature_method !== undefined) {
      updateFields.push(`signature_method = $${paramIndex++}`);
      params.push(signature_method);
    }

    if (witness_name !== undefined) {
      updateFields.push(`witness_name = $${paramIndex++}`);
      params.push(witness_name);
    }

    if (witness_signature !== undefined) {
      updateFields.push(`witness_signature = $${paramIndex++}`);
      params.push(witness_signature);
    }

    if (ip_address !== undefined) {
      updateFields.push(`ip_address = $${paramIndex++}`);
      params.push(ip_address);
    }

    if (user_agent !== undefined) {
      updateFields.push(`user_agent = $${paramIndex++}`);
      params.push(user_agent);
    }

    if (revocation_reason !== undefined) {
      updateFields.push(`revocation_reason = $${paramIndex++}`);
      params.push(revocation_reason);
    }

    if (metadata !== undefined) {
      updateFields.push(`metadata = $${paramIndex++}`);
      params.push(JSON.stringify(metadata));
    }

    updateFields.push(`updated_at = NOW()`);
    params.push(req.params.id);

    const result = await pool.query(
      `UPDATE patient_consent_forms
       SET ${updateFields.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Consent form not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating consent form:', error);
    res.status(500).json({ error: 'Failed to update consent form' });
  }
});

// Delete consent form
router.delete('/consents/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      'DELETE FROM patient_consent_forms WHERE id = $1 RETURNING *',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Consent form not found' });
    }

    res.json({ message: 'Consent form deleted successfully' });
  } catch (error) {
    console.error('Error deleting consent form:', error);
    res.status(500).json({ error: 'Failed to delete consent form' });
  }
});

module.exports = router;
