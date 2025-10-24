export const planFeatures = {
  starter: ['practiceManagement', 'rcm'],
  professional: ['practiceManagement', 'ehr', 'telehealth', 'rcm', 'crm'],
  enterprise: ['practiceManagement', 'ehr', 'telehealth', 'rcm', 'crm', 'integrations']
};

export const hasAccess = (planTier, moduleId) => {
  return planFeatures[planTier]?.includes(moduleId);
};
