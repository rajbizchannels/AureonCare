-- Migration 006: Remove name field and ensure medical attributes exist
-- This migration consolidates and ensures all necessary schema changes

-- ============================================
-- PART 1: Add medical attributes to patients table
-- ============================================

-- Add medical attributes columns to patients table if they don't exist
ALTER TABLE patients
ADD COLUMN IF NOT EXISTS height VARCHAR(20),
ADD COLUMN IF NOT EXISTS weight VARCHAR(20),
ADD COLUMN IF NOT EXISTS blood_type VARCHAR(10),
ADD COLUMN IF NOT EXISTS allergies TEXT,
ADD COLUMN IF NOT EXISTS past_history TEXT,
ADD COLUMN IF NOT EXISTS family_history TEXT,
ADD COLUMN IF NOT EXISTS current_medications TEXT;

-- ============================================
-- PART 2: Ensure users table has first_name and last_name
-- ============================================

-- Add first_name and last_name columns to users table if they don't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);

-- Migrate existing data from name to first_name and last_name (if not already done)
UPDATE users
SET
  first_name = SPLIT_PART(name, ' ', 1),
  last_name = CASE
    WHEN POSITION(' ' IN name) > 0 THEN SUBSTRING(name FROM POSITION(' ' IN name) + 1)
    ELSE ''
  END
WHERE first_name IS NULL AND name IS NOT NULL;

-- Set empty string for NULL last names
UPDATE users
SET last_name = ''
WHERE last_name IS NULL;

-- Set empty string for NULL first names
UPDATE users
SET first_name = ''
WHERE first_name IS NULL;

-- Make first_name and last_name NOT NULL
ALTER TABLE users ALTER COLUMN first_name SET NOT NULL;
ALTER TABLE users ALTER COLUMN last_name SET NOT NULL;

-- ============================================
-- PART 3: Create prescriptions and diagnosis tables if they don't exist
-- ============================================

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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_provider ON prescriptions(provider_id);
CREATE INDEX IF NOT EXISTS idx_diagnosis_patient ON diagnosis(patient_id);
CREATE INDEX IF NOT EXISTS idx_diagnosis_provider ON diagnosis(provider_id);

-- ============================================
-- PART 4: Update schema for enhanced appointments
-- ============================================

-- Add start_time and end_time to appointments if they don't exist
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS start_time TIMESTAMP;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS end_time TIMESTAMP;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS appointment_type VARCHAR(100);

-- Migrate existing date/time to start_time if start_time is NULL
UPDATE appointments
SET start_time = (date + time::time)::timestamp
WHERE start_time IS NULL AND date IS NOT NULL AND time IS NOT NULL;

-- Set end_time based on start_time + duration (default 30 minutes)
UPDATE appointments
SET end_time = start_time + INTERVAL '30 minutes',
    duration_minutes = COALESCE(duration, 30)
WHERE end_time IS NULL AND start_time IS NOT NULL;

-- ============================================
-- NOTES:
-- ============================================
-- The 'name' column in users table is kept for backward compatibility
-- but should no longer be used. All code should reference first_name and last_name.
-- Future migration can safely drop the 'name' column once verified all code uses first_name/last_name.
