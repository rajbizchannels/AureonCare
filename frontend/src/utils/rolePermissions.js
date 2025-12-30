/**
 * Role-Based Access Control (RBAC) Utilities
 * Maps user roles to their default permissions for modules and features
 */

// Default permissions for each role
// These match the permissions defined in the database migration 014_create_rbac_and_plans.sql
export const rolePermissions = {
  admin: {
    patients: { view: true, create: true, edit: true, delete: true },
    appointments: { view: true, create: true, edit: true, delete: true },
    billing: { view: true, create: true, edit: true, process: true },
    crm: { view: true, create: true, edit: true, delete: true },
    ehr: { view: true, create: true, edit: true },
    reports: { view: true, export: true },
    admin: { users: true, roles: true, plans: true, settings: true }
  },
  doctor: {
    patients: { view: true, create: true, edit: true, delete: true },
    appointments: { view: true, create: true, edit: true, delete: true },
    billing: { view: false, create: false, edit: false, process: false },
    crm: { view: false, create: false, edit: false, delete: false },
    ehr: { view: true, create: true, edit: true },
    reports: { view: true, export: true },
    admin: { users: false, roles: false, plans: false, settings: false }
  },
  patient: {
    patients: { view: false, create: false, edit: false, delete: false },
    appointments: { view: true, create: true, edit: false, delete: false },
    billing: { view: false, create: false, edit: false, process: false },
    crm: { view: false, create: false, edit: false, delete: false },
    ehr: { view: true, create: false, edit: false },
    reports: { view: false, export: false },
    admin: { users: false, roles: false, plans: false, settings: false }
  },
  nurse: {
    patients: { view: true, create: true, edit: true, delete: false },
    appointments: { view: true, create: true, edit: true, delete: false },
    billing: { view: false, create: false, edit: false, process: false },
    crm: { view: false, create: false, edit: false, delete: false },
    ehr: { view: true, create: true, edit: true },
    reports: { view: false, export: false },
    admin: { users: false, roles: false, plans: false, settings: false }
  },
  receptionist: {
    patients: { view: true, create: true, edit: true, delete: false },
    appointments: { view: true, create: true, edit: true, delete: false },
    billing: { view: false, create: false, edit: false, process: false },
    crm: { view: false, create: false, edit: false, delete: false },
    ehr: { view: false, create: false, edit: false },
    reports: { view: false, export: false },
    admin: { users: false, roles: false, plans: false, settings: false }
  },
  billing_manager: {
    patients: { view: true, create: false, edit: false, delete: false },
    appointments: { view: false, create: false, edit: false, delete: false },
    billing: { view: true, create: true, edit: true, process: true },
    crm: { view: false, create: false, edit: false, delete: false },
    ehr: { view: false, create: false, edit: false },
    reports: { view: true, export: true },
    admin: { users: false, roles: false, plans: false, settings: false }
  },
  crm_manager: {
    patients: { view: false, create: false, edit: false, delete: false },
    appointments: { view: false, create: false, edit: false, delete: false },
    billing: { view: false, create: false, edit: false, process: false },
    crm: { view: true, create: true, edit: true, delete: true },
    ehr: { view: false, create: false, edit: false },
    reports: { view: true, export: true },
    admin: { users: false, roles: false, plans: false, settings: false }
  },
  staff: {
    patients: { view: true, create: false, edit: false, delete: false },
    appointments: { view: true, create: false, edit: false, delete: false },
    billing: { view: false, create: false, edit: false, process: false },
    crm: { view: false, create: false, edit: false, delete: false },
    ehr: { view: false, create: false, edit: false },
    reports: { view: false, export: false },
    admin: { users: false, roles: false, plans: false, settings: false }
  }
};

// Map modules to required permissions
export const modulePermissions = {
  dashboard: null, // Dashboard is accessible to all authenticated users
  practiceManagement: 'appointments', // Requires appointments.view
  providerManagement: 'patients', // Requires patients.view
  ehr: 'ehr', // Requires ehr.view
  telehealth: 'appointments', // Requires appointments.view
  rcm: 'billing', // Requires billing.view
  crm: 'crm', // Requires crm.view
  reports: 'reports', // Requires reports.view
  integrations: 'admin', // Requires admin permissions
  clinicalServices: 'ehr', // Requires ehr.view (includes FHIR, pharmacies, laboratories)
  patientPortal: null, // Patients can access their own portal
  adminPanel: 'admin', // Requires admin.users
  offeringManagement: 'admin' // Requires admin.settings
};

/**
 * Check if a user has a specific permission
 * @param {Object} user - User object with role property
 * @param {string} module - Module name (e.g., 'patients', 'appointments')
 * @param {string} action - Action name (e.g., 'view', 'create', 'edit', 'delete')
 * @returns {boolean} - True if user has permission
 */
export const hasPermission = (user, module, action) => {
  if (!user || !user.role) return false;

  const role = user.role;
  const permissions = rolePermissions[role];

  if (!permissions) return false;
  if (!permissions[module]) return false;

  return permissions[module][action] === true;
};

/**
 * Check if a user can access a module
 * @param {Object} user - User object with role property
 * @param {string} moduleId - Module ID (e.g., 'practiceManagement', 'ehr')
 * @returns {boolean} - True if user can access the module
 */
export const canAccessModule = (user, moduleId) => {
  if (!user || !user.role) return false;

  // Admin can access everything
  if (user.role === 'admin') return true;

  // Patient portal is accessible to patients only
  if (moduleId === 'patientPortal') {
    return user.role === 'patient';
  }

  // Admin panel is only for admin
  if (moduleId === 'adminPanel' || moduleId === 'offeringManagement') {
    return user.role === 'admin';
  }

  // Dashboard is accessible to all
  if (moduleId === 'dashboard') return true;

  // Get required permission for module
  const requiredModule = modulePermissions[moduleId];
  if (!requiredModule) return true; // No specific permission required

  // Check if user has view permission for the required module
  return hasPermission(user, requiredModule, 'view');
};

/**
 * Check if a user can perform an action (for buttons, forms, etc.)
 * @param {Object} user - User object with role property
 * @param {string} module - Module name
 * @param {string} action - Action name
 * @returns {boolean} - True if user can perform the action
 */
export const canPerformAction = (user, module, action) => {
  return hasPermission(user, module, action);
};

/**
 * Get all accessible modules for a user
 * @param {Object} user - User object with role property
 * @param {Array} allModules - Array of all available modules
 * @returns {Array} - Filtered array of accessible modules
 */
export const getAccessibleModules = (user, allModules) => {
  if (!user || !allModules) return [];

  return allModules.filter(module => canAccessModule(user, module.id));
};

/**
 * Check if user is admin
 * @param {Object} user - User object with role property
 * @returns {boolean} - True if user is admin
 */
export const isAdmin = (user) => {
  return user?.role === 'admin';
};

/**
 * Check if user is a medical provider (doctor/nurse)
 * @param {Object} user - User object with role property
 * @returns {boolean} - True if user is a provider
 */
export const isProvider = (user) => {
  return user?.role === 'doctor' || user?.role === 'nurse';
};

/**
 * Check if user is a patient
 * @param {Object} user - User object with role property
 * @returns {boolean} - True if user is a patient
 */
export const isPatient = (user) => {
  return user?.role === 'patient';
};
