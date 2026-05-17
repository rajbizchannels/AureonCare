-- Migration 053: Update subscription tiers, add provider quotas, license key support
-- Adds new plan tiers, max_providers column, provider_seats_purchased, and license_keys table

BEGIN;

-- ─── 1. Extend subscription_plans with provider limits ────────────────────────
ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS max_providers INTEGER NOT NULL DEFAULT -1,
  ADD COLUMN IF NOT EXISTS base_price_per_provider NUMERIC(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS trial_days INTEGER NOT NULL DEFAULT 0;

-- ─── 2. Extend organization_settings with provider seats and trial flags ──────
ALTER TABLE organization_settings
  ADD COLUMN IF NOT EXISTS provider_seats_purchased INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_trial BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trial_end_date DATE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS enforcement_enabled BOOLEAN NOT NULL DEFAULT true;

-- ─── 3. Replace all plan definitions with the new four tiers ─────────────────
-- Remove old plans safely (ON DELETE SET NULL on FK from organization_settings)
UPDATE organization_settings SET current_plan_id = NULL;
DELETE FROM subscription_plans;

INSERT INTO subscription_plans
  (name, display_name, description, price, billing_cycle, max_users, max_patients, max_providers, base_price_per_provider, trial_days, features, is_active)
VALUES
  (
    'essentials',
    'Practice Essentials',
    'For solo practitioners — everything needed to run a real clinic from day one.',
    149.00,
    'monthly',
    4,        -- 1 provider + 3 staff
    300,
    1,
    NULL,
    30,       -- 30-day free trial
    '{"scheduling":true,"appointments":true,"patientPortal":true,"clinicalServices":true,
      "ehr":true,"billing":true,"reports":true,"formManagement":true,
      "practiceManagement":true,"providerManagement":true}'::jsonb,
    true
  ),
  (
    'clinical_pro',
    'Clinical Pro',
    'For small-to-mid group practices — full clinical, billing and engagement workflow.',
    349.00,
    'monthly',
    -1,       -- unlimited staff
    -1,       -- unlimited patients
    10,       -- 10 providers included; add more at $99/provider/month
    99.00,
    14,       -- 14-day free trial
    '{"scheduling":true,"appointments":true,"patientPortal":true,"clinicalServices":true,
      "ehr":true,"billing":true,"reports":true,"formManagement":true,
      "practiceManagement":true,"providerManagement":true,
      "telehealth":true,"prescriptions":true,"labOrders":true,
      "claims":true,"preapprovals":true,"rcm":true,"crm":true,
      "offerings":true,"advancedScheduling":true,"calendarIntegrations":true}'::jsonb,
    true
  ),
  (
    'enterprise',
    'Enterprise',
    'For multi-location practices and health systems — full platform with SSO, API access and white-label.',
    799.00,
    'monthly',
    -1,
    -1,
    -1,       -- unlimited providers
    149.00,   -- additional provider add-on if ever needed
    14,
    '{"scheduling":true,"appointments":true,"patientPortal":true,"clinicalServices":true,
      "ehr":true,"billing":true,"reports":true,"formManagement":true,
      "practiceManagement":true,"providerManagement":true,
      "telehealth":true,"prescriptions":true,"labOrders":true,
      "claims":true,"preapprovals":true,"rcm":true,"crm":true,
      "offerings":true,"advancedScheduling":true,"calendarIntegrations":true,
      "integrations":true,"multiLocation":true,"advancedReports":true,
      "apiAccess":true,"customBranding":true,"sso":true,"auditExport":true}'::jsonb,
    true
  ),
  (
    'onprem',
    'On-Premises / Customer Cloud',
    'Annual software license for self-hosted deployments. All Enterprise features included. Governed by a license key.',
    0.00,     -- custom pricing negotiated; DB stores 0
    'yearly',
    -1,
    -1,
    -1,
    NULL,
    0,
    '{"scheduling":true,"appointments":true,"patientPortal":true,"clinicalServices":true,
      "ehr":true,"billing":true,"reports":true,"formManagement":true,
      "practiceManagement":true,"providerManagement":true,
      "telehealth":true,"prescriptions":true,"labOrders":true,
      "claims":true,"preapprovals":true,"rcm":true,"crm":true,
      "offerings":true,"advancedScheduling":true,"calendarIntegrations":true,
      "integrations":true,"multiLocation":true,"advancedReports":true,
      "apiAccess":true,"customBranding":true,"sso":true,"auditExport":true,
      "selfHosted":true,"licenseKey":true}'::jsonb,
    true
  );

-- ─── 4. Re-seed organization_settings to the essentials plan ─────────────────
UPDATE organization_settings
SET
  current_plan_id = (SELECT id FROM subscription_plans WHERE name = 'essentials'),
  plan_start_date = CURRENT_DATE,
  plan_end_date   = CURRENT_DATE + INTERVAL '30 days',  -- 30-day trial
  auto_renew      = true,
  is_trial        = true,
  trial_end_date  = CURRENT_DATE + INTERVAL '30 days'
WHERE id = (SELECT id FROM organization_settings LIMIT 1);

-- Insert if no org settings row exists yet
INSERT INTO organization_settings
  (organization_name, current_plan_id, plan_start_date, plan_end_date, auto_renew, is_trial, trial_end_date)
SELECT
  'My Practice',
  (SELECT id FROM subscription_plans WHERE name = 'essentials'),
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '30 days',
  true,
  true,
  CURRENT_DATE + INTERVAL '30 days'
WHERE NOT EXISTS (SELECT 1 FROM organization_settings);

-- ─── 5. Create license_keys table ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS license_keys (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key               VARCHAR(50) NOT NULL UNIQUE,
  plan_name         VARCHAR(50) NOT NULL REFERENCES subscription_plans(name),
  max_providers     INTEGER     NOT NULL DEFAULT 1,
  max_users         INTEGER     NOT NULL DEFAULT -1,
  max_patients      INTEGER     NOT NULL DEFAULT -1,
  valid_from        DATE        NOT NULL DEFAULT CURRENT_DATE,
  valid_until       DATE        DEFAULT NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'unactivated'
                    CHECK (status IN ('unactivated','active','expired','revoked')),
  activated_at      TIMESTAMP   DEFAULT NULL,
  installation_id   VARCHAR(255) DEFAULT NULL,
  notes             TEXT        DEFAULT NULL,
  created_by        VARCHAR(255) DEFAULT NULL,
  created_at        TIMESTAMP   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMP   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_license_keys_key    ON license_keys (key);
CREATE INDEX IF NOT EXISTS idx_license_keys_status ON license_keys (status);

COMMENT ON TABLE license_keys IS
  'Software license keys issued for On-Premises and Customer Cloud deployments';

COMMIT;
