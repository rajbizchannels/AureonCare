-- Migration: Add social_history, previous_medications, and additional_current_medications fields to patients table
-- These fields support the Patient Health Metrics feature in PatientHistoryView

-- Add social_history column (TEXT for free-form social history notes)
ALTER TABLE patients ADD COLUMN IF NOT EXISTS social_history TEXT;

-- Add previous_medications column (JSONB for structured medication history)
-- Format: [{ndc_code, drug_name, strength, dosage_form, generic_name, drug_class, ...}]
ALTER TABLE patients ADD COLUMN IF NOT EXISTS previous_medications JSONB DEFAULT '[]'::jsonb;

-- Add additional_current_medications column (JSONB for medications not from prescriptions)
-- Format: [{ndc_code, drug_name, strength, dosage_form, generic_name, drug_class, ...}]
ALTER TABLE patients ADD COLUMN IF NOT EXISTS additional_current_medications JSONB DEFAULT '[]'::jsonb;

-- Add comments for documentation
COMMENT ON COLUMN patients.social_history IS 'Patient social history including smoking, alcohol, occupation, etc.';
COMMENT ON COLUMN patients.previous_medications IS 'JSON array of previous medications with NDC codes and drug details';
COMMENT ON COLUMN patients.additional_current_medications IS 'JSON array of additional current medications not from prescriptions';
