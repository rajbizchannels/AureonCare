// Utility Functions for Date and Currency Formatting

export const formatCurrency = (amount) => {
  if (!amount && amount !== 0) return '$0.00';
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(numAmount)) return '$0.00';
  return `$${numAmount.toFixed(2)}`;
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
