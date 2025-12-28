const express = require('express');
const router = express.Router();
const WhatsAppService = require('../services/whatsappService');
const vendorIntegrationManager = require('../services/vendorIntegrations');
const fhirTrackingIntegration = require('../services/fhirTrackingIntegration');

// Helper function to convert snake_case to camelCase
const toCamelCase = (obj) => {
  const newObj = {};
  for (const key in obj) {
    const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
    newObj[camelKey] = obj[key];
  }
  return newObj;
};

// Helper function to check if ePrescribing schema is available
let ePrescribingAvailable = null;
const checkEPrescribingSchema = async (pool) => {
  if (ePrescribingAvailable !== null) {
    return ePrescribingAvailable;
  }

  try {
    // Check if pharmacies table exists
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'pharmacies'
      );
    `);
    ePrescribingAvailable = result.rows[0].exists;
    return ePrescribingAvailable;
  } catch (error) {
    console.error('Error checking ePrescribing schema:', error);
    ePrescribingAvailable = false;
    return false;
  }
};

// Helper function to ensure diagnosis_id column exists
let diagnosisIdColumnChecked = false;
const ensureDiagnosisIdColumn = async (pool) => {
  if (diagnosisIdColumnChecked) {
    return;
  }

  try {
    // Check if diagnosis_id column exists
    const columnCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'prescriptions'
        AND column_name = 'diagnosis_id'
      );
    `);

    if (!columnCheck.rows[0].exists) {
      console.log('Adding diagnosis_id column to prescriptions table...');
      await pool.query(`
        ALTER TABLE prescriptions
        ADD COLUMN diagnosis_id UUID REFERENCES diagnosis(id) ON DELETE SET NULL;
      `);
      console.log('✓ diagnosis_id column added successfully');
    }

    diagnosisIdColumnChecked = true;
  } catch (error) {
    console.error('Error ensuring diagnosis_id column:', error);
    diagnosisIdColumnChecked = true; // Mark as checked to avoid repeated attempts
  }
};

// Get all prescriptions
router.get('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { patient_id, provider_id, status, erx_status } = req.query;
    const hasEPrescribing = await checkEPrescribingSchema(pool);

    let query;
    if (hasEPrescribing) {
      query = `
        SELECT p.*,
               pat.first_name || ' ' || pat.last_name as patient_name,
               prov.first_name || ' ' || prov.last_name as provider_name,
               ph.pharmacy_name,
               m.generic_name,
               m.brand_name
        FROM prescriptions p
        LEFT JOIN patients pat ON p.patient_id = pat.id
        LEFT JOIN providers prov ON p.provider_id = prov.id
        LEFT JOIN pharmacies ph ON p.pharmacy_id = ph.id
        LEFT JOIN medications m ON p.ndc_code = m.ndc_code
        WHERE 1=1
      `;
    } else {
      query = `
        SELECT p.*,
               pat.first_name || ' ' || pat.last_name as patient_name,
               prov.first_name || ' ' || prov.last_name as provider_name
        FROM prescriptions p
        LEFT JOIN patients pat ON p.patient_id = pat.id
        LEFT JOIN providers prov ON p.provider_id = prov.id
        WHERE 1=1
      `;
    }

    const params = [];
    let paramCount = 1;

    if (patient_id) {
      query += ` AND p.patient_id = $${paramCount}`;
      params.push(patient_id);
      paramCount++;
    }

    if (provider_id) {
      query += ` AND p.provider_id = $${paramCount}`;
      params.push(provider_id);
      paramCount++;
    }

    if (status) {
      query += ` AND p.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (hasEPrescribing && erx_status) {
      query += ` AND p.erx_status = $${paramCount}`;
      params.push(erx_status);
      paramCount++;
    }

    query += ' ORDER BY p.prescribed_date DESC, p.id DESC';

    const result = await pool.query(query, params);
    const prescriptions = result.rows.map(toCamelCase);
    res.json(prescriptions);
  } catch (error) {
    console.error('Error fetching prescriptions:', error);
    res.status(500).json({ error: 'Failed to fetch prescriptions' });
  }
});

// Get single prescription
router.get('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      `SELECT p.*,
              pat.first_name || ' ' || pat.last_name as patient_name,
              prov.first_name || ' ' || prov.last_name as provider_name
       FROM prescriptions p
       LEFT JOIN patients pat ON p.patient_id = pat.id
       LEFT JOIN providers prov ON p.provider_id = prov.id
       WHERE p.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Prescription not found' });
    }

    res.json(toCamelCase(result.rows[0]));
  } catch (error) {
    console.error('Error fetching prescription:', error);
    res.status(500).json({ error: 'Failed to fetch prescription' });
  }
});

