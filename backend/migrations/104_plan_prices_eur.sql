-- Migration 104: plan prices in euros — Essentials €49, Pro €79, Enterprise €119 a month.
--
-- The platform catalogue (public.subscription_plans) is the source of truth for prices. Practices
-- read it directly (Subscription page, signup, entitlements), so they see the new prices as soon
-- as this runs. Stripe follows the platform: for a plan already linked to a Stripe price, open the
-- platform console → Plans and use "Re-create price in Stripe" (or save the plan) to push the new
-- amount; then "Apply price to existing subscribers" moves Stripe-billed practices at renewal.
-- A NOTICE below names any plan that needs that push.
--
-- base_price_per_provider is cleared: the new prices are per practice, and the old per-provider
-- rates were in dollars. Safe to paste into the Supabase SQL editor as postgres, and to re-run.

SET search_path TO public;

UPDATE public.subscription_plans SET price = 49,  currency = 'eur', billing_cycle = 'monthly', base_price_per_provider = NULL,
       display_name = 'Essentials', updated_at = CURRENT_TIMESTAMP WHERE name = 'essentials';
UPDATE public.subscription_plans SET price = 79,  currency = 'eur', billing_cycle = 'monthly', base_price_per_provider = NULL,
       display_name = 'Pro', updated_at = CURRENT_TIMESTAMP WHERE name = 'clinical_pro';
UPDATE public.subscription_plans SET price = 119, currency = 'eur', billing_cycle = 'monthly', base_price_per_provider = NULL,
       display_name = 'Enterprise', updated_at = CURRENT_TIMESTAMP WHERE name = 'enterprise';

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT name FROM public.subscription_plans
            WHERE name IN ('essentials', 'clinical_pro', 'enterprise') AND stripe_price_id IS NOT NULL LOOP
    RAISE NOTICE 'Plan % is linked to Stripe: push the new price from the platform console (Plans → Re-create price in Stripe).', r.name;
  END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS public.schema_migrations (
  filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now(), executed BOOLEAN NOT NULL DEFAULT TRUE);
INSERT INTO public.schema_migrations (filename, executed) VALUES ('104_plan_prices_eur.sql', TRUE)
ON CONFLICT (filename) DO NOTHING;
