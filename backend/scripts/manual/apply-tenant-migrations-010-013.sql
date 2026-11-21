-- Apply tenant migrations 010 (AI integrations) and 013 (appointments.meeting_url) in the
-- Supabase SQL editor — to `template` and every practice schema, in one paste.
--
-- Found 2026-11-21 by the SEC-05 schema-health check (run read-only against production):
-- control.tenant_tables lists five AI tables (global migration 087), but tenant migration
-- 010 was never run, so they are missing from `template` and tenant_default. The AI
-- settings screen and every AI feature fail with 42P01 until this is applied, and new
-- practices would be provisioned without them. 013 only needs recording: the column exists.
--
-- Why not paste migrations/tenant/010_ai_integrations.sql directly? Tenant files use
-- unqualified names and rely on the node runner to set search_path per schema; in the SQL
-- editor they would land in `public`. This script sets it for each schema itself.
--
-- Safe to re-run (IF NOT EXISTS throughout). Run as the database OWNER (postgres).
-- Privileges: the schemas' default privileges already grant the app role access to new tables.

DO $fan$
DECLARE s text; done int := 0;
BEGIN
  FOR s IN SELECT 'template'::text UNION ALL SELECT schema_name FROM control.tenants WHERE schema_name IS NOT NULL ORDER BY 1 LOOP
    IF to_regnamespace(s) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('SET search_path TO %I, public', s);
    EXECUTE $q$CREATE TABLE IF NOT EXISTS ai_provider_credentials (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider             varchar(30)  NOT NULL,
  display_name         varchar(120),
  api_key_ciphertext   text,
  api_key_iv           text,
  api_key_tag          text,
  api_key_version      smallint,
  api_key_last4        varchar(8),
  base_url             text,
  region               varchar(50),
  api_version          varchar(30),
  default_model        varchar(120),
  baa_confirmed        boolean NOT NULL DEFAULT false,
  baa_confirmed_by     uuid,
  baa_confirmed_at     timestamp,
  zero_data_retention  boolean NOT NULL DEFAULT false,
  is_enabled           boolean NOT NULL DEFAULT false,
  last_tested_at       timestamp,
  test_status          varchar(20),
  test_message         text,
  created_by           uuid,
  updated_by           uuid,
  created_at           timestamp DEFAULT CURRENT_TIMESTAMP,
  updated_at           timestamp DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ai_provider_credentials_provider_uq UNIQUE (provider),
  CONSTRAINT ai_provider_credentials_provider_chk CHECK (provider IN
    ('anthropic', 'openai', 'azure_openai', 'google_gemini', 'mistral', 'offline'))
)$q$;
    EXECUTE $q$CREATE TABLE IF NOT EXISTS ai_feature_settings (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key              varchar(50) NOT NULL,
  is_enabled               boolean NOT NULL DEFAULT false,
  provider                 varchar(30),
  model                    varchar(120),
  monthly_request_limit    integer,
  monthly_budget_usd       numeric(10,2),
  draft_ttl_hours          integer NOT NULL DEFAULT 72,
  enabled_by               uuid,
  enabled_at               timestamp,
  updated_by               uuid,
  created_at               timestamp DEFAULT CURRENT_TIMESTAMP,
  updated_at               timestamp DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ai_feature_settings_key_uq UNIQUE (feature_key),
  CONSTRAINT ai_feature_settings_ttl_chk CHECK (draft_ttl_hours BETWEEN 1 AND 720),
  CONSTRAINT ai_feature_settings_provider_chk CHECK (provider IS NULL OR provider IN
    ('anthropic', 'openai', 'azure_openai', 'google_gemini', 'mistral', 'offline'))
)$q$;
    EXECUTE $q$CREATE TABLE IF NOT EXISTS ai_requests (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key              varchar(50)  NOT NULL,
  user_id                  uuid,
  provider                 varchar(30)  NOT NULL,
  model                    varchar(120) NOT NULL,
  prompt_template_version  varchar(20)  NOT NULL,
  input_hash               varchar(64),
  entity_type              varchar(50),
  entity_id                varchar(255),
  patient_id               uuid,
  phi_tokens_count         integer NOT NULL DEFAULT 0,
  status                   varchar(20)  NOT NULL DEFAULT 'started',
  stop_reason              varchar(30),
  input_tokens             integer,
  output_tokens            integer,
  estimated_cost_usd       numeric(12,6),
  latency_ms               integer,
  error_message            text,
  created_at               timestamp DEFAULT CURRENT_TIMESTAMP,
  completed_at             timestamp,
  CONSTRAINT ai_requests_status_chk CHECK (status IN ('started', 'succeeded', 'failed', 'refused', 'blocked'))
)$q$;
    EXECUTE $q$CREATE INDEX IF NOT EXISTS idx_ai_requests_feature_month ON ai_requests (feature_key, created_at)$q$;
    EXECUTE $q$CREATE INDEX IF NOT EXISTS idx_ai_requests_patient       ON ai_requests (patient_id)$q$;
    EXECUTE $q$CREATE TABLE IF NOT EXISTS ai_phi_token_map (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id           uuid NOT NULL REFERENCES ai_requests(id) ON DELETE CASCADE,
  token                varchar(60) NOT NULL,
  phi_category         varchar(30) NOT NULL,
  detection_method     varchar(20) NOT NULL DEFAULT 'pattern',
  original_ciphertext  text NOT NULL,
  original_iv          text NOT NULL,
  original_tag         text NOT NULL,
  key_version          smallint NOT NULL,
  occurrences          integer NOT NULL DEFAULT 1,
  restored_in_response boolean NOT NULL DEFAULT false,
  created_at           timestamp DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ai_phi_token_map_uq UNIQUE (request_id, token),
  CONSTRAINT ai_phi_token_map_method_chk CHECK (detection_method IN ('record', 'pattern'))
)$q$;
    EXECUTE $q$CREATE INDEX IF NOT EXISTS idx_ai_phi_token_map_request ON ai_phi_token_map (request_id)$q$;
    EXECUTE $q$CREATE TABLE IF NOT EXISTS ai_suggestions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id           uuid NOT NULL REFERENCES ai_requests(id) ON DELETE RESTRICT,
  feature_key          varchar(50)  NOT NULL,
  entity_type          varchar(50),
  entity_id            varchar(255),
  patient_id           uuid,
  draft_ciphertext     text NOT NULL,
  draft_iv             text NOT NULL,
  draft_tag            text NOT NULL,
  draft_key_version    smallint NOT NULL,
  final_ciphertext     text,
  final_iv             text,
  final_tag            text,
  final_key_version    smallint,
  status               varchar(20) NOT NULL DEFAULT 'pending',
  requested_by         uuid,
  reviewed_by          uuid,
  reviewed_at          timestamp,
  review_reason        text,
  attested             boolean NOT NULL DEFAULT false,
  edit_distance_pct    numeric(5,2),
  expires_at           timestamp NOT NULL,
  created_at           timestamp DEFAULT CURRENT_TIMESTAMP,
  updated_at           timestamp DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ai_suggestions_status_chk CHECK (status IN ('pending', 'accepted', 'edited', 'rejected', 'expired')),
  CONSTRAINT ai_suggestions_reviewer_chk CHECK (status IN ('pending', 'expired') OR reviewed_by IS NOT NULL)
)$q$;
    EXECUTE $q$CREATE INDEX IF NOT EXISTS idx_ai_suggestions_status  ON ai_suggestions (status, feature_key)$q$;
    EXECUTE $q$CREATE INDEX IF NOT EXISTS idx_ai_suggestions_patient ON ai_suggestions (patient_id)$q$;
    EXECUTE $q$CREATE INDEX IF NOT EXISTS idx_ai_suggestions_entity  ON ai_suggestions (entity_type, entity_id)$q$;
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I.schema_migrations (version integer PRIMARY KEY, name text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())', s);
    EXECUTE format('INSERT INTO %I.schema_migrations (version, name) VALUES (10, %L) ON CONFLICT (version) DO NOTHING', s, '010_ai_integrations.sql');
    IF to_regclass(format('%I.appointments', s)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %I.appointments ADD COLUMN IF NOT EXISTS meeting_url TEXT', s);
      EXECUTE format('INSERT INTO %I.schema_migrations (version, name) VALUES (13, %L) ON CONFLICT (version) DO NOTHING', s, '013_appointments_meeting_url.sql');
    END IF;
    done := done + 1;
  END LOOP;
  SET search_path TO public;
  RAISE NOTICE 'tenant 010 + 013 applied in % schema(s)', done;
END $fan$;

-- Verify: expect missing_tables = 0.
SELECT count(*) AS missing_tables
  FROM (SELECT 'template'::text AS sch UNION ALL SELECT schema_name FROM control.tenants WHERE status = 'active') s
  CROSS JOIN control.tenant_tables e
 WHERE NOT EXISTS (SELECT 1 FROM information_schema.tables t WHERE t.table_schema = s.sch AND t.table_name = e.table_name);
