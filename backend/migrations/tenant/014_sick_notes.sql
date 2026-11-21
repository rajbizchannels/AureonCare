-- Sick notes, per practice schema. See global migration 096, which also creates this
-- table everywhere and is the one to paste into the SQL editor; this file exists so the
-- tenant runner (npm run migrate:tenants) knows about it. Names are unqualified.

DO $$
BEGIN
  IF to_regclass('patients') IS NULL THEN
    RAISE NOTICE '014_sick_notes: no patients table in schema %, skipped', current_schema();
    RETURN;
  END IF;
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
      );
  CREATE INDEX IF NOT EXISTS idx_sick_notes_patient ON sick_notes(patient_id, created_at DESC);
END $$;
