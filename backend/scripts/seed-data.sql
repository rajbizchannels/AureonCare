-- Seed Data for AureonCare Application
-- This file contains sample data for testing the new features
-- Run this after running migrate-enhanced.js

-- =============================================
-- PRACTICES
-- =============================================
INSERT INTO practices (id, name, tax_id, phone, email, address, plan_tier) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'AureonCare Primary Care', '12-3456789', '(555) 123-4567', 'contact@aureoncarepc.com', '{"street": "123 Medical Plaza", "city": "Boston", "state": "MA", "zip": "02101"}'::jsonb, 'enterprise'),
('550e8400-e29b-41d4-a716-446655440002', 'Downtown Health Center', '98-7654321', '(555) 987-6543', 'info@downtownhealth.com', '{"street": "456 Health Ave", "city": "Boston", "state": "MA", "zip": "02102"}'::jsonb, 'professional');

-- =============================================
-- USERS (Providers/Staff)
-- =============================================
-- Password for all users: "password123" (hashed with bcrypt)
INSERT INTO users (id, email, password_hash, first_name, last_name, role, phone, specialty, license_number, status) VALUES
('650e8400-e29b-41d4-a716-446655440001', 'dr.smith@aureoncare.com', '$2a$10$YourHashedPasswordHere', 'John', 'Smith', 'physician', '(555) 111-2222', 'Family Medicine', 'MD-123456', 'active'),
('650e8400-e29b-41d4-a716-446655440002', 'dr.johnson@aureoncare.com', '$2a$10$YourHashedPasswordHere', 'Emily', 'Johnson', 'physician', '(555) 222-3333', 'Internal Medicine', 'MD-234567', 'active'),
('650e8400-e29b-41d4-a716-446655440003', 'dr.williams@aureoncare.com', '$2a$10$YourHashedPasswordHere', 'Michael', 'Williams', 'physician', '(555) 333-4444', 'Cardiology', 'MD-345678', 'active'),
('650e8400-e29b-41d4-a716-446655440004', 'admin@aureoncare.com', '$2a$10$YourHashedPasswordHere', 'Admin', 'User', 'admin', '(555) 444-5555', NULL, NULL, 'active'),
('650e8400-e29b-41d4-a716-446655440005', 'nurse.davis@aureoncare.com', '$2a$10$YourHashedPasswordHere', 'Sarah', 'Davis', 'nurse', '(555) 555-6666', 'Registered Nurse', 'RN-456789', 'active');

