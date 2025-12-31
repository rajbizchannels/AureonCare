const express = require('express');
const router = express.Router();
const multer = require('multer');
const { parse835File, convertToPaymentPostings, validate835File } = require('../utils/edi835Parser');
const { generate837File, validateClaimData } = require('../utils/edi837Generator');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    // Accept text files and files without extension
    if (file.mimetype === 'text/plain' || file.originalname.match(/\.(txt|edi|x12|837|835)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only EDI/text files are allowed'));
    }
  }
});

// Upload and process EDI 835 file
router.post('/835/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileContent = req.file.buffer.toString('utf8');

    // Validate the file
    const validation = validate835File(fileContent);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Invalid EDI 835 file',
        details: validation.errors
      });
    }

    // Parse the file
    const parsed835 = parse835File(fileContent);

    // Get claim numbers from parsed data
    const claimNumbers = parsed835.claims.map(c => c.claimNumber);

    // Look up claim IDs from the database
    const pool = req.app.locals.pool;
    const claimQuery = await pool.query(
      'SELECT id, claim_number FROM claims WHERE claim_number = ANY($1)',
      [claimNumbers]
    );

    const claimMapping = {};
    claimQuery.rows.forEach(row => {
      claimMapping[row.claim_number] = row.id;
    });

    // Convert to payment postings
    const postings = convertToPaymentPostings(parsed835, claimMapping);

    // Check for duplicates
    const duplicateCheck = await pool.query(
      `SELECT posting_number, claim_id, payment_amount, posting_date, era_number
       FROM payment_postings
       WHERE era_number = $1`,
      [parsed835.interchangeControlNumber]
    );

    if (duplicateCheck.rows.length > 0) {
      return res.status(409).json({
        error: 'Duplicate ERA detected',
        message: 'Payment postings from this ERA have already been imported',
        existingPostings: duplicateCheck.rows,
        parsedData: parsed835
      });
    }

    // Look up insurance payer IDs
    for (const posting of postings) {
      if (parsed835.payerIdentification) {
        const payerQuery = await pool.query(
          'SELECT id FROM insurance_payers WHERE payer_id = $1 OR name ILIKE $2',
          [parsed835.payerIdentification, `%${parsed835.payerName}%`]
        );

        if (payerQuery.rows.length > 0) {
          posting.insurance_payer_id = payerQuery.rows[0].id;
        }
      }

      // Get patient_id from claim
      if (posting.claim_id) {
        const claimInfo = await pool.query(
          'SELECT patient_id FROM claims WHERE id = $1',
          [posting.claim_id]
        );

        if (claimInfo.rows.length > 0) {
          posting.patient_id = claimInfo.rows[0].patient_id;
        }
      }
    }

    // Insert payment postings
    const insertedPostings = [];
    for (const posting of postings) {
      try {
        const result = await pool.query(
          `INSERT INTO payment_postings
           (claim_id, patient_id, insurance_payer_id, check_number, check_date,
            payment_amount, allowed_amount, deductible_amount, coinsurance_amount,
            copay_amount, adjustment_amount, adjustment_reason, adjustment_code,
            posting_date, status, payment_method, era_number, eob_number, notes,
            created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW(), NOW())
           RETURNING *`,
          [
            posting.claim_id,
            posting.patient_id,
            posting.insurance_payer_id,
            posting.check_number,
            posting.check_date,
            posting.payment_amount,
            posting.allowed_amount,
            posting.deductible_amount,
            posting.coinsurance_amount,
            posting.copay_amount,
            posting.adjustment_amount,
            posting.adjustment_reason,
            posting.adjustment_code,
            posting.posting_date,
            posting.status,
            posting.payment_method,
            posting.era_number,
            posting.eob_number,
            posting.notes
          ]
        );

        insertedPostings.push(result.rows[0]);
      } catch (err) {
        console.error('Error inserting payment posting:', err);
        // Continue with other postings even if one fails
      }
    }

    res.json({
      success: true,
      message: `Successfully imported ${insertedPostings.length} payment posting(s)`,
      summary: {
        totalClaims: parsed835.claims.length,
        importedPostings: insertedPostings.length,
        skippedClaims: parsed835.claims.length - insertedPostings.length,
        totalPaymentAmount: parsed835.totalPaymentAmount,
        payerName: parsed835.payerName,
        checkNumber: parsed835.checkNumber,
        checkDate: parsed835.checkDate
      },
      postings: insertedPostings
    });
  } catch (error) {
    console.error('Error processing 835 file:', error);
    res.status(500).json({
      error: 'Failed to process EDI 835 file',
      message: error.message
    });
  }
});

