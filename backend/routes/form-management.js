const express = require('express');
const { authenticate } = require('../middleware/auth');
const { loadAttachment, sendAttachment } = require('../utils/filedDocuments');
const router = express.Router();
router.use(authenticate);
router.use(require('../middleware/planEnforcement').enforceActiveBilling); // SEC-05 S11: read-only when subscription past_due/canceled

// ============================================================================
// HELPER: Run SQL to init tables if they don't exist
// ============================================================================
// SEC-05: schema creation moved to migrations/tenant/001_adopt_runtime_created_tables.sql.
// Creating tables at request time made an empty copy inside the caller's tenant schema
// (hiding the real data) and required DDL privileges the app should not hold. Kept as a
// no-op so existing call sites are unchanged; run the migrations to provision the tables.
async function ensureTables(_pool) { /* no-op: see migrations */ }

// ============================================================================
// AUDIT HELPER
// ============================================================================
async function logAudit(pool, { resourceType, resourceId, action, actorId, actorRole, actorName, patientId, previousState, newState, changeDetails, ipAddress, userAgent, notes }) {
  try {
    await pool.query(
      `INSERT INTO form_audit_logs
       (resource_type, resource_id, action, actor_id, actor_role, actor_name, patient_id,
        previous_state, new_state, change_details, ip_address, user_agent, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        resourceType, resourceId, action, actorId || null, actorRole || null, actorName || null,
        patientId || null,
        previousState ? JSON.stringify(previousState) : null,
        newState ? JSON.stringify(newState) : null,
        changeDetails ? JSON.stringify(changeDetails) : null,
        ipAddress || null, userAgent || null, notes || null
      ]
    );
  } catch (err) {
    console.error('Form audit log error:', err.message);
  }
}

// ============================================================================
// CATEGORIES
// ============================================================================

router.get('/categories', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    await ensureTables(pool);
    const result = await pool.query('SELECT * FROM form_categories WHERE is_active = true ORDER BY sort_order, name');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching form categories:', error);
    res.status(500).json({ error: 'Failed to fetch form categories' });
  }
});

router.post('/categories', async (req, res) => {
  const { name, slug, description, color, icon, parent_id, sort_order } = req.body;
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    await ensureTables(pool);
    const result = await pool.query(
      `INSERT INTO form_categories (name, slug, description, color, icon, parent_id, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [name, slug, description, color, icon, parent_id || null, sort_order || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating form category:', error);
    res.status(500).json({ error: 'Failed to create form category' });
  }
});

// ============================================================================
// FORM TEMPLATES
// ============================================================================

// List templates
router.get('/templates', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    await ensureTables(pool);
    const { category, template_type, specialty, is_active, search, intake_flow_eligible, role } = req.query;

    let query = `
      SELECT
        ft.*,
        fc.name as category_name,
        fc.color as category_color,
        fc.icon as category_icon
      FROM form_templates ft
      LEFT JOIN form_categories fc ON ft.category_id = fc.id
      WHERE 1=1
    `;
    const params = [];
    let p = 1;

    if (is_active !== undefined) {
      query += ` AND ft.is_active = $${p++}`;
      params.push(is_active === 'false' ? false : true);
    }
    if (category) {
      query += ` AND ft.category_slug = $${p++}`;
      params.push(category);
    }
    if (template_type) {
      query += ` AND ft.template_type = $${p++}`;
      params.push(template_type);
    }
    if (specialty) {
      query += ` AND ft.specialty = $${p++}`;
      params.push(specialty);
    }
    if (intake_flow_eligible !== undefined) {
      query += ` AND ft.intake_flow_eligible = $${p++}`;
      params.push(intake_flow_eligible === 'false' ? false : true);
    }
    if (search) {
      query += ` AND (ft.name ILIKE $${p} OR ft.description ILIKE $${p})`;
      params.push(`%${search}%`);
      p++;
    }
    if (role) {
      query += ` AND ft.role_visibility @> $${p++}::jsonb`;
      params.push(JSON.stringify([role]));
    }

    query += ' ORDER BY ft.template_type, ft.name';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching form templates:', error);
    res.status(500).json({ error: 'Failed to fetch form templates' });
  }
});

