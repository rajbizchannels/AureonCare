-- Seed Data for MedFlow Application
-- This file contains sample data for testing the new features
-- Run this after running migrate-enhanced.js

-- =============================================
-- TELEHEALTH SESSIONS
-- =============================================
INSERT INTO telehealth_sessions (appointment_id, patient_id, provider_id, session_status, scheduled_time, duration, meeting_url, room_id, recording_url) VALUES
(1, 1, 1, 'completed', '2025-10-20 10:00:00', 30, 'https://meet.medflow.com/room-abc123', 'room-abc123', 'https://storage.medflow.com/recordings/session1.mp4'),
(2, 2, 2, 'scheduled', '2025-10-25 14:00:00', 45, 'https://meet.medflow.com/room-def456', 'room-def456', NULL),
(3, 3, 1, 'completed', '2025-10-21 09:00:00', 30, 'https://meet.medflow.com/room-ghi789', 'room-ghi789', 'https://storage.medflow.com/recordings/session2.mp4'),
(4, 4, 3, 'scheduled', '2025-10-26 11:00:00', 60, 'https://meet.medflow.com/room-jkl012', 'room-jkl012', NULL),
(5, 5, 2, 'in-progress', '2025-10-24 15:30:00', 30, 'https://meet.medflow.com/room-mno345', 'room-mno345', NULL);

-- =============================================
-- FHIR RESOURCES
-- =============================================
-- Patient FHIR Resources
INSERT INTO fhir_resources (resource_type, resource_id, patient_id, fhir_data, version, last_updated) VALUES
('Patient', 'patient-001', 1, '{"resourceType":"Patient","id":"patient-001","name":[{"use":"official","family":"Smith","given":["John"]}],"gender":"male","birthDate":"1980-05-15"}', 'R4', CURRENT_TIMESTAMP),
('Patient', 'patient-002', 2, '{"resourceType":"Patient","id":"patient-002","name":[{"use":"official","family":"Johnson","given":["Emily"]}],"gender":"female","birthDate":"1992-08-22"}', 'R4', CURRENT_TIMESTAMP),
('Patient', 'patient-003', 3, '{"resourceType":"Patient","id":"patient-003","name":[{"use":"official","family":"Williams","given":["Michael"]}],"gender":"male","birthDate":"1975-03-10"}', 'R4', CURRENT_TIMESTAMP);

-- Observation FHIR Resources
INSERT INTO fhir_resources (resource_type, resource_id, patient_id, fhir_data, version, last_updated) VALUES
('Observation', 'obs-001', 1, '{"resourceType":"Observation","id":"obs-001","status":"final","category":[{"coding":[{"system":"http://terminology.hl7.org/CodeSystem/observation-category","code":"vital-signs"}]}],"code":{"coding":[{"system":"http://loinc.org","code":"85354-9","display":"Blood pressure"}]},"subject":{"reference":"Patient/patient-001"},"valueQuantity":{"value":120,"unit":"mmHg"}}', 'R4', CURRENT_TIMESTAMP),
('Observation', 'obs-002', 2, '{"resourceType":"Observation","id":"obs-002","status":"final","category":[{"coding":[{"system":"http://terminology.hl7.org/CodeSystem/observation-category","code":"vital-signs"}]}],"code":{"coding":[{"system":"http://loinc.org","code":"29463-7","display":"Body Weight"}]},"subject":{"reference":"Patient/patient-002"},"valueQuantity":{"value":65,"unit":"kg"}}', 'R4', CURRENT_TIMESTAMP),
('Observation', 'obs-003', 3, '{"resourceType":"Observation","id":"obs-003","status":"final","category":[{"coding":[{"system":"http://terminology.hl7.org/CodeSystem/observation-category","code":"laboratory"}]}],"code":{"coding":[{"system":"http://loinc.org","code":"2339-0","display":"Glucose"}]},"subject":{"reference":"Patient/patient-003"},"valueQuantity":{"value":95,"unit":"mg/dL"}}', 'R4', CURRENT_TIMESTAMP);

-- Condition FHIR Resources
INSERT INTO fhir_resources (resource_type, resource_id, patient_id, fhir_data, version, last_updated) VALUES
('Condition', 'cond-001', 1, '{"resourceType":"Condition","id":"cond-001","clinicalStatus":{"coding":[{"system":"http://terminology.hl7.org/CodeSystem/condition-clinical","code":"active"}]},"code":{"coding":[{"system":"http://snomed.info/sct","code":"38341003","display":"Hypertension"}]},"subject":{"reference":"Patient/patient-001"}}', 'R4', CURRENT_TIMESTAMP),
('Condition', 'cond-002', 2, '{"resourceType":"Condition","id":"cond-002","clinicalStatus":{"coding":[{"system":"http://terminology.hl7.org/CodeSystem/condition-clinical","code":"resolved"}]},"code":{"coding":[{"system":"http://snomed.info/sct","code":"195967001","display":"Asthma"}]},"subject":{"reference":"Patient/patient-002"}}', 'R4', CURRENT_TIMESTAMP);