// Create new prescription
router.post('/', async (req, res) => {
  const {
    patientId,
    providerId,
    appointmentId,
    medicationName,
    ndcCode,
    dosage,
    frequency,
    duration,
    quantity,
    instructions,
    refills,
    substitutionAllowed,
    status,
    prescribedDate,
    diagnosisId
  } = req.body;

  try {
    const pool = req.app.locals.pool;
    await ensureDiagnosisIdColumn(pool);
    const result = await pool.query(
      `INSERT INTO prescriptions (
        patient_id, provider_id, appointment_id, medication_name, ndc_code,
        dosage, frequency, duration, quantity, instructions, refills,
        substitution_allowed, status, prescribed_date, diagnosis_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        patientId,
        providerId,
        appointmentId,
        medicationName,
        ndcCode || null,
        dosage,
        frequency,
        duration,
        quantity || 0,
        instructions,
        refills || 0,
        substitutionAllowed !== undefined ? substitutionAllowed : true,
        status || 'Active',
        prescribedDate || new Date().toISOString().split('T')[0],
        diagnosisId || null
      ]
    );

    const prescription = result.rows[0];

    // Initialize FHIR tracking for prescription
    try {
      const patientResult = await pool.query(
        'SELECT first_name, last_name FROM users WHERE id = $1',
        [patientId]
      );
      const providerResult = await pool.query(
        'SELECT first_name, last_name FROM users WHERE id = $1',
        [providerId]
      );

      await fhirTrackingIntegration.initializePrescriptionTracking({
        prescriptionId: prescription.id,
        prescription,
        patientData: patientResult.rows[0],
        providerData: providerResult.rows[0],
        vendorName: req.body.sendToVendor ? 'surescripts' : null,
        userId: providerId
      });
    } catch (trackingError) {
      console.error('Error initializing prescription tracking:', trackingError);
      // Don't fail the request if tracking fails
    }

    // Send WhatsApp notification if enabled
    try {
      const whatsappPref = await WhatsAppService.isEnabledForPatient(pool, patientId);

      if (whatsappPref.enabled) {
        // Get patient and provider details
        const patientResult = await pool.query(
          'SELECT id, first_name, last_name, phone FROM patients WHERE id = $1',
          [patientId]
        );
        const providerResult = await pool.query(
          'SELECT id, first_name, last_name FROM providers WHERE id = $1',
          [providerId]
        );

        if (patientResult.rows.length > 0 && providerResult.rows.length > 0) {
          const patient = {
            ...patientResult.rows[0],
            phone: whatsappPref.phoneNumber || patientResult.rows[0].phone
          };
          const provider = providerResult.rows[0];

          // Get WhatsApp config
          const whatsappConfig = await WhatsAppService.getConfig(pool);

          if (whatsappConfig) {
            const whatsappService = new WhatsAppService(whatsappConfig);
            await whatsappService.sendPrescriptionNotification(
              prescription,
              patient,
              provider,
              null // pharmacy info not available at creation time
            );
          }
        }
      }
    } catch (whatsappError) {
      console.error('Error sending WhatsApp notification for prescription:', whatsappError);
      // Don't fail the request if notification fails
    }

    // Send to Surescripts if enabled and send_to_vendor is requested
    if (req.body.sendToVendor && vendorIntegrationManager.isVendorEnabled('surescripts')) {
      try {
        // Get full patient and provider details for Surescripts
        const patientResult = await pool.query(
          'SELECT * FROM users WHERE id = $1',
          [patientId]
        );
        const providerResult = await pool.query(
          'SELECT * FROM users WHERE id = $1',
          [providerId]
        );

        // Get pharmacy details if pharmacy_id is provided
        let pharmacyInfo = null;
        if (req.body.pharmacyId) {
          const pharmacyResult = await pool.query(
            'SELECT * FROM pharmacies WHERE id = $1',
            [req.body.pharmacyId]
          );
          if (pharmacyResult.rows.length > 0) {
            pharmacyInfo = pharmacyResult.rows[0];
          }
        }

        const surescripts = vendorIntegrationManager.getSurescripts();

        const vendorPrescription = {
          ...prescription,
          patient_id: patientId,
          provider_id: providerId,
          patient: patientResult.rows[0],
          provider: providerResult.rows[0],
          pharmacy: pharmacyInfo,
          ndc_code: ndcCode,
          medication_name: medicationName,
          quantity: quantity,
          refills: refills,
          instructions: instructions,
          allow_substitutions: substitutionAllowed
        };

        const vendorResponse = await surescripts.sendPrescription(vendorPrescription);

        if (vendorResponse.success) {
          // Update prescription with vendor information
          await pool.query(`
            UPDATE prescriptions
            SET
              vendor_prescription_id = $1,
              vendor_status = $2,
              sent_to_vendor_at = $3,
              vendor_response = $4
            WHERE id = $5
          `, [
            vendorResponse.vendorId,
            vendorResponse.status,
            vendorResponse.sentAt,
            JSON.stringify(vendorResponse.response),
            prescription.id
          ]);

          prescription.vendor_prescription_id = vendorResponse.vendorId;
          prescription.vendor_status = vendorResponse.status;

          // Log transaction
          await vendorIntegrationManager.logTransaction('surescripts', 'prescription_send', {
            request: vendorPrescription,
            response: vendorResponse.response,
            status: 'success',
            externalId: vendorResponse.vendorId,
            internalReferenceId: prescription.id,
            patientId: patientId
          });

          // Record vendor interaction in FHIR tracking
          try {
            await fhirTrackingIntegration.recordPrescriptionVendorInteraction({
              prescriptionId: prescription.id,
              vendorName: 'surescripts',
              vendorTrackingId: vendorResponse.vendorId,
              vendorStatus: vendorResponse.status,
              vendorResponse: vendorResponse.response,
              success: true,
              userId: providerId
            });
          } catch (trackingError) {
            console.error('Error recording vendor interaction in tracking:', trackingError);
          }
        } else {
          // Log failed transaction
          await vendorIntegrationManager.logTransaction('surescripts', 'prescription_send', {
            request: vendorPrescription,
            response: vendorResponse.response,
            status: 'failed',
            error: vendorResponse.error,
            internalReferenceId: prescription.id,
            patientId: patientId
          });

          prescription.vendor_error = vendorResponse.error;

          // Record error in FHIR tracking
          try {
            await fhirTrackingIntegration.recordPrescriptionError({
              prescriptionId: prescription.id,
              errorMessage: vendorResponse.error,
              errorDetails: { response: vendorResponse.response },
              vendorName: 'surescripts',
              vendorResponse: vendorResponse.response,
              userId: providerId
            });
          } catch (trackingError) {
            console.error('Error recording prescription error in tracking:', trackingError);
          }
        }
      } catch (vendorError) {
        console.error('Error sending prescription to Surescripts:', vendorError);
        prescription.vendor_error = vendorError.message;

        // Record error in FHIR tracking
        try {
          await fhirTrackingIntegration.recordPrescriptionError({
            prescriptionId: prescription.id,
            errorMessage: vendorError.message,
            errorDetails: { stack: vendorError.stack },
            vendorName: 'surescripts',
            userId: providerId
          });
        } catch (trackingError) {
          console.error('Error recording prescription error in tracking:', trackingError);
        }

        // Don't fail the request if vendor integration fails
      }
    }

    res.status(201).json(toCamelCase(prescription));
  } catch (error) {
    console.error('Error creating prescription:', error);
    res.status(500).json({ error: 'Failed to create prescription' });
  }
});

// Update prescription
router.put('/:id', async (req, res) => {
  const {
    medicationName,
    dosage,
    frequency,
    duration,
    quantity,
    instructions,
    refills,
    status,
    diagnosisId
  } = req.body;

  try {
    const pool = req.app.locals.pool;
    await ensureDiagnosisIdColumn(pool);
    const result = await pool.query(
      `UPDATE prescriptions SET
        medication_name = COALESCE($1, medication_name),
        dosage = COALESCE($2, dosage),
        frequency = COALESCE($3, frequency),
        duration = COALESCE($4, duration),
        quantity = COALESCE($5, quantity),
        instructions = COALESCE($6, instructions),
        refills = COALESCE($7, refills),
        status = COALESCE($8, status),
        diagnosis_id = COALESCE($9, diagnosis_id),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $10
      RETURNING *`,
      [medicationName, dosage, frequency, duration, quantity, instructions, refills, status, diagnosisId, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Prescription not found' });
    }

    const updatedPrescription = result.rows[0];

    // Update FHIR tracking status if status changed
    if (status) {
      try {
        await fhirTrackingIntegration.updatePrescriptionTracking({
          prescriptionId: req.params.id,
          status,
          statusReason: 'Manual update',
          userId: req.user?.id || null
        });
      } catch (trackingError) {
        console.error('Error updating prescription tracking:', trackingError);
        // Don't fail the request if tracking update fails
      }
    }

    res.json(toCamelCase(updatedPrescription));
  } catch (error) {
    console.error('Error updating prescription:', error);
    res.status(500).json({ error: 'Failed to update prescription' });
  }
});

// Delete prescription
router.delete('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      'DELETE FROM prescriptions WHERE id = $1 RETURNING *',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Prescription not found' });
    }

    res.json({ message: 'Prescription deleted successfully' });
  } catch (error) {
    console.error('Error deleting prescription:', error);
    res.status(500).json({ error: 'Failed to delete prescription' });
  }
});

// ========== ePrescribing Endpoints ==========

// Send prescription electronically to pharmacy
router.post('/:id/send-erx', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const hasEPrescribing = await checkEPrescribingSchema(pool);

    if (!hasEPrescribing) {
      return res.status(501).json({
        error: 'ePrescribing functionality not available',
        message: 'Please run migration 015 to enable ePrescribing features'
      });
    }

    const { pharmacyId, prescriberDeaNumber } = req.body;

    // Get prescription details
    const prescriptionResult = await pool.query(
      'SELECT * FROM prescriptions WHERE id = $1',
      [req.params.id]
    );

    if (prescriptionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Prescription not found' });
    }

    const prescription = prescriptionResult.rows[0];

    // Update prescription with pharmacy and eRx status
    const erxMessageId = `ERX-${Date.now()}-${req.params.id}`;
    const result = await pool.query(`
      UPDATE prescriptions SET
        pharmacy_id = $1,
        prescriber_dea_number = $2,
        erx_message_id = $3,
        erx_status = 'sent',
        erx_sent_date = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `, [pharmacyId, prescriberDeaNumber, erxMessageId, req.params.id]);

    // Log in prescription history
    await pool.query(`
      INSERT INTO prescription_history (
        prescription_id, action, action_by, new_status, pharmacy_id
      ) VALUES ($1, $2, $3, $4, $5)
    `, [req.params.id, 'sent', prescription.provider_id, 'sent', pharmacyId]);

    // In a real system, this would queue the message for sending to the pharmacy network
    await pool.query(`
      INSERT INTO erx_message_queue (
        prescription_id, message_type, message_direction, pharmacy_id,
        message_payload, message_status
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      req.params.id,
      'NewRx',
      'outbound',
      pharmacyId,
      JSON.stringify({ prescriptionId: req.params.id, erxMessageId }),
      'pending'
    ]);

    // Send WhatsApp notification if enabled
    try {
      const whatsappPref = await WhatsAppService.isEnabledForPatient(pool, prescription.patient_id);

      if (whatsappPref.enabled) {
        // Get patient, provider, and pharmacy details
        const patientResult = await pool.query(
          'SELECT id, first_name, last_name, phone FROM patients WHERE id = $1',
          [prescription.patient_id]
        );
        const providerResult = await pool.query(
          'SELECT id, first_name, last_name FROM providers WHERE id = $1',
          [prescription.provider_id]
        );
        const pharmacyResult = await pool.query(
          'SELECT id, pharmacy_name as name, address, phone FROM pharmacies WHERE id = $1',
          [pharmacyId]
        );

        if (patientResult.rows.length > 0 && providerResult.rows.length > 0) {
          const patient = {
            ...patientResult.rows[0],
            phone: whatsappPref.phoneNumber || patientResult.rows[0].phone
          };
          const provider = providerResult.rows[0];
          const pharmacy = pharmacyResult.rows.length > 0 ? pharmacyResult.rows[0] : null;

          // Get WhatsApp config
          const whatsappConfig = await WhatsAppService.getConfig(pool);

          if (whatsappConfig) {
            const whatsappService = new WhatsAppService(whatsappConfig);
            await whatsappService.sendPrescriptionNotification(
              prescription,
              patient,
              provider,
              pharmacy
            );
          }
        }
      }
    } catch (whatsappError) {
      console.error('Error sending WhatsApp notification for eRx:', whatsappError);
      // Don't fail the request if notification fails
    }

    res.json({
      ...toCamelCase(result.rows[0]),
      message: 'Prescription sent electronically to pharmacy'
    });
  } catch (error) {
    console.error('Error sending eRx:', error);
    res.status(500).json({ error: 'Failed to send electronic prescription' });
  }
});