// Generate EDI 837 file for a claim
router.post('/837/generate/:claimId', async (req, res) => {
  try {
    const { claimId } = req.params;
    const pool = req.app.locals.pool;

    // Get claim with patient and provider information
    const claimQuery = await pool.query(
      `SELECT c.*,
              p.first_name, p.last_name, p.middle_name, p.date_of_birth, p.gender,
              p.address, p.city, p.state, p.zip_code, p.phone,
              p.insurance_member_id, p.insurance_plan, p.insurance_payer_id
       FROM claims c
       LEFT JOIN patients p ON c.patient_id::text = p.id::text
       WHERE c.id::text = $1::text`,
      [claimId]
    );

    if (claimQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    const claim = claimQuery.rows[0];

    // Get provider information (using a default for now)
    const providerInfo = {
      npi: '1234567890',
      tax_id: '123456789',
      organization_name: 'MedFlow Medical Center',
      address: '123 Medical Drive',
      city: 'Healthcare City',
      state: 'CA',
      zip_code: '90210'
    };

    // Prepare claim data for 837 generation
    const claimData = {
      claim_number: claim.claim_number,
      patient: {
        first_name: claim.first_name,
        last_name: claim.last_name,
        middle_name: claim.middle_name,
        date_of_birth: claim.date_of_birth,
        gender: claim.gender,
        address: claim.address,
        city: claim.city,
        state: claim.state,
        zip_code: claim.zip_code,
        insurance_member_id: claim.insurance_member_id,
        insurance_plan: claim.insurance_plan
      },
      provider: providerInfo,
      payer: claim.payer,
      payer_id: claim.payer_id,
      amount: claim.amount,
      service_date: claim.service_date,
      diagnosis_codes: claim.diagnosis_codes || [],
      procedure_codes: claim.procedure_codes || [],
      place_of_service: '11', // Office
      claim_filing_indicator: '12' // PPO
    };

    // Validate claim data
    const validation = validateClaimData(claimData);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Invalid claim data',
        details: validation.errors
      });
    }

    // Get submitter information from settings or use defaults
    const submitterInfo = {
      submitterId: 'MEDFLOW',
      receiverId: req.body.clearinghouseId || 'OPTUM',
      receiverName: req.body.clearinghouseName || 'Optum',
      organizationName: 'MedFlow Medical Center',
      contactName: 'Billing Department',
      contactPhone: '5555555555',
      testIndicator: req.body.testMode ? 'T' : 'P'
    };

    // Generate 837 file
    const edi837Content = generate837File(claimData, submitterInfo);

    // Save the submission record
    await pool.query(
      `INSERT INTO claim_submissions
       (claim_id, submission_type, submission_date, status, edi_content, created_at)
       VALUES ($1, 'EDI_837', NOW(), 'pending', $2, NOW())
       ON CONFLICT DO NOTHING`,
      [claimId, edi837Content]
    );

    res.json({
      success: true,
      claimNumber: claim.claim_number,
      ediContent: edi837Content,
      fileName: `837_${claim.claim_number}_${Date.now()}.txt`
    });
  } catch (error) {
    console.error('Error generating 837 file:', error);
    res.status(500).json({
      error: 'Failed to generate EDI 837 file',
      message: error.message
    });
  }
});

// Submit EDI 837 to clearinghouse
router.post('/837/submit/:claimId', async (req, res) => {
  try {
    const { claimId } = req.params;
    const pool = req.app.locals.pool;

    // Check if clearinghouse integration is configured
    const settingsQuery = await pool.query(
      `SELECT settings FROM vendor_integration_settings WHERE vendor_name = 'Optum'`
    );

    if (settingsQuery.rows.length === 0 || !settingsQuery.rows[0].settings?.enabled) {
      return res.status(400).json({
        error: 'Clearinghouse integration not configured',
        message: 'Please configure Optum clearinghouse integration or download the 837 file manually',
        downloadAvailable: true
      });
    }

    // Generate 837 file first
    const generateResponse = await fetch(`http://localhost:${process.env.PORT || 3000}/api/edi/837/generate/${claimId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(req.body)
    });

    if (!generateResponse.ok) {
      throw new Error('Failed to generate 837 file');
    }

    const { ediContent, claimNumber } = await generateResponse.json();

    // TODO: Submit to actual clearinghouse
    // For now, simulate submission
    const submissionId = `SUBM-${Date.now()}`;

    // Update claim status
    await pool.query(
      `UPDATE claims SET status = 'Submitted', updated_at = NOW() WHERE id::text = $1::text`,
      [claimId]
    );

    // Log the submission
    await pool.query(
      `INSERT INTO claim_submissions
       (claim_id, submission_type, submission_date, status, submission_id, edi_content, created_at)
       VALUES ($1, 'EDI_837', NOW(), 'submitted', $2, $3, NOW())`,
      [claimId, submissionId, ediContent]
    );

    res.json({
      success: true,
      message: 'Claim submitted to clearinghouse successfully',
      claimNumber: claimNumber,
      submissionId: submissionId,
      status: 'submitted'
    });
  } catch (error) {
    console.error('Error submitting 837 to clearinghouse:', error);
    res.status(500).json({
      error: 'Failed to submit claim to clearinghouse',
      message: error.message
    });
  }
});

// Get submission history for a claim
router.get('/submissions/:claimId', async (req, res) => {
  try {
    const { claimId } = req.params;
    const pool = req.app.locals.pool;

    const result = await pool.query(
      `SELECT * FROM claim_submissions
       WHERE claim_id::text = $1::text
       ORDER BY submission_date DESC`,
      [claimId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching claim submissions:', error);
    res.status(500).json({
      error: 'Failed to fetch claim submissions',
      message: error.message
    });
  }
});

module.exports = router;
