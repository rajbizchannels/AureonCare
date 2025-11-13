-- ============================================================================
-- Migration 022: Convert patients and providers tables ID from INTEGER to UUID
-- ============================================================================
-- This migration converts the patients.id and providers.id columns from
-- SERIAL (integer) to UUID and updates all foreign key references accordingly.
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

BEGIN;

-- ============================================================================
-- Step 1: Check if conversion is needed
-- ============================================================================

DO $$
DECLARE
    patients_id_type TEXT;
    providers_id_type TEXT;
BEGIN
    -- Check patients.id type
    SELECT data_type INTO patients_id_type
    FROM information_schema.columns
    WHERE table_name = 'patients' AND column_name = 'id';

    -- Check providers.id type
    SELECT data_type INTO providers_id_type
    FROM information_schema.columns
    WHERE table_name = 'providers' AND column_name = 'id';

    IF patients_id_type = 'uuid' AND providers_id_type = 'uuid' THEN
        RAISE NOTICE 'Tables already use UUID - skipping conversion';
        RETURN;
    END IF;

    RAISE NOTICE 'Converting patients and providers to UUID...';
END $$;

-- ============================================================================
-- Step 2: Convert PATIENTS table
-- ============================================================================

DO $$
DECLARE
    patients_id_type TEXT;
BEGIN
    -- Check if patients.id is already UUID
    SELECT data_type INTO patients_id_type
    FROM information_schema.columns
    WHERE table_name = 'patients' AND column_name = 'id';

    IF patients_id_type != 'uuid' THEN
        RAISE NOTICE 'Converting patients.id from INTEGER to UUID...';

        -- Drop foreign key constraints referencing patients(id)
        IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'prescriptions_patient_id_fkey') THEN
            ALTER TABLE prescriptions DROP CONSTRAINT prescriptions_patient_id_fkey;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'appointments_patient_id_fkey') THEN
            ALTER TABLE appointments DROP CONSTRAINT appointments_patient_id_fkey;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'claims_patient_id_fkey') THEN
            ALTER TABLE claims DROP CONSTRAINT claims_patient_id_fkey;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'payments_patient_id_fkey') THEN
            ALTER TABLE payments DROP CONSTRAINT payments_patient_id_fkey;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'diagnosis_patient_id_fkey') THEN
            ALTER TABLE diagnosis DROP CONSTRAINT diagnosis_patient_id_fkey;
        END IF;

        -- Add temporary UUID column
        ALTER TABLE patients ADD COLUMN id_uuid UUID DEFAULT uuid_generate_v4();

        -- Drop old integer id
        ALTER TABLE patients DROP COLUMN id CASCADE;

        -- Rename UUID column
        ALTER TABLE patients RENAME COLUMN id_uuid TO id;

        -- Make it primary key
        ALTER TABLE patients ADD PRIMARY KEY (id);
        ALTER TABLE patients ALTER COLUMN id SET NOT NULL;

        RAISE NOTICE 'Converted patients.id to UUID';
    ELSE
        RAISE NOTICE 'patients.id is already UUID';
    END IF;
END $$;

-- ============================================================================
-- Step 3: Convert PROVIDERS table
-- ============================================================================

DO $$
DECLARE
    providers_id_type TEXT;
BEGIN
    -- Check if providers.id is already UUID
    SELECT data_type INTO providers_id_type
    FROM information_schema.columns
    WHERE table_name = 'providers' AND column_name = 'id';

    IF providers_id_type != 'uuid' THEN
        RAISE NOTICE 'Converting providers.id from INTEGER to UUID...';

        -- Drop foreign key constraints referencing providers(id)
        IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'appointments_provider_id_fkey') THEN
            ALTER TABLE appointments DROP CONSTRAINT appointments_provider_id_fkey;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'prescriptions_provider_id_fkey') THEN
            ALTER TABLE prescriptions DROP CONSTRAINT prescriptions_provider_id_fkey;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'diagnosis_provider_id_fkey') THEN
            ALTER TABLE diagnosis DROP CONSTRAINT diagnosis_provider_id_fkey;
        END IF;

        -- Add temporary UUID column
        ALTER TABLE providers ADD COLUMN id_uuid UUID DEFAULT uuid_generate_v4();

        -- Drop old integer id
        ALTER TABLE providers DROP COLUMN id CASCADE;

        -- Rename UUID column
        ALTER TABLE providers RENAME COLUMN id_uuid TO id;

        -- Make it primary key
        ALTER TABLE providers ADD PRIMARY KEY (id);
        ALTER TABLE providers ALTER COLUMN id SET NOT NULL;

        RAISE NOTICE 'Converted providers.id to UUID';
    ELSE
        RAISE NOTICE 'providers.id is already UUID';
    END IF;
