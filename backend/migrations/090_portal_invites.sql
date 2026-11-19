-- Migration 090: patient portal invitations — control-plane half (companion to tenant/012).
--
-- The invitation link is opened with no session, so the server has to find the practice
-- from the token alone. Same shape as 074's portal_session_route and 089's booking slugs:
-- a control table mapping an opaque token HASH to a tenant, reachable only through
-- SECURITY DEFINER functions. It carries no patient id, name or email — who the invite is
-- for lives in the practice's own portal_invites table.
--
-- Also registers portal_invites in control.tenant_tables so practices provisioned from now
-- on get the table (the 071/083/087/088 lesson).

SET search_path TO public;

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