// Get single template
router.get('/templates/:id', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    await ensureTables(pool);
    const result = await pool.query(
      `SELECT ft.*, fc.name as category_name
       FROM form_templates ft
       LEFT JOIN form_categories fc ON ft.category_id = fc.id
       WHERE ft.id = $1 OR ft.slug = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Template not found' });

    const actorId = req.headers['x-user-id'];
    const actorRole = req.headers['x-user-role'];
    await logAudit(pool, { resourceType: 'template', resourceId: result.rows[0].id, action: 'viewed', actorId, actorRole });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching form template:', error);
    res.status(500).json({ error: 'Failed to fetch form template' });
  }
});

// Create template
router.post('/templates', async (req, res) => {
  const {
    name, slug, description, category_id, category_slug, subcategory, template_type,
    fields, settings, fhir_questionnaire, role_visibility, require_signature, require_witness,
    allow_pdf_export, languages, translations, tags, intake_flow_eligible, specialty,
    compliance_tags, is_system_template
  } = req.body;
  const actorId = req.headers['x-user-id'];
  const actorRole = req.headers['x-user-role'];

  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    await ensureTables(pool);

    const result = await pool.query(
      `INSERT INTO form_templates
       (name, slug, description, category_id, category_slug, subcategory, template_type,
        fields, settings, fhir_questionnaire, role_visibility, require_signature, require_witness,
        allow_pdf_export, languages, translations, tags, intake_flow_eligible, specialty,
        compliance_tags, is_system_template, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$22)
       RETURNING *`,
      [
        name, slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        description, category_id || null, category_slug, subcategory, template_type,
        JSON.stringify(fields || []), JSON.stringify(settings || {}),
        fhir_questionnaire ? JSON.stringify(fhir_questionnaire) : null,
        JSON.stringify(role_visibility || ['admin', 'provider', 'staff', 'patient']),
        require_signature || false, require_witness || false, allow_pdf_export !== false,
        JSON.stringify(languages || ['en']), JSON.stringify(translations || {}),
        JSON.stringify(tags || []), intake_flow_eligible !== false,
        specialty || null, JSON.stringify(compliance_tags || []),
        is_system_template || false, actorId || null
      ]
    );
    const template = result.rows[0];

    // Create initial version
    await pool.query(
      `INSERT INTO form_template_versions
       (template_id, version, version_number, fields, settings, fhir_questionnaire, change_summary, changed_by, is_published, published_at)
       VALUES ($1,'1.0',1,$2,$3,$4,'Initial version',$5,true,NOW())`,
      [template.id, JSON.stringify(fields || []), JSON.stringify(settings || {}),
       fhir_questionnaire ? JSON.stringify(fhir_questionnaire) : null, actorId || null]
    );

    await logAudit(pool, { resourceType: 'template', resourceId: template.id, action: 'created', actorId, actorRole, newState: template });
    res.status(201).json(template);
  } catch (error) {
    console.error('Error creating form template:', error);
    res.status(500).json({ error: 'Failed to create form template' });
  }
});

// Update template
router.put('/templates/:id', async (req, res) => {
  const {
    name, description, category_id, category_slug, subcategory, template_type,
    fields, settings, fhir_questionnaire, role_visibility, require_signature, require_witness,
    allow_pdf_export, languages, translations, tags, intake_flow_eligible, specialty,
    compliance_tags, is_active, change_summary
  } = req.body;
  const actorId = req.headers['x-user-id'];
  const actorRole = req.headers['x-user-role'];

  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    await ensureTables(pool);

    // Get previous state for audit
    const prev = await pool.query('SELECT * FROM form_templates WHERE id = $1', [req.params.id]);
    if (prev.rows.length === 0) return res.status(404).json({ error: 'Template not found' });
    const previous = prev.rows[0];

    const updateFields = [];
    const params = [];
    let pi = 1;

    const setField = (col, val, transform) => {
      if (val !== undefined) {
        updateFields.push(`${col} = $${pi++}`);
        params.push(transform ? transform(val) : val);
      }
    };

    setField('name', name);
    setField('description', description);
    setField('category_id', category_id);
    setField('category_slug', category_slug);
    setField('subcategory', subcategory);
    setField('template_type', template_type);
    setField('fields', fields, JSON.stringify);
    setField('settings', settings, JSON.stringify);
    setField('fhir_questionnaire', fhir_questionnaire, JSON.stringify);
    setField('role_visibility', role_visibility, JSON.stringify);
    setField('require_signature', require_signature);
    setField('require_witness', require_witness);
    setField('allow_pdf_export', allow_pdf_export);
    setField('languages', languages, JSON.stringify);
    setField('translations', translations, JSON.stringify);
    setField('tags', tags, JSON.stringify);
    setField('intake_flow_eligible', intake_flow_eligible);
    setField('specialty', specialty);
    setField('compliance_tags', compliance_tags, JSON.stringify);
    setField('is_active', is_active);

    if (fields !== undefined) {
      // Increment version when fields change
      updateFields.push(`version_number = version_number + 1`);
      const newVersionNum = previous.version_number + 1;
      const newVersion = `${Math.floor(newVersionNum / 10)}.${newVersionNum % 10}`;
      updateFields.push(`version = $${pi++}`);
      params.push(newVersion);

      // Save new version
      await pool.query(
        `INSERT INTO form_template_versions
         (template_id, version, version_number, fields, settings, fhir_questionnaire, change_summary, changed_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [req.params.id, newVersion, newVersionNum,
         JSON.stringify(fields), JSON.stringify(settings || previous.settings),
         fhir_questionnaire ? JSON.stringify(fhir_questionnaire) : null,
         change_summary || 'Updated', actorId || null]
      );
    }

    updateFields.push(`updated_by = $${pi++}`);
    params.push(actorId || null);
    updateFields.push(`updated_at = NOW()`);
    params.push(req.params.id);

    const result = await pool.query(
      `UPDATE form_templates SET ${updateFields.join(', ')} WHERE id = $${pi} RETURNING *`,
      params
    );
    const updated = result.rows[0];

    await logAudit(pool, { resourceType: 'template', resourceId: updated.id, action: 'updated', actorId, actorRole, previousState: previous, newState: updated, changeDetails: { change_summary } });
    res.json(updated);
  } catch (error) {
    console.error('Error updating form template:', error);
    res.status(500).json({ error: 'Failed to update form template' });
  }
});

