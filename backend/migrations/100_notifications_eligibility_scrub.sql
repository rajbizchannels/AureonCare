-- Migration 100: notification settings, insurance eligibility checks, pre-submission claim
-- checks and low-stock alert state.
--
--   staff_notification_preferences  each staff member's choice, per notification and per
--                                   channel (in-app / email / WhatsApp). No row = the default
--                                   in backend/services/staffNotifications.js.
--   eligibility_checks              every eligibility (270/271) check run for a patient, with
--                                   the coverage summary the payer returned.
--   claims.scrub_*                  the last pre-submission check of a claim; submission is
--                                   refused until a check with no errors is on record (or an
--                                   admin/billing manager overrides with a reason).
--   inventory_items.low_stock_alerted_at
--                                   when the low-stock alert went out, so it is sent once per
--                                   dip below the reorder level, not on every movement.
--
-- Lives with the chart, in each practice's schema. This ONE file registers the new tables for
-- practices created later and creates/alters them in `template` and every existing practice.
-- Safe to paste into the SQL editor and to re-run. Run as the database OWNER (postgres).

SET search_path TO public;

-- SEC-53: Clinic Settings read and wrote ONE shared organization_settings row (name, NPI, website,
-- currency) and the OLDEST row of public.practices, whichever practice the admin belonged to. The
-- practice's own row now carries its NPI, website and currency. The values everyone saw so far are
-- copied across: currency to every practice (it is what each of them displayed), NPI and website
-- only when there is a single practice (otherwise there is no telling whose they were).
ALTER TABLE public.practices ADD COLUMN IF NOT EXISTS npi varchar(10);
ALTER TABLE public.practices ADD COLUMN IF NOT EXISTS website varchar(200);
ALTER TABLE public.practices ADD COLUMN IF NOT EXISTS currency varchar(3);
DO $sec53$
DECLARE org jsonb; n int;
BEGIN
  IF to_regclass('public.organization_settings') IS NULL THEN RETURN; END IF;
  SELECT settings INTO org FROM public.organization_settings ORDER BY id LIMIT 1;
  IF org IS NULL THEN RETURN; END IF;
  UPDATE public.practices SET currency = upper(org->>'currency')
   WHERE currency IS NULL AND COALESCE(org->>'currency', '') ~ '^[A-Za-z]{3}$';
  SELECT count(*) INTO n FROM public.practices;
  IF n = 1 THEN
    UPDATE public.practices SET
      npi = COALESCE(npi, NULLIF(org->>'npi', '')),
      website = COALESCE(website, NULLIF(org->>'website', ''));
  END IF;
END $sec53$;

INSERT INTO control.tenant_tables (table_name, sort_order) VALUES
  ('staff_notification_preferences', 550),
  ('eligibility_checks', 560)
ON CONFLICT (table_name) DO NOTHING;

DO $fan$
DECLARE s text; done int := 0; skipped int := 0;
BEGIN
  FOR s IN SELECT 'template'::text UNION ALL SELECT schema_name FROM control.tenants ORDER BY 1 LOOP
    IF to_regclass(format('%I.patients', s)) IS NULL THEN skipped := skipped + 1; CONTINUE; END IF;
    EXECUTE format('SET search_path TO %I, public', s);

    EXECUTE $t$
      CREATE TABLE IF NOT EXISTS staff_notification_preferences (
        user_id     uuid NOT NULL,
        event_key   varchar(60) NOT NULL,
        channel     varchar(20) NOT NULL CHECK (channel IN ('in_app', 'email', 'whatsapp')),
        enabled     boolean NOT NULL,
        updated_at  timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, event_key, channel)
      )$t$;

    EXECUTE $t$
      CREATE TABLE IF NOT EXISTS eligibility_checks (
        id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id       uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        appointment_id   uuid,
        claim_id         uuid,
        payer_id         uuid,
        payer_name       varchar(200),
        member_id        varchar(80),
        service_date     date NOT NULL,
        service_type     varchar(10) NOT NULL DEFAULT '30',
        status           varchar(12) NOT NULL CHECK (status IN ('active', 'inactive', 'unknown', 'error')),
        coverage         jsonb NOT NULL DEFAULT '{}'::jsonb,
        message          text,
        vendor_reference varchar(120),
        checked_by       uuid,
        checked_at       timestamptz NOT NULL DEFAULT now()
      )$t$;
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_eligibility_checks_patient ON eligibility_checks(patient_id, checked_at DESC)';

    IF to_regclass(format('%I.claims', s)) IS NOT NULL THEN
      EXECUTE 'ALTER TABLE claims ADD COLUMN IF NOT EXISTS scrub_status varchar(12)';
      EXECUTE 'ALTER TABLE claims ADD COLUMN IF NOT EXISTS scrub_result jsonb';
      EXECUTE 'ALTER TABLE claims ADD COLUMN IF NOT EXISTS scrubbed_at timestamptz';
      EXECUTE 'ALTER TABLE claims ADD COLUMN IF NOT EXISTS scrub_override_by uuid';
      EXECUTE 'ALTER TABLE claims ADD COLUMN IF NOT EXISTS scrub_override_reason text';
    END IF;
    IF to_regclass(format('%I.inventory_items', s)) IS NOT NULL THEN
      EXECUTE 'ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS low_stock_alerted_at timestamptz';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aureoncare_app') THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I.staff_notification_preferences TO aureoncare_app', s);
      EXECUTE format('GRANT SELECT, INSERT ON %I.eligibility_checks TO aureoncare_app', s);
    END IF;
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I.schema_migrations (version integer PRIMARY KEY, name text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())', s);
    EXECUTE format('INSERT INTO %I.schema_migrations (version, name) VALUES (16, %L) ON CONFLICT (version) DO NOTHING', s, '016_notifications_eligibility_scrub.sql');
    done := done + 1;
  END LOOP;
  SET search_path TO public;
  RAISE NOTICE '100 notifications/eligibility/scrub: applied in % schema(s); % skipped (no patients table)', done, skipped;
END $fan$;

CREATE TABLE IF NOT EXISTS public.schema_migrations (
  filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now(), executed BOOLEAN NOT NULL DEFAULT TRUE);
INSERT INTO public.schema_migrations (filename, executed) VALUES ('100_notifications_eligibility_scrub.sql', TRUE)
ON CONFLICT (filename) DO NOTHING;
