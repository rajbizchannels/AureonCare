/**
 * FHIR Tracking Routes
 *
 * API endpoints for FHIR resource tracking (MedicationRequest and ServiceRequest)
 */

const express = require('express');
const router = express.Router();
const fhirTrackingService = require('../services/fhirTracking');
const { authenticate } = require('../middleware/auth');

/**
 * GET /api/fhir-tracking/:trackingNumber
 * Get tracking information by tracking number
 */
router.get('/:trackingNumber', authenticate, async (req, res) => {
  try {
    const { trackingNumber } = req.params;

    const tracking = await fhirTrackingService.getByTrackingNumber(trackingNumber);

    if (!tracking) {
      return res.status(404).json({
        error: 'Tracking record not found',
        trackingNumber
      });
    }

    res.json({
      success: true,
      tracking
    });
  } catch (error) {
    console.error('Error fetching tracking:', error);
    res.status(500).json({
      error: 'Failed to fetch tracking information',
      message: error.message
    });
  }
});

/**
 * GET /api/fhir-tracking/resource/:resourceType/:resourceId
 * Get tracking information by resource type and ID
 */
router.get('/resource/:resourceType/:resourceId', authenticate, async (req, res) => {
  try {
    const { resourceType, resourceId } = req.params;

    // Validate resource type
    if (!['MedicationRequest', 'ServiceRequest'].includes(resourceType)) {
      return res.status(400).json({
        error: 'Invalid resource type',
        validTypes: ['MedicationRequest', 'ServiceRequest']
      });
    }

    const tracking = await fhirTrackingService.getByResource(resourceType, resourceId);

    if (!tracking) {
      return res.status(404).json({
        error: 'Tracking record not found',
        resourceType,
        resourceId
      });
    }

    res.json({
      success: true,
      tracking
    });
  } catch (error) {
    console.error('Error fetching tracking by resource:', error);
    res.status(500).json({
      error: 'Failed to fetch tracking information',
      message: error.message
    });
  }
});

/**
 * GET /api/fhir-tracking/:trackingId/timeline
 * Get complete timeline for a tracking record
 */
router.get('/:trackingId/timeline', authenticate, async (req, res) => {
  try {
    const { trackingId } = req.params;

    const timeline = await fhirTrackingService.getTimeline(trackingId);

    res.json({
      success: true,
      timeline,
      count: timeline.length
    });
  } catch (error) {
    console.error('Error fetching tracking timeline:', error);
    res.status(500).json({
      error: 'Failed to fetch tracking timeline',
      message: error.message
    });
  }
});

/**
 * GET /api/fhir-tracking/patient/:patientId/summary
 * Get tracking summary for a patient
 */
router.get('/patient/:patientId/summary', authenticate, async (req, res) => {
  try {
    const { patientId } = req.params;

    const summary = await fhirTrackingService.getPatientTrackingSummary(patientId);

    res.json({
      success: true,
      patientId,
      ...summary
    });
  } catch (error) {
    console.error('Error fetching patient tracking summary:', error);
    res.status(500).json({
      error: 'Failed to fetch patient tracking summary',
      message: error.message
    });
  }
});

/**
 * GET /api/fhir-tracking/errors/action-required
 * Get all tracking records with errors requiring action
 */
router.get('/errors/action-required', authenticate, async (req, res) => {
  try {
    const errors = await fhirTrackingService.getErrorsRequiringAction();

    res.json({
      success: true,
      errors,
      count: errors.length
    });
  } catch (error) {
    console.error('Error fetching errors requiring action:', error);
    res.status(500).json({
      error: 'Failed to fetch errors',
      message: error.message
    });
  }
});

/**
 * POST /api/fhir-tracking
 * Create a new tracking record
 */
router.post('/', authenticate, async (req, res) => {
  try {
    const {
      resourceType,
      resourceReference,
      fhirResourceId,
      status,
      intent,
      priority,
      vendorName
    } = req.body;

    // Validate required fields
    if (!resourceType || !resourceReference || !status) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['resourceType', 'resourceReference', 'status']
      });
    }

    // Validate resource type
    if (!['MedicationRequest', 'ServiceRequest'].includes(resourceType)) {
      return res.status(400).json({
        error: 'Invalid resource type',
        validTypes: ['MedicationRequest', 'ServiceRequest']
      });
    }

    const tracking = await fhirTrackingService.createTracking({
      resourceType,
      resourceReference,
      fhirResourceId,
      status,
      intent,
      priority,
      vendorName,
      createdBy: req.user.id
    });

    res.status(201).json({
      success: true,
      tracking
    });
  } catch (error) {
    console.error('Error creating tracking:', error);
    res.status(500).json({
      error: 'Failed to create tracking record',
      message: error.message
    });
  }
});