// Delete template
router.delete('/templates/:id', async (req, res) => {
  const actorId = req.headers['x-user-id'];
  const actorRole = req.headers['x-user-role'];
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    await ensureTables(pool);
    const prev = await pool.query('SELECT * FROM form_templates WHERE id = $1', [req.params.id]);
    if (prev.rows.length === 0) return res.status(404).json({ error: 'Template not found' });
    if (prev.rows[0].is_system_template) return res.status(403).json({ error: 'System templates cannot be deleted' });

    await pool.query('DELETE FROM form_templates WHERE id = $1', [req.params.id]);
    await logAudit(pool, { resourceType: 'template', resourceId: req.params.id, action: 'deleted', actorId, actorRole, previousState: prev.rows[0] });
    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Error deleting form template:', error);
    res.status(500).json({ error: 'Failed to delete form template' });
  }
});

// ============================================================================
// TEMPLATE VERSIONS
// ============================================================================

router.get('/templates/:id/versions', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    await ensureTables(pool);
    const result = await pool.query(
      `SELECT ftv.*, u.first_name || ' ' || u.last_name as changed_by_name
       FROM form_template_versions ftv
       LEFT JOIN users u ON ftv.changed_by = u.id
       WHERE ftv.template_id = $1
       ORDER BY ftv.version_number DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching template versions:', error);
    res.status(500).json({ error: 'Failed to fetch template versions' });
  }
});

// Restore a specific version
router.post('/templates/:id/versions/:versionId/restore', async (req, res) => {
  const actorId = req.headers['x-user-id'];
  const actorRole = req.headers['x-user-role'];
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    await ensureTables(pool);

    const versionResult = await pool.query('SELECT * FROM form_template_versions WHERE id = $1 AND template_id = $2', [req.params.versionId, req.params.id]);
    if (versionResult.rows.length === 0) return res.status(404).json({ error: 'Version not found' });
    const version = versionResult.rows[0];

    const prev = await pool.query('SELECT * FROM form_templates WHERE id = $1', [req.params.id]);
    const previous = prev.rows[0];
    const newVersionNum = previous.version_number + 1;

    const result = await pool.query(
      `UPDATE form_templates SET fields=$1, settings=$2, fhir_questionnaire=$3, version_number=$4, version=$5, updated_at=NOW()
       WHERE id=$6 RETURNING *`,
      [version.fields, version.settings, version.fhir_questionnaire, newVersionNum,
       `${Math.floor(newVersionNum/10)}.${newVersionNum%10}`, req.params.id]
    );

    await pool.query(
      `INSERT INTO form_template_versions (template_id,version,version_number,fields,settings,fhir_questionnaire,change_summary,changed_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [req.params.id, result.rows[0].version, newVersionNum, version.fields, version.settings, version.fhir_questionnaire,
       `Restored from version ${version.version}`, actorId || null]
    );

    await logAudit(pool, { resourceType: 'template', resourceId: req.params.id, action: 'version_restored', actorId, actorRole, changeDetails: { restored_from: version.version } });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error restoring template version:', error);
    res.status(500).json({ error: 'Failed to restore template version' });
  }
});

