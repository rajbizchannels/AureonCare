-- ============================================================================
-- Migration 023: Merge patient.id with user.id
-- ============================================================================
-- This migration changes the patients table so that patients.id directly uses
-- the users.id value, eliminating the need for a separate user_id column.
--
-- Design: A patient IS a user, so they should share the same ID.
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

BEGIN;

-- ============================================================================
-- Step 1: Check if migration is needed
-- ============================================================================

DO $$
DECLARE
    has_user_id_column BOOLEAN;
BEGIN
    -- Check if patients.user_id column exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'patients' AND column_name = 'user_id'
    ) INTO has_user_id_column;

    IF NOT has_user_id_column THEN
        RAISE NOTICE 'Migration already applied - patients.user_id column does not exist';
        RETURN;
    END IF;

    RAISE NOTICE 'Starting migration to merge patient.id with user.id...';
END $$;

-- ============================================================================
-- Step 2: Create temporary mapping table
-- ============================================================================

CREATE TEMP TABLE patient_id_mapping AS
SELECT
    p.id as old_patient_id,
    p.user_id as new_patient_id,
    p.first_name,
    p.last_name,
    p.email
FROM patients p
WHERE p.user_id IS NOT NULL;

-- Log the mapping
DO $$
DECLARE
    mapping_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO mapping_count FROM patient_id_mapping;
    RAISE NOTICE 'Created mapping for % patients', mapping_count;
END $$;

-- ============================================================================
-- Step 3: Update foreign key references in dependent tables
-- ============================================================================

-- Update appointments.patient_id
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'patient_id') THEN
        -- Drop foreign key constraint
        ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_patient_id_fkey;

        -- Update patient_id values
        UPDATE appointments a
        SET patient_id = m.new_patient_id
        FROM patient_id_mapping m
        WHERE a.patient_id = m.old_patient_id;

        RAISE NOTICE 'Updated appointments.patient_id references';
    END IF;
END $$;

-- Update claims.patient_id
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'claims' AND column_name = 'patient_id') THEN
        ALTER TABLE claims DROP CONSTRAINT IF EXISTS claims_patient_id_fkey;

        UPDATE claims c
        SET patient_id = m.new_patient_id
        FROM patient_id_mapping m
        WHERE c.patient_id = m.old_patient_id;

        RAISE NOTICE 'Updated claims.patient_id references';
    END IF;
END $$;

-- Update prescriptions.patient_id
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prescriptions' AND column_name = 'patient_id') THEN
        ALTER TABLE prescriptions DROP CONSTRAINT IF EXISTS prescriptions_patient_id_fkey;

        UPDATE prescriptions p
        SET patient_id = m.new_patient_id
        FROM patient_id_mapping m
        WHERE p.patient_id = m.old_patient_id;

        RAISE NOTICE 'Updated prescriptions.patient_id references';
    END IF;
END $$;

-- Update payments.patient_id
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'patient_id') THEN
        ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_patient_id_fkey;

        UPDATE payments p
        SET patient_id = m.new_patient_id
        FROM patient_id_mapping m
        WHERE p.patient_id = m.old_patient_id;

        RAISE NOTICE 'Updated payments.patient_id references';
    END IF;
END $$;

-- Update diagnosis.patient_id
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'diagnosis' AND column_name = 'patient_id') THEN
        ALTER TABLE diagnosis DROP CONSTRAINT IF EXISTS diagnosis_patient_id_fkey;

        UPDATE diagnosis d
        SET patient_id = m.new_patient_id
        FROM patient_id_mapping m
        WHERE d.patient_id = m.old_patient_id;

        RAISE NOTICE 'Updated diagnosis.patient_id references';
    END IF;
END $$;

-- Update medical_records.patient_id (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medical_records' AND column_name = 'patient_id') THEN
        ALTER TABLE medical_records DROP CONSTRAINT IF EXISTS medical_records_patient_id_fkey;

        UPDATE medical_records m
        SET patient_id = map.new_patient_id
        FROM patient_id_mapping map
        WHERE m.patient_id = map.old_patient_id;

        RAISE NOTICE 'Updated medical_records.patient_id references';
    END IF;
END $$;

-- Update recurring_appointments.patient_id
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'recurring_appointments' AND column_name = 'patient_id') THEN
        ALTER TABLE recurring_appointments DROP CONSTRAINT IF EXISTS fk_recurring_appointments_patient;

        UPDATE recurring_appointments r
        SET patient_id = m.new_patient_id
        FROM patient_id_mapping m
        WHERE r.patient_id = m.old_patient_id;

        RAISE NOTICE 'Updated recurring_appointments.patient_id references';
    END IF;
END $$;

-- Update appointment_waitlist.patient_id
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointment_waitlist' AND column_name = 'patient_id') THEN
        ALTER TABLE appointment_waitlist DROP CONSTRAINT IF EXISTS fk_appointment_waitlist_patient;

        UPDATE appointment_waitlist w
        SET patient_id = m.new_patient_id
        FROM patient_id_mapping m
        WHERE w.patient_id = m.old_patient_id;

        RAISE NOTICE 'Updated appointment_waitlist.patient_id references';
    END IF;
END $$;

-- Update booking_analytics.patient_id
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'booking_analytics' AND column_name = 'patient_id') THEN
        ALTER TABLE booking_analytics DROP CONSTRAINT IF EXISTS fk_booking_analytics_patient;

        UPDATE booking_analytics b
        SET patient_id = m.new_patient_id
        FROM patient_id_mapping m
        WHERE b.patient_id = m.old_patient_id;

        RAISE NOTICE 'Updated booking_analytics.patient_id references';
    END IF;
