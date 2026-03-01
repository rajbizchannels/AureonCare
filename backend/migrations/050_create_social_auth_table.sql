-- Migration 050: Create social_auth table
-- Stores OAuth tokens and profile data for Google / Microsoft social login.
-- This table was referenced by auth routes but never had a numbered migration,
-- causing POST /api/auth/social-register (and social-login) to return 500
-- on databases built via the sequential migration runner.

CREATE TABLE IF NOT EXISTS social_auth (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID REFERENCES users(id) ON DELETE CASCADE,
    patient_id         UUID REFERENCES patients(id) ON DELETE CASCADE,
    provider           VARCHAR(20)  NOT NULL,
    provider_user_id   VARCHAR(255) NOT NULL,
    access_token       TEXT,
    refresh_token      TEXT,
    token_expires_at   TIMESTAMP WITHOUT TIME ZONE,
    profile_data       JSONB,
    created_at         TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT social_auth_provider_provider_user_id_key UNIQUE (provider, provider_user_id)
);

CREATE INDEX IF NOT EXISTS idx_social_auth_user    ON social_auth (user_id);
CREATE INDEX IF NOT EXISTS idx_social_auth_patient ON social_auth (patient_id);