// ============================================================================
// FORM SUBMISSIONS
// ============================================================================

router.get('/submissions', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    await ensureTables(pool);
    const { patient_id, template_id, status, appointment_id, intake_flow_id } = req.query;

    let query = `
      SELECT
        fs.*,
        ft.name as template_name_ref,
        ft.template_type,
        ft.category_slug,
        p.first_name || ' ' || p.last_name as patient_name,
        p.mrn,
        u.first_name || ' ' || u.last_name as submitted_by_name,
        r.first_name || ' ' || r.last_name as reviewed_by_name
      FROM form_submissions fs
      LEFT JOIN form_templates ft ON fs.template_id = ft.id
      LEFT JOIN patients p ON fs.patient_id = p.id
      LEFT JOIN users u ON fs.submitted_by = u.id
      LEFT JOIN users r ON fs.reviewed_by = r.id
      WHERE 1=1
    `;
    const params = [];
    let pi = 1;

    if (patient_id) { query += ` AND fs.patient_id = $${pi++}`; params.push(patient_id); }
    if (template_id) { query += ` AND fs.template_id = $${pi++}`; params.push(template_id); }
    if (status) { query += ` AND fs.status = $${pi++}`; params.push(status); }
    if (appointment_id) { query += ` AND fs.appointment_id = $${pi++}`; params.push(appointment_id); }
    if (intake_flow_id) { query += ` AND fs.intake_flow_id = $${pi++}`; params.push(intake_flow_id); }

    query += ' ORDER BY fs.created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching form submissions:', error);
    res.status(500).json({ error: 'Failed to fetch form submissions' });
  }
});

/**
 * GET /api/form-management/submissions/:id/document
 *
 * Serves the document behind a document-backed request (one created from a
 * secure message rather than a template). Authorises on the submission.
 */
