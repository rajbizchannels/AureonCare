-- Migration 074: SEC-05 Model D — hardened portal tenant routing (Option D)
--
-- The patient portal performs two lookups BEFORE any tenant is known: login by email,
-- and session validation by token. Both target tables that now live inside per-tenant
-- schemas, so the portal needs a way to resolve "which schema?" first.
--
-- Design principle: the shared slice is a ROUTER, NOT A RECORD. These tables carry no
-- names, no clinical data, no credentials, and no plaintext identifiers:
--
--   portal_session_route   token_hash  -> tenant_id     (token is 256-bit CSPRNG; links
--                                                        a random value to a clinic — no
--                                                        person appears in this table)
--   portal_identity_route  email_hmac  -> tenant_id     (keyed HMAC; the pepper lives in
--                                                        the environment, never the DB)
--
-- The per-tenant patient_portal_sessions still holds token_hash -> patient_id, and
-- portal credentials stay on the tenant's patients row, so a full compromise of these
-- two tables yields no PHI and cannot authenticate anyone.
--
-- ACCESS CONTROL: the app role gets NO table privileges here. It may only call the
-- SECURITY DEFINER functions below, which accept an exact hash — so the tables cannot be
-- enumerated or dumped through the application, even via SQL injection.
--
-- NOTE ON CLASSIFICATION: a keyed hash of an identifier is a coded identifier, not
-- de-identified data under HIPAA Safe Harbor. Treat these tables as PHI: in BAA scope,
-- encrypted at rest, and included in breach analysis.
--
-- Idempotent.

CREATE TABLE IF NOT EXISTS control.portal_session_route (
  token_hash  char(64)    PRIMARY KEY,                       -- SHA-256 of the session token
  tenant_id   uuid        NOT NULL REFERENCES control.tenants(id) ON DELETE CASCADE,
  expires_at  timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_portal_session_route_expiry ON control.portal_session_route(expires_at);

CREATE TABLE IF NOT EXISTS control.portal_identity_route (
  email_hmac  char(64)    NOT NULL,                          -- HMAC-SHA256(lower(email), pepper)
  tenant_id   uuid        NOT NULL REFERENCES control.tenants(id) ON DELETE CASCADE,
  key_version smallint    NOT NULL DEFAULT 1,                -- supports pepper rotation
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (email_hmac, tenant_id)                        -- same email may exist at 2 clinics
);

-- ── Accessors (the ONLY way the application may touch these tables) ─────────────────
-- Every function pins search_path: mandatory for SECURITY DEFINER, otherwise object
-- resolution can be hijacked by a caller-controlled search_path.

CREATE OR REPLACE FUNCTION control.resolve_portal_session(p_token_hash char(64))
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path = control, pg_temp AS $$
  SELECT tenant_id FROM control.portal_session_route
   WHERE token_hash = p_token_hash AND expires_at > now()
$$;

CREATE OR REPLACE FUNCTION control.register_portal_session(p_token_hash char(64), p_tenant_id uuid, p_expires_at timestamptz)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = control, pg_temp AS $$
  INSERT INTO control.portal_session_route (token_hash, tenant_id, expires_at)
  VALUES (p_token_hash, p_tenant_id, p_expires_at)
  ON CONFLICT (token_hash) DO UPDATE SET tenant_id = EXCLUDED.tenant_id, expires_at = EXCLUDED.expires_at
$$;

CREATE OR REPLACE FUNCTION control.forget_portal_session(p_token_hash char(64))
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = control, pg_temp AS $$
  DELETE FROM control.portal_session_route WHERE token_hash = p_token_hash
$$;

-- Returns the candidate tenants for an email hash. Callers MUST still verify credentials
-- inside each candidate tenant; this only narrows the search.
CREATE OR REPLACE FUNCTION control.resolve_portal_tenants(p_email_hmac char(64))
RETURNS TABLE(tenant_id uuid) LANGUAGE sql SECURITY DEFINER SET search_path = control, pg_temp AS $$
  SELECT tenant_id FROM control.portal_identity_route WHERE email_hmac = p_email_hmac
$$;

CREATE OR REPLACE FUNCTION control.register_portal_identity(p_email_hmac char(64), p_tenant_id uuid, p_key_version smallint DEFAULT 1)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = control, pg_temp AS $$
  INSERT INTO control.portal_identity_route (email_hmac, tenant_id, key_version)
  VALUES (p_email_hmac, p_tenant_id, p_key_version)
  ON CONFLICT (email_hmac, tenant_id) DO UPDATE SET key_version = EXCLUDED.key_version
$$;

CREATE OR REPLACE FUNCTION control.forget_portal_identity(p_email_hmac char(64), p_tenant_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = control, pg_temp AS $$
  DELETE FROM control.portal_identity_route WHERE email_hmac = p_email_hmac AND tenant_id = p_tenant_id
$$;

-- Retention: expired routing rows carry no value and should not linger.
CREATE OR REPLACE FUNCTION control.purge_expired_portal_sessions()
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = control, pg_temp AS $$
DECLARE n bigint;
BEGIN
  DELETE FROM control.portal_session_route WHERE expires_at <= now();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

-- ── Lock the tables down; expose only the functions ─────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aureoncare_app') THEN
    REVOKE ALL ON control.portal_session_route  FROM aureoncare_app, PUBLIC;
    REVOKE ALL ON control.portal_identity_route FROM aureoncare_app, PUBLIC;

    REVOKE EXECUTE ON FUNCTION control.resolve_portal_session(char)              FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION control.register_portal_session(char, uuid, timestamptz) FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION control.forget_portal_session(char)               FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION control.resolve_portal_tenants(char)              FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION control.register_portal_identity(char, uuid, smallint) FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION control.forget_portal_identity(char, uuid)        FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION control.purge_expired_portal_sessions()           FROM PUBLIC;

    GRANT EXECUTE ON FUNCTION control.resolve_portal_session(char)               TO aureoncare_app;
    GRANT EXECUTE ON FUNCTION control.register_portal_session(char, uuid, timestamptz) TO aureoncare_app;
    GRANT EXECUTE ON FUNCTION control.forget_portal_session(char)                TO aureoncare_app;
    GRANT EXECUTE ON FUNCTION control.resolve_portal_tenants(char)               TO aureoncare_app;
    GRANT EXECUTE ON FUNCTION control.register_portal_identity(char, uuid, smallint) TO aureoncare_app;
    GRANT EXECUTE ON FUNCTION control.forget_portal_identity(char, uuid)         TO aureoncare_app;
    GRANT EXECUTE ON FUNCTION control.purge_expired_portal_sessions()            TO aureoncare_app;
  END IF;
END $$;
