const express = require('express');
const { authenticate } = require('../middleware/auth');
const router = express.Router();
router.use(authenticate);
router.use(require('../middleware/planEnforcement').enforceActiveBilling); // SEC-05 S11: read-only when subscription past_due/canceled
const multer = require('multer');
const cloudStorage = require('../services/cloudBackupStorage');
const path = require('path');
const fs = require('fs');
const { google } = require('googleapis');
const { Client } = require('@microsoft/microsoft-graph-client');
const { loadAttachment, recordReferencesAttachment, sendAttachment } = require('../utils/filedDocuments');

// Helper: get today's date string YYYY-MM-DD
function todayStr() {
  return new Date().toISOString().split('T')[0];
}

// Configure multer for file uploads with dated subdirectories
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dateStr = todayStr();
    const uploadDir = path.join(__dirname, '../uploads/medical-records', dateStr);
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate dated unique filename: YYYY-MM-DD-fieldname-uniqueSuffix.ext
    const dateStr = todayStr();
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${dateStr}-${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    // Allow common medical document formats
    const allowedTypes = /jpeg|jpg|png|pdf|doc|docx|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG), PDFs, and documents (DOC, DOCX, TXT) are allowed'));
    }
  }
});

/**
 * Push an uploaded document to a cloud provider.
 *
 * Token refresh, folder creation and the provider SDKs all live in the shared
 * service; the two hand-rolled helpers that used to sit here never refreshed,
 * so uploads failed silently once the stored token expired.
 */
async function uploadToCloud(pool, provider, filePath, fileName, mimeType) {
  return cloudStorage.uploadFile(pool, provider, {
    folder: cloudStorage.UPLOADS_FOLDER_NAME,
    fileName,
    mimeType,
    body: fs.createReadStream(filePath),
  });
}

/**
 * Stream a document that lives in a cloud provider.
 * GET /api/medical-records/cloud-file?provider=onedrive&fileId=...
 *
 * On a serverless deploy the local upload directory does not survive between
 * invocations, so for cloud-stored documents this is the only way to read the
 * file back.
 */
router.get('/cloud-file', async (req, res) => {
  const { provider, fileId } = req.query;
  try {
    if (!cloudStorage.isSupported(provider)) {
      return res.status(400).json({ error: `Unknown storage provider: ${provider}` });
    }
    if (!fileId) {
      return res.status(400).json({ error: 'fileId is required' });
    }
    const stream = await cloudStorage.downloadFileStream(req.app.locals.pool, provider, fileId);
    stream.on('error', (streamErr) => {
      console.error('Error streaming cloud document:', streamErr);
      if (!res.headersSent) res.status(502).json({ error: 'Failed to read the stored file' });
    });
    stream.pipe(res);
  } catch (error) {
    console.error('Error fetching cloud document:', error);
    res.status(500).json({ error: 'Failed to fetch the stored file', details: error.message });
  }
});

// Get all medical records
router.get('/', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { patientId } = req.query;

    let query = `
      SELECT
        mr.*,
        json_build_object(
          'id', p.id,
          'first_name', p.first_name,
          'last_name', p.last_name,
          'mrn', p.mrn
        ) as patient,
        json_build_object(
          'id', u.id,
          'first_name', u.first_name,
          'last_name', u.last_name,
          'specialty', u.specialty
        ) as provider
      FROM medical_records mr
      LEFT JOIN patients p ON mr.patient_id = p.id
      LEFT JOIN users u ON mr.provider_id = u.id
    `;

    const params = [];
    if (patientId) {
      query += ' WHERE mr.patient_id = $1';
      params.push(patientId);
    }

    query += ' ORDER BY mr.record_date DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching medical records:', error);
    res.status(500).json({ error: 'Failed to fetch medical records' });
  }
});

/**
 * GET /api/medical-records/pending-review
 *
 * Documents patients have sent through secure messages that no one has
 * verified yet. Declared before /:id — a single-segment path would otherwise
 * be captured by that route and read as a record id.
 */
router.get('/pending-review', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const limit = Math.min(parseInt(req.query.limit, 10) || 25, 100);

    if (req.user.role === 'patient') {
      return res.status(403).json({ error: 'Staff access required' });
    }

    const result = await pool.query(
      `SELECT mr.id, mr.patient_id, mr.title, mr.description, mr.record_date,
              mr.attachments, mr.created_at, mr.source_message_id,
              COALESCE(NULLIF(TRIM(CONCAT(p.first_name, ' ', p.last_name)), ''), p.email) AS patient_name,
              p.mrn AS patient_mrn
         FROM medical_records mr
         LEFT JOIN patients p ON p.id = mr.patient_id
        WHERE mr.review_status = 'pending_review'
        ORDER BY mr.created_at ASC
        LIMIT $1`,
      [limit]
    );

    // Oldest first: a document waiting three days matters more than one that
    // arrived this morning, and the queue is a to-do list, not a feed.
    res.json(result.rows);
  } catch (error) {
    console.error('Error loading pending document reviews:', error);
    if (error.code === '42703') {
      // review_status arrives with migration 060; an un-migrated install
      // should see an empty queue, not a 500 on the dashboard.
      return res.json([]);
    }
    res.status(500).json({ error: 'Failed to load documents awaiting review' });
  }
});

