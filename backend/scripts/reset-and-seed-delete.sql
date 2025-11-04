-- MedFlow Database Reset and Seed Script (Using DELETE)
-- This version uses DELETE instead of TRUNCATE and works with basic permissions
-- Compatible with UUID-based schema

-- ================================================
-- PART 1: DELETE ALL DATA FROM TABLES
-- ================================================
-- Using DELETE instead of TRUNCATE (requires less privileges)
-- Delete in dependency order (children first, parents last)

DELETE FROM social_auth;
DELETE FROM patient_portal_sessions;
DELETE FROM fhir_resources;
DELETE FROM telehealth_sessions;
DELETE FROM medical_records;
DELETE FROM diagnosis;
DELETE FROM prescriptions;
DELETE FROM payments;
DELETE FROM claims;
DELETE FROM appointments;
DELETE FROM notifications;
DELETE FROM tasks;
DELETE FROM patients;
DELETE FROM users;
DELETE FROM practices;

-- ================================================
-- PART 2: INSERT FRESH TEST DATA
-- ================================================

-- Insert Practices
INSERT INTO practices (id, name, tax_id, phone, email, address, plan_tier) VALUES
(
  '00000000-0000-0000-0000-000000000001',
  'Central Medical Group',
  '12-3456789',
  '(555) 100-2000',
  'contact@centralmedical.com',
  '{"street": "123 Medical Plaza", "city": "San Francisco", "state": "CA", "zip": "94105"}'::jsonb,
  'enterprise'
),
(
  '00000000-0000-0000-0000-000000000002',
  'Riverside Family Practice',
  '98-7654321',
  '(555) 200-3000',
  'info@riversidefp.com',
  '{"street": "456 River Road", "city": "Portland", "state": "OR", "zip": "97201"}'::jsonb,
  'professional'
);

-- Insert Users (Healthcare Staff)
INSERT INTO users (id, email, password_hash, first_name, last_name, role, phone, status, avatar, specialty, license_number) VALUES
-- Admin/Doctors
(
  '10000000-0000-0000-0000-000000000001',
  'sarah.chen@medflow.com',
  '$2a$10$8K1p/a0dL3LPkX0EZ7Y5COoIKqGlWh0YGvY8WxE/qR3Y5X0Y5X0Y5', -- password: 'password123'
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
  '10000000-0000-0000-0000-000000000002',
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
  '10000000-0000-0000-0000-000000000003',
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
),
-- Nurses
(
  '10000000-0000-0000-0000-000000000004',
  'michael.brown@medflow.com',
  '$2a$10$8K1p/a0dL3LPkX0EZ7Y5COoIKqGlWh0YGvY8WxE/qR3Y5X0Y5X0Y5',
  'Michael',
  'Brown',
  'nurse',
  '(555) 101-0004',
  'active',
  'MB',
  'Registered Nurse',
  'RN-456789'
),
-- Reception
(
  '10000000-0000-0000-0000-000000000005',
  'lisa.anderson@medflow.com',
  '$2a$10$8K1p/a0dL3LPkX0EZ7Y5COoIKqGlWh0YGvY8WxE/qR3Y5X0Y5X0Y5',
  'Lisa',
  'Anderson',
  'reception',
  '(555) 101-0005',
  'active',
  'LA',
  NULL,
  NULL
);

