-- Migration: Add country field to users, patients, and practices tables
-- Date: 2025-11-21
-- Description: Adds country field to support timezone calculation based on location

-- Add country field to users table (for providers and other users)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS country VARCHAR(2);

COMMENT ON COLUMN users.country IS 'ISO 3166-1 alpha-2 country code (e.g., US, CA, GB)';

-- Add country field to patients table
ALTER TABLE patients
ADD COLUMN IF NOT EXISTS country VARCHAR(2);

COMMENT ON COLUMN patients.country IS 'ISO 3166-1 alpha-2 country code (e.g., US, CA, GB)';

-- Add country field to practices table
ALTER TABLE practices
ADD COLUMN IF NOT EXISTS country VARCHAR(2);

COMMENT ON COLUMN practices.country IS 'ISO 3166-1 alpha-2 country code (e.g., US, CA, GB)';

-- Add timezone field to users table (auto-calculated from country)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS timezone VARCHAR(100);

COMMENT ON COLUMN users.timezone IS 'IANA timezone string (e.g., America/New_York)';

-- Add timezone field to patients table (auto-calculated from country)
ALTER TABLE patients
ADD COLUMN IF NOT EXISTS timezone VARCHAR(100);

COMMENT ON COLUMN patients.timezone IS 'IANA timezone string (e.g., America/New_York)';

-- Add timezone field to practices table (auto-calculated from country)
ALTER TABLE practices
ADD COLUMN IF NOT EXISTS timezone VARCHAR(100);

COMMENT ON COLUMN practices.timezone IS 'IANA timezone string (e.g., America/New_York)';

-- Create index for faster country-based queries
CREATE INDEX IF NOT EXISTS idx_users_country ON users(country);
CREATE INDEX IF NOT EXISTS idx_patients_country ON patients(country);
CREATE INDEX IF NOT EXISTS idx_practices_country ON practices(country);

-- Create index for timezone-based queries
CREATE INDEX IF NOT EXISTS idx_users_timezone ON users(timezone);
CREATE INDEX IF NOT EXISTS idx_patients_timezone ON patients(timezone);
CREATE INDEX IF NOT EXISTS idx_practices_timezone ON practices(timezone);

-- Set default timezone for existing records to UTC
UPDATE users SET timezone = 'UTC' WHERE timezone IS NULL;
UPDATE patients SET timezone = 'UTC' WHERE timezone IS NULL;
UPDATE practices SET timezone = 'UTC' WHERE timezone IS NULL;
