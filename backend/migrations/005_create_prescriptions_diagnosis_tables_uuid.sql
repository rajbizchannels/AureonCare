-- Migration 005: Create prescriptions and diagnosis tables (UUID version)
-- Compatible with UUID-based schema from migrate-enhanced.js

-- Create Prescriptions Table
CREATE TABLE IF NOT EXISTS prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES users(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  medication_name VARCHAR(255) NOT NULL,
  dosage VARCHAR(100) NOT NULL,
  frequency VARCHAR(100) NOT NULL,
  duration VARCHAR(100),
  instructions TEXT,
  refills INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'Active',
  prescribed_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Diagnosis Table
CREATE TABLE IF NOT EXISTS diagnosis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES users(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  diagnosis_code VARCHAR(20),
  diagnosis_name VARCHAR(255) NOT NULL,
  description TEXT,
  severity VARCHAR(50),
  status VARCHAR(50) DEFAULT 'Active',
  diagnosed_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add medical attributes columns to patients table
ALTER TABLE patients
ADD COLUMN IF NOT EXISTS height VARCHAR(20),
ADD COLUMN IF NOT EXISTS weight VARCHAR(20),
ADD COLUMN IF NOT EXISTS blood_type VARCHAR(10),
ADD COLUMN IF NOT EXISTS allergies TEXT,
ADD COLUMN IF NOT EXISTS past_history TEXT,
ADD COLUMN IF NOT EXISTS family_history TEXT,
ADD COLUMN IF NOT EXISTS current_medications TEXT;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_provider ON prescriptions(provider_id);
CREATE INDEX IF NOT EXISTS idx_diagnosis_patient ON diagnosis(patient_id);
CREATE INDEX IF NOT EXISTS idx_diagnosis_provider ON diagnosis(provider_id);

-- Add comments for documentation
COMMENT ON TABLE prescriptions IS 'Stores patient prescriptions with medication details';
COMMENT ON TABLE diagnosis IS 'Stores patient diagnoses with ICD codes and severity';
COMMENT ON COLUMN patients.height IS 'Patient height (e.g., 5''10", 178cm)';
COMMENT ON COLUMN patients.weight IS 'Patient weight (e.g., 180 lbs, 82kg)';
COMMENT ON COLUMN patients.blood_type IS 'Patient blood type (e.g., O+, A-, AB+)';
