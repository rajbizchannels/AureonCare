-- Migration 094: "Work here? Ask to join" from a practice's public profile page.
--
-- join_requests so far held DOMAIN sign-ups: an account already existed (user_id) and
-- waited for approval. A request from a profile page has no account yet — only a name, a
-- work email and the role asked for — so user_id becomes optional and those fields are
-- added. The flow:
--   1. the person submits the form on /p/<practice>/join          -> status 'unverified'
--   2. they click the link emailed to that address (proves it)    -> status 'pending'
--   3. an admin approves in Team access -> a normal staff INVITATION is sent to that email;
--      accepting it (new password, existing account's password, or Google/Microsoft) is
--      what grants access. Rejecting tells them.
-- Only the SHA-256 of the email link's token is stored; it expires after 24 hours.
--
-- Safe to paste into the SQL editor and safe to re-run; records itself in the ledger.

SET search_path TO public;

ALTER TABLE public.join_requests ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.join_requests ADD COLUMN IF NOT EXISTS first_name varchar(100);
ALTER TABLE public.join_requests ADD COLUMN IF NOT EXISTS last_name varchar(100);
ALTER TABLE public.join_requests ADD COLUMN IF NOT EXISTS source varchar(16) NOT NULL DEFAULT 'domain';
ALTER TABLE public.join_requests ADD COLUMN IF NOT EXISTS verify_token_hash char(64);
ALTER TABLE public.join_requests ADD COLUMN IF NOT EXISTS verify_expires_at timestamptz;

-- 'unverified' = waiting for the requester to confirm their email.
ALTER TABLE public.join_requests DROP CONSTRAINT IF EXISTS join_requests_status_check;
ALTER TABLE public.join_requests ADD CONSTRAINT join_requests_status_check
  CHECK (status IN ('unverified', 'pending', 'approved', 'rejected'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_join_requests_verify ON public.join_requests (verify_token_hash) WHERE verify_token_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_join_requests_email ON public.join_requests (practice_id, lower(email), status);

CREATE TABLE IF NOT EXISTS public.schema_migrations (
  filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now(), executed BOOLEAN NOT NULL DEFAULT TRUE);
INSERT INTO public.schema_migrations (filename, executed) VALUES ('094_profile_join_requests.sql', TRUE)
ON CONFLICT (filename) DO NOTHING;
