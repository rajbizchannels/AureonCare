-- Apply patient portal invitations: global 090 AND tenant/012, in one script.
--
-- Equivalent to the 090 portion of `node backend/run-migrations.js` plus the 012 portion of
-- `node backend/run-tenant-migrations.js`. Use this when migrations are applied by pasting
-- into the Supabase SQL editor.
--
-- Why not paste migrations/tenant/012_portal_invites.sql? Tenant files use unqualified
-- names and rely on the node runner to set search_path to each tenant schema. In the SQL
-- editor search_path is `public`, which has no `patients` table, so it fails with
-- 42P01 "relation patients does not exist" (or, with the newer guard, does nothing).
--
-- Order matters: 090 registers portal_invites in control.tenant_tables (practices created
-- later get it), then the fan-out creates it in `template` and every existing tenant.
-- Until both have run, "Invite to portal" on a patient chart returns an error.
--
-- Safe to re-run. Run as the database OWNER (postgres), not aureoncare_app.

BEGIN;

SET search_path TO public;

CREATE TABLE IF NOT EXISTS public.schema_migrations (
  filename    TEXT PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  executed    BOOLEAN NOT NULL DEFAULT TRUE
);

-- ─── global 090: control-plane route + functions + registration ──────────────────────

CREATE TABLE IF NOT EXISTS control.portal_invite_route (
  token_hash  char(64) PRIMARY KEY,
  tenant_id   uuid NOT NULL REFERENCES control.tenants(id) ON DELETE CASCADE,
  expires_at  timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_portal_invite_route_expiry ON control.portal_invite_route(expires_at);

DROP FUNCTION IF EXISTS control.resolve_portal_invite(char);
DROP FUNCTION IF EXISTS control.register_portal_invite(char, uuid, timestamptz);
DROP FUNCTION IF EXISTS control.forget_portal_invite(char);

-- The tenant of a live (unexpired) invite, for an ACTIVE practice only.
CREATE OR REPLACE FUNCTION control.resolve_portal_invite(p_token_hash char(64))
RETURNS TABLE(tenant_id uuid, schema_name varchar)
LANGUAGE sql SECURITY DEFINER SET search_path = control, pg_temp AS $$
  SELECT r.tenant_id, t.schema_name
    FROM control.portal_invite_route r
    JOIN control.tenants t ON t.id = r.tenant_id
   WHERE r.token_hash = p_token_hash AND r.expires_at > now() AND t.status = 'active'
$$;

CREATE OR REPLACE FUNCTION control.register_portal_invite(p_token_hash char(64), p_tenant_id uuid, p_expires_at timestamptz)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = control, pg_temp AS $$
  INSERT INTO control.portal_invite_route (token_hash, tenant_id, expires_at)
  VALUES (p_token_hash, p_tenant_id, p_expires_at)
  ON CONFLICT (token_hash) DO NOTHING
$$;

CREATE OR REPLACE FUNCTION control.forget_portal_invite(p_token_hash char(64))
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = control, pg_temp AS $$
  DELETE FROM control.portal_invite_route WHERE token_hash = p_token_hash
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aureoncare_app') THEN
    REVOKE ALL ON control.portal_invite_route FROM aureoncare_app, PUBLIC;
    REVOKE EXECUTE ON FUNCTION control.resolve_portal_invite(char)                      FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION control.register_portal_invite(char, uuid, timestamptz) FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION control.forget_portal_invite(char)                       FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION control.resolve_portal_invite(char)                       TO aureoncare_app;
    GRANT EXECUTE ON FUNCTION control.register_portal_invite(char, uuid, timestamptz)  TO aureoncare_app;
    GRANT EXECUTE ON FUNCTION control.forget_portal_invite(char)                        TO aureoncare_app;
  END IF;
END $$;

-- After patients (10) and the other tenant tables; it references patients.
INSERT INTO control.tenant_tables (table_name, sort_order) VALUES ('portal_invites', 520)
ON CONFLICT (table_name) DO NOTHING;

INSERT INTO public.schema_migrations (filename, executed)
VALUES ('090_portal_invites.sql', TRUE)
ON CONFLICT (filename) DO NOTHING;

-- ─── tenant 012: create portal_invites in `template` and every tenant schema ─────────

DO $fan$
DECLARE
  s text;
  done int := 0;
  skipped int := 0;
BEGIN
  FOR s IN
    SELECT 'template'::text
    UNION ALL
    SELECT schema_name FROM control.tenants ORDER BY 1
  LOOP
    IF to_regclass(format('%I.patients', s)) IS NULL THEN
      skipped := skipped + 1;
      CONTINUE;
    END IF;

    EXECUTE format('SET search_path TO %I, public', s);

    EXECUTE '
      CREATE TABLE IF NOT EXISTS portal_invites (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id  uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        token_hash  char(64) NOT NULL UNIQUE,
        email       varchar(255) NOT NULL,
        expires_at  timestamptz NOT NULL,
        used_at     timestamptz,
        revoked_at  timestamptz,
        created_by  uuid,
        emailed     boolean NOT NULL DEFAULT false,
        created_at  timestamptz NOT NULL DEFAULT now()
      )';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_portal_invites_patient ON portal_invites(patient_id, created_at DESC)';

    -- Tenant ledger shape: (version, name, applied_at).
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I.schema_migrations (version integer PRIMARY KEY, name text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())', s);
    EXECUTE format('INSERT INTO %I.schema_migrations (version, name) VALUES (12, %L) ON CONFLICT (version) DO NOTHING', s, '012_portal_invites.sql');

    done := done + 1;
  END LOOP;

  SET search_path TO public;
  RAISE NOTICE 'portal_invites: created in % schema(s); % skipped (no patients table)', done, skipped;
END $fan$;

COMMIT;

DO $verify$
DECLARE
  registered boolean;
  in_template boolean;
  fns int;
  schemas int;
  missing int;
BEGIN
  SELECT EXISTS (SELECT 1 FROM control.tenant_tables WHERE table_name = 'portal_invites') INTO registered;
  in_template := to_regclass('template.portal_invites') IS NOT NULL;
  SELECT count(*) INTO fns FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'control'
     AND p.proname IN ('resolve_portal_invite','register_portal_invite','forget_portal_invite');
  SELECT count(*) INTO schemas FROM control.tenants t
   WHERE to_regclass(format('%I.patients', t.schema_name)) IS NOT NULL;
  SELECT count(*) INTO missing FROM control.tenants t
   WHERE to_regclass(format('%I.patients', t.schema_name)) IS NOT NULL
     AND to_regclass(format('%I.portal_invites', t.schema_name)) IS NULL;

  IF NOT registered OR NOT in_template OR fns <> 3 OR missing > 0 THEN
    RAISE WARNING 'incomplete — registered=% in_template=% functions=%/3 tenant schemas missing the table=% of %',
      registered, in_template, fns, missing, schemas;
  ELSE
    RAISE NOTICE 'verified: route + 3 functions present, registered for new tenants, in `template` and all % tenant schema(s).', schemas;
  END IF;
END $verify$;
