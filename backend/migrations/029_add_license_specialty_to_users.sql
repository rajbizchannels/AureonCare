-- Migration: Add license_number and specialty columns to users table
-- These columns are used for provider/doctor information

DO $$
BEGIN
    -- Add license_number column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'license_number'
    ) THEN
        ALTER TABLE users ADD COLUMN license_number VARCHAR(100);
        RAISE NOTICE 'Added license_number column to users table';
    END IF;

    -- Add specialty column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'specialty'
    ) THEN
        ALTER TABLE users ADD COLUMN specialty VARCHAR(100);
        RAISE NOTICE 'Added specialty column to users table';
    END IF;
END $$;
