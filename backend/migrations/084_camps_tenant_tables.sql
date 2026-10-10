-- Migration 084: register the camp tables, and gate camps by plan
--
-- Companion to tenant/006. control.provision_schema clones only what
-- control.tenant_tables lists, so without these rows a newly provisioned tenant would
-- have no camp tables at all. Same lesson as 071 and 083.
--
-- No explicit clone into `template` is needed: the tenant runner targets `template` like
-- any other schema, so tenant/006 creates the tables there. Deploy order
-- (migrate -> migrate:tenants) is what makes that true; a tenant provisioned between the
-- two inherits template's schema_migrations without version 6 and the next
-- migrate:tenants run creates its tables.

-- Migration 066 set the DATABASE default search_path to 'tenant_default, public, control',
-- so unqualified DDL in a global migration lands in tenant_default. Pin and qualify.
-- See 072_global_runtime_ddl.sql.
SET search_path TO public;

-- sort_order places the camp set after locations (400). Order does not affect FK
-- correctness — clone_table creates every table before replicate_intra_fks runs — but it
-- keeps the provisioning log readable.
INSERT INTO control.tenant_tables (table_name, sort_order) VALUES
  ('camps',                      410),
  ('camp_services',              411),
  ('camp_staff',                 412),
  ('camp_stations',              413),
  ('camp_inventory_allocations', 414),
  ('camp_registrations',         415),
  ('camp_station_visits',        416)
ON CONFLICT (table_name) DO NOTHING;

-- Plan gating. Camps are a Clinical Pro and above feature: essentials deliberately does
-- NOT get the flag. jsonb merge rather than a rewrite, so this neither clobbers the
-- catalogue seed nor fails on re-run.
UPDATE public.subscription_plans
   SET features = COALESCE(features, '{}'::jsonb) || '{"camps": true}'::jsonb
 WHERE name IN ('clinical_pro', 'enterprise', 'onprem', 'professional');

DO $$
DECLARE
  registered int;
  in_template int;
  gated int;
BEGIN
  -- The seven tables are named rather than matched with `LIKE 'camp%'`: that pattern also
  -- matches `campaigns`, a tenant table since 071, so a count of 7 could be six camp
  -- tables plus campaigns and the check below would pass while one was missing.
  SELECT count(*) INTO registered FROM control.tenant_tables
   WHERE table_name IN ('camps', 'camp_services', 'camp_staff', 'camp_stations',
                        'camp_inventory_allocations', 'camp_registrations', 'camp_station_visits');
  SELECT count(*) INTO in_template FROM information_schema.tables
   WHERE table_schema = 'template'
     AND table_name IN ('camps', 'camp_services', 'camp_staff', 'camp_stations',
                        'camp_inventory_allocations', 'camp_registrations', 'camp_station_visits');
  SELECT count(*) INTO gated FROM public.subscription_plans
   WHERE features ? 'camps';

  RAISE NOTICE '084: camp tables registered=%/7 present_in_template=%/7 plans_with_camps=%',
    registered, in_template, gated;

  IF in_template < 7 THEN
    RAISE NOTICE '084: run `npm run migrate:tenants` next — tenant/006 creates the camp tables in template and in every tenant schema.';
  END IF;
END $$;