END $$;

-- ============================================================================
-- Step 4: Convert foreign key columns to UUID
-- ============================================================================

DO $$
BEGIN
    -- Convert appointments.patient_id to UUID (if needed)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'appointments') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'patient_id' AND data_type != 'uuid') THEN
            ALTER TABLE appointments ADD COLUMN patient_id_uuid UUID;
            ALTER TABLE appointments DROP COLUMN patient_id;
            ALTER TABLE appointments RENAME COLUMN patient_id_uuid TO patient_id;
            RAISE NOTICE 'Converted appointments.patient_id to UUID';
        END IF;
    END IF;

    -- Convert appointments.provider_id to UUID (if needed)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'appointments') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'provider_id' AND data_type != 'uuid') THEN
            ALTER TABLE appointments ADD COLUMN provider_id_uuid UUID;
            ALTER TABLE appointments DROP COLUMN provider_id;
            ALTER TABLE appointments RENAME COLUMN provider_id_uuid TO provider_id;
            RAISE NOTICE 'Converted appointments.provider_id to UUID';
        END IF;
    END IF;

    -- Convert prescriptions.patient_id to UUID (if needed)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'prescriptions') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prescriptions' AND column_name = 'patient_id' AND data_type != 'uuid') THEN
            ALTER TABLE prescriptions ADD COLUMN patient_id_uuid UUID;
            ALTER TABLE prescriptions DROP COLUMN patient_id;
            ALTER TABLE prescriptions RENAME COLUMN patient_id_uuid TO patient_id;
            RAISE NOTICE 'Converted prescriptions.patient_id to UUID';
        END IF;
    END IF;

    -- Convert prescriptions.provider_id to UUID (if needed)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'prescriptions') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prescriptions' AND column_name = 'provider_id' AND data_type != 'uuid') THEN
            ALTER TABLE prescriptions ADD COLUMN provider_id_uuid UUID;
            ALTER TABLE prescriptions DROP COLUMN provider_id;
            ALTER TABLE prescriptions RENAME COLUMN provider_id_uuid TO provider_id;
            RAISE NOTICE 'Converted prescriptions.provider_id to UUID';
        END IF;
    END IF;

    -- Convert claims.patient_id to UUID (if needed)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'claims') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'claims' AND column_name = 'patient_id' AND data_type != 'uuid') THEN
            ALTER TABLE claims ADD COLUMN patient_id_uuid UUID;
            ALTER TABLE claims DROP COLUMN patient_id;
            ALTER TABLE claims RENAME COLUMN patient_id_uuid TO patient_id;
            RAISE NOTICE 'Converted claims.patient_id to UUID';
        END IF;
    END IF;

    -- Convert payments.patient_id to UUID (if needed)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'patient_id' AND data_type != 'uuid') THEN
            ALTER TABLE payments ADD COLUMN patient_id_uuid UUID;
            ALTER TABLE payments DROP COLUMN patient_id;
            ALTER TABLE payments RENAME COLUMN patient_id_uuid TO patient_id;
            RAISE NOTICE 'Converted payments.patient_id to UUID';
        END IF;
    END IF;

    -- Convert diagnosis.patient_id to UUID (if needed)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'diagnosis') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'diagnosis' AND column_name = 'patient_id' AND data_type != 'uuid') THEN
            ALTER TABLE diagnosis ADD COLUMN patient_id_uuid UUID;
            ALTER TABLE diagnosis DROP COLUMN patient_id;
            ALTER TABLE diagnosis RENAME COLUMN patient_id_uuid TO patient_id;
            RAISE NOTICE 'Converted diagnosis.patient_id to UUID';
        END IF;
    END IF;

    -- Convert diagnosis.provider_id to UUID (if needed)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'diagnosis') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'diagnosis' AND column_name = 'provider_id' AND data_type != 'uuid') THEN
            ALTER TABLE diagnosis ADD COLUMN provider_id_uuid UUID;
            ALTER TABLE diagnosis DROP COLUMN provider_id;
            ALTER TABLE diagnosis RENAME COLUMN provider_id_uuid TO provider_id;
            RAISE NOTICE 'Converted diagnosis.provider_id to UUID';
        END IF;
    END IF;
