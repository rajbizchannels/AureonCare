-- Apply the module_permissions table: global 088 AND tenant/011, in one script.
--
-- Equivalent to the 088 portion of `node backend/run-migrations.js` plus the 011 portion of
-- `node backend/run-tenant-migrations.js`.
--
-- Both halves are needed and the order matters:
--   * 088 registers the table in control.tenant_tables, so tenants provisioned AFTER this
--     get it from control.provision_schema.
--   * tenant/011 creates it in `template` and in every existing tenant schema. `template`
--     is what a new tenant is cloned from, so without it a new practice gets nothing.
--
-- Until both have run, the permissions screen reports that permissions are not set up for
-- the practice and the enforcement middleware falls back to the role defaults — which is
-- the same behaviour as before the feature existed, so nothing breaks in the gap.
--
-- Safe to re-run.

BEGIN;

-- Migration 066 set the DATABASE default search_path to 'tenant_default, public, control',
-- so unqualified DDL in a global migration lands in tenant_default. Pin and qualify.
SET search_path TO public;

CREATE TABLE IF NOT EXISTS public.schema_migrations (
  filename    TEXT PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  executed    BOOLEAN NOT NULL DEFAULT TRUE
);

-- ─── global 088: register for new tenants ────────────────────────────────────────────

INSERT INTO control.tenant_tables (table_name, sort_order) VALUES
  ('module_permissions', 510)
ON CONFLICT (table_name) DO NOTHING;

INSERT INTO public.schema_migrations (filename, executed)
VALUES ('088_module_permissions_tenant_table.sql', TRUE)
ON CONFLICT (filename) DO NOTHING;

-- ─── tenant 011: create it in `template` and in every tenant schema ──────────────────
--
-- Loops the way apply-tenant-migrations.sql does: sets search_path per schema, creates the
-- table, and records the file in that schema's own schema_migrations ledger so the node
-- runner will not repeat the work.

DO $fan$
DECLARE
  s text;
  done int := 0;
  skipped int := 0;
BEGIN
  -- `template` first, then the schemas control.tenants actually lists — the same set the
  -- node tenant runner walks. Scanning pg_namespace for 'tenant_%' would also sweep up
  -- abandoned or half-provisioned schemas.
  FOR s IN
    SELECT 'template'::text
    UNION ALL
    SELECT schema_name FROM control.tenants ORDER BY 1
  LOOP
    -- `patients`, not `users`: users is an identity-plane table that lives in `public` and
    -- is shared across tenants (see routes/providers.js), so no tenant schema has its own
    -- copy. Guarding on it skipped every schema and this script silently did nothing.
    IF to_regclass(format('%I.patients', s)) IS NULL THEN
      skipped := skipped + 1;
      CONTINUE;
    END IF;

    EXECUTE format('SET search_path TO %I, public', s);

    EXECUTE '
      CREATE TABLE IF NOT EXISTS module_permissions (
        id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        module        varchar(50)  NOT NULL,
        role_name     varchar(50)  NOT NULL,
        resource      varchar(60)  NOT NULL,
        can_view      boolean NOT NULL DEFAULT false,
        can_create    boolean NOT NULL DEFAULT false,
        can_edit      boolean NOT NULL DEFAULT false,
        can_delete    boolean NOT NULL DEFAULT false,
        can_approve   boolean NOT NULL DEFAULT false,
        can_export    boolean NOT NULL DEFAULT false,
        -- Resolves to public.users through the search_path set above: users is shared
        -- across tenants rather than copied into each schema.
        updated_by    uuid REFERENCES users(id),
        updated_at    timestamptz NOT NULL DEFAULT now(),
        created_at    timestamptz NOT NULL DEFAULT now(),
        UNIQUE (module, role_name, resource)
      )';

    -- Only the role index: the UNIQUE (module, role_name, resource) constraint already
    -- provides the btree the per-request lookup uses.
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_module_perms_role ON module_permissions(role_name)';

    -- A TENANT ledger, which is (version, name, applied_at) — NOT the global
    -- public.schema_migrations shape of (filename, applied_at, executed). Writing the
    -- global columns here fails with "column filename does not exist", and the same
    -- version number is what the node tenant runner checks.
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I.schema_migrations (version integer PRIMARY KEY, name text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())', s);
    EXECUTE format('INSERT INTO %I.schema_migrations (version, name) VALUES (11, %L) ON CONFLICT (version) DO NOTHING', s, '011_module_permissions.sql');

    done := done + 1;
  END LOOP;

  SET search_path TO public;
  RAISE NOTICE 'module_permissions: created in % schema(s); % skipped (not a provisioned tenant schema)', done, skipped;
END $fan$;

COMMIT;

DO $verify$
DECLARE
  registered boolean;
  in_template boolean;
  schemas int;
  missing int;
BEGIN
  SELECT EXISTS (SELECT 1 FROM control.tenant_tables WHERE table_name = 'module_permissions')
    INTO registered;
  in_template := to_regclass('template.module_permissions') IS NOT NULL;

  SELECT count(*) INTO schemas FROM control.tenants t
   WHERE to_regclass(format('%I.patients', t.schema_name)) IS NOT NULL;
  SELECT count(*) INTO missing FROM control.tenants t
   WHERE to_regclass(format('%I.patients', t.schema_name)) IS NOT NULL
     AND to_regclass(format('%I.module_permissions', t.schema_name)) IS NULL;

  IF NOT registered OR NOT in_template OR missing > 0 THEN
    RAISE WARNING 'incomplete — registered=% in_template=% tenant schemas missing the table=% of %',
      registered, in_template, missing, schemas;
  ELSE
    RAISE NOTICE 'verified: registered for new tenants, present in `template`, and in all % tenant schema(s).', schemas;
  END IF;
END $verify$;
