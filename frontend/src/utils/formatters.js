// Utility Functions for Date and Currency Formatting

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
    const date = new Date(dateString);
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
      const date = new Date(timeString);
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
    const date = new Date(dateTimeString);
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
