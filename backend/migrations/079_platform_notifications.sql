-- Email alerts to platform operators when something notable happens.
--
-- The console records everything in control.audit_log, but a trail nobody reads is not a
-- control: an operator account created at 3am, a break-glass session opened over a
-- tenant's PHI, or a customer's card failing are all things somebody should learn about
-- without going looking.
--
-- Idempotent.

-- Per-operator opt-out. On by default: the events routed here are ones an operator in that
-- role should know about, and an alert nobody asked for is better than a breach nobody
-- noticed. Individuals can turn it off.
ALTER TABLE control.operators
  ADD COLUMN IF NOT EXISTS notify_platform_events boolean NOT NULL DEFAULT true;

-- What was sent, and to whom.
--
-- Two jobs. First, idempotency: Stripe retries webhooks and two instances can process the
-- same delivery, so `dedupe_key` stops one failed payment producing three identical emails.
-- Second, evidence: "we were notified" is part of an incident timeline, and reconstructing
-- it from mail-server logs after the fact is not realistic.
CREATE TABLE IF NOT EXISTS control.platform_notifications (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dedupe_key   text NOT NULL UNIQUE,
  action       varchar(64) NOT NULL,
  severity     varchar(16) NOT NULL DEFAULT 'info',   -- info | warning | critical
  subject      text NOT NULL,
  recipients   text[] NOT NULL DEFAULT '{}',
  tenant_id    uuid,
  actor_id     uuid REFERENCES control.operators(id),
  detail       jsonb,
  sent_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_notifications_sent
  ON control.platform_notifications(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_notifications_action
  ON control.platform_notifications(action);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aureoncare_app') THEN
    GRANT SELECT, INSERT ON control.platform_notifications TO aureoncare_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA control TO aureoncare_app;
  END IF;
END $$;
