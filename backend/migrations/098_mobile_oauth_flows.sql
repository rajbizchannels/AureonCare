-- Migration 098: Google / Microsoft sign-in from the mobile app.
--
-- The app does not hold OAuth client ids or secrets (it can point at any AureonCare server).
-- It opens the system browser at the server, the server runs the provider sign-in with its
-- existing web client, and hands the app a ONE-TIME code through the app's own link
-- (aureoncare://…). The app redeems it with the PKCE verifier only it knows, so another app
-- that intercepts the link cannot use the code.
--
-- One row per sign-in attempt, alive for minutes:
--   started  — state_hash, the app's code_challenge, where to send the app back, and the
--              server's own PKCE verifier for the provider
--   returned — the provider's tokens, ENCRYPTED (utils/messageCrypto), and code_hash
--   redeemed — used_at set; the tokens are wiped
-- Only SHA-256 hashes of state and code are stored.
--
-- Safe to paste into the SQL editor and safe to re-run; records itself in the ledger.

SET search_path TO public;

CREATE TABLE IF NOT EXISTS public.mobile_oauth_flows (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider           varchar(16) NOT NULL CHECK (provider IN ('google', 'microsoft')),
  state_hash         char(64) NOT NULL UNIQUE,
  app_challenge      varchar(128) NOT NULL,
  app_redirect       text NOT NULL,
  provider_verifier  text NOT NULL,
  code_hash          char(64) UNIQUE,
  token_ciphertext   text,
  token_iv           text,
  token_tag          text,
  expires_at         timestamptz NOT NULL,
  used_at            timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mobile_oauth_flows_expiry ON public.mobile_oauth_flows (expires_at);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aureoncare_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.mobile_oauth_flows TO aureoncare_app;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.schema_migrations (
  filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now(), executed BOOLEAN NOT NULL DEFAULT TRUE);
INSERT INTO public.schema_migrations (filename, executed) VALUES ('098_mobile_oauth_flows.sql', TRUE)
ON CONFLICT (filename) DO NOTHING;
