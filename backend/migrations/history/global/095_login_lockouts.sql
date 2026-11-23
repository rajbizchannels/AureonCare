-- Migration 095: lock an account after 4 wrong passwords (staff sign-in and patient portal).
--
-- One row per email that has had recent wrong passwords, keyed by a keyed hash of the
-- address (never the address itself). The 4th wrong password within 15 minutes sets
-- locked_until; a successful sign-in, a password reset or an administrator's "Unlock"
-- deletes the row. See backend/services/loginLockout.js.
--
-- Until this is applied the app signs people in WITHOUT lockout (it fails open).
-- Safe to paste into the SQL editor and safe to re-run; records itself in the ledger.

SET search_path TO public;

CREATE TABLE IF NOT EXISTS public.login_lockouts (
  key_hash        char(64) PRIMARY KEY,
  scope           varchar(10) NOT NULL CHECK (scope IN ('staff', 'portal')),
  failed_count    integer NOT NULL DEFAULT 0,
  last_failed_at  timestamptz NOT NULL DEFAULT now(),
  locked_until    timestamptz
);
CREATE INDEX IF NOT EXISTS idx_login_lockouts_locked ON public.login_lockouts (locked_until) WHERE locked_until IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aureoncare_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.login_lockouts TO aureoncare_app;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.schema_migrations (
  filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now(), executed BOOLEAN NOT NULL DEFAULT TRUE);
INSERT INTO public.schema_migrations (filename, executed) VALUES ('095_login_lockouts.sql', TRUE)
ON CONFLICT (filename) DO NOTHING;
