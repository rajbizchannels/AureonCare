-- DO NOT PASTE INTO THE SQL EDITOR. Tenant-runner file (npm run migrate:tenants): it runs inside each
-- practice schema with unqualified names. For production, paste the matching global migration instead.
-- Appointment reminder delivery log (one row per reminder sent, per recipient and channel). Global
-- migration 106 does the same in every schema and is the one to paste into the SQL editor.

DO $$
BEGIN
  IF to_regclass('appointments') IS NULL THEN
    RAISE NOTICE '019_appointment_reminders: no appointments table in schema %, skipped', current_schema();
    RETURN;
  END IF;
  CREATE TABLE IF NOT EXISTS reminder_deliveries (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    kind           varchar(20) NOT NULL CHECK (kind IN ('patient', 'provider', 'digest')),
    appointment_id uuid REFERENCES appointments(id) ON DELETE CASCADE,
    recipient_id   uuid NOT NULL,
    channel        varchar(20) NOT NULL CHECK (channel IN ('in_app', 'email', 'whatsapp')),
    for_date       date,
    status         varchar(20) NOT NULL DEFAULT 'sent',
    error          text,
    sent_at        timestamptz NOT NULL DEFAULT now()
  );
  CREATE UNIQUE INDEX IF NOT EXISTS reminder_deliveries_once ON reminder_deliveries
    (kind, COALESCE(appointment_id, '00000000-0000-0000-0000-000000000000'::uuid), recipient_id, channel, COALESCE(for_date, '1970-01-01'::date));
  CREATE INDEX IF NOT EXISTS reminder_deliveries_sent_at ON reminder_deliveries (sent_at);
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aureoncare_app') THEN
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I.reminder_deliveries TO aureoncare_app', current_schema());
  END IF;
END $$;
