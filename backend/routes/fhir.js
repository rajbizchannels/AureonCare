const express = require('express');
const router = express.Router();
const vendorIntegrationManager = require('../services/vendorIntegrations');

// Get all FHIR resources
router.get('/resources', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { resourceType, patientId } = req.query;

    let query = 'SELECT * FROM fhir_resources WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (resourceType) {
      query += ` AND resource_type = $${paramCount++}`;
      params.push(resourceType);
    }

    if (patientId) {
      query += ` AND patient_id = $${paramCount++}`;
      params.push(patientId);
    }

    query += ' ORDER BY last_updated DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching FHIR resources:', error);
    res.status(500).json({ error: 'Failed to fetch FHIR resources' });
  }
});

// Get single FHIR resource
router.get('/resources/:resourceType/:resourceId', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { resourceType, resourceId } = req.params;

    const result = await pool.query(
      'SELECT * FROM fhir_resources WHERE resource_type = $1 AND resource_id = $2',
      [resourceType, resourceId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching FHIR resource:', error);
    res.status(500).json({ error: 'Failed to fetch FHIR resource' });
  }
});

// Create or update FHIR resource
router.post('/resources', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const {
      resourceType,
      resourceId,
      patientId,
      resourceData,
      fhirVersion = 'R4'
    } = req.body;

    const result = await pool.query(`
      INSERT INTO fhir_resources (
        resource_type,
        resource_id,
        patient_id,
        fhir_version,
        resource_data
      )
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (resource_type, resource_id)
      DO UPDATE SET
        resource_data = $5,
        last_updated = CURRENT_TIMESTAMP
      RETURNING *
    `, [resourceType, resourceId, patientId, fhirVersion, JSON.stringify(resourceData)]);

    const fhirResource = result.rows[0];

    // If this is a ServiceRequest (lab order) and Labcorp is enabled, create lab order and send to vendor
    if (resourceType === 'ServiceRequest' && vendorIntegrationManager.isVendorEnabled('labcorp')) {
      try {
        // Extract lab order details from FHIR ServiceRequest
        const labOrderData = {
          patient_id: patientId,
          provider_id: resourceData.requester?.reference?.split('/')[1], // Extract from Practitioner/ID
          order_type: 'lab_test',
          priority: resourceData.priority || 'routine',
          diagnosis_codes: (resourceData.reasonCode || []).map(rc => ({
            code: rc.coding?.[0]?.code,
            display: rc.coding?.[0]?.display
          })),
          test_codes: (resourceData.code?.coding || []).map(c => ({
            system: c.system,
            code: c.code,
            display: c.display
          })),
          clinical_notes: resourceData.note?.[0]?.text || '',
          specimen_type: resourceData.specimen?.[0]?.type?.coding?.[0]?.code,
          collection_date: resourceData.occurrence?.occurrenceDateTime || new Date().toISOString()
        };

        // Generate order number
        const orderNumber = `LO-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

        // Insert lab order
        const labOrderResult = await pool.query(`
          INSERT INTO lab_orders (
            patient_id,
            provider_id,
            order_number,
            order_type,
            priority,
            status,
            diagnosis_codes,
            test_codes,
            clinical_notes,
            specimen_type,
            collection_date
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING *
        `, [
          labOrderData.patient_id,
          labOrderData.provider_id,
          orderNumber,
          labOrderData.order_type,
          labOrderData.priority,
          'pending',
          JSON.stringify(labOrderData.diagnosis_codes),
          JSON.stringify(labOrderData.test_codes),
          labOrderData.clinical_notes,
          labOrderData.specimen_type,
          labOrderData.collection_date
        ]);

        const labOrder = labOrderResult.rows[0];

        // Send to Labcorp
        const patientResult = await pool.query('SELECT * FROM users WHERE id = $1', [patientId]);
        const providerResult = await pool.query('SELECT * FROM users WHERE id = $1', [labOrderData.provider_id]);

        const labcorp = vendorIntegrationManager.getLabcorp();

        const vendorOrder = {
          ...labOrder,
          patient: patientResult.rows[0],
          provider: providerResult.rows[0]
        };

        const vendorResponse = await labcorp.submitLabOrder(vendorOrder);

        if (vendorResponse.success) {
          // Update lab order with vendor information
          await pool.query(`
            UPDATE lab_orders
            SET
              vendor_order_id = $1,
              vendor_status = $2,
              sent_to_vendor_at = $3,
              vendor_response = $4,
              status = 'sent_to_lab'
            WHERE id = $5
          `, [
            vendorResponse.vendorOrderId,
            vendorResponse.status,
            vendorResponse.submittedAt,
            JSON.stringify(vendorResponse.response),
            labOrder.id
          ]);

          // Log transaction
          await vendorIntegrationManager.logTransaction('labcorp', 'lab_order_submit_fhir', {
            request: vendorOrder,
            response: vendorResponse.response,
            status: 'success',
            externalId: vendorResponse.vendorOrderId,
            internalReferenceId: labOrder.id,
            patientId: patientId
          });

          // Add reference to lab order in FHIR resource
          fhirResource.lab_order_id = labOrder.id;
          fhirResource.vendor_order_id = vendorResponse.vendorOrderId;
        } else {
          // Log failed transaction
          await vendorIntegrationManager.logTransaction('labcorp', 'lab_order_submit_fhir', {
            request: vendorOrder,
            response: vendorResponse.response,
            status: 'failed',
            error: vendorResponse.error,
            internalReferenceId: labOrder.id,
            patientId: patientId
          });
        }
      } catch (labOrderError) {
        console.error('Error creating lab order from FHIR ServiceRequest:', labOrderError);
        // Don't fail the FHIR resource creation if lab order fails
      }
    }

    res.status(201).json(fhirResource);
  } catch (error) {
    console.error('Error creating FHIR resource:', error);
    res.status(500).json({ error: 'Failed to create FHIR resource' });
  }
});

// Convert patient to FHIR Patient resource
router.get('/patient/:patientId', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { patientId } = req.params;

    const patient = await pool.query(
      'SELECT * FROM patients WHERE id = $1',
      [patientId]
    );

    if (patient.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const p = patient.rows[0];

    // Convert to FHIR R4 Patient resource
    const fhirPatient = {
      resourceType: 'Patient',
      id: p.id,
      identifier: [
        {
          use: 'official',
          type: {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
                code: 'MR',
                display: 'Medical Record Number'
              }
            ]
          },
          value: p.mrn
        }
      ],
      active: p.status === 'active',
      name: [
        {
          use: 'official',
          family: p.last_name,
          given: [p.first_name]
        }
      ],
      telecom: [
        ...(p.phone ? [{
          system: 'phone',
          value: p.phone,
          use: 'mobile'
        }] : []),
        ...(p.email ? [{
          system: 'email',
          value: p.email
        }] : [])
      ],
      gender: p.gender?.toLowerCase(),
      birthDate: p.date_of_birth,
      address: p.address ? [p.address] : []
    };

    res.json(fhirPatient);
  } catch (error) {
    console.error('Error converting patient to FHIR:', error);
    res.status(500).json({ error: 'Failed to convert patient to FHIR' });
  }
});

// Sync patient data to FHIR
router.post('/sync/patient/:patientId', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { patientId } = req.params;

    // Get patient data
    const patient = await pool.query(
      'SELECT * FROM patients WHERE id = $1',
      [patientId]
    );

    if (patient.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const p = patient.rows[0];

    // Convert to FHIR Patient resource
    const fhirPatient = {
      resourceType: 'Patient',
      id: p.id,
      identifier: [{ use: 'official', value: p.mrn }],
      active: p.status === 'active',
      name: [{ use: 'official', family: p.last_name, given: [p.first_name] }],
      telecom: [
        ...(p.phone ? [{ system: 'phone', value: p.phone }] : []),
        ...(p.email ? [{ system: 'email', value: p.email }] : [])
      ],
      gender: p.gender?.toLowerCase(),
      birthDate: p.date_of_birth,
      address: p.address ? [p.address] : []
    };

    // Store in FHIR resources table
    const result = await pool.query(`
      INSERT INTO fhir_resources (
        resource_type,
        resource_id,
        patient_id,
        fhir_version,
        resource_data
      )
      VALUES ('Patient', $1, $2, 'R4', $3)
      ON CONFLICT (resource_type, resource_id)
      DO UPDATE SET
        resource_data = $3,
        last_updated = CURRENT_TIMESTAMP
      RETURNING *
    `, [p.id, p.id, JSON.stringify(fhirPatient)]);

    res.json({
      message: 'Patient synced to FHIR successfully',
      resource: result.rows[0]
    });
  } catch (error) {
    console.error('Error syncing patient to FHIR:', error);
    res.status(500).json({ error: 'Failed to sync patient to FHIR' });
  }
});

// Get FHIR bundle for patient
router.get('/bundle/:patientId', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { patientId } = req.params;

    const resources = await pool.query(
      'SELECT * FROM fhir_resources WHERE patient_id = $1 ORDER BY last_updated DESC',
      [patientId]
    );

    const bundle = {
      resourceType: 'Bundle',
      type: 'searchset',
      total: resources.rows.length,
      entry: resources.rows.map(r => ({
        fullUrl: `urn:uuid:${r.id}`,
        resource: r.resource_data
      }))
    };

    res.json(bundle);
  } catch (error) {
    console.error('Error creating FHIR bundle:', error);
    res.status(500).json({ error: 'Failed to create FHIR bundle' });
  }
});

module.exports = router;
