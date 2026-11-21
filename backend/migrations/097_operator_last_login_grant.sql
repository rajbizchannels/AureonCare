-- Migration 097: let the app role record an operator's last_login, and nothing else.
--
-- Migration 073 revokes INSERT/UPDATE/DELETE on control.operators from aureoncare_app
-- (credentials are read-only to the app), but POST /api/platform/login stamps
-- last_login after a successful sign-in. Without this grant that UPDATE fails with
-- "permission denied for table operators" and the login returns 500.
--
-- Column-level grant: password_hash, mfa_secret, role and status stay unwritable.
-- Safe to paste into the SQL editor and safe to re-run; records itself in the ledger.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aureoncare_app')
     AND to_regclass('control.operators') IS NOT NULL THEN
    GRANT UPDATE (last_login) ON control.operators TO aureoncare_app;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.schema_migrations (
  filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now(), executed BOOLEAN NOT NULL DEFAULT TRUE);
INSERT INTO public.schema_migrations (filename, executed) VALUES ('097_operator_last_login_grant.sql', TRUE)
ON CONFLICT (filename) DO NOTHING;
