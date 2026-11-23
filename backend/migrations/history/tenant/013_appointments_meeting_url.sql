-- appointments.meeting_url in every tenant schema.
--
-- Global migration 049 added the column to the pre-cutover appointments table, so schemas
-- cloned from it (template, tenant_default on upgraded installs) have it — but a database
-- built from scratch never got it in the tenant tables, and every telehealth link write
-- (appointments.js, the portal booking, short links for meetings) failed with 42703.
-- A no-op where the column already exists.
--
-- RUN THROUGH THE TENANT RUNNER (npm run migrate:tenants): names are unqualified.

DO $$
BEGIN
  IF to_regclass('appointments') IS NULL THEN
    RAISE NOTICE '013: no appointments table in schema %, skipped', current_schema();
    RETURN;
  END IF;
  ALTER TABLE appointments ADD COLUMN IF NOT EXISTS meeting_url TEXT;
END $$;
