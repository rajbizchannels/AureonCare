import type { Camp, CampStation } from './api';

/**
 * Camp rules that are decisions rather than rendering.
 *
 * These live apart from the screens so they can be unit tested without a
 * renderer, and so the registration desk and the station board cannot end up
 * disagreeing about what "open" or "waiting too long" means.
 */

/** Attendees can only be registered against a camp that is actually running. */
export const acceptsRegistrations = (camp: Pick<Camp, 'status'>): boolean =>
  camp.status === 'published' || camp.status === 'in_progress';

/** Only a running camp has a live board; a published one has no visits yet. */
export const hasLiveBoard = (camp: Pick<Camp, 'status'>): boolean => camp.status === 'in_progress';

export const campIsOver = (camp: Pick<Camp, 'status'>): boolean =>
  camp.status === 'closed' || camp.status === 'archived';

/**
 * Why a camp will not take registrations, phrased for the person at the desk
 * rather than as a status code. Returns null when it will.
 */
export const registrationBlockedReason = (
  camp: Pick<Camp, 'status' | 'name' | 'capacity' | 'registrationCount'>
): string | null => {
  if (!acceptsRegistrations(camp)) {
    return `"${camp.name}" is ${camp.status.replace(/_/g, ' ')}. Attendees can be registered once it is published.`;
  }
  if (camp.capacity != null && (camp.registrationCount ?? 0) >= camp.capacity) {
    return `"${camp.name}" has reached its capacity of ${camp.capacity}.`;
  }
  return null;
};

/**
 * An age or a date of birth, but not neither — the same rule the backend
 * enforces, checked here so the desk is told before the round trip.
 *
 * Attendees at a camp routinely know one and not the other, which is why the
 * schema accepts either.
 */
export const validateAttendee = (input: {
  fullName: string;
  ageYears?: string;
  dateOfBirth?: string;
}): string | null => {
  if (!input.fullName.trim()) return 'A name is required.';
  const hasAge = Boolean(input.ageYears && input.ageYears.trim());
  const hasDob = Boolean(input.dateOfBirth && input.dateOfBirth.trim());
  if (!hasAge && !hasDob) {
    return 'Record either an age or a date of birth — attendees often know one but not the other.';
  }
  if (hasAge) {
    const age = Number(input.ageYears);
    if (!Number.isInteger(age) || age < 0 || age > 130) {
      return 'Age must be a whole number between 0 and 130.';
    }
  }
  if (hasDob && Number.isNaN(new Date(input.dateOfBirth as string).getTime())) {
    return 'That date of birth is not a date. Use YYYY-MM-DD.';
  }
  return null;
};

/**
 * A wait, said the way someone glancing at a board reads it. Seconds are
 * noise above a minute and hours matter more than the minutes inside them.
 */
export const formatWait = (seconds: number | null | undefined): string => {
  if (seconds == null || seconds < 0) return '—';
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
};

export type Pressure = 'clear' | 'busy' | 'blocked';

/**
 * How hard a station is being pushed.
 *
 * Queue depth alone is misleading: four people who arrived a minute ago are
 * fine, one who has waited forty is not. Both signals are read, and the worse
 * of the two wins — a board exists to be glanced at, and the glance should
 * land on whatever is actually wrong.
 */
export const stationPressure = (station: Pick<CampStation, 'queued' | 'longestWaitSeconds'>): Pressure => {
  const waitMinutes = (station.longestWaitSeconds ?? 0) / 60;
  if (station.queued >= 10 || waitMinutes >= 45) return 'blocked';
  if (station.queued >= 4 || waitMinutes >= 20) return 'busy';
  return 'clear';
};

export interface BoardSummary {
  waiting: number;
  inProgress: number;
  seen: number;
  /** The station holding things up, if any is.  */
  bottleneck: CampStation | null;
}

/**
 * The board in one line. The bottleneck is the station with the longest wait
 * among those under pressure — not simply the longest queue, because a long
 * queue that is moving is not a problem to escalate.
 */
export const summariseBoard = (stations: CampStation[]): BoardSummary => {
  let waiting = 0;
  let inProgress = 0;
  let seen = 0;
  let bottleneck: CampStation | null = null;

  for (const station of stations) {
    waiting += station.queued;
    inProgress += station.inProgress;
    seen += station.completed;

    if (stationPressure(station) === 'clear') continue;
    const wait = station.longestWaitSeconds ?? 0;
    if (!bottleneck || wait > (bottleneck.longestWaitSeconds ?? 0)) bottleneck = station;
  }

  return { waiting, inProgress, seen, bottleneck };
};

/**
 * Camps in the order a phone should show them: what is happening now, then
 * what is about to, then the archive. Within a group, soonest first — except
 * the archive, which reads most-recent first.
 */
const STATUS_RANK: Record<string, number> = {
  in_progress: 0,
  published: 1,
  draft: 2,
  closed: 3,
  archived: 4,
};

export const sortCamps = (camps: Camp[]): Camp[] =>
  [...camps].sort((a, b) => {
    const rank = (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9);
    if (rank !== 0) return rank;
    const at = new Date(a.startsAt).getTime();
    const bt = new Date(b.startsAt).getTime();
    // NaN from a malformed date must not decide the order; treat it as last.
    const an = Number.isNaN(at) ? Infinity : at;
    const bn = Number.isNaN(bt) ? Infinity : bt;
    return campIsOver(a) ? bn - an : an - bn;
  });
