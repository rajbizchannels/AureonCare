-- Ensure preferences column exists on users table (may be absent in older deployments)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS preferences jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Fix any NULLs that slipped in before the NOT NULL default was set
UPDATE users
SET preferences = '{}'::jsonb
WHERE preferences IS NULL;

-- Backfill whatsappNumber key with empty string for rows that don't have it
UPDATE users
SET preferences = jsonb_set(preferences, '{whatsappNumber}', '""'::jsonb, true)
WHERE NOT (preferences ? 'whatsappNumber');

-- Backfill whatsappNotifications key with false for rows that don't have it
UPDATE users
SET preferences = jsonb_set(preferences, '{whatsappNotifications}', 'false'::jsonb, true)
WHERE NOT (preferences ? 'whatsappNotifications');
