import { useApp } from '../context/AppContext';
import {
  hasPermission,
  canAccessModule,
  canPerformAction,
  getAccessibleModules,
  isAdmin,
  isProvider,
  isPatient
} from '../utils/rolePermissions';

/**
 * Hook for checking user permissions throughout the application
 * @returns {Object} - Permission checking functions
 */
export const usePermissions = () => {
  const { user } = useApp();

  return {
    /**
     * Check if user has a specific permission
     * @param {string} module - Module name (e.g., 'patients', 'appointments')
     * @param {string} action - Action name (e.g., 'view', 'create', 'edit', 'delete')
     * @returns {boolean} - True if user has permission
     */
    hasPermission: (module, action) => hasPermission(user, module, action),

    /**
     * Check if user can access a module
     * @param {string} moduleId - Module ID (e.g., 'practiceManagement', 'ehr')
     * @returns {boolean} - True if user can access the module
     */
    canAccessModule: (moduleId) => canAccessModule(user, moduleId),

    /**
     * Check if user can perform an action
     * @param {string} module - Module name
     * @param {string} action - Action name
     * @returns {boolean} - True if user can perform the action
     */
    canPerformAction: (module, action) => canPerformAction(user, module, action),

    /**
     * Get all accessible modules for the current user
     * @param {Array} allModules - Array of all available modules
     * @returns {Array} - Filtered array of accessible modules
     */
    getAccessibleModules: (allModules) => getAccessibleModules(user, allModules),

    /**
     * Check if current user is admin
     * @returns {boolean} - True if user is admin
     */
    isAdmin: () => isAdmin(user),

    /**
     * Check if current user is a provider (doctor/nurse)
     * @returns {boolean} - True if user is a provider
     */
    isProvider: () => isProvider(user),

    /**
     * Check if current user is a patient
     * @returns {boolean} - True if user is a patient
     */
    isPatient: () => isPatient(user),

    /**
     * Get current user object
     * @returns {Object} - Current user
     */
    user
  };
};
