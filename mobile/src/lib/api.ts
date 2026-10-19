import { credentials } from './storage';

/**
 * Client for the AureonCare API.
 *
 * The one thing worth understanding here is the credential. A patient can be
 * signed in two ways — a portal session token, or a staff-issued JWT against a
 * users row whose role is 'patient' — and the server resolves both to the same
 * actor (backend/middleware/messagingAuth.js). So messaging and the other
 * shared routes take whichever token this device holds, on the same
 * `Authorization: Bearer` header. Only /patient-portal/* is portal-only, which
 * is why `portalOnly` exists below rather than a second client.
 */

export type Credential =
  | { kind: 'staff'; token: string }
  | { kind: 'portal'; token: string; patientId: string };

/**
 * Why a credential stopped working. The two cases read identically to the
 * client — both are a 401 — but they mean opposite things to the person
 * holding the phone, so the sign-in screen is told which one happened.
 */
export type UnauthorizedReason = 'rejected' | 'timed-out';

export class ApiError extends Error {
  readonly status: number;
  /**
   * The parsed error body, when there was one.
   *
   * Several backend refusals are not merely "no" — they say what to do next.
   * `{ mfaRequired: true }` asks for a second factor, `{ sessionTimedOut: true }`
   * distinguishes an idle sign-out from a revoked token. Dropping the body and
   * keeping only `error` would turn all of those into the same dead end.
   */
  readonly body: Record<string, unknown>;

  constructor(status: number, message: string, body: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }

  private flag(key: string): boolean {
    return this.body[key] === true;
  }

  /** The password was right; the authenticator code is missing or wrong. */
  get mfaRequired(): boolean {
    return this.flag('mfaRequired');
  }

  /** The practice requires a second factor and this account has not set one up. */
  get mfaEnrolmentRequired(): boolean {
    return this.flag('mfaEnrolmentRequired');
  }

  /** Signed out for inactivity, not because the credential was revoked. */
  get sessionTimedOut(): boolean {
    return this.flag('sessionTimedOut');
  }
}

// ── Shapes returned by the backend ──────────────────────────────────────────

// The role set and what each role may do live in ./permissions, next to the
// matrix the web app uses, rather than here.
export type { Role } from './permissions';
import type { Role } from './permissions';

export interface Account {
  id: string;
  email: string;
  role: Role;
  firstName?: string;
  lastName?: string;
  specialty?: string;
  mrn?: string;
  /** Which practice this account belongs to. Added by the SEC-05 tenant cutover. */
  practiceId?: string | null;
}

export interface Participant {
  kind: 'user' | 'patient';
  participantId: string;
  displayName: string;
}

export interface Thread {
  id: string;
  subject: string;
  threadType: 'care_team' | 'patient';
  patientId: string | null;
  patientName: string | null;
  patientMrn: string | null;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'open' | 'closed';
  messageCount: number;
  unreadCount: number;
  lastMessageAt: string;
  participants: Participant[];
}

export interface MessageAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface Filing {
  destination: 'patient_records' | 'forms_requested' | 'conversation';
  id: string | null;
}

export interface Message {
  id: string;
  threadId: string;
  senderKind: 'user' | 'patient' | 'system';
  senderId: string | null;
  senderName: string;
  messageType: 'message' | 'system';
  body: string | null;
  undecryptable: boolean;
  sentAt: string;
  deletedAt: string | null;
  attachments: MessageAttachment[];
  filings: Filing[];
}

export interface Recipient {
  kind: 'user' | 'patient';
  id: string;
  displayName: string;
  email?: string;
  role?: string;
  specialty?: string;
  mrn?: string;
}

export interface PendingReview {
  id: string;
  patient_id: string;
  title: string;
  record_date: string;
  created_at: string;
  patient_name: string | null;
  patient_mrn: string | null;
  attachments: { messageAttachmentId?: string; originalName?: string }[];
}

/**
 * Rows below are returned as `SELECT *` by their routes, so the field names
 * are the database columns — snake_case, not camelCase like `Account`. They
 * are typed as they actually arrive rather than being renamed in flight, so a
 * reader can match a screen against the SQL that feeds it.
 */

