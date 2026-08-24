-- Migration 070: SEC-05 Model D — Step S11: per-tenant subscriptions & entitlements
--
-- Moves billing from the single-tenant organization_settings.current_plan_id to a
-- per-tenant subscription in the control plane. The plan CATALOG stays in
-- public.subscription_plans (a plan definition is the same for every tenant); each
-- tenant gets one control.subscriptions row referencing a plan, carrying its Stripe
-- ids and status. A non-current status (past_due/canceled) flips the tenant read-only.
--
-- Additive; touches only the control schema (+ a seed reading public catalogs).
-- Idempotent.

CREATE TABLE IF NOT EXISTS control.subscriptions (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              uuid NOT NULL UNIQUE REFERENCES control.tenants(id),
  practice_id            uuid,                          -- denormalized for fast entitlement lookup
  plan_id                integer,                       -- -> public.subscription_plans(id)
  plan_name              varchar(100),                  -- snapshot of the plan name
  status                 varchar(20) NOT NULL DEFAULT 'active', -- trialing|active|past_due|canceled
  seats                  integer NOT NULL DEFAULT 0,    -- additional provider seats purchased
  enforcement_enabled    boolean NOT NULL DEFAULT true,
  stripe_customer_id     varchar(255),
  stripe_subscription_id varchar(255),
  trial_end              timestamptz,
  current_period_end     timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_control_subs_practice ON control.subscriptions(practice_id);
CREATE INDEX IF NOT EXISTS idx_control_subs_stripe_cust ON control.subscriptions(stripe_customer_id);

-- Seed a subscription for every existing tenant that lacks one: active, on the first
-- active plan in the catalog (or no plan -> enforcement fails open until assigned).
INSERT INTO control.subscriptions (tenant_id, practice_id, plan_id, plan_name, status)
SELECT t.id, t.practice_id, sp.id, sp.name, 'active'
FROM control.tenants t
LEFT JOIN LATERAL (
  SELECT id, name FROM public.subscription_plans WHERE is_active = true ORDER BY price NULLS FIRST, id LIMIT 1
) sp ON true
WHERE NOT EXISTS (SELECT 1 FROM control.subscriptions s WHERE s.tenant_id = t.id)
ON CONFLICT (tenant_id) DO NOTHING;
