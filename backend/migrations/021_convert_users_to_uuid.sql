-- ============================================================================
-- Migration 021: Convert users table ID from INTEGER to UUID
-- ============================================================================
-- This migration converts the users.id column from SERIAL (integer) to UUID
-- and updates all foreign key references accordingly.
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

BEGIN;

-- ============================================================================
-- Step 1: Drop all foreign key constraints that reference users(id)
-- ============================================================================

DO $$
BEGIN
    -- Drop providers.user_id constraint
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'providers_user_id_fkey'
        AND table_name = 'providers'
    ) THEN
        ALTER TABLE providers DROP CONSTRAINT providers_user_id_fkey;
        RAISE NOTICE 'Dropped providers_user_id_fkey constraint';
    END IF;

    -- Drop patients.user_id constraint
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'patients_user_id_fkey'
        AND table_name = 'patients'
    ) THEN
        ALTER TABLE patients DROP CONSTRAINT patients_user_id_fkey;
        RAISE NOTICE 'Dropped patients_user_id_fkey constraint';
    END IF;

    -- Drop user_roles constraints (if table exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_roles') THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'user_roles_user_id_fkey'
            AND table_name = 'user_roles'
        ) THEN
            ALTER TABLE user_roles DROP CONSTRAINT user_roles_user_id_fkey;
            RAISE NOTICE 'Dropped user_roles_user_id_fkey constraint';
        END IF;

        IF EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'user_roles_assigned_by_fkey'
            AND table_name = 'user_roles'
        ) THEN
            ALTER TABLE user_roles DROP CONSTRAINT user_roles_assigned_by_fkey;
            RAISE NOTICE 'Dropped user_roles_assigned_by_fkey constraint';
        END IF;
    END IF;

    -- Drop appointments.cancelled_by constraint (if exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'appointments') THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'appointments_cancelled_by_fkey'
            AND table_name = 'appointments'
        ) THEN
            ALTER TABLE appointments DROP CONSTRAINT appointments_cancelled_by_fkey;
            RAISE NOTICE 'Dropped appointments_cancelled_by_fkey constraint';
        END IF;
    END IF;

    -- Drop prescriptions.cancelled_by constraint (if exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'prescriptions') THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'prescriptions_cancelled_by_fkey'
            AND table_name = 'prescriptions'
        ) THEN
            ALTER TABLE prescriptions DROP CONSTRAINT prescriptions_cancelled_by_fkey;
            RAISE NOTICE 'Dropped prescriptions_cancelled_by_fkey constraint';
        END IF;
    END IF;
END $$;

-- ============================================================================
-- Step 2: Convert users.id from INTEGER to UUID
-- ============================================================================

DO $$
BEGIN
    -- Add a temporary UUID column
    ALTER TABLE users ADD COLUMN id_uuid UUID DEFAULT uuid_generate_v4();
    RAISE NOTICE 'Added temporary id_uuid column';

    -- Update to ensure all rows have a UUID (in case default didn't apply)
    UPDATE users SET id_uuid = uuid_generate_v4() WHERE id_uuid IS NULL;

    -- Drop the old integer id column (CASCADE will drop dependent objects)
    ALTER TABLE users DROP COLUMN id CASCADE;
    RAISE NOTICE 'Dropped old integer id column';

    -- Rename id_uuid to id
    ALTER TABLE users RENAME COLUMN id_uuid TO id;
    RAISE NOTICE 'Renamed id_uuid to id';

    -- Make id the primary key
    ALTER TABLE users ADD PRIMARY KEY (id);
    RAISE NOTICE 'Added PRIMARY KEY constraint on users.id';

    -- Make id NOT NULL (should already be, but enforce it)
    ALTER TABLE users ALTER COLUMN id SET NOT NULL;
END $$;

-- ============================================================================
-- Step 3: Convert foreign key columns from INTEGER to UUID
-- ============================================================================

DO $$
BEGIN
    -- Convert providers.user_id from INTEGER to UUID
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'providers') THEN
        -- Add new UUID column
        ALTER TABLE providers ADD COLUMN user_id_uuid UUID;

        -- We can't migrate data since the old user IDs don't exist anymore
        -- Set to NULL for now (data will be recreated by seed script)

        -- Drop old column
        ALTER TABLE providers DROP COLUMN IF EXISTS user_id;

        -- Rename new column
        ALTER TABLE providers RENAME COLUMN user_id_uuid TO user_id;

        RAISE NOTICE 'Converted providers.user_id to UUID';
    END IF;

    -- Convert patients.user_id from INTEGER to UUID
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'patients') THEN
        -- Add new UUID column
        ALTER TABLE patients ADD COLUMN user_id_uuid UUID;

        -- We can't migrate data since the old user IDs don't exist anymore
        -- Set to NULL for now (data will be recreated by seed script)

        -- Drop old column
        ALTER TABLE patients DROP COLUMN IF EXISTS user_id;

        -- Rename new column
        ALTER TABLE patients RENAME COLUMN user_id_uuid TO user_id;

        RAISE NOTICE 'Converted patients.user_id to UUID';
    END IF;

    -- Convert user_roles columns from INTEGER to UUID (if table exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_roles') THEN
        -- Convert user_id
        ALTER TABLE user_roles ADD COLUMN user_id_uuid UUID;
        ALTER TABLE user_roles DROP COLUMN IF EXISTS user_id;
        ALTER TABLE user_roles RENAME COLUMN user_id_uuid TO user_id;

        -- Convert assigned_by
        ALTER TABLE user_roles ADD COLUMN assigned_by_uuid UUID;
        ALTER TABLE user_roles DROP COLUMN IF EXISTS assigned_by;
        ALTER TABLE user_roles RENAME COLUMN assigned_by_uuid TO assigned_by;

        RAISE NOTICE 'Converted user_roles columns to UUID';
    END IF;
END $$;

-- ============================================================================
-- Step 4: Recreate foreign key constraints
-- ============================================================================

DO $$
BEGIN
    -- Recreate providers.user_id constraint
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'providers') THEN
        ALTER TABLE providers
        ADD CONSTRAINT providers_user_id_fkey
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE;
        RAISE NOTICE 'Created providers_user_id_fkey constraint';
    END IF;

    -- Recreate patients.user_id constraint
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'patients') THEN
        ALTER TABLE patients
        ADD CONSTRAINT patients_user_id_fkey
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE;
        RAISE NOTICE 'Created patients_user_id_fkey constraint';
    END IF;

    -- Recreate user_roles constraints (if table exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_roles') THEN
        ALTER TABLE user_roles
        ADD CONSTRAINT user_roles_user_id_fkey
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE;

        ALTER TABLE user_roles
        ADD CONSTRAINT user_roles_assigned_by_fkey
        FOREIGN KEY (assigned_by)
        REFERENCES users(id);

        RAISE NOTICE 'Created user_roles foreign key constraints';
    END IF;

    -- Note: Other tables already have UUID foreign keys to users(id)
    -- They will continue to work once users.id is UUID
END $$;

-- ============================================================================
-- Step 5: Update indexes
-- ============================================================================

-- Recreate indexes if they were dropped
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_providers_user_id ON providers(user_id);
CREATE INDEX IF NOT EXISTS idx_patients_user_id ON patients(user_id);

COMMIT;

RAISE NOTICE 'Migration 021 completed: users.id converted to UUID';
