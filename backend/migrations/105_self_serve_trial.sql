-- Migration 105: self-serve free trial (no card) and in-app subscribe.
--
-- control.signup_intents gains a kind:
--   'checkout'  the existing paid signup through Stripe Checkout (unchanged)
--   'trial'     a free trial: the email address is confirmed by a one-time link (only its
--               SHA-256 is stored), then the workspace is created as 'trialing' with sample data
--   'upgrade'   a trial (or unbilled) practice subscribing from Settings → Subscription Plans;
--               the Stripe webhook attaches the subscription to that practice (tenant_id)
-- Safe to paste into the Supabase SQL editor as postgres, and to re-run.

SET search_path TO public;

ALTER TABLE control.signup_intents ADD COLUMN IF NOT EXISTS kind varchar(20) NOT NULL DEFAULT 'checkout';
ALTER TABLE control.signup_intents ADD COLUMN IF NOT EXISTS verify_token_hash char(64);
ALTER TABLE control.signup_intents ADD COLUMN IF NOT EXISTS sample_data boolean NOT NULL DEFAULT true;
CREATE UNIQUE INDEX IF NOT EXISTS idx_signup_intents_verify ON control.signup_intents (verify_token_hash)
  WHERE verify_token_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.schema_migrations (
  filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now(), executed BOOLEAN NOT NULL DEFAULT TRUE);
INSERT INTO public.schema_migrations (filename, executed) VALUES ('105_self_serve_trial.sql', TRUE)
ON CONFLICT (filename) DO NOTHING;
