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
 * Country code → [minTotalDigits, maxTotalDigits] (digits include the country code itself).
 * Digits are counted after stripping all non-digit characters.
 * Source: ITU-T E.164 national numbering plans.
 */
const CC_LENGTHS = {
  // 1-digit prefixes
  '1':   [11, 11], // US, Canada, Caribbean
  '7':   [11, 11], // Russia, Kazakhstan
  // 2-digit prefixes
  '20':  [12, 12], // Egypt
  '27':  [11, 11], // South Africa
  '30':  [12, 12], // Greece
  '31':  [11, 11], // Netherlands
  '32':  [11, 11], // Belgium
  '33':  [11, 11], // France
  '34':  [11, 11], // Spain
  '36':  [11, 11], // Hungary
  '39':  [11, 13], // Italy
  '40':  [11, 12], // Romania
  '41':  [11, 11], // Switzerland
  '43':  [10, 13], // Austria
  '44':  [12, 12], // UK
  '45':  [10, 10], // Denmark
  '46':  [11, 11], // Sweden
  '47':  [10, 10], // Norway
  '48':  [11, 11], // Poland
  '49':  [11, 12], // Germany
  '51':  [11, 11], // Peru
  '52':  [12, 12], // Mexico
  '53':  [10, 11], // Cuba
  '54':  [12, 13], // Argentina
  '55':  [12, 13], // Brazil
  '56':  [11, 11], // Chile
  '57':  [12, 12], // Colombia
  '58':  [11, 11], // Venezuela
  '60':  [11, 12], // Malaysia
  '61':  [11, 11], // Australia
  '62':  [11, 13], // Indonesia
  '63':  [12, 12], // Philippines
  '64':  [10, 11], // New Zealand
  '65':  [10, 10], // Singapore
  '66':  [11, 11], // Thailand
  '81':  [11, 12], // Japan
  '82':  [11, 12], // South Korea
  '84':  [11, 11], // Vietnam
  '86':  [13, 13], // China
  '90':  [12, 12], // Turkey
  '91':  [12, 12], // India
  '92':  [12, 12], // Pakistan
  '93':  [12, 12], // Afghanistan
  '94':  [11, 11], // Sri Lanka
  '95':  [11, 12], // Myanmar
  '98':  [12, 12], // Iran
  // 3-digit prefixes
  '960': [11, 11], // Maldives
  '961': [11, 11], // Lebanon
  '962': [12, 12], // Jordan
  '963': [12, 12], // Syria
  '964': [13, 13], // Iraq
  '965': [11, 11], // Kuwait
  '966': [12, 12], // Saudi Arabia
  '967': [12, 12], // Yemen
  '968': [11, 11], // Oman
  '970': [12, 12], // Palestine
  '971': [12, 12], // UAE
  '972': [12, 12], // Israel
  '973': [11, 11], // Bahrain
  '974': [11, 11], // Qatar
  '975': [11, 11], // Bhutan
  '976': [11, 11], // Mongolia
  '977': [12, 12], // Nepal
};

/** Resolve country-code range from leading digits (tries 3-digit, 2-digit, 1-digit). */
const resolveCC = (digits) => {
  for (const len of [3, 2, 1]) {
    const cc = digits.slice(0, len);
    if (CC_LENGTHS[cc]) return { cc, range: CC_LENGTHS[cc] };
  }
  return null;
};

/**
 * Returns true if phone is non-empty and passes country-specific digit-count validation.
 * All special characters are stripped before counting — only digits matter.
 * If the number starts with '+', the country code is identified and used for validation.
 * Local numbers without '+' are accepted if they contain 7–12 digits.
 */
export const isPhoneValid = (phone) => {
  if (!phone || phone.trim() === '') return false;
  const hasPlus = phone.trimStart().startsWith('+');
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 0) return false;

  if (hasPlus) {
    const info = resolveCC(digits);
    if (info) return digits.length >= info.range[0] && digits.length <= info.range[1];
    // Unrecognised country code — fall back to E.164 bounds (7–15 total digits)
    return digits.length >= 7 && digits.length <= 15;
  }

  // Local number (no country code): accept 7–12 digits
  return digits.length >= 7 && digits.length <= 12;
};

/**
 * Returns an error string if phone is non-empty but invalid; null means OK.
 * Empty is treated as valid (optional field).
 * Special characters are stripped — only digits are counted and validated.
 */
export const validateOptionalPhone = (phone) => {
  if (!phone || phone.trim() === '') return null;
  const hasPlus = phone.trimStart().startsWith('+');
  const digits = phone.replace(/\D/g, '');

  if (digits.length === 0) return 'Enter a valid phone number';

  if (hasPlus) {
    const info = resolveCC(digits);
    if (info) {
      const [min, max] = info.range;
      if (digits.length < min || digits.length > max) {
        const expected = min === max ? `${min}` : `${min}–${max}`;
        return `Invalid number for this country (expected ${expected} digits incl. country code)`;
      }
      return null;
    }
    if (digits.length < 7 || digits.length > 15) return 'Enter a valid international phone number';
    return null;
  }

  if (digits.length < 7 || digits.length > 12) return 'Enter a valid phone number (7–12 digits without country code)';
  return null;
};

/**
 * Returns true if email is non-empty and matches basic email format.
 */
export const isEmailValid = (email) => {
  if (!email || email.trim() === '') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
};

/**
 * Returns an error string if email is non-empty but invalid; null means OK.
 * Empty is treated as valid (optional field).
 */
export const validateOptionalEmail = (email) => {
  if (!email || email.trim() === '') return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Enter a valid email address';
  return null;
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
