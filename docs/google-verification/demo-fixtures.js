/**
 * Synthetic API fixtures for the Google Meet OAuth verification demo recording.
 *
 * Every record here is invented for the demo. No real patient, clinician or
 * clinic data is used, and no real Google credentials are present — the OAuth
 * client id below is a placeholder that is only ever displayed, never sent to
 * Google. See README.md in this directory for how the recording uses them.
 */

const MEET_LINKS = [
  'https://meet.google.com/xkq-dmvt-pra',
  'https://meet.google.com/rzn-hbfa-uwc',
  'https://meet.google.com/tva-qesn-jdh',
];

/** Demo OAuth client id shown on screen. Not a live Google credential. */
const DEMO_CLIENT_ID = '984120775513-demo0aureoncare0meet.apps.googleusercontent.com';

const iso = (dayOffset, hour, minute = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};

const demoUser = {
  id: 1,
  first_name: 'Alex',
  last_name: 'Rivera',
  email: 'alex.rivera@demo-clinic.example',
  role: 'admin',
  title: 'Practice Administrator',
  practice: 'Northside Family Health (Demo)',
  language: 'English',
  avatar: 'AR',
  preferences: {
    emailNotifications: true,
    smsAlerts: false,
    darkMode: true,
    planTier: 'enterprise',
  },
};

const patients = [
  { id: 101, first_name: 'Jordan', last_name: 'Ellis', email: 'jordan.ellis@example.com', phone: '555-0141', date_of_birth: '1986-04-12', gender: 'Non-binary', status: 'active' },
  { id: 102, first_name: 'Priya', last_name: 'Nandakumar', email: 'priya.n@example.com', phone: '555-0172', date_of_birth: '1979-11-03', gender: 'Female', status: 'active' },
  { id: 103, first_name: 'Marcus', last_name: 'Boone', email: 'marcus.boone@example.com', phone: '555-0188', date_of_birth: '1994-02-25', gender: 'Male', status: 'active' },
];

const users = [
  demoUser,
  { id: 2, first_name: 'Dana', last_name: 'Okafor', email: 'dana.okafor@demo-clinic.example', role: 'doctor', title: 'Family Medicine' },
  { id: 3, first_name: 'Sam', last_name: 'Whitfield', email: 'sam.whitfield@demo-clinic.example', role: 'nurse', title: 'RN' },
];

const appointments = [
  { id: 9001, patient_id: 101, provider_id: 2, start_time: iso(0, 15, 30), duration_minutes: 30, appointment_type: 'Follow-up', status: 'scheduled', location: 'Telehealth' },
  { id: 9002, patient_id: 102, provider_id: 2, start_time: iso(1, 10, 0), duration_minutes: 45, appointment_type: 'Annual review', status: 'scheduled', location: 'Telehealth' },
  { id: 9003, patient_id: 103, provider_id: 3, start_time: iso(2, 9, 15), duration_minutes: 20, appointment_type: 'Medication check', status: 'scheduled', location: 'Telehealth' },
];

/**
 * Telehealth provider rows as returned by GET /api/telehealth-settings.
 * Google Meet starts disconnected so the recording can show the whole
 * consent → connected → session-created journey.
 */
const telehealthSettings = () => ([
  {
    id: 1,
    provider_type: 'google_meet',
    is_enabled: false,
    is_configured: true,
    has_tokens: false,
    is_expired: false,
    client_id: DEMO_CLIENT_ID,
    client_secret: '••••••••••••••••',
    zoom_user_email: null,
    token_expires_at: null,
  },
  { id: 2, provider_type: 'zoom', is_enabled: false, is_configured: false, has_tokens: false, client_id: '', client_secret: '' },
  { id: 3, provider_type: 'webex', is_enabled: false, is_configured: false, has_tokens: false, client_id: '', client_secret: '' },
  { id: 4, provider_type: 'microsoft_teams', is_enabled: false, is_configured: false, has_tokens: false, client_id: '', client_secret: '' },
]);

const telehealthSessions = () => ([
  {
    id: 7001,
    appointment_id: 8900,
    patient_id: 103,
    provider_id: 2,
    provider_type: 'google_meet',
    session_status: 'completed',
    start_time: iso(-3, 11, 0),
    end_time: iso(-3, 11, 25),
    duration_minutes: 25,
    meeting_url: MEET_LINKS[2],
    join_url: MEET_LINKS[2],
  },
]);

const vendorIntegrationSettings = [
  { vendor_type: 'surescripts', is_enabled: false, sandbox_mode: true, client_id: '', client_secret: '' },
  { vendor_type: 'labcorp', is_enabled: false, sandbox_mode: true, api_key: '', api_secret: '' },
  { vendor_type: 'optum', is_enabled: false, sandbox_mode: true, username: '', password: '' },
];

const clinicSettings = {
  clinic_name: 'Northside Family Health (Demo)',
  address: '400 Harbor Way, Suite 210',
  city: 'Portland',
  state: 'OR',
  zip: '97201',
  phone: '555-0100',
  email: 'front-desk@demo-clinic.example',
  timezone: 'America/Los_Angeles',
  currency: 'USD',
};

const stripeSettings = { publishable_key: '', sandbox_mode: true, use_platform_integration: false };

const notifications = [
  { id: 1, user_id: 1, type: 'info', message: 'Welcome back, Alex.', is_read: false, created_at: iso(0, 8) },
];

const tasks = [
  { id: 1, title: 'Confirm telehealth consent forms', status: 'pending', priority: 'medium', due_date: iso(1, 17) },
];

module.exports = {
  DEMO_CLIENT_ID,
  MEET_LINKS,
  iso,
  demoUser,
  patients,
  users,
  appointments,
  telehealthSettings,
  telehealthSessions,
  vendorIntegrationSettings,
  clinicSettings,
  stripeSettings,
  notifications,
  tasks,
};
