-- Migration 091: short links for every URL AureonCare sends or shares.
--
-- /s/<code> on our own domain redirects to the real URL. Self-hosted on purpose: the
-- links carry one-time sign-in tokens (invites, password reset), and a public shortener
-- would hold working account links — and patient context — on a third party's servers.
--
-- Nothing readable is stored. The row key is SHA-256(code) and the destination is
-- AES-256-GCM encrypted under a key derived from the code itself, so a database dump
-- yields neither the codes nor where they lead (same property as the hashed invite and
-- session tokens). A link stops working when its destination does (expires_at).
--
-- Global (public) because /s/<code> is opened with no session and no practice context.
-- Safe to paste into the SQL editor: it records itself in the migration ledger.

SET search_path TO public;

CREATE TABLE IF NOT EXISTS public.short_links (
  code_hash    char(64) PRIMARY KEY,
  iv           bytea NOT NULL,
  tag          bytea NOT NULL,
  target_enc   bytea NOT NULL,
  kind         varchar(32) NOT NULL DEFAULT 'link',
  expires_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  use_count    integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_short_links_expiry ON public.short_links (expires_at) WHERE expires_at IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aureoncare_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.short_links TO aureoncare_app;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.schema_migrations (
  filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now(), executed BOOLEAN NOT NULL DEFAULT TRUE);
INSERT INTO public.schema_migrations (filename, executed) VALUES ('091_short_links.sql', TRUE)
ON CONFLICT (filename) DO NOTHING;
