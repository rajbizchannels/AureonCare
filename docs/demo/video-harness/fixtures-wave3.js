/**
 * Wave 3 fixtures: waitlist, intake, forms, reports, catalogue and public booking.
 *
 * Wave 3 covers screens the earlier waves never opened, and every one of them
 * renders an empty state against the Wave 1/2 dataset. These are the rows that
 * make those screens worth filming — same invented clinic, same personas.
 */

const F = require('./fixtures');

const { at, day, patients, providers, appointmentTypes } = F;

/**
 * The waitlist view reads camelCase and splits the names into parts, so the
 * fixtures are written the way that screen consumes them rather than the way
 * the database stores them.
 */
const waitlist = [
  {
    id: 5101, patientFirstName: 'Jordan', patientLastName: 'Ellis',
    patientEmail: 'jordan.ellis@example.com', patientPhone: '555-0141',
    providerId: 2, providerFirstName: 'Michael', providerLastName: 'Anderson',
    providerSpecialization: 'Family Medicine',
    appointmentType: 'Follow-up', preferredDate: day(3),
    preferredTimeStart: '09:00', preferredTimeEnd: '12:00',
    priority: 'high', status: 'active',
    reason: 'Happy to come in at short notice.', createdAt: at(-6, 9),
  },
  {
    id: 5102, patientFirstName: 'Marcus', patientLastName: 'Boone',
    patientEmail: 'marcus.boone@example.com', patientPhone: '555-0188',
    providerId: 2, providerFirstName: 'Michael', providerLastName: 'Anderson',
    providerSpecialization: 'Family Medicine',
    appointmentType: 'Medication check', preferredDate: day(4),
    preferredTimeStart: '13:00', preferredTimeEnd: '17:00',
    priority: 'medium', status: 'active',
    reason: 'Cannot do Mondays.', createdAt: at(-4, 14),
  },
  {
    id: 5103, patientFirstName: 'Aiko', patientLastName: 'Tanaka',
    patientEmail: 'aiko.tanaka@example.com', patientPhone: '555-0164',
    providerId: 3, providerFirstName: 'Dana', providerLastName: 'Okafor',
    providerSpecialization: 'Internal Medicine',
    appointmentType: 'Annual physical', preferredDate: day(2),
    preferredTimeStart: '08:00', preferredTimeEnd: '17:00',
    priority: 'low', status: 'notified',
    reason: 'Any time works.', createdAt: at(-9, 11),
  },
];

const intakeForms = [
  {
    id: 6101, patient_id: 105, patient_name: 'Aiko Tanaka', patientName: 'Aiko Tanaka',
    form_name: 'New patient intake', formName: 'New patient intake',
    form_type: 'onboarding', type: 'onboarding',
    status: 'completed', completed_at: at(-1, 16), created_at: at(-3, 9),
    sent_at: at(-3, 9), progress: 100,
  },
  {
    id: 6102, patient_id: 102, patient_name: 'Jordan Ellis', patientName: 'Jordan Ellis',
    form_name: 'Pre-visit health questionnaire', formName: 'Pre-visit health questionnaire',
    form_type: 'clinical', type: 'clinical',
    status: 'pending', created_at: at(-1, 10), sent_at: at(-1, 10), progress: 0,
  },
  {
    id: 6103, patient_id: 101, patient_name: 'Sarah Williams', patientName: 'Sarah Williams',
    form_name: 'Pre-visit health questionnaire', formName: 'Pre-visit health questionnaire',
    form_type: 'clinical', type: 'clinical',
    status: 'in_progress', created_at: at(-2, 12), sent_at: at(-2, 12), progress: 60,
  },
];

const intakeFlows = [
  {
    id: 6201, name: 'New patient onboarding', flow_name: 'New patient onboarding',
    description: 'Registration, history questionnaire and HIPAA authorisation, sent as one packet.',
    steps: 3, step_count: 3, status: 'active', is_active: true,
    forms: ['New patient intake', 'Pre-visit health questionnaire', 'HIPAA authorisation'],
    created_at: at(-60, 10), assigned_count: 24,
  },
  {
    id: 6202, name: 'Telehealth pre-visit', flow_name: 'Telehealth pre-visit',
    description: 'Consent to treat by video, plus the symptom questionnaire.',
    steps: 2, step_count: 2, status: 'active', is_active: true,
    forms: ['Telehealth consent', 'Pre-visit health questionnaire'],
    created_at: at(-40, 15), assigned_count: 11,
  },
];

