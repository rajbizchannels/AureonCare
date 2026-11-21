-- Migration 096: sick notes (medical certificates of unfitness for work or school).
--
-- A clinician issues a note from the patient's chart: not fit / may be fit with
-- adjustments, the period, what is written as the condition, comments. Notes are never
-- edited or deleted — a mistake is VOIDED (with a reason) and a new one issued, so a note
-- someone was handed can always be checked against the record. Each has a reference
-- (SN-YYYY-XXXXXX) printed on it.
--
-- The table lives with the chart, in each practice's schema. This ONE file does all of it
-- and is safe to paste into the SQL editor (and to re-run):
--   1. registers sick_notes in control.tenant_tables, so practices created later get it;
--   2. creates it in `template` and in every existing practice schema;
--   3. records itself in both ledgers (so the tenant runner's 014 is a no-op afterwards).
-- Run as the database OWNER (postgres), not aureoncare_app.

SET search_path TO public;

-- After patients (10) and portal_invites (520).
INSERT INTO control.tenant_tables (table_name, sort_order) VALUES ('sick_notes', 530)
ON CONFLICT (table_name) DO NOTHING;

DO $fan$
DECLARE s text; done int := 0; skipped int := 0;
BEGIN
  FOR s IN SELECT 'template'::text UNION ALL SELECT schema_name FROM control.tenants ORDER BY 1 LOOP
    IF to_regclass(format('%I.patients', s)) IS NULL THEN skipped := skipped + 1; CONTINUE; END IF;
    EXECUTE format('SET search_path TO %I, public', s);
    EXECUTE $t$
      CREATE TABLE IF NOT EXISTS sick_notes (
        id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        reference           varchar(32) NOT NULL UNIQUE,
        patient_id          uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        purpose             varchar(12) NOT NULL DEFAULT 'work' CHECK (purpose IN ('work', 'school', 'other')),
        fitness             varchar(12) NOT NULL CHECK (fitness IN ('not_fit', 'may_be_fit')),
        assessed_on         date NOT NULL,
        start_date          date NOT NULL,
        end_date            date NOT NULL,
        condition_text      text,
        adjustments         text[] NOT NULL DEFAULT '{}',
        comments            text,
        follow_up           boolean NOT NULL DEFAULT false,
        issued_by           uuid NOT NULL,
        issuer_name         varchar(200) NOT NULL,
        issuer_title        varchar(100),
        issuer_registration varchar(100),
        status              varchar(10) NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'voided')),
        void_reason         text,
        voided_by           uuid,
        voided_at           timestamptz,
        emailed_at          timestamptz,
        created_at          timestamptz NOT NULL DEFAULT now(),
        CHECK (end_date >= start_date)
      )$t$;
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_sick_notes_patient ON sick_notes(patient_id, created_at DESC)';
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aureoncare_app') THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE ON %I.sick_notes TO aureoncare_app', s);
    END IF;
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I.schema_migrations (version integer PRIMARY KEY, name text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())', s);
    EXECUTE format('INSERT INTO %I.schema_migrations (version, name) VALUES (14, %L) ON CONFLICT (version) DO NOTHING', s, '014_sick_notes.sql');
    done := done + 1;
  END LOOP;
  SET search_path TO public;
  RAISE NOTICE '096 sick_notes: created in % schema(s); % skipped (no patients table)', done, skipped;
END $fan$;

CREATE TABLE IF NOT EXISTS public.schema_migrations (
  filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now(), executed BOOLEAN NOT NULL DEFAULT TRUE);
INSERT INTO public.schema_migrations (filename, executed) VALUES ('096_sick_notes.sql', TRUE)
ON CONFLICT (filename) DO NOTHING;
