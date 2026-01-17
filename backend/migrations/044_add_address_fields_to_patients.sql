-- Migration 044: Add city, state, zip columns to patients table
-- These columns are referenced in the application but were missing from the database

-- Add city column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'patients' AND column_name = 'city'
    ) THEN
        ALTER TABLE patients ADD COLUMN city VARCHAR(100);
        RAISE NOTICE 'Added city column to patients table';
    ELSE
        RAISE NOTICE 'city column already exists in patients table';
    END IF;
END $$;

-- Add state column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'patients' AND column_name = 'state'
    ) THEN
        ALTER TABLE patients ADD COLUMN state VARCHAR(2);
        RAISE NOTICE 'Added state column to patients table';
    ELSE
        RAISE NOTICE 'state column already exists in patients table';
    END IF;
END $$;

-- Add zip column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'patients' AND column_name = 'zip'
    ) THEN
        ALTER TABLE patients ADD COLUMN zip VARCHAR(10);
        RAISE NOTICE 'Added zip column to patients table';
    ELSE
        RAISE NOTICE 'zip column already exists in patients table';
    END IF;
END $$;

-- Add insurance column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'patients' AND column_name = 'insurance'
    ) THEN
        ALTER TABLE patients ADD COLUMN insurance VARCHAR(100);
        RAISE NOTICE 'Added insurance column to patients table';
    ELSE
        RAISE NOTICE 'insurance column already exists in patients table';
    END IF;
END $$;

-- Add insurance_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'patients' AND column_name = 'insurance_id'
    ) THEN
        ALTER TABLE patients ADD COLUMN insurance_id VARCHAR(100);
        RAISE NOTICE 'Added insurance_id column to patients table';
    ELSE
        RAISE NOTICE 'insurance_id column already exists in patients table';
    END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN patients.city IS 'Patient city';
COMMENT ON COLUMN patients.state IS 'Patient state (2-letter code)';
COMMENT ON COLUMN patients.zip IS 'Patient ZIP/postal code';
COMMENT ON COLUMN patients.insurance IS 'Insurance provider name';
COMMENT ON COLUMN patients.insurance_id IS 'Insurance member ID';