const consentForms = [
  {
    id: 6301, patient_id: 103, patient_name: 'Priya Nandakumar', patientName: 'Priya Nandakumar',
    consent_type: 'Telehealth consent', form_name: 'Telehealth consent', formName: 'Telehealth consent',
    status: 'signed', signed_at: at(-2, 9, 50), signature_method: 'Typed signature',
    created_at: at(-2, 9, 30), expires_at: at(363, 9),
  },
  {
    id: 6302, patient_id: 105, patient_name: 'Aiko Tanaka', patientName: 'Aiko Tanaka',
    consent_type: 'HIPAA authorisation', form_name: 'HIPAA authorisation', formName: 'HIPAA authorisation',
    status: 'signed', signed_at: at(-1, 16, 12), signature_method: 'Typed signature',
    created_at: at(-3, 9), expires_at: at(362, 9),
  },
];

const formTemplates = [
  {
    id: 401, name: 'Telehealth consent', title: 'Telehealth consent',
    category_slug: 'consent', category: 'Consent', status: 'published',
    version: 3, field_count: 6, fields_count: 6, submissions_count: 42,
    updated_at: at(-30, 12), created_at: at(-200, 10), language: 'en',
  },
  {
    id: 402, name: 'Pre-visit health questionnaire', title: 'Pre-visit health questionnaire',
    category_slug: 'clinical', category: 'Clinical', status: 'published',
    version: 5, field_count: 18, fields_count: 18, submissions_count: 137,
    updated_at: at(-14, 9), created_at: at(-320, 11), language: 'en',
  },
  {
    id: 403, name: 'New patient intake', title: 'New patient intake',
    category_slug: 'onboarding', category: 'Onboarding', status: 'published',
    version: 2, field_count: 24, fields_count: 24, submissions_count: 88,
    updated_at: at(-45, 16), created_at: at(-400, 9), language: 'en',
  },
  {
    id: 404, name: 'Post-visit satisfaction', title: 'Post-visit satisfaction',
    category_slug: 'feedback', category: 'Feedback', status: 'draft',
    version: 1, field_count: 5, fields_count: 5, submissions_count: 0,
    updated_at: at(-2, 11), created_at: at(-2, 11), language: 'en',
  },
];

const formSubmissions = [
  {
    id: 7101, template_id: 402, template_name: 'Pre-visit health questionnaire',
    templateName: 'Pre-visit health questionnaire', template_version: '5',
    patient_id: 101, patient_name: 'Sarah Williams', patientName: 'Sarah Williams',
    status: 'submitted', submitted_at: at(-1, 18, 20), created_at: at(-2, 12),
    language: 'en', signature_count: 1,
  },
  {
    id: 7102, template_id: 401, template_name: 'Telehealth consent',
    templateName: 'Telehealth consent', template_version: '3',
    patient_id: 103, patient_name: 'Priya Nandakumar', patientName: 'Priya Nandakumar',
    status: 'signed', submitted_at: at(-2, 9, 50), created_at: at(-2, 9, 30),
    language: 'en', signature_count: 1,
  },
  {
    id: 7103, template_id: 403, template_name: 'New patient intake',
    templateName: 'New patient intake', template_version: '2',
    patient_id: 105, patient_name: 'Aiko Tanaka', patientName: 'Aiko Tanaka',
    status: 'submitted', submitted_at: at(-1, 16, 12), created_at: at(-3, 9),
    language: 'en', signature_count: 1,
  },
  {
    id: 7104, template_id: 402, template_name: 'Pre-visit health questionnaire',
    templateName: 'Pre-visit health questionnaire', template_version: '5',
    patient_id: 102, patient_name: 'Jordan Ellis', patientName: 'Jordan Ellis',
    status: 'draft', created_at: at(-1, 10), language: 'en', signature_count: 0,
  },
];

