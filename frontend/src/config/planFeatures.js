export const planFeatures = {
  starter: ['practiceManagement', 'providerManagement', 'rcm', 'patientPortal'],
  professional: ['practiceManagement', 'providerManagement', 'ehr', 'telehealth', 'rcm', 'crm', 'patientPortal', 'fhir'],
  enterprise: ['practiceManagement', 'providerManagement', 'ehr', 'telehealth', 'rcm', 'crm', 'integrations', 'fhir', 'patientPortal']
};

export const hasAccess = (planTier, moduleId) => {
  return planFeatures[planTier]?.includes(moduleId);
};
