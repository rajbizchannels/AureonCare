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

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// ── Shapes returned by the backend ──────────────────────────────────────────

export type Role =
  | 'admin' | 'doctor' | 'nurse' | 'receptionist'
  | 'billing_manager' | 'crm_manager' | 'staff' | 'patient';

export interface Account {
  id: string;
  email: string;
  role: Role;
  firstName?: string;
  lastName?: string;
  specialty?: string;
  mrn?: string;
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
  private onUnauthorized: (() => void) | null = null;

  constructor(baseUrl: string, credential: Credential | null = null) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.credential = credential;
  }

  setUnauthorizedHandler(handler: (() => void) | null): void {
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
      // Only a credentialled request can have its credential rejected; a 401
      // from a login attempt is a wrong password, not a dead session.
      if (response.status === 401 && this.credential) this.onUnauthorized?.();
      const detail = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new ApiError(response.status, detail?.error ?? `Request failed (${response.status})`);
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  /** Raw bytes (attachment downloads), which are not JSON. */
  private async requestBlob(path: string): Promise<Blob> {
    const response = await fetch(`${this.baseUrl}/api${path}`, { headers: this.headers() });
    if (!response.ok) {
      if (response.status === 401 && this.credential) this.onUnauthorized?.();
      throw new ApiError(response.status, `Download failed (${response.status})`);
    }
    return response.blob();
  }

  // ── Auth ──────────────────────────────────────────────────────────────────

  /**
   * Staff sign-in. The response's `user.role` is what decides which shell the
   * app renders — the app never asks the person which kind of user they are.
   */
  async signInStaff(email: string, password: string): Promise<{ token: string; user: Account }> {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
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

  // ── Appointments ──────────────────────────────────────────────────────────

  listPatientAppointments(patientId: string): Promise<unknown[]> {
    return this.credential?.kind === 'portal'
      ? this.request(`/patient-portal/${patientId}/appointments`)
      : this.request(`/appointments?patientId=${encodeURIComponent(patientId)}`);
  }

  listAppointments(): Promise<unknown[]> {
    return this.request('/appointments');
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