const formStats = {
  totalTemplates: formTemplates.length,
  publishedTemplates: 3,
  draftTemplates: 1,
  totalSubmissions: formSubmissions.length,
  submissionsThisMonth: 3,
  pendingSubmissions: 1,
  signedSubmissions: 2,
  total_templates: formTemplates.length,
  total_submissions: formSubmissions.length,
};

const formAuditLogs = [
  { id: 8101, action: 'template_published', template_name: 'Pre-visit health questionnaire', user_name: 'Alex Rivera', created_at: at(-14, 9), details: 'Version 5 published' },
  { id: 8102, action: 'submission_signed', template_name: 'Telehealth consent', user_name: 'Priya Nandakumar', created_at: at(-2, 9, 50), details: 'Signed by patient' },
  { id: 8103, action: 'template_created', template_name: 'Post-visit satisfaction', user_name: 'Alex Rivera', created_at: at(-2, 11), details: 'Draft created' },
];

const serviceCategories = [
  { id: 901, name: 'Chronic care', slug: 'chronic-care', description: 'Ongoing condition management', offering_count: 2, is_active: true },
  { id: 902, name: 'Preventive', slug: 'preventive', description: 'Screening and wellness', offering_count: 1, is_active: true },
];

const offerings = [
  {
    id: 301, name: 'Diabetes management programme', description: '12-week structured programme with a nurse educator',
    category_id: 901, category_name: 'Chronic care', duration_minutes: 45,
    is_active: true, available_online: true, base_price: 240,
    pricing_options: [{ id: 1, name: 'Standard', final_price: 240, base_price: 240 }],
  },
  {
    id: 302, name: 'Annual wellness visit', description: 'Comprehensive yearly review',
    category_id: 902, category_name: 'Preventive', duration_minutes: 45,
    is_active: true, available_online: true, base_price: 180,
    pricing_options: [{ id: 2, name: 'Standard', final_price: 180, base_price: 180 }],
  },
  {
    id: 303, name: 'Hypertension review', description: 'Blood pressure review and medication titration',
    category_id: 901, category_name: 'Chronic care', duration_minutes: 30,
    is_active: true, available_online: true, base_price: 120,
    pricing_options: [{ id: 3, name: 'Standard', final_price: 120, base_price: 120 }],
  },
];

const offeringPackages = [
  {
    id: 951, name: 'Chronic care starter', description: 'Diabetes programme plus two hypertension reviews',
    package_price: 420, total_value: 480, savings: 60, discount_percentage: 12.5,
    is_active: true, offering_count: 2, validity_days: 180,
    offerings: [{ id: 301, name: 'Diabetes management programme' }, { id: 303, name: 'Hypertension review' }],
  },
];

const offeringPromotions = [
  {
    id: 971, name: 'New year wellness', code: 'WELLNESS26',
    discount_type: 'percentage', discount_value: 15, discount_percentage: 15,
    valid_from: day(-10), valid_until: day(20), start_date: day(-10), end_date: day(20),
    is_active: true, status: 'active', usage_count: 18, usage_limit: 100,
    applies_to: 'Preventive',
  },
];

const offeringStatistics = {
  totalOfferings: offerings.length,
  activeOfferings: offerings.length,
  totalPackages: offeringPackages.length,
  activePromotions: 1,
  totalRevenue: 18450,
  averagePrice: 180,
  total_offerings: offerings.length,
  most_booked: 'Annual wellness visit',
};

/* ── reports ─────────────────────────────────────────────────────────────── */

const noShowReport = {
  summary: [
    { date: day(-4), total: 18, completed: 16, cancelled: 1, no_shows: 1 },
    { date: day(-3), total: 21, completed: 20, cancelled: 1, no_shows: 0 },
    { date: day(-2), total: 17, completed: 14, cancelled: 1, no_shows: 2 },
    { date: day(-1), total: 22, completed: 20, cancelled: 1, no_shows: 1 },
    { date: day(0), total: 19, completed: 17, cancelled: 0, no_shows: 2 },
  ],
  details: [
    { date: day(-12), patient: 'Marcus Boone', provider: 'Dr. Michael Anderson', type: 'Medication check', outcome: 'No-show' },
    { date: day(-9), patient: 'Jordan Ellis', provider: 'Dr. Dana Okafor', type: 'Follow-up', outcome: 'No-show' },
    { date: day(-5), patient: 'Aiko Tanaka', provider: 'Dr. Dana Okafor', type: 'Annual physical', outcome: 'Cancelled late' },
    { date: day(-3), patient: 'Priya Nandakumar', provider: 'Dr. Michael Anderson', type: 'Telehealth consult', outcome: 'No-show' },
  ],
  totalScheduled: 396,
  totalNoShows: 18,
  noShowRate: '4.5%',
};

