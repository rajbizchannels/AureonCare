/**
 * Appointment times are stored as WALL-CLOCK times (`timestamp without time zone`): the time the
 * patient and practice agreed, e.g. "2026-11-23 10:00:00". The web app sends that form.
 *
 * Mobile app builds before this fix sent an instant ("2026-11-23T09:00:00.000Z" for 10:00 in
 * UTC+1). Postgres drops the offset when casting to `timestamp`, so the booking was saved — and
 * shown — an hour early. toWallClock turns such an instant back into the wall-clock time in the
 * zone it was meant for, so installed apps book correctly before they are updated.
 */

const OFFSET = /(?:Z|[+-]\d{2}(?::?\d{2})?)$/i;

const validZone = (tz) => {
  if (!tz || typeof tz !== 'string') return false;
  try { new Intl.DateTimeFormat('en-GB', { timeZone: tz }); return true; } catch { return false; }
};

/**
 * @param {string} value   a time from a client
 * @param {string|null} tz IANA zone the booking is meant in (patient's, else practice's)
 * @returns {string} "YYYY-MM-DD HH:MM:SS" when `value` carries an offset and `tz` is known;
 *                   otherwise `value` unchanged (already wall-clock, or no zone to convert to)
 */
function toWallClock(value, tz) {
  if (typeof value !== 'string' || !OFFSET.test(value.trim()) || !validZone(tz)) return value;
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return value;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(at).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

module.exports = { toWallClock, validZone };
