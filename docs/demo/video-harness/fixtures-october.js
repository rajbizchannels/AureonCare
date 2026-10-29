/**
 * Fixtures for the October release screens: multi-site locations, medical camps
 * and the specialty configuration wizard.
 *
 * Shapes here are camelCase because that is what these three features return —
 * they are newer than the snake_case half of the API, and the panels read them
 * directly with no normalising layer. Getting that wrong renders a populated
 * screen full of blanks, which is the failure mode most of the aliasing in
 * harness.js exists to undo.
 *
 * Dates are computed relative to the recording, so a cut made in March does not
 * open on a camp that ran last October.
 */

const DAY = 86400000;
const now = () => new Date();
const iso = (ms) => new Date(ms).toISOString();
const atHour = (dayOffset, hour, minute = 0) => {
  const d = now();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};

/* ─────────────────────────────── locations ──────────────────────────────── */

/**
 * Four sites of three different kinds. The mix is the point of the feature: a
 * practice that runs outreach has venues it does not own, and before locations
 * existed those lived in a free-text address field on whatever record needed
 * them.
 */
const locations = [
  {
    id: 1,
    name: 'Mercy Family Health — Main Clinic',
    type: 'clinic',
    addressLine1: '1420 Alder Street',
    city: 'Portland',
    state: 'OR',
    postalCode: '97204',
    phone: '(503) 555-0142',
    timezone: 'America/Los_Angeles',
    isPrimary: true,
    isActive: true,
  },
  {
    id: 2,
    name: 'Mercy Family Health — Eastside',
    type: 'clinic',
    addressLine1: '88 Burnside Avenue',
    city: 'Portland',
    state: 'OR',
    postalCode: '97214',
    phone: '(503) 555-0188',
    timezone: 'America/Los_Angeles',
    isPrimary: false,
    isActive: true,
  },
  {
    id: 3,
    name: 'Riverside Community Hall',
    type: 'camp',
    addressLine1: 'Riverside Park, Gate 2',
    city: 'Gresham',
    state: 'OR',
    postalCode: '97030',
    timezone: 'America/Los_Angeles',
    isPrimary: false,
    isActive: true,
  },
  {
    id: 4,
    name: 'Mobile Screening Unit 1',
    type: 'mobile',
    addressLine1: 'Dispatched from Main Clinic',
    city: 'Portland',
    state: 'OR',
    timezone: 'America/Los_Angeles',
    isPrimary: false,
    isActive: true,
  },
];

/* ───────────────────────────────── camps ────────────────────────────────── */

const camps = [
  {
    id: 501,
    name: 'Riverside Community Health Camp',
    locationId: 3,
    locationName: 'Riverside Community Hall',
    status: 'published',
    isFree: true,
    startsAt: atHour(0, 9),
    endsAt: atHour(0, 16),
    sponsorName: 'Gresham Rotary Club',
    expectedAttendees: 180,
    registrationCount: 94,
    description: 'Free screening camp — vitals, blood glucose, eye check and a doctor consult.',
  },
  {
    id: 502,
    name: 'Eastside Diabetes Screening Drive',
    locationId: 2,
    locationName: 'Mercy Family Health — Eastside',
    status: 'closed',
    isFree: true,
    startsAt: atHour(-21, 9),
    endsAt: atHour(-21, 15),
    sponsorName: 'Oregon Health Trust',
    expectedAttendees: 120,
    registrationCount: 131,
    description: 'Closed and reconciled. Sponsor report issued.',
  },
  {
    id: 503,
    name: 'School Vision Camp — Fall Term',
    locationId: 4,
    locationName: 'Mobile Screening Unit 1',
    status: 'draft',
    isFree: true,
    startsAt: atHour(26, 10),
    endsAt: atHour(26, 15),
    expectedAttendees: 240,
    registrationCount: 0,
    description: 'Being planned. Stations and staffing not finalised.',
  },
];

