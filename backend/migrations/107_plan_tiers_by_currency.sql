-- Migration 107: plan variants by currency.
--
-- A plan TIER (Essentials, Pro, Enterprise…) can have one variant per currency — e.g. Pro in EUR
-- and Pro in GBP. Each variant is its own row in public.subscription_plans (own price, own Stripe
-- price), grouped by `tier`. One variant per tier is the DEFAULT.
--
-- Practices and the signup page are shown, per tier, the variant in the clinic's currency (its
-- Clinic Settings currency; on signup, the country entered or the browser's region) when there is
-- one, otherwise the tier's default variant. See services/planCatalog.js.
--
-- Existing plans become single-variant tiers named after their key, each its own default, so
-- nothing changes until an operator adds a variant in another currency in the platform console.
-- Safe to paste into the Supabase SQL editor as postgres, and to re-run.

SET search_path TO public;

ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS tier varchar(50);
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS is_tier_default boolean NOT NULL DEFAULT false;

UPDATE public.subscription_plans SET tier = name WHERE tier IS NULL;
-- A tier with no default gets its oldest variant as the default.
UPDATE public.subscription_plans p SET is_tier_default = true
 WHERE p.id = (SELECT min(q.id) FROM public.subscription_plans q WHERE q.tier = p.tier)
   AND NOT EXISTS (SELECT 1 FROM public.subscription_plans d WHERE d.tier = p.tier AND d.is_tier_default);

ALTER TABLE public.subscription_plans ALTER COLUMN tier SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS subscription_plans_one_default_per_tier ON public.subscription_plans (tier) WHERE is_tier_default;
CREATE UNIQUE INDEX IF NOT EXISTS subscription_plans_one_variant_per_currency ON public.subscription_plans (tier, lower(currency)) WHERE is_active;

-- A plan created without a tier (older code paths) is its own tier; the first variant of a tier
-- becomes its default.
CREATE OR REPLACE FUNCTION public.subscription_plans_tier_defaults() RETURNS trigger LANGUAGE plpgsql AS $f$
BEGIN
  IF NEW.tier IS NULL OR btrim(NEW.tier) = '' THEN NEW.tier := NEW.name; END IF;
  IF NOT NEW.is_tier_default AND NOT EXISTS (
       SELECT 1 FROM public.subscription_plans WHERE tier = NEW.tier AND is_tier_default AND id IS DISTINCT FROM NEW.id) THEN
    NEW.is_tier_default := true;
  END IF;
  RETURN NEW;
END $f$;
DROP TRIGGER IF EXISTS subscription_plans_tier_defaults ON public.subscription_plans;
CREATE TRIGGER subscription_plans_tier_defaults BEFORE INSERT ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.subscription_plans_tier_defaults();

CREATE TABLE IF NOT EXISTS public.schema_migrations (
  filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now(), executed BOOLEAN NOT NULL DEFAULT TRUE);
INSERT INTO public.schema_migrations (filename, executed) VALUES ('107_plan_tiers_by_currency.sql', TRUE)
ON CONFLICT (filename) DO NOTHING;
