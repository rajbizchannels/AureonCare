-- MedFlow Database Reset and Seed Script (Simple Schema Compatible)
-- Works with basic schema without all UUID relationships
-- Compatible with original schema.sql

-- ================================================
-- PART 1: DELETE ALL DATA FROM TABLES
-- ================================================

-- Delete in safe order (check which tables exist first)
DELETE FROM social_auth WHERE true;
DELETE FROM patient_portal_sessions WHERE true;
DELETE FROM fhir_resources WHERE true;
DELETE FROM telehealth_sessions WHERE true;
DELETE FROM medical_records WHERE true;
DELETE FROM diagnosis WHERE true;
DELETE FROM prescriptions WHERE true;
DELETE FROM payments WHERE true;
DELETE FROM claims WHERE true;
DELETE FROM appointments WHERE true;
DELETE FROM notifications WHERE true;
DELETE FROM tasks WHERE true;
DELETE FROM patients WHERE true;
DELETE FROM users WHERE true;
DELETE FROM practices WHERE true;

-- ================================================
-- PART 2: INSERT FRESH TEST DATA
-- ================================================

-- Insert Practices
INSERT INTO practices (id, name, tax_id, phone, email, address, plan_tier) VALUES
(
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Central Medical Group',
  '12-3456789',
  '(555) 100-2000',
  'contact@centralmedical.com',
  '{"street": "123 Medical Plaza", "city": "San Francisco", "state": "CA", "zip": "94105"}'::jsonb,
  'enterprise'
),
(
  '00000000-0000-0000-0000-000000000002'::uuid,
  'Riverside Family Practice',
  '98-7654321',
  '(555) 200-3000',
  'info@riversidefp.com',
  '{"street": "456 River Road", "city": "Portland", "state": "OR", "zip": "97201"}'::jsonb,
  'professional'
) ON CONFLICT DO NOTHING;

-- Insert Users (Healthcare Staff)
INSERT INTO users (id, email, password_hash, first_name, last_name, role, phone, status, avatar, specialty, license_number) VALUES
(
  '10000000-0000-0000-0000-000000000001'::uuid,
  'sarah.chen@medflow.com',
  '$2a$10$8K1p/a0dL3LPkX0EZ7Y5COoIKqGlWh0YGvY8WxE/qR3Y5X0Y5X0Y5',
  'Sarah',
  'Chen',
  'admin',
  '(555) 101-0001',
  'active',
  'SC',
  'Family Medicine',
  'MD-123456'
),
(
  '10000000-0000-0000-0000-000000000002'::uuid,
  'james.wilson@medflow.com',
  '$2a$10$8K1p/a0dL3LPkX0EZ7Y5COoIKqGlWh0YGvY8WxE/qR3Y5X0Y5X0Y5',
  'James',
  'Wilson',
  'doctor',
  '(555) 101-0002',
  'active',
  'JW',
  'Internal Medicine',
  'MD-234567'
),
(
  '10000000-0000-0000-0000-000000000003'::uuid,
  'emily.rodriguez@medflow.com',
  '$2a$10$8K1p/a0dL3LPkX0EZ7Y5COoIKqGlWh0YGvY8WxE/qR3Y5X0Y5X0Y5',
  'Emily',
  'Rodriguez',
  'doctor',
  '(555) 101-0003',
  'active',
  'ER',
  'Pediatrics',
  'MD-345678'
) ON CONFLICT DO NOTHING;

-- Insert Patients (with portal access enabled)
INSERT INTO patients (
  id, practice_id, mrn, first_name, last_name, date_of_birth, gender, phone, email,
  address, emergency_contact, insurance_info, status, portal_enabled, portal_password_hash,
  height, weight, blood_type, allergies, past_history, family_history, current_medications
) VALUES
(
  '20000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  'MRN-001001',
  'John',
  'Smith',
  '1985-03-15',
  'Male',
  '(555) 201-0001',
  'john.smith@email.com',
  '{"street": "789 Oak Street", "city": "San Francisco", "state": "CA", "zip": "94102"}'::jsonb,
  '{"name": "Jane Smith", "relationship": "Spouse", "phone": "(555) 201-0002"}'::jsonb,
  '{"provider": "Blue Cross", "policy_number": "BC-123456789", "group_number": "GRP-001"}'::jsonb,
  'active',
  true,
  '$2a$10$8K1p/a0dL3LPkX0EZ7Y5COoIKqGlWh0YGvY8WxE/qR3Y5X0Y5X0Y5',
  '5''10"',
  '175 lbs',
  'O+',
  'Penicillin',
  'Appendectomy (2010)',
  'Father: Type 2 Diabetes, Mother: Hypertension',
  'Lisinopril 10mg daily'
),
(
  '20000000-0000-0000-0000-000000000002'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  'MRN-001002',
  'Maria',
  'Garcia',
  '1990-07-22',
  'Female',
  '(555) 201-0003',
  'maria.garcia@email.com',
  '{"street": "456 Elm Avenue", "city": "San Francisco", "state": "CA", "zip": "94103"}'::jsonb,
  '{"name": "Carlos Garcia", "relationship": "Brother", "phone": "(555) 201-0004"}'::jsonb,
  '{"provider": "Aetna", "policy_number": "AET-987654321", "group_number": "GRP-002"}'::jsonb,
  'active',
  true,
  '$2a$10$8K1p/a0dL3LPkX0EZ7Y5COoIKqGlWh0YGvY8WxE/qR3Y5X0Y5X0Y5',
  '5''6"',
  '140 lbs',
  'A+',
  'Shellfish, Latex',
  'Asthma (childhood)',
  'Mother: Breast Cancer, Father: Heart Disease',
  'Albuterol inhaler as needed'
),
(
  '20000000-0000-0000-0000-000000000003'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  'MRN-001003',
  'Robert',
  'Johnson',
  '1975-11-30',
  'Male',
  '(555) 201-0005',
  'robert.johnson@email.com',
  '{"street": "321 Pine Street", "city": "San Francisco", "state": "CA", "zip": "94104"}'::jsonb,
  '{"name": "Linda Johnson", "relationship": "Wife", "phone": "(555) 201-0006"}'::jsonb,
  '{"provider": "United Healthcare", "policy_number": "UHC-456789123", "group_number": "GRP-003"}'::jsonb,
  'active',
  true,
  '$2a$10$8K1p/a0dL3LPkX0EZ7Y5COoIKqGlWh0YGvY8WxE/qR3Y5X0Y5X0Y5',
  '6''1"',
  '195 lbs',
  'B+',
  'None known',
  'Hypertension, High Cholesterol',
  'Father: Stroke, Mother: Diabetes',
  'Atorvastatin 20mg daily, Metoprolol 50mg twice daily'
) ON CONFLICT DO NOTHING;