-- =============================================
-- MEDICAL RECORDS
-- =============================================
INSERT INTO medical_records (patient_id, provider_id, visit_date, diagnosis, treatment, medications, notes, attachments) VALUES
(1, 1, '2025-10-15', 'Hypertension, Stage 1', 'Lifestyle modifications, medication management', '["Lisinopril 10mg daily"]', 'Patient presents with elevated blood pressure readings. Advised on DASH diet and regular exercise. Follow-up in 3 months.', '[]'),
(2, 2, '2025-10-18', 'Routine check-up', 'General wellness examination', '[]', 'Annual physical examination. All vitals within normal range. Recommended continued healthy lifestyle.', '[]'),
(3, 1, '2025-10-20', 'Type 2 Diabetes Mellitus', 'Diet modification, oral hypoglycemic agent', '["Metformin 500mg twice daily"]', 'Fasting glucose 140 mg/dL. HbA1c 7.2%. Initiated metformin therapy. Referred to nutritionist for diet counseling.', '["lab-report-001.pdf"]'),
(1, 1, '2025-10-22', 'Hypertension follow-up', 'Continue current medication', '["Lisinopril 10mg daily"]', 'Blood pressure improved to 135/85. Patient reports good compliance with medication and diet changes.', '[]'),
(4, 3, '2025-10-23', 'Acute upper respiratory infection', 'Symptomatic treatment, rest', '["Acetaminophen 500mg as needed", "Guaifenesin 400mg twice daily"]', 'Patient presents with cough, congestion, and mild fever. No signs of bacterial infection. Advised rest and fluids.', '[]');

-- =============================================
-- PATIENT PORTAL SESSIONS
-- =============================================
INSERT INTO patient_portal_sessions (patient_id, session_token, expires_at, last_activity) VALUES
(1, 'token-patient-1-abc123', CURRENT_TIMESTAMP + INTERVAL '7 days', CURRENT_TIMESTAMP),
(2, 'token-patient-2-def456', CURRENT_TIMESTAMP + INTERVAL '7 days', CURRENT_TIMESTAMP),
(3, 'token-patient-3-ghi789', CURRENT_TIMESTAMP + INTERVAL '7 days', CURRENT_TIMESTAMP);

-- =============================================
-- SOCIAL AUTH (Sample - for testing)
-- =============================================
INSERT INTO social_auth (user_id, provider, provider_user_id, access_token, refresh_token, profile_data) VALUES
(1, 'google', 'google-user-123456', 'sample-access-token-google', NULL, '{"email":"john.smith@example.com","name":"John Smith","picture":"https://example.com/avatar1.jpg"}'),
(2, 'microsoft', 'microsoft-user-789012', 'sample-access-token-microsoft', NULL, '{"email":"emily.johnson@example.com","name":"Emily Johnson"}'),
(3, 'facebook', 'facebook-user-345678', 'sample-access-token-facebook', NULL, '{"email":"michael.williams@example.com","name":"Michael Williams","picture":"https://example.com/avatar3.jpg"}');

-- =============================================
-- VERIFICATION QUERIES
-- =============================================
-- Run these to verify the seed data was inserted correctly:

-- Check telehealth sessions
-- SELECT ts.id, ts.session_status, ts.scheduled_time, p.first_name || ' ' || p.last_name as patient_name
-- FROM telehealth_sessions ts
-- JOIN patients p ON ts.patient_id = p.id
-- ORDER BY ts.scheduled_time DESC;

-- Check FHIR resources
-- SELECT resource_type, COUNT(*) as count
-- FROM fhir_resources
-- GROUP BY resource_type;

-- Check medical records
-- SELECT mr.id, p.first_name || ' ' || p.last_name as patient_name, mr.visit_date, mr.diagnosis
-- FROM medical_records mr
-- JOIN patients p ON mr.patient_id = p.id
-- ORDER BY mr.visit_date DESC;

-- Check patient portal sessions
-- SELECT ps.id, p.first_name || ' ' || p.last_name as patient_name, ps.expires_at
-- FROM patient_portal_sessions ps
-- JOIN patients p ON ps.patient_id = p.id;

-- Check social auth connections
-- SELECT sa.id, u.email as user_email, sa.provider, sa.provider_user_id
-- FROM social_auth sa
-- JOIN users u ON sa.user_id = u.id;