-- Insert Patients (with portal access enabled)
INSERT INTO patients (
  id, practice_id, mrn, first_name, last_name, date_of_birth, gender, phone, email,
  address, emergency_contact, insurance_info, status, portal_enabled, portal_password_hash,
  height, weight, blood_type, allergies, past_history, family_history, current_medications
) VALUES
(
  '20000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
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
  '$2a$10$8K1p/a0dL3LPkX0EZ7Y5COoIKqGlWh0YGvY8WxE/qR3Y5X0Y5X0Y5', -- password: 'password123'
  '5''10"',
  '175 lbs',
  'O+',
  'Penicillin',
  'Appendectomy (2010)',
  'Father: Type 2 Diabetes, Mother: Hypertension',
  'Lisinopril 10mg daily'
),
(
  '20000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
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
  '20000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000001',
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
),
(
  '20000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000002',
  'MRN-002001',
  'Emily',
  'Davis',
  '2015-05-10',
  'Female',
  '(555) 201-0007',
  'parent.davis@email.com',
  '{"street": "654 Maple Drive", "city": "Portland", "state": "OR", "zip": "97202"}'::jsonb,
  '{"name": "David Davis", "relationship": "Father", "phone": "(555) 201-0008"}'::jsonb,
  '{"provider": "Kaiser Permanente", "policy_number": "KP-789456123", "group_number": "GRP-004"}'::jsonb,
  'active',
  true,
  '$2a$10$8K1p/a0dL3LPkX0EZ7Y5COoIKqGlWh0YGvY8WxE/qR3Y5X0Y5X0Y5',
  '4''8"',
  '70 lbs',
  'AB+',
  'Peanuts',
  'Vaccinations up to date',
  'No significant family history',
  'EpiPen (emergency use only)'
),
(
  '20000000-0000-0000-0000-000000000005',
  '00000000-0000-0000-0000-000000000001',
  'MRN-001004',
  'David',
  'Lee',
  '1988-02-14',
  'Male',
  '(555) 201-0009',
  'david.lee@email.com',
  '{"street": "987 Cedar Lane", "city": "San Francisco", "state": "CA", "zip": "94105"}'::jsonb,
  '{"name": "Sarah Lee", "relationship": "Sister", "phone": "(555) 201-0010"}'::jsonb,
  '{"provider": "Cigna", "policy_number": "CIG-321654987", "group_number": "GRP-005"}'::jsonb,
  'active',
  true,
  '$2a$10$8K1p/a0dL3LPkX0EZ7Y5COoIKqGlWh0YGvY8WxE/qR3Y5X0Y5X0Y5',
  '5''9"',
  '160 lbs',
  'O-',
  'Sulfa drugs',
  'Type 1 Diabetes',
  'Father: Type 1 Diabetes',
  'Insulin pump therapy'
);

-- Insert Appointments
INSERT INTO appointments (
  id, practice_id, patient_id, provider_id, appointment_type, status,
  start_time, end_time, duration_minutes, reason, notes
) VALUES
-- Future appointments
(
  '30000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'General Consultation',
  'scheduled',
  '2025-11-10 10:00:00',
  '2025-11-10 10:30:00',
  30,
  'Annual physical examination',
  'Patient requested early morning appointment'
),
(
  '30000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000002',
  'Follow-up',
  'scheduled',
  '2025-11-08 14:00:00',
  '2025-11-08 14:30:00',
  30,
  'Asthma follow-up',
  'Review recent inhaler usage'
),
(
  '30000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000001',
  'Check-up',
  'scheduled',
  '2025-11-12 09:00:00',
  '2025-11-12 09:30:00',
  30,
  'Blood pressure check',
  'Monitor hypertension medication effectiveness'
),
-- Past appointments
(
  '30000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000004',
  '10000000-0000-0000-0000-000000000003',
  'Check-up',
  'completed',
  '2025-10-15 11:00:00',
  '2025-10-15 11:30:00',
  30,
  'Well-child visit',
  'Height and weight recorded. Vaccines administered.'
),
(
  '30000000-0000-0000-0000-000000000005',
  '00000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000005',
  '10000000-0000-0000-0000-000000000002',
  'Follow-up',
  'completed',
  '2025-10-20 15:30:00',
  '2025-10-20 16:00:00',
  30,
  'Diabetes management',
  'Blood sugar levels reviewed. Insulin dosage adjusted.'
);

-- Insert Medical Records
INSERT INTO medical_records (
  id, patient_id, provider_id, record_type, record_date,
  title, description, diagnosis, treatment, medications
) VALUES
(
  '40000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'Physical Exam',
  '2025-10-01',
  'Annual Physical Examination',
  'Complete physical examination with lab work',
  'Mild hypertension',
  'Lifestyle modifications and medication',
  '{"medications": [{"name": "Lisinopril", "dosage": "10mg", "frequency": "Daily"}]}'::jsonb
),
(
  '40000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000002',
  'Consultation',
  '2025-09-15',
  'Asthma Evaluation',
  'Patient presents with increased asthma symptoms',
  'Moderate persistent asthma',
  'Increased inhaler frequency, added controller medication',
  '{"medications": [{"name": "Albuterol", "dosage": "90mcg", "frequency": "As needed"}]}'::jsonb
),
(
  '40000000-0000-0000-0000-000000000003',
  '20000000-0000-0000-0000-000000000005',
  '10000000-0000-0000-0000-000000000002',
  'Follow-up',
  '2025-10-20',
  'Diabetes Follow-up',
  'Review of blood glucose logs and A1C results',
  'Type 1 Diabetes Mellitus - well controlled',
  'Continue current insulin regimen',
  '{"medications": [{"name": "Insulin Aspart", "dosage": "Variable", "frequency": "With meals"}]}'::jsonb
);

