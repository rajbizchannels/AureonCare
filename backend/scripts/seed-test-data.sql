-- ============================================================================
-- SEED TEST DATA - INSERT IN CORRECT SEQUENCE
-- ============================================================================
-- This script seeds the database with test data in the correct order
-- to respect foreign key constraints.
-- Run AFTER reset-database.sql and migrations.

BEGIN;

-- ============================================================================
-- 1. CREATE USERS (Parent table - no dependencies)
-- ============================================================================

-- Admin User
INSERT INTO users (id, email, password_hash, role, first_name, last_name, created_at, updated_at) VALUES
('a0000000-0000-0000-0000-000000000001', 'admin@medflow.com', '$2b$10$rZ1qH5YnXxEzKP9oGLKXW.8jxG5ZqHQJ5YvJzC4wZ8nH0KfJxC5Vy', 'admin', 'System', 'Administrator', NOW(), NOW());

-- Doctor Users
INSERT INTO users (id, email, password_hash, role, first_name, last_name, phone, created_at, updated_at) VALUES
('d0000000-0000-0000-0000-000000000001', 'dr.smith@medflow.com', '$2b$10$rZ1qH5YnXxEzKP9oGLKXW.8jxG5ZqHQJ5YvJzC4wZ8nH0KfJxC5Vy', 'doctor', 'Sarah', 'Smith', '555-0101', NOW(), NOW()),
('d0000000-0000-0000-0000-000000000002', 'dr.johnson@medflow.com', '$2b$10$rZ1qH5YnXxEzKP9oGLKXW.8jxG5ZqHQJ5YvJzC4wZ8nH0KfJxC5Vy', 'doctor', 'Michael', 'Johnson', '555-0102', NOW(), NOW()),
('d0000000-0000-0000-0000-000000000003', 'dr.williams@medflow.com', '$2b$10$rZ1qH5YnXxEzKP9oGLKXW.8jxG5ZqHQJ5YvJzC4wZ8nH0KfJxC5Vy', 'doctor', 'Emily', 'Williams', '555-0103', NOW(), NOW());

-- Patient Users
INSERT INTO users (id, email, password_hash, role, first_name, last_name, phone, created_at, updated_at) VALUES
('b0000000-0000-0000-0000-000000000001', 'john.doe@example.com', '$2b$10$rZ1qH5YnXxEzKP9oGLKXW.8jxG5ZqHQJ5YvJzC4wZ8nH0KfJxC5Vy', 'patient', 'John', 'Doe', '555-1001', NOW(), NOW()),
('b0000000-0000-0000-0000-000000000002', 'jane.smith@example.com', '$2b$10$rZ1qH5YnXxEzKP9oGLKXW.8jxG5ZqHQJ5YvJzC4wZ8nH0KfJxC5Vy', 'patient', 'Jane', 'Smith', '555-1002', NOW(), NOW()),
('b0000000-0000-0000-0000-000000000003', 'bob.wilson@example.com', '$2b$10$rZ1qH5YnXxEzKP9oGLKXW.8jxG5ZqHQJ5YvJzC4wZ8nH0KfJxC5Vy', 'patient', 'Bob', 'Wilson', '555-1003', NOW(), NOW()),
('b0000000-0000-0000-0000-000000000004', 'alice.brown@example.com', '$2b$10$rZ1qH5YnXxEzKP9oGLKXW.8jxG5ZqHQJ5YvJzC4wZ8nH0KfJxC5Vy', 'patient', 'Alice', 'Brown', '555-1004', NOW(), NOW());

-- Staff User
INSERT INTO users (id, email, password_hash, role, first_name, last_name, created_at, updated_at) VALUES
('c0000000-0000-0000-0000-000000000001', 'staff@medflow.com', '$2b$10$rZ1qH5YnXxEzKP9oGLKXW.8jxG5ZqHQJ5YvJzC4wZ8nH0KfJxC5Vy', 'staff', 'Lisa', 'Martinez', NOW(), NOW());

