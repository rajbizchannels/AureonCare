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
  addPreferredPharmacy: async (patientId, pharmacyId, isPrimary) => {
    const response = await fetch(`${API_BASE_URL}/pharmacies/patient/${patientId}/preferred`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pharmacyId, isPrimary })
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
  refillPrescription: async (id) => {
    const response = await fetch(`${API_BASE_URL}/prescriptions/${id}/refill`, {
      method: 'POST'
    });
    if (!response.ok) throw new Error('Failed to refill prescription');
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
  }
};

export default api;
