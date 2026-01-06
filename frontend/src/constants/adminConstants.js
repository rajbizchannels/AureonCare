/**
 * Admin Panel Constants
 * Centralized constants for admin panel configuration
 */

// User Roles
export const USER_ROLES = {
  ADMIN: 'admin',
  DOCTOR: 'doctor',
  STAFF: 'staff',
  PATIENT: 'patient',
};

// User Status
export const USER_STATUS = {
  ACTIVE: 'active',
  BLOCKED: 'blocked',
  PENDING: 'pending',
};

// Subscription Plan IDs
export const PLAN_IDS = {
  FREE: 'free',
  STARTER: 'starter',
  PROFESSIONAL: 'professional',
  ENTERPRISE: 'enterprise',
};

// Default Appointment Settings
export const DEFAULT_APPOINTMENT_SETTINGS = {
  DURATION: 30, // minutes
  SLOT_INTERVAL: 15, // minutes
  MAX_ADVANCE_BOOKING: 90, // days
  CANCELLATION_DEADLINE: 24, // hours
};

// Default Working Hours
export const DEFAULT_WORKING_HOURS = {
  monday: { open: '08:00', close: '17:00', enabled: true },
  tuesday: { open: '08:00', close: '17:00', enabled: true },
  wednesday: { open: '08:00', close: '17:00', enabled: true },
  thursday: { open: '08:00', close: '17:00', enabled: true },
  friday: { open: '08:00', close: '17:00', enabled: true },
  saturday: { open: '09:00', close: '13:00', enabled: false },
  sunday: { open: '09:00', close: '13:00', enabled: false },
};

// Default Role Permissions
export const DEFAULT_ROLE_PERMISSIONS = {
  admin: {
    patients: { view: true, create: true, edit: true, delete: true },
    appointments: { view: true, create: true, edit: true, delete: true },
    claims: { view: true, create: true, edit: true, delete: true },
    ehr: { view: true, create: true, edit: true, delete: true },
    users: { view: true, create: true, edit: true, delete: true },
    reports: { view: true, create: true, edit: true, delete: true },
    settings: { view: true, create: true, edit: true, delete: true },
    backup: { view: true, create: true, edit: true, delete: true },
    audit: { view: true, create: false, edit: false, delete: true },
  },
  doctor: {
    patients: { view: true, create: true, edit: true, delete: false },
    appointments: { view: true, create: true, edit: true, delete: false },
    claims: { view: true, create: true, edit: true, delete: false },
    ehr: { view: true, create: true, edit: true, delete: false },
    users: { view: true, create: false, edit: false, delete: false },
    reports: { view: true, create: false, edit: false, delete: false },
    settings: { view: false, create: false, edit: false, delete: false },
    backup: { view: false, create: false, edit: false, delete: false },
    audit: { view: false, create: false, edit: false, delete: false },
  },
  staff: {
    patients: { view: true, create: true, edit: true, delete: false },
    appointments: { view: true, create: true, edit: true, delete: false },
    claims: { view: true, create: false, edit: false, delete: false },
    ehr: { view: true, create: false, edit: false, delete: false },
    users: { view: false, create: false, edit: false, delete: false },
    reports: { view: true, create: false, edit: false, delete: false },
    settings: { view: false, create: false, edit: false, delete: false },
    backup: { view: false, create: false, edit: false, delete: false },
    audit: { view: false, create: false, edit: false, delete: false },
  },
  patient: {
    patients: { view: true, create: false, edit: false, delete: false },
    appointments: { view: true, create: true, edit: false, delete: false },
    claims: { view: true, create: false, edit: false, delete: false },
    ehr: { view: true, create: false, edit: false, delete: false },
    users: { view: false, create: false, edit: false, delete: false },
    reports: { view: false, create: false, edit: false, delete: false },
    settings: { view: false, create: false, edit: false, delete: false },
    backup: { view: false, create: false, edit: false, delete: false },
    audit: { view: false, create: false, edit: false, delete: false },
  },
};

