-- Sick note requests, per practice schema. Global migration 099 also creates this table
-- everywhere and is the one to paste into the SQL editor; this file is for the tenant
-- runner (npm run migrate:tenants). Names are unqualified.

DO $$
BEGIN
  IF to_regclass('patients') IS NULL THEN
    RAISE NOTICE '015_sick_note_requests: no patients table in schema %, skipped', current_schema();
    RETURN;
  END IF;
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
  );
  CREATE INDEX IF NOT EXISTS idx_sick_note_requests_patient ON sick_note_requests(patient_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_sick_note_requests_pending ON sick_note_requests(created_at) WHERE status = 'pending';
END $$;