-- ============================================================================
-- 2. CREATE PROVIDERS (References users table)
-- ============================================================================

INSERT INTO providers (id, user_id, first_name, last_name, email, phone, specialization, license_number, created_at, updated_at) VALUES
('10000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Sarah', 'Smith', 'dr.smith@medflow.com', '555-0101', 'Family Medicine', 'MD-12345', NOW(), NOW()),
('10000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', 'Michael', 'Johnson', 'dr.johnson@medflow.com', '555-0102', 'Cardiology', 'MD-23456', NOW(), NOW()),
('10000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000003', 'Emily', 'Williams', 'dr.williams@medflow.com', '555-0103', 'Pediatrics', 'MD-34567', NOW(), NOW());

-- ============================================================================
-- 3. CREATE PATIENTS (References users table)
-- ============================================================================

INSERT INTO patients (id, user_id, first_name, last_name, email, phone, date_of_birth, address, gender, created_at, updated_at) VALUES
('20000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'John', 'Doe', 'john.doe@example.com', '555-1001', '1985-05-15', '123 Main St, Springfield, IL 62701', 'male', NOW(), NOW()),
('20000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'Jane', 'Smith', 'jane.smith@example.com', '555-1002', '1990-08-22', '456 Oak Ave, Springfield, IL 62702', 'female', NOW(), NOW()),
('20000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000003', 'Bob', 'Wilson', 'bob.wilson@example.com', '555-1003', '1978-03-10', '789 Pine Rd, Springfield, IL 62703', 'male', NOW(), NOW()),
('20000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000004', 'Alice', 'Brown', 'alice.brown@example.com', '555-1004', '1995-11-30', '321 Elm St, Springfield, IL 62704', 'female', NOW(), NOW());

-- ============================================================================
-- 4. CREATE APPOINTMENTS (References patients and providers)
-- ============================================================================
-- IMPORTANT: provider_id must reference providers.id, NOT users.id

-- Today's appointments
INSERT INTO appointments (patient_id, provider_id, appointment_type, start_time, end_time, duration_minutes, status, reason, created_at, updated_at) VALUES
('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'General Consultation', NOW() + INTERVAL '2 hours', NOW() + INTERVAL '2.5 hours', 30, 'scheduled', 'Annual checkup', NOW(), NOW()),
('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'Follow-up', NOW() + INTERVAL '4 hours', NOW() + INTERVAL '4.5 hours', 30, 'scheduled', 'Blood pressure check', NOW(), NOW());

-- Tomorrow's appointments
INSERT INTO appointments (patient_id, provider_id, appointment_type, start_time, end_time, duration_minutes, status, reason, created_at, updated_at) VALUES
('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 'Check-up', NOW() + INTERVAL '1 day' + INTERVAL '9 hours', NOW() + INTERVAL '1 day' + INTERVAL '9.5 hours', 30, 'scheduled', 'Child wellness visit', NOW(), NOW()),
('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'General Consultation', NOW() + INTERVAL '1 day' + INTERVAL '14 hours', NOW() + INTERVAL '1 day' + INTERVAL '14.5 hours', 30, 'scheduled', 'Flu symptoms', NOW(), NOW());

-- Past appointments (completed)
INSERT INTO appointments (patient_id, provider_id, appointment_type, start_time, end_time, duration_minutes, status, reason, created_at, updated_at) VALUES
('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'Follow-up', NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days' + INTERVAL '30 minutes', 30, 'completed', 'Test results review', NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days'),
('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'General Consultation', NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days' + INTERVAL '30 minutes', 30, 'completed', 'Medication refill', NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days');

-- ============================================================================
-- 5. CREATE TASKS
-- ============================================================================

INSERT INTO tasks (title, description, priority, status, due_date, assigned_to, created_at, updated_at) VALUES
('Review Lab Results', 'Review and file patient lab results for John Doe', 'high', 'pending', NOW() + INTERVAL '2 days', 'd0000000-0000-0000-0000-000000000001', NOW(), NOW()),
('Schedule Follow-up', 'Schedule follow-up appointment for Jane Smith', 'medium', 'pending', NOW() + INTERVAL '1 day', 'c0000000-0000-0000-0000-000000000001', NOW(), NOW()),
('Insurance Verification', 'Verify insurance for Bob Wilson', 'high', 'in-progress', NOW() + INTERVAL '3 hours', 'c0000000-0000-0000-0000-000000000001', NOW(), NOW());

-- ============================================================================
-- 6. CREATE PRESCRIPTIONS
-- ============================================================================

INSERT INTO prescriptions (patient_id, provider_id, medication_name, dosage, frequency, duration, quantity, refills, instructions, status, prescribed_date, created_at, updated_at) VALUES
('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Lisinopril', '10mg', 'Once daily', '90 days', 90, 3, 'Take with water, preferably in the morning', 'Active', NOW() - INTERVAL '30 days', NOW(), NOW()),
('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'Metformin', '500mg', 'Twice daily', '90 days', 180, 2, 'Take with meals', 'Active', NOW() - INTERVAL '60 days', NOW(), NOW()),
('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 'Amoxicillin', '500mg', 'Three times daily', '10 days', 30, 0, 'Complete the full course', 'Active', NOW() - INTERVAL '2 days', NOW(), NOW());

-- ============================================================================
-- 7. CREATE CLAIMS
-- ============================================================================

INSERT INTO claims (patient_id, claim_number, service_date, diagnosis_code, procedure_code, amount, status, created_at, updated_at) VALUES
('20000000-0000-0000-0000-000000000001', 'CLM-2024-001', NOW() - INTERVAL '30 days', '{"Z00.00"}', '99213', 150.00, 'submitted', NOW() - INTERVAL '25 days', NOW()),
('20000000-0000-0000-0000-000000000002', 'CLM-2024-002', NOW() - INTERVAL '20 days', '{"I10"}', '99214', 200.00, 'approved', NOW() - INTERVAL '15 days', NOW()),
('20000000-0000-0000-0000-000000000003', 'CLM-2024-003', NOW() - INTERVAL '10 days', '{"J02.9"}', '99212', 100.00, 'paid', NOW() - INTERVAL '5 days', NOW());

-- ============================================================================
-- 8. CREATE PAYMENTS
-- ============================================================================

INSERT INTO payments (patient_id, claim_id, amount, payment_method, payment_date, status, created_at, updated_at) VALUES
('20000000-0000-0000-0000-000000000003', (SELECT id FROM claims WHERE claim_number = 'CLM-2024-003'), 100.00, 'credit_card', NOW() - INTERVAL '3 days', 'completed', NOW() - INTERVAL '3 days', NOW());

-- ============================================================================
-- 9. CREATE PHARMACIES
-- ============================================================================

INSERT INTO pharmacies (pharmacy_name, address_line1, city, state, zip_code, phone, email, created_at, updated_at) VALUES
('CVS Pharmacy', '100 Main Street', 'Springfield', 'IL', '62701', '555-2001', 'cvs.springfield@cvs.com', NOW(), NOW()),
('Walgreens', '200 Oak Avenue', 'Springfield', 'IL', '62702', '555-2002', 'walgreens.springfield@walgreens.com', NOW(), NOW()),
('Rite Aid', '300 Elm Street', 'Springfield', 'IL', '62703', '555-2003', 'riteaid.springfield@riteaid.com', NOW(), NOW());

-- ============================================================================
-- 10. CREATE DOCTOR AVAILABILITY (For scheduling system - if table exists)
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'doctor_availability') THEN
        -- Dr. Smith - Monday to Friday, 9 AM - 5 PM
        INSERT INTO doctor_availability (provider_id, day_of_week, start_time, end_time, timezone, is_available, created_at, updated_at) VALUES
        ('10000000-0000-0000-0000-000000000001', 1, '09:00', '17:00', 'America/Chicago', true, NOW(), NOW()),
        ('10000000-0000-0000-0000-000000000001', 2, '09:00', '17:00', 'America/Chicago', true, NOW(), NOW()),
        ('10000000-0000-0000-0000-000000000001', 3, '09:00', '17:00', 'America/Chicago', true, NOW(), NOW()),
        ('10000000-0000-0000-0000-000000000001', 4, '09:00', '17:00', 'America/Chicago', true, NOW(), NOW()),
        ('10000000-0000-0000-0000-000000000001', 5, '09:00', '17:00', 'America/Chicago', true, NOW(), NOW());

        -- Dr. Johnson - Monday, Wednesday, Friday, 10 AM - 6 PM
        INSERT INTO doctor_availability (provider_id, day_of_week, start_time, end_time, timezone, is_available, created_at, updated_at) VALUES
        ('10000000-0000-0000-0000-000000000002', 1, '10:00', '18:00', 'America/Chicago', true, NOW(), NOW()),
        ('10000000-0000-0000-0000-000000000002', 3, '10:00', '18:00', 'America/Chicago', true, NOW(), NOW()),
        ('10000000-0000-0000-0000-000000000002', 5, '10:00', '18:00', 'America/Chicago', true, NOW(), NOW());

        -- Dr. Williams - Tuesday, Thursday, 8 AM - 4 PM
        INSERT INTO doctor_availability (provider_id, day_of_week, start_time, end_time, timezone, is_available, created_at, updated_at) VALUES
        ('10000000-0000-0000-0000-000000000003', 2, '08:00', '16:00', 'America/Chicago', true, NOW(), NOW()),
        ('10000000-0000-0000-0000-000000000003', 4, '08:00', '16:00', 'America/Chicago', true, NOW(), NOW());

        RAISE NOTICE 'Created doctor availability schedules';
    ELSE
        RAISE NOTICE 'Skipping doctor_availability - table does not exist (run migrations first)';
    END IF;
END $$;

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Display record counts
SELECT 'VERIFICATION - Record Counts:' as status;
SELECT 'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'patients', COUNT(*) FROM patients
UNION ALL
SELECT 'providers', COUNT(*) FROM providers
UNION ALL
SELECT 'appointments', COUNT(*) FROM appointments
UNION ALL
SELECT 'prescriptions', COUNT(*) FROM prescriptions
UNION ALL
SELECT 'claims', COUNT(*) FROM claims
UNION ALL
SELECT 'payments', COUNT(*) FROM payments
UNION ALL
SELECT 'tasks', COUNT(*) FROM tasks
UNION ALL
SELECT 'pharmacies', COUNT(*) FROM pharmacies
UNION ALL
SELECT 'doctor_availability', COUNT(*) FROM doctor_availability
ORDER BY table_name;

-- Verify provider references in appointments
SELECT 'VERIFICATION - Appointment Provider References:' as status;
SELECT
    a.id as appointment_id,
    p.first_name || ' ' || p.last_name as patient_name,
    pr.first_name || ' ' || pr.last_name as provider_name,
    a.appointment_type,
    a.status
FROM appointments a
JOIN patients p ON a.patient_id = p.id
LEFT JOIN providers pr ON a.provider_id = pr.id
ORDER BY a.start_time;

-- Verify no orphaned references
SELECT 'VERIFICATION - Orphaned References Check:' as status;
SELECT
    CASE
        WHEN COUNT(*) = 0 THEN 'PASS - No appointments with invalid provider_id'
        ELSE 'FAIL - ' || COUNT(*)::text || ' appointments have invalid provider_id'
    END as validation_result
FROM appointments a
LEFT JOIN providers pr ON a.provider_id = pr.id
WHERE a.provider_id IS NOT NULL AND pr.id IS NULL;

-- Show doctor availability count if table exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'doctor_availability') THEN
        RAISE NOTICE 'Doctor availability schedules: %', (SELECT COUNT(*) FROM doctor_availability);
    END IF;
END $$;
