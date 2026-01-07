import { useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';

/**
 * Custom hook for comprehensive audit logging
 *
 * Provides functions to log various user actions across forms, modals, and views
 *
 * @returns {Object} Audit logging functions
 */
export const useAudit = () => {
  const { user, api } = useApp();
  const actionStartTime = useRef(null);

  /**
   * Start timing an action (for duration tracking)
   */
  const startAction = useCallback(() => {
    actionStartTime.current = Date.now();
  }, []);

  /**
   * Calculate duration since startAction was called
   * @returns {number|null} Duration in milliseconds, or null if startAction wasn't called
   */
  const getDuration = useCallback(() => {
    if (actionStartTime.current) {
      const duration = Date.now() - actionStartTime.current;
      actionStartTime.current = null;
      return duration;
    }
    return null;
  }, []);

  /**
   * Log an audit event
   *
   * @param {Object} params - Audit log parameters
   * @param {string} params.action_type - Type of action: 'view', 'create', 'update', 'delete', 'submit', 'open', 'close'
   * @param {string} params.resource_type - Type of resource: 'form', 'modal', 'view'
   * @param {string} params.resource_name - Name of the component (e.g., 'DiagnosisForm', 'NewPatientForm')
   * @param {string} [params.resource_id] - ID of the specific resource instance
   * @param {string} [params.action_description] - Human-readable description
   * @param {string} [params.module] - Module name (e.g., 'EHR', 'RCM', 'Admin')
   * @param {Object} [params.old_values] - Previous values (for updates/deletes)
   * @param {Object} [params.new_values] - New values (for creates/updates)
   * @param {string[]} [params.changed_fields] - Fields that changed
   * @param {string} [params.patient_id] - Related patient ID
   * @param {string} [params.provider_id] - Related provider ID
   * @param {string} [params.appointment_id] - Related appointment ID
   * @param {string} [params.claim_id] - Related claim ID
   * @param {string} [params.status='success'] - Status: 'success', 'error', 'warning'
   * @param {string} [params.error_message] - Error message if status is 'error'
   * @param {Object} [params.metadata={}] - Additional context
   * @param {boolean} [params.includeDuration=false] - Whether to include action duration
   * @returns {Promise<void>}
   */
  const logAudit = useCallback(
    async ({
      action_type,
      resource_type,
      resource_name,
      resource_id = null,
      action_description = null,
      module = null,
      old_values = null,
      new_values = null,
      changed_fields = null,
      patient_id = null,
      provider_id = null,
      appointment_id = null,
      claim_id = null,
      status = 'success',
      error_message = null,
      metadata = {},
      includeDuration = false,
    }) => {
      try {
        // Check if api is available
        if (!api || !api.createAuditLog) {
          console.warn('Audit logging unavailable: API not accessible');
          return;
        }

        const auditData = {
          action_type,
          resource_type,
          resource_name,
          resource_id,
          action_description,
          module,
          old_values,
          new_values,
          changed_fields,
          patient_id,
          provider_id,
          appointment_id,
          claim_id,
          status,
          error_message,
          metadata,
        };

        // Include duration if requested
        if (includeDuration) {
          auditData.duration_ms = getDuration();
        }

        // Remove null/undefined values to reduce payload size
        Object.keys(auditData).forEach(key => {
          if (auditData[key] === null || auditData[key] === undefined) {
            delete auditData[key];
          }
        });

        // Send to backend (don't await to avoid blocking UI)
        api.createAuditLog(auditData).catch(err => {
          console.error('Failed to create audit log:', err);
        });
      } catch (error) {
        console.error('Error in logAudit:', error);
      }
    },
    [api, getDuration]
  );

  /**
   * Log form view/open event
   * @param {string} formName - Name of the form
   * @param {Object} options - Additional options
   */
  const logFormView = useCallback(
    (formName, options = {}) => {
      logAudit({
        action_type: 'view',
        resource_type: 'form',
        resource_name: formName,
        action_description: `Opened ${formName}`,
        ...options,
      });
    },
    [logAudit]
  );

  /**
   * Log form submission
   * @param {string} formName - Name of the form
   * @param {Object} formData - Data that was submitted
   * @param {Object} options - Additional options
   */
  const logFormSubmit = useCallback(
    (formName, formData = {}, options = {}) => {
      logAudit({
        action_type: 'submit',
        resource_type: 'form',
        resource_name: formName,
        action_description: `Submitted ${formName}`,
        new_values: formData,
        includeDuration: true,
        ...options,
      });
    },
    [logAudit]
  );

  /**
   * Log modal open event
   * @param {string} modalName - Name of the modal
   * @param {Object} options - Additional options
   */
  const logModalOpen = useCallback(
    (modalName, options = {}) => {
      logAudit({
        action_type: 'open',
        resource_type: 'modal',
        resource_name: modalName,
        action_description: `Opened ${modalName}`,
        ...options,
      });
    },
    [logAudit]
  );

  /**
   * Log modal close event
   * @param {string} modalName - Name of the modal
   * @param {Object} options - Additional options
   */
  const logModalClose = useCallback(
    (modalName, options = {}) => {
      logAudit({
        action_type: 'close',
        resource_type: 'modal',
        resource_name: modalName,
        action_description: `Closed ${modalName}`,
        includeDuration: true,
        ...options,
      });
    },
    [logAudit]
  );

  /**
   * Log view access
   * @param {string} viewName - Name of the view/page
   * @param {Object} options - Additional options
   */
  const logViewAccess = useCallback(
    (viewName, options = {}) => {
      logAudit({
        action_type: 'view',
        resource_type: 'view',
        resource_name: viewName,
        action_description: `Accessed ${viewName}`,
        ...options,
      });
    },
    [logAudit]
  );

  /**
   * Log data creation (from forms)
   * @param {string} resourceName - Name of the resource being created
   * @param {Object} data - Created data
   * @param {Object} options - Additional options
   */
  const logCreate = useCallback(
    (resourceName, data = {}, options = {}) => {
      logAudit({
        action_type: 'create',
        resource_type: 'form',
        resource_name: resourceName,
        action_description: `Created new ${resourceName}`,
        new_values: data,
        includeDuration: true,
        ...options,
      });
    },
    [logAudit]
  );

  /**
   * Log data update (from forms)
   * @param {string} resourceName - Name of the resource being updated
   * @param {Object} oldData - Previous data
   * @param {Object} newData - Updated data
   * @param {Object} options - Additional options
   */
  const logUpdate = useCallback(
    (resourceName, oldData = {}, newData = {}, options = {}) => {
      // Calculate changed fields
      const changed_fields = Object.keys(newData).filter(
        key => JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])
      );

      logAudit({
        action_type: 'update',
        resource_type: 'form',
        resource_name: resourceName,
        action_description: `Updated ${resourceName}`,
        old_values: oldData,
        new_values: newData,
        changed_fields,
        includeDuration: true,
        ...options,
      });
    },
    [logAudit]
  );

  /**
   * Log data deletion
   * @param {string} resourceName - Name of the resource being deleted
   * @param {Object} data - Data that was deleted
   * @param {Object} options - Additional options
   */
  const logDelete = useCallback(
    (resourceName, data = {}, options = {}) => {
      logAudit({
        action_type: 'delete',
        resource_type: 'form',
        resource_name: resourceName,
        action_description: `Deleted ${resourceName}`,
        old_values: data,
        ...options,
      });
    },
    [logAudit]
  );

  /**
   * Log an error/failure
   * @param {string} resourceName - Name of the resource
   * @param {string} resourceType - Type of resource (form/modal/view)
   * @param {string} errorMessage - Error message
   * @param {Object} options - Additional options
   */
  const logError = useCallback(
    (resourceName, resourceType, errorMessage, options = {}) => {
      logAudit({
        action_type: 'error',
        resource_type: resourceType,
        resource_name: resourceName,
        action_description: `Error in ${resourceName}`,
        status: 'error',
        error_message: errorMessage,
        ...options,
      });
    },
    [logAudit]
  );

  return {
    logAudit,
    logFormView,
    logFormSubmit,
    logModalOpen,
    logModalClose,
    logViewAccess,
    logCreate,
    logUpdate,
    logDelete,
    logError,
    startAction,
  };
};

export default useAudit;