-- Insert Prescriptions
INSERT INTO prescriptions (
  id, patient_id, provider_id, appointment_id, medication_name,
  dosage, frequency, duration, instructions, refills, status, prescribed_date
) VALUES
(
  '50000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  NULL,
  'Lisinopril',
  '10mg',
  'Once daily',
  '90 days',
  'Take in the morning with or without food',
  3,
  'Active',
  '2025-10-01'
),
(
  '50000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000002',
  '30000000-0000-0000-0000-000000000002',
  'Albuterol Inhaler',
  '90mcg',
  'As needed',
  '30 days',
  'Use 2 puffs every 4-6 hours as needed for wheezing',
  5,
  'Active',
  '2025-09-15'
),
(
  '50000000-0000-0000-0000-000000000003',
  '20000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000001',
  NULL,
  'Atorvastatin',
  '20mg',
  'Once daily',
  '90 days',
  'Take in the evening with or without food',
  3,
  'Active',
  '2025-08-01'
),
(
  '50000000-0000-0000-0000-000000000004',
  '20000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000001',
  NULL,
  'Metoprolol',
  '50mg',
  'Twice daily',
  '90 days',
  'Take morning and evening with food',
  3,
  'Active',
  '2025-08-01'
);

-- Insert Diagnosis
INSERT INTO diagnosis (
  id, patient_id, provider_id, appointment_id, diagnosis_code,
  diagnosis_name, description, severity, status, diagnosed_date, notes
) VALUES
(
  '60000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  NULL,
  'I10',
  'Essential Hypertension',
  'Primary hypertension without known secondary cause',
  'Mild',
  'Active',
  '2025-10-01',
  'Blood pressure controlled with medication'
),
(
  '60000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000002',
  NULL,
  'J45.40',
  'Moderate Persistent Asthma',
  'Asthma with daily symptoms requiring controller medication',
  'Moderate',
  'Active',
  '2025-09-15',
  'Triggered by seasonal allergies and exercise'
),
(
  '60000000-0000-0000-0000-000000000003',
  '20000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000001',
  NULL,
  'E78.5',
  'Hyperlipidemia',
  'Elevated cholesterol levels',
  'Moderate',
  'Active',
  '2025-08-01',
  'Responding well to statin therapy'
),
(
  '60000000-0000-0000-0000-000000000004',
  '20000000-0000-0000-0000-000000000005',
  '10000000-0000-0000-0000-000000000002',
  NULL,
  'E10.9',
  'Type 1 Diabetes Mellitus',
  'Insulin-dependent diabetes diagnosed in childhood',
  'Moderate',
  'Active',
  '2015-06-01',
  'Using insulin pump. HbA1c maintained at 7.2%'
);

-- Insert Claims
INSERT INTO claims (
  id, practice_id, patient_id, claim_number, payer, service_date,
  amount, status, diagnosis_codes, procedure_codes, notes
) VALUES
(
  '70000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'CLM-2025-001001',
  'Blue Cross',
  '2025-10-01',
  250.00,
  'approved',
  ARRAY['I10'],
  ARRAY['99213'],
  'Annual physical exam - claim approved'
),
(
  '70000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000002',
  'CLM-2025-001002',
  'Aetna',
  '2025-09-15',
  180.00,
  'pending',
  ARRAY['J45.40'],
  ARRAY['99214'],
  'Asthma consultation - awaiting approval'
),
(
  '70000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000003',
  'CLM-2025-001003',
  'United Healthcare',
  '2025-08-15',
  300.00,
  'approved',
  ARRAY['I10', 'E78.5'],
  ARRAY['99215'],
  'Comprehensive exam with lab work'
);