router.get('/submissions/:id/document', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const result = await pool.query(
      'SELECT id, patient_id, document_attachment_id FROM form_submissions WHERE id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    const submission = result.rows[0];

    if (req.user.role === 'patient' && String(submission.patient_id) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!submission.document_attachment_id) {
      return res.status(404).json({ error: 'This request is not backed by a document' });
    }

    const attachment = await loadAttachment(pool, submission.document_attachment_id);
    if (!attachment) {
      return res.status(404).json({ error: 'Document no longer available' });
    }
    if (!sendAttachment(res, attachment)) {
      return res.status(500).json({ error: 'Document could not be decrypted' });
    }
  } catch (error) {
    console.error('Error downloading request document:', error);
    res.status(500).json({ error: 'Failed to download document' });
  }
});

/**
 * POST /api/form-management/submissions/:id/acknowledge
 *
 * Completes a document-backed request. Separate from the template submission
 * path because there are no field values to record — the patient is confirming
 * they have read the document, and (when document_action is 'sign') that they
 * are signing it.
 */
router.post('/submissions/:id/acknowledge', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const result = await pool.query(
      'SELECT * FROM form_submissions WHERE id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    const submission = result.rows[0];

    // Only the patient the request was addressed to can complete it.
    if (String(submission.patient_id) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Only the patient can complete this request' });
    }
    if (!submission.document_attachment_id) {
      return res.status(400).json({ error: 'This request is not backed by a document' });
    }
    if (submission.status !== 'draft') {
      return res.json({ success: true, alreadyCompleted: true });
    }

    const updated = await pool.query(
      `UPDATE form_submissions
          SET status = 'submitted',
              submitted_at = CURRENT_TIMESTAMP,
              submitted_by = $1,
              submitted_by_role = 'patient',
              ip_address = $2,
              user_agent = $3,
              updated_at = NOW()
        WHERE id = $4
        RETURNING *`,
      [req.user.id, req.ip, req.get('user-agent'), req.params.id]
    );

    res.json({ success: true, submission: updated.rows[0] });
  } catch (error) {
    console.error('Error acknowledging document request:', error);
    res.status(500).json({ error: 'Failed to complete request' });
  }
});

