const express = require('express');
const { authenticate } = require('../middleware/auth');
const router = express.Router();
router.use(authenticate);
const multer = require('multer');
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

// Upload a file to Google Drive if the provider is configured and enabled
async function uploadToGoogleDrive(pool, filePath, fileName, mimeType) {
  try {
    const result = await pool.query(
      "SELECT settings FROM backup_provider_settings WHERE provider_type = 'google_drive' AND is_enabled = true"
    );
    if (result.rows.length === 0) return null;

    const settings = typeof result.rows[0].settings === 'string'
      ? JSON.parse(result.rows[0].settings)
      : result.rows[0].settings;

    const accessToken = settings && settings.access_token;
    if (!accessToken) return null;

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });

    const drive = google.drive({ version: 'v3', auth });

    const fileStream = fs.createReadStream(filePath);
    const file = await drive.files.create({
      requestBody: { name: fileName },
      media: { mimeType, body: fileStream },
      fields: 'id, name, webViewLink'
    });

    console.log('Medical record uploaded to Google Drive:', file.data.id);
    return {
      provider: 'google_drive',
      fileId: file.data.id,
      fileName: file.data.name,
      link: file.data.webViewLink
    };
  } catch (err) {
    console.error('Google Drive upload failed (non-fatal):', err.message);
    return null;
  }
}

// Upload a file to OneDrive if the provider is configured and enabled
async function uploadToOneDrive(pool, filePath, fileName) {
  try {
    const result = await pool.query(
      "SELECT settings FROM backup_provider_settings WHERE provider_type = 'onedrive' AND is_enabled = true"
    );
    if (result.rows.length === 0) return null;

    const settings = typeof result.rows[0].settings === 'string'
      ? JSON.parse(result.rows[0].settings)
      : result.rows[0].settings;

    const accessToken = settings && settings.access_token;
    if (!accessToken) return null;

    const client = Client.init({
      authProvider: (done) => {
        done(null, accessToken);
      }
    });

    const fileContent = fs.readFileSync(filePath);

    const uploadedFile = await client
      .api(`/me/drive/root:/AureonCare/MedicalRecords/${fileName}:/content`)
      .put(fileContent);

    console.log('Medical record uploaded to OneDrive:', uploadedFile.id);
    return {
      provider: 'onedrive',
      fileId: uploadedFile.id,
      fileName: uploadedFile.name,
      link: uploadedFile.webUrl
    };
  } catch (err) {
    console.error('OneDrive upload failed (non-fatal):', err.message);
    return null;
  }
}

// Get all medical records
router.get('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
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
    const pool = req.app.locals.pool;
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
    const pool = req.app.locals.pool;
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
    const pool = req.app.locals.pool;
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
    const pool = req.app.locals.pool;
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
    const pool = req.app.locals.pool;
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
    const pool = req.app.locals.pool;
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
    const pool = req.app.locals.pool;
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
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { patientId, recordType, classification } = req.body;

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
    const pool = req.app.locals.pool;
    const {
      patientId,
      providerId,
      recordType,
      recordDate,
      title,
      description,
      diagnosis,
      treatment,
      classification
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

    // Attempt cloud uploads if providers are configured (non-blocking on failure)
    if (req.file) {
      const [gdResult, odResult] = await Promise.all([
        uploadToGoogleDrive(pool, req.file.path, req.file.filename, req.file.mimetype),
        uploadToOneDrive(pool, req.file.path, req.file.filename)
      ]);

      const cloudStorage = [gdResult, odResult].filter(Boolean);

      if (cloudStorage.length > 0) {
        const updatedAttachments = attachments.map(att => ({ ...att, cloudStorage }));
        await pool.query(
          'UPDATE medical_records SET attachments = $1 WHERE id = $2',
          [JSON.stringify(updatedAttachments), record.id]
        );
        record.attachments = updatedAttachments;
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