// Cancel electronic prescription
router.post('/:id/cancel-erx', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const hasEPrescribing = await checkEPrescribingSchema(pool);

    if (!hasEPrescribing) {
      return res.status(501).json({
        error: 'ePrescribing functionality not available',
        message: 'Please run migration 015 to enable ePrescribing features'
      });
    }

    const { reason, cancelledBy } = req.body;

    const result = await pool.query(`
      UPDATE prescriptions SET
        erx_status = 'cancelled',
        status = 'Cancelled',
        cancelled_reason = $1,
        cancelled_by = $2,
        cancelled_date = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `, [reason, cancelledBy, req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Prescription not found' });
    }

    // Log cancellation
    await pool.query(`
      INSERT INTO prescription_history (
        prescription_id, action, action_by, old_status, new_status, notes
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `, [req.params.id, 'cancelled', cancelledBy, result.rows[0].erx_status, 'cancelled', reason]);

    res.json(toCamelCase(result.rows[0]));
  } catch (error) {
    console.error('Error cancelling eRx:', error);
    res.status(500).json({ error: 'Failed to cancel electronic prescription' });
  }
});

// Get prescription history/audit log
router.get('/:id/history', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const hasEPrescribing = await checkEPrescribingSchema(pool);

    if (!hasEPrescribing) {
      return res.status(501).json({
        error: 'ePrescribing functionality not available',
        message: 'Please run migration 015 to enable ePrescribing features'
      });
    }

    const result = await pool.query(`
      SELECT
        ph.*,
        u.first_name || ' ' || u.last_name as action_by_name,
        p.pharmacy_name
      FROM prescription_history ph
      LEFT JOIN users u ON ph.action_by = u.id
      LEFT JOIN pharmacies p ON ph.pharmacy_id = p.id
      WHERE ph.prescription_id = $1
      ORDER BY ph.action_date DESC
    `, [req.params.id]);

    res.json(result.rows.map(toCamelCase));
  } catch (error) {
    console.error('Error fetching prescription history:', error);
    res.status(500).json({ error: 'Failed to fetch prescription history' });
  }
});