router.get('/submissions/:id', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    await ensureTables(pool);
    const result = await pool.query(
      `SELECT
        fs.*,
        ft.name as template_name_ref, ft.fields as template_fields, ft.settings as template_settings,
        ft.require_signature, ft.require_witness, ft.fhir_questionnaire,
        p.first_name || ' ' || p.last_name as patient_name, p.mrn,
        u.first_name || ' ' || u.last_name as submitted_by_name
       FROM form_submissions fs
       LEFT JOIN form_templates ft ON fs.template_id = ft.id
       LEFT JOIN patients p ON fs.patient_id = p.id
       LEFT JOIN users u ON fs.submitted_by = u.id
       WHERE fs.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Submission not found' });

    // Fetch signatures
    const sigs = await pool.query('SELECT * FROM form_signatures WHERE submission_id = $1 ORDER BY signed_at', [req.params.id]);

    const actorId = req.headers['x-user-id'];
    const actorRole = req.headers['x-user-role'];
    await logAudit(pool, { resourceType: 'submission', resourceId: req.params.id, action: 'viewed', actorId, actorRole, patientId: result.rows[0].patient_id });

    res.json({ ...result.rows[0], signatures: sigs.rows });
  } catch (error) {
    console.error('Error fetching form submission:', error);
    res.status(500).json({ error: 'Failed to fetch form submission' });
  }
});

router.post('/submissions', async (req, res) => {
  const {
    template_id, template_name, template_version, patient_id, appointment_id, intake_flow_id,
    form_data, status, language, expires_at, metadata
  } = req.body;
  const actorId = req.headers['x-user-id'];
  const actorRole = req.headers['x-user-role'];

  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    await ensureTables(pool);

    // Build FHIR QuestionnaireResponse if template has FHIR mapping
    let fhirResponse = null;
    if (template_id) {
      const tmpl = await pool.query('SELECT fhir_questionnaire, name FROM form_templates WHERE id = $1', [template_id]);
      if (tmpl.rows.length > 0 && tmpl.rows[0].fhir_questionnaire && form_data) {
        fhirResponse = buildFhirResponse(tmpl.rows[0].fhir_questionnaire, form_data, patient_id);
      }
    }

    const result = await pool.query(
      `INSERT INTO form_submissions
       (template_id, template_name, template_version, patient_id, appointment_id, intake_flow_id,
        submitted_by, submitted_by_role, form_data, status, language, expires_at, metadata, fhir_response,
        submitted_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
               CASE WHEN $10 = 'submitted' THEN NOW() ELSE NULL END)
       RETURNING *`,
      [template_id || null, template_name, template_version || '1.0',
       patient_id || null, appointment_id || null, intake_flow_id || null,
       actorId || null, actorRole || null, JSON.stringify(form_data || {}),
       status || 'draft', language || 'en', expires_at || null,
       JSON.stringify(metadata || {}), fhirResponse ? JSON.stringify(fhirResponse) : null]
    );
    const submission = result.rows[0];

    await logAudit(pool, { resourceType: 'submission', resourceId: submission.id, action: 'created', actorId, actorRole, patientId: patient_id, newState: { status: submission.status, template_name } });
    res.status(201).json(submission);
  } catch (error) {
    console.error('Error creating form submission:', error);
    res.status(500).json({ error: 'Failed to create form submission' });
  }
});

router.put('/submissions/:id', async (req, res) => {
  const { form_data, status, reviewed_by, reviewer_notes, language, metadata } = req.body;
  const actorId = req.headers['x-user-id'];
  const actorRole = req.headers['x-user-role'];

  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    await ensureTables(pool);

    const prev = await pool.query('SELECT * FROM form_submissions WHERE id = $1', [req.params.id]);
    if (prev.rows.length === 0) return res.status(404).json({ error: 'Submission not found' });
    const previous = prev.rows[0];

    const updateFields = [];
    const params = [];
    let pi = 1;

    if (form_data !== undefined) { updateFields.push(`form_data = $${pi++}`); params.push(JSON.stringify(form_data)); }
    if (status !== undefined) {
      updateFields.push(`status = $${pi++}`); params.push(status);
      if (status === 'submitted') updateFields.push('submitted_at = NOW()');
      if (status === 'reviewed' || status === 'approved' || status === 'rejected') updateFields.push('reviewed_at = NOW()');
    }
    if (reviewed_by !== undefined) { updateFields.push(`reviewed_by = $${pi++}`); params.push(reviewed_by); }
    if (reviewer_notes !== undefined) { updateFields.push(`reviewer_notes = $${pi++}`); params.push(reviewer_notes); }
    if (language !== undefined) { updateFields.push(`language = $${pi++}`); params.push(language); }
    if (metadata !== undefined) { updateFields.push(`metadata = $${pi++}`); params.push(JSON.stringify(metadata)); }

    updateFields.push('updated_at = NOW()');
    params.push(req.params.id);

    const result = await pool.query(
      `UPDATE form_submissions SET ${updateFields.join(', ')} WHERE id = $${pi} RETURNING *`,
      params
    );
    const updated = result.rows[0];

    await logAudit(pool, { resourceType: 'submission', resourceId: updated.id, action: status ? `status_changed_to_${status}` : 'updated', actorId, actorRole, patientId: updated.patient_id, previousState: { status: previous.status }, newState: { status: updated.status } });
    res.json(updated);
  } catch (error) {
    console.error('Error updating form submission:', error);
    res.status(500).json({ error: 'Failed to update form submission' });
  }
});

router.delete('/submissions/:id', async (req, res) => {
  const actorId = req.headers['x-user-id'];
  const actorRole = req.headers['x-user-role'];
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    await ensureTables(pool);
    const prev = await pool.query('SELECT * FROM form_submissions WHERE id = $1', [req.params.id]);
    if (prev.rows.length === 0) return res.status(404).json({ error: 'Submission not found' });

    await pool.query('DELETE FROM form_submissions WHERE id = $1', [req.params.id]);
    await logAudit(pool, { resourceType: 'submission', resourceId: req.params.id, action: 'deleted', actorId, actorRole, patientId: prev.rows[0].patient_id });
    res.json({ message: 'Submission deleted successfully' });
  } catch (error) {
    console.error('Error deleting form submission:', error);
    res.status(500).json({ error: 'Failed to delete form submission' });
  }
});

// ============================================================================
// SIGNATURES (eSignature)
// ============================================================================

router.post('/submissions/:id/sign', async (req, res) => {
  const { signer_name, signer_role, relation, signature_data, signature_type, is_witness, ip_address, user_agent } = req.body;
  const actorId = req.headers['x-user-id'];
  const actorRole = req.headers['x-user-role'];

  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    await ensureTables(pool);

    const subResult = await pool.query('SELECT * FROM form_submissions WHERE id = $1', [req.params.id]);
    if (subResult.rows.length === 0) return res.status(404).json({ error: 'Submission not found' });

    const sig = await pool.query(
      `INSERT INTO form_signatures
       (submission_id, signer_name, signer_role, signer_user_id, signature_data, signature_type, is_witness, relation, ip_address, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [req.params.id, signer_name, signer_role || actorRole, actorId || null,
       signature_data, signature_type || 'drawn', is_witness || false, relation || null,
       ip_address || null, user_agent || null]
    );

    // Mark submission as signed
    await pool.query('UPDATE form_submissions SET is_signed=true, updated_at=NOW() WHERE id=$1', [req.params.id]);

    await logAudit(pool, { resourceType: 'submission', resourceId: req.params.id, action: 'signed', actorId, actorRole, patientId: subResult.rows[0].patient_id, changeDetails: { signer_name, signer_role, signature_type } });
    res.status(201).json(sig.rows[0]);
  } catch (error) {
    console.error('Error adding signature:', error);
    res.status(500).json({ error: 'Failed to add signature' });
  }
});