-- Insert Appointments
INSERT INTO appointments (
  id, practice_id, patient_id, provider_id, appointment_type, status,
  start_time, end_time, duration_minutes, reason, notes
) VALUES
(
  '30000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  '20000000-0000-0000-0000-000000000001'::uuid,
  '10000000-0000-0000-0000-000000000001'::uuid,
  'General Consultation',
  'scheduled',
  '2025-11-10 10:00:00',
  '2025-11-10 10:30:00',
  30,
  'Annual physical examination',
  'Patient requested early morning appointment'
),
(
  '30000000-0000-0000-0000-000000000002'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  '20000000-0000-0000-0000-000000000002'::uuid,
  '10000000-0000-0000-0000-000000000002'::uuid,
  'Follow-up',
  'scheduled',
  '2025-11-08 14:00:00',
  '2025-11-08 14:30:00',
  30,
  'Asthma follow-up',
  'Review recent inhaler usage'
) ON CONFLICT DO NOTHING;

-- Insert Prescriptions (if table exists)
INSERT INTO prescriptions (
  id, patient_id, provider_id, medication_name,
  dosage, frequency, duration, instructions, refills, status, prescribed_date
) VALUES
(
  '50000000-0000-0000-0000-000000000001'::uuid,
  '20000000-0000-0000-0000-000000000001'::uuid,
  '10000000-0000-0000-0000-000000000001'::uuid,
  'Lisinopril',
  '10mg',
  'Once daily',
  '90 days',
  'Take in the morning with or without food',
  3,
  'Active',
  '2025-10-01'
) ON CONFLICT DO NOTHING;

-- Insert Tasks (without user_id if column doesn't exist)
INSERT INTO tasks (title, description, priority, status, due_date) VALUES
('Review lab results for John Smith', 'Check cholesterol levels from recent blood work', 'high', 'pending', '2025-11-06'),
('Call Maria Garcia about test results', 'Discuss asthma control test results', 'medium', 'pending', '2025-11-07'),
('Update patient records', 'Enter new insurance information', 'medium', 'pending', '2025-11-05')
ON CONFLICT DO NOTHING;

-- Insert Notifications (without user_id if column doesn't exist)
INSERT INTO notifications (type, message, read) VALUES
('appointment', 'New appointment scheduled with John Smith for Nov 10 at 10:00 AM', false),
('lab_result', 'Lab results available for Maria Garcia', false),
('system', 'Database reset completed with fresh test data', false)
ON CONFLICT DO NOTHING;

-- ================================================
-- SUMMARY
-- ================================================

DO $$
DECLARE
  practices_count INTEGER;
  users_count INTEGER;
  patients_count INTEGER;
  appointments_count INTEGER;
  tasks_count INTEGER;
  notifications_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO practices_count FROM practices;
  SELECT COUNT(*) INTO users_count FROM users;
  SELECT COUNT(*) INTO patients_count FROM patients;
  SELECT COUNT(*) INTO appointments_count FROM appointments;
  SELECT COUNT(*) INTO tasks_count FROM tasks;
  SELECT COUNT(*) INTO notifications_count FROM notifications;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'DATABASE RESET AND SEED COMPLETED';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Data Summary:';
  RAISE NOTICE '  Practices: %', practices_count;
  RAISE NOTICE '  Users (Staff): %', users_count;
  RAISE NOTICE '  Patients: %', patients_count;
  RAISE NOTICE '  Appointments: %', appointments_count;
  RAISE NOTICE '  Tasks: %', tasks_count;
  RAISE NOTICE '  Notifications: %', notifications_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Test Credentials:';
  RAISE NOTICE '  Admin: sarah.chen@medflow.com / password123';
  RAISE NOTICE '  Patient Portal: john.smith@email.com / password123';
  RAISE NOTICE '  Patient Portal: maria.garcia@email.com / password123';
  RAISE NOTICE '  Patient Portal: robert.johnson@email.com / password123';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $$;