export interface ProviderRef {
  id: string | null;
  first_name: string | null;
  last_name: string | null;
  specialty?: string | null;
}

export interface Appointment {
  id: string;
  patient_id: string;
  provider_id: string | null;
  appointment_type: string | null;
  status: string;
  start_time: string;
  end_time: string;
  duration_minutes: number | null;
  reason: string | null;
  notes: string | null;
  meeting_url?: string | null;
  provider?: ProviderRef | null;
}

export interface MedicalRecord {
  id: string;
  patient_id: string;
  record_type: string;
  record_date: string;
  title: string | null;
  description: string | null;
  attachments: { messageAttachmentId?: string; originalName?: string; classification?: string }[] | null;
  /** Present once migration 060 has run. */
  source?: 'manual' | 'secure_message';
  review_status?: 'pending_review' | 'accepted' | 'rejected' | null;
  provider?: ProviderRef | null;
}

export interface PatientRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  mrn: string | null;
  email: string | null;
  phone: string | null;
  dob?: string | null;
  date_of_birth?: string | null;
  allergies?: string | null;
  blood_type?: string | null;
  current_medications?: string | null;
}

export interface Prescription {
  id: string;
  patient_id: string;
  medication_name: string | null;
  generic_name?: string | null;
  brand_name?: string | null;
  dosage: string | null;
  frequency: string | null;
  status: string | null;
  prescribed_date: string | null;
  refills: number | null;
  provider_name?: string | null;
}

export interface Diagnosis {
  id: string | number;
  patient_id: string;
  diagnosis_code: string | null;
  diagnosis_name: string;
  severity: string | null;
  status: string | null;
  diagnosed_date: string | null;
}

export interface Claim {
  id: string;
  claim_number: string;
  payer: string | null;
  service_date: string;
  amount: string | number | null;
  status: string;
  patient_id: string | null;
}

export interface LabOrder {
  id: string;
  order_number: string | null;
  order_type: string | null;
  priority: string | null;
  status: string | null;
  patient_id: string;
  created_at: string;
}

/**
 * Rows from the routes added since the mobile app was first built. These
 * routes camelCase their output in the handler (`toCamelCase` at the top of
 * each file), unlike the older `SELECT *` ones above — so the casing below is
 * inconsistent on purpose: it is what each endpoint actually sends.
 */

export interface Location {
  id: string;
  name: string;
  locationType: string | null;
  addressLine1: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  isPrimary: boolean;
  isActive: boolean;
}

export type CampStatus = 'draft' | 'published' | 'in_progress' | 'completed' | 'cancelled';

export interface Camp {
  id: string;
  name: string;
  description: string | null;
  status: CampStatus;
  startsAt: string;
  endsAt: string;
  locationId: string | null;
  locationName?: string | null;
  capacity: number | null;
  isFree: boolean;
  sponsorName: string | null;
  /** Derived in the list query, so absent from GET /camps/:id. */
  registrationCount?: number;
  staffCount?: number;
  serviceCount?: number;
}

export interface CampStation {
  id: string;
  name: string;
  stepOrder: number;
  isClinical: boolean;
  isActive: boolean;
  queued: number;
  inProgress: number;
  completed: number;
  longestWaitSeconds: number | null;
}

export interface CampRegistration {
  id: string;
  campId: string;
  tokenNo: number;
  fullName: string;
  phone: string | null;
  email: string | null;
  ageYears: number | null;
  dateOfBirth: string | null;
  gender: string | null;
  status: string;
  consentGivenAt: string | null;
  patientId: string | null;
  createdAt: string;
}

export interface StationVisit {
  id: string;
  registrationId: string;
  stationId: string;
  status: 'queued' | 'in_progress' | 'completed';
  queuedAt: string;
  tokenNo: number;
  fullName: string;
  ageYears: number | null;
  gender: string | null;
  consentGivenAt: string | null;
  patientId: string | null;
}