// Check for drug allergies and interactions
router.post('/check-safety', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const hasEPrescribing = await checkEPrescribingSchema(pool);

    if (!hasEPrescribing) {
      return res.status(501).json({
        error: 'ePrescribing functionality not available',
        message: 'Please run migration 015 to enable ePrescribing features'
      });
    }

    const { patientId, ndcCode, currentMedications } = req.body;

    const warnings = [];

    // Check allergies
    const allergyResult = await pool.query(`
      SELECT * FROM patient_allergies
      WHERE patient_id = $1
        AND allergen_type = 'drug'
        AND is_active = true
        AND (
          allergen_name ILIKE (SELECT drug_name FROM medications WHERE ndc_code = $2)
          OR allergen_name ILIKE (SELECT generic_name FROM medications WHERE ndc_code = $2)
          OR ndc_code = $2
        )
    `, [patientId, ndcCode]);

    if (allergyResult.rows.length > 0) {
      warnings.push({
        type: 'allergy',
        severity: 'severe',
        message: `Patient has documented allergy to this medication`,
        details: allergyResult.rows.map(toCamelCase)
      });
    }

    // Check drug interactions if current medications provided
    if (currentMedications && Array.isArray(currentMedications)) {
      for (const medNdc of currentMedications) {
        const interactionResult = await pool.query(`
          SELECT * FROM drug_interactions
          WHERE (drug1_ndc = $1 AND drug2_ndc = $2)
             OR (drug1_ndc = $2 AND drug2_ndc = $1)
        `, [ndcCode, medNdc]);

        if (interactionResult.rows.length > 0) {
          warnings.push({
            type: 'interaction',
            severity: interactionResult.rows[0].interaction_severity,
            message: `Drug interaction detected`,
            details: interactionResult.rows.map(toCamelCase)
          });
        }
      }
    }

    res.json({
      safe: warnings.length === 0,
      warnings,
      requiresOverride: warnings.some(w => w.severity === 'severe' || w.severity === 'contraindicated')
    });
  } catch (error) {
    console.error('Error checking medication safety:', error);
    res.status(500).json({ error: 'Failed to check medication safety' });
  }
});

