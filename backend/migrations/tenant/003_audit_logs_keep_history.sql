-- Tenant migration 003: stop foreign keys from trying to rewrite the audit log.
--
-- Migration 002 made audit_logs append-only with a BEFORE UPDATE OR DELETE trigger. But
-- audit_logs.user_id, .patient_id and .provider_id were declared ON DELETE SET NULL — and
-- SET NULL is an UPDATE. So deleting a user, a patient or a provider makes Postgres issue
--
--     UPDATE ONLY audit_logs SET user_id = NULL WHERE ...
--
-- which the trigger rejects with
--
--     P0001: audit_logs is append-only (UPDATE is not permitted)
--
-- and the whole deletion fails. Two designs that are each correct alone: the trail must not
-- be rewritten, and a deleted row must not leave a dangling reference. Here they collide,
-- and deleting any staff member has been impossible since 002 was applied.
--
-- Dropping the constraints is the right side to give way, not weakening the trigger. An
-- audit row is a historical statement about something that happened: "this user, at this
-- time, viewed this chart". That statement does not stop being true when the account is
-- later deleted, and blanking the id would destroy exactly the link an investigation
-- follows. The rows already carry user_email, user_name and user_role denormalised, so
-- attribution survives the account itself — which is the whole point of recording them.
--
-- The ids remain as plain uuid columns. They may point at rows that no longer exist; for a
-- historical record that is correct rather than a defect.
--
-- Applied by run-tenant-migrations.js to every tenant schema and the template, with
-- search_path set per tenant — hence the unqualified names.

DO $$
DECLARE
  con record;
BEGIN
  -- By definition rather than by name: these constraints were created at different times
  -- across tenants, and a name that differs in one schema would be silently skipped.
  FOR con IN
    SELECT k.conname
      FROM pg_constraint k
      JOIN pg_class c ON c.oid = k.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN unnest(k.conkey) AS ck(attnum) ON true
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ck.attnum
     WHERE k.contype = 'f'
       AND c.relname = 'audit_logs'
       AND n.nspname = current_schema()
       AND a.attname IN ('user_id', 'patient_id', 'provider_id')
  LOOP
    EXECUTE format('ALTER TABLE audit_logs DROP CONSTRAINT %I', con.conname);
    RAISE NOTICE 'dropped %.% ', current_schema(), con.conname;
  END LOOP;
END $$;

-- The ids are still looked up constantly ("everything this user touched"), and without the
-- foreign key there is no longer an implicit index behind them.
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id    ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_patient_id ON audit_logs (patient_id);
