-- Migration 007: Link users and patients tables (UUID version)
-- Compatible with UUID-based schema from migrate-enhanced.js

-- Add user_id column to patients table to link to users
ALTER TABLE patients ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Create index for user_id lookups
CREATE INDEX IF NOT EXISTS idx_patients_user_id ON patients(user_id);

-- For existing patient users without patient records, create them
-- This is a one-time data migration
INSERT INTO patients (
  user_id,
  first_name,
  last_name,
  mrn,
  date_of_birth,
  email,
  phone,
  status,
  created_at,
  updated_at
)
SELECT
  u.id,
  u.first_name,
  u.last_name,
  CONCAT('MRN-', SUBSTRING(u.id::text, 1, 8)) as mrn,
  COALESCE(CURRENT_DATE - INTERVAL '30 years', CURRENT_DATE) as date_of_birth,
  u.email,
  u.phone,
  'active' as status,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM users u
WHERE u.role = 'patient'
  AND NOT EXISTS (
    SELECT 1 FROM patients p WHERE p.user_id = u.id
  )
ON CONFLICT (mrn) DO NOTHING;

-- Create or replace function to automatically create patient record when a user with role='patient' is created
CREATE OR REPLACE FUNCTION create_patient_for_user()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'patient' THEN
    -- Check if patient record already exists
    IF NOT EXISTS (SELECT 1 FROM patients WHERE user_id = NEW.id) THEN
      -- Create patient record
      INSERT INTO patients (
        user_id,
        first_name,
        last_name,
        mrn,
        date_of_birth,
        email,
        phone,
        status
      ) VALUES (
        NEW.id,
        NEW.first_name,
        NEW.last_name,
        CONCAT('MRN-', SUBSTRING(NEW.id::text, 1, 8)),
        CURRENT_DATE - INTERVAL '30 years', -- Default DOB, should be updated by patient
        NEW.email,
        NEW.phone,
        'active'
      )
      ON CONFLICT (mrn) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-create patient records
DROP TRIGGER IF EXISTS trigger_create_patient_for_user ON users;
CREATE TRIGGER trigger_create_patient_for_user
  AFTER INSERT OR UPDATE OF role ON users
  FOR EACH ROW
  EXECUTE FUNCTION create_patient_for_user();

-- Comments for documentation
COMMENT ON COLUMN patients.user_id IS 'Links to users table for authentication. For patients who have portal access.';
COMMENT ON FUNCTION create_patient_for_user() IS 'Automatically creates a patient record when a user with role=patient is created or updated';
COMMENT ON TRIGGER trigger_create_patient_for_user ON users IS 'Ensures patient records exist for all users with role=patient';