// Get patient's current active prescriptions
router.get('/patient/:patientId/active', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const hasEPrescribing = await checkEPrescribingSchema(pool);

    let query;
    if (hasEPrescribing) {
      query = `
        SELECT p.*,
               prov.first_name as provider_first_name,
               prov.last_name as provider_last_name,
               prov.specialization as provider_specialization,
               prov.first_name || ' ' || prov.last_name as provider_name,
               ph.pharmacy_name,
               m.generic_name,
               m.brand_name,
               m.drug_class
        FROM prescriptions p
        LEFT JOIN providers prov ON p.provider_id = prov.id
        LEFT JOIN pharmacies ph ON p.pharmacy_id = ph.id
        LEFT JOIN medications m ON p.ndc_code = m.ndc_code
        WHERE p.patient_id = $1
          AND p.status = 'Active'
          AND (p.erx_status IS NULL OR p.erx_status NOT IN ('cancelled', 'rejected'))
        ORDER BY p.prescribed_date DESC
      `;
    } else {
      query = `
        SELECT p.*,
               prov.first_name as provider_first_name,
               prov.last_name as provider_last_name,
               prov.specialization as provider_specialization,
               prov.first_name || ' ' || prov.last_name as provider_name
        FROM prescriptions p
        LEFT JOIN providers prov ON p.provider_id = prov.id
        WHERE p.patient_id = $1
          AND p.status = 'Active'
        ORDER BY p.prescribed_date DESC
      `;
    }

    const result = await pool.query(query, [req.params.patientId]);
    res.json(result.rows.map(toCamelCase));
  } catch (error) {
    console.error('Error fetching active prescriptions:', error);
    res.status(500).json({ error: 'Failed to fetch active prescriptions' });
  }
});

