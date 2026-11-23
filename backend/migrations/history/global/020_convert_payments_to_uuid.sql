-- Convert payments table to use UUID for ID
-- Migration: 020_convert_payments_to_uuid.sql

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Step 1: Add a new UUID column to payments table
ALTER TABLE payments ADD COLUMN IF NOT EXISTS id_uuid UUID DEFAULT gen_random_uuid();

-- Step 2: Populate the UUID column with unique values for existing rows
UPDATE payments SET id_uuid = gen_random_uuid() WHERE id_uuid IS NULL;

-- Step 3: Drop old primary key and id column from payments
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_pkey CASCADE;
ALTER TABLE payments DROP COLUMN IF EXISTS id;

-- Step 4: Rename UUID column to replace old id column
ALTER TABLE payments RENAME COLUMN id_uuid TO id;

-- Step 5: Add primary key constraint
ALTER TABLE payments ADD PRIMARY KEY (id);

-- Step 6: Make id column default to gen_random_uuid()
ALTER TABLE payments ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Step 7: Add foreign key constraint to patient_offering_enrollments
-- This constraint was deferred from migration 018 to run after payments UUID conversion
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'patient_offering_enrollments') THEN
        -- Drop any existing constraint first
        ALTER TABLE patient_offering_enrollments
        DROP CONSTRAINT IF EXISTS patient_offering_enrollments_payment_id_fkey;

        -- Add the UUID foreign key constraint
        ALTER TABLE patient_offering_enrollments
        ADD CONSTRAINT patient_offering_enrollments_payment_id_fkey
        FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Step 8: Recreate indexes
DROP INDEX IF EXISTS idx_payments_patient_id;
DROP INDEX IF EXISTS idx_payments_claim_id;
DROP INDEX IF EXISTS idx_payments_status;

CREATE INDEX idx_payments_patient_id ON payments(patient_id);
CREATE INDEX idx_payments_claim_id ON payments(claim_id);
CREATE INDEX idx_payments_status ON payments(payment_status);

COMMENT ON TABLE payments IS 'Payment tracking with UUID primary key';
COMMENT ON COLUMN payments.id IS 'UUID primary key for payments';
