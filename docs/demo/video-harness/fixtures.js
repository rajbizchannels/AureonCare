/**
 * Shared synthetic dataset for the AureonCare training-video library.
 *
 * Everything here is invented. Personas follow docs/demo/DEMO_SCENARIOS.md so
 * the short videos and the executive demo tell one consistent story:
 * Sarah Williams is the recurring patient, Dr. Anderson the recurring provider.
 *
 * No real patient, clinician, clinic or credential data appears in this file,
 * and none of the recordings touch a live backend.
 */

const pad = (n) => String(n).padStart(2, '0');

/** ISO timestamp for a day offset from today at a given local time. */
const at = (dayOffset, hour, minute = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};

/** yyyy-mm-dd for a day offset from today. */
const day = (dayOffset) => {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const clinic = {
  clinic_name: 'Northside Family Health (Demo)',
  address: '400 Harbor Way, Suite 210',
  city: 'Portland',
  state: 'OR',
  zip: '97201',
  phone: '555-0100',
  email: 'front-desk@demo-clinic.example',
  website: 'https://demo-clinic.example',
  timezone: 'America/Los_Angeles',
  currency: 'USD',
  tax_id: '00-0000000',
};

/** The signed-in user for every recording: an admin so nothing is role-gated. */
const demoUser = {
  id: 1,
  first_name: 'Alex',
  last_name: 'Rivera',
  email: 'alex.rivera@demo-clinic.example',
  role: 'admin',
  title: 'Practice Administrator',
  practice: clinic.clinic_name,
  language: 'English',
  avatar: 'AR',
  status: 'active',
  preferences: {
    emailNotifications: true,
    smsAlerts: false,
    darkMode: true,
    planTier: 'enterprise',
  },
};

const users = [
  demoUser,
  {
    id: 2, first_name: 'Michael', last_name: 'Anderson',
    email: 'michael.anderson@demo-clinic.example', role: 'doctor',
    title: 'Family Medicine', specialty: 'Family Medicine', status: 'active',
  },
  {
    id: 3, first_name: 'Dana', last_name: 'Okafor',
    email: 'dana.okafor@demo-clinic.example', role: 'doctor',
    title: 'Internal Medicine', specialty: 'Internal Medicine', status: 'active',
  },
  {
    id: 4, first_name: 'Sam', last_name: 'Whitfield',
    email: 'sam.whitfield@demo-clinic.example', role: 'nurse',
    title: 'Registered Nurse', status: 'active',
  },
  {
    id: 5, first_name: 'Robin', last_name: 'Castellanos',
    email: 'robin.castellanos@demo-clinic.example', role: 'receptionist',
    title: 'Front Desk', status: 'active',
  },
];

const providers = users
  .filter((u) => ['doctor', 'nurse'].includes(u.role))
  .map((u) => ({
    id: u.id,
    first_name: u.first_name,
    last_name: u.last_name,
    name: `Dr. ${u.first_name} ${u.last_name}`,
    specialty: u.specialty || u.title,
    email: u.email,
    is_active: true,
  }));

const patients = [
  {
    id: 101, mrn: 'MRN-2025-001', first_name: 'Sarah', last_name: 'Williams',
    email: 'sarah.williams@example.com', phone: '555-0123',
    date_of_birth: '1985-05-15', gender: 'Female', status: 'active',
    address: '123 Main Street', city: 'Portland', state: 'OR', zip: '97205',
    insurance_provider: 'Blue Cross Blue Shield', insurance_payer_id: 201, insurance_policy_number: 'BCBS-12345678',
    emergency_contact_name: 'John Williams', emergency_contact_phone: '555-0199',
    telehealth_preference: null, portal_enabled: true,
    created_at: at(-420, 9),
  },
  {
    id: 102, mrn: 'MRN-2025-014', first_name: 'Jordan', last_name: 'Ellis',
    email: 'jordan.ellis@example.com', phone: '555-0141',
    date_of_birth: '1986-04-12', gender: 'Non-binary', status: 'active',
    address: '88 Alder Court', city: 'Portland', state: 'OR', zip: '97210',
    insurance_provider: 'Aetna', insurance_payer_id: 202, insurance_policy_number: 'AET-55512',
    portal_enabled: true, created_at: at(-210, 11),
  },
  {
    id: 103, mrn: 'MRN-2025-027', first_name: 'Priya', last_name: 'Nandakumar',
    email: 'priya.n@example.com', phone: '555-0172',
    date_of_birth: '1979-11-03', gender: 'Female', status: 'active',
    address: '14 Cedar Lane', city: 'Beaverton', state: 'OR', zip: '97005',
    insurance_provider: 'UnitedHealthcare', insurance_payer_id: 203, insurance_policy_number: 'UHC-90210',
    portal_enabled: true, created_at: at(-140, 14),
  },
  {
    id: 104, mrn: 'MRN-2025-039', first_name: 'Marcus', last_name: 'Boone',
    email: 'marcus.boone@example.com', phone: '555-0188',
    date_of_birth: '1994-02-25', gender: 'Male', status: 'active',
    address: '9 Rivergate Ave', city: 'Portland', state: 'OR', zip: '97203',
    insurance_provider: 'Cigna', insurance_payer_id: 204, insurance_policy_number: 'CIG-40881',
    portal_enabled: true, created_at: at(-95, 10),
  },
  {
    id: 105, mrn: 'MRN-2025-046', first_name: 'Aiko', last_name: 'Tanaka',
    email: 'aiko.tanaka@example.com', phone: '555-0164',
    date_of_birth: '1968-08-08', gender: 'Female', status: 'active',
    address: '220 Willow Park', city: 'Portland', state: 'OR', zip: '97209',
    insurance_provider: 'Medicare', insurance_payer_id: 205, insurance_policy_number: 'MCR-77120',
    portal_enabled: false, created_at: at(-60, 15),
  },
];

const appointmentTypes = [
  { id: 1, name: 'Follow-up', duration_minutes: 30, color: '#22d3ee', is_active: true, available_online: true },
  { id: 2, name: 'Annual physical', duration_minutes: 45, color: '#34d399', is_active: true, available_online: true },
  { id: 3, name: 'New patient visit', duration_minutes: 60, color: '#a78bfa', is_active: true, available_online: true },
  { id: 4, name: 'Telehealth consult', duration_minutes: 30, color: '#60a5fa', is_active: true, available_online: true },
  { id: 5, name: 'Medication check', duration_minutes: 20, color: '#fbbf24', is_active: true, available_online: false },
];

const appointments = [
  { id: 9001, patient_id: 101, provider_id: 2, provider_first_name: 'Michael', provider_last_name: 'Anderson', provider_specialization: 'Family Medicine', start_time: at(0, 9, 0), end_time: at(0, 9, 30), duration_minutes: 30, appointment_type: 'Follow-up', status: 'scheduled', location: 'Room 2', reason: 'Diabetes follow-up' },
  { id: 9002, patient_id: 102, provider_id: 2, provider_first_name: 'Michael', provider_last_name: 'Anderson', provider_specialization: 'Family Medicine', start_time: at(0, 10, 0), end_time: at(0, 10, 45), duration_minutes: 45, appointment_type: 'Annual physical', status: 'scheduled', location: 'Room 2', reason: 'Annual physical' },
  { id: 9003, patient_id: 103, provider_id: 3, provider_first_name: 'Dana', provider_last_name: 'Okafor', provider_specialization: 'Internal Medicine', start_time: at(0, 11, 0), end_time: at(0, 11, 30), duration_minutes: 30, appointment_type: 'Telehealth consult', status: 'scheduled', location: 'Telehealth', reason: 'Medication review' },
  { id: 9004, patient_id: 104, provider_id: 2, provider_first_name: 'Michael', provider_last_name: 'Anderson', provider_specialization: 'Family Medicine', start_time: at(0, 14, 0), end_time: at(0, 14, 20), duration_minutes: 20, appointment_type: 'Medication check', status: 'scheduled', location: 'Room 1', reason: 'BP recheck' },
  { id: 9005, patient_id: 105, provider_id: 3, provider_first_name: 'Dana', provider_last_name: 'Okafor', provider_specialization: 'Internal Medicine', start_time: at(1, 9, 30), end_time: at(1, 10, 30), duration_minutes: 60, appointment_type: 'New patient visit', status: 'scheduled', location: 'Room 3', reason: 'New patient intake' },
  { id: 9006, patient_id: 101, provider_id: 2, provider_first_name: 'Michael', provider_last_name: 'Anderson', provider_specialization: 'Family Medicine', start_time: at(2, 15, 30), end_time: at(2, 16, 0), duration_minutes: 30, appointment_type: 'Telehealth consult', status: 'scheduled', location: 'Telehealth', reason: 'Lab results review' },
  { id: 9007, patient_id: 102, provider_id: 3, provider_first_name: 'Dana', provider_last_name: 'Okafor', provider_specialization: 'Internal Medicine', start_time: at(3, 10, 0), end_time: at(3, 10, 30), duration_minutes: 30, appointment_type: 'Follow-up', status: 'scheduled', location: 'Room 1', reason: 'Follow-up' },
  { id: 9008, patient_id: 103, provider_id: 2, provider_first_name: 'Michael', provider_last_name: 'Anderson', provider_specialization: 'Family Medicine', start_time: at(-2, 10, 0), end_time: at(-2, 10, 30), duration_minutes: 30, appointment_type: 'Follow-up', status: 'completed', location: 'Room 2', reason: 'Follow-up' },
  { id: 9009, patient_id: 104, provider_id: 2, provider_first_name: 'Michael', provider_last_name: 'Anderson', provider_specialization: 'Family Medicine', start_time: at(-5, 11, 0), end_time: at(-5, 11, 45), duration_minutes: 45, appointment_type: 'Annual physical', status: 'completed', location: 'Room 2', reason: 'Annual physical' },
];

const medicalRecords = [
  {
    id: 5001, patient_id: 101, provider_id: 2, record_type: 'Progress note',
    visit_date: at(-90, 9), chief_complaint: 'Routine diabetes follow-up',
    notes: 'HbA1c 7.2%, down from 7.9%. Continues metformin 500mg BID. Diet and activity reviewed.',
    diagnosis: 'Type 2 Diabetes Mellitus (E11.9)', created_at: at(-90, 10),
  },
  {
    id: 5002, patient_id: 101, provider_id: 2, record_type: 'Progress note',
    visit_date: at(-270, 9), chief_complaint: 'Blood pressure check',
    notes: 'BP 135/85, controlled on current therapy. No medication change.',
    diagnosis: 'Essential Hypertension (I10)', created_at: at(-270, 10),
  },
];

const vitals = [
  { id: 6001, patient_id: 101, recorded_at: at(-90, 9), blood_pressure_systolic: 135, blood_pressure_diastolic: 85, heart_rate: 74, temperature: 36.8, weight: 78.5, height: 165, bmi: 28.8, oxygen_saturation: 98 },
  { id: 6002, patient_id: 101, recorded_at: at(-270, 9), blood_pressure_systolic: 142, blood_pressure_diastolic: 88, heart_rate: 78, temperature: 36.7, weight: 80.2, height: 165, bmi: 29.5, oxygen_saturation: 97 },
];

const allergies = [
  { id: 7001, patient_id: 101, allergen: 'Penicillin', reaction: 'Rash, itching', severity: 'Moderate', status: 'active', noted_at: at(-800, 12) },
];

const diagnoses = [
  { id: 8001, patient_id: 101, icd_code: 'E11.9', icd_10_code: 'E11.9', description: 'Type 2 diabetes mellitus without complications', diagnosis_name: 'Type 2 Diabetes Mellitus', status: 'active', diagnosis_date: day(-365), provider_id: 2, severity: 'moderate' },
  { id: 8002, patient_id: 101, icd_code: 'I10', icd_10_code: 'I10', description: 'Essential (primary) hypertension', diagnosis_name: 'Essential Hypertension', status: 'active', diagnosis_date: day(-730), provider_id: 2, severity: 'mild' },
];

const prescriptions = [
  { id: 8501, patient_id: 101, provider_id: 2, medication_name: 'Metformin', dosage: '500mg', frequency: 'Twice daily with meals', quantity: 60, refills: 3, status: 'active', prescribed_date: day(-60), pharmacy: 'Northside Pharmacy - Main St' },
  { id: 8502, patient_id: 101, provider_id: 2, medication_name: 'Lisinopril', dosage: '10mg', frequency: 'Once daily', quantity: 30, refills: 2, status: 'active', prescribed_date: day(-60), pharmacy: 'Northside Pharmacy - Main St' },
];

const insurancePayers = [
  { id: 201, name: 'Blue Cross Blue Shield', payer_id: 'BCBS001', is_active: true, phone: '555-0400', claims_address: 'PO Box 1000, Portland OR' },
  { id: 202, name: 'Aetna', payer_id: 'AETNA01', is_active: true, phone: '555-0401' },
  { id: 203, name: 'UnitedHealthcare', payer_id: 'UHC0001', is_active: true, phone: '555-0402' },
  { id: 204, name: 'Cigna', payer_id: 'CIGNA01', is_active: true, phone: '555-0403' },
  { id: 205, name: 'Medicare', payer_id: 'MCARE01', is_active: true, phone: '555-0404' },
];

const claims = [
  { id: 4001, claim_number: 'CLM-2026-0104', patient_id: 103, provider_id: 3, payer_id: 203, insurance_provider: 'UnitedHealthcare', service_date: day(-12), total_amount: 180, amount: 180, paid_amount: 144, status: 'paid', diagnosis_codes: 'E11.9', procedure_codes: '99213', submitted_at: at(-11, 9) },
  { id: 4002, claim_number: 'CLM-2026-0111', patient_id: 104, provider_id: 2, payer_id: 204, insurance_provider: 'Cigna', service_date: day(-5), total_amount: 320, amount: 320, paid_amount: 0, status: 'submitted', diagnosis_codes: 'I10', procedure_codes: '99395', submitted_at: at(-4, 9) },
  { id: 4003, claim_number: 'CLM-2026-0118', patient_id: 102, provider_id: 2, payer_id: 202, insurance_provider: 'Aetna', service_date: day(-3), total_amount: 210, amount: 210, paid_amount: 0, status: 'denied', denial_reason: 'CO-16 Missing information', diagnosis_codes: 'J06.9', procedure_codes: '99214', submitted_at: at(-2, 9) },
];

const payments = [
  { id: 3001, patient_id: 103, claim_id: 4001, amount: 144, payment_method: 'insurance', payment_date: day(-6), status: 'completed', reference: 'EFT-88214' },
  { id: 3002, patient_id: 103, amount: 36, payment_method: 'card', payment_date: day(-6), status: 'completed', reference: 'STR-10023' },
  { id: 3003, patient_id: 104, amount: 45, payment_method: 'card', payment_date: day(-2), status: 'completed', reference: 'STR-10044' },
];

const tasks = [
  { id: 2001, title: 'Call Sarah Williams with lab results', status: 'pending', priority: 'high', due_date: at(0, 16), assigned_to: 2 },
  { id: 2002, title: 'Verify insurance for Aiko Tanaka', status: 'pending', priority: 'medium', due_date: at(1, 12), assigned_to: 5 },
  { id: 2003, title: 'Resubmit denied claim CLM-2026-0118', status: 'in_progress', priority: 'high', due_date: at(1, 17), assigned_to: 1 },
  { id: 2004, title: 'Order flu vaccine stock', status: 'completed', priority: 'low', due_date: at(-1, 9), assigned_to: 5 },
];

const notifications = [
  { id: 1001, user_id: 1, type: 'alert', title: 'Claim denied', message: 'CLM-2026-0118 was denied — reason CO-16.', is_read: false, created_at: at(0, 8, 10) },
  { id: 1002, user_id: 1, type: 'info', title: 'New portal message', message: 'Sarah Williams completed a pre-visit form.', is_read: false, created_at: at(0, 8, 30) },
  { id: 1003, user_id: 1, type: 'success', title: 'Payment received', message: '$144.00 posted from UnitedHealthcare.', is_read: true, created_at: at(-1, 15, 0) },
];

const telehealthProviders = [
  { id: 1, provider_type: 'google_meet', is_enabled: true, is_configured: true, has_tokens: true, client_id: 'demo-client-id.apps.googleusercontent.com', zoom_user_email: 'alex.rivera@demo-clinic.example' },
  { id: 2, provider_type: 'zoom', is_enabled: false, is_configured: false, has_tokens: false, client_id: '' },
  { id: 3, provider_type: 'webex', is_enabled: false, is_configured: false, has_tokens: false, client_id: '' },
  { id: 4, provider_type: 'microsoft_teams', is_enabled: false, is_configured: false, has_tokens: false, client_id: '' },
];

const MEET_LINKS = [
  'https://meet.google.com/xkq-dmvt-pra',
  'https://meet.google.com/rzn-hbfa-uwc',
  'https://meet.google.com/tva-qesn-jdh',
];

const telehealthSessions = [
  { id: 7001, appointment_id: 9008, patient_id: 103, provider_id: 3, provider_type: 'google_meet', session_status: 'completed', start_time: at(-2, 10), end_time: at(-2, 10, 28), duration_minutes: 28, meeting_url: MEET_LINKS[2], join_url: MEET_LINKS[2] },
];

const offerings = [
  { id: 301, name: 'Diabetes management programme', description: '12-week structured programme', is_active: true, available_online: true, duration_minutes: 45, pricing_options: [{ id: 1, name: 'Standard', final_price: 240 }] },
  { id: 302, name: 'Annual wellness visit', description: 'Comprehensive yearly review', is_active: true, available_online: true, duration_minutes: 45, pricing_options: [{ id: 2, name: 'Standard', final_price: 180 }] },
];

const medicalCodes = {
  icd: [
    { code: 'E11.9', description: 'Type 2 diabetes mellitus without complications', system: 'ICD-10' },
    { code: 'E11.65', description: 'Type 2 diabetes mellitus with hyperglycemia', system: 'ICD-10' },
    { code: 'I10', description: 'Essential (primary) hypertension', system: 'ICD-10' },
    { code: 'J06.9', description: 'Acute upper respiratory infection, unspecified', system: 'ICD-10' },
    { code: 'Z00.00', description: 'General adult medical examination without abnormal findings', system: 'ICD-10' },
  ],
  cpt: [
    { code: '99213', description: 'Office visit, established patient, low complexity', system: 'CPT' },
    { code: '99214', description: 'Office visit, established patient, moderate complexity', system: 'CPT' },
    { code: '99395', description: 'Periodic preventive medicine, established patient, 18-39 years', system: 'CPT' },
    { code: '36415', description: 'Collection of venous blood by venipuncture', system: 'CPT' },
    { code: '83036', description: 'Hemoglobin A1c', system: 'CPT' },
  ],
};

/* ── Wave 2: revenue cycle ────────────────────────────────────────────────── */

/**
 * Pre-authorizations. One of each state the queue can show, so V09 can point at
 * a real Approved and a real Denied rather than describing them.
 */
const preapprovals = [
  { id: 5001, preapproval_number: 'PA-2026-0031', patient_id: 103, provider_id: 3, insurance_payer_id: 203, payer_name: 'UnitedHealthcare', service_description: 'MRI lumbar spine without contrast', service_date: day(6), status: 'approved', authorization_number: 'AUTH-77321', approved_units: 1, estimated_cost: 1450, valid_from: day(-2), valid_to: day(88), diagnosis_codes: 'M54.5', procedure_codes: '72148', submitted_at: at(-6, 10) },
  { id: 5002, preapproval_number: 'PA-2026-0034', patient_id: 104, provider_id: 2, insurance_payer_id: 204, payer_name: 'Cigna', service_description: 'Physical therapy, 12 sessions', service_date: day(9), status: 'pending', estimated_cost: 960, diagnosis_codes: 'M25.561', procedure_codes: '97110', submitted_at: at(-2, 14) },
  { id: 5003, preapproval_number: 'PA-2026-0029', patient_id: 102, provider_id: 2, insurance_payer_id: 202, payer_name: 'Aetna', service_description: 'Sleep study, in-lab', service_date: day(-4), status: 'denied', denial_reason: 'Conservative treatment not documented', estimated_cost: 2100, diagnosis_codes: 'G47.33', procedure_codes: '95810', submitted_at: at(-14, 9) },
];

/**
 * Denials. CLM-2026-0118 is the denied claim already in `claims`, so the denial
 * queue and the claims queue tell the same story — V10 works that exact claim.
 */
const denials = [
  { id: 5101, denial_number: 'DN-2026-0042', claim_id: 4003, claim_number: 'CLM-2026-0118', patient_id: 102, insurance_payer_id: 202, payer_name: 'Aetna', denial_date: day(-2), denied_amount: 210, reason_code: 'CO-16', reason_description: 'Claim/service lacks information', denial_category: 'Invalid/Missing Information', status: 'open', appeal_status: 'not_started', priority: 'high', notes: 'Rendering provider NPI missing on the original submission.' },
  { id: 5102, denial_number: 'DN-2026-0038', claim_id: 4001, claim_number: 'CLM-2026-0091', patient_id: 105, insurance_payer_id: 205, payer_name: 'Medicare', denial_date: day(-16), denied_amount: 132, reason_code: 'CO-45', reason_description: 'Charge exceeds fee schedule/maximum allowable', denial_category: 'Non-Covered Service', status: 'resolved', appeal_status: 'won', priority: 'medium', resolved_date: day(-4) },
];

/** Payment postings — what turns a payer's remittance into a settled balance. */
const paymentPostings = [
  { id: 5201, posting_number: 'PP-2026-0088', claim_id: 4001, claim_number: 'CLM-2026-0104', patient_id: 103, insurance_payer_id: 203, payer_name: 'UnitedHealthcare', payment_method: 'Electronic Funds Transfer (EFT)', reference_number: 'EFT-88214', payment_date: day(-6), posted_date: day(-6), paid_amount: 144, adjustment_amount: 36, adjustment_code: 'CO', patient_responsibility: 0, status: 'posted', era_number: 'ERA-55120' },
];

const quotes = [
  { id: 5301, quote_number: 'QT-2026-0014', patient_id: 105, status: 'sent', subtotal: 240, discount: 0, tax: 0, total: 240, valid_until: day(21), created_at: at(-3, 11), items: [{ description: 'Diabetes management programme', quantity: 1, unit_price: 240 }] },
];

const invoices = [
  { id: 5401, invoice_number: 'INV-2026-0207', patient_id: 103, quote_id: null, status: 'paid', subtotal: 180, tax: 0, total: 180, amount_paid: 180, balance: 0, issue_date: day(-9), due_date: day(21), paid_date: day(-6) },
  { id: 5402, invoice_number: 'INV-2026-0211', patient_id: 104, quote_id: null, status: 'sent', subtotal: 95, tax: 0, total: 95, amount_paid: 0, balance: 95, issue_date: day(-2), due_date: day(28) },
];

/* ── Wave 2: clinical network ─────────────────────────────────────────────── */

const pharmacies = [
  { id: 6001, name: 'Northside Pharmacy - Main St', ncpdp_id: '3812004', npi: '1902845761', address: '410 Main Street', city: 'Portland', state: 'OR', zip: '97205', phone: '555-0300', fax: '555-0301', is_active: true, accepts_eprescribe: true, is_24_hour: false },
  { id: 6002, name: 'Riverbend Community Pharmacy', ncpdp_id: '3812119', npi: '1902845888', address: '77 Rivergate Ave', city: 'Portland', state: 'OR', zip: '97203', phone: '555-0310', is_active: true, accepts_eprescribe: true, is_24_hour: true },
  { id: 6003, name: 'Beaverton Family Drug', ncpdp_id: '3812277', npi: '1902845999', address: '2 Cedar Lane', city: 'Beaverton', state: 'OR', zip: '97005', phone: '555-0320', is_active: true, accepts_eprescribe: true, is_24_hour: false },
];

const laboratories = [
  { id: 6101, name: 'Labcorp - Portland Central', lab_code: 'LC-PDX-01', npi: '1104772210', address: '900 SW Harbor Blvd', city: 'Portland', state: 'OR', zip: '97201', phone: '555-0350', is_active: true, accepts_electronic_orders: true, specialties: 'Chemistry, Hematology, Microbiology', turnaround_time_hours: 24 },
  { id: 6102, name: 'Quest Diagnostics - Beaverton', lab_code: 'QD-BVT-04', npi: '1104772399', address: '15 Cedar Lane', city: 'Beaverton', state: 'OR', zip: '97005', phone: '555-0360', is_active: true, accepts_electronic_orders: true, specialties: 'Chemistry, Pathology', turnaround_time_hours: 48 },
];

/**
 * Lab orders. 7301 has already come back resulting with an abnormal A1c, which
 * is what V14 reviews and files — the loop closes in the chart, not in email.
 */
/**
 * `test_codes` and `diagnosis_codes` must be arrays (or JSON-encoded strings).
 * The chart does `JSON.parse` on them whenever they arrive as a string, so a
 * bare 'E11.9' throws inside render and takes the whole view down through the
 * error boundary — worth knowing before hand-editing these.
 */
const labOrders = [
  { id: 7301, order_number: 'LAB-2026-0442', patient_id: 101, provider_id: 2, laboratory_id: 6101, laboratory_name: 'Labcorp - Portland Central', order_date: day(-4), collection_date: day(-3), status: 'resulted', priority: 'routine', diagnosis_codes: ['E11.9'], test_codes: [{ code: '83036', name: 'Hemoglobin A1c' }, { code: '80061', name: 'Lipid panel' }], result_date: day(-1), results: [{ name: 'Hemoglobin A1c', value: '8.2', unit: '%', reference_range: '4.0-5.6', flag: 'abnormal' }, { name: 'Total cholesterol', value: '186', unit: 'mg/dL', reference_range: '<200', flag: 'normal' }] },
  { id: 7302, order_number: 'LAB-2026-0451', patient_id: 104, provider_id: 2, laboratory_id: 6102, laboratory_name: 'Quest Diagnostics - Beaverton', order_date: day(-1), status: 'transmitted', priority: 'routine', diagnosis_codes: ['I10'], test_codes: [{ code: '80053', name: 'Comprehensive metabolic panel' }] },
];

const formTemplates = [
  { id: 401, name: 'Telehealth consent', category_slug: 'consent', status: 'published', version: 3, updated_at: at(-30, 12) },
  { id: 402, name: 'Pre-visit health questionnaire', category_slug: 'clinical', status: 'published', version: 5, updated_at: at(-14, 9) },
  { id: 403, name: 'New patient intake', category_slug: 'onboarding', status: 'published', version: 2, updated_at: at(-45, 16) },
];

const dashboardStats = {
  todays_appointments: 4,
  patients_total: patients.length,
  pending_tasks: 2,
  revenue_month: 18450,
  outstanding_claims: 2,
  no_show_rate: 0.04,
};

module.exports = {
  at, day,
  clinic, demoUser, users, providers, patients,
  appointmentTypes, appointments,
  medicalRecords, vitals, allergies, diagnoses, prescriptions,
  insurancePayers, claims, payments,
  tasks, notifications,
  telehealthProviders, telehealthSessions, MEET_LINKS,
  offerings, medicalCodes, formTemplates, dashboardStats,
  preapprovals, denials, paymentPostings, quotes, invoices,
  pharmacies, laboratories, labOrders,
};