const campServices = {
  501: [
    { id: 7101, campId: 501, offeringName: 'General consultation', isFree: true, price: null },
    { id: 7102, campId: 501, offeringName: 'Blood pressure screening', isFree: true, price: null },
    { id: 7103, campId: 501, label: 'Random blood glucose', isFree: true, price: null },
    { id: 7104, campId: 501, label: 'Basic eye check', isFree: true, price: null },
  ],
  502: [
    { id: 7201, campId: 502, label: 'HbA1c screening', isFree: true, price: null },
    { id: 7202, campId: 502, offeringName: 'General consultation', isFree: true, price: null },
  ],
  503: [],
};

const campStaff = {
  501: [
    { id: 7301, campId: 501, userId: 3, firstName: 'Dana', lastName: 'Okafor', email: 'dana.okafor@demo-clinic.example', campRole: 'lead' },
    { id: 7302, campId: 501, userId: 4, firstName: 'Sam', lastName: 'Whitfield', email: 'sam.whitfield@demo-clinic.example', campRole: 'nurse' },
    { id: 7303, campId: 501, userId: 5, firstName: 'Robin', lastName: 'Castellanos', email: 'robin.castellanos@demo-clinic.example', campRole: 'registrar' },
  ],
  502: [
    { id: 7401, campId: 502, userId: 3, firstName: 'Dana', lastName: 'Okafor', email: 'dana.okafor@demo-clinic.example', campRole: 'lead' },
  ],
  503: [],
};

/**
 * The staffing clash. Michael Anderson (user 2) is booked at the Main Clinic
 * on the morning of the camp, so rostering him is refused and the clashes are
 * listed. This is the beat the planning panel was built around: a camp takes
 * people away from the practice, and the planner should see what moves.
 */
const campStaffConflicts = {
  2: {
    count: 3,
    conflicts: [
      { id: 9001, startTime: atHour(0, 9, 30), locationName: 'Mercy Family Health — Main Clinic', patientInitials: 'J.M.' },
      { id: 9002, startTime: atHour(0, 10, 15), locationName: 'Mercy Family Health — Main Clinic', patientInitials: 'R.T.' },
      { id: 9003, startTime: atHour(0, 11, 0), locationName: 'Mercy Family Health — Main Clinic', patientInitials: 'A.K.' },
    ],
  },
};

const campStations = {
  501: [
    { id: 7501, campId: 501, name: 'Registration', stepOrder: 1, isClinical: false, isActive: true },
    { id: 7502, campId: 501, name: 'Vitals', stepOrder: 2, isClinical: true, isActive: true },
    { id: 7503, campId: 501, name: 'Doctor consult', stepOrder: 3, isClinical: true, isActive: true },
    { id: 7504, campId: 501, name: 'Pharmacy', stepOrder: 4, isClinical: false, isActive: true },
  ],
  502: [
    { id: 7601, campId: 502, name: 'Registration', stepOrder: 1, isClinical: false, isActive: true },
    { id: 7602, campId: 502, name: 'Lab draw', stepOrder: 2, isClinical: true, isActive: true },
  ],
  503: [],
};

const campAllocations = {
  501: [
    {
      id: 7701, campId: 501, itemId: 11, itemName: 'Paracetamol 500mg tablets',
      qtyIssued: 400, unitOfMeasure: 'tablets', qtyConsumed: null, qtyReturned: null,
      qtyUnaccounted: 400, reconciledAt: null,
    },
    {
      id: 7702, campId: 501, itemId: 12, itemName: 'Blood glucose test strips',
      qtyIssued: 200, unitOfMeasure: 'strips', qtyConsumed: null, qtyReturned: null,
      qtyUnaccounted: 200, reconciledAt: null,
    },
    {
      id: 7703, campId: 501, itemId: 13, itemName: 'Disposable gloves (box)',
      qtyIssued: 6, unitOfMeasure: 'boxes', qtyConsumed: 4, qtyReturned: 2,
      qtyUnaccounted: 0, reconciledAt: iso(Date.now() - 2 * 3600000),
    },
  ],
  502: [],
  503: [],
};

