-- Migration 086: make every subscription change auditable and accountable
--
-- Three gaps this closes, all of them about a plan change leaving no trace:
--
--   1. WHO. control.audit_log can only name an OPERATOR (operator_id references
--      control.operators). A practice admin changing their own plan through
--      /api/plans/current is not an operator, so that change could not be attributed at
--      all — it was simply absent from the platform audit trail. actor_type/actor_label
--      let the trail record a tenant user, the Stripe webhook, or a scheduled job as the
--      actor without pretending any of them is an operator.
--
--   2. CASH vs ACCRUAL. control.billing_events is summed as collected revenue
--      (billingLedger.summary, perTenantTotals). A proration is NOT collected revenue: it
--      is a credit and a charge recognised at the moment of the change and settled on a
--      LATER invoice, which will itself arrive as invoice.paid. Posting proration amounts
--      into the same column would count that money twice. entry_kind separates the two:
--      'cash' is money that moved (every row written until now, hence the default),
--      'accrual' is an obligation dated at the change and settled later.
--
--   3. WHEN THE PERIOD STARTED. Prorating a change for a tenant we invoice ourselves
--      needs the period it falls inside. Only current_period_end was stored, so the start
--      had to be guessed from the billing cycle. Stripe sends both; store both. Existing
--      rows stay null and the application falls back to deriving the start from the cycle.
--
-- Idempotent.

-- Migration 066 set the DATABASE default search_path to 'tenant_default, public, control',
-- so unqualified DDL in a global migration lands in tenant_default. Pin and qualify
-- everything. See 072_global_runtime_ddl.sql.
SET search_path TO public;

-- ─── 1. who performed an audited action ──────────────────────────────────────────────

ALTER TABLE control.audit_log
  ADD COLUMN IF NOT EXISTS actor_type  varchar(16),
  ADD COLUMN IF NOT EXISTS actor_label varchar(255);

-- Deliberately NOT backfilled. control.audit_log is append-only and the trigger from
-- migration 069 blocks UPDATE, so rewriting history here would mean disabling the very
-- guarantee the table exists to provide. Rows written before this migration carry null,
-- and readers derive the actor the only way it is honestly knowable for them:
--   COALESCE(actor_type, CASE WHEN operator_id IS NOT NULL THEN 'operator' ELSE 'system' END)
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

-- ─── 2. cash vs accrual in the billing ledger ────────────────────────────────────────

-- ADD COLUMN ... DEFAULT is a catalog-only change in PostgreSQL 11+: no table rewrite, and
-- no row trigger fires, so the append-only trigger from 077 is not in the way.
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

-- ─── 3. the period a proration falls inside ──────────────────────────────────────────

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

DO $verify$
DECLARE
  has_actor boolean; has_kind boolean; has_start boolean; cash_rows bigint;
BEGIN
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='control' AND table_name='audit_log' AND column_name='actor_type') INTO has_actor;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='control' AND table_name='billing_events' AND column_name='entry_kind') INTO has_kind;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='control' AND table_name='subscriptions' AND column_name='current_period_start') INTO has_start;
  SELECT count(*) INTO cash_rows FROM control.billing_events WHERE entry_kind = 'cash';

  RAISE NOTICE '086: audit_log.actor_type=% billing_events.entry_kind=% subscriptions.current_period_start=% existing rows defaulted to cash=%',
    has_actor, has_kind, has_start, cash_rows;

  IF NOT has_actor OR NOT has_kind OR NOT has_start THEN
    RAISE WARNING '086: incomplete — expected all three columns present';
  END IF;
END $verify$;