END $$;

-- Update patient_portal_sessions.patient_id (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patient_portal_sessions' AND column_name = 'patient_id') THEN
        UPDATE patient_portal_sessions s
        SET patient_id = m.new_patient_id
        FROM patient_id_mapping m
        WHERE s.patient_id = m.old_patient_id;

        RAISE NOTICE 'Updated patient_portal_sessions.patient_id references';
    END IF;
END $$;

-- Update social_auth.patient_id (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'social_auth' AND column_name = 'patient_id') THEN
        UPDATE social_auth s
        SET patient_id = m.new_patient_id
        FROM patient_id_mapping m
        WHERE s.patient_id = m.old_patient_id;

        RAISE NOTICE 'Updated social_auth.patient_id references';
    END IF;
END $$;

-- Update patient_pharmacies.patient_id (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patient_pharmacies' AND column_name = 'patient_id') THEN
        UPDATE patient_pharmacies p
        SET patient_id = m.new_patient_id
        FROM patient_id_mapping m
        WHERE p.patient_id = m.old_patient_id;

        RAISE NOTICE 'Updated patient_pharmacies.patient_id references';
    END IF;
END $$;

-- ============================================================================
-- Step 4: Recreate patients table with user_id as primary key
-- ============================================================================

-- Drop the old primary key constraint
ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_pkey CASCADE;

-- Drop the old id column
ALTER TABLE patients DROP COLUMN IF EXISTS id CASCADE;

-- Rename user_id to id
ALTER TABLE patients RENAME COLUMN user_id TO id;

-- Make id the primary key
ALTER TABLE patients ADD PRIMARY KEY (id);

-- Add foreign key constraint to users table
ALTER TABLE patients
    ADD CONSTRAINT patients_id_fkey
    FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE;

--RAISE NOTICE 'Recreated patients table with id referencing users id';

-- ============================================================================
-- Step 5: Re-establish foreign key constraints in dependent tables
-- ============================================================================

-- Appointments
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'patient_id') THEN
        ALTER TABLE appointments
            ADD CONSTRAINT appointments_patient_id_fkey
            FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
        RAISE NOTICE 'Re-established appointments.patient_id foreign key';
    END IF;
END $$;

-- Claims
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'claims' AND column_name = 'patient_id') THEN
        ALTER TABLE claims
            ADD CONSTRAINT claims_patient_id_fkey
            FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
        RAISE NOTICE 'Re-established claims.patient_id foreign key';
    END IF;
END $$;

-- Prescriptions
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prescriptions' AND column_name = 'patient_id') THEN
        ALTER TABLE prescriptions
            ADD CONSTRAINT prescriptions_patient_id_fkey
            FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
        RAISE NOTICE 'Re-established prescriptions.patient_id foreign key';
    END IF;
END $$;

-- Payments
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'patient_id') THEN
        ALTER TABLE payments
            ADD CONSTRAINT payments_patient_id_fkey
            FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
        RAISE NOTICE 'Re-established payments.patient_id foreign key';
    END IF;
END $$;

-- Diagnosis
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'diagnosis' AND column_name = 'patient_id') THEN
        ALTER TABLE diagnosis
            ADD CONSTRAINT diagnosis_patient_id_fkey
            FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
        RAISE NOTICE 'Re-established diagnosis.patient_id foreign key';
    END IF;
END $$;

-- Medical Records
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medical_records' AND column_name = 'patient_id') THEN
        ALTER TABLE medical_records
            ADD CONSTRAINT medical_records_patient_id_fkey
            FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
        RAISE NOTICE 'Re-established medical_records.patient_id foreign key';
    END IF;
END $$;

-- Recurring Appointments
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'recurring_appointments' AND column_name = 'patient_id') THEN
        ALTER TABLE recurring_appointments
            ADD CONSTRAINT fk_recurring_appointments_patient
            FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
        RAISE NOTICE 'Re-established recurring_appointments.patient_id foreign key';
    END IF;
END $$;

-- Appointment Waitlist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointment_waitlist' AND column_name = 'patient_id') THEN
        ALTER TABLE appointment_waitlist
            ADD CONSTRAINT fk_appointment_waitlist_patient
            FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
        RAISE NOTICE 'Re-established appointment_waitlist.patient_id foreign key';
    END IF;
END $$;

-- Booking Analytics
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'booking_analytics' AND column_name = 'patient_id') THEN
        ALTER TABLE booking_analytics
            ADD CONSTRAINT fk_booking_analytics_patient
            FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL;
        RAISE NOTICE 'Re-established booking_analytics.patient_id foreign key';
    END IF;
END $$;

-- ============================================================================
-- Step 6: Verify migration
-- ============================================================================

DO $$
DECLARE
    patient_count INTEGER;
    patients_with_user_id INTEGER;
BEGIN
    -- Count patients
    SELECT COUNT(*) INTO patient_count FROM patients;

    -- Count patients with valid user references
    SELECT COUNT(*) INTO patients_with_user_id
    FROM patients p
    INNER JOIN users u ON p.id = u.id;

    RAISE NOTICE 'Migration complete!';
    RAISE NOTICE '  Total patients: %', patient_count;
    RAISE NOTICE '  Patients with valid user references: %', patients_with_user_id;

    IF patient_count != patients_with_user_id THEN
        RAISE WARNING 'Some patients do not have corresponding user records!';
    END IF;
END $$;

COMMIT;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================
COMMENT ON COLUMN patients.id IS 'Primary key - references users.id directly (no separate user_id column)';