/**
 * Readiness drives the status buttons and the blocker list. Camp 501 is
 * published and can move to in_progress with nothing outstanding; 503 is a
 * draft that cannot be published yet, and says why.
 */
const campReadiness = {
  501: { campId: 501, to: 'in_progress', ready: true, allowed: ['in_progress'], blockers: [] },
  502: { campId: 502, to: 'archived', ready: true, allowed: ['archived'], blockers: [] },
  503: {
    campId: 503,
    to: 'published',
    ready: false,
    allowed: [],
    blockers: [
      { code: 'NoStations', message: 'No stations defined — attendees would have nowhere to go.' },
      { code: 'NoStaff', message: 'Nobody rostered. A camp needs at least one clinician on duty.' },
      { code: 'NoServices', message: 'No services listed, so there is nothing to record against.' },
    ],
  },
};

const campRegistrations = {
  501: [
    {
      id: 8101, campId: 501, tokenNo: 94, fullName: 'Priya Raman', phone: '(503) 555-0931',
      ageYears: 54, gender: 'female', city: 'Gresham', status: 'in_progress',
      consentGivenAt: iso(Date.now() - 25 * 60000), patientId: null, mrn: null,
    },
    {
      id: 8102, campId: 501, tokenNo: 93, fullName: 'Thomas Boateng', phone: '(503) 555-0714',
      ageYears: 61, gender: 'male', city: 'Gresham', status: 'in_progress',
      consentGivenAt: iso(Date.now() - 38 * 60000), patientId: 1, mrn: 'MRN-2025-041',
    },
    {
      id: 8103, campId: 501, tokenNo: 92, fullName: 'Leila Haddad', phone: '(503) 555-0222',
      ageYears: 33, gender: 'female', city: 'Portland', status: 'registered',
      consentGivenAt: null, patientId: null, mrn: null,
    },
    {
      id: 8104, campId: 501, tokenNo: 91, fullName: 'Grace Mwangi', phone: '(503) 555-0455',
      ageYears: 47, gender: 'female', city: 'Gresham', status: 'completed',
      consentGivenAt: iso(Date.now() - 95 * 60000), patientId: 2, mrn: 'MRN-2025-037',
    },
    {
      id: 8105, campId: 501, tokenNo: 90, fullName: 'Hector Salazar', phone: '(503) 555-0607',
      ageYears: 29, gender: 'male', city: 'Gresham', status: 'completed',
      consentGivenAt: iso(Date.now() - 110 * 60000), patientId: null, mrn: null,
    },
  ],
  502: [],
  503: [],
};

/**
 * The live board. Longest waits are deliberately uneven — a board where every
 * station reads the same number demonstrates nothing, and the queue at the
 * doctor consult is exactly what a camp lead watches for.
 */
const campBoard = {
  501: [
    { id: 7501, name: 'Registration', stepOrder: 1, queued: 3, inProgress: 1, completed: 90, longestWaitSeconds: 240 },
    { id: 7502, name: 'Vitals', stepOrder: 2, queued: 7, inProgress: 2, completed: 81, longestWaitSeconds: 780 },
    { id: 7503, name: 'Doctor consult', stepOrder: 3, queued: 14, inProgress: 2, completed: 64, longestWaitSeconds: 2160 },
    { id: 7504, name: 'Pharmacy', stepOrder: 4, queued: 2, inProgress: 1, completed: 58, longestWaitSeconds: 300 },
  ],
  502: [],
  503: [],
};