const dailyAppointmentsReport = {
  summary: [
    { date: day(-4), total: 18, completed: 16, cancelled: 1, no_shows: 1 },
    { date: day(-3), total: 21, completed: 20, cancelled: 1, no_shows: 0 },
    { date: day(-2), total: 17, completed: 15, cancelled: 0, no_shows: 2 },
    { date: day(-1), total: 22, completed: 21, cancelled: 1, no_shows: 0 },
    { date: day(0), total: 19, completed: 17, cancelled: 0, no_shows: 2 },
  ],
  details: [],
};

const customReportResult = {
  summary: [
    { provider: 'Dr. Michael Anderson', appointments: 132, completed: 124, revenue: 21840 },
    { provider: 'Dr. Dana Okafor', appointments: 98, completed: 91, revenue: 15720 },
    { provider: 'Sam Whitfield, RN', appointments: 41, completed: 40, revenue: 3280 },
  ],
  details: [],
  dataSource: 'appointments',
  rowCount: 3,
};

/* ── public booking ──────────────────────────────────────────────────────── */

const bookingSlug = 'dr-anderson';

/**
 * The public page renders provider.first_name[0], so the config must carry the
 * name in parts — without them the page throws before it paints.
 */
const bookingConfig = {
  slug: bookingSlug,
  provider_id: 2,
  providerId: 2,
  first_name: 'Michael',
  last_name: 'Anderson',
  provider_name: 'Dr. Michael Anderson',
  providerName: 'Dr. Michael Anderson',
  specialty: 'Family Medicine',
  clinic_name: F.clinic.clinic_name,
  clinicName: F.clinic.clinic_name,
  address: `${F.clinic.address}, ${F.clinic.city}`,
  phone: F.clinic.phone,
  is_enabled: true,
  isEnabled: true,
  booking_window_days: 30,
  welcome_message: 'Book a visit with Dr. Anderson. Choose a type, pick a time, and you are done.',
};

const bookingTypes = appointmentTypes
  .filter((t) => t.available_online)
  .map((t) => ({
    id: t.id,
    name: t.name,
    duration_minutes: t.duration_minutes,
    durationMinutes: t.duration_minutes,
    description: `${t.duration_minutes} minutes with Dr. Anderson`,
    price: t.name === 'Annual physical' ? 180 : 120,
  }));

/** Weekday dates inside the booking window, as the picker expects them. */
const bookingDates = (() => {
  const out = [];
  for (let i = 1; out.length < 12; i += 1) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    if (d.getDay() !== 0 && d.getDay() !== 6) {
      out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }
  }
  return out;
})();

/** Slots are rendered from `slot.start`, an ISO timestamp on the chosen day. */
const slotsForDate = (isoDate) =>
  ['09:00', '09:30', '10:00', '11:00', '13:30', '14:00', '14:30', '15:30']
    .map((time, i) => ({
      id: 1000 + i,
      start: `${isoDate}T${time}:00`,
      end: `${isoDate}T${time}:00`,
      time,
      available: true,
    }));

const bookingSlots = slotsForDate(bookingDates[0]);

module.exports = {
  waitlist,
  intakeForms, intakeFlows, consentForms,
  formTemplates, formSubmissions, formStats, formAuditLogs,
  serviceCategories, offerings, offeringPackages, offeringPromotions, offeringStatistics,
  noShowReport, dailyAppointmentsReport, customReportResult,
  bookingSlug, bookingConfig, bookingTypes, bookingDates, bookingSlots, slotsForDate,
  patients, providers,
};
