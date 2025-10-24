export const translations = {
  en: {
    dashboard: 'Dashboard',
    practiceManagement: 'Practice Management',
    ehr: 'Electronic Health Records',
    telehealth: 'Telehealth',
    rcm: 'Revenue Cycle Management',
    crm: 'Patient CRM',
    integrations: 'Integrations',
    welcome: 'Welcome back',
    todaysAppointments: "Today's Appointments",
    pendingTasks: 'Pending Tasks',
    revenue: 'Revenue This Month',
    activePatients: 'Active Patients',
    backToDashboard: 'Back to Dashboard'
  }
};

export const getTranslations = (language = 'en') => {
  return translations[language] || translations['en'];
};