const campStationQueues = {
  7501: [
    { id: 8621, registrationId: 8107, tokenNo: 96, fullName: 'Daniel Osei', ageYears: 38, gender: 'male', status: 'queued', queuedAt: iso(Date.now() - 4 * 60000), waitSeconds: 240 },
    { id: 8622, registrationId: 8108, tokenNo: 95, fullName: 'Fatima Noor', ageYears: 52, gender: 'female', status: 'in_progress', queuedAt: iso(Date.now() - 3 * 60000), waitSeconds: 180 },
  ],
  7503: [
    { id: 8601, registrationId: 8101, tokenNo: 94, fullName: 'Priya Raman', ageYears: 54, gender: 'female', status: 'queued', queuedAt: iso(Date.now() - 36 * 60000), waitSeconds: 2160 },
    { id: 8602, registrationId: 8102, tokenNo: 93, fullName: 'Thomas Boateng', ageYears: 61, gender: 'male', status: 'in_progress', queuedAt: iso(Date.now() - 18 * 60000), waitSeconds: 1080 },
    { id: 8603, registrationId: 8106, tokenNo: 89, fullName: 'Ana Duarte', ageYears: 44, gender: 'female', status: 'queued', queuedAt: iso(Date.now() - 12 * 60000), waitSeconds: 720 },
  ],
  7502: [
    { id: 8611, registrationId: 8103, tokenNo: 92, fullName: 'Leila Haddad', ageYears: 33, gender: 'female', status: 'queued', queuedAt: iso(Date.now() - 13 * 60000), waitSeconds: 780 },
  ],
};

/**
 * Outcomes. `referrals` is the number a practice manager is actually asked to
 * justify the camp with: attendees who became patients, and the follow-up
 * appointments they booked.
 */
const campReport = {
  501: {
    campId: 501,
    totals: { registrations: 94, consented: 88, promoted: 37, completed: 58, leftEarly: 6 },
    referrals: { referredAttendees: 37, followUpAppointments: 21 },
    stations: [
      { station: 'Registration', visits: 94, completed: 90, avgWaitSeconds: 180, avgServiceSeconds: 150 },
      { station: 'Vitals', visits: 90, completed: 81, avgWaitSeconds: 460, avgServiceSeconds: 240 },
      { station: 'Doctor consult', visits: 80, completed: 64, avgWaitSeconds: 1320, avgServiceSeconds: 540 },
      { station: 'Pharmacy', visits: 61, completed: 58, avgWaitSeconds: 210, avgServiceSeconds: 180 },
    ],
    cost: { issuedCost: '$1,284.00', consumedCost: '$806.50' },
  },
};

/**
 * The sponsor view. Aggregates only — the route refuses to put attendee rows in
 * this response at all, and `minimumBucketSize` is the small-cell rule that
 * stops a thin bucket identifying somebody.
 */
const campSponsorReport = {
  501: {
    campId: 501,
    campName: 'Riverside Community Health Camp',
    sponsorName: 'Gresham Rotary Club',
    attendance: { attendees: 94, completedPipeline: 58 },
    referralsMade: 37,
    disclosure: { minimumBucketSize: 5, suppressedBuckets: 2 },
    ageBands: [
      { band: '0–17', count: 11 },
      { band: '18–39', count: 24 },
      { band: '40–59', count: 33 },
      { band: '60+', count: 26 },
    ],
    gender: [
      { gender: 'female', count: 52 },
      { gender: 'male', count: 39 },
    ],
    conditionsScreened: [
      { condition: 'Hypertension', count: 41 },
      { condition: 'Type 2 diabetes', count: 28 },
      { condition: 'Refractive error', count: 19 },
      { condition: 'Anaemia', count: 12 },
    ],
  },
};

/* ──────────────────────── specialty configuration ──────────────────────── */

const specialties = [
  { code: 'family_medicine', name: 'Family medicine', hasPack: true, packVersion: '1.2', clinicalReviewStatus: 'approved' },
  { code: 'internal_medicine', name: 'Internal medicine', hasPack: true, packVersion: '1.1', clinicalReviewStatus: 'approved' },
  { code: 'paediatrics', name: 'Paediatrics', hasPack: true, packVersion: '1.0', clinicalReviewStatus: 'approved' },
  { code: 'ophthalmology', name: 'Ophthalmology', hasPack: true, packVersion: '1.0', clinicalReviewStatus: 'approved' },
  { code: 'dermatology', name: 'Dermatology', hasPack: true, packVersion: '0.9', clinicalReviewStatus: 'draft' },
  { code: 'dentistry', name: 'Dentistry', hasPack: false, packVersion: null, clinicalReviewStatus: null },
  { code: 'physiotherapy', name: 'Physiotherapy', hasPack: false, packVersion: null, clinicalReviewStatus: null },
];

