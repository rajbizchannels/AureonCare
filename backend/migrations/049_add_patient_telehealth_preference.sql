-- Add telehealth_preference column to patients table.
-- Stores the patient's preferred video platform (zoom, google_meet,
-- microsoft_teams, webex) or NULL for "use clinic default".
-- Only meaningful when multiple providers are enabled.

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS telehealth_preference VARCHAR(50) DEFAULT NULL;

COMMENT ON COLUMN patients.telehealth_preference IS
  'Preferred telehealth provider (zoom, google_meet, microsoft_teams, webex). NULL = clinic default.';
