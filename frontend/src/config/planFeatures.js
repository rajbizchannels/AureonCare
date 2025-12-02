import { canAccessModule } from '../utils/rolePermissions';

export const planFeatures = {
  starter: ['practiceManagement', 'providerManagement', 'rcm', 'patientPortal'],
  professional: ['practiceManagement', 'providerManagement', 'ehr', 'telehealth', 'rcm', 'crm', 'patientPortal', 'fhir'],
  enterprise: ['practiceManagement', 'providerManagement', 'ehr', 'telehealth', 'rcm', 'crm', 'integrations', 'fhir', 'patientPortal']
};

/**
 * Check if user has access to a module based on both plan tier and role permissions
 * @param {string} planTier - User's subscription plan tier
 * @param {string} moduleId - Module ID to check access for
 * @param {Object} user - User object with role property (optional)
 * @returns {boolean} - True if user has access
 */
export const hasAccess = (planTier, moduleId, user = null) => {
  // Check plan-based access first
  const hasPlanAccess = planFeatures[planTier]?.includes(moduleId);

  // If user object is provided, also check role-based permissions
  if (user) {
    const hasRoleAccess = canAccessModule(user, moduleId);
    // User must have both plan access AND role access
    return hasPlanAccess && hasRoleAccess;
  }

  // If no user provided, just check plan access (backwards compatibility)
  return hasPlanAccess;
};
