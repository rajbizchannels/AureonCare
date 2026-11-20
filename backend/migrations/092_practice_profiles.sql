-- Migration 092: public practice profiles and provider listing consent (directory, Phase 2).
--
-- A practice can publish a plain profile — name, about, contact, specialties, locations,
-- photos, and the providers who have CONSENTED to be listed. No reviews, no rankings, no
-- patient data.
--
-- Visibility, chosen by the practice's admins (default OFF):
--   off         /p/<slug> is "not found", even by direct link
--   link        opens by direct link and QR code only; not in search, `noindex` for engines;
--               optionally under an unguessable random address (use_random_link)
--   searchable  opens, and will be listed in the directory search (Phase 3)
--
-- These tables live in the shared `public` schema on purpose: the profile page is opened
-- with no session and no practice context, and it may only ever contain what the practice
-- chose to publish. Locations are a published COPY of selected rows of the practice's own
-- `locations` table (public fields only), refreshed on every save.
--
-- Provider consent is per provider PER PRACTICE (the same doctor may agree at one practice
-- and not another), only the provider can give or withdraw it, and every change is kept
-- in an append-only event log with the consent text version.
--
-- Safe to paste into the SQL editor: it records itself in the migration ledger.

SET search_path TO public;

CREATE TABLE IF NOT EXISTS public.practice_profiles (
  practice_id      uuid PRIMARY KEY REFERENCES public.practices(id) ON DELETE CASCADE,
  visibility       varchar(12) NOT NULL DEFAULT 'off' CHECK (visibility IN ('off', 'link', 'searchable')),
  slug             varchar(80) UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  random_slug      varchar(16) UNIQUE CHECK (random_slug ~ '^[A-Za-z0-9]{12,16}$'),
  use_random_link  boolean NOT NULL DEFAULT false,
  display_name     varchar(160),
  about            text CHECK (char_length(about) <= 4000),
  phone            varchar(40),
  email            varchar(160),
  website          varchar(255),
  specialty_codes  text[] NOT NULL DEFAULT '{}',
  location_ids     uuid[] NOT NULL DEFAULT '{}',
  locations        jsonb NOT NULL DEFAULT '[]'::jsonb,
  cover_photo_id   uuid,
  logo_photo_id    uuid,
  updated_by       uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.practice_profile_photos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id  uuid NOT NULL REFERENCES public.practices(id) ON DELETE CASCADE,
  kind         varchar(12) NOT NULL CHECK (kind IN ('cover', 'logo', 'gallery', 'provider')),
  provider_id  uuid,
  mime         varchar(16) NOT NULL CHECK (mime IN ('image/jpeg', 'image/png')),
  bytes        bytea NOT NULL,
  status       varchar(12) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  uploaded_by  uuid,
  reviewed_by  uuid,
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_profile_photos_practice ON public.practice_profile_photos (practice_id, kind, sort_order);

CREATE TABLE IF NOT EXISTS public.provider_listing_consents (
  practice_id      uuid NOT NULL REFERENCES public.practices(id) ON DELETE CASCADE,
  provider_id      uuid NOT NULL,
  consented        boolean NOT NULL DEFAULT false,
  show_photo       boolean NOT NULL DEFAULT false,
  show_bio         boolean NOT NULL DEFAULT false,
  show_languages   boolean NOT NULL DEFAULT false,
  show_specialties boolean NOT NULL DEFAULT true,
  bio              text CHECK (char_length(bio) <= 1500),
  languages        text[] NOT NULL DEFAULT '{}',
  specialty_codes  text[] NOT NULL DEFAULT '{}',
  photo_id         uuid,
  consent_version  varchar(20),
  consented_at     timestamptz,
  withdrawn_at     timestamptz,
  hidden_by_admin  boolean NOT NULL DEFAULT false,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (practice_id, provider_id)
);

-- Append-only history: visibility changes, consents, withdrawals, hides, photo decisions.
CREATE TABLE IF NOT EXISTS public.directory_events (
  id           bigserial PRIMARY KEY,
  practice_id  uuid NOT NULL,
  provider_id  uuid,
  action       varchar(32) NOT NULL,
  detail       jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id     uuid,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_directory_events_practice ON public.directory_events (practice_id, created_at DESC);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aureoncare_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.practice_profiles, public.practice_profile_photos,
      public.provider_listing_consents TO aureoncare_app;
    GRANT SELECT, INSERT ON public.directory_events TO aureoncare_app;
    REVOKE UPDATE, DELETE ON public.directory_events FROM aureoncare_app;
    GRANT USAGE, SELECT ON SEQUENCE public.directory_events_id_seq TO aureoncare_app;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.schema_migrations (
  filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now(), executed BOOLEAN NOT NULL DEFAULT TRUE);
INSERT INTO public.schema_migrations (filename, executed) VALUES ('092_practice_profiles.sql', TRUE)
ON CONFLICT (filename) DO NOTHING;
