import { canAccessModule } from '../utils/rolePermissions';

/**
 * Module lists per subscription tier.
 * A module must appear here AND the user must have a role that permits it
 * (checked via canAccessModule) before it is rendered.
 *
 * Tier names match subscription_plans.name in the database:
 *   essentials | clinical_pro | enterprise | onprem
 *
 * Legacy tier names (free, starter, professional) are aliased below for
 * installations that have not yet run migration 053.
 */
export const planFeatures = {
  // ── Tier 1: Practice Essentials ───────────────────────────────────────────
  essentials: [
    'dashboard',
    'practiceManagement',
    'providerManagement',
    'ehr',
    'patientPortal',
    'messages',
    'clinicalServices',
    'reports',
    'formManagement',
    'accounts',
    'inventory',
    'adminPanel',
  ],

  // ── Tier 2: Clinical Pro ──────────────────────────────────────────────────
  clinical_pro: [
    'dashboard',
    'practiceManagement',
    'providerManagement',
    'ehr',
    'telehealth',
    'rcm',
    'crm',
    'patientPortal',
    'messages',
    'clinicalServices',
    'camps',
    'offerings',
    'reports',
    'formManagement',
    'accounts',
    'inventory',
    'adminPanel',
  ],

  // ── Tier 3: Enterprise ────────────────────────────────────────────────────
  enterprise: [
    'dashboard',
    'practiceManagement',
    'providerManagement',
    'ehr',
    'telehealth',
    'rcm',
    'crm',
    'integrations',
    'patientPortal',
    'messages',
    'clinicalServices',
    'camps',
    'offerings',
    'reports',
    'formManagement',
    'accounts',
    'inventory',
    'adminPanel',
  ],

  // ── Tier 4: On-Premises / Customer Cloud ──────────────────────────────────
  onprem: [
    'dashboard',
    'practiceManagement',
    'providerManagement',
    'ehr',
    'telehealth',
    'rcm',
    'crm',
    'integrations',
    'patientPortal',
    'messages',
    'clinicalServices',
    'camps',
    'offerings',
    'reports',
    'formManagement',
    'accounts',
    'inventory',
    'adminPanel',
  ],
};

// Legacy tier aliases — keeps old plan_tier values working before migration 053
planFeatures.free         = planFeatures.essentials;
planFeatures.starter      = planFeatures.essentials;
planFeatures.professional = planFeatures.clinical_pro;

/** Human-readable display names keyed by tier name. */
export const planDisplayNames = {
  essentials:   'Practice Essentials',
  clinical_pro: 'Clinical Pro',
  enterprise:   'Enterprise',
  onprem:       'On-Premises / Customer Cloud',
  free:         'Practice Essentials',
  starter:      'Practice Essentials',
  professional: 'Clinical Pro',
};

/** Ordered from cheapest to most capable — used for upgrade-path logic. */
export const planTierOrder = ['essentials', 'clinical_pro', 'enterprise', 'onprem'];

/** Returns true when targetTier is a higher tier than currentTier. */
export function isUpgrade(currentTier, targetTier) {
  const cur = planTierOrder.indexOf(currentTier);
  const tgt = planTierOrder.indexOf(targetTier);
  return tgt > cur;
}

/**
 * Returns the lowest tier that includes moduleId — used for "upgrade to unlock" UI.
 */
export function minimumTierForModule(moduleId) {
  return planTierOrder.find(tier => planFeatures[tier]?.includes(moduleId)) ?? null;
}

/**
 * Check whether the given plan tier AND user role both permit access to a module.
 *
 * @param {string}      planTier - subscription_plans.name value
 * @param {string}      moduleId - e.g. 'telehealth', 'rcm'
 * @param {object|null} user     - user object with .role property (optional)
 * @returns {boolean}
 */
export const hasAccess = (planTier, moduleId, user = null) => {
  const tier    = planTier || 'essentials';
  const modules = planFeatures[tier] ?? planFeatures.essentials;
  const hasPlanAccess = modules.includes(moduleId);

  if (user) {
    const hasRoleAccess = canAccessModule(user, moduleId);
    return hasPlanAccess && hasRoleAccess;
  }

  return hasPlanAccess;
};

/**
 * The third axis of module visibility: specialty.
 *
 * Plan tier and role decide what a practice MAY see. A specialty pack only ever decides
 * what it sees BY DEFAULT, and only ever subtracts:
 *
 *     visible = (plan ∩ role) \ (specialtyHidden \ adminPinned)
 *
 * It cannot reveal a module the plan or the role forbids — that would be an entitlement
 * bypass dressed as configuration — and an administrator can always pin a module back,
 * because hiding something a practice pays for with no way back is both a support burden
 * and lost upsell surface.
 */
export const isModuleVisible = (planTier, moduleId, user = null, setup = null) => {
  if (!hasAccess(planTier, moduleId, user)) return false;
  if (!setup) return true;
  const hidden = Array.isArray(setup.hiddenModules) ? setup.hiddenModules : [];
  if (!hidden.includes(moduleId)) return true;
  const pinned = Array.isArray(setup.pinnedModules) ? setup.pinnedModules : [];
  return pinned.includes(moduleId);
};

/** Modules a specialty pack is hiding that the plan and role would otherwise allow. */
export const hiddenBySpecialty = (planTier, user, setup) => {
  if (!setup || !Array.isArray(setup.hiddenModules)) return [];
  const pinned = Array.isArray(setup.pinnedModules) ? setup.pinnedModules : [];
  return setup.hiddenModules.filter(
    (m) => !pinned.includes(m) && hasAccess(planTier, m, user)
  );
};

