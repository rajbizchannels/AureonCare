/**
 * Input Validation Utilities
 * Provides validation functions for user inputs to prevent XSS, injection attacks,
 * and ensure data integrity
 */

import { VALIDATION_PATTERNS, INPUT_CONSTRAINTS, ERROR_MESSAGES } from '../constants/adminConstants';

/**
 * Sanitizes string input by removing potentially harmful characters
 * @param {string} input - The input string to sanitize
 * @returns {string} - Sanitized string
 */
export const sanitizeString = (input) => {
  if (typeof input !== 'string') return '';

  // Remove HTML tags and escape special characters
  return input
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[<>]/g, '') // Remove remaining angle brackets
    .trim();
};

/**
 * Validates email format
 * @param {string} email - Email address to validate
 * @returns {{isValid: boolean, error: string|null}}
 */
export const validateEmail = (email) => {
  if (!email || email.trim() === '') {
    return { isValid: false, error: ERROR_MESSAGES.REQUIRED_FIELD };
  }

  if (email.length > INPUT_CONSTRAINTS.EMAIL.maxLength) {
    return {
      isValid: false,
      error: ERROR_MESSAGES.MAX_LENGTH('Email', INPUT_CONSTRAINTS.EMAIL.maxLength)
    };
  }

  if (!VALIDATION_PATTERNS.EMAIL.test(email)) {
    return { isValid: false, error: ERROR_MESSAGES.INVALID_EMAIL };
  }

  return { isValid: true, error: null };
};

/**
 * Validates phone number format
 * @param {string} phone - Phone number to validate
 * @returns {{isValid: boolean, error: string|null}}
 */
export const validatePhone = (phone) => {
  if (!phone || phone.trim() === '') {
    return { isValid: false, error: ERROR_MESSAGES.REQUIRED_FIELD };
  }

  if (!VALIDATION_PATTERNS.PHONE.test(phone)) {
    return { isValid: false, error: ERROR_MESSAGES.INVALID_PHONE };
  }

  return { isValid: true, error: null };
};

/**
 * Validates URL format
 * @param {string} url - URL to validate
 * @returns {{isValid: boolean, error: string|null}}
 */
export const validateURL = (url) => {
  if (!url || url.trim() === '') {
    return { isValid: true, error: null }; // URL is optional
  }

  if (!VALIDATION_PATTERNS.URL.test(url)) {
    return { isValid: false, error: ERROR_MESSAGES.INVALID_URL };
  }

  return { isValid: true, error: null };
};

/**
 * Validates Tax ID format (XX-XXXXXXX)
 * @param {string} taxId - Tax ID to validate
 * @returns {{isValid: boolean, error: string|null}}
 */
export const validateTaxId = (taxId) => {
  if (!taxId || taxId.trim() === '') {
    return { isValid: true, error: null }; // Tax ID is optional
  }

  if (!VALIDATION_PATTERNS.TAX_ID.test(taxId)) {
    return { isValid: false, error: ERROR_MESSAGES.INVALID_TAX_ID };
  }

  return { isValid: true, error: null };
};

/**
 * Validates NPI number (10 digits)
 * @param {string} npi - NPI number to validate
 * @returns {{isValid: boolean, error: string|null}}
 */
export const validateNPI = (npi) => {
  if (!npi || npi.trim() === '') {
    return { isValid: true, error: null }; // NPI is optional
  }

  if (!VALIDATION_PATTERNS.NPI.test(npi)) {
    return { isValid: false, error: ERROR_MESSAGES.INVALID_NPI };
  }

  return { isValid: true, error: null };
};

/**
 * Validates clinic name
 * @param {string} name - Clinic name to validate
 * @returns {{isValid: boolean, error: string|null}}
 */
export const validateClinicName = (name) => {
  if (!name || name.trim() === '') {
    return { isValid: false, error: ERROR_MESSAGES.REQUIRED_FIELD };
  }

  const sanitized = sanitizeString(name);

  if (sanitized.length < INPUT_CONSTRAINTS.CLINIC_NAME.minLength) {
    return {
      isValid: false,
      error: ERROR_MESSAGES.MIN_LENGTH('Clinic name', INPUT_CONSTRAINTS.CLINIC_NAME.minLength)
    };
  }

  if (sanitized.length > INPUT_CONSTRAINTS.CLINIC_NAME.maxLength) {
    return {
      isValid: false,
      error: ERROR_MESSAGES.MAX_LENGTH('Clinic name', INPUT_CONSTRAINTS.CLINIC_NAME.maxLength)
    };
  }

  return { isValid: true, error: null };
};

/**
 * Validates numeric input within a range
 * @param {string|number} value - Value to validate
 * @param {number} min - Minimum allowed value
 * @param {number} max - Maximum allowed value
 * @param {string} fieldName - Name of the field for error messages
 * @returns {{isValid: boolean, error: string|null, value: number|null}}
 */