router.get('/submissions/:id/signatures', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    await ensureTables(pool);
    const result = await pool.query('SELECT * FROM form_signatures WHERE submission_id = $1 ORDER BY signed_at', [req.params.id]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching signatures:', error);
    res.status(500).json({ error: 'Failed to fetch signatures' });
  }
});

// ============================================================================
// AUDIT LOGS
// ============================================================================

router.get('/audit-logs', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    await ensureTables(pool);
    const { resource_type, resource_id, patient_id, actor_id, action, limit = 100 } = req.query;

    let query = 'SELECT * FROM form_audit_logs WHERE 1=1';
    const params = [];
    let pi = 1;

    if (resource_type) { query += ` AND resource_type = $${pi++}`; params.push(resource_type); }
    if (resource_id) { query += ` AND resource_id = $${pi++}`; params.push(resource_id); }
    if (patient_id) { query += ` AND patient_id = $${pi++}`; params.push(patient_id); }
    if (actor_id) { query += ` AND actor_id = $${pi++}`; params.push(actor_id); }
    if (action) { query += ` AND action = $${pi++}`; params.push(action); }

    query += ` ORDER BY created_at DESC LIMIT $${pi}`;
    params.push(parseInt(limit, 10));

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching form audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch form audit logs' });
  }
});

// ============================================================================
// INTAKE FLOW INTEGRATION
// ============================================================================

// Get templates assigned to a flow
router.get('/intake-flows/:flowId/templates', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    await ensureTables(pool);
    const result = await pool.query(
      `SELECT ift.*, ft.name as template_name, ft.description, ft.template_type, ft.category_slug,
              ft.fields, ft.settings, ft.require_signature, ft.fhir_questionnaire
       FROM intake_flow_templates ift
       JOIN form_templates ft ON ift.template_id = ft.id
       WHERE ift.flow_id = $1
       ORDER BY ift.step_order`,
      [req.params.flowId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching flow templates:', error);
    res.status(500).json({ error: 'Failed to fetch flow templates' });
  }
});

