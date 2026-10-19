-- Migration 072: global DDL that routes performed at runtime
--
-- Companion to tenant/001. These are NOT per-tenant:
--   * the uuid-ossp extension (database-wide; users.js ran CREATE EXTENSION per request,
--     which also requires superuser and blocks a least-privilege app role)
--   * stripe_integration_settings (control-plane billing config, stays in public)

-- IMPORTANT: migration 066 sets the DATABASE default search_path to
-- 'tenant_default, public, control'. Unqualified DDL in a global migration would
-- therefore be created inside tenant_default instead of public. Pin the search_path
-- for this session AND schema-qualify every object below.
SET search_path TO public;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.stripe_integration_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      is_enabled BOOLEAN DEFAULT false,
      publishable_key VARCHAR(500),
      secret_key VARCHAR(500),
      webhook_secret VARCHAR(500),
      sandbox_mode BOOLEAN DEFAULT true,
      use_platform_integration BOOLEAN DEFAULT false,
      settings JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_tested_at TIMESTAMP,
      test_status VARCHAR(50),
      test_message TEXT
    );
