-- Migration 099: patients can REQUEST a sick note (web portal and mobile app).
--
-- The patient says which days they need covering, what for (work / school / other) and
-- why. A clinician reviews it: issues a note (pre-filled from the request; the note links
-- back to it) or declines it with a reason. The patient is emailed either way and sees the
-- status in the portal. Nothing is issued automatically — a sick note is a clinical
-- statement, and only a clinician makes it.
--
-- Lives with the chart, in each practice's schema. This ONE file registers the table for
-- practices created later and creates it in `template` and every existing practice.
-- Safe to paste into the SQL editor and to re-run. Run as the database OWNER (postgres).

SET search_path TO public;

INSERT INTO control.tenant_tables (table_name, sort_order) VALUES ('sick_note_requests', 540)
ON CONFLICT (table_name) DO NOTHING;

DO $fan$
DECLARE s text; done int := 0; skipped int := 0;
BEGIN
  FOR s IN SELECT 'template'::text UNION ALL SELECT schema_name FROM control.tenants ORDER BY 1 LOOP
    IF to_regclass(format('%I.patients', s)) IS NULL THEN skipped := skipped + 1; CONTINUE; END IF;
    EXECUTE format('SET search_path TO %I, public', s);
    EXECUTE $t$
      CREATE TABLE IF NOT EXISTS sick_note_requests (
        id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id       uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        purpose          varchar(12) NOT NULL DEFAULT 'work' CHECK (purpose IN ('work', 'school', 'other')),
        start_date       date NOT NULL,
        end_date         date NOT NULL,
        reason           text NOT NULL,
        status           varchar(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'issued', 'declined', 'cancelled')),
        sick_note_id     uuid,
        decided_by       uuid,
        decision_reason  text,
        decided_at       timestamptz,
        created_at       timestamptz NOT NULL DEFAULT now(),
        CHECK (end_date >= start_date)
      )$t$;
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_sick_note_requests_patient ON sick_note_requests(patient_id, created_at DESC)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_sick_note_requests_pending ON sick_note_requests(created_at) WHERE status = ''pending''';
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aureoncare_app') THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE ON %I.sick_note_requests TO aureoncare_app', s);
    END IF;
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I.schema_migrations (version integer PRIMARY KEY, name text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())', s);
    EXECUTE format('INSERT INTO %I.schema_migrations (version, name) VALUES (15, %L) ON CONFLICT (version) DO NOTHING', s, '015_sick_note_requests.sql');
    done := done + 1;
  END LOOP;
  SET search_path TO public;
  RAISE NOTICE '099 sick_note_requests: created in % schema(s); % skipped (no patients table)', done, skipped;
END $fan$;

CREATE TABLE IF NOT EXISTS public.schema_migrations (
  filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now(), executed BOOLEAN NOT NULL DEFAULT TRUE);
INSERT INTO public.schema_migrations (filename, executed) VALUES ('099_sick_note_requests.sql', TRUE)
ON CONFLICT (filename) DO NOTHING;
