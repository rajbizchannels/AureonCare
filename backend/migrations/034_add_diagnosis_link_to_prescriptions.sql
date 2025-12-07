-- Add diagnosis link to prescriptions table
-- This allows prescriptions to be linked to the diagnosis that prompted them

DO $$
BEGIN
  -- Add diagnosis_id column to prescriptions table if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prescriptions' AND column_name = 'diagnosis_id'
  ) THEN
    ALTER TABLE prescriptions
    ADD COLUMN diagnosis_id UUID REFERENCES diagnoses(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_prescriptions_diagnosis_id ON prescriptions(diagnosis_id);

    RAISE NOTICE 'Added diagnosis_id column to prescriptions table';
  ELSE
    RAISE NOTICE 'diagnosis_id column already exists in prescriptions table';
  END IF;
END $$;