/**
 * PUT /api/fhir-tracking/:trackingId/status
 * Update tracking status
 */
router.put('/:trackingId/status', authenticate, async (req, res) => {
  try {
    const { trackingId } = req.params;
    const {
      status,
      statusReason,
      vendorStatus,
      vendorTrackingId
    } = req.body;

    if (!status) {
      return res.status(400).json({
        error: 'Status is required'
      });
    }

    const tracking = await fhirTrackingService.updateStatus(trackingId, {
      status,
      statusReason,
      vendorStatus,
      vendorTrackingId,
      updatedBy: req.user.id
    });

    res.json({
      success: true,
      tracking
    });
  } catch (error) {
    console.error('Error updating tracking status:', error);
    res.status(500).json({
      error: 'Failed to update tracking status',
      message: error.message
    });
  }
});

/**
 * POST /api/fhir-tracking/:trackingId/vendor-sync
 * Record vendor synchronization
 */
router.post('/:trackingId/vendor-sync', authenticate, async (req, res) => {
  try {
    const { trackingId } = req.params;
    const {
      vendorName,
      vendorTrackingId,
      vendorStatus,
      vendorResponse,
      success
    } = req.body;

    if (!vendorName) {
      return res.status(400).json({
        error: 'vendorName is required'
      });
    }

    await fhirTrackingService.recordVendorSync(trackingId, {
      vendorName,
      vendorTrackingId,
      vendorStatus,
      vendorResponse,
      success,
      updatedBy: req.user.id
    });

    res.json({
      success: true,
      message: 'Vendor synchronization recorded'
    });
  } catch (error) {
    console.error('Error recording vendor sync:', error);
    res.status(500).json({
      error: 'Failed to record vendor synchronization',
      message: error.message
    });
  }
});

/**
 * POST /api/fhir-tracking/:trackingId/error
 * Record an error with suggested actions
 */
router.post('/:trackingId/error', authenticate, async (req, res) => {
  try {
    const { trackingId } = req.params;
    const {
      errorCode,
      errorMessage,
      errorDetails,
      vendorName,
      vendorResponse
    } = req.body;

    if (!errorMessage) {
      return res.status(400).json({
        error: 'errorMessage is required'
      });
    }

    // If no error code provided, try to determine it
    let finalErrorCode = errorCode;
    if (!finalErrorCode) {
      // Get tracking to determine resource type
      const tracking = await fhirTrackingService.getByTrackingNumber(trackingId);
      if (tracking) {
        finalErrorCode = await fhirTrackingService.determineErrorCode(
          errorMessage,
          tracking.resource_type
        );
      } else {
        finalErrorCode = 'FHIR_SYNTAX_ERROR'; // Default
      }
    }

    const result = await fhirTrackingService.recordError(trackingId, {
      errorCode: finalErrorCode,
      errorMessage,
      errorDetails,
      vendorName,
      vendorResponse,
      triggeredBy: req.user.id
    });

    res.json({
      success: true,
      errorRecorded: true,
      ...result
    });
  } catch (error) {
    console.error('Error recording error:', error);
    res.status(500).json({
      error: 'Failed to record error',
      message: error.message
    });
  }
});

/**
 * POST /api/fhir-tracking/:trackingId/resolve-error
 * Resolve an error
 */
router.post('/:trackingId/resolve-error', authenticate, async (req, res) => {
  try {
    const { trackingId } = req.params;
    const {
      actionTaken,
      actionResult
    } = req.body;

    if (!actionTaken) {
      return res.status(400).json({
        error: 'actionTaken is required'
      });
    }

    await fhirTrackingService.resolveError(trackingId, {
      actionTaken,
      actionResult,
      updatedBy: req.user.id
    });

    res.json({
      success: true,
      message: 'Error resolved'
    });
  } catch (error) {
    console.error('Error resolving error:', error);
    res.status(500).json({
      error: 'Failed to resolve error',
      message: error.message
    });
  }
});

/**
 * GET /api/fhir-tracking/actions/:errorCode
 * Get suggested actions for an error code
 */
router.get('/actions/:errorCode', authenticate, async (req, res) => {
  try {
    const { errorCode } = req.params;
    const { resourceType, vendorName } = req.query;

    const actions = await fhirTrackingService.getSuggestedActions(
      errorCode,
      resourceType,
      vendorName
    );

    if (!actions) {
      return res.status(404).json({
        error: 'No actions found for error code',
        errorCode
      });
    }

    res.json({
      success: true,
      errorCode,
      ...actions
    });
  } catch (error) {
    console.error('Error fetching suggested actions:', error);
    res.status(500).json({
      error: 'Failed to fetch suggested actions',
      message: error.message
    });
  }
});

module.exports = router;
