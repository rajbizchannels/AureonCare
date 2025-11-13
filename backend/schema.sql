-- MedFlow Database Schema
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- USERS TABLE (Must be defined first - referenced by patients)
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  role VARCHAR(100) DEFAULT 'user',
  practice VARCHAR(255),
  avatar VARCHAR(10),
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(20),
  license VARCHAR(50),
  specialty VARCHAR(100),
  password_hash VARCHAR(255),
  reset_token VARCHAR(255),
  reset_token_expires TIMESTAMP,
  preferences JSONB DEFAULT '{}',
  language VARCHAR(10) DEFAULT 'en',
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- PATIENTS TABLE
-- ============================================================================
-- Note: patients.id directly references users.id (no separate user_id column)
-- A patient IS a user, so they share the same ID
CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  mrn VARCHAR(50) UNIQUE NOT NULL,
  dob DATE,
  date_of_birth DATE,
  gender VARCHAR(50),
  phone VARCHAR(20),
  email VARCHAR(255),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(2),
  zip VARCHAR(10),
  insurance VARCHAR(100),
  insurance_id VARCHAR(100),
  status VARCHAR(50) DEFAULT 'Active',
  portal_enabled BOOLEAN DEFAULT FALSE,
  portal_password_hash VARCHAR(255),
  emergency_contact JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- PROVIDERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS providers (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  specialization VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(20),
  license_number VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- APPOINTMENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS appointments (
  id SERIAL PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  provider_id INTEGER REFERENCES providers(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  time TIME NOT NULL,
  type VARCHAR(100),
  appointment_type VARCHAR(100),
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  duration INTEGER,
  duration_minutes INTEGER,
  reason TEXT,
  notes TEXT,
  status VARCHAR(50) DEFAULT 'Scheduled',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- CLAIMS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS claims (
  id SERIAL PRIMARY KEY,
  claim_number VARCHAR(50) UNIQUE NOT NULL,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  payer VARCHAR(100),
  payer_id VARCHAR(100),
  amount DECIMAL(10, 2),
  status VARCHAR(50) DEFAULT 'Pending',
  date DATE,
  service_date DATE,
  diagnosis_codes JSONB,
  procedure_codes JSONB,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- NOTIFICATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50),
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- TASKS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  priority VARCHAR(50) DEFAULT 'Medium',
  due_date DATE,
  status VARCHAR(50) DEFAULT 'Pending',
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_patients_mrn ON patients(mrn);
CREATE INDEX IF NOT EXISTS idx_patients_email ON patients(email);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_provider ON appointments(provider_id);
CREATE INDEX IF NOT EXISTS idx_claims_patient ON claims(patient_id);
CREATE INDEX IF NOT EXISTS idx_claims_claim_number ON claims(claim_number);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);

-- ============================================================================
-- SAMPLE DATA (optional - can be removed for production)
-- ============================================================================

-- Insert sample admin user
INSERT INTO users (id, name, first_name, last_name, role, practice, avatar, email, phone, license, specialty, preferences)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Dr. Sarah Chen',
  'Sarah',
  'Chen',
  'admin',
  'Central Medical Group',
  'SC',
  'sarah.chen@medflow.com',
  '(555) 123-4567',
  'MD-123456',
  'Internal Medicine',
  '{"emailNotifications": true, "smsAlerts": true, "darkMode": true}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- Insert sample provider
INSERT INTO providers (id, user_id, first_name, last_name, specialization, email, phone, license_number)
VALUES (
  1,
  'a0000000-0000-0000-0000-000000000001',
  'Sarah',
  'Chen',
  'Family Medicine',
  'dr.chen@medflow.com',
  '+1-555-0100',
  'MD-123456'
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================
COMMENT ON TABLE users IS 'Core users table - all system users (staff, doctors, patients)';
COMMENT ON TABLE patients IS 'Patient records - id references users.id directly (no separate user_id)';
COMMENT ON TABLE providers IS 'Healthcare providers - references users via user_id';
COMMENT ON TABLE appointments IS 'Patient appointments with providers';
COMMENT ON TABLE claims IS 'Insurance claims for patient services';

COMMENT ON COLUMN patients.id IS 'Primary key - references users.id directly (patient IS a user)';
COMMENT ON COLUMN providers.user_id IS 'Optional reference to users table for provider login';
