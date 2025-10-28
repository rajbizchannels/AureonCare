-- Migration 007: Link users and patients tables
-- This migration creates a proper relationship between users (auth) and patients (medical records)

-- Add user_id column to patients table to link to users
ALTER TABLE patients ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- Create index for user_id lookups
CREATE INDEX IF NOT EXISTS idx_patients_user_id ON patients(user_id);

-- For existing patient users without patient records, create them
-- This is a one-time data migration
INSERT INTO patients (
  user_id,
  first_name,
  last_name,
  mrn,
  dob,
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
  CONCAT('MRN-', LPAD(u.id::text, 6, '0')) as mrn,
  COALESCE(CURRENT_DATE - INTERVAL '30 years', CURRENT_DATE) as dob, -- Default DOB, should be updated by patient
  u.email,
  u.phone,
  'Active' as status,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM users u
WHERE u.role = 'patient'
  AND NOT EXISTS (
    SELECT 1 FROM patients p WHERE p.user_id = u.id
  )
ON CONFLICT (mrn) DO NOTHING;

-- Create a function to automatically create patient record when a user with role='patient' is created
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
        dob,
        email,
        phone,
        status
      ) VALUES (
        NEW.id,
        NEW.first_name,
        NEW.last_name,
        CONCAT('MRN-', LPAD(NEW.id::text, 6, '0')),
        CURRENT_DATE - INTERVAL '30 years', -- Default DOB, should be updated by patient
        NEW.email,
        NEW.phone,
        'Active'
      )
      ON CONFLICT (mrn) DO NOTHING;
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
COMMENT ON FUNCTION create_patient_for_user() IS 'Automatically creates a patient record when a user with role=patient is created';
