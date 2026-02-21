-- Migration: Add proper OAuth token columns to telehealth_provider_settings
-- This replaces storing tokens in the JSONB 'settings' column with dedicated columns
-- for better queryability, indexing, and clarity.
--
-- Run: psql -U postgres -d aureoncare -f backend/migrations/048_add_zoom_oauth_columns.sql

BEGIN;

-- Add dedicated OAuth token columns
ALTER TABLE public.telehealth_provider_settings
  ADD COLUMN IF NOT EXISTS access_token TEXT,
  ADD COLUMN IF NOT EXISTS refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS token_type VARCHAR(50) DEFAULT 'Bearer',
  ADD COLUMN IF NOT EXISTS token_scope TEXT,
  ADD COLUMN IF NOT EXISTS token_expires_at BIGINT,
  ADD COLUMN IF NOT EXISTS account_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS zoom_user_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS zoom_user_email VARCHAR(255);

-- Migrate existing token data from JSONB settings column into new columns
UPDATE public.telehealth_provider_settings
SET
  access_token  = COALESCE(access_token,  settings->>'access_token'),
  refresh_token = COALESCE(refresh_token, settings->>'refresh_token'),
  token_type    = COALESCE(NULLIF(token_type, 'Bearer'), settings->>'token_type', 'Bearer'),
  token_scope   = COALESCE(token_scope,   settings->>'scope'),
  token_expires_at = COALESCE(token_expires_at, (settings->>'expires_at')::BIGINT),
  account_id    = COALESCE(account_id,    settings->>'account_id'),
  zoom_user_id  = COALESCE(zoom_user_id,  settings->>'user_id'),
  zoom_user_email = COALESCE(zoom_user_email, settings->>'email')
WHERE settings IS NOT NULL AND settings != '{}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.telehealth_provider_settings.access_token IS 'OAuth access token';
COMMENT ON COLUMN public.telehealth_provider_settings.refresh_token IS 'OAuth refresh token for renewing access';
COMMENT ON COLUMN public.telehealth_provider_settings.token_expires_at IS 'Token expiry as Unix timestamp (ms)';
COMMENT ON COLUMN public.telehealth_provider_settings.account_id IS 'Provider account ID (e.g., Zoom account_id)';
COMMENT ON COLUMN public.telehealth_provider_settings.zoom_user_id IS 'Zoom user ID of the authenticated user';
COMMENT ON COLUMN public.telehealth_provider_settings.zoom_user_email IS 'Email of the authenticated Zoom user';

COMMIT;
