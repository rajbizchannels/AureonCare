-- Migration 065: SEC-05 Model D — Step S3: bind each user to one practice (tenant)
--
-- Q2 resolved: staff are isolated to a single practice, so one column suffices.
-- Adds users.practice_id, ensures a default practice exists and the default tenant
-- links to it, and backfills every existing user to that practice. Left NULLABLE for
-- now (new-user write paths get updated before a later NOT NULL enforcement) so this
-- cannot break account creation. Idempotent; depends on migration 063 (control plane).

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS practice_id uuid;

DO $$
DECLARE
  v_practice uuid;
BEGIN
  -- Reuse the practice the default tenant already points at, else the first existing
  -- practice, else create one — so there is always exactly one default practice.
  SELECT practice_id INTO v_practice FROM control.tenants WHERE slug = 'default';

  IF v_practice IS NULL THEN
    SELECT id INTO v_practice FROM public.practices ORDER BY created_at ASC LIMIT 1;
    IF v_practice IS NULL THEN
      INSERT INTO public.practices (name) VALUES ('Default Clinic') RETURNING id INTO v_practice;
    END IF;
    UPDATE control.tenants SET practice_id = v_practice, updated_at = now() WHERE slug = 'default';
  END IF;

  -- Backfill all existing users to the default practice.
  UPDATE public.users SET practice_id = v_practice WHERE practice_id IS NULL;
END $$;

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_practice_id_fkey;
ALTER TABLE public.users
  ADD CONSTRAINT users_practice_id_fkey FOREIGN KEY (practice_id) REFERENCES public.practices(id);

CREATE INDEX IF NOT EXISTS idx_users_practice_id ON public.users(practice_id);
