-- Migration 109: the free Listing plan.
--
-- €0, no end date: a practice's public page, its "Find a practice" listing and online booking
-- requests (with the booking setup they need) — 1 provider, 1 location, 1 staff user, 1 GB of
-- hosted photos. Everything else answers "choose a plan" (middleware/listingGate.js, keyed on
-- the plan feature "listing"). Practices start it from the signup page ("List my practice
-- free") and move up by starting a free trial of a paid plan (once) or subscribing.
-- Safe to paste into the Supabase SQL editor as postgres, and to re-run.

SET search_path TO public;

INSERT INTO public.subscription_plans
  (name, display_name, description, price, currency, billing_cycle, trial_days, is_active, self_serve,
   max_users, max_patients, max_providers, features, tier, is_tier_default,
   included_providers, extra_provider_price, included_locations, max_locations, extra_location_price, storage_gb)
SELECT 'listing', 'Listing', 'Free: your public practice page, a listing in "Find a practice" and online booking requests.',
       0, 'eur', 'monthly', 0, true, false,
       1, -1, 1, '{"listing": true}'::jsonb, 'listing', true,
       1, NULL, 1, 1, NULL, 1
WHERE NOT EXISTS (SELECT 1 FROM public.subscription_plans WHERE name = 'listing');

CREATE TABLE IF NOT EXISTS public.schema_migrations (
  filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now(), executed BOOLEAN NOT NULL DEFAULT TRUE);
INSERT INTO public.schema_migrations (filename, executed) VALUES ('109_listing_plan.sql', TRUE)
ON CONFLICT (filename) DO NOTHING;
