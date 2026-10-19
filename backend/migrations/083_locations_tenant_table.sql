-- Migration 083: register `locations` as a tenant table
--
-- Companion to tenant/004 and tenant/005. Creating a tenant table is not enough on its
-- own: control.provision_schema clones only what control.tenant_tables lists, so without
-- this row a NEWLY provisioned tenant would have no `locations` table, and the routes
-- that touch it would either fail or (worse) lazily CREATE TABLE IF NOT EXISTS an empty
-- shadow copy that reads zero rows. Same lesson as migration 071.
--
-- No explicit clone into `template` is needed here, unlike 071: that migration was
-- reclaiming tables which already existed in tenant_default but not template, whereas
-- tenant/004 creates `locations` directly in `template` (the runner targets it like any
-- other schema).
--
-- ORDER MATTERS, and the documented deploy order already gets it right:
--     npm run migrate            <- this file: registers the table
--     npm run migrate:tenants    <- tenant/004: creates it everywhere, template included
-- A tenant provisioned in the window between the two inherits template's
-- schema_migrations without version 4, so the next migrate:tenants run creates the table
-- for it. The gap self-heals; it does not need a backfill.

-- Migration 066 set the DATABASE default search_path to 'tenant_default, public, control',
-- so unqualified DDL in a GLOBAL migration lands in tenant_default rather than public.
-- Pin the search_path and schema-qualify everything. See 072_global_runtime_ddl.sql.
SET search_path TO public;

INSERT INTO control.tenant_tables (table_name, sort_order)
VALUES ('locations', 400)
ON CONFLICT (table_name) DO NOTHING;

DO $$
DECLARE
  registered boolean;
  in_template boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM control.tenant_tables WHERE table_name = 'locations')
    INTO registered;
  in_template := to_regclass('template.locations') IS NOT NULL;

  RAISE NOTICE '083: locations registered=% present_in_template=%', registered, in_template;

  IF NOT in_template THEN
    RAISE NOTICE '083: run `npm run migrate:tenants` next — tenant/004 creates the table in template and in every tenant schema.';
  END IF;
END $$;
