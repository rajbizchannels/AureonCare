// API Configuration
const API_BASE_URL = process.env.REACT_APP_SVC_URL || 'http://localhost:3001/api';

console.log('API Service: Base URL configured as:', API_BASE_URL);

/**
 * Get authentication headers using the stored JWT.
 * @returns {Object} Headers object with Authorization: Bearer <token>
 */
const getAuthHeaders = () => {
  const headers = { 'Content-Type': 'application/json' };
  try {
    const token = sessionStorage.getItem('token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch (error) {
    console.error('Error reading token from sessionStorage:', error);
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

  // Let the browser set Content-Type (with its multipart boundary) for uploads.
  if (typeof FormData !== 'undefined' && options.body instanceof FormData) {
    delete authHeaders['Content-Type'];
  }

  const mergedOptions = {
    ...options,
    headers: {
      ...authHeaders,
      ...(options.headers || {})
    }
  };
  return fetch(url, mergedOptions);
};

/**
 * Authenticated request to an API path, for callers outside this module.
 *
 * Views used to call `fetch('/api/…')` directly. That sends no Authorization
 * header — every router behind `authenticate` answers 401 — and a relative path
 * only resolves when the frontend and backend share an origin, which this
 * deployment does not guarantee (AC_FE_URL and AC_BE_URL are configured
 * separately). Pass the path *without* the /api prefix, e.g. apiFetch('/users').
 *
 * @param {string} path    path relative to the API base, leading slash included
 * @param {Object} options standard fetch options; FormData bodies keep their
 *                         own Content-Type
 * @returns {Promise<Response>} the raw response, so callers keep their own
 *                              status handling
 */
export const apiFetch = (path, options = {}) =>
  authenticatedFetch(`${API_BASE_URL}${path}`, options);

// API Service
const api = {
  // Appointments
  getAppointments: async () => {
    console.log('API: Fetching appointments from:', `${API_BASE_URL}/appointments`);
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/appointments`);
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
    const response = await authenticatedFetch(`${API_BASE_URL}/appointments`, {
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
    const response = await authenticatedFetch(`${API_BASE_URL}/appointments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update appointment');
    return response.json();
  },
  updateAppointmentStatus: async (id, status) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/appointments/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (!response.ok) throw new Error('Failed to update appointment status');
    return response.json();
  },
  deleteAppointment: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/appointments/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete appointment');
    return response.json();
  },

  // Patients
  getPatients: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/patients`);
    if (!response.ok) throw new Error('Failed to fetch patients');
    return response.json();
  },
  getPatient: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/patients/${id}`);
    if (!response.ok) throw new Error('Failed to fetch patient');
    return response.json();
  },
  createPatient: async (data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create patient');
    return response.json();
  },
  updatePatient: async (id, data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/patients/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update patient');
    return response.json();
  },
  deletePatient: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/patients/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete patient');
    return response.json();
  },

  // Claims
  getClaims: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/claims`);
    if (!response.ok) throw new Error('Failed to fetch claims');
    return response.json();
  },
  createClaim: async (data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/claims`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create claim');
    return response.json();
  },
  updateClaim: async (id, data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/claims/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update claim');
    return response.json();
  },
  deleteClaim: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/claims/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete claim');
    return response.json();
  },

  // Preapprovals
  getPreapprovals: async (patientId) => {
    const params = new URLSearchParams();
    if (patientId) params.append('patientId', patientId);
    const response = await authenticatedFetch(`${API_BASE_URL}/preapprovals?${params}`);
    if (!response.ok) throw new Error('Failed to fetch preapprovals');
    return response.json();
  },
  getPreapproval: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/preapprovals/${id}`);
    if (!response.ok) throw new Error('Failed to fetch preapproval');
    return response.json();
  },
  checkClearinghouseStatus: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/preapprovals/check-clearinghouse/status`);
    if (!response.ok) throw new Error('Failed to check clearinghouse status');
    return response.json();
  },
  createPreapproval: async (data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/preapprovals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create preapproval');
    return response.json();
  },
  updatePreapproval: async (id, data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/preapprovals/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update preapproval');
    return response.json();
  },
  deletePreapproval: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/preapprovals/${id}`, {
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
    const response = await authenticatedFetch(`${API_BASE_URL}/payments?${params}`);
    if (!response.ok) throw new Error('Failed to fetch payments');
    return response.json();
  },
  getPayment: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/payments/${id}`);
    if (!response.ok) throw new Error('Failed to fetch payment');
    return response.json();
  },
  createPayment: async (data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create payment');
    return response.json();
  },
  updatePayment: async (id, data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/payments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update payment');
    return response.json();
  },
  deletePayment: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/payments/${id}`, {
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
    const response = await authenticatedFetch(`${API_BASE_URL}/payment-postings?${params}`);
    if (!response.ok) throw new Error('Failed to fetch payment postings');
    return response.json();
  },
  getPaymentPosting: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/payment-postings/${id}`);
    if (!response.ok) throw new Error('Failed to fetch payment posting');
    return response.json();
  },
  getPaymentPostingsByClaim: async (claimId) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/payment-postings/claim/${claimId}`);
    if (!response.ok) throw new Error('Failed to fetch payment postings for claim');
    return response.json();
  },
  createPaymentPosting: async (data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/payment-postings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create payment posting');
    return response.json();
  },
  updatePaymentPosting: async (id, data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/payment-postings/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update payment posting');
    return response.json();
  },
  deletePaymentPosting: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/payment-postings/${id}`, {
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
    const response = await authenticatedFetch(`${API_BASE_URL}/denials?${params}`);
    if (!response.ok) throw new Error('Failed to fetch denials');
    return response.json();
  },
  getDenial: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/denials/${id}`);
    if (!response.ok) throw new Error('Failed to fetch denial');
    return response.json();
  },
  getDenialsByClaim: async (claimId) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/denials/claim/${claimId}`);
    if (!response.ok) throw new Error('Failed to fetch denials for claim');
    return response.json();
  },
  getDenialDeadlineAlerts: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/denials/alerts/deadline`);
    if (!response.ok) throw new Error('Failed to fetch denial deadline alerts');
    return response.json();
  },
  createDenial: async (data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/denials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create denial');
    return response.json();
  },
  updateDenial: async (id, data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/denials/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update denial');
    return response.json();
  },
  deleteDenial: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/denials/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete denial');
    return response.json();
  },

  // EDI Processing
  upload835File: async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await authenticatedFetch(`${API_BASE_URL}/edi/835/upload`, {
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
    const response = await authenticatedFetch(`${API_BASE_URL}/edi/835/generate/${paymentPostingId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!response.ok) throw new Error('Failed to generate 835 file');
    return response.json();
  },
  generate837File: async (claimId, options = {}) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/edi/837/generate/${claimId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options)
    });
    if (!response.ok) throw new Error('Failed to generate 837 file');
    return response.json();
  },
  submit837ToClearinghouse: async (claimId, options = {}) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/edi/837/submit/${claimId}`, {
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
    const response = await authenticatedFetch(`${API_BASE_URL}/edi/submissions/${claimId}`);
    if (!response.ok) throw new Error('Failed to fetch claim submissions');
    return response.json();
  },

  // Notifications
  getNotifications: async (userId = null) => {
    const url = userId
      ? `${API_BASE_URL}/notifications?userId=${userId}`
      : `${API_BASE_URL}/notifications`;
    const response = await authenticatedFetch(url);
    if (!response.ok) throw new Error('Failed to fetch notifications');
    return response.json();
  },
  createNotification: async (data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create notification');
    return response.json();
  },
  deleteNotification: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/notifications/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete notification');
    return response.json();
  },
  clearAllNotifications: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/notifications`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to clear notifications');
    return response.json();
  },

  // ── Secure messaging ──────────────────────────────────────────────────────
  // The messaging API serves both audiences, so it accepts either credential:
  // a staff JWT or a patient portal session token. Staff wins when both are
  // present — a staff member previewing the portal is still acting as staff.
  _messagingHeaders: (extra = {}) => {
    const headers = { 'Content-Type': 'application/json', ...extra };
    try {
      const token = sessionStorage.getItem('token') || sessionStorage.getItem('portalSessionToken');
      if (token) headers['Authorization'] = `Bearer ${token}`;
    } catch (error) {
      console.error('Error reading session token:', error);
    }
    return headers;
  },
  _messagingFetch: async (path, options = {}, errorMessage = 'Messaging request failed') => {
    const response = await fetch(`${API_BASE_URL}/messages${path}`, {
      ...options,
      headers: api._messagingHeaders(options.headers)
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(detail.error || errorMessage);
    }
    return response.json();
  },

  getMessageThreads: async (filters = {}) => {
    const params = new URLSearchParams(
      Object.entries(filters).filter(([, v]) => v !== undefined && v !== null && v !== '')
    );
    const query = params.toString() ? `?${params}` : '';
    return api._messagingFetch(`/threads${query}`, {}, 'Failed to load message threads');
  },
  getUnreadMessageCount: async () => {
    const { count } = await api._messagingFetch('/unread-count', {}, 'Failed to count unread messages');
    return count;
  },
  getMessageThread: async (threadId) =>
    api._messagingFetch(`/threads/${threadId}`, {}, 'Failed to load thread'),
  getThreadMessages: async (threadId, { limit, offset } = {}) => {
    const params = new URLSearchParams();
    if (limit) params.set('limit', limit);
    if (offset) params.set('offset', offset);
    const query = params.toString() ? `?${params}` : '';
    return api._messagingFetch(`/threads/${threadId}/messages${query}`, {}, 'Failed to load messages');
  },
  createMessageThread: async (data) =>
    api._messagingFetch('/threads', { method: 'POST', body: JSON.stringify(data) }, 'Failed to start conversation'),
  sendMessage: async (threadId, data) =>
    api._messagingFetch(`/threads/${threadId}/messages`, { method: 'POST', body: JSON.stringify(data) }, 'Failed to send message'),
  updateMessageThread: async (threadId, data) =>
    api._messagingFetch(`/threads/${threadId}`, { method: 'PATCH', body: JSON.stringify(data) }, 'Failed to update conversation'),
  markThreadRead: async (threadId) =>
    api._messagingFetch(`/threads/${threadId}/read`, { method: 'POST' }, 'Failed to mark thread as read'),
  withdrawMessage: async (messageId) =>
    api._messagingFetch(`/messages/${messageId}`, { method: 'DELETE' }, 'Failed to withdraw message'),
  addThreadParticipant: async (threadId, participant) =>
    api._messagingFetch(`/threads/${threadId}/participants`, { method: 'POST', body: JSON.stringify(participant) }, 'Failed to add participant'),
  removeThreadParticipant: async (threadId, participantRowId) =>
    api._messagingFetch(`/threads/${threadId}/participants/${participantRowId}`, { method: 'DELETE' }, 'Failed to remove participant'),
  getMessageRecipients: async (q = '') =>
    api._messagingFetch(`/recipients?q=${encodeURIComponent(q)}`, {}, 'Failed to load recipients'),
  /** Patient-safe recipient list — the caller's own care team, never the directory. */
  getMessageCareTeam: async (patientId) =>
    api._messagingFetch(
      `/care-team${patientId ? `?patientId=${encodeURIComponent(patientId)}` : ''}`,
      {},
      'Failed to load your care team'
    ),
  /** Attachments are fetched as blobs, so this bypasses the JSON helper. */
  downloadMessageAttachment: async (attachmentId) => {
    const response = await fetch(`${API_BASE_URL}/messages/attachments/${attachmentId}`, {
      headers: api._messagingHeaders()
    });
    if (!response.ok) throw new Error('Failed to download attachment');
    return response.blob();
  },

  // ── Documents filed from secure messages ──────────────────────────────────
  // A patient may be signed in two ways: with a portal session (portal login)
  // or with a staff-issued JWT on a users row of role 'patient'. Only the
  // former can reach /patient-portal/*, only the latter can reach the staff
  // routers — so each call picks its path from the credential actually held.
  _hasPortalSession: () => {
    try {
      return Boolean(sessionStorage.getItem('portalSessionToken') && !sessionStorage.getItem('token'));
    } catch {
      return false;
    }
  },

  /**
   * Forms Requested for the signed-in patient.
   * /form-management is behind a staff JWT, so a portal session reads the
   * mirrored portal route instead.
   */
  getPatientFormRequests: async (patientId) => {
    if (api._hasPortalSession()) {
      const response = await fetch(`${API_BASE_URL}/patient-portal/${patientId}/form-requests`, {
        headers: api._getPortalAuthHeader(),
      });
      if (!response.ok) throw new Error('Failed to load requested forms');
      return response.json();
    }
    return api.getFormSubmissions({ patient_id: patientId });
  },

  /** Download a document that was filed into Patient Records from a message. */
  downloadRecordAttachment: async (recordId, attachmentId, patientId) => {
    const usePortal = api._hasPortalSession();
    const url = usePortal
      ? `${API_BASE_URL}/patient-portal/${patientId}/medical-records/${recordId}/attachments/${attachmentId}`
      : `${API_BASE_URL}/medical-records/${recordId}/attachments/${attachmentId}`;
    const response = await fetch(url, {
      headers: usePortal ? api._getPortalAuthHeader() : getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to download document');
    return response.blob();
  },

  /** Download the document behind a Forms Requested item. */
  downloadRequestedDocument: async (submissionId, patientId) => {
    const usePortal = api._hasPortalSession();
    const url = usePortal
      ? `${API_BASE_URL}/patient-portal/${patientId}/form-requests/${submissionId}/document`
      : `${API_BASE_URL}/form-management/submissions/${submissionId}/document`;
    const response = await fetch(url, {
      headers: usePortal ? api._getPortalAuthHeader() : getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to download document');
    return response.blob();
  },

  /** Complete a document-backed request (read-and-confirm, or sign). */
  acknowledgeRequestedDocument: async (submissionId, patientId) => {
    const usePortal = api._hasPortalSession();
    const url = usePortal
      ? `${API_BASE_URL}/patient-portal/${patientId}/form-requests/${submissionId}/acknowledge`
      : `${API_BASE_URL}/form-management/submissions/${submissionId}/acknowledge`;
    const response = await fetch(url, {
      method: 'POST',
      headers: usePortal
        ? { 'Content-Type': 'application/json', ...api._getPortalAuthHeader() }
        : getAuthHeaders(),
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(detail.error || 'Failed to complete request');
    }
    return response.json();
  },

  /** Patient-supplied documents no one has verified yet, oldest first. */
  getPendingDocumentReviews: async (limit) => {
    const query = limit ? `?limit=${limit}` : '';
    const response = await authenticatedFetch(`${API_BASE_URL}/medical-records/pending-review${query}`);
    if (!response.ok) throw new Error('Failed to load documents awaiting review');
    return response.json();
  },

  /** Staff decision on a patient-supplied document awaiting review. */
  reviewPatientDocument: async (recordId, decision, notes) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/medical-records/${recordId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, notes }),
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(detail.error || 'Failed to review document');
    }
    return response.json();
  },

  // Tasks
  getTasks: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/tasks`);
    if (!response.ok) throw new Error('Failed to fetch tasks');
    return response.json();
  },
  createTask: async (data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create task');
    return response.json();
  },
  updateTask: async (id, data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update task');
    return response.json();
  },
  deleteTask: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/tasks/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete task');
    return response.json();
  },

  // Users
  getUser: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/users/${id}`);
    if (!response.ok) throw new Error('Failed to fetch user');
    return response.json();
  },
  updateUser: async (id, data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const detail = errorData.details ? `: ${errorData.details}` : '';
      throw new Error((errorData.message || errorData.error || 'Failed to update user') + detail);
    }
    return response.json();
  },
  getUsers: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/users`);
    if (!response.ok) throw new Error('Failed to fetch users');
    return response.json();
  },
  createUser: async (data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/users`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const detail = errorData.details ? `: ${errorData.details}` : '';
      throw new Error((errorData.message || errorData.error || 'Failed to create user') + detail);
    }
    return response.json();
  },
  deleteUser: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/users/${id}`, {
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
    const response = await authenticatedFetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!response.ok) throw new Error('Failed to login');
    return response.json();
  },
  changePassword: async (currentPassword, newPassword) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/auth/change-password`, {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to change password');
    }
    return response.json();
  },
  forgotPassword: async (email) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    if (!response.ok) throw new Error('Failed to send password reset email');
    return response.json();
  },
  resetPassword: async (resetToken, newPassword) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/auth/reset-password`, {
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
    const response = await authenticatedFetch(`${API_BASE_URL}/auth/social-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, providerId, accessToken, email, firstName, lastName, profileData })
    });
    if (!response.ok) throw new Error('Failed to login with social account');
    return response.json();
  },
  socialRegister: async (provider, providerId, accessToken, email, firstName, lastName, profileData) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/auth/social-register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, providerId, accessToken, email, firstName, lastName, profileData })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Registration failed');
    return data;
  },

  // Telehealth
  getTelehealthSessions: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/telehealth`);
    if (!response.ok) throw new Error('Failed to fetch telehealth sessions');
    return response.json();
  },
  getTelehealthSession: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/telehealth/${id}`);
    if (!response.ok) throw new Error('Failed to fetch telehealth session');
    return response.json();
  },
  createTelehealthSession: async (data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/telehealth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to create telehealth session');
    }
    return response.json();
  },
  updateTelehealthSession: async (id, data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/telehealth/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update telehealth session');
    return response.json();
  },
  deleteTelehealthSession: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/telehealth/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete telehealth session');
    return response.json();
  },
  joinTelehealthSession: async (id, participantName, participantType) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/telehealth/${id}/join`, {
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
    const response = await authenticatedFetch(`${API_BASE_URL}/fhir/resources?${params}`);
    if (!response.ok) throw new Error('Failed to fetch FHIR resources');
    return response.json();
  },
  getFhirResource: async (resourceType, resourceId) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/fhir/resources/${resourceType}/${resourceId}`);
    if (!response.ok) throw new Error('Failed to fetch FHIR resource');
    return response.json();
  },
  createFhirResource: async (data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/fhir/resources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create FHIR resource');
    return response.json();
  },
  getFhirPatient: async (patientId) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/fhir/patient/${patientId}`);
    if (!response.ok) throw new Error('Failed to fetch FHIR patient');
    return response.json();
  },
  syncPatientToFhir: async (patientId) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/fhir/sync/patient/${patientId}`, {
      method: 'POST'
    });
    if (!response.ok) throw new Error('Failed to sync patient to FHIR');
    return response.json();
  },
  getFhirBundle: async (patientId) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/fhir/bundle/${patientId}`);
    if (!response.ok) throw new Error('Failed to fetch FHIR bundle');
    return response.json();
  },

  // Medical Records
  getMedicalRecords: async (patientId) => {
    const params = patientId ? `?patientId=${patientId}` : '';
    const response = await authenticatedFetch(`${API_BASE_URL}/medical-records${params}`);
    if (!response.ok) throw new Error('Failed to fetch medical records');
    return response.json();
  },
  getMedicalRecord: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/medical-records/${id}`);
    if (!response.ok) throw new Error('Failed to fetch medical record');
    return response.json();
  },
  createMedicalRecord: async (data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/medical-records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create medical record');
    return response.json();
  },
  updateMedicalRecord: async (id, data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/medical-records/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update medical record');
    return response.json();
  },
  deleteMedicalRecord: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/medical-records/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete medical record');
    return response.json();
  },

  // Patient Portal
  // Returns the current portal session token from sessionStorage (set after login).
  _getPortalAuthHeader: () => {
    const token = sessionStorage.getItem('portalSessionToken');
    return token ? { Authorization: `Bearer ${token}` } : {};
  },
  patientPortalLogin: async (email, password, provider, providerId, accessToken) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/patient-portal/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, provider, providerId, accessToken })
    });
    if (!response.ok) {
      // Surface the server's reason — "portal not enabled" and "wrong password"
      // are different problems and the patient can only act on one of them.
      const detail = await response.json().catch(() => ({}));
      throw new Error(detail.error || 'Failed to login to patient portal');
    }
    return response.json();
  },
  registerPatientPortal: async (patientId, email, password) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/patient-portal/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId, email, password })
    });
    if (!response.ok) throw new Error('Failed to register patient portal');
    return response.json();
  },
  getPatientAppointments: async (patientId) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/patient-portal/${patientId}/appointments`, {
      headers: { ...api._getPortalAuthHeader() }
    });
    if (!response.ok) throw new Error('Failed to fetch patient appointments');
    return response.json();
  },
  updatePatientAppointment: async (patientId, appointmentId, data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/patient-portal/${patientId}/appointments/${appointmentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...api._getPortalAuthHeader() },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update appointment');
    return response.json();
  },
  deletePatientAppointment: async (patientId, appointmentId) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/patient-portal/${patientId}/appointments/${appointmentId}`, {
      method: 'DELETE',
      headers: { ...api._getPortalAuthHeader() }
    });
    if (!response.ok) throw new Error('Failed to delete appointment');
    return response.json();
  },
  getPatientProfile: async (patientId) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/patient-portal/${patientId}/profile`, {
      headers: { ...api._getPortalAuthHeader() }
    });
    if (!response.ok) throw new Error('Failed to fetch patient profile');
    return response.json();
  },
  updatePatientProfile: async (patientId, data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/patient-portal/${patientId}/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...api._getPortalAuthHeader() },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update patient profile');
    return response.json();
  },
  getPatientMedicalRecords: async (patientId) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/patient-portal/${patientId}/medical-records`, {
      headers: { ...api._getPortalAuthHeader() }
    });
    if (!response.ok) throw new Error('Failed to fetch patient medical records');
    return response.json();
  },
  linkSocialToPatient: async (patientId, provider, providerId, accessToken, refreshToken, profileData) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/patient-portal/${patientId}/link-social`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...api._getPortalAuthHeader() },
      body: JSON.stringify({ provider, providerId, accessToken, refreshToken, profileData })
    });
    if (!response.ok) throw new Error('Failed to link social account');
    return response.json();
  },
  patientPortalLogout: async (sessionToken) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/patient-portal/logout`, {
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
    const response = await authenticatedFetch(url);
    if (!response.ok) throw new Error('Failed to fetch roles');
    return response.json();
  },

  // Permissions
  getPermissions: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/permissions`);
    if (!response.ok) throw new Error('Failed to fetch permissions');
    return response.json();
  },
  getRolePermissions: async (role) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/permissions/${role}`);
    if (!response.ok) throw new Error('Failed to fetch role permissions');
    return response.json();
  },
  updatePermissions: async (permissions) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/permissions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(permissions)
    });
    if (!response.ok) throw new Error('Failed to update permissions');
    return response.json();
  },
  updateRolePermissions: async (role, permissions) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/permissions/${role}`, {
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
    const response = await authenticatedFetch(`${API_BASE_URL}/medications/search?${params}`);
    if (!response.ok) throw new Error('Failed to search medications');
    return response.json();
  },
  getMedications: async (drugClass, controlledOnly) => {
    const params = new URLSearchParams();
    if (drugClass) params.append('drug_class', drugClass);
    if (controlledOnly) params.append('controlled_only', controlledOnly);
    const response = await authenticatedFetch(`${API_BASE_URL}/medications?${params}`);
    if (!response.ok) throw new Error('Failed to fetch medications');
    return response.json();
  },
  getMedication: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/medications/${id}`);
    if (!response.ok) throw new Error('Failed to fetch medication');
    return response.json();
  },
  getMedicationByNdc: async (ndcCode) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/medications/ndc/${ndcCode}`);
    if (!response.ok) throw new Error('Failed to fetch medication');
    return response.json();
  },
  getMedicationAlternatives: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/medications/${id}/alternatives`);
    if (!response.ok) throw new Error('Failed to fetch medication alternatives');
    return response.json();
  },
  checkDrugInteractions: async (ndcCodes) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/medications/check-interactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ndcCodes })
    });
    if (!response.ok) throw new Error('Failed to check drug interactions');
    return response.json();
  },
  getDrugClasses: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/medications/drug-classes/list`);
    if (!response.ok) throw new Error('Failed to fetch drug classes');
    return response.json();
  },
  createMedication: async (data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/medications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create medication');
    return response.json();
  },
  updateMedication: async (id, data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/medications/${id}`, {
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
    const response = await authenticatedFetch(`${API_BASE_URL}/pharmacies/search?${params}`);
    if (!response.ok) throw new Error('Failed to search pharmacies');
    return response.json();
  },
  getPharmacies: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/pharmacies`);
    if (!response.ok) throw new Error('Failed to fetch pharmacies');
    return response.json();
  },
  getPharmacy: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/pharmacies/${id}`);
    if (!response.ok) throw new Error('Failed to fetch pharmacy');
    return response.json();
  },
  getPharmacyByNcpdp: async (ncpdpId) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/pharmacies/ncpdp/${ncpdpId}`);
    if (!response.ok) throw new Error('Failed to fetch pharmacy');
    return response.json();
  },
  getPatientPreferredPharmacies: async (patientId) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/pharmacies/patient/${patientId}/preferred`);
    if (!response.ok) throw new Error('Failed to fetch patient preferred pharmacies');
    return response.json();
  },
  getPatientPreferredPharmacy: async (patientId) => {
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/pharmacies/patient/${patientId}/preferred`);
      if (!response.ok) throw new Error('Failed to fetch patient preferred pharmacies');
      const pharmacies = await response.json();
      return pharmacies && pharmacies.length > 0 ? pharmacies[0] : null;
    } catch (error) {
      console.error('Error fetching preferred pharmacy:', error);
      return null;
    }
  },
  addPreferredPharmacy: async (patientId, pharmacyId, isPrimary) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/pharmacies/patient/${patientId}/preferred`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pharmacyId, isPreferred: isPrimary })
    });
    if (!response.ok) throw new Error('Failed to add preferred pharmacy');
    return response.json();
  },
  removePreferredPharmacy: async (patientId, pharmacyId) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/pharmacies/patient/${patientId}/preferred/${pharmacyId}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to remove preferred pharmacy');
    return response.json();
  },
  createPharmacy: async (data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/pharmacies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create pharmacy');
    return response.json();
  },
  updatePharmacy: async (id, data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/pharmacies/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update pharmacy');
    return response.json();
  },
  deletePharmacy: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/pharmacies/${id}`, {
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
    const response = await authenticatedFetch(`${API_BASE_URL}/laboratories${queryString ? `?${queryString}` : ''}`);
    if (!response.ok) throw new Error('Failed to fetch laboratories');
    return response.json();
  },
  getLaboratory: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/laboratories/${id}`);
    if (!response.ok) throw new Error('Failed to fetch laboratory');
    return response.json();
  },
  createLaboratory: async (data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/laboratories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create laboratory');
    return response.json();
  },
  updateLaboratory: async (id, data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/laboratories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update laboratory');
    return response.json();
  },
  deleteLaboratory: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/laboratories/${id}`, {
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
    const response = await authenticatedFetch(`${API_BASE_URL}/prescriptions?${params}`);
    if (!response.ok) throw new Error('Failed to fetch prescriptions');
    return response.json();
  },
  getPrescription: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/prescriptions/${id}`);
    if (!response.ok) throw new Error('Failed to fetch prescription');
    return response.json();
  },
  createPrescription: async (data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/prescriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create prescription');
    return response.json();
  },
  updatePrescription: async (id, data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/prescriptions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update prescription');
    return response.json();
  },
  deletePrescription: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/prescriptions/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete prescription');
    return response.json();
  },
  sendErx: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/prescriptions/${id}/send-erx`, {
      method: 'POST'
    });
    if (!response.ok) throw new Error('Failed to send electronic prescription');
    return response.json();
  },
  cancelErx: async (id, reason) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/prescriptions/${id}/cancel-erx`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });
    if (!response.ok) throw new Error('Failed to cancel electronic prescription');
    return response.json();
  },
  getPrescriptionHistory: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/prescriptions/${id}/history`);
    if (!response.ok) throw new Error('Failed to fetch prescription history');
    return response.json();
  },
  checkPrescriptionSafety: async (patientId, ndcCode) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/prescriptions/check-safety`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId, ndcCode })
    });
    if (!response.ok) throw new Error('Failed to check prescription safety');
    return response.json();
  },
  getPatientActivePrescriptions: async (patientId) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/prescriptions/patient/${patientId}/active`);
    if (!response.ok) throw new Error('Failed to fetch patient active prescriptions');
    return response.json();
  },
  getPrescriptionsByDiagnosisId: async (diagnosisId) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/prescriptions/diagnosis/${diagnosisId}`);
    if (!response.ok) throw new Error('Failed to fetch prescriptions for diagnosis');
    return response.json();
  },
  refillPrescription: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/prescriptions/${id}/refill`, {
      method: 'POST'
    });
    if (!response.ok) throw new Error('Failed to refill prescription');
    return response.json();
  },

  // Diagnoses
  getPatientDiagnoses: async (patientId) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/diagnosis/patient/${patientId}`);
    if (!response.ok) throw new Error('Failed to fetch patient diagnoses');
    return response.json();
  },

  // Healthcare Offerings
  // Service Categories
  getServiceCategories: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/offerings/categories`);
    if (!response.ok) throw new Error('Failed to fetch service categories');
    return response.json();
  },
  getServiceCategory: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/offerings/categories/${id}`);
    if (!response.ok) throw new Error('Failed to fetch service category');
    return response.json();
  },
  createServiceCategory: async (data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/offerings/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create service category');
    return response.json();
  },
  updateServiceCategory: async (id, data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/offerings/categories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update service category');
    return response.json();
  },
  deleteServiceCategory: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/offerings/categories/${id}`, {
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
    const response = await authenticatedFetch(`${API_BASE_URL}/offerings?${params}`);
    if (!response.ok) throw new Error('Failed to fetch offerings');
    return response.json();
  },
  getOffering: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/offerings/${id}`);
    if (!response.ok) throw new Error('Failed to fetch offering');
    return response.json();
  },
  createOffering: async (data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/offerings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create offering');
    return response.json();
  },
  updateOffering: async (id, data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/offerings/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update offering');
    return response.json();
  },
  deleteOffering: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/offerings/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete offering');
    return response.json();
  },

  // Offering Linked Forms
  getOfferingLinkedForms: async (offeringId) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/offerings/${offeringId}/forms`);
    if (!response.ok) throw new Error('Failed to fetch offering forms');
    return response.json();
  },
  linkFormToOffering: async (offeringId, data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/offerings/${offeringId}/forms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to link form to offering');
    return response.json();
  },
  unlinkFormFromOffering: async (offeringId, formTemplateId) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/offerings/${offeringId}/forms/${formTemplateId}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to unlink form from offering');
    return response.json();
  },

  // Offering Pricing
  getOfferingPricing: async (offeringId) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/offerings/${offeringId}/pricing`);
    if (!response.ok) throw new Error('Failed to fetch offering pricing');
    return response.json();
  },
  addOfferingPricing: async (offeringId, data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/offerings/${offeringId}/pricing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to add offering pricing');
    return response.json();
  },
  updateOfferingPricing: async (pricingId, data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/offerings/pricing/${pricingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update offering pricing');
    return response.json();
  },
  deleteOfferingPricing: async (pricingId) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/offerings/pricing/${pricingId}`, {
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
    const response = await authenticatedFetch(`${API_BASE_URL}/offerings/packages/all?${params}`);
    if (!response.ok) throw new Error('Failed to fetch offering packages');
    return response.json();
  },
  getOfferingPackage: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/offerings/packages/${id}`);
    if (!response.ok) throw new Error('Failed to fetch offering package');
    return response.json();
  },
  createOfferingPackage: async (data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/offerings/packages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create offering package');
    return response.json();
  },
  updateOfferingPackage: async (id, data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/offerings/packages/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update offering package');
    return response.json();
  },
  deleteOfferingPackage: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/offerings/packages/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete offering package');
    return response.json();
  },

  // Patient Enrollments
  getPatientEnrollments: async (patientId) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/offerings/enrollments/patient/${patientId}`);
    if (!response.ok) throw new Error('Failed to fetch patient enrollments');
    return response.json();
  },
  createEnrollment: async (data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/offerings/enrollments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create enrollment');
    return response.json();
  },
  updateEnrollment: async (id, data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/offerings/enrollments/${id}`, {
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
    const response = await authenticatedFetch(`${API_BASE_URL}/offerings/${offeringId}/reviews?${params}`);
    if (!response.ok) throw new Error('Failed to fetch offering reviews');
    return response.json();
  },
  createOfferingReview: async (offeringId, data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/offerings/${offeringId}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create offering review');
    return response.json();
  },
  moderateReview: async (reviewId, data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/offerings/reviews/${reviewId}/moderate`, {
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
    const response = await authenticatedFetch(`${API_BASE_URL}/offerings/promotions/all?${params}`);
    if (!response.ok) throw new Error('Failed to fetch offering promotions');
    return response.json();
  },
  validatePromoCode: async (data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/offerings/promotions/validate`, {
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
    const response = await authenticatedFetch(`${API_BASE_URL}/offerings/promotions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create offering promotion');
    return response.json();
  },
  updateOfferingPromotion: async (id, data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/offerings/promotions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update offering promotion');
    return response.json();
  },

  // Offering Statistics
  getOfferingStatistics: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/offerings/statistics/overview`);
    if (!response.ok) throw new Error('Failed to fetch offering statistics');
    return response.json();
  },

  // Appointment Types
  getAppointmentTypes: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/appointment-types`);
    if (!response.ok) throw new Error('Failed to fetch appointment types');
    return response.json();
  },
  getAllAppointmentTypes: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/appointment-types/all`);
    if (!response.ok) throw new Error('Failed to fetch all appointment types');
    return response.json();
  },
  getAppointmentType: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/appointment-types/${id}`);
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
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to fetch telehealth settings');
    }
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

  // Create an instant meeting for a given provider (one-click launch)
  createInstantMeeting: async (providerType, { topic, duration, patientName, recordingEnabled } = {}) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/telehealth-settings/${providerType}/instant-meeting`, {
      method: 'POST',
      body: JSON.stringify({ topic, duration, patientName, recordingEnabled })
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to create instant meeting');
    }
    return response.json();
  },

  // Legacy alias for backwards compatibility
  createInstantZoomMeeting: async (opts = {}) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/telehealth-settings/zoom/instant-meeting`, {
      method: 'POST',
      body: JSON.stringify(opts)
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to create instant Zoom meeting');
    }
    return response.json();
  },

  // Zoom — get ZAK + SDK credentials for embedded in-app meeting
  getZoomHostToken: async (meetingId) => {
    const qs = meetingId ? `?meetingId=${encodeURIComponent(meetingId)}` : '';
    const response = await authenticatedFetch(
      `${API_BASE_URL}/telehealth-settings/zoom/host-token${qs}`
    );
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to fetch Zoom host token');
    }
    return response.json();
  },

  // Enabled telehealth providers (for patient preference dropdown)
  getEnabledTelehealthProviders: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/telehealth-settings/enabled/providers`);
    if (!response.ok) return [];
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

  // Stripe Integration Settings
  getStripeSettings: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/stripe-settings`);
    if (!response.ok) throw new Error('Failed to fetch Stripe settings');
    return response.json();
  },
  saveStripeSettings: async (settings) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/stripe-settings`, {
      method: 'POST',
      body: JSON.stringify(settings)
    });
    if (!response.ok) throw new Error('Failed to save Stripe settings');
    return response.json();
  },
  toggleStripeIntegration: async (isEnabled) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/stripe-settings/toggle`, {
      method: 'PATCH',
      body: JSON.stringify({ is_enabled: isEnabled })
    });
    if (!response.ok) throw new Error('Failed to toggle Stripe integration');
    return response.json();
  },
  testStripeConnection: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/stripe-settings/test`, {
      method: 'POST'
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Stripe connection test failed');
    }
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

  // Clinic Settings
  getClinicInfo: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/clinic-settings/info`);
    if (!response.ok) throw new Error('Failed to fetch clinic info');
    return response.json();
  },
  getClinicSettings: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/clinic-settings`);
    if (!response.ok) throw new Error('Failed to fetch clinic settings');
    return response.json();
  },
  saveClinicSettings: async (settings) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/clinic-settings`, {
      method: 'POST',
      body: JSON.stringify(settings)
    });
    if (!response.ok) throw new Error('Failed to save clinic settings');
    return response.json();
  },
  getWorkingHours: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/clinic-settings/working-hours`);
    if (!response.ok) throw new Error('Failed to fetch working hours');
    return response.json();
  },
  saveWorkingHours: async (workingHours) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/clinic-settings/working-hours`, {
      method: 'POST',
      body: JSON.stringify(workingHours)
    });
    if (!response.ok) throw new Error('Failed to save working hours');
    return response.json();
  },
  getAppointmentSettings: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/clinic-settings/appointment-settings`);
    if (!response.ok) throw new Error('Failed to fetch appointment settings');
    return response.json();
  },
  saveAppointmentSettings: async (settings) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/clinic-settings/appointment-settings`, {
      method: 'POST',
      body: JSON.stringify(settings)
    });
    if (!response.ok) throw new Error('Failed to save appointment settings');
    return response.json();
  },

  // Audit Logs
  createAuditLog: async (auditData) => {
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/audit`, {
        method: 'POST',
        body: JSON.stringify(auditData)
      });
      if (!response.ok) {
        console.warn('Failed to create audit log:', response.status);
        return null;
      }
      return response.json();
    } catch (error) {
      // Don't throw - audit logging should never block the main application
      console.warn('Error creating audit log:', error);
      return null;
    }
  },
  getAuditLogs: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await authenticatedFetch(`${API_BASE_URL}/audit?${params}`);
    if (!response.ok) throw new Error('Failed to fetch audit logs');
    return response.json();
  },
  getAuditLog: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/audit/${id}`);
    if (!response.ok) throw new Error('Failed to fetch audit log');
    return response.json();
  },
  getAuditStats: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await authenticatedFetch(`${API_BASE_URL}/audit/stats/summary?${params}`);
    if (!response.ok) throw new Error('Failed to fetch audit statistics');
    return response.json();
  },
  getTopUsers: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await authenticatedFetch(`${API_BASE_URL}/audit/stats/top-users?${params}`);
    if (!response.ok) throw new Error('Failed to fetch top users');
    return response.json();
  },
  getTopResources: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await authenticatedFetch(`${API_BASE_URL}/audit/stats/top-resources?${params}`);
    if (!response.ok) throw new Error('Failed to fetch top resources');
    return response.json();
  },
  exportAuditLogsCSV: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await authenticatedFetch(`${API_BASE_URL}/audit/export/csv?${params}`);
    if (!response.ok) throw new Error('Failed to export audit logs');
    return response.blob();
  },

  // Universal Search
  universalSearch: async (query, limit = 20) => {
    if (!query || query.trim().length < 2) {
      return [];
    }
    const params = new URLSearchParams({
      q: query.trim(),
      limit: limit
    });
    const response = await authenticatedFetch(`${API_BASE_URL}/search?${params}`);
    if (!response.ok) throw new Error('Failed to perform search');
    return response.json();
  },

  // Billing Module - Quotes
  getBillingQuotes: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.patient_id) params.append('patient_id', filters.patient_id);
    if (filters.status) params.append('status', filters.status);
    const queryString = params.toString();
    const response = await authenticatedFetch(`${API_BASE_URL}/billing/quotes${queryString ? `?${queryString}` : ''}`);
    if (!response.ok) throw new Error('Failed to fetch quotes');
    return response.json();
  },
  getBillingQuote: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/billing/quotes/${id}`);
    if (!response.ok) throw new Error('Failed to fetch quote');
    return response.json();
  },
  createBillingQuote: async (data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/billing/quotes`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create quote');
    return response.json();
  },
  updateBillingQuote: async (id, data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/billing/quotes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update quote');
    return response.json();
  },
  deleteBillingQuote: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/billing/quotes/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete quote');
    return response.json();
  },
  convertQuoteToInvoice: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/billing/quotes/${id}/convert`, {
      method: 'POST'
    });
    if (!response.ok) throw new Error('Failed to convert quote to invoice');
    return response.json();
  },

  // Billing Module - Invoices
  getBillingInvoices: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.patient_id) params.append('patient_id', filters.patient_id);
    if (filters.status) params.append('status', filters.status);
    const queryString = params.toString();
    const response = await authenticatedFetch(`${API_BASE_URL}/billing/invoices${queryString ? `?${queryString}` : ''}`);
    if (!response.ok) throw new Error('Failed to fetch invoices');
    return response.json();
  },
  getBillingInvoice: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/billing/invoices/${id}`);
    if (!response.ok) throw new Error('Failed to fetch invoice');
    return response.json();
  },
  createBillingInvoice: async (data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/billing/invoices`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create invoice');
    return response.json();
  },
  updateBillingInvoice: async (id, data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/billing/invoices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update invoice');
    return response.json();
  },
  deleteBillingInvoice: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/billing/invoices/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete invoice');
    return response.json();
  },

  // Billing Module - Coupons
  getBillingCoupons: async (isActive) => {
    const params = new URLSearchParams();
    if (isActive !== undefined) params.append('is_active', isActive);
    const queryString = params.toString();
    const response = await authenticatedFetch(`${API_BASE_URL}/billing/coupons${queryString ? `?${queryString}` : ''}`);
    if (!response.ok) throw new Error('Failed to fetch coupons');
    return response.json();
  },
  getBillingCoupon: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/billing/coupons/${id}`);
    if (!response.ok) throw new Error('Failed to fetch coupon');
    return response.json();
  },
  validateBillingCoupon: async (code, amount) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/billing/coupons/validate`, {
      method: 'POST',
      body: JSON.stringify({ code, amount })
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Invalid coupon' }));
      throw new Error(errorData.error || 'Invalid coupon');
    }
    return response.json();
  },
  createBillingCoupon: async (data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/billing/coupons`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to create coupon' }));
      throw new Error(errorData.error || 'Failed to create coupon');
    }
    return response.json();
  },
  updateBillingCoupon: async (id, data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/billing/coupons/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update coupon');
    return response.json();
  },
  deleteBillingCoupon: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/billing/coupons/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete coupon');
    return response.json();
  },

  // Billing Module - Payments
  getBillingPayments: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.patient_id) params.append('patient_id', filters.patient_id);
    if (filters.invoice_id) params.append('invoice_id', filters.invoice_id);
    if (filters.status) params.append('status', filters.status);
    const queryString = params.toString();
    const response = await authenticatedFetch(`${API_BASE_URL}/billing/payments${queryString ? `?${queryString}` : ''}`);
    if (!response.ok) throw new Error('Failed to fetch billing payments');
    return response.json();
  },
  createBillingPayment: async (data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/billing/payments`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create billing payment');
    return response.json();
  },
  updateBillingPayment: async (id, data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/billing/payments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update billing payment');
    return response.json();
  },
  deleteBillingPayment: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/billing/payments/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete billing payment');
    return response.json();
  },

  // Billing Module - Summary
  getBillingSummary: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/billing/summary`);
    if (!response.ok) throw new Error('Failed to fetch billing summary');
    return response.json();
  },

  // Add baseURL property for components that need it
  baseURL: API_BASE_URL,

  // ─── Reports API ───────────────────────────────────────────────────────────

  // Operational Reports
  getReportDailyAppointments: async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    const response = await authenticatedFetch(`${API_BASE_URL}/reports/operational/daily-appointments?${q}`);
    if (!response.ok) throw new Error('Failed to fetch daily appointments report');
    return response.json();
  },

  getReportProviderUtilization: async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    const response = await authenticatedFetch(`${API_BASE_URL}/reports/operational/provider-utilization?${q}`);
    if (!response.ok) throw new Error('Failed to fetch provider utilization report');
    return response.json();
  },

  getReportPatientVisits: async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    const response = await authenticatedFetch(`${API_BASE_URL}/reports/operational/patient-visits?${q}`);
    if (!response.ok) throw new Error('Failed to fetch patient visits report');
    return response.json();
  },

  getReportNoShows: async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    const response = await authenticatedFetch(`${API_BASE_URL}/reports/operational/no-shows?${q}`);
    if (!response.ok) throw new Error('Failed to fetch no-show report');
    return response.json();
  },

  getReportWaitTimes: async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    const response = await authenticatedFetch(`${API_BASE_URL}/reports/operational/wait-times?${q}`);
    if (!response.ok) throw new Error('Failed to fetch wait times report');
    return response.json();
  },

  // Financial Reports
  getReportRevenue: async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    const response = await authenticatedFetch(`${API_BASE_URL}/reports/financial/revenue?${q}`);
    if (!response.ok) throw new Error('Failed to fetch revenue report');
    return response.json();
  },

  getReportBillingSummary: async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    const response = await authenticatedFetch(`${API_BASE_URL}/reports/financial/billing-summary?${q}`);
    if (!response.ok) throw new Error('Failed to fetch billing summary report');
    return response.json();
  },

  getReportOutstandingPayments: async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    const response = await authenticatedFetch(`${API_BASE_URL}/reports/financial/outstanding-payments?${q}`);
    if (!response.ok) throw new Error('Failed to fetch outstanding payments report');
    return response.json();
  },

  getReportPaymentCollection: async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    const response = await authenticatedFetch(`${API_BASE_URL}/reports/financial/payment-collection?${q}`);
    if (!response.ok) throw new Error('Failed to fetch payment collection report');
    return response.json();
  },

  getReportRefunds: async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    const response = await authenticatedFetch(`${API_BASE_URL}/reports/financial/refunds?${q}`);
    if (!response.ok) throw new Error('Failed to fetch refund report');
    return response.json();
  },

  // Insurance & Claims Reports
  getReportClaimStatus: async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    const response = await authenticatedFetch(`${API_BASE_URL}/reports/insurance/claim-status?${q}`);
    if (!response.ok) throw new Error('Failed to fetch claim status report');
    return response.json();
  },

  getReportClaimRejections: async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    const response = await authenticatedFetch(`${API_BASE_URL}/reports/insurance/claim-rejections?${q}`);
    if (!response.ok) throw new Error('Failed to fetch claim rejections report');
    return response.json();
  },

  getReportDenialAnalysis: async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    const response = await authenticatedFetch(`${API_BASE_URL}/reports/insurance/denial-analysis?${q}`);
    if (!response.ok) throw new Error('Failed to fetch denial analysis report');
    return response.json();
  },

  getReportPayerPerformance: async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    const response = await authenticatedFetch(`${API_BASE_URL}/reports/insurance/payer-performance?${q}`);
    if (!response.ok) throw new Error('Failed to fetch payer performance report');
    return response.json();
  },

  // Patient Reports
  getReportPatientDemographics: async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    const response = await authenticatedFetch(`${API_BASE_URL}/reports/patient/demographics?${q}`);
    if (!response.ok) throw new Error('Failed to fetch patient demographics report');
    return response.json();
  },

  getReportPatientVisitHistory: async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    const response = await authenticatedFetch(`${API_BASE_URL}/reports/patient/visit-history?${q}`);
    if (!response.ok) throw new Error('Failed to fetch patient visit history report');
    return response.json();
  },

  getReportPatientRetention: async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    const response = await authenticatedFetch(`${API_BASE_URL}/reports/patient/retention?${q}`);
    if (!response.ok) throw new Error('Failed to fetch patient retention report');
    return response.json();
  },

  getReportPatientSatisfaction: async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    const response = await authenticatedFetch(`${API_BASE_URL}/reports/patient/satisfaction?${q}`);
    if (!response.ok) throw new Error('Failed to fetch patient satisfaction report');
    return response.json();
  },

  // Provider Reports
  getReportProviderProductivity: async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    const response = await authenticatedFetch(`${API_BASE_URL}/reports/provider/productivity?${q}`);
    if (!response.ok) throw new Error('Failed to fetch provider productivity report');
    return response.json();
  },

  getReportAppointmentVolumeByProvider: async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    const response = await authenticatedFetch(`${API_BASE_URL}/reports/provider/appointment-volume?${q}`);
    if (!response.ok) throw new Error('Failed to fetch appointment volume report');
    return response.json();
  },

  getReportRevenueByProvider: async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    const response = await authenticatedFetch(`${API_BASE_URL}/reports/provider/revenue?${q}`);
    if (!response.ok) throw new Error('Failed to fetch revenue by provider report');
    return response.json();
  },

  getReportTelehealthUsage: async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    const response = await authenticatedFetch(`${API_BASE_URL}/reports/provider/telehealth-usage?${q}`);
    if (!response.ok) throw new Error('Failed to fetch telehealth usage report');
    return response.json();
  },

  // Compliance Reports
  getReportAuditLogs: async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    const response = await authenticatedFetch(`${API_BASE_URL}/reports/compliance/audit-logs?${q}`);
    if (!response.ok) throw new Error('Failed to fetch audit logs report');
    return response.json();
  },

  getReportAccessLogs: async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    const response = await authenticatedFetch(`${API_BASE_URL}/reports/compliance/access-logs?${q}`);
    if (!response.ok) throw new Error('Failed to fetch access logs report');
    return response.json();
  },

  getReportHIPAACompliance: async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    const response = await authenticatedFetch(`${API_BASE_URL}/reports/compliance/hipaa?${q}`);
    if (!response.ok) throw new Error('Failed to fetch HIPAA compliance report');
    return response.json();
  },

  getReportDataAccessHistory: async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    const response = await authenticatedFetch(`${API_BASE_URL}/reports/compliance/data-access-history?${q}`);
    if (!response.ok) throw new Error('Failed to fetch data access history report');
    return response.json();
  },

  // Custom Report
  generateCustomReport: async (config) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/reports/custom`, {
      method: 'POST',
      body: JSON.stringify(config)
    });
    if (!response.ok) throw new Error('Failed to generate custom report');
    return response.json();
  },

  // ============================================================
  // FORM MANAGEMENT MODULE
  // ============================================================

  // Form Categories
  getFormCategories: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/form-management/categories`);
    if (!response.ok) throw new Error('Failed to fetch form categories');
    return response.json();
  },
  createFormCategory: async (data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/form-management/categories`, {
      method: 'POST', body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create form category');
    return response.json();
  },

  // Form Templates
  getFormTemplates: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.category) params.append('category', filters.category);
    if (filters.template_type) params.append('template_type', filters.template_type);
    if (filters.specialty) params.append('specialty', filters.specialty);
    if (filters.is_active !== undefined) params.append('is_active', filters.is_active);
    if (filters.search) params.append('search', filters.search);
    if (filters.intake_flow_eligible !== undefined) params.append('intake_flow_eligible', filters.intake_flow_eligible);
    if (filters.role) params.append('role', filters.role);
    const qs = params.toString();
    const response = await authenticatedFetch(`${API_BASE_URL}/form-management/templates${qs ? `?${qs}` : ''}`);
    if (!response.ok) throw new Error('Failed to fetch form templates');
    return response.json();
  },
  getFormTemplate: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/form-management/templates/${id}`);
    if (!response.ok) throw new Error('Failed to fetch form template');
    return response.json();
  },
  createFormTemplate: async (data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/form-management/templates`, {
      method: 'POST', body: JSON.stringify(data)
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Failed to create form template' }));
      throw new Error(err.error || 'Failed to create form template');
    }
    return response.json();
  },
  updateFormTemplate: async (id, data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/form-management/templates/${id}`, {
      method: 'PUT', body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update form template');
    return response.json();
  },
  deleteFormTemplate: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/form-management/templates/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete form template');
    return response.json();
  },

  // Template Versions
  getFormTemplateVersions: async (templateId) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/form-management/templates/${templateId}/versions`);
    if (!response.ok) throw new Error('Failed to fetch template versions');
    return response.json();
  },
  restoreFormTemplateVersion: async (templateId, versionId) => {
    const response = await authenticatedFetch(
      `${API_BASE_URL}/form-management/templates/${templateId}/versions/${versionId}/restore`,
      { method: 'POST' }
    );
    if (!response.ok) throw new Error('Failed to restore template version');
    return response.json();
  },

  // Form Submissions
  getFormSubmissions: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.patient_id) params.append('patient_id', filters.patient_id);
    if (filters.template_id) params.append('template_id', filters.template_id);
    if (filters.status) params.append('status', filters.status);
    if (filters.appointment_id) params.append('appointment_id', filters.appointment_id);
    if (filters.intake_flow_id) params.append('intake_flow_id', filters.intake_flow_id);
    const qs = params.toString();
    const response = await authenticatedFetch(`${API_BASE_URL}/form-management/submissions${qs ? `?${qs}` : ''}`);
    if (!response.ok) throw new Error('Failed to fetch form submissions');
    return response.json();
  },
  getFormSubmission: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/form-management/submissions/${id}`);
    if (!response.ok) throw new Error('Failed to fetch form submission');
    return response.json();
  },
  createFormSubmission: async (data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/form-management/submissions`, {
      method: 'POST', body: JSON.stringify(data)
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Failed to create form submission' }));
      throw new Error(err.error || 'Failed to create form submission');
    }
    return response.json();
  },
  updateFormSubmission: async (id, data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/form-management/submissions/${id}`, {
      method: 'PUT', body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update form submission');
    return response.json();
  },
  deleteFormSubmission: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/form-management/submissions/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete form submission');
    return response.json();
  },

  // eSignature
  addFormSignature: async (submissionId, signatureData) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/form-management/submissions/${submissionId}/sign`, {
      method: 'POST', body: JSON.stringify(signatureData)
    });
    if (!response.ok) throw new Error('Failed to add signature');
    return response.json();
  },
  getFormSignatures: async (submissionId) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/form-management/submissions/${submissionId}/signatures`);
    if (!response.ok) throw new Error('Failed to fetch signatures');
    return response.json();
  },

  // Audit Logs
  getFormAuditLogs: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.resource_type) params.append('resource_type', filters.resource_type);
    if (filters.resource_id) params.append('resource_id', filters.resource_id);
    if (filters.patient_id) params.append('patient_id', filters.patient_id);
    if (filters.actor_id) params.append('actor_id', filters.actor_id);
    if (filters.action) params.append('action', filters.action);
    if (filters.limit) params.append('limit', filters.limit);
    const qs = params.toString();
    const response = await authenticatedFetch(`${API_BASE_URL}/form-management/audit-logs${qs ? `?${qs}` : ''}`);
    if (!response.ok) throw new Error('Failed to fetch form audit logs');
    return response.json();
  },

  // Intake Flow Integration
  getIntakeFlowFormTemplates: async (flowId) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/form-management/intake-flows/${flowId}/templates`);
    if (!response.ok) throw new Error('Failed to fetch flow templates');
    return response.json();
  },
  assignFormTemplatesToFlow: async (flowId, data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/form-management/intake-flows/${flowId}/templates`, {
      method: 'POST', body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to assign templates to flow');
    return response.json();
  },

  // Form Stats
  getFormManagementStats: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/form-management/stats`);
    if (!response.ok) throw new Error('Failed to fetch form stats');
    return response.json();
  },

  // ─── Accounts Management ───────────────────────────────────────────────────

  // Chart of Accounts
  getAccounts: async (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    const response = await authenticatedFetch(`${API_BASE_URL}/accounts${qs ? `?${qs}` : ''}`);
    if (!response.ok) throw new Error('Failed to fetch accounts');
    return response.json();
  },
  getAccount: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/accounts/${id}`);
    if (!response.ok) throw new Error('Failed to fetch account');
    return response.json();
  },
  createAccount: async (data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/accounts`, { method: 'POST', body: JSON.stringify(data) });
    if (!response.ok) { const err = await response.json().catch(() => ({})); throw new Error(err.error || 'Failed to create account'); }
    return response.json();
  },
  updateAccount: async (id, data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    if (!response.ok) { const err = await response.json().catch(() => ({})); throw new Error(err.error || 'Failed to update account'); }
    return response.json();
  },
  deleteAccount: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/accounts/${id}`, { method: 'DELETE' });
    if (!response.ok) { const err = await response.json().catch(() => ({})); throw new Error(err.error || 'Failed to delete account'); }
    return response.json();
  },
  getAccountTransactions: async (id, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    const response = await authenticatedFetch(`${API_BASE_URL}/accounts/${id}/transactions${qs ? `?${qs}` : ''}`);
    if (!response.ok) throw new Error('Failed to fetch account transactions');
    return response.json();
  },

  // Journal Entries
  getJournalEntries: async (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    const response = await authenticatedFetch(`${API_BASE_URL}/accounts/journal/entries${qs ? `?${qs}` : ''}`);
    if (!response.ok) throw new Error('Failed to fetch journal entries');
    return response.json();
  },
  getJournalEntry: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/accounts/journal/entries/${id}`);
    if (!response.ok) throw new Error('Failed to fetch journal entry');
    return response.json();
  },
  createJournalEntry: async (data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/accounts/journal/entries`, { method: 'POST', body: JSON.stringify(data) });
    if (!response.ok) { const err = await response.json().catch(() => ({})); throw new Error(err.error || 'Failed to create journal entry'); }
    return response.json();
  },
  postJournalEntry: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/accounts/journal/entries/${id}/post`, { method: 'POST' });
    if (!response.ok) { const err = await response.json().catch(() => ({})); throw new Error(err.error || 'Failed to post journal entry'); }
    return response.json();
  },
  voidJournalEntry: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/accounts/journal/entries/${id}/void`, { method: 'POST' });
    if (!response.ok) { const err = await response.json().catch(() => ({})); throw new Error(err.error || 'Failed to void journal entry'); }
    return response.json();
  },

  // Accounts Receivable
  getAccountReceivables: async (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    const response = await authenticatedFetch(`${API_BASE_URL}/accounts/receivables${qs ? `?${qs}` : ''}`);
    if (!response.ok) throw new Error('Failed to fetch receivables');
    return response.json();
  },
  createAccountReceivable: async (data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/accounts/receivables`, { method: 'POST', body: JSON.stringify(data) });
    if (!response.ok) { const err = await response.json().catch(() => ({})); throw new Error(err.error || 'Failed to create AR record'); }
    return response.json();
  },
  updateAccountReceivable: async (id, data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/accounts/receivables/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    if (!response.ok) { const err = await response.json().catch(() => ({})); throw new Error(err.error || 'Failed to update AR record'); }
    return response.json();
  },

  // Accounts Payable
  getAccountPayables: async (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    const response = await authenticatedFetch(`${API_BASE_URL}/accounts/payables${qs ? `?${qs}` : ''}`);
    if (!response.ok) throw new Error('Failed to fetch payables');
    return response.json();
  },
  createAccountPayable: async (data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/accounts/payables`, { method: 'POST', body: JSON.stringify(data) });
    if (!response.ok) { const err = await response.json().catch(() => ({})); throw new Error(err.error || 'Failed to create AP record'); }
    return response.json();
  },
  updateAccountPayable: async (id, data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/accounts/payables/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    if (!response.ok) { const err = await response.json().catch(() => ({})); throw new Error(err.error || 'Failed to update AP record'); }
    return response.json();
  },

  // Reconciliations
  getReconciliations: async (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    const response = await authenticatedFetch(`${API_BASE_URL}/accounts/reconciliations${qs ? `?${qs}` : ''}`);
    if (!response.ok) throw new Error('Failed to fetch reconciliations');
    return response.json();
  },
  createReconciliation: async (data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/accounts/reconciliations`, { method: 'POST', body: JSON.stringify(data) });
    if (!response.ok) { const err = await response.json().catch(() => ({})); throw new Error(err.error || 'Failed to create reconciliation'); }
    return response.json();
  },
  updateReconciliation: async (id, data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/accounts/reconciliations/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    if (!response.ok) { const err = await response.json().catch(() => ({})); throw new Error(err.error || 'Failed to update reconciliation'); }
    return response.json();
  },

  // Statements
  getAccountStatements: async (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    const response = await authenticatedFetch(`${API_BASE_URL}/accounts/statements${qs ? `?${qs}` : ''}`);
    if (!response.ok) throw new Error('Failed to fetch statements');
    return response.json();
  },
  createAccountStatement: async (data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/accounts/statements`, { method: 'POST', body: JSON.stringify(data) });
    if (!response.ok) { const err = await response.json().catch(() => ({})); throw new Error(err.error || 'Failed to create statement'); }
    return response.json();
  },
  sendAccountStatement: async (id) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/accounts/statements/${id}/send`, { method: 'PUT' });
    if (!response.ok) { const err = await response.json().catch(() => ({})); throw new Error(err.error || 'Failed to send statement'); }
    return response.json();
  },

  // Reports
  getAccountsDashboard: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/accounts/reports/dashboard`);
    if (!response.ok) throw new Error('Failed to fetch accounts dashboard');
    return response.json();
  },
  getTrialBalance: async (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    const response = await authenticatedFetch(`${API_BASE_URL}/accounts/reports/trial-balance${qs ? `?${qs}` : ''}`);
    if (!response.ok) throw new Error('Failed to fetch trial balance');
    return response.json();
  },
  getIncomeStatement: async (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    const response = await authenticatedFetch(`${API_BASE_URL}/accounts/reports/income-statement${qs ? `?${qs}` : ''}`);
    if (!response.ok) throw new Error('Failed to fetch income statement');
    return response.json();
  },
  getBalanceSheet: async (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    const response = await authenticatedFetch(`${API_BASE_URL}/accounts/reports/balance-sheet${qs ? `?${qs}` : ''}`);
    if (!response.ok) throw new Error('Failed to fetch balance sheet');
    return response.json();
  },
  getARAgingReport: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/accounts/reports/ar-aging`);
    if (!response.ok) throw new Error('Failed to fetch AR aging report');
    return response.json();
  },
  getAPAgingReport: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/accounts/reports/ap-aging`);
    if (!response.ok) throw new Error('Failed to fetch AP aging report');
    return response.json();
  },
  createARAgingSnapshot: async (data = {}) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/accounts/reports/ar-aging/snapshot`, { method: 'POST', body: JSON.stringify(data) });
    if (!response.ok) throw new Error('Failed to create aging snapshot');
    return response.json();
  },

  // RBAC
  getAccountPermissions: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/accounts/rbac/permissions`);
    if (!response.ok) throw new Error('Failed to fetch account permissions');
    return response.json();
  },
  updateAccountPermission: async (data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/accounts/rbac/permissions`, { method: 'PUT', body: JSON.stringify(data) });
    if (!response.ok) { const err = await response.json().catch(() => ({})); throw new Error(err.error || 'Failed to update permission'); }
    return response.json();
  },

  // Backup & Archive
  getAccountBackups: async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/accounts/backup`);
    if (!response.ok) throw new Error('Failed to fetch backups');
    return response.json();
  },
  createAccountBackup: async (data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/accounts/backup`, { method: 'POST', body: JSON.stringify(data) });
    if (!response.ok) { const err = await response.json().catch(() => ({})); throw new Error(err.error || 'Backup failed'); }
    return response.json();
  },
  archiveAccountRecords: async (data) => {
    const response = await authenticatedFetch(`${API_BASE_URL}/accounts/archive`, { method: 'POST', body: JSON.stringify(data) });
    if (!response.ok) { const err = await response.json().catch(() => ({})); throw new Error(err.error || 'Archive failed'); }
    return response.json();
  },

  // ─── INVENTORY ────────────────────────────────────────────────────────────
  getInventoryItems: async (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    const r = await authenticatedFetch(`${API_BASE_URL}/inventory/items${qs ? `?${qs}` : ''}`);
    if (!r.ok) throw new Error('Failed to fetch inventory items');
    return r.json();
  },
  getInventoryItem: async (id) => {
    const r = await authenticatedFetch(`${API_BASE_URL}/inventory/items/${id}`);
    if (!r.ok) throw new Error('Failed to fetch inventory item');
    return r.json();
  },
  createInventoryItem: async (data) => {
    const r = await authenticatedFetch(`${API_BASE_URL}/inventory/items`, { method: 'POST', body: JSON.stringify(data) });
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || 'Failed to create item'); }
    return r.json();
  },
  updateInventoryItem: async (id, data) => {
    const r = await authenticatedFetch(`${API_BASE_URL}/inventory/items/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || 'Failed to update item'); }
    return r.json();
  },
  deleteInventoryItem: async (id) => {
    const r = await authenticatedFetch(`${API_BASE_URL}/inventory/items/${id}`, { method: 'DELETE' });
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || 'Failed to delete item'); }
    return r.json();
  },

  getInventoryCategories: async () => {
    const r = await authenticatedFetch(`${API_BASE_URL}/inventory/categories`);
    if (!r.ok) throw new Error('Failed to fetch categories');
    return r.json();
  },
  createInventoryCategory: async (data) => {
    const r = await authenticatedFetch(`${API_BASE_URL}/inventory/categories`, { method: 'POST', body: JSON.stringify(data) });
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || 'Failed to create category'); }
    return r.json();
  },
  updateInventoryCategory: async (id, data) => {
    const r = await authenticatedFetch(`${API_BASE_URL}/inventory/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || 'Failed to update category'); }
    return r.json();
  },
  deleteInventoryCategory: async (id) => {
    const r = await authenticatedFetch(`${API_BASE_URL}/inventory/categories/${id}`, { method: 'DELETE' });
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || 'Failed to delete category'); }
    return r.json();
  },

  getInventorySuppliers: async () => {
    const r = await authenticatedFetch(`${API_BASE_URL}/inventory/suppliers`);
    if (!r.ok) throw new Error('Failed to fetch suppliers');
    return r.json();
  },
  createInventorySupplier: async (data) => {
    const r = await authenticatedFetch(`${API_BASE_URL}/inventory/suppliers`, { method: 'POST', body: JSON.stringify(data) });
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || 'Failed to create supplier'); }
    return r.json();
  },
  updateInventorySupplier: async (id, data) => {
    const r = await authenticatedFetch(`${API_BASE_URL}/inventory/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || 'Failed to update supplier'); }
    return r.json();
  },
  deleteInventorySupplier: async (id) => {
    const r = await authenticatedFetch(`${API_BASE_URL}/inventory/suppliers/${id}`, { method: 'DELETE' });
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || 'Failed to delete supplier'); }
    return r.json();
  },

  getInventoryMovements: async (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    const r = await authenticatedFetch(`${API_BASE_URL}/inventory/movements${qs ? `?${qs}` : ''}`);
    if (!r.ok) throw new Error('Failed to fetch movements');
    return r.json();
  },
  createInventoryMovement: async (data) => {
    const r = await authenticatedFetch(`${API_BASE_URL}/inventory/movements`, { method: 'POST', body: JSON.stringify(data) });
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || 'Failed to record movement'); }
    return r.json();
  },

  getInventoryOrders: async (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    const r = await authenticatedFetch(`${API_BASE_URL}/inventory/orders${qs ? `?${qs}` : ''}`);
    if (!r.ok) throw new Error('Failed to fetch purchase orders');
    return r.json();
  },
  getInventoryOrder: async (id) => {
    const r = await authenticatedFetch(`${API_BASE_URL}/inventory/orders/${id}`);
    if (!r.ok) throw new Error('Failed to fetch purchase order');
    return r.json();
  },
  createInventoryOrder: async (data) => {
    const r = await authenticatedFetch(`${API_BASE_URL}/inventory/orders`, { method: 'POST', body: JSON.stringify(data) });
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || 'Failed to create order'); }
    return r.json();
  },
  updateInventoryOrder: async (id, data) => {
    const r = await authenticatedFetch(`${API_BASE_URL}/inventory/orders/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || 'Failed to update order'); }
    return r.json();
  },
  receiveInventoryOrder: async (id, data) => {
    const r = await authenticatedFetch(`${API_BASE_URL}/inventory/orders/${id}/receive`, { method: 'POST', body: JSON.stringify(data) });
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || 'Failed to receive order'); }
    return r.json();
  },
  deleteInventoryOrder: async (id) => {
    const r = await authenticatedFetch(`${API_BASE_URL}/inventory/orders/${id}`, { method: 'DELETE' });
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || 'Failed to delete order'); }
    return r.json();
  },

  getInventorySummary: async () => {
    const r = await authenticatedFetch(`${API_BASE_URL}/inventory/reports/summary`);
    if (!r.ok) throw new Error('Failed to fetch inventory summary');
    return r.json();
  },
  getInventoryStockLevels: async () => {
    const r = await authenticatedFetch(`${API_BASE_URL}/inventory/reports/stock-levels`);
    if (!r.ok) throw new Error('Failed to fetch stock levels');
    return r.json();
  },
  getInventoryLowStock: async () => {
    const r = await authenticatedFetch(`${API_BASE_URL}/inventory/reports/low-stock`);
    if (!r.ok) throw new Error('Failed to fetch low stock report');
    return r.json();
  },
  getInventoryMovementHistory: async () => {
    const r = await authenticatedFetch(`${API_BASE_URL}/inventory/reports/movement-history`);
    if (!r.ok) throw new Error('Failed to fetch movement history');
    return r.json();
  },
  getInventoryValuation: async () => {
    const r = await authenticatedFetch(`${API_BASE_URL}/inventory/reports/valuation`);
    if (!r.ok) throw new Error('Failed to fetch valuation');
    return r.json();
  },
  getInventoryExpiryAlerts: async () => {
    const r = await authenticatedFetch(`${API_BASE_URL}/inventory/reports/expiry-alerts`);
    if (!r.ok) throw new Error('Failed to fetch expiry alerts');
    return r.json();
  },

  getInventoryPermissions: async () => {
    const r = await authenticatedFetch(`${API_BASE_URL}/inventory/rbac/permissions`);
    if (!r.ok) throw new Error('Failed to fetch inventory permissions');
    return r.json();
  },
  updateInventoryPermission: async (data) => {
    const r = await authenticatedFetch(`${API_BASE_URL}/inventory/rbac/permissions`, { method: 'PUT', body: JSON.stringify(data) });
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || 'Failed to update permission'); }
    return r.json();
  },
  getInventoryBackups: async () => {
    const r = await authenticatedFetch(`${API_BASE_URL}/inventory/backup`);
    if (!r.ok) throw new Error('Failed to fetch inventory backups');
    return r.json();
  },
  createInventoryBackup: async (data) => {
    const r = await authenticatedFetch(`${API_BASE_URL}/inventory/backup`, { method: 'POST', body: JSON.stringify(data) });
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || 'Backup failed'); }
    return r.json();
  },

  // ── FHIR tracking ──────────────────────────────────────────────────────────
  // Every /api/fhir-tracking route sits behind `authenticate`, so these must go
  // through authenticatedFetch — a bare fetch/axios call gets a 401.
  getFhirTracking: async (trackingNumber) => {
    const r = await authenticatedFetch(`${API_BASE_URL}/fhir-tracking/${encodeURIComponent(trackingNumber)}`);
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || 'Failed to fetch tracking'); }
    const data = await r.json();
    return data.tracking;
  },
  getFhirTrackingForResource: async (resourceType, resourceId) => {
    const r = await authenticatedFetch(
      `${API_BASE_URL}/fhir-tracking/resource/${encodeURIComponent(resourceType)}/${encodeURIComponent(resourceId)}`
    );
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || 'Failed to fetch tracking'); }
    const data = await r.json();
    return data.tracking;
  },
  getFhirTrackingErrors: async () => {
    const r = await authenticatedFetch(`${API_BASE_URL}/fhir-tracking/errors/action-required`);
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || 'Failed to fetch tracking errors'); }
    const data = await r.json();
    return data.errors || [];
  },
  getPatientFhirTrackingSummary: async (patientId) => {
    const r = await authenticatedFetch(`${API_BASE_URL}/fhir-tracking/patient/${encodeURIComponent(patientId)}/summary`);
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || 'Failed to fetch tracking summary'); }
    return r.json();
  },
  resolveFhirTrackingError: async (trackingId, data) => {
    const r = await authenticatedFetch(`${API_BASE_URL}/fhir-tracking/${encodeURIComponent(trackingId)}/resolve-error`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || 'Failed to resolve error'); }
    return r.json();
  },

  // ── Google Calendar sync (patient-scoped) ──────────────────────────────────
  // /api/calendar-sync is authenticated and authorises the caller against the
  // patient in the path, so these calls must carry the Bearer token.
  getCalendarSyncStatus: async (patientId) => {
    const r = await authenticatedFetch(`${API_BASE_URL}/calendar-sync/status/${encodeURIComponent(patientId)}`);
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || 'Failed to check calendar status'); }
    return r.json();
  },
  getCalendarAuthUrl: async (patientId) => {
    const r = await authenticatedFetch(`${API_BASE_URL}/calendar-sync/auth-url?patientId=${encodeURIComponent(patientId)}`);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || 'Failed to start Google Calendar authorization');
    return data.authUrl;
  },
  disconnectCalendarSync: async (patientId) => {
    const r = await authenticatedFetch(`${API_BASE_URL}/calendar-sync/disconnect/${encodeURIComponent(patientId)}`, {
      method: 'DELETE'
    });
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || 'Failed to disconnect Google Calendar'); }
    return r.json();
  },
  syncAppointmentToCalendar: async (appointmentId, patientId) => {
    const r = await authenticatedFetch(`${API_BASE_URL}/calendar-sync/sync-appointment`, {
      method: 'POST',
      body: JSON.stringify({ appointmentId, patientId })
    });
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || 'Failed to sync appointment'); }
    return r.json();
  },
  setCalendarAutoSync: async (patientId, enabled) => {
    const r = await authenticatedFetch(`${API_BASE_URL}/calendar-sync/auto-sync/${encodeURIComponent(patientId)}`, {
      method: 'PUT',
      body: JSON.stringify({ enabled })
    });
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || 'Failed to update auto-sync'); }
    return r.json();
  },

  // ── Public provider booking (/book/<slug>) ─────────────────────────────────
  // These endpoints are open, but they still go through API_BASE_URL so the
  // page works when the frontend and backend are on different origins.
  getPublicBookingConfig: async (slug) => {
    const r = await authenticatedFetch(`${API_BASE_URL}/scheduling/booking-config/slug/${encodeURIComponent(slug)}`);
    if (!r.ok) throw new Error('Provider not found or booking not available');
    return r.json();
  },
  getPublicAppointmentTypes: async (providerId) => {
    const r = await authenticatedFetch(`${API_BASE_URL}/scheduling/appointment-types/${encodeURIComponent(providerId)}`);
    if (!r.ok) throw new Error('Failed to fetch appointment types');
    return r.json();
  },
  getPublicAvailableDates: async (providerId, { startDate, endDate, appointmentTypeId }) => {
    const query = new URLSearchParams({ startDate, endDate, appointmentTypeId }).toString();
    const r = await authenticatedFetch(`${API_BASE_URL}/scheduling/available-dates/${encodeURIComponent(providerId)}?${query}`);
    if (!r.ok) throw new Error('Failed to fetch available dates');
    return r.json();
  },
  getPublicAvailableSlots: async (providerId, { date, appointmentTypeId }) => {
    const query = new URLSearchParams({ date, appointmentTypeId }).toString();
    const r = await authenticatedFetch(`${API_BASE_URL}/scheduling/slots/${encodeURIComponent(providerId)}?${query}`);
    if (!r.ok) throw new Error('Failed to fetch available slots');
    return r.json();
  },
  bookPublicAppointment: async (payload) => {
    const r = await authenticatedFetch(`${API_BASE_URL}/scheduling/book`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || 'Failed to book appointment'); }
    return r.json();
  },

  // Token lifecycle helpers — called by LoginPage (store) and App logout (clear)
  storeToken: (token) => {
    try {
      sessionStorage.setItem('token', token);
    } catch (e) {
      console.error('Failed to store token:', e);
    }
  },
  clearToken: () => {
    try {
      sessionStorage.removeItem('token');
    } catch (e) {
      console.error('Failed to clear token:', e);
    }
  }
};

export default api;
