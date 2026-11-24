-- Migration 108: tier billing — base price per practice, with providers and locations included, a
-- price per extra provider and per extra location, and a cap on each; hosted storage per tier.
--
-- public.subscription_plans (each currency variant has its own prices):
--   included_providers     providers the base price covers
--   max_providers          (existing) the most providers the tier allows in total; -1 = no limit
--   extra_provider_price   monthly price of each provider above the included ones
--   included_locations / max_locations / extra_location_price   the same for locations
--   storage_gb             files AureonCare hosts (message attachments, profile photos, backups); -1 = no limit
--   stripe_provider_price_id / stripe_location_price_id   the add-on prices in Stripe (pushed from the platform)
-- control.subscriptions: seats (existing) = extra providers bought; extra_locations = extra locations bought.
--
-- Staff (non-provider) users and patients are unlimited on every paid tier. AI and messaging have no
-- caps: every integration is bring-your-own-key, so the practice pays its own providers directly.
-- Safe to paste into the Supabase SQL editor as postgres, and to re-run.

SET search_path TO public;

ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS included_providers integer,
  ADD COLUMN IF NOT EXISTS extra_provider_price numeric(10,2),
  ADD COLUMN IF NOT EXISTS included_locations integer,
  ADD COLUMN IF NOT EXISTS max_locations integer,
  ADD COLUMN IF NOT EXISTS extra_location_price numeric(10,2),
  ADD COLUMN IF NOT EXISTS storage_gb integer,
  ADD COLUMN IF NOT EXISTS stripe_provider_price_id varchar(255),
  ADD COLUMN IF NOT EXISTS stripe_location_price_id varchar(255);

ALTER TABLE control.subscriptions ADD COLUMN IF NOT EXISTS extra_locations integer NOT NULL DEFAULT 0;

-- The recommended tiers (by tier key, so every currency variant gets the same allowances; the
-- per-unit prices below are the EUR ones — set other currencies' in the platform console).
UPDATE public.subscription_plans SET included_providers = 1, max_providers = 1, extra_provider_price = NULL,
       included_locations = 1, max_locations = 1, extra_location_price = NULL, storage_gb = 10,
       max_users = -1, max_patients = -1, updated_at = CURRENT_TIMESTAMP
 WHERE COALESCE(to_jsonb(subscription_plans)->>'tier', name) = 'essentials';
UPDATE public.subscription_plans SET included_providers = 3, max_providers = 10,
       extra_provider_price = CASE WHEN lower(currency) = 'eur' THEN 25 ELSE extra_provider_price END,
       included_locations = 1, max_locations = 3,
       extra_location_price = CASE WHEN lower(currency) = 'eur' THEN 29 ELSE extra_location_price END,
       storage_gb = 50, max_users = -1, max_patients = -1,
       features = COALESCE(features, '{}'::jsonb) || '{"multiLocation": true}'::jsonb, updated_at = CURRENT_TIMESTAMP
 WHERE COALESCE(to_jsonb(subscription_plans)->>'tier', name) = 'clinical_pro';
UPDATE public.subscription_plans SET included_providers = 5, max_providers = -1,
       extra_provider_price = CASE WHEN lower(currency) = 'eur' THEN 29 ELSE extra_provider_price END,
       included_locations = 3, max_locations = -1,
       extra_location_price = CASE WHEN lower(currency) = 'eur' THEN 19 ELSE extra_location_price END,
       storage_gb = 200, max_users = -1, max_patients = -1,
       features = COALESCE(features, '{}'::jsonb) || '{"multiLocation": true}'::jsonb, updated_at = CURRENT_TIMESTAMP
 WHERE COALESCE(to_jsonb(subscription_plans)->>'tier', name) = 'enterprise';
-- Older screens read the per-seat price from base_price_per_provider; keep it in step.
UPDATE public.subscription_plans SET base_price_per_provider = extra_provider_price
 WHERE included_providers IS NOT NULL;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT name FROM public.subscription_plans
            WHERE included_providers IS NOT NULL AND stripe_product_id IS NOT NULL AND (extra_provider_price IS NOT NULL OR extra_location_price IS NOT NULL) LOOP
    RAISE NOTICE 'Plan % is linked to Stripe: use "Re-create price in Stripe" in the platform console to add its extra-provider and extra-location prices.', r.name;
  END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS public.schema_migrations (
  filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now(), executed BOOLEAN NOT NULL DEFAULT TRUE);
INSERT INTO public.schema_migrations (filename, executed) VALUES ('108_tier_billing.sql', TRUE)
ON CONFLICT (filename) DO NOTHING;
