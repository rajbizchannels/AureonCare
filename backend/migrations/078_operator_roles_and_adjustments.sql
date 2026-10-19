-- Operator roles, and attribution for manual billing adjustments.
--
-- Until now every operator was all-powerful: whoever could sign in to the console could
-- change any tenant's plan, issue refunds, and open a break-glass session over PHI. For a
-- console that manages every customer's billing AND can reach clinical data, one
-- undifferentiated role is too coarse — a finance contractor who needs the revenue reports
-- should not be able to open PHI, and a support engineer should not be able to move money.
--
-- Roles (least to most):
--   readonly  read every report; change nothing
--   billing   + plans, coupons, subscriptions, adjustments, free months
--   support   + tenant lifecycle (create/suspend/resume) and break-glass over PHI
--   owner     + manage operators
--
-- Existing operators become `owner` so nothing they can do today stops working; narrow
-- them deliberately afterwards.
--
-- Idempotent.

ALTER TABLE control.operators
  ADD COLUMN IF NOT EXISTS role varchar(20) NOT NULL DEFAULT 'owner';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'operators_role_check'
  ) THEN
    ALTER TABLE control.operators
      ADD CONSTRAINT operators_role_check
      CHECK (role IN ('owner', 'billing', 'support', 'readonly'));
  END IF;
END $$;

-- At least one owner must exist, or nobody can ever grant a role again. Enforced by
-- convention in the route (the last owner cannot be demoted or disabled) rather than by a
-- constraint, because a partial unique index cannot express "at least one".
CREATE INDEX IF NOT EXISTS idx_operators_role ON control.operators(role);

-- Manual credits and debits are attributable: an adjustment that no one signed for is not
-- an accounting record. Stripe-sourced rows leave this null.
ALTER TABLE control.billing_events
  ADD COLUMN IF NOT EXISTS operator_id uuid REFERENCES control.operators(id);

CREATE INDEX IF NOT EXISTS idx_billing_events_operator
  ON control.billing_events(operator_id) WHERE operator_id IS NOT NULL;

-- Free months and coupons applied to a subscription, recorded locally so the console can
-- show what a tenant has been granted without asking Stripe on every page. Stripe remains
-- the authority on whether a discount is still live.
CREATE TABLE IF NOT EXISTS control.subscription_grants (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES control.tenants(id),
  grant_type    varchar(32) NOT NULL,          -- free_months | coupon
  months        integer,                        -- for free_months
  stripe_coupon_id varchar(255),
  reason        text NOT NULL,
  operator_id   uuid REFERENCES control.operators(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_subscription_grants_tenant
  ON control.subscription_grants(tenant_id, created_at DESC);

-- Plan-level free months, expressed in months rather than the trial_days the Stripe
-- Checkout API takes. Keeping both means the console can show "2 free months" while the
-- checkout still sends the day count Stripe requires.
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS free_months integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aureoncare_app') THEN
    GRANT SELECT, INSERT ON control.subscription_grants TO aureoncare_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA control TO aureoncare_app;
  END IF;
END $$;
