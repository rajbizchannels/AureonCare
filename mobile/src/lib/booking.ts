/**
 * Rules for a patient booking their own appointment.
 *
 * Kept apart from the screen so they can be unit tested, and because the
 * server enforces the same things — an overlap with the provider's diary or
 * the patient's own is a 409 from `/patient-portal/:id/appointments`. These
 * are the checks worth making before the round trip, not instead of it.
 */

import { timeOf, wallClock } from './time.ts';

/** Days a practice will take a booking for, from tomorrow. */
export const BOOKING_HORIZON_DAYS = 28;

/** Local midnight, so "today" means the device's day, not UTC's. */
const midnight = (offsetDays = 0): Date => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d;
};

/**
 * The days a patient may choose.
 *
 * Starts tomorrow rather than today: a slot two hours from now is the kind of
 * thing the desk arranges by phone, and offering it invites a booking nobody
 * sees in time. Weekends are included — practices that do not work them have
 * no availability to show, which is a different thing from the app deciding.
 */
export const bookableDays = (horizon = BOOKING_HORIZON_DAYS): Date[] =>
  Array.from({ length: horizon }, (_, i) => midnight(i + 1));

export interface Slot {
  /** Local wall-clock label, e.g. "09:30". */
  label: string;
  /**
   * Local wall-clock time, "2026-11-23 09:30:00" — the form the server stores appointment times
   * in (see lib/time.ts). Not an ISO instant: "…Z" was saved as the UTC clock reading.
   */
  startIso: string;
  endIso: string;
}

/**
 * Candidate times on one day.
 *
 * Generated client-side because the portal exposes no availability endpoint —
 * only a booking one that refuses a clash. So these are *offers*, not
 * promises, and the screen says so: a taken slot comes back 409 and the
 * person picks again. Inventing an availability model here instead would be a
 * guess dressed up as fact.
 */
export const slotsForDay = (
  day: Date,
  { startHour = 9, endHour = 17, stepMinutes = 30, durationMinutes = 30 } = {}
): Slot[] => {
  if (Number.isNaN(day.getTime())) return [];
  if (stepMinutes <= 0 || durationMinutes <= 0) return [];

  const slots: Slot[] = [];
  const open = new Date(day);
  open.setHours(startHour, 0, 0, 0);
  const close = new Date(day);
  close.setHours(endHour, 0, 0, 0);

  for (let t = new Date(open); t < close; t = new Date(t.getTime() + stepMinutes * 60_000)) {
    const end = new Date(t.getTime() + durationMinutes * 60_000);
    // A slot that runs past closing is not a slot.
    if (end > close) break;
    slots.push({
      label: t.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
      startIso: wallClock(t),
      endIso: wallClock(end),
    });
  }
  return slots;
};

/**
 * Times the patient already has something at, so the picker can grey them out
 * rather than letting the server refuse them. Takes the appointments it was
 * given; anything it does not know about is still caught server-side.
 */
export const clashesWith = (
  slot: Pick<Slot, 'startIso' | 'endIso'>,
  existing: { start_time: string; end_time: string; status: string }[]
): boolean => {
  const start = timeOf(slot.startIso);
  const end = timeOf(slot.endIso);
  return existing.some((a) => {
    if (/^(cancelled|canceled|completed)$/i.test(a.status ?? '')) return false;
    const as = timeOf(a.start_time);
    const ae = timeOf(a.end_time);
    if (Number.isNaN(as) || Number.isNaN(ae)) return false;
    // Touching ends do not overlap: 09:00–09:30 and 09:30–10:00 are fine.
    return as < end && ae > start;
  });
};

/** `2026-11-21`, in the device's timezone — the shape the waitlist expects. */
export const toDateInput = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