END $$;

-- ============================================================================
-- Step 5: Recreate foreign key constraints
-- ============================================================================

DO $$
BEGIN
    -- Recreate appointments foreign keys
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'appointments') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'appointments_patient_id_fkey') THEN
            ALTER TABLE appointments
            ADD CONSTRAINT appointments_patient_id_fkey
            FOREIGN KEY (patient_id)
            REFERENCES patients(id)
            ON DELETE CASCADE;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'appointments_provider_id_fkey') THEN
            ALTER TABLE appointments
            ADD CONSTRAINT appointments_provider_id_fkey
            FOREIGN KEY (provider_id)
            REFERENCES providers(id)
            ON DELETE SET NULL;
        END IF;
    END IF;

    -- Recreate prescriptions foreign keys
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'prescriptions') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'prescriptions_patient_id_fkey') THEN
            ALTER TABLE prescriptions
            ADD CONSTRAINT prescriptions_patient_id_fkey
            FOREIGN KEY (patient_id)
            REFERENCES patients(id)
            ON DELETE CASCADE;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'prescriptions_provider_id_fkey') THEN
            ALTER TABLE prescriptions
            ADD CONSTRAINT prescriptions_provider_id_fkey
            FOREIGN KEY (provider_id)
            REFERENCES providers(id)
            ON DELETE SET NULL;
        END IF;
    END IF;

    -- Recreate claims foreign keys
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'claims') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'claims_patient_id_fkey') THEN
            ALTER TABLE claims
            ADD CONSTRAINT claims_patient_id_fkey
            FOREIGN KEY (patient_id)
            REFERENCES patients(id)
            ON DELETE CASCADE;
        END IF;
    END IF;

    -- Recreate payments foreign keys
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'payments_patient_id_fkey') THEN
            ALTER TABLE payments
            ADD CONSTRAINT payments_patient_id_fkey
            FOREIGN KEY (patient_id)
            REFERENCES patients(id)
            ON DELETE CASCADE;
        END IF;
    END IF;

    -- Recreate diagnosis foreign keys
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'diagnosis') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'diagnosis_patient_id_fkey') THEN
            ALTER TABLE diagnosis
            ADD CONSTRAINT diagnosis_patient_id_fkey
            FOREIGN KEY (patient_id)
            REFERENCES patients(id)
            ON DELETE CASCADE;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'diagnosis_provider_id_fkey') THEN
            ALTER TABLE diagnosis
            ADD CONSTRAINT diagnosis_provider_id_fkey
            FOREIGN KEY (provider_id)
            REFERENCES providers(id)
            ON DELETE SET NULL;
        END IF;
    END IF;

    RAISE NOTICE 'Recreated foreign key constraints';
END $$;

-- ============================================================================
-- Step 6: Update indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_patients_email ON patients(email);
CREATE INDEX IF NOT EXISTS idx_patients_user_id ON patients(user_id);
CREATE INDEX IF NOT EXISTS idx_providers_email ON providers(email);
CREATE INDEX IF NOT EXISTS idx_providers_user_id ON providers(user_id);
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_provider ON appointments(provider_id);

COMMIT;

-- Final notification
DO $$
BEGIN
    RAISE NOTICE 'Migration 022 completed: patients and providers converted to UUID';
END $$;