/**
 * GET /api/medical-records/:recordId/attachments/:attachmentId
 *
 * Serves a document that arrived through a secure message and was filed into
 * the chart. Authorises on the record, not on the message thread — a clinician
 * reading the chart is entitled to its documents regardless of who was in the
 * conversation.
 */
router.get('/:recordId/attachments/:attachmentId', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { recordId, attachmentId } = req.params;

    const recordResult = await pool.query('SELECT * FROM medical_records WHERE id = $1', [recordId]);
    if (recordResult.rows.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }
    const record = recordResult.rows[0];

    // A patient signed in against a users row reaches this router with a staff
    // JWT, so their own record is the only one they may open here.
    if (req.user.role === 'patient' && String(record.patient_id) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!recordReferencesAttachment(record, attachmentId)) {
      return res.status(404).json({ error: 'Attachment is not part of this record' });
    }

    const attachment = await loadAttachment(pool, attachmentId);
    if (!attachment) {
      return res.status(404).json({ error: 'Attachment no longer available' });
    }
    if (!sendAttachment(res, attachment)) {
      return res.status(500).json({ error: 'Document could not be decrypted' });
    }
  } catch (error) {
    console.error('Error downloading filed document:', error);
    res.status(500).json({ error: 'Failed to download document' });
  }
});

/**
 * POST /api/medical-records/:recordId/review
 * Accept or reject a patient-supplied document into the chart.
 * Body: { decision: 'accepted' | 'rejected', notes? }
 */
router.post('/:recordId/review', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { recordId } = req.params;
    const { decision, notes } = req.body;

    if (req.user.role === 'patient') {
      return res.status(403).json({ error: 'Only practice staff can review documents' });
    }
    if (!['accepted', 'rejected'].includes(decision)) {
      return res.status(400).json({ error: "decision must be 'accepted' or 'rejected'" });
    }

    const result = await pool.query(
      `UPDATE medical_records
          SET review_status = $1, reviewed_by = $2, reviewed_at = CURRENT_TIMESTAMP,
              reviewer_notes = $3, updated_at = CURRENT_TIMESTAMP
        WHERE id = $4 AND review_status = 'pending_review'
        RETURNING *`,
      [decision, req.user.id, notes || null, recordId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No document awaiting review with that id' });
    }

    res.json({ success: true, record: result.rows[0] });
  } catch (error) {
    console.error('Error reviewing document:', error);
    res.status(500).json({ error: 'Failed to review document' });
  }
});

// Get single medical record
router.get('/:id', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { id } = req.params;

    const result = await pool.query(`
      SELECT
        mr.*,
        json_build_object(
          'id', p.id,
          'first_name', p.first_name,
          'last_name', p.last_name,
          'mrn', p.mrn
        ) as patient,
        json_build_object(
          'id', u.id,
          'first_name', u.first_name,
          'last_name', u.last_name,
          'specialty', u.specialty
        ) as provider
      FROM medical_records mr
      LEFT JOIN patients p ON mr.patient_id = p.id
      LEFT JOIN users u ON mr.provider_id = u.id
      WHERE mr.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Medical record not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching medical record:', error);
    res.status(500).json({ error: 'Failed to fetch medical record' });
  }
});

// Create medical record
router.post('/', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const {
      patientId,
      providerId,
      recordType,
      recordDate,
      title,
      description,
      diagnosis,
      treatment,
      medications,
      attachments
    } = req.body;

    const result = await pool.query(`
      INSERT INTO medical_records (
        patient_id,
        provider_id,
        record_type,
        record_date,
        title,
        description,
        diagnosis,
        treatment,
        medications,
        attachments
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      patientId,
      providerId,
      recordType,
      recordDate,
      title,
      description,
      diagnosis,
      treatment,
      JSON.stringify(medications),
      JSON.stringify(attachments)
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating medical record:', error);
    res.status(500).json({ error: 'Failed to create medical record' });
  }
});

