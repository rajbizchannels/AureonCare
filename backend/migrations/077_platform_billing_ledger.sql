-- Platform billing ledger: what each tenant was actually invoiced and paid.
--
-- Stripe is the system of record for money, but querying it for every console page is slow,
-- rate-limited, and useless once a key is rotated or an account is closed. This is a local,
-- append-only record of the billing events that matter for reporting and reconciliation,
-- written by the webhook as they happen.
--
-- It is a LEDGER, not a cache: rows are never updated in place. A refund is its own row, a
-- retried payment is its own row. That is what makes a running total reconcilable against
-- Stripe rather than a number that silently drifts.
--
-- Idempotent.

CREATE TABLE IF NOT EXISTS control.billing_events (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id         uuid REFERENCES control.tenants(id),
  practice_id       uuid,
  -- invoice.paid | invoice.payment_failed | charge.refunded | subscription.changed | ...
  event_type        varchar(64) NOT NULL,
  -- Stripe's own id for the object this row describes. UNIQUE so a webhook retry, or two
  -- instances processing the same delivery, cannot double-count revenue.
  stripe_object_id  varchar(255) UNIQUE,
  stripe_customer_id varchar(255),
  -- Signed minor units: positive for money in, negative for refunds/credits. Minor units,
  -- not a numeric, because that is what Stripe reports and rounding twice loses cents.
  amount_minor      bigint NOT NULL DEFAULT 0,
  currency          varchar(3),
  description       text,
  occurred_at       timestamptz NOT NULL DEFAULT now(),
  detail            jsonb,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_events_tenant   ON control.billing_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_occurred ON control.billing_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_events_type     ON control.billing_events(event_type);
CREATE INDEX IF NOT EXISTS idx_billing_events_customer ON control.billing_events(stripe_customer_id);

-- Append-only, enforced in the database rather than by convention. A revenue ledger the
-- application can rewrite is not evidence of anything — the same reasoning as the audit
-- trails in migrations 069 and tenant/002.
CREATE OR REPLACE FUNCTION control.billing_events_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'control.billing_events is append-only (% is not permitted)', TG_OP;
END $$;

DROP TRIGGER IF EXISTS billing_events_no_mutate ON control.billing_events;
CREATE TRIGGER billing_events_no_mutate
  BEFORE UPDATE OR DELETE ON control.billing_events
  FOR EACH ROW EXECUTE FUNCTION control.billing_events_append_only();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aureoncare_app') THEN
    GRANT SELECT, INSERT ON control.billing_events TO aureoncare_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA control TO aureoncare_app;
  END IF;
END $$;

-- One Stripe customer belongs to exactly one tenant. Without this, attributing a payment
-- is a LIMIT 1 over an unconstrained column — two tenants sharing a customer id would send
-- revenue to whichever row came back first. Created only when the data already satisfies
-- it, so the migration cannot fail on a database that needs manual reconciliation first.
DO $$
DECLARE dupes int;
BEGIN
  SELECT count(*) INTO dupes FROM (
    SELECT stripe_customer_id FROM control.subscriptions
     WHERE stripe_customer_id IS NOT NULL
     GROUP BY stripe_customer_id HAVING count(*) > 1
  ) d;
  IF dupes = 0 THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_control_subs_stripe_cust_unique
      ON control.subscriptions(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
  ELSE
    RAISE WARNING '% Stripe customer id(s) are shared by more than one tenant; billing '
      'attribution is ambiguous for those. Reconcile them, then re-run this migration.', dupes;
  END IF;
END $$;