// Get prescriptions by diagnosis ID
router.get('/diagnosis/:diagnosisId', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    await ensureDiagnosisIdColumn(pool);
    const hasEPrescribing = await checkEPrescribingSchema(pool);

    let query;
    if (hasEPrescribing) {
      query = `
        SELECT p.*,
               prov.first_name as provider_first_name,
               prov.last_name as provider_last_name,
               prov.specialization as provider_specialization,
               prov.first_name || ' ' || prov.last_name as provider_name,
               ph.pharmacy_name,
               m.generic_name,
               m.brand_name,
               m.drug_class
        FROM prescriptions p
        LEFT JOIN providers prov ON p.provider_id = prov.id
        LEFT JOIN pharmacies ph ON p.pharmacy_id = ph.id
        LEFT JOIN medications m ON p.ndc_code = m.ndc_code
        WHERE p.diagnosis_id = $1
        ORDER BY p.prescribed_date DESC
      `;
    } else {
      query = `
        SELECT p.*,
               prov.first_name as provider_first_name,
               prov.last_name as provider_last_name,
               prov.specialization as provider_specialization,
               prov.first_name || ' ' || prov.last_name as provider_name
        FROM prescriptions p
        LEFT JOIN providers prov ON p.provider_id = prov.id
        WHERE p.diagnosis_id = $1
        ORDER BY p.prescribed_date DESC
      `;
    }

    const result = await pool.query(query, [req.params.diagnosisId]);
    res.json(result.rows.map(toCamelCase));
  } catch (error) {
    console.error('Error fetching prescriptions for diagnosis:', error);
    res.status(500).json({ error: 'Failed to fetch prescriptions for diagnosis' });
  }
});

