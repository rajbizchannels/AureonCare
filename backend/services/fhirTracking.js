/**
 * FHIR Tracking Service
 *
 * Provides comprehensive tracking for FHIR resources (MedicationRequest and ServiceRequest)
 * with end-to-end visibility, error handling, and action suggestions.
 */

const pool = require('../db');

/**
 * Status mappings for different resource types
 */
const STATUS_MAPPINGS = {
  MedicationRequest: {
    // Internal status -> FHIR status
    'draft': 'draft',
    'active': 'active',
    'pending': 'active',
    'on-hold': 'on-hold',
    'cancelled': 'cancelled',
    'completed': 'completed',
    'entered-in-error': 'entered-in-error',
    'stopped': 'stopped',
    'unknown': 'unknown'
  },
  ServiceRequest: {
    // Internal status -> FHIR status
    'draft': 'draft',
    'pending': 'active',
    'active': 'active',
    'sent_to_lab': 'active',
    'in_progress': 'active',
    'on-hold': 'on-hold',
    'cancelled': 'revoked',
    'completed': 'completed',
    'entered-in-error': 'entered-in-error',
    'unknown': 'unknown'
  }
};

class FHIRTrackingService {
  /**
   * Create a new FHIR tracking record
   *
   * @param {Object} params - Tracking parameters
   * @returns {Object} Created tracking record
   */
  async createTracking(params) {
    const {
      resourceType,
      resourceReference,
      fhirResourceId = null,
      status,
      intent = 'order',
      priority = 'routine',
      vendorName = null,
      createdBy = null
    } = params;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Generate unique tracking number
      const trackingNumberResult = await client.query(
        `SELECT generate_fhir_tracking_number($1) as tracking_number`,
        [resourceType]
      );
      const trackingNumber = trackingNumberResult.rows[0].tracking_number;

      // Map to FHIR status
      const fhirStatus = this.mapToFHIRStatus(resourceType, status);

      // Create tracking record
      const result = await client.query(
        `INSERT INTO fhir_tracking (
          fhir_resource_id,
          resource_type,
          resource_reference,
          current_status,
          fhir_status,
          intent,
          priority,
          tracking_number,
          vendor_name,
          created_by,
          updated_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
        RETURNING *`,
        [
          fhirResourceId,
          resourceType,
          resourceReference,
          status,
          fhirStatus,
          intent,
          priority,
          trackingNumber,
          vendorName,
          createdBy
        ]
      );

      const tracking = result.rows[0];

      // Log creation event
      await this.logEvent(client, {
        trackingId: tracking.id,
        eventType: 'created',
        eventDescription: `${resourceType} tracking initiated`,
        toStatus: status,
        eventData: {
          tracking_number: trackingNumber,
          resource_type: resourceType,
          intent,
          priority
        },
        triggeredBy: createdBy
      });

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
   * Update tracking status
   *
   * @param {String} trackingId - Tracking record ID
   * @param {Object} updates - Update parameters
   * @returns {Object} Updated tracking record
   */
  async updateStatus(trackingId, updates) {
    const {
      status,
      statusReason = null,
      vendorStatus = null,
      vendorTrackingId = null,
      updatedBy = null
    } = updates;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get current tracking record
      const currentResult = await client.query(
        'SELECT * FROM fhir_tracking WHERE id = $1',
        [trackingId]
      );

      if (currentResult.rows.length === 0) {
        throw new Error(`Tracking record ${trackingId} not found`);
      }

      const current = currentResult.rows[0];
      const fhirStatus = this.mapToFHIRStatus(current.resource_type, status);

      // Update tracking record
      const result = await client.query(
        `UPDATE fhir_tracking
        SET current_status = $1,
            previous_status = $2,
            fhir_status = $3,
            status_reason = $4,
            vendor_status = COALESCE($5, vendor_status),
            vendor_tracking_id = COALESCE($6, vendor_tracking_id),
            vendor_last_updated = CASE WHEN $5 IS NOT NULL THEN CURRENT_TIMESTAMP ELSE vendor_last_updated END,
            updated_by = $7,
            updated_at = CURRENT_TIMESTAMP,
            completed_at = CASE WHEN $1 IN ('completed', 'cancelled') THEN CURRENT_TIMESTAMP ELSE completed_at END,
            cancelled_at = CASE WHEN $1 = 'cancelled' THEN CURRENT_TIMESTAMP ELSE cancelled_at END
        WHERE id = $8
        RETURNING *`,
        [
          status,
          current.current_status,
          fhirStatus,
          statusReason,
          vendorStatus,
          vendorTrackingId,
          updatedBy,
          trackingId
        ]
      );

      // Log status change event (will be triggered automatically, but we can add custom event)
      await this.logEvent(client, {
        trackingId,
        eventType: 'status_change',
        eventDescription: `Status changed from ${current.current_status} to ${status}`,
        fromStatus: current.current_status,
        toStatus: status,
        eventData: {
          status_reason: statusReason,
          vendor_status: vendorStatus,
          fhir_status: fhirStatus
        },
        triggeredBy: updatedBy
      });

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Record vendor synchronization
   *
   * @param {String} trackingId - Tracking record ID
   * @param {Object} vendorData - Vendor response data
   */
  async recordVendorSync(trackingId, vendorData) {
    const {
      vendorName,
      vendorTrackingId,
      vendorStatus,
      vendorResponse,
      success = true,
      updatedBy = null
    } = vendorData;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Update tracking with vendor info
      await client.query(
        `UPDATE fhir_tracking
        SET vendor_name = $1,
            vendor_tracking_id = $2,
            vendor_status = $3,
            sent_to_vendor_at = COALESCE(sent_to_vendor_at, CURRENT_TIMESTAMP),
            vendor_last_updated = CURRENT_TIMESTAMP,
            updated_by = $4,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $5`,
        [vendorName, vendorTrackingId, vendorStatus, updatedBy, trackingId]
      );

      // Log vendor sync event
      await this.logEvent(client, {
        trackingId,
        eventType: 'vendor_sync',
        eventDescription: success
          ? `Successfully synced with ${vendorName}`
          : `Failed to sync with ${vendorName}`,
        isError: !success,
        vendorName,
        vendorResponse,
        actionTaken: success ? 'Vendor tracking updated' : 'Error logged',
        actionResult: success ? 'success' : 'failed',
        triggeredBy: updatedBy
      });

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Record an error with suggested actions
   *
   * @param {String} trackingId - Tracking record ID
   * @param {Object} errorData - Error details
   */
  async recordError(trackingId, errorData) {
    const {
      errorCode,
      errorMessage,
      errorDetails = {},
      vendorName = null,
      vendorResponse = null,
      triggeredBy = null
    } = errorData;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get current tracking
      const currentResult = await client.query(
        'SELECT * FROM fhir_tracking WHERE id = $1',
        [trackingId]
      );

      if (currentResult.rows.length === 0) {
        throw new Error(`Tracking record ${trackingId} not found`);
      }

      const current = currentResult.rows[0];

      // Look up suggested actions for this error
      const actionResult = await this.getSuggestedActions(
        errorCode,
        current.resource_type,
        vendorName
      );

      const suggestedActions = actionResult?.suggested_actions || [];
      const requiresManualIntervention = actionResult?.requires_manual_intervention || false;
      const autoRetry = actionResult?.auto_retry || false;

      // Update tracking with error info
      await client.query(
        `UPDATE fhir_tracking
        SET has_errors = TRUE,
            error_count = error_count + 1,
            last_error_message = $1,
            last_error_code = $2,
            last_error_at = CURRENT_TIMESTAMP,
            error_details = $3,
            suggested_actions = $4,
            action_required = $5,
            action_deadline = CASE WHEN $5 THEN CURRENT_TIMESTAMP + INTERVAL '24 hours' ELSE NULL END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $6`,
        [
          errorMessage,
          errorCode,
          JSON.stringify(errorDetails),
          JSON.stringify(suggestedActions),
          requiresManualIntervention,
          trackingId
        ]
      );

      // Determine error severity
      const severity = actionResult?.error_severity || 'error';

      // Log error event
      await this.logEvent(client, {
        trackingId,
        eventType: 'error',
        eventDescription: errorMessage,
        isError: true,
        errorCode,
        errorMessage,
        errorSeverity: severity,
        vendorName,
        vendorResponse: vendorResponse ? JSON.stringify(vendorResponse) : null,
        eventData: {
          error_details: errorDetails,
          suggested_actions: suggestedActions,
          auto_retry: autoRetry,
          requires_manual_intervention: requiresManualIntervention
        },
        triggeredBy
      });

      await client.query('COMMIT');

      return {
        errorCode,
        suggestedActions,
        requiresManualIntervention,
        autoRetry,
        severity
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Resolve an error
   *
   * @param {String} trackingId - Tracking record ID
   * @param {Object} resolution - Resolution details
   */
  async resolveError(trackingId, resolution) {
    const {
      actionTaken,
      actionResult = 'success',
      updatedBy = null
    } = resolution;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Update tracking - clear error flags if successful
      if (actionResult === 'success') {
        await client.query(
          `UPDATE fhir_tracking
          SET has_errors = FALSE,
              action_required = FALSE,
              action_deadline = NULL,
              updated_by = $1,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $2`,
          [updatedBy, trackingId]
        );
      }

      // Log resolution event
      await this.logEvent(client, {
        trackingId,
        eventType: 'error_resolved',
        eventDescription: `Error resolved: ${actionTaken}`,
        isError: false,
        actionTaken,
        actionResult,
        triggeredBy: updatedBy
      });

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get tracking information by tracking number
   *
   * @param {String} trackingNumber - Tracking number
   * @returns {Object} Tracking record with events
   */
  async getByTrackingNumber(trackingNumber) {
    const result = await pool.query(
      `SELECT ft.*,
              fr.resource_data as fhir_resource_data,
              (
                SELECT json_agg(fte ORDER BY fte.created_at DESC)
                FROM fhir_tracking_events fte
                WHERE fte.fhir_tracking_id = ft.id
              ) as events
       FROM fhir_tracking ft
       LEFT JOIN fhir_resources fr ON ft.fhir_resource_id = fr.id
       WHERE ft.tracking_number = $1`,
      [trackingNumber]
    );

    return result.rows[0] || null;
  }

  /**
   * Get tracking information by resource reference
   *
   * @param {String} resourceType - Resource type
   * @param {String} resourceReference - Resource reference ID
   * @returns {Object} Tracking record with events
   */
  async getByResource(resourceType, resourceReference) {
    const result = await pool.query(
      `SELECT ft.*,
              fr.resource_data as fhir_resource_data,
              (
                SELECT json_agg(fte ORDER BY fte.created_at DESC)
                FROM fhir_tracking_events fte
                WHERE fte.fhir_tracking_id = ft.id
              ) as events
       FROM fhir_tracking ft
       LEFT JOIN fhir_resources fr ON ft.fhir_resource_id = fr.id
       WHERE ft.resource_type = $1 AND ft.resource_reference = $2`,
      [resourceType, resourceReference]
    );

    return result.rows[0] || null;
  }

  /**
   * Get all tracking records with errors requiring action
   *
   * @returns {Array} Tracking records requiring action
   */
  async getErrorsRequiringAction() {
    const result = await pool.query(
      `SELECT * FROM v_fhir_tracking_errors
       WHERE action_required = TRUE
       ORDER BY last_error_at DESC`
    );

    return result.rows;
  }

  /**
   * Get tracking timeline for a resource
   *
   * @param {String} trackingId - Tracking record ID
   * @returns {Array} Timeline events
   */
  async getTimeline(trackingId) {
    const result = await pool.query(
      `SELECT * FROM v_fhir_tracking_timeline
       WHERE tracking_id = $1
       ORDER BY event_time ASC`,
      [trackingId]
    );

    return result.rows;
  }

  /**
   * Get tracking summary for a patient
   *
   * @param {String} patientId - Patient ID
   * @returns {Object} Summary of prescriptions and lab orders
   */
  async getPatientTrackingSummary(patientId) {
    const prescriptions = await pool.query(
      `SELECT * FROM v_prescription_tracking
       WHERE patient_id = $1
       ORDER BY prescription_created_at DESC`,
      [patientId]
    );

    const labOrders = await pool.query(
      `SELECT * FROM v_lab_order_tracking
       WHERE patient_id = $1
       ORDER BY order_created_at DESC`,
      [patientId]
    );

    return {
      prescriptions: prescriptions.rows,
      labOrders: labOrders.rows,
      summary: {
        total_prescriptions: prescriptions.rows.length,
        total_lab_orders: labOrders.rows.length,
        prescriptions_with_errors: prescriptions.rows.filter(p => p.has_errors).length,
        lab_orders_with_errors: labOrders.rows.filter(l => l.has_errors).length,
        items_requiring_action: [
          ...prescriptions.rows,
          ...labOrders.rows
        ].filter(item => item.action_required).length
      }
    };
  }

  /**
   * Get suggested actions for an error code
   *
   * @param {String} errorCode - Error code
   * @param {String} resourceType - Resource type (optional)
   * @param {String} vendorName - Vendor name (optional)
   * @returns {Object} Error action record
   */
  async getSuggestedActions(errorCode, resourceType = null, vendorName = null) {
    const result = await pool.query(
      `SELECT *
       FROM fhir_error_actions
       WHERE error_code = $1
         AND (resource_type IS NULL OR resource_type = $2)
         AND (vendor_name IS NULL OR vendor_name = $3)
         AND is_active = TRUE
       ORDER BY
         CASE WHEN resource_type IS NOT NULL THEN 1 ELSE 2 END,
         CASE WHEN vendor_name IS NOT NULL THEN 1 ELSE 2 END
       LIMIT 1`,
      [errorCode, resourceType, vendorName]
    );

    return result.rows[0] || null;
  }

  /**
   * Search for errors by pattern matching
   *
   * @param {String} errorMessage - Error message to match
   * @param {String} resourceType - Resource type (optional)
   * @returns {Object} Matched error action
   */
  async findErrorActionByPattern(errorMessage, resourceType = null) {
    const result = await pool.query(
      `SELECT *
       FROM fhir_error_actions
       WHERE $1 ~* error_pattern
         AND (resource_type IS NULL OR resource_type = $2)
         AND is_active = TRUE
       ORDER BY
         CASE WHEN resource_type IS NOT NULL THEN 1 ELSE 2 END
       LIMIT 1`,
      [errorMessage, resourceType]
    );

    return result.rows[0] || null;
  }

  /**
   * Log an event (internal helper)
   *
   * @param {Object} client - Database client
   * @param {Object} eventData - Event data
   */
  async logEvent(client, eventData) {
    const {
      trackingId,
      eventType,
      eventDescription,
      fromStatus = null,
      toStatus = null,
      isError = false,
      errorCode = null,
      errorMessage = null,
      errorSeverity = null,
      vendorName = null,
      vendorResponse = null,
      actionTaken = null,
      actionResult = null,
      eventData: additionalData = null,
      triggeredBy = null
    } = eventData;

    await client.query(
      `INSERT INTO fhir_tracking_events (
        fhir_tracking_id,
        event_type,
        event_description,
        from_status,
        to_status,
        is_error,
        error_code,
        error_message,
        error_severity,
        vendor_name,
        vendor_response,
        action_taken,
        action_result,
        event_data,
        triggered_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        trackingId,
        eventType,
        eventDescription,
        fromStatus,
        toStatus,
        isError,
        errorCode,
        errorMessage,
        errorSeverity,
        vendorName,
        vendorResponse ? JSON.stringify(vendorResponse) : null,
        actionTaken,
        actionResult,
        additionalData ? JSON.stringify(additionalData) : null,
        triggeredBy
      ]
    );
  }

  /**
   * Map internal status to FHIR status
   *
   * @param {String} resourceType - Resource type
   * @param {String} status - Internal status
   * @returns {String} FHIR status
   */
  mapToFHIRStatus(resourceType, status) {
    const mapping = STATUS_MAPPINGS[resourceType];
    if (!mapping) {
      return 'unknown';
    }

    const normalizedStatus = status.toLowerCase().replace(/ /g, '-');
    return mapping[normalizedStatus] || 'unknown';
  }

  /**
   * Determine error code from error message
   *
   * @param {String} errorMessage - Error message
   * @param {String} resourceType - Resource type
   * @returns {String} Error code
   */
  async determineErrorCode(errorMessage, resourceType) {
    // Try to find matching error action by pattern
    const errorAction = await this.findErrorActionByPattern(errorMessage, resourceType);

    if (errorAction) {
      return errorAction.error_code;
    }

    // Default error codes based on common patterns
    const lowerMessage = errorMessage.toLowerCase();

    if (lowerMessage.includes('authentication') || lowerMessage.includes('unauthorized')) {
      return 'FHIR_AUTH_ERROR';
    }
    if (lowerMessage.includes('network') || lowerMessage.includes('timeout') || lowerMessage.includes('connection')) {
      return 'FHIR_NETWORK_ERROR';
    }
    if (lowerMessage.includes('rate limit') || lowerMessage.includes('too many requests')) {
      return 'FHIR_RATE_LIMIT';
    }
    if (lowerMessage.includes('syntax') || lowerMessage.includes('malformed') || lowerMessage.includes('invalid')) {
      return 'FHIR_SYNTAX_ERROR';
    }

    // Resource-specific defaults
    if (resourceType === 'MedicationRequest') {
      if (lowerMessage.includes('patient')) return 'MED_REQ_INVALID_PATIENT';
      if (lowerMessage.includes('medication') || lowerMessage.includes('drug')) return 'MED_REQ_INVALID_MEDICATION';
      if (lowerMessage.includes('prescriber') || lowerMessage.includes('provider')) return 'MED_REQ_MISSING_PRESCRIBER';
      if (lowerMessage.includes('pharmacy')) return 'MED_REQ_PHARMACY_ERROR';
      if (lowerMessage.includes('validation')) return 'MED_REQ_VALIDATION_ERROR';
    } else if (resourceType === 'ServiceRequest') {
      if (lowerMessage.includes('test') || lowerMessage.includes('loinc')) return 'SVC_REQ_INVALID_TEST_CODE';
      if (lowerMessage.includes('specimen')) return 'SVC_REQ_SPECIMEN_ERROR';
      if (lowerMessage.includes('lab') || lowerMessage.includes('laboratory')) return 'SVC_REQ_LAB_UNAVAILABLE';
      if (lowerMessage.includes('insurance') || lowerMessage.includes('authorization')) return 'SVC_REQ_INSURANCE_ERROR';
      if (lowerMessage.includes('priority')) return 'SVC_REQ_PRIORITY_ERROR';
    }

    // Generic validation error
    return 'FHIR_SYNTAX_ERROR';
  }
}

module.exports = new FHIRTrackingService();
