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
-- Using DO blocks to handle tables that might not exist

-- 1. Delete scheduling system data (if tables exist)
DO $$
BEGIN
    -- New scheduling tables
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'appointment_reminders') THEN
        DELETE FROM appointment_reminders;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'booking_analytics') THEN
        DELETE FROM booking_analytics;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'provider_booking_config') THEN
        DELETE FROM provider_booking_config;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'appointment_type_config') THEN
        DELETE FROM appointment_type_config;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'doctor_time_off') THEN
        DELETE FROM doctor_time_off;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'doctor_availability') THEN
        DELETE FROM doctor_availability;
    END IF;

    -- Old scheduling tables (legacy)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'recurring_appointments') THEN
        DELETE FROM recurring_appointments;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'booking_configurations') THEN
        DELETE FROM booking_configurations;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'appointment_type_configurations') THEN
        DELETE FROM appointment_type_configurations;
    END IF;
END $$;

-- 2. Delete appointment-related data
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'appointments') THEN
        DELETE FROM appointments;
    END IF;
END $$;

-- 3. Delete medical data
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'prescriptions') THEN
        DELETE FROM prescriptions;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'diagnosis') THEN
        DELETE FROM diagnosis;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'medical_records') THEN
        DELETE FROM medical_records;
    END IF;
END $$;

-- 4. Delete financial data
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'payments') THEN
        DELETE FROM payments;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'claims') THEN
        DELETE FROM claims;
    END IF;
END $$;

-- 5. Delete tasks
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'tasks') THEN
        DELETE FROM tasks;
    END IF;
END $$;

-- 6. Delete offerings and pharmacies
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'patient_preferred_pharmacies') THEN
        DELETE FROM patient_preferred_pharmacies;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'pharmacies') THEN
        DELETE FROM pharmacies;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'offerings') THEN
        DELETE FROM offerings;
    END IF;
END $$;

-- 7. Delete provider and patient records
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'providers') THEN
        DELETE FROM providers;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'patients') THEN
        DELETE FROM patients;
    END IF;
END $$;

-- 8. Delete users (main parent table)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users') THEN
        DELETE FROM users;
    END IF;
END $$;

-- Re-enable triggers
SET session_replication_role = 'origin';

COMMIT;

-- Display counts to verify deletion
DO $$
DECLARE
    result_text TEXT := E'\n=== VERIFICATION - Remaining Rows ===\n';
BEGIN
    -- Only show counts for tables that exist
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users') THEN
        result_text := result_text || 'users: ' || (SELECT COUNT(*)::TEXT FROM users) || E'\n';
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'patients') THEN
        result_text := result_text || 'patients: ' || (SELECT COUNT(*)::TEXT FROM patients) || E'\n';
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'providers') THEN
        result_text := result_text || 'providers: ' || (SELECT COUNT(*)::TEXT FROM providers) || E'\n';
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'appointments') THEN
        result_text := result_text || 'appointments: ' || (SELECT COUNT(*)::TEXT FROM appointments) || E'\n';
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'prescriptions') THEN
        result_text := result_text || 'prescriptions: ' || (SELECT COUNT(*)::TEXT FROM prescriptions) || E'\n';
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'claims') THEN
        result_text := result_text || 'claims: ' || (SELECT COUNT(*)::TEXT FROM claims) || E'\n';
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'payments') THEN
        result_text := result_text || 'payments: ' || (SELECT COUNT(*)::TEXT FROM payments) || E'\n';
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'tasks') THEN
        result_text := result_text || 'tasks: ' || (SELECT COUNT(*)::TEXT FROM tasks) || E'\n';
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'doctor_availability') THEN
        result_text := result_text || 'doctor_availability: ' || (SELECT COUNT(*)::TEXT FROM doctor_availability) || E'\n';
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'appointment_type_config') THEN
        result_text := result_text || 'appointment_type_config: ' || (SELECT COUNT(*)::TEXT FROM appointment_type_config) || E'\n';
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'provider_booking_config') THEN
        result_text := result_text || 'provider_booking_config: ' || (SELECT COUNT(*)::TEXT FROM provider_booking_config) || E'\n';
    END IF;

    RAISE NOTICE '%', result_text;
END $$;