// Assign templates to a flow
router.post('/intake-flows/:flowId/templates', async (req, res) => {
  const { template_ids, template_assignments } = req.body;
  const actorId = req.headers['x-user-id'];
  const actorRole = req.headers['x-user-role'];

  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    await ensureTables(pool);

    // Delete existing
    await pool.query('DELETE FROM intake_flow_templates WHERE flow_id = $1', [req.params.flowId]);

    const assignments = template_assignments || (template_ids || []).map((id, i) => ({
      template_id: id, step_order: i, is_required: true
    }));

    for (const a of assignments) {
      await pool.query(
        `INSERT INTO intake_flow_templates (flow_id, template_id, step_order, is_required, is_conditional, condition_rules)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [req.params.flowId, a.template_id, a.step_order || 0, a.is_required !== false, a.is_conditional || false, a.condition_rules ? JSON.stringify(a.condition_rules) : null]
      );
    }

    await logAudit(pool, { resourceType: 'intake_flow', resourceId: req.params.flowId, action: 'templates_assigned', actorId, actorRole, changeDetails: { count: assignments.length } });
    res.json({ message: 'Templates assigned to flow', count: assignments.length });
  } catch (error) {
    console.error('Error assigning templates to flow:', error);
    res.status(500).json({ error: 'Failed to assign templates to flow' });
  }
});

// ============================================================================
// FHIR QUESTIONNAIRE HELPER
// ============================================================================

function buildFhirResponse(questionnaire, formData, patientId) {
  const items = [];
  if (questionnaire.item && Array.isArray(questionnaire.item)) {
    for (const item of questionnaire.item) {
      const answer = formData[item.linkId];
      if (answer !== undefined && answer !== null && answer !== '') {
        const answerItem = { linkId: item.linkId, text: item.text };
        if (item.type === 'boolean') {
          answerItem.answer = [{ valueBoolean: Boolean(answer) }];
        } else if (item.type === 'integer') {
          answerItem.answer = [{ valueInteger: parseInt(answer) }];
        } else if (item.type === 'decimal') {
          answerItem.answer = [{ valueDecimal: parseFloat(answer) }];
        } else if (item.type === 'date') {
          answerItem.answer = [{ valueDate: answer }];
        } else if (item.type === 'choice') {
          answerItem.answer = [{ valueCoding: { code: answer, display: answer } }];
        } else {
          answerItem.answer = [{ valueString: String(answer) }];
        }
        items.push(answerItem);
      }
    }
  }
  return {
    resourceType: 'QuestionnaireResponse',
    status: 'completed',
    questionnaire: questionnaire.url || questionnaire.id,
    subject: patientId ? { reference: `Patient/${patientId}` } : undefined,
    authored: new Date().toISOString(),
    item: items
  };
}

// ============================================================================
// STATS
// ============================================================================

router.get('/stats', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    await ensureTables(pool);
    const [templates, submissions, pending, signed] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM form_templates WHERE is_active = true'),
      pool.query('SELECT COUNT(*) FROM form_submissions'),
      pool.query("SELECT COUNT(*) FROM form_submissions WHERE status = 'submitted'"),
      pool.query('SELECT COUNT(*) FROM form_submissions WHERE is_signed = true'),
    ]);
    res.json({
      total_templates: parseInt(templates.rows[0].count),
      total_submissions: parseInt(submissions.rows[0].count),
      pending_review: parseInt(pending.rows[0].count),
      signed_submissions: parseInt(signed.rows[0].count),
    });
  } catch (error) {
    console.error('Error fetching form stats:', error);
    res.status(500).json({ error: 'Failed to fetch form stats' });
  }
});

module.exports = router;
