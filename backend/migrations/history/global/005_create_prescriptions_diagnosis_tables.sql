-- Create Prescriptions Table
CREATE TABLE IF NOT EXISTS prescriptions (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
  provider_id INTEGER REFERENCES providers(id) ON DELETE SET NULL,
  appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
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
  id SERIAL PRIMARY KEY,
  patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
  provider_id INTEGER REFERENCES providers(id) ON DELETE SET NULL,
  appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
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