-- Insert Payments
INSERT INTO payments (
  payment_number, patient_id, claim_id, amount, payment_method,
  payment_status, transaction_id, card_last_four, card_brand, payment_date, description
) VALUES
(
  'PAY-2025-001001',
  '20000000-0000-0000-0000-000000000001',
  '70000000-0000-0000-0000-000000000001',
  35.00,
  'credit_card',
  'completed',
  'ch_3abc123xyz',
  '4242',
  'Visa',
  '2025-10-02 14:30:00',
  'Co-payment for annual physical'
),
(
  'PAY-2025-001002',
  '20000000-0000-0000-0000-000000000002',
  NULL,
  50.00,
  'debit_card',
  'completed',
  'ch_3def456uvw',
  '5555',
  'Mastercard',
  '2025-09-16 10:15:00',
  'Payment for asthma consultation'
),
(
  'PAY-2025-001003',
  '20000000-0000-0000-0000-000000000003',
  '70000000-0000-0000-0000-000000000003',
  50.00,
  'credit_card',
  'completed',
  'ch_3ghi789rst',
  '4111',
  'Visa',
  '2025-08-16 16:45:00',
  'Co-payment for comprehensive exam'
);

-- Insert Tasks
INSERT INTO tasks (
  id, user_id, title, description, priority, status, due_date
) VALUES
(
  '80000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'Review lab results for John Smith',
  'Check cholesterol levels from recent blood work',
  'high',
  'pending',
  '2025-11-06'
),
(
  '80000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000002',
  'Call Maria Garcia about test results',
  'Discuss asthma control test results',
  'medium',
  'pending',
  '2025-11-07'
),
(
  '80000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000003',
  'Schedule follow-up for Emily Davis',
  'Pediatric well-child visit in 6 months',
  'low',
  'completed',
  '2025-10-25'
),
(
  '80000000-0000-0000-0000-000000000004',
  '10000000-0000-0000-0000-000000000005',
  'Update patient records',
  'Enter new insurance information for 5 patients',
  'medium',
  'in_progress',
  '2025-11-05'
);

-- Insert Notifications
INSERT INTO notifications (id, user_id, type, message, read) VALUES
(
  '90000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'appointment',
  'New appointment scheduled with John Smith for Nov 10 at 10:00 AM',
  false
),
(
  '90000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000002',
  'lab_result',
  'Lab results available for Maria Garcia',
  false
),
(
  '90000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000001',
  'task',
  'Task due tomorrow: Review lab results for John Smith',
  false
),
(
  '90000000-0000-0000-0000-000000000004',
  '10000000-0000-0000-0000-000000000005',
  'system',
  'System maintenance scheduled for Nov 15 at 2:00 AM',
  true
);

-- ================================================
-- SUMMARY
-- ================================================

DO $$
DECLARE
  practices_count INTEGER;
  users_count INTEGER;
  patients_count INTEGER;
  appointments_count INTEGER;
  prescriptions_count INTEGER;
  diagnosis_count INTEGER;
  claims_count INTEGER;
  payments_count INTEGER;
  tasks_count INTEGER;
  notifications_count INTEGER;
  medical_records_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO practices_count FROM practices;
  SELECT COUNT(*) INTO users_count FROM users;
  SELECT COUNT(*) INTO patients_count FROM patients;
  SELECT COUNT(*) INTO appointments_count FROM appointments;
  SELECT COUNT(*) INTO prescriptions_count FROM prescriptions;
  SELECT COUNT(*) INTO diagnosis_count FROM diagnosis;
  SELECT COUNT(*) INTO claims_count FROM claims;
  SELECT COUNT(*) INTO payments_count FROM payments;
  SELECT COUNT(*) INTO tasks_count FROM tasks;
  SELECT COUNT(*) INTO notifications_count FROM notifications;
  SELECT COUNT(*) INTO medical_records_count FROM medical_records;

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
  RAISE NOTICE '  Medical Records: %', medical_records_count;
  RAISE NOTICE '  Prescriptions: %', prescriptions_count;
  RAISE NOTICE '  Diagnoses: %', diagnosis_count;
  RAISE NOTICE '  Claims: %', claims_count;
  RAISE NOTICE '  Payments: %', payments_count;
  RAISE NOTICE '  Tasks: %', tasks_count;
  RAISE NOTICE '  Notifications: %', notifications_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Test Credentials:';
  RAISE NOTICE '  Admin: sarah.chen@medflow.com / password123';
  RAISE NOTICE '  Patient Portal: john.smith@email.com / password123';
  RAISE NOTICE '  Patient Portal: maria.garcia@email.com / password123';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $$;
