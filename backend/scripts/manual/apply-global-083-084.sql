-- Apply the GLOBAL migrations 083 and 084 (locations, medical camps).
--
-- Equivalent to the 083/084 portion of: node backend/run-migrations.js
--
-- Run this BEFORE apply-tenant-migrations.sql, exactly as the deploy order
-- (migrate -> migrate:tenants) requires. These two files register the new tables in
-- control.tenant_tables; the tenant script creates them. Get the order wrong and nothing
-- breaks permanently — the next tenant run self-heals — but a tenant provisioned in
-- between would be missing the tables until then.
--
-- Unlike the tenant migrations, these CAN be pasted raw: global migrations are already
-- schema-qualified throughout. The only thing added here is the ledger row, so
-- run-migrations.js does not repeat the work later.
--
-- Safe to re-run.

BEGIN;

-- Migration 066 set the DATABASE default search_path to 'tenant_default, public, control',
-- so unqualified DDL in a global migration lands in tenant_default. Pin it and qualify
-- every object. Same reason as 072_global_runtime_ddl.sql.
SET search_path TO public;

CREATE TABLE IF NOT EXISTS public.schema_migrations (
  filename    TEXT PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  executed    BOOLEAN NOT NULL DEFAULT TRUE
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 083.  083_locations_tenant_table.sql
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO control.tenant_tables (table_name, sort_order)
VALUES ('locations', 400)
ON CONFLICT (table_name) DO NOTHING;

INSERT INTO public.schema_migrations (filename, executed)
VALUES ('083_locations_tenant_table.sql', TRUE)
ON CONFLICT (filename) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- 084.  084_camps_tenant_tables.sql
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO control.tenant_tables (table_name, sort_order) VALUES
  ('camps',                      410),
  ('camp_services',              411),
  ('camp_staff',                 412),
  ('camp_stations',              413),
  ('camp_inventory_allocations', 414),
  ('camp_registrations',         415),
  ('camp_station_visits',        416)
ON CONFLICT (table_name) DO NOTHING;

-- Camps are a Clinical Pro and above feature: essentials deliberately does NOT get the
-- flag. A jsonb merge rather than a rewrite, so this neither clobbers the catalogue seed
-- nor fails on re-run.
UPDATE public.subscription_plans
   SET features = COALESCE(features, '{}'::jsonb) || '{"camps": true}'::jsonb
 WHERE name IN ('clinical_pro', 'enterprise', 'onprem', 'professional');

INSERT INTO public.schema_migrations (filename, executed)
VALUES ('084_camps_tenant_tables.sql', TRUE)
ON CONFLICT (filename) DO NOTHING;

COMMIT;

-- Verification. Silence from the warnings below means this half is done; the tables
-- themselves arrive with apply-tenant-migrations.sql.
DO $verify$
DECLARE
  registered int;
  gated int;
BEGIN
  -- Named explicitly, NOT `LIKE 'camp%'` — that pattern also matches `campaigns`, which
  -- has been a tenant table since 071. Counting it would let a genuinely missing camp
  -- table slip through as the right total.
  SELECT count(*) INTO registered FROM control.tenant_tables
   WHERE table_name IN ('locations', 'camps', 'camp_services', 'camp_staff', 'camp_stations',
          'camp_inventory_allocations', 'camp_registrations', 'camp_station_visits');
  SELECT count(*) INTO gated FROM public.subscription_plans WHERE features ? 'camps';

  IF registered <> 8 THEN
    RAISE WARNING 'expected 8 registered tenant tables (locations + 7 camp tables), found %', registered;
  END IF;
  IF gated = 0 THEN
    RAISE WARNING 'no subscription plan carries the camps feature flag — the module will be blocked for every tenant';
  END IF;
  IF registered = 8 AND gated > 0 THEN
    RAISE NOTICE 'verified: % of 8 tenant tables registered, % plan(s) have the camps feature. Now run apply-tenant-migrations.sql.', registered, gated;
  END IF;
END $verify$;
