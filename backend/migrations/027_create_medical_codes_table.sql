-- Migration 027: Create medical_codes table for ICD-10 and CPT codes
-- This table stores all medical codes (diagnosis and procedure codes) for the system

CREATE TABLE IF NOT EXISTS medical_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  code_type VARCHAR(20) NOT NULL, -- 'ICD-10' or 'CPT'
  category VARCHAR(100), -- Category for grouping (e.g., 'Primary Care', 'Chronic Conditions')
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient searching
CREATE INDEX IF NOT EXISTS idx_medical_codes_code ON medical_codes(code);
CREATE INDEX IF NOT EXISTS idx_medical_codes_type ON medical_codes(code_type);
CREATE INDEX IF NOT EXISTS idx_medical_codes_category ON medical_codes(category);
CREATE INDEX IF NOT EXISTS idx_medical_codes_description ON medical_codes USING gin(to_tsvector('english', description));
CREATE INDEX IF NOT EXISTS idx_medical_codes_code_prefix ON medical_codes(code text_pattern_ops);

-- Add comments for documentation
COMMENT ON TABLE medical_codes IS 'Stores all medical codes including ICD-10 diagnosis codes and CPT procedure codes';
COMMENT ON COLUMN medical_codes.code IS 'The medical code (e.g., I10, 99213)';
COMMENT ON COLUMN medical_codes.description IS 'Full description of the medical code';
COMMENT ON COLUMN medical_codes.code_type IS 'Type of code: ICD-10 for diagnoses, CPT for procedures';
COMMENT ON COLUMN medical_codes.category IS 'Category for grouping codes (e.g., Primary Care, Chronic Conditions)';
COMMENT ON COLUMN medical_codes.is_active IS 'Whether this code is currently active/valid';
