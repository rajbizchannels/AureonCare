-- Apply the GLOBAL migration 086 (subscription change audit + accounting).
--
-- Equivalent to the 086 portion of: node backend/run-migrations.js
--
-- Adds three columns and nothing else, so it is quick and carries no risk to existing
-- data. Until it is applied, a subscription change still works but:
--
--   * a plan change made by a practice admin cannot be attributed in the platform audit
--     trail (there is nowhere to record a non-operator actor), and the API will error on
--     the insert;
--   * proration entries cannot be told apart from collected cash in the ledger;
--   * a mid-period change on a manually invoiced tenant is prorated against a period
--     start derived from the billing cycle rather than the recorded one.
--
-- Like the other global migrations this CAN be pasted raw — it is schema-qualified
-- throughout. What is added here is the ledger row, so run-migrations.js does not repeat
-- the work later.
--
-- Safe to re-run.

BEGIN;

-- Migration 066 set the DATABASE default search_path to 'tenant_default, public, control',
-- so unqualified DDL in a global migration lands in tenant_default. Pin and qualify.
SET search_path TO public;

CREATE TABLE IF NOT EXISTS public.schema_migrations (
  filename    TEXT PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  executed    BOOLEAN NOT NULL DEFAULT TRUE
);

-- ─── who performed an audited action ─────────────────────────────────────────────────

ALTER TABLE control.audit_log
  ADD COLUMN IF NOT EXISTS actor_type  varchar(16),
  ADD COLUMN IF NOT EXISTS actor_label varchar(255);

-- Historical rows are deliberately NOT backfilled: control.audit_log is append-only and
-- the trigger from migration 069 blocks UPDATE. Readers derive the actor for those rows
-- from operator_id instead.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'audit_log_actor_type_check') THEN
    ALTER TABLE control.audit_log
      ADD CONSTRAINT audit_log_actor_type_check
      CHECK (actor_type IS NULL OR actor_type IN ('operator', 'tenant_user', 'stripe', 'system'));
  END IF;
END $$;

COMMENT ON COLUMN control.audit_log.actor_type IS
  'operator | tenant_user | stripe | system. Null on rows written before migration 086; derive those from operator_id.';
COMMENT ON COLUMN control.audit_log.actor_label IS
  'Human-readable actor (an email, or "stripe webhook"). operator_id stays the authoritative link for operators.';

-- ─── cash vs accrual in the billing ledger ───────────────────────────────────────────

-- ADD COLUMN ... DEFAULT is catalog-only in PostgreSQL 11+: no rewrite, and the
-- append-only trigger from 077 is a row trigger on UPDATE/DELETE, so it is not in the way.
ALTER TABLE control.billing_events
  ADD COLUMN IF NOT EXISTS entry_kind varchar(16) NOT NULL DEFAULT 'cash';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'billing_events_entry_kind_check') THEN
    ALTER TABLE control.billing_events
      ADD CONSTRAINT billing_events_entry_kind_check
      CHECK (entry_kind IN ('cash', 'accrual'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_billing_events_kind
  ON control.billing_events(entry_kind, occurred_at DESC);

COMMENT ON COLUMN control.billing_events.entry_kind IS
  'cash = money moved (counts towards collected revenue). accrual = recognised at occurred_at and settled on a later invoice (proration credits and charges); excluded from collected totals so it is not counted twice.';
COMMENT ON COLUMN control.billing_events.occurred_at IS
  'When the entry takes effect — for an accrual, the proration date the change was priced at. created_at is when we wrote the row.';

-- ─── the period a proration falls inside ─────────────────────────────────────────────

ALTER TABLE control.subscriptions
  ADD COLUMN IF NOT EXISTS current_period_start timestamptz;

COMMENT ON COLUMN control.subscriptions.current_period_start IS
  'Start of the period current_period_end closes. Populated from Stripe; null on rows predating migration 086 and on tenants not billed through Stripe, where the start is derived from the plan billing cycle.';

-- ─── grants ──────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aureoncare_app') THEN
    GRANT SELECT, INSERT ON control.audit_log, control.billing_events TO aureoncare_app;
    GRANT SELECT, INSERT, UPDATE ON control.subscriptions TO aureoncare_app;
  END IF;
END $$;

INSERT INTO public.schema_migrations (filename, executed)
VALUES ('086_subscription_change_accounting.sql', TRUE)
ON CONFLICT (filename) DO NOTHING;

COMMIT;

DO $verify$
DECLARE has_actor boolean; has_kind boolean; has_start boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='control' AND table_name='audit_log' AND column_name='actor_type') INTO has_actor;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='control' AND table_name='billing_events' AND column_name='entry_kind') INTO has_kind;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='control' AND table_name='subscriptions' AND column_name='current_period_start') INTO has_start;

  IF NOT has_actor OR NOT has_kind OR NOT has_start THEN
    RAISE WARNING '086: incomplete — audit_log.actor_type=% billing_events.entry_kind=% subscriptions.current_period_start=%',
      has_actor, has_kind, has_start;
  ELSE
    RAISE NOTICE 'verified: subscription changes can now be attributed, and prorations are booked apart from collected cash.';
  END IF;
END $verify$;
