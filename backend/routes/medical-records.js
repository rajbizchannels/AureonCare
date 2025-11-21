const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/medical-records');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
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

    // Create file metadata
    const fileMetadata = {
      originalName: req.file.originalname,
      filename: req.file.filename,
      path: `/uploads/medical-records/${req.file.filename}`,
      size: req.file.size,
      mimeType: req.file.mimetype,
      uploadedAt: new Date().toISOString(),
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

    // Create file metadata if file was uploaded
    let attachments = [];
    if (req.file) {
      attachments.push({
        originalName: req.file.originalname,
        filename: req.file.filename,
        path: `/uploads/medical-records/${req.file.filename}`,
        size: req.file.size,
        mimeType: req.file.mimetype,
        uploadedAt: new Date().toISOString(),
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
      recordDate || new Date().toISOString().split('T')[0],
      title,
      description,
      diagnosis,
      treatment,
      JSON.stringify(attachments)
    ]);

    res.status(201).json(result.rows[0]);
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