// Subscription Plans Configuration
export const SUBSCRIPTION_PLANS = [
  {
    id: PLAN_IDS.FREE,
    name: 'Free Plan',
    price: 0,
    billing: 'monthly',
    maxUsers: 3,
    maxPatients: 50,
    features: {
      ehr: true,
      appointments: true,
      billing: false,
      crm: false,
      telehealth: false,
      integrations: false,
    },
  },
  {
    id: PLAN_IDS.STARTER,
    name: 'Starter Plan',
    price: 99,
    billing: 'monthly',
    maxUsers: 10,
    maxPatients: 200,
    features: {
      ehr: true,
      appointments: true,
      billing: true,
      crm: false,
      telehealth: true,
      integrations: false,
    },
    popular: false,
  },
  {
    id: PLAN_IDS.PROFESSIONAL,
    name: 'Professional Plan',
    price: 299,
    billing: 'monthly',
    maxUsers: 25,
    maxPatients: 1000,
    features: {
      ehr: true,
      appointments: true,
      billing: true,
      crm: true,
      telehealth: true,
      integrations: true,
    },
    popular: true,
  },
  {
    id: PLAN_IDS.ENTERPRISE,
    name: 'Enterprise Plan',
    price: 999,
    billing: 'monthly',
    maxUsers: -1, // Unlimited
    maxPatients: -1, // Unlimited
    features: {
      ehr: true,
      appointments: true,
      billing: true,
      crm: true,
      telehealth: true,
      integrations: true,
      customBranding: true,
      apiAccess: true,
    },
  },
];

// Admin Panel Tabs Configuration
export const ADMIN_TABS = {
  CLINIC: 'clinic',
  USERS: 'users',
  ROLES: 'roles',
  PLANS: 'plans',
  TELEHEALTH: 'telehealth',
  HOURS: 'hours',
  APPOINTMENTS: 'appointments',
  BACKUP: 'backup',
  AUDIT: 'audit',
};

// Storage Keys
export const STORAGE_KEYS = {
  CLINIC_SETTINGS: 'clinicSettings',
};

// Telehealth Providers
export const TELEHEALTH_PROVIDERS = {
  ZOOM: 'zoom',
  GOOGLE_MEET: 'google_meet',
  WEBEX: 'webex',
};

// Vendor Integration Types
export const VENDOR_TYPES = {
  SURESCRIPTS: 'surescripts',
  LABCORP: 'labcorp',
  OPTUM: 'optum',
};

// Validation Patterns
export const VALIDATION_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^\+?1?\s*\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})$/,
  URL: /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/,
  TAX_ID: /^\d{2}-\d{7}$/,
  NPI: /^\d{10}$/,
};

// Input Constraints
export const INPUT_CONSTRAINTS = {
  CLINIC_NAME: { minLength: 2, maxLength: 100 },
  EMAIL: { maxLength: 255 },
  PHONE: { maxLength: 20 },
  ADDRESS: { maxLength: 500 },
  WEBSITE: { maxLength: 255 },
  APPOINTMENT_DURATION: { min: 5, max: 480 }, // 5 min to 8 hours
  SLOT_INTERVAL: { min: 5, max: 120 }, // 5 min to 2 hours
  MAX_ADVANCE_BOOKING: { min: 1, max: 365 }, // 1 day to 1 year
  CANCELLATION_DEADLINE: { min: 0, max: 168 }, // 0 to 7 days
};

// Error Messages
export const ERROR_MESSAGES = {
  REQUIRED_FIELD: 'This field is required',
  INVALID_EMAIL: 'Please enter a valid email address',
  INVALID_PHONE: 'Please enter a valid phone number',
  INVALID_URL: 'Please enter a valid URL',
  INVALID_TAX_ID: 'Tax ID must be in format XX-XXXXXXX',
  INVALID_NPI: 'NPI must be a 10-digit number',
  MIN_LENGTH: (field, min) => `${field} must be at least ${min} characters`,
  MAX_LENGTH: (field, max) => `${field} must not exceed ${max} characters`,
  MIN_VALUE: (field, min) => `${field} must be at least ${min}`,
  MAX_VALUE: (field, max) => `${field} must not exceed ${max}`,
  INVALID_NUMBER: 'Please enter a valid number',
};
