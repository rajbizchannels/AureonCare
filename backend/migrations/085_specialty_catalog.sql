-- Migration 085: specialty taxonomy, specialty packs, and the per-practice setup store
--
-- Groundwork for the specialty configuration wizard. Three things live here, and all three
-- are GLOBAL on purpose:
--
--   * public.specialties      — reference data, the same list for every tenant, sitting
--                               next to public.subscription_plans where the other catalog
--                               tables live.
--   * public.specialty_packs  — the declarative content packs. Also catalog: a pack is
--                               authored once and applied to many tenants.
--   * public.practices.setup  — where an individual practice's resolved configuration goes.
--
-- WHY NOT organization_settings.settings, which the proposal named: that table holds
-- exactly ONE row in `public` and is not in control.tenant_tables, so all 34 tenants share
-- it. Putting per-practice wizard state there would leak one practice's specialty profile,
-- terminology and hidden modules to every other practice. public.practices has one row per
-- practice and is already where 081 put session_idle_minutes and require_mfa, so it is the
-- correct home. (The organization_settings sharing is a pre-existing problem of its own;
-- this migration does not make it worse and does not try to fix it.)
--
-- providers.specialty_code is global for the same reason: providers is a public table.

-- Migration 066 set the DATABASE default search_path to 'tenant_default, public, control',
-- so unqualified DDL in a global migration lands in tenant_default. Pin and qualify
-- everything. See 072_global_runtime_ddl.sql.
SET search_path TO public;

-- ─── taxonomy ────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.specialties (
  code          varchar(60) PRIMARY KEY,
  name          varchar(150) NOT NULL,
  parent_code   varchar(60) REFERENCES public.specialties(code),
  -- NUCC provider taxonomy code. Left NULL here deliberately: inventing codes in a
  -- clinical product is worse than leaving the column empty, so these are populated by
  -- the customer or during pack review, not guessed at by a migration.
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
  ('behavioral_health',  'Behavioural Health & Counselling',   200),
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

-- Sub-specialties, added after their parents exist.
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

COMMENT ON TABLE public.specialties IS
  'Global specialty taxonomy. Reference data shared by every tenant, not per-practice configuration.';

-- ─── content packs ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.specialty_packs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code           varchar(60) NOT NULL,
  version        integer NOT NULL,
  label          varchar(150),
  definition     jsonb NOT NULL,
  is_active      boolean NOT NULL DEFAULT true,
  -- CPT/ICD subsets and clinical forms are regulated content. A pack is usable while this
  -- is 'pending', but the apply result and the wizard both say so, and an administrator
  -- has to acknowledge it. Setting it to 'approved' is a clinician's act, recorded below —
  -- it is deliberately not something a migration or a loader can do for itself.
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

COMMENT ON TABLE public.specialty_packs IS
  'Declarative specialty content packs. Data, never code: the definition contains no SQL, function references or file paths — see backend/utils/specialtyPackSchema.js.';

-- ─── per-practice setup store ────────────────────────────────────────────────────────

ALTER TABLE public.practices ADD COLUMN IF NOT EXISTS setup jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.practices.setup IS
  'Per-practice wizard and specialty state: { onboarding, specialtyCodes, terminology, hiddenModules, favouriteCodes, appliedPacks }. Lives here rather than organization_settings, which holds a single row shared by every tenant.';

-- ─── providers.specialty_code ────────────────────────────────────────────────────────
--
-- Expand/contract: the free-text `specialization` stays for at least one release. Neither
-- column is dropped until every tenant is migrated and no code reads the old one.

ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS specialty_code varchar(60);

DO $backfill$
DECLARE n int;
BEGIN
  -- Best-effort match of the existing free text onto the taxonomy: exact name, then exact
  -- code, then a loose match on the start of the name. Anything that does not match is
  -- left NULL rather than guessed — a wrong specialty on a provider record is worse than
  -- an absent one.
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
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE '085: matched % provider(s) to a specialty code; the rest keep free text only', n;
END $backfill$;

CREATE INDEX IF NOT EXISTS idx_providers_specialty_code ON public.providers (specialty_code);

COMMENT ON COLUMN public.providers.specialty_code IS
  'References public.specialties.code. Added alongside the free-text specialization (expand/contract); neither is dropped until every tenant is migrated.';

DO $verify$
DECLARE specs int; packs_tbl boolean; setup_col boolean; spec_col boolean;
BEGIN
  SELECT count(*) INTO specs FROM public.specialties;
  packs_tbl := to_regclass('public.specialty_packs') IS NOT NULL;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='practices' AND column_name='setup') INTO setup_col;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='providers' AND column_name='specialty_code') INTO spec_col;

  RAISE NOTICE '085: specialties=% packs_table=% practices.setup=% providers.specialty_code=%',
    specs, packs_tbl, setup_col, spec_col;

  IF specs < 30 OR NOT packs_tbl OR NOT setup_col OR NOT spec_col THEN
    RAISE WARNING '085: incomplete — expected the taxonomy seeded and all three objects present';
  END IF;
END $verify$;
