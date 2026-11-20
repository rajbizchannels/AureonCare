-- Apply the GLOBAL migration 085 (specialty taxonomy, pack catalogue, practice setup).
--
-- Equivalent to the 085 portion of: node backend/run-migrations.js
--
-- Run this with the other globals, BEFORE apply-tenant-migrations-007-009.sql. The tenant
-- scripts do not depend on it, but the specialty wizard needs all of it, and `packs:load`
-- refuses to run until public.specialties exists.
--
-- Like the other global migrations this CAN be pasted raw — it is schema-qualified
-- throughout. What is added here is the ledger row, so run-migrations.js does not repeat
-- the work later.
--
-- Safe to re-run.

BEGIN;

-- Migration 066 set the DATABASE default search_path to 'tenant_default, public, control',
-- so unqualified DDL in a global migration lands in tenant_default. Pin and qualify.
SET search_path TO public;

CREATE TABLE IF NOT EXISTS public.schema_migrations (
  filename    TEXT PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  executed    BOOLEAN NOT NULL DEFAULT TRUE
);

-- ─── taxonomy ────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.specialties (
  code          varchar(60) PRIMARY KEY,
  name          varchar(150) NOT NULL,
  parent_code   varchar(60) REFERENCES public.specialties(code),
  taxonomy_code varchar(20),
  is_active     boolean NOT NULL DEFAULT true,
  sort_order    integer NOT NULL DEFAULT 0,
  created_at    timestamp DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_specialties_parent ON public.specialties (parent_code);

INSERT INTO public.specialties (code, name, sort_order) VALUES
  ('general_practice',   'General Practice / Family Medicine', 10),
  ('internal_medicine',  'Internal Medicine',                  20),
  ('paediatrics',        'Paediatrics',                        30),
  ('obstetrics_gynae',   'Obstetrics & Gynaecology',           40),
  ('dentistry',          'Dentistry',                          50),
  ('ophthalmology',      'Ophthalmology',                      60),
  ('ent',                'ENT / Otolaryngology',               70),
  ('dermatology',        'Dermatology',                        80),
  ('orthopaedics',       'Orthopaedics',                       90),
  ('cardiology',         'Cardiology',                        100),
  ('neurology',          'Neurology',                         110),
  ('gastroenterology',   'Gastroenterology',                  120),
  ('pulmonology',        'Pulmonology',                       130),
  ('nephrology',         'Nephrology',                        140),
  ('urology',            'Urology',                           150),
  ('endocrinology',      'Endocrinology & Diabetes',          160),
  ('oncology',           'Oncology',                          170),
  ('rheumatology',       'Rheumatology',                      180),
  ('psychiatry',         'Psychiatry',                        190),
  ('behavioral_health',  'Behavioural Health & Counselling',  200),
  ('physiotherapy',      'Physiotherapy & Rehabilitation',    210),
  ('fertility',          'Fertility / IVF',                   220),
  ('radiology',          'Radiology & Imaging',               230),
  ('pathology',          'Pathology & Laboratory Medicine',   240),
  ('anaesthesiology',    'Anaesthesiology',                   250),
  ('general_surgery',    'General Surgery',                   260),
  ('plastic_surgery',    'Plastic & Reconstructive Surgery',  270),
  ('vascular_surgery',   'Vascular Surgery',                  280),
  ('neurosurgery',       'Neurosurgery',                      290),
  ('cardiac_surgery',    'Cardiothoracic Surgery',            300),
  ('emergency_medicine', 'Emergency Medicine',                310),
  ('geriatrics',         'Geriatrics',                        320),
  ('nutrition',          'Nutrition & Dietetics',             330),
  ('audiology',          'Audiology & Speech Therapy',        340),
  ('podiatry',           'Podiatry',                          350),
  ('occupational_health','Occupational Health',               360)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.specialties (code, name, parent_code, sort_order) VALUES
  ('paediatric_cardiology', 'Paediatric Cardiology',   'paediatrics',      31),
  ('neonatology',           'Neonatology',             'paediatrics',      32),
  ('orthodontics',          'Orthodontics',            'dentistry',        51),
  ('endodontics',           'Endodontics',             'dentistry',        52),
  ('periodontics',          'Periodontics',            'dentistry',        53),
  ('oral_surgery',          'Oral & Maxillofacial Surgery', 'dentistry',   54),
  ('retina',                'Vitreoretinal Surgery',   'ophthalmology',    61),
  ('cornea',                'Cornea & Refractive',     'ophthalmology',    62),
  ('interventional_cardiology', 'Interventional Cardiology', 'cardiology', 101),
  ('electrophysiology',     'Cardiac Electrophysiology', 'cardiology',    102),
  ('spine_surgery',         'Spine Surgery',           'orthopaedics',     91),
  ('sports_medicine',       'Sports Medicine',         'orthopaedics',     92),
  ('joint_replacement',     'Joint Replacement',       'orthopaedics',     93)
ON CONFLICT (code) DO NOTHING;

-- ─── pack catalogue ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.specialty_packs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code           varchar(60) NOT NULL,
  version        integer NOT NULL,
  label          varchar(150),
  definition     jsonb NOT NULL,
  is_active      boolean NOT NULL DEFAULT true,
  clinical_review_status varchar(20) NOT NULL DEFAULT 'pending',
  reviewed_by    varchar(255),
  reviewed_at    timestamp,
  published_at   timestamp DEFAULT CURRENT_TIMESTAMP,
  created_at     timestamp DEFAULT CURRENT_TIMESTAMP,
  updated_at     timestamp DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT specialty_packs_review_chk
    CHECK (clinical_review_status IN ('pending', 'approved', 'withdrawn')),
  CONSTRAINT specialty_packs_version_chk CHECK (version > 0),
  CONSTRAINT uq_specialty_packs UNIQUE (code, version)
);

