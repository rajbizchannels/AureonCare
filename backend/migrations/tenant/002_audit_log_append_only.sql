-- Tenant migration 002: make the per-tenant audit log append-only (SEC-25)
--
-- control.audit_log (the platform trail) was made immutable in migration 069, but each
-- tenant's own audit_logs table — the one that records clinical activity, and the one an
-- auditor asks about — is still freely UPDATE/DELETE-able by the application. An audit
-- trail that the application can rewrite is not evidence of anything.
--
-- A BEFORE UPDATE OR DELETE trigger rejects both. Retention/rotation, when it is
-- introduced, must run as a role that can drop the trigger deliberately rather than the
-- application quietly deleting rows.
--
-- Applied by run-tenant-migrations.js to every tenant schema and the template, with
-- search_path set per tenant — hence the unqualified names.

CREATE OR REPLACE FUNCTION audit_logs_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only (% is not permitted)', TG_OP
    USING HINT = 'Audit records may be inserted and read, never altered or removed.';
END $$;

DROP TRIGGER IF EXISTS audit_logs_no_mutate ON audit_logs;
CREATE TRIGGER audit_logs_no_mutate
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_append_only();
