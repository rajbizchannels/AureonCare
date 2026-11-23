-- Migration 103: practice API keys, for automated data import (POST /api/import/...).
--
-- An admin creates a key under Admin Panel -> Import data. The key is shown once; only its
-- SHA-256 hash and a short prefix (to tell keys apart) are stored. A key belongs to one practice
-- and carries scopes; the only scope today is 'import', so a leaked key can add or update
-- patients and appointments in that practice and nothing else — it cannot read records.
-- Revoked keys stop working at once and are kept for the audit trail.
--
-- Safe to paste into the Supabase SQL editor as postgres, and to re-run.

SET search_path TO public;

CREATE TABLE IF NOT EXISTS public.practice_api_keys (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id  uuid NOT NULL REFERENCES public.practices(id) ON DELETE CASCADE,
  name         varchar(100) NOT NULL,
  key_prefix   varchar(16) NOT NULL,
  key_hash     char(64) NOT NULL UNIQUE,
  scopes       text[] NOT NULL DEFAULT ARRAY['import']::text[],
  created_by   uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);
CREATE INDEX IF NOT EXISTS idx_practice_api_keys_practice ON public.practice_api_keys (practice_id, created_at DESC);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aureoncare_app') THEN
    GRANT SELECT, INSERT, UPDATE ON public.practice_api_keys TO aureoncare_app;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.schema_migrations (
  filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now(), executed BOOLEAN NOT NULL DEFAULT TRUE);
INSERT INTO public.schema_migrations (filename, executed) VALUES ('103_practice_api_keys.sql', TRUE)
ON CONFLICT (filename) DO NOTHING;