-- =============================================
-- PATIENTS
-- =============================================
INSERT INTO patients (id, practice_id, mrn, first_name, last_name, date_of_birth, gender, phone, email, address, status) VALUES
('750e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'MRN001', 'Robert', 'Anderson', '1980-05-15', 'male', '(555) 601-1111', 'robert.anderson@email.com', '{"street": "789 Oak St", "city": "Boston", "state": "MA", "zip": "02103"}'::jsonb, 'active'),
('750e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', 'MRN002', 'Jennifer', 'Martinez', '1992-08-22', 'female', '(555) 602-2222', 'jennifer.martinez@email.com', '{"street": "321 Pine Ave", "city": "Boston", "state": "MA", "zip": "02104"}'::jsonb, 'active'),
('750e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440001', 'MRN003', 'David', 'Taylor', '1975-03-10', 'male', '(555) 603-3333', 'david.taylor@email.com', '{"street": "654 Elm Dr", "city": "Boston", "state": "MA", "zip": "02105"}'::jsonb, 'active'),
('750e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440002', 'MRN004', 'Lisa', 'Brown', '1988-11-30', 'female', '(555) 604-4444', 'lisa.brown@email.com', '{"street": "987 Maple Ln", "city": "Boston", "state": "MA", "zip": "02106"}'::jsonb, 'active'),
('750e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440002', 'MRN005', 'James', 'Wilson', '1965-07-18', 'male', '(555) 605-5555', 'james.wilson@email.com', '{"street": "159 Cedar Ct", "city": "Boston", "state": "MA", "zip": "02107"}'::jsonb, 'active');

-- =============================================
-- APPOINTMENTS
-- =============================================
INSERT INTO appointments (id, practice_id, patient_id, provider_id, appointment_type, status, start_time, end_time, duration_minutes, reason, notes) VALUES
('850e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440001', 'telehealth', 'completed', '2025-10-20 10:00:00', '2025-10-20 10:30:00', 30, 'Follow-up consultation', 'Patient discussed ongoing treatment plan'),
('850e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440002', '650e8400-e29b-41d4-a716-446655440002', 'telehealth', 'scheduled', '2025-10-25 14:00:00', '2025-10-25 14:45:00', 45, 'Annual physical examination', NULL),
('850e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440003', '650e8400-e29b-41d4-a716-446655440001', 'telehealth', 'completed', '2025-10-21 09:00:00', '2025-10-21 09:30:00', 30, 'Diabetes management', 'Reviewed blood sugar logs'),
('850e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440002', '750e8400-e29b-41d4-a716-446655440004', '650e8400-e29b-41d4-a716-446655440003', 'telehealth', 'scheduled', '2025-10-26 11:00:00', '2025-10-26 12:00:00', 60, 'Cardiology consultation', NULL),
('850e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440002', '750e8400-e29b-41d4-a716-446655440005', '650e8400-e29b-41d4-a716-446655440002', 'telehealth', 'in-progress', '2025-10-24 15:30:00', '2025-10-24 16:00:00', 30, 'Medication review', NULL);

-- =============================================
-- TELEHEALTH SESSIONS
-- =============================================
INSERT INTO telehealth_sessions (appointment_id, patient_id, provider_id, session_status, room_id, meeting_url, start_time, end_time, duration_minutes, recording_url, recording_enabled) VALUES
('850e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440001', 'completed', 'room-abc123', 'https://meet.aureoncare.com/room-abc123', '2025-10-20 10:00:00', '2025-10-20 10:30:00', 30, 'https://storage.aureoncare.com/recordings/session1.mp4', true),
('850e8400-e29b-41d4-a716-446655440002', '750e8400-e29b-41d4-a716-446655440002', '650e8400-e29b-41d4-a716-446655440002', 'scheduled', 'room-def456', 'https://meet.aureoncare.com/room-def456', '2025-10-25 14:00:00', '2025-10-25 14:45:00', 45, NULL, false),
('850e8400-e29b-41d4-a716-446655440003', '750e8400-e29b-41d4-a716-446655440003', '650e8400-e29b-41d4-a716-446655440001', 'completed', 'room-ghi789', 'https://meet.aureoncare.com/room-ghi789', '2025-10-21 09:00:00', '2025-10-21 09:30:00', 30, 'https://storage.aureoncare.com/recordings/session2.mp4', true),
('850e8400-e29b-41d4-a716-446655440004', '750e8400-e29b-41d4-a716-446655440004', '650e8400-e29b-41d4-a716-446655440003', 'scheduled', 'room-jkl012', 'https://meet.aureoncare.com/room-jkl012', '2025-10-26 11:00:00', '2025-10-26 12:00:00', 60, NULL, false),
('850e8400-e29b-41d4-a716-446655440005', '750e8400-e29b-41d4-a716-446655440005', '650e8400-e29b-41d4-a716-446655440002', 'in-progress', 'room-mno345', 'https://meet.aureoncare.com/room-mno345', '2025-10-24 15:30:00', '2025-10-24 16:00:00', 30, NULL, true);

-- =============================================
-- FHIR RESOURCES
-- =============================================
-- Patient FHIR Resources
INSERT INTO fhir_resources (resource_type, resource_id, patient_id, fhir_version, resource_data) VALUES
('Patient', 'patient-001', '750e8400-e29b-41d4-a716-446655440001', 'R4', '{"resourceType":"Patient","id":"patient-001","name":[{"use":"official","family":"Anderson","given":["Robert"]}],"gender":"male","birthDate":"1980-05-15","telecom":[{"system":"phone","value":"(555) 601-1111"},{"system":"email","value":"robert.anderson@email.com"}]}'::jsonb),
('Patient', 'patient-002', '750e8400-e29b-41d4-a716-446655440002', 'R4', '{"resourceType":"Patient","id":"patient-002","name":[{"use":"official","family":"Martinez","given":["Jennifer"]}],"gender":"female","birthDate":"1992-08-22","telecom":[{"system":"phone","value":"(555) 602-2222"},{"system":"email","value":"jennifer.martinez@email.com"}]}'::jsonb),
('Patient', 'patient-003', '750e8400-e29b-41d4-a716-446655440003', 'R4', '{"resourceType":"Patient","id":"patient-003","name":[{"use":"official","family":"Taylor","given":["David"]}],"gender":"male","birthDate":"1975-03-10","telecom":[{"system":"phone","value":"(555) 603-3333"},{"system":"email","value":"david.taylor@email.com"}]}'::jsonb);

-- Observation FHIR Resources
INSERT INTO fhir_resources (resource_type, resource_id, patient_id, fhir_version, resource_data) VALUES
('Observation', 'obs-001', '750e8400-e29b-41d4-a716-446655440001', 'R4', '{"resourceType":"Observation","id":"obs-001","status":"final","category":[{"coding":[{"system":"http://terminology.hl7.org/CodeSystem/observation-category","code":"vital-signs"}]}],"code":{"coding":[{"system":"http://loinc.org","code":"85354-9","display":"Blood pressure"}]},"subject":{"reference":"Patient/patient-001"},"effectiveDateTime":"2025-10-20T10:00:00Z","valueQuantity":{"value":135,"unit":"mmHg","system":"http://unitsofmeasure.org","code":"mm[Hg]"}}'::jsonb),
('Observation', 'obs-002', '750e8400-e29b-41d4-a716-446655440002', 'R4', '{"resourceType":"Observation","id":"obs-002","status":"final","category":[{"coding":[{"system":"http://terminology.hl7.org/CodeSystem/observation-category","code":"vital-signs"}]}],"code":{"coding":[{"system":"http://loinc.org","code":"29463-7","display":"Body Weight"}]},"subject":{"reference":"Patient/patient-002"},"effectiveDateTime":"2025-10-18T14:00:00Z","valueQuantity":{"value":65,"unit":"kg","system":"http://unitsofmeasure.org","code":"kg"}}'::jsonb),
('Observation', 'obs-003', '750e8400-e29b-41d4-a716-446655440003', 'R4', '{"resourceType":"Observation","id":"obs-003","status":"final","category":[{"coding":[{"system":"http://terminology.hl7.org/CodeSystem/observation-category","code":"laboratory"}]}],"code":{"coding":[{"system":"http://loinc.org","code":"2339-0","display":"Glucose"}]},"subject":{"reference":"Patient/patient-003"},"effectiveDateTime":"2025-10-21T09:00:00Z","valueQuantity":{"value":145,"unit":"mg/dL","system":"http://unitsofmeasure.org","code":"mg/dL"}}'::jsonb);

-- Condition FHIR Resources
INSERT INTO fhir_resources (resource_type, resource_id, patient_id, fhir_version, resource_data) VALUES
('Condition', 'cond-001', '750e8400-e29b-41d4-a716-446655440001', 'R4', '{"resourceType":"Condition","id":"cond-001","clinicalStatus":{"coding":[{"system":"http://terminology.hl7.org/CodeSystem/condition-clinical","code":"active"}]},"verificationStatus":{"coding":[{"system":"http://terminology.hl7.org/CodeSystem/condition-ver-status","code":"confirmed"}]},"code":{"coding":[{"system":"http://snomed.info/sct","code":"38341003","display":"Hypertension"}]},"subject":{"reference":"Patient/patient-001"},"onsetDateTime":"2020-03-15T00:00:00Z"}'::jsonb),
('Condition', 'cond-002', '750e8400-e29b-41d4-a716-446655440003', 'R4', '{"resourceType":"Condition","id":"cond-002","clinicalStatus":{"coding":[{"system":"http://terminology.hl7.org/CodeSystem/condition-clinical","code":"active"}]},"verificationStatus":{"coding":[{"system":"http://terminology.hl7.org/CodeSystem/condition-ver-status","code":"confirmed"}]},"code":{"coding":[{"system":"http://snomed.info/sct","code":"44054006","display":"Type 2 Diabetes Mellitus"}]},"subject":{"reference":"Patient/patient-003"},"onsetDateTime":"2018-07-10T00:00:00Z"}'::jsonb);

-- =============================================
-- MEDICAL RECORDS
-- =============================================
INSERT INTO medical_records (patient_id, provider_id, record_type, record_date, title, description, diagnosis, treatment, medications, attachments) VALUES
('750e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440001', 'office-visit', '2025-10-15', 'Hypertension Follow-up', 'Patient presents for routine blood pressure check and medication review', 'Hypertension, Stage 1 (Essential)', 'Lifestyle modifications, medication management. Advised DASH diet and regular exercise.', '["Lisinopril 10mg daily", "Aspirin 81mg daily"]'::jsonb, '[]'::jsonb),
('750e8400-e29b-41d4-a716-446655440002', '650e8400-e29b-41d4-a716-446655440002', 'annual-physical', '2025-10-18', 'Annual Physical Examination', 'Comprehensive health assessment and wellness check', 'No acute findings', 'General wellness examination. All vitals within normal range. Continue healthy lifestyle.', '[]'::jsonb, '[]'::jsonb),
('750e8400-e29b-41d4-a716-446655440003', '650e8400-e29b-41d4-a716-446655440001', 'office-visit', '2025-10-20', 'Diabetes Management Visit', 'Quarterly diabetes follow-up with lab review', 'Type 2 Diabetes Mellitus, controlled', 'Diet modification, oral hypoglycemic agent. Fasting glucose 145 mg/dL. HbA1c 7.2%. Medication adjusted.', '["Metformin 500mg twice daily", "Glipizide 5mg daily"]'::jsonb, '["lab-report-001.pdf"]'::jsonb),
('750e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440001', 'follow-up', '2025-10-22', 'Blood Pressure Follow-up', 'Two-week follow-up after medication adjustment', 'Hypertension, improving', 'Blood pressure improved to 135/85. Patient reports good compliance with medication and diet changes. Continue current regimen.', '["Lisinopril 10mg daily", "Aspirin 81mg daily"]'::jsonb, '[]'::jsonb),
('750e8400-e29b-41d4-a716-446655440004', '650e8400-e29b-41d4-a716-446655440003', 'office-visit', '2025-10-23', 'Cardiology Consultation', 'New patient evaluation for palpitations', 'Premature Ventricular Contractions (PVCs), benign', 'Patient presents with occasional palpitations. EKG shows benign PVCs. Advised lifestyle modifications and stress reduction. Follow-up in 3 months.', '["Magnesium supplement 400mg daily"]'::jsonb, '["ekg-report-001.pdf"]'::jsonb);

-- =============================================
-- PATIENT PORTAL SESSIONS
-- =============================================
INSERT INTO patient_portal_sessions (patient_id, session_token, ip_address, user_agent, expires_at) VALUES
('750e8400-e29b-41d4-a716-446655440001', 'token-patient-1-abc123def456ghi789', '192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', CURRENT_TIMESTAMP + INTERVAL '7 days'),
('750e8400-e29b-41d4-a716-446655440002', 'token-patient-2-jkl012mno345pqr678', '192.168.1.101', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', CURRENT_TIMESTAMP + INTERVAL '7 days'),
('750e8400-e29b-41d4-a716-446655440003', 'token-patient-3-stu901vwx234yz5678', '192.168.1.102', 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)', CURRENT_TIMESTAMP + INTERVAL '7 days');

-- =============================================
-- SOCIAL AUTH (Sample - for testing)
-- =============================================
INSERT INTO social_auth (user_id, provider, provider_user_id, access_token, profile_data) VALUES
('650e8400-e29b-41d4-a716-446655440001', 'google', 'google-user-123456789', 'sample-access-token-google-xyz', '{"email":"dr.smith@aureoncare.com","name":"John Smith","picture":"https://example.com/avatar1.jpg"}'::jsonb),
('650e8400-e29b-41d4-a716-446655440002', 'microsoft', 'microsoft-user-987654321', 'sample-access-token-microsoft-abc', '{"email":"dr.johnson@aureoncare.com","name":"Emily Johnson"}'::jsonb),
('650e8400-e29b-41d4-a716-446655440003', 'facebook', 'facebook-user-456789012', 'sample-access-token-facebook-def', '{"email":"dr.williams@aureoncare.com","name":"Michael Williams","picture":"https://example.com/avatar3.jpg"}'::jsonb);

-- =============================================
-- VERIFICATION QUERIES
-- =============================================
-- Run these to verify the seed data was inserted correctly:

-- Check practices
SELECT COUNT(*) as practices_count FROM practices;

-- Check users
SELECT COUNT(*) as users_count FROM users;

-- Check patients
SELECT COUNT(*) as patients_count FROM patients;

-- Check appointments
SELECT COUNT(*) as appointments_count FROM appointments;

-- Check telehealth sessions
SELECT ts.session_status, COUNT(*) as count
FROM telehealth_sessions ts
GROUP BY ts.session_status
ORDER BY ts.session_status;

-- Check FHIR resources
SELECT resource_type, COUNT(*) as count
FROM fhir_resources
GROUP BY resource_type
ORDER BY resource_type;

-- Check medical records
SELECT record_type, COUNT(*) as count
FROM medical_records
GROUP BY record_type
ORDER BY record_type;

-- Check patient portal sessions
SELECT COUNT(*) as portal_sessions_count FROM patient_portal_sessions;

-- Check social auth connections
SELECT provider, COUNT(*) as count
FROM social_auth
GROUP BY provider
ORDER BY provider;

-- Display summary
SELECT
  (SELECT COUNT(*) FROM practices) as practices,
  (SELECT COUNT(*) FROM users) as users,
  (SELECT COUNT(*) FROM patients) as patients,
  (SELECT COUNT(*) FROM appointments) as appointments,
  (SELECT COUNT(*) FROM telehealth_sessions) as telehealth_sessions,
  (SELECT COUNT(*) FROM fhir_resources) as fhir_resources,
  (SELECT COUNT(*) FROM medical_records) as medical_records,
  (SELECT COUNT(*) FROM patient_portal_sessions) as portal_sessions,
  (SELECT COUNT(*) FROM social_auth) as social_auth_connections;
