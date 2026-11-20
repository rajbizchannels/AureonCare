// Utility Functions for Date and Currency Formatting

/**
 * Parse a value the API returned for a date or a date-and-time.
 *
 * WHY THIS EXISTS. An appointment at 6 PM is 6 PM at the clinic, and a date of birth is a
 * date — neither carries a timezone, so neither may be shifted by one. The API now sends
 * them as the characters Postgres holds ("2026-11-17 18:00:00", "1980-04-02") rather than
 * as a UTC instant, which is what used to make a 6 PM booking list as 7 PM.
 *
 * `new Date()` cannot be trusted with either shape:
 *
 *   new Date('1980-04-02')            -> UTC midnight, by specification. A browser behind
 *                                        UTC renders that as 1 April. On a date of birth
 *                                        that is a wrong record, not a cosmetic slip.
 *   new Date('2026-11-17 18:00:00')   -> local time, but only because every current engine
 *                                        happens to agree; the standard does not say so.
 *
 * So the components are read out and handed to the Date constructor one by one, which is
 * defined to build a LOCAL date. The wall-clock reading is then the same everywhere, which
 * is the whole point of these values.
 *
 * Anything that is already a Date, or that carries a zone (a trailing Z or +01:00), is an
 * instant and is left alone — those SHOULD be converted to the reader's local time.
 */
const WALL_CLOCK = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?)?$/;

export const parseApiDate = (value) => {
  if (value == null || value === '') return null;
  if (value instanceof Date) return value;
  if (typeof value !== 'string') return new Date(value);

  const m = WALL_CLOCK.exec(value.trim());
  if (m) {
    const [, y, mo, d, h, mi, sec] = m;
    return new Date(+y, +mo - 1, +d, +(h || 0), +(mi || 0), +(sec || 0));
  }
  // Has a zone, or some other format: a real instant, so let the engine localise it.
  return new Date(value);
};

export const formatCurrency = (amount, currency = 'USD') => {
  const num = (typeof amount === 'string' ? parseFloat(amount) : amount) || 0;
  if (isNaN(num)) return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(0);
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(num);
  } catch {
    return `${num.toFixed(2)}`;
  }
};

export const getCurrencySymbol = (currency = 'USD') => {
  try {
    return (0).toLocaleString('en-US', { style: 'currency', currency: currency || 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).replace(/[\d\s,.]/g, '').trim() || '$';
  } catch {
    return '$';
  }
};

export const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    const date = parseApiDate(dateString);
    if (!date) return 'N/A';
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (error) {
    console.error('Date formatting error:', error);
    return 'Invalid Date';
  }
};

export const formatTime = (timeString) => {
  if (!timeString) return 'N/A';
  try {
    // If it's a Date object
    if (timeString instanceof Date) {
      if (isNaN(timeString.getTime())) return 'Invalid Time';
      return timeString.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    // If it's a full timestamp string, extract time
    if (timeString.includes('T') || timeString.includes(' ')) {
      const date = parseApiDate(timeString);
      if (isNaN(date.getTime())) return 'Invalid Time';
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    // If it's already in HH:MM format
    return timeString.substring(0, 5);
  } catch (error) {
    console.error('Time formatting error:', error);
    return 'Invalid Time';
  }
};

export const formatDateTime = (dateTimeString) => {
  if (!dateTimeString) return 'N/A';
  try {
    const date = parseApiDate(dateTimeString);
    if (!date) return 'N/A';
    if (isNaN(date.getTime())) return 'Invalid DateTime';
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    return 'Invalid DateTime';
  }
};

/**
 * Format a Date object as a local "YYYY-MM-DD HH:MM:SS" string.
 * Use this instead of toISOString() when storing appointment times,
 * since toISOString() converts to UTC which shifts the time.
 */
export const toLocalDateTimeString = (date) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

/**
 * Format a Date object as a local "YYYY-MM-DD" string.
 * Use this instead of toISOString().split('T')[0] to avoid
 * UTC date shift near midnight.
 */
export const toLocalDateString = (date) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
