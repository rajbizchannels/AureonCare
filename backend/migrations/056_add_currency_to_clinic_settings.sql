-- Migration 056: Add currency setting to organization_settings
UPDATE organization_settings
SET settings = jsonb_set(COALESCE(settings, '{}'::jsonb), '{currency}', '"USD"'::jsonb, true)
WHERE NOT (settings ? 'currency');
