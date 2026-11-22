/**
 * Appointment times are WALL-CLOCK times.
 *
 * `appointments.start_time` is `timestamp without time zone`: the server stores and returns the
 * time the practice and patient agreed ("2026-11-23 10:00:00"), with no offset. The web app
 * sends exactly that. Sending an instant instead (`toISOString()`, "…T09:00:00.000Z") made
 * Postgres drop the `Z` and store the UTC clock reading, so a 10:00 booking in UTC+1 was saved
 * and shown as 09:00.
 *
 * Kept free of React Native so it is tested with node (tests/time.test.mjs).
 */

const WALL = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?$/;

/**
 * A server timestamp as a Date. A value without an offset is read as local wall-clock time
 * (parsed by hand: not every JS engine accepts "YYYY-MM-DD HH:MM:SS"); a value with `Z` or an
 * offset is a real instant. Returns null when it cannot be read.
 */
export const toDate = (value: string | number | Date | null | undefined): Date | null => {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') return Number.isFinite(value) ? new Date(value) : null;
  const m = WALL.exec(value.trim());
  if (m) {
    const [, y, mo, d, h = '0', mi = '0', s = '0'] = m;
    const date = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** Milliseconds for sorting and comparing; NaN when unreadable. */
export const timeOf = (value: string | null | undefined): number => toDate(value)?.getTime() ?? NaN;

const pad = (n: number) => String(n).padStart(2, '0');

/** "2026-11-23 10:00:00" — the local wall-clock form the server stores for appointments. */
export const wallClock = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

/** "2026-11-23" — the local calendar day (not UTC's). */
export const localDay = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