export interface FormSubmission {
  id: string;
  template_id: string | null;
  template_name: string | null;
  status: string;
  source?: 'manual' | 'secure_message' | null;
  document_attachment_id?: string | null;
  document_name?: string | null;
  document_action?: 'acknowledge' | 'sign' | null;
  patient_id?: string | null;
  patient_name?: string | null;
  mrn?: string | null;
  created_at: string;
  submitted_at: string | null;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: 'High' | 'Medium' | 'Low' | string;
  status: string;
  dueDate: string | null;
  createdAt: string;
}

/** `SELECT *` from `notifications`, so snake_case. */
export interface Notification {
  id: string;
  user_id: string | null;
  type: string | null;
  message: string;
  read: boolean;
  created_at: string;
}

export interface MfaStatus {
  enabled: boolean;
  enrolledAt: string | null;
  backupCodesRemaining: number;
  requiredByPractice: boolean;
  sessionIdleMinutes: number | null;
}

export interface MfaEnrolment {
  base32: string;
  otpauthUrl?: string;
  qr?: string;
  note?: string;
}

/**
 * Why this account is seeing errors everywhere.
 *
 * A staff account only works if it resolves to a provisioned tenant schema.
 * When it does not, every clinical route 500s identically and the app looks
 * broken rather than misconfigured — so this is read once after sign-in and
 * surfaced as one explanation instead of eight empty screens.
 */
export interface TenantStatus {
  healthy: boolean;
  resolvedSchema: string | null;
  practiceId: string | null;
  practiceName: string | null;
  tenantStatus: string | null;
  schemaExists: boolean;
  tableCount: number;
  templateTableCount: number;
  /** Null when everything resolves; otherwise one sentence naming the cause. */
  problem: string | null;
}

/** What the sender wants done with an attachment; mirrors messageDocumentFiling.js. */
export type Disposition = 'records' | 'form_request' | 'none';

export interface OutgoingAttachment {
  fileName: string;
  mimeType: string;
  contentBase64: string;
  disposition?: Disposition;
  documentAction?: 'acknowledge' | 'sign';
}

// ── Client ──────────────────────────────────────────────────────────────────

export class ApiClient {
  private baseUrl: string;
  private credential: Credential | null;
  /**
   * Called when the server rejects this client's credential.
   *
   * Tokens do not only expire — since SEC-09 the backend can revoke one, and a
   * portal session lapses after 24h. Without this the app would sit in a
   * signed-in state where every screen quietly fails; the session layer wires
   * it to sign-out so the person is returned to a login they can act on.
   */
  private onUnauthorized: ((reason: UnauthorizedReason) => void) | null = null;