CREATE INDEX IF NOT EXISTS idx_specialty_packs_code ON public.specialty_packs (code, version DESC);

-- ─── per-practice setup store ────────────────────────────────────────────────────────
--
-- NOT organization_settings: that table holds a single row shared by every tenant, so
-- per-practice state written there would leak across practices. public.practices has one
-- row per practice, and is already where 081 put session_idle_minutes.

ALTER TABLE public.practices ADD COLUMN IF NOT EXISTS setup jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ─── providers.specialty_code ────────────────────────────────────────────────────────
--
-- Global because providers is a public table. Expand/contract: the free-text
-- `specialization` stays for at least one release.

ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS specialty_code varchar(60);

UPDATE public.providers p
   SET specialty_code = s.code
  FROM public.specialties s
 WHERE p.specialty_code IS NULL
   AND p.specialization IS NOT NULL
   AND (
     LOWER(TRIM(p.specialization)) = LOWER(s.name)
     OR LOWER(TRIM(p.specialization)) = s.code
     OR LOWER(REPLACE(TRIM(p.specialization), ' ', '_')) = s.code
   );

CREATE INDEX IF NOT EXISTS idx_providers_specialty_code ON public.providers (specialty_code);

INSERT INTO public.schema_migrations (filename, executed)
VALUES ('085_specialty_catalog.sql', TRUE)
ON CONFLICT (filename) DO NOTHING;

COMMIT;

DO $verify$
DECLARE specs int; packs_tbl boolean; setup_col boolean; spec_col boolean;
BEGIN
  SELECT count(*) INTO specs FROM public.specialties;
  packs_tbl := to_regclass('public.specialty_packs') IS NOT NULL;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='practices' AND column_name='setup') INTO setup_col;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='providers' AND column_name='specialty_code') INTO spec_col;

  IF specs < 30 OR NOT packs_tbl OR NOT setup_col OR NOT spec_col THEN
    RAISE WARNING '085: incomplete — specialties=% packs_table=% practices.setup=% providers.specialty_code=%',
      specs, packs_tbl, setup_col, spec_col;
  ELSE
    RAISE NOTICE 'verified: % specialties, pack catalogue and practices.setup are in place. The packs themselves are published with `npm run packs:load`.', specs;
  END IF;
END $verify$;
