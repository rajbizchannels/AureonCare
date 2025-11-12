-- ============================================================================
-- RESET DATABASE - DELETE ALL DATA IN CORRECT ORDER
-- ============================================================================
-- This script deletes all data from the database in the correct order
-- to respect foreign key constraints.
-- Run this before seeding new test data.

BEGIN;

-- Disable triggers temporarily for faster deletion
SET session_replication_role = 'replica';

-- Delete data in reverse order of dependencies
-- (child tables first, parent tables last)

-- 1. Delete scheduling system data
DELETE FROM recurring_appointments;
DELETE FROM booking_configurations;
DELETE FROM appointment_type_configurations;
DELETE FROM doctor_time_off;
DELETE FROM doctor_availability;

-- 2. Delete appointment-related data
DELETE FROM appointments;

-- 3. Delete medical data
DELETE FROM prescriptions;
DELETE FROM diagnosis;
DELETE FROM medical_records;

-- 4. Delete financial data
DELETE FROM payments;
DELETE FROM claims;

-- 5. Delete tasks
DELETE FROM tasks;

-- 6. Delete offerings and pharmacies
DELETE FROM patient_preferred_pharmacies;
DELETE FROM pharmacies;
DELETE FROM offerings;

-- 7. Delete provider and patient records
DELETE FROM providers;
DELETE FROM patients;

-- 8. Delete users (main parent table)
DELETE FROM users;

-- Re-enable triggers
SET session_replication_role = 'origin';

COMMIT;

-- Display counts to verify deletion
SELECT 'users' as table_name, COUNT(*) as remaining_rows FROM users
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
ORDER BY table_name;