  constructor(baseUrl: string, credential: Credential | null = null) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.credential = credential;
  }

  setUnauthorizedHandler(handler: ((reason: UnauthorizedReason) => void) | null): void {
    this.onUnauthorized = handler;
  }

  setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/$/, '');
  }

  setCredential(credential: Credential | null): void {
    this.credential = credential;
  }

  get actorIsPortal(): boolean {
    return this.credential?.kind === 'portal';
  }

  private headers(extra?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...extra };
    if (this.credential) headers['Authorization'] = `Bearer ${this.credential.token}`;
    return headers;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}/api${path}`, {
      ...init,
      headers: this.headers(init.headers as Record<string, string> | undefined),
    });

    if (!response.ok) {
      const detail = (await response.json().catch(() => null)) as
        | (Record<string, unknown> & { error?: string; message?: string })
        | null;
      // Only a credentialled request can have its credential rejected; a 401
      // from a login attempt is a wrong password, not a dead session.
      if (response.status === 401 && this.credential) {
        this.onUnauthorized?.(detail?.sessionTimedOut === true ? 'timed-out' : 'rejected');
      }
      throw new ApiError(
        response.status,
        detail?.error ?? detail?.message ?? `Request failed (${response.status})`,
        detail ?? {}
      );
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  /** Raw bytes (attachment downloads), which are not JSON. */
  private async requestBlob(path: string): Promise<Blob> {
    const response = await fetch(`${this.baseUrl}/api${path}`, { headers: this.headers() });
    if (!response.ok) {
      if (response.status === 401 && this.credential) this.onUnauthorized?.('rejected');
      throw new ApiError(response.status, `Download failed (${response.status})`);
    }
    return response.blob();
  }

  // ── Auth ──────────────────────────────────────────────────────────────────

  /**
   * Staff sign-in. The response's `user.role` is what decides which shell the
   * app renders — the app never asks the person which kind of user they are.
   */
  async signInStaff(
    email: string,
    password: string,
    mfaCode?: string
  ): Promise<{ token: string; user: Account }> {
    return this.request('/auth/login', {
      method: 'POST',
      // Omitted rather than sent empty: the backend branches on the key being
      // absent to decide whether to challenge or to reject a wrong code.
      body: JSON.stringify(mfaCode ? { email, password, mfaCode } : { email, password }),
    });
  }

  /** Exchanges a verified provider token for an AureonCare session. */
  async signInSocial(input: {
    provider: 'google' | 'microsoft';
    providerId: string;
    accessToken: string;
  }): Promise<{ token: string; user: Account }> {
    return this.request('/auth/social-login', { method: 'POST', body: JSON.stringify(input) });
  }

  /** Patient portal sign-in — a different table and a different token shape. */
  async signInPortal(
    email: string,
    password: string
  ): Promise<{ patient: Account & { id: string }; sessionToken: string; expiresAt: string }> {
    return this.request('/patient-portal/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  // ── Messaging ─────────────────────────────────────────────────────────────

  listThreads(params: { status?: string; q?: string } = {}): Promise<Thread[]> {
    const query = new URLSearchParams();
    if (params.status && params.status !== 'all') query.set('status', params.status);
    if (params.q) query.set('q', params.q);
    const suffix = query.toString() ? `?${query}` : '';
    return this.request(`/messages/threads${suffix}`);
  }

  async unreadCount(): Promise<number> {
    const { count } = await this.request<{ count: number }>('/messages/unread-count');
    return count;
  }

  listMessages(threadId: string): Promise<Message[]> {
    return this.request(`/messages/threads/${threadId}/messages`);
  }

  sendMessage(
    threadId: string,
    body: string,
    attachments: OutgoingAttachment[] = []
  ): Promise<Message & { filings: Filing[] }> {
    return this.request(`/messages/threads/${threadId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ body, attachments }),
    });
  }

  markThreadRead(threadId: string): Promise<{ success: boolean }> {
    return this.request(`/messages/threads/${threadId}/read`, { method: 'POST' });
  }

  createThread(input: {
    subject: string;
    body: string;
    participants: { kind: 'user' | 'patient'; id: string }[];
    patientId?: string;
    priority?: string;
  }): Promise<Thread> {
    return this.request('/messages/threads', { method: 'POST', body: JSON.stringify(input) });
  }

  /** Staff directory. Refused for patient actors by design — see the route. */
  listRecipients(q = ''): Promise<{ staff: Recipient[]; patients: Recipient[] }> {
    return this.request(`/messages/recipients?q=${encodeURIComponent(q)}`);
  }

  /** The patient-safe alternative: only this patient's own care team. */
  listCareTeam(patientId?: string): Promise<Recipient[]> {
    const suffix = patientId ? `?patientId=${encodeURIComponent(patientId)}` : '';
    return this.request(`/messages/care-team${suffix}`);
  }

  downloadMessageAttachment(attachmentId: string): Promise<Blob> {
    return this.requestBlob(`/messages/attachments/${attachmentId}`);
  }

  // ── Records ───────────────────────────────────────────────────────────────

  /**
   * Portal sessions cannot reach /medical-records (staff JWT only), so this
   * picks the mirrored portal route when that is the credential in hand.
   */
  listRecords(patientId: string): Promise<unknown[]> {
    return this.credential?.kind === 'portal'
      ? this.request(`/patient-portal/${patientId}/medical-records`)
      : this.request(`/medical-records?patientId=${encodeURIComponent(patientId)}`);
  }

  /** Staff-only: patient uploads nobody has verified yet, oldest first. */
  listPendingReviews(limit = 25): Promise<PendingReview[]> {
    return this.request(`/medical-records/pending-review?limit=${limit}`);
  }

  reviewDocument(
    recordId: string,
    decision: 'accepted' | 'rejected',
    notes?: string
  ): Promise<{ success: boolean }> {
    return this.request(`/medical-records/${recordId}/review`, {
      method: 'POST',
      body: JSON.stringify({ decision, notes }),
    });
  }

  downloadRecordAttachment(
    recordId: string,
    attachmentId: string,
    patientId: string
  ): Promise<Blob> {
    return this.credential?.kind === 'portal'
      ? this.requestBlob(`/patient-portal/${patientId}/medical-records/${recordId}/attachments/${attachmentId}`)
      : this.requestBlob(`/medical-records/${recordId}/attachments/${attachmentId}`);
  }

  // ── Appointments ──────────────────────────────────────────────────────────

  listPatientAppointments(patientId: string): Promise<Appointment[]> {
    return this.credential?.kind === 'portal'
      ? this.request(`/patient-portal/${patientId}/appointments`)
      : this.request(`/appointments?patientId=${encodeURIComponent(patientId)}`);
  }

  listAppointments(): Promise<Appointment[]> {
    return this.request('/appointments');
  }

  // ── Clinical ──────────────────────────────────────────────────────────────

  listPatients(): Promise<PatientRow[]> {
    return this.request('/patients');
  }

  getPatient(id: string): Promise<PatientRow> {
    return this.request(`/patients/${id}`);
  }

  listPrescriptions(patientId?: string): Promise<Prescription[]> {
    const suffix = patientId ? `?patientId=${encodeURIComponent(patientId)}` : '';
    return this.request(`/prescriptions${suffix}`);
  }

  listDiagnoses(patientId?: string): Promise<Diagnosis[]> {
    const suffix = patientId ? `?patientId=${encodeURIComponent(patientId)}` : '';
    return this.request(`/diagnosis${suffix}`);
  }

  listLabOrders(patientId?: string): Promise<LabOrder[]> {
    const suffix = patientId ? `?patientId=${encodeURIComponent(patientId)}` : '';
    return this.request(`/lab-orders${suffix}`);
  }

  // ── Revenue cycle ─────────────────────────────────────────────────────────

  listClaims(): Promise<Claim[]> {
    return this.request('/claims');
  }

  // ── Account ───────────────────────────────────────────────────────────────

  /** The live account. Roles change while someone is signed in; this is how we notice. */
  me(): Promise<Account> {
    return this.request('/auth/me');
  }

  tenantStatus(): Promise<TenantStatus> {
    return this.request('/auth/tenant-status');
  }

  mfaStatus(): Promise<MfaStatus> {
    return this.request('/auth/mfa/status');
  }

  beginMfaEnrolment(): Promise<MfaEnrolment> {
    return this.request('/auth/mfa/enroll', { method: 'POST' });
  }

  /** Proves the authenticator works and switches the factor on. Returns recovery codes. */
  confirmMfaEnrolment(code: string): Promise<{ backupCodes?: string[] }> {
    return this.request('/auth/mfa/verify', { method: 'POST', body: JSON.stringify({ code }) });
  }

  disableMfa(password: string): Promise<{ success?: boolean }> {
    return this.request('/auth/mfa/disable', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
  }

  // ── Sites ─────────────────────────────────────────────────────────────────

  listLocations(): Promise<Location[]> {
    return this.request('/locations');
  }

  // ── Medical camps ─────────────────────────────────────────────────────────

  listCamps(params: { status?: string; locationId?: string } = {}): Promise<Camp[]> {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.locationId) query.set('locationId', params.locationId);
    const suffix = query.toString() ? `?${query}` : '';
    return this.request(`/camps${suffix}`);
  }

  getCamp(id: string): Promise<Camp> {
    return this.request(`/camps/${id}`);
  }

  /** Every station with its live queue depth and longest wait. */
  campBoard(campId: string): Promise<CampStation[]> {
    return this.request(`/camps/${campId}/board`);
  }

  stationQueue(stationId: string): Promise<StationVisit[]> {
    return this.request(`/camps/stations/${stationId}/queue`);
  }

  startVisit(visitId: string): Promise<StationVisit> {
    return this.request(`/camps/visits/${visitId}/start`, { method: 'POST' });
  }

  completeVisit(
    visitId: string,
    input: { outcome?: string; notes?: string } = {}
  ): Promise<StationVisit> {
    return this.request(`/camps/visits/${visitId}/complete`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  listCampRegistrations(params: {
    campId: string;
    status?: string;
    q?: string;
  }): Promise<CampRegistration[]> {
    const query = new URLSearchParams({ campId: params.campId });
    if (params.status) query.set('status', params.status);
    if (params.q) query.set('q', params.q);
    return this.request(`/camp-registrations?${query}`);
  }

  /**
   * Register an attendee. The backend allocates the token number and, if the
   * camp is already running, queues them at the first station — so the reply
   * carries both and the desk does not have to make a second call.
   */
  registerAttendee(input: {
    campId: string;
    fullName: string;
    phone?: string;
    ageYears?: number;
    dateOfBirth?: string;
    gender?: string;
    city?: string;
    consentGiven?: boolean;
    notes?: string;
  }): Promise<{ registration: CampRegistration; firstVisit: StationVisit | null }> {
    return this.request('/camp-registrations', { method: 'POST', body: JSON.stringify(input) });
  }

  recordConsent(registrationId: string): Promise<CampRegistration> {
    return this.request(`/camp-registrations/${registrationId}/consent`, { method: 'POST' });
  }

  queueAtStation(registrationId: string, stationId: string): Promise<StationVisit> {
    return this.request(`/camp-registrations/${registrationId}/queue`, {
      method: 'POST',
      body: JSON.stringify({ stationId }),
    });
  }

  // ── Forms ─────────────────────────────────────────────────────────────────

  /**
   * Forms waiting on a patient. Portal sessions read their own through
   * /patient-portal; staff read any patient's through /form-management.
   */
  listFormSubmissions(patientId?: string): Promise<FormSubmission[]> {
    if (this.credential?.kind === 'portal') {
      if (!patientId) throw new ApiError(400, 'A patient is required to list form requests.');
      return this.request(`/patient-portal/${patientId}/form-requests`);
    }
    const suffix = patientId ? `?patient_id=${encodeURIComponent(patientId)}` : '';
    return this.request(`/form-management/submissions${suffix}`);
  }

  acknowledgeForm(submissionId: string, patientId?: string): Promise<{ success?: boolean }> {
    return this.credential?.kind === 'portal'
      ? this.request(`/patient-portal/${patientId}/form-requests/${submissionId}/acknowledge`, {
          method: 'POST',
        })
      : this.request(`/form-management/submissions/${submissionId}/acknowledge`, {
          method: 'POST',
        });
  }

  downloadFormDocument(submissionId: string, patientId?: string): Promise<Blob> {
    return this.credential?.kind === 'portal'
      ? this.requestBlob(`/patient-portal/${patientId}/form-requests/${submissionId}/document`)
      : this.requestBlob(`/form-management/submissions/${submissionId}/document`);
  }

  // ── Tasks and notifications ───────────────────────────────────────────────

  listTasks(): Promise<Task[]> {
    return this.request('/tasks');
  }

  updateTask(id: string, patch: Partial<Pick<Task, 'status' | 'priority' | 'title'>>): Promise<Task> {
    return this.request(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(patch) });
  }

  listNotifications(userId?: string): Promise<Notification[]> {
    const suffix = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    return this.request(`/notifications${suffix}`);
  }

  markNotificationRead(id: string): Promise<Notification> {
    return this.request(`/notifications/${id}/read`, { method: 'PUT' });
  }
}

/** Rebuilt whenever the server or the credential changes. */
export const makeClient = async (baseUrl: string): Promise<ApiClient> => {
  const staff = await credentials.getStaffToken();
  const portal = await credentials.getPortalToken();
  if (staff) return new ApiClient(baseUrl, { kind: 'staff', token: staff });
  if (portal) return new ApiClient(baseUrl, { kind: 'portal', token: portal, patientId: '' });
  return new ApiClient(baseUrl, null);
};
