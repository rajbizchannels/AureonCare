-- Migration 093: memberships — one person, several practices (Phase 1).
--
-- Until now an account belonged to exactly one practice: users.practice_id and users.role.
-- In practice a doctor works at two clinics, a receptionist covers for a sister practice,
-- a consultant is admin at one and doctor at another. A membership is (person, practice,
-- role); the account (login, password, MFA, social sign-in) stays one row in users.
--
-- users.practice_id / users.role keep their meaning as the account's DEFAULT practice —
-- where a sign-in starts — so every existing reader keeps working. A session works in one
-- ACTIVE practice at a time (the token's practice claim, re-checked against this table on
-- every request), with the role of that membership.
--
-- A trigger mirrors every write of users.practice_id / users.role into this table, so the
-- code paths that create or bind accounts (invites, sign-up, domain joins, the Patients
-- screen) keep the two in step without having to know about memberships.
--
-- Safe to paste into the SQL editor and safe to re-run; records itself in the ledger.

SET search_path TO public;

CREATE TABLE IF NOT EXISTS public.memberships (
  user_id       uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  practice_id   uuid NOT NULL REFERENCES public.practices(id) ON DELETE CASCADE,
  role          varchar(50) NOT NULL,
  status        varchar(12) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  last_used_at  timestamptz,
  PRIMARY KEY (user_id, practice_id)
);
CREATE INDEX IF NOT EXISTS idx_memberships_practice ON public.memberships (practice_id, status);

-- Every account bound to a practice gets its membership.
INSERT INTO public.memberships (user_id, practice_id, role)
SELECT id, practice_id, COALESCE(role, 'staff') FROM public.users WHERE practice_id IS NOT NULL
ON CONFLICT (user_id, practice_id) DO NOTHING;

-- Keep memberships in step with the legacy columns.
CREATE OR REPLACE FUNCTION public.sync_membership_from_user() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.practice_id IS NOT NULL THEN
    INSERT INTO public.memberships (user_id, practice_id, role)
    VALUES (NEW.id, NEW.practice_id, COALESCE(NEW.role, 'staff'))
    ON CONFLICT (user_id, practice_id) DO UPDATE
      SET role = EXCLUDED.role, status = 'active', updated_at = now()
      WHERE memberships.role IS DISTINCT FROM EXCLUDED.role OR memberships.status <> 'active';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_membership ON public.users;
CREATE TRIGGER trg_sync_membership
  AFTER INSERT OR UPDATE OF practice_id, role ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_membership_from_user();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aureoncare_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.memberships TO aureoncare_app;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.schema_migrations (
  filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now(), executed BOOLEAN NOT NULL DEFAULT TRUE);
INSERT INTO public.schema_migrations (filename, executed) VALUES ('093_memberships.sql', TRUE)
ON CONFLICT (filename) DO NOTHING;
