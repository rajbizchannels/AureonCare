-- Patient portal invitations (Phase 1 of patient onboarding).
--
-- A practice invites a patient it already has on file; the patient opens a one-time link
-- and sets a password or links Google/Microsoft. The invite lives with the patient's
-- chart, in the practice's own schema. Only the SHA-256 of the token is stored, so a
-- database leak yields no usable link. The shared control plane holds just
-- token-hash -> practice (control.portal_invite_route, migration 090), never who it is for.
--
-- RUN THIS THROUGH THE TENANT RUNNER (npm run migrate:tenants). Names are unqualified on
-- purpose: the runner sets search_path to each tenant schema in turn. Pasted into a SQL
-- editor, `patients` resolves against `public`, where it no longer exists, and this fails
-- with 42P01 — use backend/scripts/manual/apply-portal-invites.sql instead.
--
-- A schema with no `patients` table (a half-provisioned practice) is skipped with a notice
-- rather than failing the whole run: there is no chart there to invite anyone to.

DO $$
BEGIN
  IF to_regclass('patients') IS NULL THEN
    RAISE NOTICE '012_portal_invites: no patients table in schema %, skipped', current_schema();
    RETURN;
  END IF;

  CREATE TABLE IF NOT EXISTS portal_invites (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id  uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    token_hash  char(64) NOT NULL UNIQUE,
    email       varchar(255) NOT NULL,            -- where it was sent, for the staff status line
    expires_at  timestamptz NOT NULL,
    used_at     timestamptz,
    revoked_at  timestamptz,
    created_by  uuid,                             -- staff user id (public.users); no FK across planes
    emailed     boolean NOT NULL DEFAULT false,
    created_at  timestamptz NOT NULL DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS idx_portal_invites_patient ON portal_invites(patient_id, created_at DESC);
END $$;
