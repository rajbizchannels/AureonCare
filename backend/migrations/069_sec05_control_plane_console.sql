-- Migration 069: SEC-05 Model D — Step S10: control-plane console + super-admin
--
-- The super-admin is a SEPARATE principal type from tenant staff. A tenant admin can
-- never become a platform operator: operators live in their own table with their own
-- credentials, and they have NO standing access to tenant PHI. Reading a tenant's data
-- requires an explicit, time-boxed, justified break-glass session — and the act itself
-- is written to the immutable platform audit log.
--
-- Additive; touches only the control schema. Idempotent.

-- ── Platform operators (super-admins) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS control.operators (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email          varchar(255) NOT NULL UNIQUE,
  password_hash  varchar(255) NOT NULL,
  name           varchar(255),
  status         varchar(20)  NOT NULL DEFAULT 'active',   -- active | disabled
  mfa_secret     varchar(255),                             -- TOTP secret (null until enrolled)
  mfa_enabled    boolean      NOT NULL DEFAULT false,
  token_version  integer      NOT NULL DEFAULT 0,          -- bump to revoke all operator JWTs
  last_login     timestamptz,
  created_at     timestamptz  NOT NULL DEFAULT now(),
  updated_at     timestamptz  NOT NULL DEFAULT now()
);

-- ── Immutable platform audit log ──────────────────────────────────────────────
-- Every operator/platform action is recorded here. Append-only: a trigger blocks
-- UPDATE/DELETE so the trail cannot be tampered with from the application.
CREATE TABLE IF NOT EXISTS control.audit_log (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  operator_id  uuid REFERENCES control.operators(id),
  action       varchar(64) NOT NULL,       -- e.g. tenant.create, tenant.suspend, break_glass.start
  target_type  varchar(32),                -- tenant | operator | ...
  target_id    varchar(128),
  tenant_id    uuid,                        -- affected tenant, when applicable
  detail       jsonb,
  ip_address   varchar(64),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_control_audit_created ON control.audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_control_audit_tenant  ON control.audit_log(tenant_id);

CREATE OR REPLACE FUNCTION control.audit_log_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'control.audit_log is append-only (% not allowed)', TG_OP;
END $$;

DROP TRIGGER IF EXISTS audit_log_no_mutate ON control.audit_log;
CREATE TRIGGER audit_log_no_mutate
  BEFORE UPDATE OR DELETE ON control.audit_log
  FOR EACH ROW EXECUTE FUNCTION control.audit_log_append_only();

-- ── Break-glass sessions (time-boxed operator access to one tenant) ───────────
CREATE TABLE IF NOT EXISTS control.break_glass_sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id  uuid NOT NULL REFERENCES control.operators(id),
  tenant_id    uuid NOT NULL REFERENCES control.tenants(id),
  reason       text NOT NULL,                       -- justification is mandatory
  granted_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,                -- time-boxed
  revoked_at   timestamptz
);
CREATE INDEX IF NOT EXISTS idx_break_glass_active
  ON control.break_glass_sessions(operator_id, tenant_id, expires_at);
