// API Configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

console.log('API Service: Base URL configured as:', API_BASE_URL);

/**
 * Get authentication headers from localStorage
 * @returns {Object} Headers object with authentication info
 */
const getAuthHeaders = () => {
  const headers = {
    'Content-Type': 'application/json'
  };

  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user && user.id) {
      headers['x-user-id'] = user.id;
      headers['x-user-role'] = user.role || 'patient';
    }
  } catch (error) {
    console.error('Error parsing user from localStorage:', error);
  }

  return headers;
};

/**
 * Make an authenticated fetch request
 * @param {string} url - The URL to fetch
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>} Fetch response
 */
const authenticatedFetch = async (url, options = {}) => {
  const authHeaders = getAuthHeaders();
  const mergedOptions = {
    ...options,
    headers: {
      ...authHeaders,
      ...(options.headers || {})
    }
  };
  return fetch(url, mergedOptions);
};

// API Service
const api = {
  // Appointments
  getAppointments: async () => {
    console.log('API: Fetching appointments from:', `${API_BASE_URL}/appointments`);
    try {
      const response = await fetch(`${API_BASE_URL}/appointments`);
      console.log('API: Appointments response status:', response.status);
      if (!response.ok) throw new Error(`Failed to fetch appointments: ${response.status}`);
      const data = await response.json();
      console.log('API: Appointments fetched successfully, count:', data.length);
      return data;
    } catch (error) {
      console.error('API: Error fetching appointments:', error);
      throw error;
    }
  },
  createAppointment: async (data) => {
    const response = await fetch(`${API_BASE_URL}/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to create appointment' }));
      const error = new Error(errorData.error || 'Failed to create appointment');
      error.response = { data: errorData };
      throw error;
    }
    return response.json();
  },
  updateAppointment: async (id, data) => {
    const response = await fetch(`${API_BASE_URL}/appointments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update appointment');
    return response.json();
  },
  deleteAppointment: async (id) => {
    const response = await fetch(`${API_BASE_URL}/appointments/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete appointment');
    return response.json();
  },

  // Patients
  getPatients: async () => {
    const response = await fetch(`${API_BASE_URL}/patients`);
    if (!response.ok) throw new Error('Failed to fetch patients');
    return response.json();
  },
  createPatient: async (data) => {
    const response = await fetch(`${API_BASE_URL}/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create patient');
    return response.json();
  },
  updatePatient: async (id, data) => {
    const response = await fetch(`${API_BASE_URL}/patients/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update patient');
    return response.json();
  },
  deletePatient: async (id) => {
    const response = await fetch(`${API_BASE_URL}/patients/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete patient');
    return response.json();
  },

  // Claims
  getClaims: async () => {
    const response = await fetch(`${API_BASE_URL}/claims`);
    if (!response.ok) throw new Error('Failed to fetch claims');
    return response.json();
  },
  createClaim: async (data) => {
    const response = await fetch(`${API_BASE_URL}/claims`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create claim');
    return response.json();
  },
  updateClaim: async (id, data) => {
    const response = await fetch(`${API_BASE_URL}/claims/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update claim');
    return response.json();
  },
  deleteClaim: async (id) => {
    const response = await fetch(`${API_BASE_URL}/claims/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete claim');
    return response.json();
  },

  // Preapprovals
  getPreapprovals: async (patientId) => {
    const params = new URLSearchParams();
    if (patientId) params.append('patientId', patientId);
    const response = await fetch(`${API_BASE_URL}/preapprovals?${params}`);
    if (!response.ok) throw new Error('Failed to fetch preapprovals');
    return response.json();
  },
  getPreapproval: async (id) => {
    const response = await fetch(`${API_BASE_URL}/preapprovals/${id}`);
    if (!response.ok) throw new Error('Failed to fetch preapproval');
    return response.json();
  },
  checkClearinghouseStatus: async () => {
    const response = await fetch(`${API_BASE_URL}/preapprovals/check-clearinghouse/status`);
    if (!response.ok) throw new Error('Failed to check clearinghouse status');
    return response.json();
  },
  createPreapproval: async (data) => {
    const response = await fetch(`${API_BASE_URL}/preapprovals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create preapproval');
    return response.json();
  },
  updatePreapproval: async (id, data) => {
    const response = await fetch(`${API_BASE_URL}/preapprovals/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update preapproval');
    return response.json();
  },
  deletePreapproval: async (id) => {
    const response = await fetch(`${API_BASE_URL}/preapprovals/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete preapproval');
    return response.json();
  },

  // Payments
  getPayments: async (patientId, claimId, status) => {
    const params = new URLSearchParams();
    if (patientId) params.append('patientId', patientId);
    if (claimId) params.append('claimId', claimId);
    if (status) params.append('status', status);
    const response = await fetch(`${API_BASE_URL}/payments?${params}`);
    if (!response.ok) throw new Error('Failed to fetch payments');
    return response.json();
  },
  getPayment: async (id) => {
    const response = await fetch(`${API_BASE_URL}/payments/${id}`);
    if (!response.ok) throw new Error('Failed to fetch payment');
    return response.json();
  },
  createPayment: async (data) => {
    const response = await fetch(`${API_BASE_URL}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create payment');
    return response.json();
  },
  updatePayment: async (id, data) => {
    const response = await fetch(`${API_BASE_URL}/payments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update payment');
    return response.json();
  },
  deletePayment: async (id) => {
    const response = await fetch(`${API_BASE_URL}/payments/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete payment');
    return response.json();
  },

  // Payment Postings
  getPaymentPostings: async (patientId, claimId, insurancePayerId, status) => {
    const params = new URLSearchParams();
    if (patientId) params.append('patientId', patientId);
    if (claimId) params.append('claimId', claimId);
    if (insurancePayerId) params.append('insurancePayerId', insurancePayerId);
    if (status) params.append('status', status);
    const response = await fetch(`${API_BASE_URL}/payment-postings?${params}`);
    if (!response.ok) throw new Error('Failed to fetch payment postings');
    return response.json();
  },
  getPaymentPosting: async (id) => {
    const response = await fetch(`${API_BASE_URL}/payment-postings/${id}`);
    if (!response.ok) throw new Error('Failed to fetch payment posting');
    return response.json();
  },
  getPaymentPostingsByClaim: async (claimId) => {
    const response = await fetch(`${API_BASE_URL}/payment-postings/claim/${claimId}`);
    if (!response.ok) throw new Error('Failed to fetch payment postings for claim');
    return response.json();
  },
  createPaymentPosting: async (data) => {
    const response = await fetch(`${API_BASE_URL}/payment-postings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create payment posting');
    return response.json();
  },
  updatePaymentPosting: async (id, data) => {
    const response = await fetch(`${API_BASE_URL}/payment-postings/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update payment posting');
    return response.json();
  },
  deletePaymentPosting: async (id) => {
    const response = await fetch(`${API_BASE_URL}/payment-postings/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete payment posting');
    return response.json();
  },

  // Denials
  getDenials: async (patientId, claimId, insurancePayerId, status, appealStatus, priority) => {
    const params = new URLSearchParams();
    if (patientId) params.append('patientId', patientId);
    if (claimId) params.append('claimId', claimId);
    if (insurancePayerId) params.append('insurancePayerId', insurancePayerId);
    if (status) params.append('status', status);
    if (appealStatus) params.append('appealStatus', appealStatus);
    if (priority) params.append('priority', priority);
    const response = await fetch(`${API_BASE_URL}/denials?${params}`);
    if (!response.ok) throw new Error('Failed to fetch denials');
    return response.json();
  },
  getDenial: async (id) => {
    const response = await fetch(`${API_BASE_URL}/denials/${id}`);
    if (!response.ok) throw new Error('Failed to fetch denial');
    return response.json();
  },
  getDenialsByClaim: async (claimId) => {
    const response = await fetch(`${API_BASE_URL}/denials/claim/${claimId}`);
    if (!response.ok) throw new Error('Failed to fetch denials for claim');
    return response.json();
  },
  getDenialDeadlineAlerts: async () => {
    const response = await fetch(`${API_BASE_URL}/denials/alerts/deadline`);
    if (!response.ok) throw new Error('Failed to fetch denial deadline alerts');
    return response.json();
  },
  createDenial: async (data) => {
    const response = await fetch(`${API_BASE_URL}/denials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create denial');
    return response.json();
  },
  updateDenial: async (id, data) => {
    const response = await fetch(`${API_BASE_URL}/denials/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update denial');
    return response.json();
  },
  deleteDenial: async (id) => {
    const response = await fetch(`${API_BASE_URL}/denials/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete denial');
    return response.json();
  },

  // EDI Processing
  upload835File: async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/edi/835/upload`, {
      method: 'POST',
      body: formData
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to upload 835 file');
    }
    return response.json();
  },
  generate835File: async (paymentPostingId) => {
    const response = await fetch(`${API_BASE_URL}/edi/835/generate/${paymentPostingId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!response.ok) throw new Error('Failed to generate 835 file');
    return response.json();
  },
  generate837File: async (claimId, options = {}) => {
    const response = await fetch(`${API_BASE_URL}/edi/837/generate/${claimId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options)
    });
    if (!response.ok) throw new Error('Failed to generate 837 file');
    return response.json();
  },
  submit837ToClearinghouse: async (claimId, options = {}) => {
    const response = await fetch(`${API_BASE_URL}/edi/837/submit/${claimId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options)
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to submit to clearinghouse');
    }
    return response.json();
  },
  getClaimSubmissions: async (claimId) => {
    const response = await fetch(`${API_BASE_URL}/edi/submissions/${claimId}`);
    if (!response.ok) throw new Error('Failed to fetch claim submissions');
    return response.json();
  },

  // Notifications
  getNotifications: async (userId = null) => {
    const url = userId
      ? `${API_BASE_URL}/notifications?userId=${userId}`
      : `${API_BASE_URL}/notifications`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch notifications');
    return response.json();
  },
  createNotification: async (data) => {
    const response = await fetch(`${API_BASE_URL}/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create notification');
    return response.json();
  },
  deleteNotification: async (id) => {
    const response = await fetch(`${API_BASE_URL}/notifications/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete notification');
    return response.json();
  },
  clearAllNotifications: async () => {
    const response = await fetch(`${API_BASE_URL}/notifications`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to clear notifications');
    return response.json();
  },

  // Tasks
  getTasks: async () => {
    const response = await fetch(`${API_BASE_URL}/tasks`);
    if (!response.ok) throw new Error('Failed to fetch tasks');
    return response.json();
  },
  createTask: async (data) => {
    const response = await fetch(`${API_BASE_URL}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create task');
    return response.json();
  },
  updateTask: async (id, data) => {
    const response = await fetch(`${API_BASE_URL}/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update task');
    return response.json();
  },
  deleteTask: async (id) => {
    const response = await fetch(`${API_BASE_URL}/tasks/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete task');
    return response.json();
  },

  // Users
  getUser: async (id) => {
    const response = await fetch(`${API_BASE_URL}/users/${id}`);
    if (!response.ok) throw new Error('Failed to fetch user');
    return response.json();
  },
  updateUser: async (id, data) => {
    const response = await fetch(`${API_BASE_URL}/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update user');
    return response.json();
  },
  getUsers: async () => {
    const response = await fetch(`${API_BASE_URL}/users`);
    if (!response.ok) throw new Error('Failed to fetch users');
    return response.json();
  },
  createUser: async (data) => {
    const response = await fetch(`${API_BASE_URL}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create user');
    return response.json();
  },
  deleteUser: async (id) => {
    const response = await fetch(`${API_BASE_URL}/users/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete user');
    return response.json();
  },

  // Providers
  getProviders: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/providers`);
    if (!response.ok) throw new Error('Failed to fetch providers');
    return response.json();
  },
  getProvider: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/providers/${id}`);
    if (!response.ok) throw new Error('Failed to fetch provider');
    return response.json();
  },
  createProvider: async (data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/providers`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create provider');
    return response.json();
  },
  updateProvider: async (id, data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/providers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update provider');
    return response.json();
  },
  deleteProvider: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/providers/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete provider');
    return response.json();
  },

  // Auth
  login: async (email, password) => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!response.ok) throw new Error('Failed to login');
    return response.json();
  },
  changePassword: async (userId, currentPassword, newPassword) => {
    const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, currentPassword, newPassword })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to change password');
    }
    return response.json();
  },
  forgotPassword: async (email) => {
    const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    if (!response.ok) throw new Error('Failed to send password reset email');
    return response.json();
  },
  resetPassword: async (resetToken, newPassword) => {
    const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resetToken, newPassword })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to reset password');
    }
    return response.json();
  },
  socialLogin: async (provider, providerId, accessToken, email, firstName, lastName, profileData) => {
    const response = await fetch(`${API_BASE_URL}/auth/social-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, providerId, accessToken, email, firstName, lastName, profileData })
    });
    if (!response.ok) throw new Error('Failed to login with social account');
    return response.json();
  },

  // Telehealth
  getTelehealthSessions: async () => {
    const response = await fetch(`${API_BASE_URL}/telehealth`);
    if (!response.ok) throw new Error('Failed to fetch telehealth sessions');
    return response.json();
  },
  getTelehealthSession: async (id) => {
    const response = await fetch(`${API_BASE_URL}/telehealth/${id}`);
    if (!response.ok) throw new Error('Failed to fetch telehealth session');
    return response.json();
  },
  createTelehealthSession: async (data) => {
    const response = await fetch(`${API_BASE_URL}/telehealth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create telehealth session');
    return response.json();
  },
  updateTelehealthSession: async (id, data) => {
    const response = await fetch(`${API_BASE_URL}/telehealth/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update telehealth session');
    return response.json();
  },
  deleteTelehealthSession: async (id) => {
    const response = await fetch(`${API_BASE_URL}/telehealth/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete telehealth session');
    return response.json();
  },
  joinTelehealthSession: async (id, participantName, participantType) => {
    const response = await fetch(`${API_BASE_URL}/telehealth/${id}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantName, participantType })
    });
    if (!response.ok) throw new Error('Failed to join session');
    return response.json();
  },

  // FHIR
  getFhirResources: async (resourceType, patientId) => {
    const params = new URLSearchParams();
    if (resourceType) params.append('resourceType', resourceType);
    if (patientId) params.append('patientId', patientId);
    const response = await fetch(`${API_BASE_URL}/fhir/resources?${params}`);
    if (!response.ok) throw new Error('Failed to fetch FHIR resources');
    return response.json();
  },
  getFhirResource: async (resourceType, resourceId) => {
    const response = await fetch(`${API_BASE_URL}/fhir/resources/${resourceType}/${resourceId}`);
    if (!response.ok) throw new Error('Failed to fetch FHIR resource');
    return response.json();
  },
  createFhirResource: async (data) => {
    const response = await fetch(`${API_BASE_URL}/fhir/resources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create FHIR resource');
    return response.json();
  },
  getFhirPatient: async (patientId) => {
    const response = await fetch(`${API_BASE_URL}/fhir/patient/${patientId}`);
    if (!response.ok) throw new Error('Failed to fetch FHIR patient');
    return response.json();
  },
  syncPatientToFhir: async (patientId) => {
    const response = await fetch(`${API_BASE_URL}/fhir/sync/patient/${patientId}`, {
      method: 'POST'
    });
    if (!response.ok) throw new Error('Failed to sync patient to FHIR');
    return response.json();
  },
  getFhirBundle: async (patientId) => {
    const response = await fetch(`${API_BASE_URL}/fhir/bundle/${patientId}`);
    if (!response.ok) throw new Error('Failed to fetch FHIR bundle');
    return response.json();
  },

  // Medical Records
  getMedicalRecords: async (patientId) => {
    const params = patientId ? `?patientId=${patientId}` : '';
    const response = await fetch(`${API_BASE_URL}/medical-records${params}`);
    if (!response.ok) throw new Error('Failed to fetch medical records');
    return response.json();
  },
  getMedicalRecord: async (id) => {
    const response = await fetch(`${API_BASE_URL}/medical-records/${id}`);
    if (!response.ok) throw new Error('Failed to fetch medical record');
    return response.json();
  },
  createMedicalRecord: async (data) => {
    const response = await fetch(`${API_BASE_URL}/medical-records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create medical record');
    return response.json();
  },
  updateMedicalRecord: async (id, data) => {
    const response = await fetch(`${API_BASE_URL}/medical-records/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update medical record');
    return response.json();
  },
  deleteMedicalRecord: async (id) => {
    const response = await fetch(`${API_BASE_URL}/medical-records/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete medical record');
    return response.json();
  },

  // Patient Portal
  patientPortalLogin: async (email, password, provider, providerId, accessToken) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, provider, providerId, accessToken })
    });
    if (!response.ok) throw new Error('Failed to login to patient portal');
    return response.json();
  },
  registerPatientPortal: async (patientId, email, password) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId, email, password })
    });
    if (!response.ok) throw new Error('Failed to register patient portal');
    return response.json();
  },
  getPatientAppointments: async (patientId) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/${patientId}/appointments`);
    if (!response.ok) throw new Error('Failed to fetch patient appointments');
    return response.json();
  },
  updatePatientAppointment: async (patientId, appointmentId, data) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/${patientId}/appointments/${appointmentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update appointment');
    return response.json();
  },
  deletePatientAppointment: async (patientId, appointmentId) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/${patientId}/appointments/${appointmentId}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete appointment');
    return response.json();
  },
  getPatientProfile: async (patientId) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/${patientId}/profile`);
    if (!response.ok) throw new Error('Failed to fetch patient profile');
    return response.json();
  },
  updatePatientProfile: async (patientId, data) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/${patientId}/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update patient profile');
    return response.json();
  },
  getPatientMedicalRecords: async (patientId) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/${patientId}/medical-records`);
    if (!response.ok) throw new Error('Failed to fetch patient medical records');
    return response.json();
  },
  linkSocialToPatient: async (patientId, provider, providerId, accessToken, refreshToken, profileData) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/${patientId}/link-social`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, providerId, accessToken, refreshToken, profileData })
    });
    if (!response.ok) throw new Error('Failed to link social account');
    return response.json();
  },
  patientPortalLogout: async (sessionToken) => {
    const response = await fetch(`${API_BASE_URL}/patient-portal/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionToken })
    });
    if (!response.ok) throw new Error('Failed to logout');
    return response.json();
  },

  // Roles
  getRoles: async (excludeSystem = false) => {
    const url = excludeSystem
      ? `${API_BASE_URL}/roles?exclude_system=true`
      : `${API_BASE_URL}/roles`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch roles');
    return response.json();
  },

  // Permissions
  getPermissions: async () => {
    const response = await fetch(`${API_BASE_URL}/permissions`);
    if (!response.ok) throw new Error('Failed to fetch permissions');
    return response.json();
  },
  getRolePermissions: async (role) => {
    const response = await fetch(`${API_BASE_URL}/permissions/${role}`);
    if (!response.ok) throw new Error('Failed to fetch role permissions');
    return response.json();
  },
  updatePermissions: async (permissions) => {
    const response = await fetch(`${API_BASE_URL}/permissions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(permissions)
    });
    if (!response.ok) throw new Error('Failed to update permissions');
    return response.json();
  },
  updateRolePermissions: async (role, permissions) => {
    const response = await fetch(`${API_BASE_URL}/permissions/${role}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(permissions)
    });
    if (!response.ok) throw new Error('Failed to update role permissions');
    return response.json();
  },

  // Medications
  searchMedications: async (query, drugClass, genericOnly, limit) => {
    const params = new URLSearchParams();
    if (query) params.append('query', query);
    if (drugClass) params.append('drug_class', drugClass);
    if (genericOnly) params.append('generic_only', genericOnly);
    if (limit) params.append('limit', limit);
    const response = await fetch(`${API_BASE_URL}/medications/search?${params}`);
    if (!response.ok) throw new Error('Failed to search medications');
    return response.json();
  },
  getMedications: async (drugClass, controlledOnly) => {
    const params = new URLSearchParams();
    if (drugClass) params.append('drug_class', drugClass);
    if (controlledOnly) params.append('controlled_only', controlledOnly);
    const response = await fetch(`${API_BASE_URL}/medications?${params}`);
    if (!response.ok) throw new Error('Failed to fetch medications');
    return response.json();
  },
  getMedication: async (id) => {
    const response = await fetch(`${API_BASE_URL}/medications/${id}`);
    if (!response.ok) throw new Error('Failed to fetch medication');
    return response.json();
  },
  getMedicationByNdc: async (ndcCode) => {
    const response = await fetch(`${API_BASE_URL}/medications/ndc/${ndcCode}`);
    if (!response.ok) throw new Error('Failed to fetch medication');
    return response.json();
  },
  getMedicationAlternatives: async (id) => {
    const response = await fetch(`${API_BASE_URL}/medications/${id}/alternatives`);
    if (!response.ok) throw new Error('Failed to fetch medication alternatives');
    return response.json();
  },
  checkDrugInteractions: async (ndcCodes) => {
    const response = await fetch(`${API_BASE_URL}/medications/check-interactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ndcCodes })
    });
    if (!response.ok) throw new Error('Failed to check drug interactions');
    return response.json();
  },
  getDrugClasses: async () => {
    const response = await fetch(`${API_BASE_URL}/medications/drug-classes/list`);
    if (!response.ok) throw new Error('Failed to fetch drug classes');
    return response.json();
  },
  createMedication: async (data) => {
    const response = await fetch(`${API_BASE_URL}/medications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create medication');
    return response.json();
  },
  updateMedication: async (id, data) => {
    const response = await fetch(`${API_BASE_URL}/medications/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update medication');
    return response.json();
  },

  // Pharmacies
  searchPharmacies: async (zip, city, state, name, limit) => {
    const params = new URLSearchParams();
    // Backend expects zip_code, not zip
    if (zip) params.append('zip_code', zip);
    if (city) params.append('city', city);
    if (state) params.append('state', state);
    // Backend expects pharmacy_name, not name
    if (name) params.append('pharmacy_name', name);
    if (limit) params.append('limit', limit);
    const response = await fetch(`${API_BASE_URL}/pharmacies/search?${params}`);
    if (!response.ok) throw new Error('Failed to search pharmacies');
    return response.json();
  },
  getPharmacies: async () => {
    const response = await fetch(`${API_BASE_URL}/pharmacies`);
    if (!response.ok) throw new Error('Failed to fetch pharmacies');
    return response.json();
  },
  getPharmacy: async (id) => {
    const response = await fetch(`${API_BASE_URL}/pharmacies/${id}`);
    if (!response.ok) throw new Error('Failed to fetch pharmacy');
    return response.json();
  },
  getPharmacyByNcpdp: async (ncpdpId) => {
    const response = await fetch(`${API_BASE_URL}/pharmacies/ncpdp/${ncpdpId}`);
    if (!response.ok) throw new Error('Failed to fetch pharmacy');
    return response.json();
  },
  getPatientPreferredPharmacies: async (patientId) => {
    const response = await fetch(`${API_BASE_URL}/pharmacies/patient/${patientId}/preferred`);
    if (!response.ok) throw new Error('Failed to fetch patient preferred pharmacies');
    return response.json();
  },
  getPatientPreferredPharmacy: async (patientId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/pharmacies/patient/${patientId}/preferred`);
      if (!response.ok) throw new Error('Failed to fetch patient preferred pharmacies');
      const pharmacies = await response.json();
      return pharmacies && pharmacies.length > 0 ? pharmacies[0] : null;
    } catch (error) {
      console.error('Error fetching preferred pharmacy:', error);
      return null;
    }
  },
  addPreferredPharmacy: async (patientId, pharmacyId, isPrimary) => {
    const response = await fetch(`${API_BASE_URL}/pharmacies/patient/${patientId}/preferred`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pharmacyId, isPreferred: isPrimary })
    });
    if (!response.ok) throw new Error('Failed to add preferred pharmacy');
    return response.json();
  },
  removePreferredPharmacy: async (patientId, pharmacyId) => {
    const response = await fetch(`${API_BASE_URL}/pharmacies/patient/${patientId}/preferred/${pharmacyId}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to remove preferred pharmacy');
    return response.json();
  },
  createPharmacy: async (data) => {
    const response = await fetch(`${API_BASE_URL}/pharmacies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create pharmacy');
    return response.json();
  },
  updatePharmacy: async (id, data) => {
    const response = await fetch(`${API_BASE_URL}/pharmacies/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update pharmacy');
    return response.json();
  },
  deletePharmacy: async (id) => {
    const response = await fetch(`${API_BASE_URL}/pharmacies/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete pharmacy');
    return response.json();
  },

  // Laboratories
  getLaboratories: async (isActive = null) => {
    const params = new URLSearchParams();
    if (isActive !== null) params.append('is_active', isActive);
    const queryString = params.toString();
    const response = await fetch(`${API_BASE_URL}/laboratories${queryString ? `?${queryString}` : ''}`);
    if (!response.ok) throw new Error('Failed to fetch laboratories');
    return response.json();
  },
  getLaboratory: async (id) => {
    const response = await fetch(`${API_BASE_URL}/laboratories/${id}`);
    if (!response.ok) throw new Error('Failed to fetch laboratory');
    return response.json();
  },
  createLaboratory: async (data) => {
    const response = await fetch(`${API_BASE_URL}/laboratories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create laboratory');
    return response.json();
  },
  updateLaboratory: async (id, data) => {
    const response = await fetch(`${API_BASE_URL}/laboratories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update laboratory');
    return response.json();
  },
  deleteLaboratory: async (id) => {
    const response = await fetch(`${API_BASE_URL}/laboratories/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete laboratory');
    return response.json();
  },

  // Prescriptions (ePrescribing)
  getPrescriptions: async (patientId, providerId, status, erxStatus) => {
    const params = new URLSearchParams();
    if (patientId) params.append('patient_id', patientId);
    if (providerId) params.append('provider_id', providerId);
    if (status) params.append('status', status);
    if (erxStatus) params.append('erx_status', erxStatus);
    const response = await fetch(`${API_BASE_URL}/prescriptions?${params}`);
    if (!response.ok) throw new Error('Failed to fetch prescriptions');
    return response.json();
  },
  getPrescription: async (id) => {
    const response = await fetch(`${API_BASE_URL}/prescriptions/${id}`);
    if (!response.ok) throw new Error('Failed to fetch prescription');
    return response.json();
  },
  createPrescription: async (data) => {
    const response = await fetch(`${API_BASE_URL}/prescriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create prescription');
    return response.json();
  },
  updatePrescription: async (id, data) => {
    const response = await fetch(`${API_BASE_URL}/prescriptions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update prescription');
    return response.json();
  },
  deletePrescription: async (id) => {
    const response = await fetch(`${API_BASE_URL}/prescriptions/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete prescription');
    return response.json();
  },
  sendErx: async (id) => {
    const response = await fetch(`${API_BASE_URL}/prescriptions/${id}/send-erx`, {
      method: 'POST'
    });
    if (!response.ok) throw new Error('Failed to send electronic prescription');
    return response.json();
  },
  cancelErx: async (id, reason) => {
    const response = await fetch(`${API_BASE_URL}/prescriptions/${id}/cancel-erx`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });
    if (!response.ok) throw new Error('Failed to cancel electronic prescription');
    return response.json();
  },
  getPrescriptionHistory: async (id) => {
    const response = await fetch(`${API_BASE_URL}/prescriptions/${id}/history`);
    if (!response.ok) throw new Error('Failed to fetch prescription history');
    return response.json();
  },
  checkPrescriptionSafety: async (patientId, ndcCode) => {
    const response = await fetch(`${API_BASE_URL}/prescriptions/check-safety`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId, ndcCode })
    });
    if (!response.ok) throw new Error('Failed to check prescription safety');
    return response.json();
  },
  getPatientActivePrescriptions: async (patientId) => {
    const response = await fetch(`${API_BASE_URL}/prescriptions/patient/${patientId}/active`);
    if (!response.ok) throw new Error('Failed to fetch patient active prescriptions');
    return response.json();
  },
  getPrescriptionsByDiagnosisId: async (diagnosisId) => {
    const response = await fetch(`${API_BASE_URL}/prescriptions/diagnosis/${diagnosisId}`);
    if (!response.ok) throw new Error('Failed to fetch prescriptions for diagnosis');
    return response.json();
  },
  refillPrescription: async (id) => {
    const response = await fetch(`${API_BASE_URL}/prescriptions/${id}/refill`, {
      method: 'POST'
    });
    if (!response.ok) throw new Error('Failed to refill prescription');
    return response.json();
  },

  // Diagnoses
  getPatientDiagnoses: async (patientId) => {
    const response = await fetch(`${API_BASE_URL}/diagnosis/patient/${patientId}`);
    if (!response.ok) throw new Error('Failed to fetch patient diagnoses');
    return response.json();
  },

  // Healthcare Offerings
  // Service Categories
  getServiceCategories: async () => {
    const response = await fetch(`${API_BASE_URL}/offerings/categories`);
    if (!response.ok) throw new Error('Failed to fetch service categories');
    return response.json();
  },
  getServiceCategory: async (id) => {
    const response = await fetch(`${API_BASE_URL}/offerings/categories/${id}`);
    if (!response.ok) throw new Error('Failed to fetch service category');
    return response.json();
  },
  createServiceCategory: async (data) => {
    const response = await fetch(`${API_BASE_URL}/offerings/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create service category');
    return response.json();
  },
  updateServiceCategory: async (id, data) => {
    const response = await fetch(`${API_BASE_URL}/offerings/categories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update service category');
    return response.json();
  },
  deleteServiceCategory: async (id) => {
    const response = await fetch(`${API_BASE_URL}/offerings/categories/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete service category');
    return response.json();
  },

  // Healthcare Offerings
  getOfferings: async (filters = {}) => {
    const params = new URLSearchParams();
    Object.keys(filters).forEach(key => {
      if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
        params.append(key, filters[key]);
      }
    });
    const response = await fetch(`${API_BASE_URL}/offerings?${params}`);
    if (!response.ok) throw new Error('Failed to fetch offerings');
    return response.json();
  },
  getOffering: async (id) => {
    const response = await fetch(`${API_BASE_URL}/offerings/${id}`);
    if (!response.ok) throw new Error('Failed to fetch offering');
    return response.json();
  },
  createOffering: async (data) => {
    const response = await fetch(`${API_BASE_URL}/offerings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create offering');
    return response.json();
  },
  updateOffering: async (id, data) => {
    const response = await fetch(`${API_BASE_URL}/offerings/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update offering');
    return response.json();
  },
  deleteOffering: async (id) => {
    const response = await fetch(`${API_BASE_URL}/offerings/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete offering');
    return response.json();
  },

  // Offering Pricing
  getOfferingPricing: async (offeringId) => {
    const response = await fetch(`${API_BASE_URL}/offerings/${offeringId}/pricing`);
    if (!response.ok) throw new Error('Failed to fetch offering pricing');
    return response.json();
  },
  addOfferingPricing: async (offeringId, data) => {
    const response = await fetch(`${API_BASE_URL}/offerings/${offeringId}/pricing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to add offering pricing');
    return response.json();
  },
  updateOfferingPricing: async (pricingId, data) => {
    const response = await fetch(`${API_BASE_URL}/offerings/pricing/${pricingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update offering pricing');
    return response.json();
  },
  deleteOfferingPricing: async (pricingId) => {
    const response = await fetch(`${API_BASE_URL}/offerings/pricing/${pricingId}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete offering pricing');
    return response.json();
  },

  // Offering Packages
  getOfferingPackages: async (filters = {}) => {
    const params = new URLSearchParams();
    Object.keys(filters).forEach(key => {
      if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
        params.append(key, filters[key]);
      }
    });
    const response = await fetch(`${API_BASE_URL}/offerings/packages/all?${params}`);
    if (!response.ok) throw new Error('Failed to fetch offering packages');
    return response.json();
  },
  getOfferingPackage: async (id) => {
    const response = await fetch(`${API_BASE_URL}/offerings/packages/${id}`);
    if (!response.ok) throw new Error('Failed to fetch offering package');
    return response.json();
  },
  createOfferingPackage: async (data) => {
    const response = await fetch(`${API_BASE_URL}/offerings/packages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create offering package');
    return response.json();
  },
  updateOfferingPackage: async (id, data) => {
    const response = await fetch(`${API_BASE_URL}/offerings/packages/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update offering package');
    return response.json();
  },
  deleteOfferingPackage: async (id) => {
    const response = await fetch(`${API_BASE_URL}/offerings/packages/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete offering package');
    return response.json();
  },

  // Patient Enrollments
  getPatientEnrollments: async (patientId) => {
    const response = await fetch(`${API_BASE_URL}/offerings/enrollments/patient/${patientId}`);
    if (!response.ok) throw new Error('Failed to fetch patient enrollments');
    return response.json();
  },
  createEnrollment: async (data) => {
    const response = await fetch(`${API_BASE_URL}/offerings/enrollments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create enrollment');
    return response.json();
  },
  updateEnrollment: async (id, data) => {
    const response = await fetch(`${API_BASE_URL}/offerings/enrollments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update enrollment');
    return response.json();
  },

  // Offering Reviews
  getOfferingReviews: async (offeringId, isApproved) => {
    const params = new URLSearchParams();
    if (isApproved !== undefined) params.append('is_approved', isApproved);
    const response = await fetch(`${API_BASE_URL}/offerings/${offeringId}/reviews?${params}`);
    if (!response.ok) throw new Error('Failed to fetch offering reviews');
    return response.json();
  },
  createOfferingReview: async (offeringId, data) => {
    const response = await fetch(`${API_BASE_URL}/offerings/${offeringId}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create offering review');
    return response.json();
  },
  moderateReview: async (reviewId, data) => {
    const response = await fetch(`${API_BASE_URL}/offerings/reviews/${reviewId}/moderate`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to moderate review');
    return response.json();
  },

  // Offering Promotions
  getOfferingPromotions: async (isActive) => {
    const params = new URLSearchParams();
    if (isActive !== undefined) params.append('is_active', isActive);
    const response = await fetch(`${API_BASE_URL}/offerings/promotions/all?${params}`);
    if (!response.ok) throw new Error('Failed to fetch offering promotions');
    return response.json();
  },
  validatePromoCode: async (data) => {
    const response = await fetch(`${API_BASE_URL}/offerings/promotions/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Invalid promo code' }));
      throw new Error(errorData.error || 'Invalid promo code');
    }
    return response.json();
  },
  createOfferingPromotion: async (data) => {
    const response = await fetch(`${API_BASE_URL}/offerings/promotions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create offering promotion');
    return response.json();
  },
  updateOfferingPromotion: async (id, data) => {
    const response = await fetch(`${API_BASE_URL}/offerings/promotions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update offering promotion');
    return response.json();
  },

  // Offering Statistics
  getOfferingStatistics: async () => {
    const response = await fetch(`${API_BASE_URL}/offerings/statistics/overview`);
    if (!response.ok) throw new Error('Failed to fetch offering statistics');
    return response.json();
  },

  // Appointment Types
  getAppointmentTypes: async () => {
    const response = await fetch(`${API_BASE_URL}/appointment-types`);
    if (!response.ok) throw new Error('Failed to fetch appointment types');
    return response.json();
  },
  getAllAppointmentTypes: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/appointment-types/all`);
    if (!response.ok) throw new Error('Failed to fetch all appointment types');
    return response.json();
  },
  getAppointmentType: async (id) => {
    const response = await fetch(`${API_BASE_URL}/appointment-types/${id}`);
    if (!response.ok) throw new Error('Failed to fetch appointment type');
    return response.json();
  },
  createAppointmentType: async (data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/appointment-types`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create appointment type');
    }
    return response.json();
  },
  updateAppointmentType: async (id, data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/appointment-types/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update appointment type');
    }
    return response.json();
  },
  deleteAppointmentType: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/appointment-types/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || error.message || 'Failed to delete appointment type');
    }
    return response.json();
  },

  // Waitlist
  addToWaitlist: async (data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/waitlist`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || error.message || 'Failed to add to waitlist');
    }
    return response.json();
  },
  getMyWaitlist: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/waitlist/my-waitlist`);
    if (!response.ok) throw new Error('Failed to fetch waitlist');
    return response.json();
  },
  removeFromWaitlist: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/waitlist/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to remove from waitlist');
    }
    return response.json();
  },
  getAllWaitlist: async (params) => {
    const queryParams = new URLSearchParams(params).toString();
    const response = await authenticatedFetch(`${API_BASE_URL}/waitlist/admin/all${queryParams ? `?${queryParams}` : ''}`);
    if (!response.ok) throw new Error('Failed to fetch all waitlist entries');
    return response.json();
  },
  notifyNextWaitlist: async (data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/waitlist/admin/notify-next`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || error.message || 'Failed to notify next person');
    }
    return response.json();
  },
  markWaitlistScheduled: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/waitlist/admin/${id}/scheduled`, {
      method: 'POST'
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to mark as scheduled');
    }
    return response.json();
  },

  // Telehealth Settings
  getTelehealthSettings: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/telehealth-settings`);
    if (!response.ok) throw new Error('Failed to fetch telehealth settings');
    return response.json();
  },
  getTelehealthSetting: async (providerType) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/telehealth-settings/${providerType}`);
    if (!response.ok) throw new Error(`Failed to fetch ${providerType} settings`);
    return response.json();
  },
  saveTelehealthSettings: async (providerType, settings) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/telehealth-settings/${providerType}`, {
      method: 'POST',
      body: JSON.stringify(settings)
    });
    if (!response.ok) throw new Error(`Failed to save ${providerType} settings`);
    return response.json();
  },
  toggleTelehealthProvider: async (providerType, isEnabled) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/telehealth-settings/${providerType}/toggle`, {
      method: 'PATCH',
      body: JSON.stringify({ is_enabled: isEnabled })
    });
    if (!response.ok) throw new Error(`Failed to toggle ${providerType}`);
    return response.json();
  },
  deleteTelehealthSettings: async (providerType) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/telehealth-settings/${providerType}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error(`Failed to delete ${providerType} settings`);
    return response.json();
  },
  testTelehealthProvider: async (providerType) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/telehealth-settings/${providerType}/test`, {
      method: 'POST'
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Provider test failed');
    }
    return response.json();
  },

  // Vendor Integration Settings (Surescripts, Labcorp, Optum)
  getVendorIntegrationSettings: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/vendor-integration-settings`);
    if (!response.ok) throw new Error('Failed to fetch vendor integration settings');
    return response.json();
  },
  getVendorIntegrationSetting: async (vendorType) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/vendor-integration-settings/${vendorType}`);
    if (!response.ok) throw new Error(`Failed to fetch ${vendorType} settings`);
    return response.json();
  },
  saveVendorIntegrationSettings: async (vendorType, settings) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/vendor-integration-settings/${vendorType}`, {
      method: 'POST',
      body: JSON.stringify(settings)
    });
    if (!response.ok) throw new Error(`Failed to save ${vendorType} settings`);
    return response.json();
  },
  toggleVendorIntegration: async (vendorType, isEnabled) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/vendor-integration-settings/${vendorType}/toggle`, {
      method: 'PATCH',
      body: JSON.stringify({ is_enabled: isEnabled })
    });
    if (!response.ok) throw new Error(`Failed to toggle ${vendorType}`);
    return response.json();
  },
  deleteVendorIntegrationSettings: async (vendorType) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/vendor-integration-settings/${vendorType}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error(`Failed to delete ${vendorType} settings`);
    return response.json();
  },
  testVendorIntegration: async (vendorType) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/vendor-integration-settings/${vendorType}/test`, {
      method: 'POST'
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Vendor test failed');
    }
    return response.json();
  },
  getVendorStatuses: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/vendor-integration-settings/status/all`);
    if (!response.ok) throw new Error('Failed to fetch vendor statuses');
    return response.json();
  },

  // Lab Orders
  getLabOrders: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await authenticatedFetch(`${API_BASE_URL}/lab-orders?${params}`);
    if (!response.ok) throw new Error('Failed to fetch lab orders');
    return response.json();
  },
  getLabOrder: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/lab-orders/${id}`);
    if (!response.ok) throw new Error('Failed to fetch lab order');
    return response.json();
  },
  createLabOrder: async (labOrder) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/lab-orders`, {
      method: 'POST',
      body: JSON.stringify(labOrder)
    });
    if (!response.ok) throw new Error('Failed to create lab order');
    return response.json();
  },
  updateLabOrder: async (id, updates) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/lab-orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
    if (!response.ok) throw new Error('Failed to update lab order');
    return response.json();
  },
  cancelLabOrder: async (id, reason) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/lab-orders/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason })
    });
    if (!response.ok) throw new Error('Failed to cancel lab order');
    return response.json();
  },
  getLabResults: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/lab-orders/${id}/results`);
    if (!response.ok) throw new Error('Failed to fetch lab results');
    return response.json();
  },

  // Notification Preferences
  getNotificationPreferences: async (patientId) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/notification-preferences/${patientId}`);
    if (!response.ok) throw new Error('Failed to fetch notification preferences');
    return response.json();
  },
  updateNotificationPreference: async (patientId, channelType, isEnabled, contactInfo = null) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/notification-preferences/${patientId}`, {
      method: 'POST',
      body: JSON.stringify({ channel_type: channelType, is_enabled: isEnabled, contact_info: contactInfo })
    });
    if (!response.ok) throw new Error('Failed to update notification preference');
    return response.json();
  },

  // Medical Codes
  searchMedicalCodes: async (query, type = 'all') => {
    const response = await authenticatedFetch(`${API_BASE_URL}/medical-codes/search?query=${encodeURIComponent(query)}&type=${type}`);
    if (!response.ok) throw new Error('Failed to search medical codes');
    return response.json();
  },
  getICD10Codes: async (limit = null) => {
    const url = limit ? `${API_BASE_URL}/medical-codes/icd10?limit=${limit}` : `${API_BASE_URL}/medical-codes/icd10`;
    const response = await authenticatedFetch(url);
    if (!response.ok) throw new Error('Failed to fetch ICD-10 codes');
    return response.json();
  },
  getCPTCodes: async (limit = null) => {
    const url = limit ? `${API_BASE_URL}/medical-codes/cpt?limit=${limit}` : `${API_BASE_URL}/medical-codes/cpt`;
    const response = await authenticatedFetch(url);
    if (!response.ok) throw new Error('Failed to fetch CPT codes');
    return response.json();
  },
  getMedicalCodeByCode: async (code) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/medical-codes/code/${code}`);
    if (!response.ok) throw new Error('Failed to fetch medical code');
    return response.json();
  },

  // Diagnosis
  getDiagnoses: async (patientId = null) => {
    const url = patientId ? `${API_BASE_URL}/diagnosis?patient_id=${patientId}` : `${API_BASE_URL}/diagnosis`;
    const response = await authenticatedFetch(url);
    if (!response.ok) throw new Error('Failed to fetch diagnoses');
    return response.json();
  },
  getDiagnosis: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/diagnosis/${id}`);
    if (!response.ok) throw new Error('Failed to fetch diagnosis');
    return response.json();
  },
  createDiagnosis: async (data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/diagnosis`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to create diagnosis' }));
      const error = new Error(errorData.error || 'Failed to create diagnosis');
      error.response = { data: errorData };
      throw error;
    }
    return response.json();
  },
  updateDiagnosis: async (id, data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/diagnosis/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update diagnosis');
    return response.json();
  },
  deleteDiagnosis: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/diagnosis/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete diagnosis');
    return response.json();
  },

  // Insurance Payers
  getInsurancePayers: async (activeOnly = true) => {
    const url = activeOnly ? `${API_BASE_URL}/insurance-payers?active_only=true` : `${API_BASE_URL}/insurance-payers`;
    const response = await authenticatedFetch(url);
    if (!response.ok) throw new Error('Failed to fetch insurance payers');
    return response.json();
  },
  getInsurancePayer: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/insurance-payers/${id}`);
    if (!response.ok) throw new Error('Failed to fetch insurance payer');
    return response.json();
  },
  getInsurancePayerByPayerId: async (payerId) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/insurance-payers/payer/${payerId}`);
    if (!response.ok) throw new Error('Failed to fetch insurance payer');
    return response.json();
  },
  createInsurancePayer: async (data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/insurance-payers`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to create insurance payer' }));
      throw new Error(errorData.error || 'Failed to create insurance payer');
    }
    return response.json();
  },
  updateInsurancePayer: async (id, data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/insurance-payers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update insurance payer');
    return response.json();
  },
  deleteInsurancePayer: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/insurance-payers/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete insurance payer');
    return response.json();
  },

  // Campaigns
  getCampaigns: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.offeringId) params.append('offeringId', filters.offeringId);
    const queryString = params.toString();
    const response = await authenticatedFetch(`${API_BASE_URL}/campaigns${queryString ? `?${queryString}` : ''}`);
    if (!response.ok) throw new Error('Failed to fetch campaigns');
    return response.json();
  },
  getCampaign: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/campaigns/${id}`);
    if (!response.ok) throw new Error('Failed to fetch campaign');
    return response.json();
  },
  createCampaign: async (data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/campaigns`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to create campaign' }));
      throw new Error(errorData.error || 'Failed to create campaign');
    }
    return response.json();
  },
  updateCampaign: async (id, data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/campaigns/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update campaign');
    return response.json();
  },
  deleteCampaign: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/campaigns/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete campaign');
    return response.json();
  },

  // Data Backup
  generateBackup: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/backup/generate`);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to generate backup' }));
      throw new Error(errorData.error || 'Failed to generate backup');
    }
    return response.json();
  },
  backupToGoogleDrive: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/backup/google-drive`, {
      method: 'POST'
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to backup to Google Drive' }));
      throw new Error(errorData.error || 'Failed to backup to Google Drive. Please ensure Google Drive is connected.');
    }
    return response.json();
  },
  backupToOneDrive: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/backup/onedrive`, {
      method: 'POST'
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to backup to OneDrive' }));
      throw new Error(errorData.error || 'Failed to backup to OneDrive. Please ensure OneDrive is connected.');
    }
    return response.json();
  },
  restoreBackup: async (backupData) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/backup/restore`, {
      method: 'POST',
      body: JSON.stringify({ backup: backupData })
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to restore backup' }));
      throw new Error(errorData.error || 'Failed to restore backup');
    }
    return response.json();
  },
  getBackupConfig: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/backup/config`);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to get backup configuration' }));
      throw new Error(errorData.error || 'Failed to get backup configuration');
    }
    return response.json();
  },
  updateGoogleDriveConfig: async (credentials) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/backup/config/google-drive`, {
      method: 'POST',
      body: JSON.stringify({ credentials })
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to update Google Drive configuration' }));
      throw new Error(errorData.error || 'Failed to update Google Drive configuration');
    }
    return response.json();
  },
  updateOneDriveConfig: async (accessToken) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/backup/config/onedrive`, {
      method: 'POST',
      body: JSON.stringify({ accessToken })
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to update OneDrive configuration' }));
      throw new Error(errorData.error || 'Failed to update OneDrive configuration');
    }
    return response.json();
  },

  // Patient Intake Forms
  getIntakeForms: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.patient_id) params.append('patient_id', filters.patient_id);
    if (filters.status) params.append('status', filters.status);
    if (filters.form_type) params.append('form_type', filters.form_type);
    const queryString = params.toString();
    const response = await authenticatedFetch(`${API_BASE_URL}/intake-forms${queryString ? `?${queryString}` : ''}`);
    if (!response.ok) throw new Error('Failed to fetch intake forms');
    return response.json();
  },
  getIntakeForm: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/intake-forms/${id}`);
    if (!response.ok) throw new Error('Failed to fetch intake form');
    return response.json();
  },
  createIntakeForm: async (data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/intake-forms`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to create intake form' }));
      throw new Error(errorData.error || 'Failed to create intake form');
    }
    return response.json();
  },
  updateIntakeForm: async (id, data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/intake-forms/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update intake form');
    return response.json();
  },
  deleteIntakeForm: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/intake-forms/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete intake form');
    return response.json();
  },

  // Patient Intake Flows
  getIntakeFlows: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.patient_id) params.append('patient_id', filters.patient_id);
    if (filters.status) params.append('status', filters.status);
    if (filters.flow_type) params.append('flow_type', filters.flow_type);
    const queryString = params.toString();
    const response = await authenticatedFetch(`${API_BASE_URL}/intake-forms/flows${queryString ? `?${queryString}` : ''}`);
    if (!response.ok) throw new Error('Failed to fetch intake flows');
    return response.json();
  },
  getIntakeFlow: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/intake-forms/flows/${id}`);
    if (!response.ok) throw new Error('Failed to fetch intake flow');
    return response.json();
  },
  createIntakeFlow: async (data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/intake-forms/flows`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to create intake flow' }));
      throw new Error(errorData.error || 'Failed to create intake flow');
    }
    return response.json();
  },
  updateIntakeFlow: async (id, data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/intake-forms/flows/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update intake flow');
    return response.json();
  },
  deleteIntakeFlow: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/intake-forms/flows/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete intake flow');
    return response.json();
  },

  // Patient Consent Forms
  getConsentForms: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.patient_id) params.append('patient_id', filters.patient_id);
    if (filters.status) params.append('status', filters.status);
    if (filters.consent_type) params.append('consent_type', filters.consent_type);
    const queryString = params.toString();
    const response = await authenticatedFetch(`${API_BASE_URL}/intake-forms/consents${queryString ? `?${queryString}` : ''}`);
    if (!response.ok) throw new Error('Failed to fetch consent forms');
    return response.json();
  },
  getConsentForm: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/intake-forms/consents/${id}`);
    if (!response.ok) throw new Error('Failed to fetch consent form');
    return response.json();
  },
  createConsentForm: async (data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/intake-forms/consents`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to create consent form' }));
      throw new Error(errorData.error || 'Failed to create consent form');
    }
    return response.json();
  },
  updateConsentForm: async (id, data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/intake-forms/consents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update consent form');
    return response.json();
  },
  deleteConsentForm: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/intake-forms/consents/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete consent form');
    return response.json();
  },

  // Add baseURL property for components that need it
  baseURL: API_BASE_URL
};

export default api;
