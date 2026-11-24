-- Migration 106: appointment reminders — one row per reminder actually sent, per recipient and
-- channel, so a reminder is never sent twice however often the reminder job runs.
--
--   kind            'patient'  a patient's reminder before their appointment
--                   'provider' the provider's reminder before their appointment
--                   'digest'   a staff member's summary of tomorrow's appointments
--   appointment_id  the appointment (NULL for a digest)
--   recipient_id    patient id or staff user id
--   channel         in_app | email | whatsapp
--   for_date        the day a digest covers (NULL otherwise)
--
-- Per practice schema (and the template new practices are cloned from). Safe to paste into the
-- Supabase SQL editor as postgres, and to re-run. The tenant runner's equivalent is
-- tenant/019_appointment_reminders.sql.

SET search_path TO public;

INSERT INTO control.tenant_tables (table_name, sort_order) VALUES ('reminder_deliveries', 570)
ON CONFLICT (table_name) DO NOTHING;

DO $fan$
DECLARE s text; done int := 0; skipped int := 0;
BEGIN
  FOR s IN SELECT 'template'::text UNION ALL SELECT schema_name FROM control.tenants ORDER BY 1 LOOP
    IF to_regclass(format('%I.appointments', s)) IS NULL THEN skipped := skipped + 1; CONTINUE; END IF;
    EXECUTE format('SET search_path TO %I, public', s);
    EXECUTE $t$
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
      )$t$;
    EXECUTE $t$
      CREATE UNIQUE INDEX IF NOT EXISTS reminder_deliveries_once ON reminder_deliveries
        (kind, COALESCE(appointment_id, '00000000-0000-0000-0000-000000000000'::uuid), recipient_id, channel, COALESCE(for_date, '1970-01-01'::date))$t$;
    EXECUTE 'CREATE INDEX IF NOT EXISTS reminder_deliveries_sent_at ON reminder_deliveries (sent_at)';
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aureoncare_app') THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I.reminder_deliveries TO aureoncare_app', s);
    END IF;
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I.schema_migrations (version integer PRIMARY KEY, name text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())', s);
    EXECUTE format('INSERT INTO %I.schema_migrations (version, name) VALUES (19, %L) ON CONFLICT (version) DO NOTHING', s, '019_appointment_reminders.sql');
    done := done + 1;
  END LOOP;
  SET search_path TO public;
  RAISE NOTICE '106 appointment reminders: applied in % schema(s); % skipped (no appointments table)', done, skipped;
END $fan$;

CREATE TABLE IF NOT EXISTS public.schema_migrations (
  filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now(), executed BOOLEAN NOT NULL DEFAULT TRUE);
INSERT INTO public.schema_migrations (filename, executed) VALUES ('106_appointment_reminders.sql', TRUE)
ON CONFLICT (filename) DO NOTHING;
