/**
 * Sick notes — plain logic shared by the patient and clinician screens, kept free of React
 * Native so it is tested with node (tests/sickNotes.test.mjs). The rules mirror the server
 * (backend/services/sickNotes.js) so the form says what is wrong before a round trip; the
 * server still decides.
 */

export type Fitness = 'not_fit' | 'may_be_fit';
export type Purpose = 'work' | 'school' | 'other';

export interface SickNote {
  id: string;
  reference: string;
  patientId: string;
  purpose: Purpose;
  fitness: Fitness;
  assessedOn: string;
  startDate: string;
  endDate: string;
  days: number;
  conditionText: string | null;
  adjustments: string[];
  comments: string | null;
  followUp: boolean;
  issuerName: string;
  issuerTitle: string | null;
  status: 'issued' | 'voided';
  voidReason: string | null;
  emailedAt: string | null;
  createdAt: string;
}

export const ADJUSTMENT_LABELS: Record<string, string> = {
  phased_return: 'A phased return to work',
  altered_hours: 'Altered hours',
  amended_duties: 'Amended duties',
  workplace_adaptations: 'Workplace adaptations',
};
export const PURPOSE_LABELS: Record<Purpose, string> = { work: 'Work', school: 'School or college', other: 'Normal activities' };
export const MAX_DAYS = 92;

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const at = (iso: string) => new Date(`${iso}T12:00:00Z`);

export function todayIso(now: Date = new Date()): string {
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())).toISOString().slice(0, 10);
}
export function plusDays(iso: string, n: number): string {
  const d = at(iso); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}
/** Inclusive day count, or null when the dates are not a valid range. */
export function dayCount(start: string, end: string): number | null {
  if (!ISO.test(start) || !ISO.test(end) || end < start) return null;
  return Math.round((at(end).getTime() - at(start).getTime()) / 86400000) + 1;
}

export interface Draft {
  purpose: Purpose;
  fitness: Fitness;
  assessedOn: string;
  startDate: string;
  endDate: string;
  conditionText: string;
  adjustments: string[];
  comments: string;
  followUp: boolean;
  /** Set when the note answers a patient's request. */
  requestId?: string;
}

export function blankDraft(today: string = todayIso()): Draft {
  return { purpose: 'work', fitness: 'not_fit', assessedOn: today, startDate: today, endDate: plusDays(today, 6),
    conditionText: '', adjustments: [], comments: '', followUp: false };
}

/** The first problem with a draft, in the words the form shows — or null when it can be sent. */
export function draftProblem(d: Draft, today: string = todayIso()): string | null {
  if (!ISO.test(d.assessedOn)) return 'Enter the assessment date as YYYY-MM-DD.';
  if (d.assessedOn > today) return 'The assessment date cannot be in the future.';
  if (!ISO.test(d.startDate) || !ISO.test(d.endDate)) return 'Enter the first and last day as YYYY-MM-DD.';
  const days = dayCount(d.startDate, d.endDate);
  if (days === null) return 'The last day cannot be before the first day.';
  if (days > MAX_DAYS) return `One note can cover at most ${MAX_DAYS} days.`;
  if (d.fitness === 'may_be_fit' && !d.adjustments.length && !d.comments.trim()) {
    return 'For "may be fit", choose an adjustment or write advice in the comments.';
  }
  return null;
}

/** The request body the server expects. */
export function toRequest(patientId: string, d: Draft) {
  return {
    patientId, purpose: d.purpose, fitness: d.fitness, assessedOn: d.assessedOn,
    startDate: d.startDate, endDate: d.endDate, conditionText: d.conditionText.trim() || undefined,
    adjustments: d.fitness === 'may_be_fit' ? d.adjustments.filter((a) => ADJUSTMENT_LABELS[a]) : [],
    comments: d.comments.trim() || undefined, followUp: d.followUp,
    ...(d.requestId ? { requestId: d.requestId } : {}),
  };
}

/** "22 Nov – 28 Nov 2026 (7 days)". */
export function dateRange(start: string, end: string, days: number): string {
  const fmt = (iso: string, year: boolean) => at(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}), timeZone: 'UTC' });
  return `${fmt(start, false)} – ${fmt(end, true)} (${days} day${days === 1 ? '' : 's'})`;
}

/** One line for a list row: "Not fit for work · 3 Mar – 9 Mar 2027 (7 days)". */
export function summary(n: Pick<SickNote, 'fitness' | 'purpose' | 'startDate' | 'endDate' | 'days'>): string {
  const what = `${n.fitness === 'not_fit' ? 'Not fit' : 'May be fit'} for ${PURPOSE_LABELS[n.purpose].toLowerCase()}`;
  const fmt = (iso: string, year: boolean) => at(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}), timeZone: 'UTC' });
  return `${what} · ${fmt(n.startDate, false)} – ${fmt(n.endDate, true)} (${n.days} day${n.days === 1 ? '' : 's'})`;
}

// ── requests from patients ─────────────────────────────────────────────────────────

export interface SickNoteRequest {
  id: string;
  patientId: string;
  purpose: Purpose;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: 'pending' | 'issued' | 'declined' | 'cancelled';
  sickNoteId: string | null;
  decisionReason: string | null;
  createdAt: string;
  patientName?: string;
}

export interface RequestDraft { purpose: Purpose; startDate: string; endDate: string; reason: string }

export const REQUEST_BACKDATE_DAYS = 14;
export const REQUEST_AHEAD_DAYS = 30;

export function blankRequest(today: string = todayIso()): RequestDraft {
  return { purpose: 'work', startDate: today, endDate: plusDays(today, 6), reason: '' };
}

/** The same rules as the server (backend/services/sickNotes.js validateRequest). */
export function requestProblem(r: RequestDraft, today: string = todayIso()): string | null {
  if (!ISO.test(r.startDate) || !ISO.test(r.endDate)) return 'Enter the first and last day as YYYY-MM-DD.';
  const days = dayCount(r.startDate, r.endDate);
  if (days === null) return 'The last day cannot be before the first day.';
  if (days > MAX_DAYS) return `A request can cover at most ${MAX_DAYS} days.`;
  if (r.startDate < plusDays(today, -REQUEST_BACKDATE_DAYS)) return `A request can go back at most ${REQUEST_BACKDATE_DAYS} days.`;
  if (r.startDate > plusDays(today, REQUEST_AHEAD_DAYS)) return `A request can start at most ${REQUEST_AHEAD_DAYS} days ahead.`;
  if (r.reason.trim().length < 10) return 'Tell your clinician briefly why you need the note (at least 10 characters).';
  return null;
}

export const REQUEST_STATUS: Record<SickNoteRequest['status'], string> = {
  pending: 'Waiting for your clinician',
  issued: 'Issued — see your sick notes',
  declined: 'Not issued',
  cancelled: 'Cancelled',
};

/** A clinician answering a request: the note form opens with the patient's dates and purpose. */
export function draftFromRequest(r: SickNoteRequest, today: string = todayIso()): Draft {
  return { ...blankDraft(today), purpose: r.purpose, startDate: r.startDate, endDate: r.endDate, requestId: r.id };
}
