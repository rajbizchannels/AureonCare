-- Migration 073: SEC-05 Model D — least-privilege application role
--
-- The app has been connecting as a superuser (AC_DB_U defaults to `postgres`). A
-- superuser bypasses REVOKE, column/table grants and Row-Level Security, so every
-- database-side control in this project is inert until the app connects as an ordinary
-- role. This migration creates that role and grants exactly what the app needs: DML on
-- application data, no DDL, no superuser.
--
-- The role is created without a password: set one out-of-band and put it in AC_DB_W.
--   ALTER ROLE aureoncare_app WITH PASSWORD '<from your secret store>';
--
-- Runtime DDL was removed from the routes first (tenant/001 + 072), so the app no
-- longer needs CREATE rights. Tenant provisioning still creates schemas — that path is
-- exposed as a SECURITY DEFINER function instead of a privilege.
--
-- Idempotent.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aureoncare_app') THEN
    CREATE ROLE aureoncare_app LOGIN;
    RAISE NOTICE '073: created role aureoncare_app (no password set — set one before use)';
  END IF;
END $$;

-- Never let the app role own or create objects. (current_database() is used rather than
-- a psql :variable because migrations run through node-pg, not psql.)
REVOKE CREATE ON SCHEMA public FROM aureoncare_app;
DO $$
BEGIN
  EXECUTE format('REVOKE ALL ON DATABASE %I FROM aureoncare_app', current_database());
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO aureoncare_app', current_database());
END $$;

-- ── Grant DML on application schemas (public + control + template + every tenant) ────
-- Applied to existing objects, and via ALTER DEFAULT PRIVILEGES to objects created
-- later by the migration owner (so future migrations do not need a re-grant).
DO $$
DECLARE s text;
BEGIN
  FOR s IN
    SELECT 'public'
    UNION SELECT 'control'
    UNION SELECT 'template'
    UNION SELECT nspname FROM pg_namespace WHERE nspname LIKE 'tenant\_%'
  LOOP
    EXECUTE format('GRANT USAGE ON SCHEMA %I TO aureoncare_app', s);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA %I TO aureoncare_app', s);
    EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA %I TO aureoncare_app', s);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO aureoncare_app', s);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT USAGE, SELECT ON SEQUENCES TO aureoncare_app', s);
  END LOOP;
END $$;

-- ── Control-plane restrictions ───────────────────────────────────────────────────────
-- Guarded: the console tables arrive in migration 069, which normally runs first, but
-- this must not hard-fail on an install where the console was skipped.
DO $$
BEGIN
  IF to_regclass('control.operators') IS NOT NULL THEN
    -- Operator credentials: the platform login path reads these; nothing should write.
    REVOKE INSERT, UPDATE, DELETE ON control.operators FROM aureoncare_app;
  END IF;
  IF to_regclass('control.audit_log') IS NOT NULL THEN
    -- The audit trail is append-only (a trigger enforces it); make the grant match the
    -- intent so a mistake fails at permission level too, not only in the trigger.
    REVOKE UPDATE, DELETE ON control.audit_log FROM aureoncare_app;
  END IF;
END $$;

-- ── Tenant provisioning without DDL rights ──────────────────────────────────────────
-- provision_schema and its helpers issue CREATE SCHEMA / CREATE TABLE. Run them as the
-- owner via SECURITY DEFINER so the platform console can create a tenant while the app
-- role itself holds no DDL privilege. search_path is pinned (mandatory for definer
-- functions) to prevent object-resolution hijacking.
ALTER FUNCTION control.provision_schema(text)            SECURITY DEFINER SET search_path = control, public, pg_temp;
ALTER FUNCTION control.clone_table(text, text, text)     SECURITY DEFINER SET search_path = control, public, pg_temp;
ALTER FUNCTION control.clone_public_table(text, text)    SECURITY DEFINER SET search_path = control, public, pg_temp;
ALTER FUNCTION control.ensure_schema_migrations(text)    SECURITY DEFINER SET search_path = control, public, pg_temp;
ALTER FUNCTION control.replicate_intra_fks(text, text[]) SECURITY DEFINER SET search_path = control, public, pg_temp;
ALTER FUNCTION control.replicate_intra_fks(text, text, text[]) SECURITY DEFINER SET search_path = control, public, pg_temp;

REVOKE EXECUTE ON FUNCTION control.provision_schema(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION control.provision_schema(text) TO aureoncare_app;

-- A newly provisioned tenant schema must be usable by the app role immediately.
CREATE OR REPLACE FUNCTION control.grant_tenant_access(p_schema text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = control, public, pg_temp AS $$
BEGIN
  EXECUTE format('GRANT USAGE ON SCHEMA %I TO aureoncare_app', p_schema);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA %I TO aureoncare_app', p_schema);
  EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA %I TO aureoncare_app', p_schema);
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO aureoncare_app', p_schema);
END $$;
REVOKE EXECUTE ON FUNCTION control.grant_tenant_access(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION control.grant_tenant_access(text) TO aureoncare_app;

-- Wire the grant into provisioning so a tenant created through the platform console is
-- immediately usable by the app role (otherwise its first request would fail on
-- permission denied for the brand-new schema).
CREATE OR REPLACE FUNCTION control.provision_schema(p_dst text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = control, public, pg_temp AS $$
DECLARE tset text[]; t text;
BEGIN
  EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', p_dst);
  SELECT array_agg(table_name ORDER BY sort_order, table_name) INTO tset FROM control.tenant_tables;
  IF tset IS NOT NULL THEN
    FOREACH t IN ARRAY tset LOOP
      PERFORM control.clone_table('template', t, p_dst);
    END LOOP;
    PERFORM control.replicate_intra_fks('template', p_dst, tset);
  END IF;
  PERFORM control.ensure_schema_migrations(p_dst);
  EXECUTE format(
    'INSERT INTO %I.schema_migrations (version, name, applied_at)
       SELECT version, name, applied_at FROM template.schema_migrations
     ON CONFLICT (version) DO NOTHING', p_dst);
  PERFORM control.grant_tenant_access(p_dst);
END $$;
REVOKE EXECUTE ON FUNCTION control.provision_schema(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION control.provision_schema(text) TO aureoncare_app;
