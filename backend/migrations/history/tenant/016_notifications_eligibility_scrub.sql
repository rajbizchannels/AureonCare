-- Notification settings, eligibility checks, claim scrub columns and low-stock alert state,
-- per practice schema. Global migration 100 also applies this everywhere and is the one to
-- paste into the SQL editor; this file is for the tenant runner (npm run migrate:tenants).
-- Names are unqualified.

DO $$
BEGIN
  IF to_regclass('patients') IS NULL THEN
    RAISE NOTICE '016_notifications_eligibility_scrub: no patients table in schema %, skipped', current_schema();
    RETURN;
  END IF;

  CREATE TABLE IF NOT EXISTS staff_notification_preferences (
    user_id     uuid NOT NULL,
    event_key   varchar(60) NOT NULL,
    channel     varchar(20) NOT NULL CHECK (channel IN ('in_app', 'email', 'whatsapp')),
    enabled     boolean NOT NULL,
    updated_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, event_key, channel)
  );

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
  );
  CREATE INDEX IF NOT EXISTS idx_eligibility_checks_patient ON eligibility_checks(patient_id, checked_at DESC);

  IF to_regclass('claims') IS NOT NULL THEN
    ALTER TABLE claims ADD COLUMN IF NOT EXISTS scrub_status varchar(12);
    ALTER TABLE claims ADD COLUMN IF NOT EXISTS scrub_result jsonb;
    ALTER TABLE claims ADD COLUMN IF NOT EXISTS scrubbed_at timestamptz;
    ALTER TABLE claims ADD COLUMN IF NOT EXISTS scrub_override_by uuid;
    ALTER TABLE claims ADD COLUMN IF NOT EXISTS scrub_override_reason text;
  END IF;
  IF to_regclass('inventory_items') IS NOT NULL THEN
    ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS low_stock_alerted_at timestamptz;
  END IF;
END $$;
