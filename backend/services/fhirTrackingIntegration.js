/**
 * FHIR Tracking Integration Helpers
 *
 * Provides integration helpers to add FHIR tracking to prescription and lab order workflows
 */

const pool = require('../config/db');
const fhirTrackingService = require('./fhirTracking');

/**
 * Create FHIR MedicationRequest resource from prescription
 *
 * @param {Object} prescription - Prescription data
 * @param {Object} patientData - Patient data (optional)
 * @param {Object} providerData - Provider data (optional)
 * @returns {Object} FHIR MedicationRequest resource
 */
function createMedicationRequestResource(prescription, patientData = null, providerData = null) {
  const medicationRequest = {
    resourceType: 'MedicationRequest',
    id: prescription.id.toString(),
    status: mapPrescriptionStatusToFHIR(prescription.status),
    intent: 'order',
    priority: 'routine',
    medicationCodeableConcept: {
      coding: []
    },
    subject: {
      reference: `Patient/${prescription.patient_id}`,
      display: patientData ? `${patientData.first_name} ${patientData.last_name}` : undefined
    },
    authoredOn: prescription.prescribed_date || prescription.created_at,
    requester: {
      reference: `Practitioner/${prescription.provider_id}`,
      display: providerData ? `${providerData.first_name} ${providerData.last_name}` : undefined
    },
    dosageInstruction: []
  };

  // Add medication coding
  if (prescription.ndc_code) {
    medicationRequest.medicationCodeableConcept.coding.push({
      system: 'http://hl7.org/fhir/sid/ndc',
      code: prescription.ndc_code,
      display: prescription.medication_name
    });
  }

  if (prescription.medication_name) {
    medicationRequest.medicationCodeableConcept.text = prescription.medication_name;
  }

  // Add dosage instruction
  if (prescription.dosage || prescription.frequency || prescription.instructions) {
    const dosageInstruction = {
      text: prescription.instructions
    };

    if (prescription.dosage) {
      dosageInstruction.doseAndRate = [{
        doseQuantity: {
          value: parseFloat(prescription.dosage) || 0,
          unit: 'dose'
        }
      }];
    }

    if (prescription.frequency) {
      dosageInstruction.timing = {
        code: {
          text: prescription.frequency
        }
      };
    }

    medicationRequest.dosageInstruction.push(dosageInstruction);
  }

  // Add dispense request
  if (prescription.quantity || prescription.refills || prescription.duration) {
    medicationRequest.dispenseRequest = {};

    if (prescription.quantity) {
      medicationRequest.dispenseRequest.quantity = {
        value: prescription.quantity
      };
    }

    if (prescription.refills !== undefined) {
      medicationRequest.dispenseRequest.numberOfRepeatsAllowed = prescription.refills;
    }

    if (prescription.duration) {
      medicationRequest.dispenseRequest.expectedSupplyDuration = {
        value: parseDuration(prescription.duration),
        unit: 'days'
      };
    }
  }

  // Add substitution
  if (prescription.substitution_allowed !== undefined) {
    medicationRequest.substitution = {
      allowedBoolean: prescription.substitution_allowed
    };
  }

  return medicationRequest;
}

/**
 * Map prescription status to FHIR status
 */
function mapPrescriptionStatusToFHIR(status) {
  const statusMap = {
    'Active': 'active',
    'Cancelled': 'cancelled',
    'Completed': 'completed',
    'On Hold': 'on-hold',
    'Stopped': 'stopped',
    'Draft': 'draft'
  };

  return statusMap[status] || 'unknown';
}

/**
 * Parse duration string (e.g., "30 days", "2 weeks") to number of days
 */
function parseDuration(durationStr) {
  if (!durationStr) return 0;

  const match = durationStr.match(/(\d+)\s*(day|week|month)/i);
  if (!match) return 0;

  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();

  const multipliers = {
    'day': 1,
    'week': 7,
    'month': 30
  };

  return value * (multipliers[unit] || 1);
}

/**
 * Initialize tracking for a new prescription
 *
 * @param {Object} params - Tracking parameters
 * @returns {Object} Tracking record
 */
