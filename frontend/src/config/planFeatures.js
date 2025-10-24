export const planFeatures = {
  starter: ['practiceManagement', 'rcm', 'patientPortal'],
  professional: ['practiceManagement', 'ehr', 'telehealth', 'rcm', 'crm', 'patientPortal', 'fhir'],
  enterprise: ['practiceManagement', 'ehr', 'telehealth', 'rcm', 'crm', 'integrations', 'fhir', 'patientPortal']
};

export const hasAccess = (planTier, moduleId) => {
  return planFeatures[planTier]?.includes(moduleId);
};
