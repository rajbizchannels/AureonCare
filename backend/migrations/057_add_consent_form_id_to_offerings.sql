-- Migration: 057_add_consent_form_id_to_offerings.sql
-- Replace the free-text consent_form_url with a FK reference to form_templates,
-- so the consent form is selected from the Form Management module.

ALTER TABLE healthcare_offerings
  ADD COLUMN IF NOT EXISTS consent_form_id UUID REFERENCES form_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_offerings_consent_form_id ON healthcare_offerings(consent_form_id);