async function initializePrescriptionTracking(params) {
  const {
    prescriptionId,
    prescription,
    patientData = null,
    providerData = null,
    vendorName = null,
    userId = null
  } = params;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create FHIR MedicationRequest resource
    const medicationRequest = createMedicationRequestResource(prescription, patientData, providerData);

    // Store FHIR resource
    const fhirResourceResult = await client.query(
      `INSERT INTO fhir_resources (resource_type, resource_id, patient_id, resource_data, fhir_version)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        'MedicationRequest',
        prescriptionId.toString(),
        prescription.patient_id,
        JSON.stringify(medicationRequest),
        'R4'
      ]
    );

    const fhirResourceId = fhirResourceResult.rows[0].id;

    // Create tracking record
    const tracking = await fhirTrackingService.createTracking({
      resourceType: 'MedicationRequest',
      resourceReference: prescriptionId.toString(),
      fhirResourceId,
      status: prescription.status || 'Active',
      intent: 'order',
      priority: 'routine',
      vendorName,
      createdBy: userId
    });

    // Link tracking to prescription
    await client.query(
      `UPDATE prescriptions SET fhir_tracking_id = $1 WHERE id = $2`,
      [tracking.id, prescriptionId]
    );

    await client.query('COMMIT');
    return tracking;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Update prescription tracking status
 *
 * @param {Object} params - Update parameters
 */
async function updatePrescriptionTracking(params) {
  const {
    prescriptionId,
    status,
    statusReason = null,
    vendorStatus = null,
    vendorTrackingId = null,
    userId = null
  } = params;

  try {
    // Get tracking ID from prescription
    const result = await pool.query(
      'SELECT fhir_tracking_id FROM prescriptions WHERE id = $1',
      [prescriptionId]
    );

    if (result.rows.length === 0 || !result.rows[0].fhir_tracking_id) {
      console.warn(`No tracking found for prescription ${prescriptionId}`);
      return null;
    }

    const trackingId = result.rows[0].fhir_tracking_id;

    // Update tracking status
    return await fhirTrackingService.updateStatus(trackingId, {
      status,
      statusReason,
      vendorStatus,
      vendorTrackingId,
      updatedBy: userId
    });
  } catch (error) {
    console.error('Error updating prescription tracking:', error);
    throw error;
  }
}

/**
 * Record prescription vendor interaction
 *
 * @param {Object} params - Vendor interaction parameters
 */
async function recordPrescriptionVendorInteraction(params) {
  const {
    prescriptionId,
    vendorName,
    vendorTrackingId,
    vendorStatus,
    vendorResponse,
    success = true,
    userId = null
  } = params;

  try {
    // Get tracking ID from prescription
    const result = await pool.query(
      'SELECT fhir_tracking_id FROM prescriptions WHERE id = $1',
      [prescriptionId]
    );

    if (result.rows.length === 0 || !result.rows[0].fhir_tracking_id) {
      console.warn(`No tracking found for prescription ${prescriptionId}`);
      return null;
    }

    const trackingId = result.rows[0].fhir_tracking_id;

    // Record vendor sync
    await fhirTrackingService.recordVendorSync(trackingId, {
      vendorName,
      vendorTrackingId,
      vendorStatus,
      vendorResponse,
      success,
      updatedBy: userId
    });
  } catch (error) {
    console.error('Error recording prescription vendor interaction:', error);
    throw error;
  }
}

/**
 * Record prescription error
 *
 * @param {Object} params - Error parameters
 */
async function recordPrescriptionError(params) {
  const {
    prescriptionId,
    errorCode = null,
    errorMessage,
    errorDetails = {},
    vendorName = null,
    vendorResponse = null,
    userId = null
  } = params;

  try {
    // Get tracking ID from prescription
    const result = await pool.query(
      'SELECT fhir_tracking_id FROM prescriptions WHERE id = $1',
      [prescriptionId]
    );

    if (result.rows.length === 0 || !result.rows[0].fhir_tracking_id) {
      console.warn(`No tracking found for prescription ${prescriptionId}`);
      return null;
    }

    const trackingId = result.rows[0].fhir_tracking_id;

    // Determine error code if not provided
    let finalErrorCode = errorCode;
    if (!finalErrorCode) {
      finalErrorCode = await fhirTrackingService.determineErrorCode(
        errorMessage,
        'MedicationRequest'
      );
    }

    // Record error
    return await fhirTrackingService.recordError(trackingId, {
      errorCode: finalErrorCode,
      errorMessage,
      errorDetails,
      vendorName,
      vendorResponse,
      triggeredBy: userId
    });
  } catch (error) {
    console.error('Error recording prescription error:', error);
    throw error;
  }
}

/**
 * Initialize tracking for a new lab order
 *
 * @param {Object} params - Tracking parameters
 * @returns {Object} Tracking record
 */
async function initializeLabOrderTracking(params) {
  const {
    labOrderId,
    labOrder,
    fhirResourceId = null,
    vendorName = null,
    userId = null
  } = params;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create tracking record
    const tracking = await fhirTrackingService.createTracking({
      resourceType: 'ServiceRequest',
      resourceReference: labOrderId.toString(),
      fhirResourceId,
      status: labOrder.status || 'pending',
      intent: 'order',
      priority: labOrder.priority || 'routine',
      vendorName,
      createdBy: userId
    });

    // Link tracking to lab order
    await client.query(
      `UPDATE lab_orders SET fhir_tracking_id = $1 WHERE id = $2`,
      [tracking.id, labOrderId]
    );

    await client.query('COMMIT');
    return tracking;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Update lab order tracking status
 *
 * @param {Object} params - Update parameters
 */
async function updateLabOrderTracking(params) {
  const {
    labOrderId,
    status,
    statusReason = null,
    vendorStatus = null,
    vendorTrackingId = null,
    userId = null
  } = params;

  try {
    // Get tracking ID from lab order
    const result = await pool.query(
      'SELECT fhir_tracking_id FROM lab_orders WHERE id = $1',
      [labOrderId]
    );

    if (result.rows.length === 0 || !result.rows[0].fhir_tracking_id) {
      console.warn(`No tracking found for lab order ${labOrderId}`);
      return null;
    }

    const trackingId = result.rows[0].fhir_tracking_id;

    // Update tracking status
    return await fhirTrackingService.updateStatus(trackingId, {
      status,
      statusReason,
      vendorStatus,
      vendorTrackingId,
      updatedBy: userId
    });
  } catch (error) {
    console.error('Error updating lab order tracking:', error);
    throw error;
  }
}

/**
 * Record lab order vendor interaction
 *
 * @param {Object} params - Vendor interaction parameters
 */
async function recordLabOrderVendorInteraction(params) {
  const {
    labOrderId,
    vendorName,
    vendorTrackingId,
    vendorStatus,
    vendorResponse,
    success = true,
    userId = null
  } = params;

  try {
    // Get tracking ID from lab order
    const result = await pool.query(
      'SELECT fhir_tracking_id FROM lab_orders WHERE id = $1',
      [labOrderId]
    );

    if (result.rows.length === 0 || !result.rows[0].fhir_tracking_id) {
      console.warn(`No tracking found for lab order ${labOrderId}`);
      return null;
    }

    const trackingId = result.rows[0].fhir_tracking_id;

    // Record vendor sync
    await fhirTrackingService.recordVendorSync(trackingId, {
      vendorName,
      vendorTrackingId,
      vendorStatus,
      vendorResponse,
      success,
      updatedBy: userId
    });
  } catch (error) {
    console.error('Error recording lab order vendor interaction:', error);
    throw error;
  }
}

/**
 * Record lab order error
 *
 * @param {Object} params - Error parameters
 */
async function recordLabOrderError(params) {
  const {
    labOrderId,
    errorCode = null,
    errorMessage,
    errorDetails = {},
    vendorName = null,
    vendorResponse = null,
    userId = null
  } = params;

  try {
    // Get tracking ID from lab order
    const result = await pool.query(
      'SELECT fhir_tracking_id FROM lab_orders WHERE id = $1',
      [labOrderId]
    );

    if (result.rows.length === 0 || !result.rows[0].fhir_tracking_id) {
      console.warn(`No tracking found for lab order ${labOrderId}`);
      return null;
    }

    const trackingId = result.rows[0].fhir_tracking_id;

    // Determine error code if not provided
    let finalErrorCode = errorCode;
    if (!finalErrorCode) {
      finalErrorCode = await fhirTrackingService.determineErrorCode(
        errorMessage,
        'ServiceRequest'
      );
    }

    // Record error
    return await fhirTrackingService.recordError(trackingId, {
      errorCode: finalErrorCode,
      errorMessage,
      errorDetails,
      vendorName,
      vendorResponse,
      triggeredBy: userId
    });
  } catch (error) {
    console.error('Error recording lab order error:', error);
    throw error;
  }
}

module.exports = {
  // Prescription tracking
  initializePrescriptionTracking,
  updatePrescriptionTracking,
  recordPrescriptionVendorInteraction,
  recordPrescriptionError,
  createMedicationRequestResource,

  // Lab order tracking
  initializeLabOrderTracking,
  updateLabOrderTracking,
  recordLabOrderVendorInteraction,
  recordLabOrderError
};
