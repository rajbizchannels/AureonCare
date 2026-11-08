-- Tenant migration 010: AI integrations (bring-your-own-key, feature switches,
-- human-in-the-loop drafts and the PHI anonymization map).
--
-- Five tables:
--   ai_provider_credentials  the practice's own API key per AI provider (BYOK), encrypted
--   ai_feature_settings      one row per AI feature: on/off, provider, model, monthly cap
--   ai_requests              one row per call to a provider (metering + cost)
--   ai_phi_token_map         token -> original value for every PHI item removed before a call
--   ai_suggestions           the AI draft a person must accept, edit or reject
--
-- Nothing the AI produces is written into a clinical, billing or messaging table here:
-- it lands in ai_suggestions as 'pending' and only a named reviewer can move it on.
--
-- Unqualified names on purpose — the runner sets search_path per tenant. See README.md.

CREATE TABLE IF NOT EXISTS ai_provider_credentials (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider             varchar(30)  NOT NULL,
  display_name         varchar(120),
  -- AES-256-GCM via utils/messageCrypto. The key is never returned by the API.
  api_key_ciphertext   text,
  api_key_iv           text,
  api_key_tag          text,
  api_key_version      smallint,
  api_key_last4        varchar(8),
  base_url             text,
  region               varchar(50),
  api_version          varchar(30),
  default_model        varchar(120),
  -- The admin confirms a BAA (US) / DPA (EU) is signed with the provider. Without it the
  -- gateway refuses to send any request, anonymized or not. Offline models are exempt.
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
);

CREATE TABLE IF NOT EXISTS ai_feature_settings (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key              varchar(50) NOT NULL,
  is_enabled               boolean NOT NULL DEFAULT false,
  provider                 varchar(30),
  model                    varchar(120),
  monthly_request_limit    integer,
  monthly_budget_usd       numeric(10,2),
  -- Draft lifetime: a pending draft older than this can no longer be accepted.
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
);

CREATE TABLE IF NOT EXISTS ai_requests (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key              varchar(50)  NOT NULL,
  user_id                  uuid,
  provider                 varchar(30)  NOT NULL,
  model                    varchar(120) NOT NULL,
  prompt_template_version  varchar(20)  NOT NULL,
  -- sha256 of the ANONYMIZED prompt: proves what was sent without storing it.
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
);

CREATE INDEX IF NOT EXISTS idx_ai_requests_feature_month ON ai_requests (feature_key, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_requests_patient       ON ai_requests (patient_id);

-- The anonymization map. Each PHI value taken out of a prompt gets a token such as
-- [[PATIENT_NAME_1]]; the original is stored encrypted against the request it belongs to,
-- so the response can be put back together and an auditor can see exactly which values
-- were withheld from the provider. Tokens are scoped to one request — the same patient
-- gets fresh tokens next time, so a provider cannot link two calls by token.
CREATE TABLE IF NOT EXISTS ai_phi_token_map (
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
);

CREATE INDEX IF NOT EXISTS idx_ai_phi_token_map_request ON ai_phi_token_map (request_id);

CREATE TABLE IF NOT EXISTS ai_suggestions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id           uuid NOT NULL REFERENCES ai_requests(id) ON DELETE RESTRICT,
  feature_key          varchar(50)  NOT NULL,
  entity_type          varchar(50),
  entity_id            varchar(255),
  patient_id           uuid,
  -- The re-identified draft, encrypted at rest (it contains PHI again).
  draft_ciphertext     text NOT NULL,
  draft_iv             text NOT NULL,
  draft_tag            text NOT NULL,
  draft_key_version    smallint NOT NULL,
  -- What the reviewer finally approved (after their edits), encrypted the same way.
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
  -- A reviewed draft always names its reviewer.
  CONSTRAINT ai_suggestions_reviewer_chk CHECK (status IN ('pending', 'expired') OR reviewed_by IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_ai_suggestions_status  ON ai_suggestions (status, feature_key);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_patient ON ai_suggestions (patient_id);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_entity  ON ai_suggestions (entity_type, entity_id);
