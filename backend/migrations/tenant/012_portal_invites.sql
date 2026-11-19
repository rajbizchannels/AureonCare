-- Patient portal invitations (Phase 1 of patient onboarding).
--
-- A practice invites a patient it already has on file; the patient opens a one-time link
-- and sets a password or links Google/Microsoft. The invite lives with the patient's
-- chart, in the practice's own schema. Only the SHA-256 of the token is stored, so a
-- database leak yields no usable link. The shared control plane holds just
-- token-hash -> practice (control.portal_invite_route, migration 090), never who it is for.

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
