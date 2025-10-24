const express = require('express');
const router = express.Router();

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

    res.status(201).json(result.rows[0]);
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