// Request refill
router.post('/:id/refill', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const hasEPrescribing = await checkEPrescribingSchema(pool);

    if (!hasEPrescribing) {
      return res.status(501).json({
        error: 'ePrescribing functionality not available',
        message: 'Please run migration 015 to enable ePrescribing features'
      });
    }

    const { requestedBy } = req.body;

    // Check if refills available
    const prescriptionResult = await pool.query(
      'SELECT * FROM prescriptions WHERE id = $1',
      [req.params.id]
    );

    if (prescriptionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Prescription not found' });
    }

    const prescription = prescriptionResult.rows[0];

    if (prescription.refills_remaining <= 0) {
      return res.status(400).json({ error: 'No refills remaining' });
    }

    // Update refills remaining
    const result = await pool.query(`
      UPDATE prescriptions SET
        refills_remaining = refills_remaining - 1,
        last_filled_date = CURRENT_DATE,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [req.params.id]);

    // Log refill
    await pool.query(`
      INSERT INTO prescription_history (
        prescription_id, action, action_by, fill_number
      ) VALUES ($1, $2, $3, $4)
    `, [req.params.id, 'refilled', requestedBy, prescription.refills - prescription.refills_remaining + 1]);

    res.json({
      ...toCamelCase(result.rows[0]),
      message: 'Refill request processed'
    });
  } catch (error) {
    console.error('Error processing refill:', error);
    res.status(500).json({ error: 'Failed to process refill' });
  }
});

module.exports = router;
