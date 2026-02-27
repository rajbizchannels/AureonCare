-- Migration: Add meeting_url column to appointments table
-- Stores the pre-generated telehealth meeting URL for Telehealth-type appointments.
-- The column is optional (NULL for non-telehealth appointments).

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS meeting_url TEXT;

COMMENT ON COLUMN appointments.meeting_url IS
  'Telehealth meeting URL automatically generated when appointment_type is Telehealth';

DO $$
BEGIN
  RAISE NOTICE '✓ appointments.meeting_url column added (if not already present)';
END $$;
