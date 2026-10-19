-- Migration 066: SEC-05 Model D — Step S4: cut the default tenant over to its schema
--
-- All existing data belongs to one clinic, so it becomes the "default" tenant. This
-- relocates the tenant-scoped tables from `public` into a dedicated `tenant_default`
-- schema and points the default tenant catalog row at it.
--
-- Tables are MOVED with ALTER TABLE ... SET SCHEMA — a fast, atomic catalog operation
-- that preserves all rows, indexes, and foreign keys (FKs are tracked by object id, so
-- both intra-tenant FKs and cross-schema FKs to still-in-public tables like users /
-- providers / insurance_payers keep working).
--
-- To keep the (not-yet-swept) application working, the database default search_path is
-- set to `tenant_default, public, control`, so existing unqualified pool.query calls
-- resolve to the tenant schema. Listing a not-yet-existent schema in search_path is
-- harmless, so this is safe regardless of migration/deploy ordering.
--
-- Idempotent: only moves a table still in public; re-running is a no-op.
--
-- OPERATIONAL GUARDRAIL: do not provision a SECOND tenant until the route query sweep
-- (adopting req/withTenant per request) is complete. Until then, un-swept routes rely
-- on the database default search_path, which points at the default tenant only.

CREATE SCHEMA IF NOT EXISTS tenant_default;

-- Move each tenant-scoped table from public into tenant_default (only if still there).
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT table_name FROM control.tenant_tables ORDER BY sort_order, table_name LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = t AND c.relkind = 'r'
    ) THEN
      EXECUTE format('ALTER TABLE public.%I SET SCHEMA tenant_default', t);
      RAISE NOTICE 'S4: moved public.% -> tenant_default', t;
    END IF;
  END LOOP;
END $$;

-- Per-schema migration tracking for the tenant, stamped at the S2 baseline.
SELECT control.ensure_schema_migrations('tenant_default');
INSERT INTO tenant_default.schema_migrations (version, name)
VALUES (0, 'baseline (data relocated from public at S4)')
ON CONFLICT (version) DO NOTHING;

-- Point the default tenant at its schema.
UPDATE control.tenants SET schema_name = 'tenant_default', updated_at = now() WHERE slug = 'default';

-- Make unqualified queries resolve to the tenant schema by default so the app keeps
-- working before the route sweep. RESET search_path (in withTenant) restores this.
DO $$
BEGIN
  EXECUTE format('ALTER DATABASE %I SET search_path TO tenant_default, public, control', current_database());
END $$;
