-- Migration 089: route a public booking link to its practice (SEC-30)
--
-- The public booking page (/book/<slug>) is reached with no session, so nothing tells the
-- server which tenant schema to read. Since the schema-per-tenant cutover every anonymous
-- booking call fell back to the application pool, whose search_path is `public`, where the
-- scheduling tables no longer live — the whole flow answered 500 (or 409 after d360cb0).
--
-- This is the same shape as 074's portal_session_route: a small control-plane table that
-- maps an opaque public value to a tenant, readable only through SECURITY DEFINER
-- functions, so the least-privilege app role never touches control.* directly.
--
-- A slug is public by design (it is in the URL), so it reveals nothing the link did not.
-- Slugs are unique ACROSS practices from now on: two practices cannot both own /book/dr-lee.

SET search_path TO public;

CREATE TABLE IF NOT EXISTS control.booking_slug_route (
  slug        varchar(100) PRIMARY KEY,
  tenant_id   uuid NOT NULL REFERENCES control.tenants(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_booking_slug_route_tenant ON control.booking_slug_route(tenant_id);

-- Backfill from every tenant that already has booking links. First owner wins on a
-- collision (oldest tenant), and the collision is reported so it can be renamed.
DO $backfill$
DECLARE t record; n int; dup int;
BEGIN
  FOR t IN SELECT id, schema_name FROM control.tenants ORDER BY created_at LOOP
    IF to_regclass(format('%I.provider_booking_config', t.schema_name)) IS NULL THEN CONTINUE; END IF;
    EXECUTE format(
      'SELECT count(*) FROM %I.provider_booking_config c
        WHERE c.booking_url_slug IS NOT NULL
          AND EXISTS (SELECT 1 FROM control.booking_slug_route r
                       WHERE r.slug = c.booking_url_slug AND r.tenant_id <> $1)', t.schema_name)
      INTO dup USING t.id;
    IF dup > 0 THEN
      RAISE WARNING '089: % booking slug(s) in % are already owned by another practice and stay unroutable until renamed', dup, t.schema_name;
    END IF;
    EXECUTE format(
      'INSERT INTO control.booking_slug_route (slug, tenant_id, provider_id)
       SELECT booking_url_slug, $1, provider_id FROM %I.provider_booking_config
        WHERE booking_url_slug IS NOT NULL
       ON CONFLICT (slug) DO NOTHING', t.schema_name) USING t.id;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n > 0 THEN RAISE NOTICE '089: % booking slug(s) routed for %', n, t.schema_name; END IF;
  END LOOP;
END $backfill$;

DROP FUNCTION IF EXISTS control.resolve_booking_slug(varchar);
DROP FUNCTION IF EXISTS control.register_booking_slug(varchar, uuid, uuid);
DROP FUNCTION IF EXISTS control.forget_booking_slug(varchar, uuid);

-- Returns the tenant + provider for an ACTIVE practice only.
CREATE OR REPLACE FUNCTION control.resolve_booking_slug(p_slug varchar)
RETURNS TABLE(tenant_id uuid, schema_name varchar, provider_id uuid)
LANGUAGE sql SECURITY DEFINER SET search_path = control, pg_temp AS $$
  SELECT r.tenant_id, t.schema_name, r.provider_id
    FROM control.booking_slug_route r
    JOIN control.tenants t ON t.id = r.tenant_id
   WHERE r.slug = p_slug AND t.status = 'active'
$$;

-- Claims a slug for a tenant. Returns false when ANOTHER practice already owns it, so the
-- caller can answer 409; re-registering one's own slug (e.g. a provider change) succeeds.
CREATE OR REPLACE FUNCTION control.register_booking_slug(p_slug varchar, p_tenant_id uuid, p_provider_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = control, pg_temp AS $$
DECLARE owner uuid;
BEGIN
  INSERT INTO control.booking_slug_route (slug, tenant_id, provider_id)
  VALUES (p_slug, p_tenant_id, p_provider_id)
  ON CONFLICT (slug) DO UPDATE
     SET provider_id = EXCLUDED.provider_id, updated_at = now()
   WHERE control.booking_slug_route.tenant_id = EXCLUDED.tenant_id;
  SELECT r.tenant_id INTO owner FROM control.booking_slug_route r WHERE r.slug = p_slug;
  RETURN owner = p_tenant_id;
END $$;

-- Releases a slug, but only the caller's own.
CREATE OR REPLACE FUNCTION control.forget_booking_slug(p_slug varchar, p_tenant_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = control, pg_temp AS $$
  DELETE FROM control.booking_slug_route WHERE slug = p_slug AND tenant_id = p_tenant_id
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aureoncare_app') THEN
    REVOKE ALL ON control.booking_slug_route FROM aureoncare_app, PUBLIC;
    REVOKE EXECUTE ON FUNCTION control.resolve_booking_slug(varchar)            FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION control.register_booking_slug(varchar, uuid, uuid) FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION control.forget_booking_slug(varchar, uuid)       FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION control.resolve_booking_slug(varchar)             TO aureoncare_app;
    GRANT EXECUTE ON FUNCTION control.register_booking_slug(varchar, uuid, uuid) TO aureoncare_app;
    GRANT EXECUTE ON FUNCTION control.forget_booking_slug(varchar, uuid)        TO aureoncare_app;
  END IF;
END $$;
