-- Migration: Add Stripe integration settings table
-- Supports per-subscriber custom Stripe keys OR platform-level Stripe integration

CREATE TABLE IF NOT EXISTS stripe_integration_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    is_enabled BOOLEAN DEFAULT false,

    -- Custom subscriber keys (optional if using platform integration)
    publishable_key VARCHAR(500),
    secret_key VARCHAR(500),
    webhook_secret VARCHAR(500),

    -- Mode
    sandbox_mode BOOLEAN DEFAULT true,

    -- When true, subscriber uses the platform's Stripe account instead of their own keys
    use_platform_integration BOOLEAN DEFAULT false,

    -- Status tracking
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_tested_at TIMESTAMP,
    test_status VARCHAR(50),
    test_message TEXT
);

-- Only one row ever exists (singleton config for the tenant)
CREATE UNIQUE INDEX IF NOT EXISTS idx_stripe_integration_singleton ON stripe_integration_settings ((true));