// Update medical record
router.put('/:id', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { id } = req.params;
    const {
      recordType,
      recordDate,
      title,
      description,
      diagnosis,
      treatment,
      medications,
      attachments
    } = req.body;

    const result = await pool.query(`
      UPDATE medical_records
      SET
        record_type = COALESCE($1, record_type),
        record_date = COALESCE($2, record_date),
        title = COALESCE($3, title),
        description = COALESCE($4, description),
        diagnosis = COALESCE($5, diagnosis),
        treatment = COALESCE($6, treatment),
        medications = COALESCE($7, medications),
        attachments = COALESCE($8, attachments),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $9
      RETURNING *
    `, [
      recordType,
      recordDate,
      title,
      description,
      diagnosis,
      treatment,
      JSON.stringify(medications),
      JSON.stringify(attachments),
      id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Medical record not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating medical record:', error);
    res.status(500).json({ error: 'Failed to update medical record' });
  }
});

// Delete medical record
router.delete('/:id', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM medical_records WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Medical record not found' });
    }

    res.json({ message: 'Medical record deleted successfully', id: result.rows[0].id });
  } catch (error) {
    console.error('Error deleting medical record:', error);
    res.status(500).json({ error: 'Failed to delete medical record' });
  }
});

// Upload file for medical record
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { patientId, recordType, classification, destination } = req.body;

    if (!patientId) {
      // Delete uploaded file if patientId is missing
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Patient ID is required' });
    }

    const uploadDate = todayStr();

    // Create file metadata
    const fileMetadata = {
      originalName: req.file.originalname,
      filename: req.file.filename,
      path: `/uploads/medical-records/${uploadDate}/${req.file.filename}`,
      size: req.file.size,
      mimeType: req.file.mimetype,
      uploadedAt: new Date().toISOString(),
      uploadDate,
      classification: classification || 'General'
    };

    // Copy to the chosen provider. 'local' (or absent) keeps the file on this
    // server only, which is what an on-premises install wants.
    if (cloudStorage.isSupported(destination)) {
      try {
        fileMetadata.cloudStorage = [
          await uploadToCloud(pool, destination, req.file.path, req.file.filename, req.file.mimetype)
        ];
      } catch (uploadErr) {
        console.error(`Upload to ${destination} failed:`, uploadErr);
        fileMetadata.cloudError = uploadErr.message;
      }
    }

    res.status(201).json({
      message: 'File uploaded successfully',
      file: fileMetadata
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    // Clean up uploaded file on error
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Create medical record with file upload
router.post('/with-file', upload.single('file'), async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const {
      patientId,
      providerId,
      recordType,
      recordDate,
      title,
      description,
      diagnosis,
      treatment,
      classification,
      destination
    } = req.body;

    const uploadDate = todayStr();

    // Create file metadata if file was uploaded
    let attachments = [];
    if (req.file) {
      attachments.push({
        originalName: req.file.originalname,
        filename: req.file.filename,
        path: `/uploads/medical-records/${uploadDate}/${req.file.filename}`,
        size: req.file.size,
        mimeType: req.file.mimetype,
        uploadedAt: new Date().toISOString(),
        uploadDate,
        classification: classification || 'General'
      });
    }

    const result = await pool.query(`
      INSERT INTO medical_records (
        patient_id,
        provider_id,
        record_type,
        record_date,
        title,
        description,
        diagnosis,
        treatment,
        attachments
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      patientId,
      providerId,
      recordType || classification || 'General',
      recordDate || uploadDate,
      title,
      description,
      diagnosis,
      treatment,
      JSON.stringify(attachments)
    ]);

    const record = result.rows[0];

    // Copy the document to the chosen cloud provider. `destination` is 'local'
    // (or absent) for an on-premises install, where the file on disk is the
    // only copy and nothing leaves the server.
    if (req.file && cloudStorage.isSupported(destination)) {
      try {
        const uploaded = await uploadToCloud(
          pool, destination, req.file.path, req.file.filename, req.file.mimetype
        );
        const updatedAttachments = attachments.map(att => ({ ...att, cloudStorage: [uploaded] }));
        await pool.query(
          'UPDATE medical_records SET attachments = $1 WHERE id = $2',
          [JSON.stringify(updatedAttachments), record.id]
        );
        record.attachments = updatedAttachments;
      } catch (uploadErr) {
        // The record and the local file are already saved; report the upload
        // problem rather than failing a clinical document that did land.
        console.error(`Medical record upload to ${destination} failed:`, uploadErr);
        record.cloudError = uploadErr.message;
      }
    }

    res.status(201).json(record);
  } catch (error) {
    console.error('Error creating medical record with file:', error);
    // Clean up uploaded file on error
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Failed to create medical record' });
  }
});

module.exports = router;
