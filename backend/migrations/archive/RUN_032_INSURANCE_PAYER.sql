-- ============================================================================
-- Migration 032: Add insurance_payer_id to patients table
-- ============================================================================
-- Run this file to fix the error: column "insurance_payer_id" does not exist
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Add insurance_payer_id column to patients table
DO $$
BEGIN
    -- Check if the column already exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'patients' AND column_name = 'insurance_payer_id'
    ) THEN
        -- Add the column
        ALTER TABLE patients
        ADD COLUMN insurance_payer_id UUID;

        RAISE NOTICE 'Added insurance_payer_id column to patients table';
    ELSE
        RAISE NOTICE 'insurance_payer_id column already exists in patients table';
    END IF;
END $$;

-- Add foreign key constraint to insurance_payers table
DO $$
BEGIN
    -- Check if the constraint already exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'patients_insurance_payer_id_fkey'
    ) THEN
        -- Add foreign key constraint
        ALTER TABLE patients
        ADD CONSTRAINT patients_insurance_payer_id_fkey
        FOREIGN KEY (insurance_payer_id)
        REFERENCES insurance_payers(id)
        ON DELETE SET NULL;

        RAISE NOTICE 'Added foreign key constraint patients_insurance_payer_id_fkey';
    ELSE
        RAISE NOTICE 'Foreign key constraint patients_insurance_payer_id_fkey already exists';
    END IF;
END $$;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_patients_insurance_payer_id
ON patients(insurance_payer_id);

-- Add comment for documentation
COMMENT ON COLUMN patients.insurance_payer_id IS 'Foreign key to insurance_payers table - patients default/primary insurance payer';

-- Verification query
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'patients'
  AND column_name = 'insurance_payer_id';

SELECT 'Migration 032 completed successfully!' AS status;