/**
 * The shell reads this on every load, not just the wizard, and offers the
 * setup banner to any admin whose onboarding has neither completed nor been
 * skipped. Before this mock existed the route fell through to the generic
 * handler and returned [], whose `.onboarding` is undefined — so no banner.
 * Keeping `completedAt` set preserves that: the banner is a first-run prompt
 * and has no business appearing over the top of a cut about something else.
 * M12 reaches the wizard through Settings, so it needs no banner either.
 */
const practiceSetupState = {
  practice: {
    name: 'Mercy Family Health',
    country: 'United States',
    timezone: 'America/Los_Angeles',
  },
  specialties: [],
  onboarding: {
    currentStep: 'profile',
    completedAt: new Date(Date.now() - 30 * DAY).toISOString(),
    skippedAt: null,
  },
  terminology: {},
  pinnedModules: [],
  hiddenModules: [],
};

/**
 * The preview. `conflicts` is the whole argument for the feature: two rows the
 * practice already edited, which the pack reports and then leaves alone rather
 * than restoring to its own idea of correct.
 */
const specialtyPreview = {
  summary: { created: 23, updated: 0, skipped: 4, conflicts: 2 },
  mergeClashes: [
    { section: 'terminology', key: 'provider', keptFrom: 'Family medicine', alsoIn: 'Paediatrics' },
  ],
  conflicts: [
    {
      section: 'appointment_types',
      key: 'annual_physical',
      message: 'Annual physical — you changed the duration to 40 minutes. Left as it is.',
    },
    {
      section: 'offerings',
      key: 'well_child_visit',
      message: 'Well-child visit — your price differs from the pack. Left as it is.',
    },
  ],
  sections: {
    offerings: [
      { key: 'annual_physical', name: 'Annual physical', action: 'conflict' },
      { key: 'acute_visit', name: 'Acute visit', action: 'create' },
      { key: 'well_child_visit', name: 'Well-child visit', action: 'conflict' },
      { key: 'immunisation', name: 'Immunisation', action: 'create' },
      { key: 'chronic_care_review', name: 'Chronic care review', action: 'create' },
    ],
    appointment_types: [
      { key: 'new_patient_30', name: 'New patient — 30 min', action: 'create' },
      { key: 'follow_up_15', name: 'Follow-up — 15 min', action: 'create' },
      { key: 'well_child_20', name: 'Well-child — 20 min', action: 'create' },
    ],
    form_templates: [
      { key: 'paediatric_intake', name: 'Paediatric intake', action: 'create' },
      { key: 'growth_milestones', name: 'Growth and milestones', action: 'create' },
      { key: 'vaccine_consent', name: 'Vaccination consent', action: 'create' },
      { key: 'general_intake', name: 'General intake', action: 'skip' },
    ],
  },
  settings: {
    hiddenModules: ['camps', 'inventory'],
    terminology: { provider: 'Clinician', patient: 'Patient' },
  },
};

const specialtyApplyResult = {
  created: 23,
  updated: 0,
  skipped: 4,
  conflicts: 2,
  specialties: ['family_medicine', 'paediatrics'],
};

module.exports = {
  locations,
  camps,
  campServices,
  campStaff,
  campStaffConflicts,
  campStations,
  campAllocations,
  campReadiness,
  campRegistrations,
  campBoard,
  campStationQueues,
  campReport,
  campSponsorReport,
  specialties,
  practiceSetupState,
  specialtyPreview,
  specialtyApplyResult,
  DAY,
  atHour,
};