export const validateNumericRange = (value, min, max, fieldName = 'Value') => {
  const numValue = typeof value === 'string' ? parseInt(value, 10) : value;

  if (isNaN(numValue)) {
    return { isValid: false, error: ERROR_MESSAGES.INVALID_NUMBER, value: null };
  }

  if (numValue < min) {
    return {
      isValid: false,
      error: ERROR_MESSAGES.MIN_VALUE(fieldName, min),
      value: null
    };
  }

  if (numValue > max) {
    return {
      isValid: false,
      error: ERROR_MESSAGES.MAX_VALUE(fieldName, max),
      value: null
    };
  }

  return { isValid: true, error: null, value: numValue };
};

/**
 * Validates appointment duration
 * @param {string|number} duration - Duration in minutes
 * @returns {{isValid: boolean, error: string|null, value: number|null}}
 */
export const validateAppointmentDuration = (duration) => {
  return validateNumericRange(
    duration,
    INPUT_CONSTRAINTS.APPOINTMENT_DURATION.min,
    INPUT_CONSTRAINTS.APPOINTMENT_DURATION.max,
    'Appointment duration'
  );
};

/**
 * Validates slot interval
 * @param {string|number} interval - Interval in minutes
 * @returns {{isValid: boolean, error: string|null, value: number|null}}
 */
export const validateSlotInterval = (interval) => {
  return validateNumericRange(
    interval,
    INPUT_CONSTRAINTS.SLOT_INTERVAL.min,
    INPUT_CONSTRAINTS.SLOT_INTERVAL.max,
    'Slot interval'
  );
};

/**
 * Validates max advance booking days
 * @param {string|number} days - Number of days
 * @returns {{isValid: boolean, error: string|null, value: number|null}}
 */
export const validateMaxAdvanceBooking = (days) => {
  return validateNumericRange(
    days,
    INPUT_CONSTRAINTS.MAX_ADVANCE_BOOKING.min,
    INPUT_CONSTRAINTS.MAX_ADVANCE_BOOKING.max,
    'Max advance booking'
  );
};

/**
 * Validates cancellation deadline hours
 * @param {string|number} hours - Number of hours
 * @returns {{isValid: boolean, error: string|null, value: number|null}}
 */
export const validateCancellationDeadline = (hours) => {
  return validateNumericRange(
    hours,
    INPUT_CONSTRAINTS.CANCELLATION_DEADLINE.min,
    INPUT_CONSTRAINTS.CANCELLATION_DEADLINE.max,
    'Cancellation deadline'
  );
};

/**
 * Validates all clinic settings
 * @param {Object} settings - Clinic settings object
 * @returns {{isValid: boolean, errors: Object}}
 */
export const validateClinicSettings = (settings) => {
  const errors = {};

  const nameValidation = validateClinicName(settings.name);
  if (!nameValidation.isValid) {
    errors.name = nameValidation.error;
  }

  const emailValidation = validateEmail(settings.email);
  if (!emailValidation.isValid) {
    errors.email = emailValidation.error;
  }

  const phoneValidation = validatePhone(settings.phone);
  if (!phoneValidation.isValid) {
    errors.phone = phoneValidation.error;
  }

  const urlValidation = validateURL(settings.website);
  if (!urlValidation.isValid) {
    errors.website = urlValidation.error;
  }

  const taxIdValidation = validateTaxId(settings.taxId);
  if (!taxIdValidation.isValid) {
    errors.taxId = taxIdValidation.error;
  }

  const npiValidation = validateNPI(settings.npi);
  if (!npiValidation.isValid) {
    errors.npi = npiValidation.error;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

/**
 * Safely parses JSON with error handling
 * @param {string} jsonString - JSON string to parse
 * @param {*} defaultValue - Default value to return on parse error
 * @returns {*} - Parsed object or default value
 */
export const safeJSONParse = (jsonString, defaultValue = null) => {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('JSON parse error:', error);
    return defaultValue;
  }
};

/**
 * Safely saves to localStorage with quota checking
 * @param {string} key - Storage key
 * @param {*} data - Data to store
 * @returns {{success: boolean, error: string|null}}
 */
export const safeLocalStorageSave = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return { success: true, error: null };
  } catch (error) {
    if (error.name === 'QuotaExceededError') {
      return {
        success: false,
        error: 'Storage quota exceeded. Please clear some data.'
      };
    } else if (error.name === 'SecurityError') {
      return {
        success: false,
        error: 'Storage access denied. Please check browser settings.'
      };
    } else {
      return {
        success: false,
        error: 'Failed to save data locally.'
      };
    }
  }
};

/**
 * Safely loads from localStorage with error handling
 * @param {string} key - Storage key
 * @param {*} defaultValue - Default value if key doesn't exist or parse fails
 * @returns {*} - Stored data or default value
 */
export const safeLocalStorageLoad = (key, defaultValue = null) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error('localStorage load error:', error);
    return defaultValue;
  }
};
