-- Apply the TENANT migrations across every tenant schema.
--
-- Equivalent to: node backend/run-tenant-migrations.js
--
-- Why the raw files fail when pasted into a SQL editor: tenant/*.sql use UNQUALIFIED table
-- names on purpose, because the runner sets search_path per tenant before executing each
-- one. Run them directly and `audit_logs` resolves against public, where it does not
-- exist —
--     ERROR: 42P01: relation "audit_logs" does not exist
-- which is a statement about how they were run, not about the migrations.
--
-- The file bodies are carried below as ORDINARY QUOTED TEXT rather than dollar-quoted
-- blocks, and every anonymous dollar-quote inside them has been given an explicit tag.
-- An earlier version nested three levels of dollar quoting, which Postgres accepts but the
-- Supabase SQL editor's own parser does not:
--     ERROR: 42601: unterminated dollar-quoted string
-- Only one dollar-quoted block remains (the DO below) and nothing is nested inside it, so
-- this pastes into the editor as well as it pipes to psql. Note for future edits: keep
-- dollar-quote tokens out of the comments too — a parser that does not skip comments would
-- treat a lone tag there as opening a string.
--
-- Covers every tenant schema plus `template`. Safe to re-run: each file is idempotent AND
-- the per-schema ledger is honoured, so nothing is applied twice and
-- run-tenant-migrations.js will not repeat the work.

BEGIN;

CREATE TEMP TABLE tenant_migration_files (version int, name text, body text) ON COMMIT DROP;

INSERT INTO tenant_migration_files (version, name, body) VALUES
  (1, '001_adopt_runtime_created_tables.sql', '-- Tenant migration 001: adopt tables that routes used to create at runtime
--
-- These tables were created lazily by route handlers (CREATE TABLE IF NOT EXISTS on
-- first use), so they never appeared in schema.sql. That pattern caused the tenant
-- shadowing bug fixed by migration 071 and blocks running the app under a
-- least-privilege (non-DDL) database role.
--
-- The DDL is reproduced here verbatim from the route sources, made idempotent, and is
-- applied by run-tenant-migrations.js to EVERY tenant schema plus the golden template.
-- Table names are intentionally unqualified: the runner sets search_path per tenant.

-- form_categories (was created at runtime)
CREATE TABLE IF NOT EXISTS form_categories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL,
      slug VARCHAR(100) NOT NULL UNIQUE,
      description TEXT,
      color VARCHAR(50),
      icon VARCHAR(50),
      parent_id UUID REFERENCES form_categories(id),
      sort_order INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

-- form_templates (was created at runtime)
CREATE TABLE IF NOT EXISTS form_templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(255) UNIQUE,
      description TEXT,
      category_id UUID REFERENCES form_categories(id),
      category_slug VARCHAR(100),
      subcategory VARCHAR(100),
      template_type VARCHAR(100),
      is_system_template BOOLEAN DEFAULT false,
      is_active BOOLEAN DEFAULT true,
      version VARCHAR(20) DEFAULT ''1.0'',
      version_number INTEGER DEFAULT 1,
      fields JSONB DEFAULT ''[]''::jsonb,
      settings JSONB DEFAULT ''{}''::jsonb,
      fhir_questionnaire JSONB,
      role_visibility JSONB DEFAULT ''["admin","provider","staff","patient"]''::jsonb,
      require_signature BOOLEAN DEFAULT false,
      require_witness BOOLEAN DEFAULT false,
      allow_pdf_export BOOLEAN DEFAULT true,
      languages JSONB DEFAULT ''["en"]''::jsonb,
      translations JSONB DEFAULT ''{}''::jsonb,
      tags JSONB DEFAULT ''[]''::jsonb,
      intake_flow_eligible BOOLEAN DEFAULT true,
      specialty VARCHAR(100),
      compliance_tags JSONB DEFAULT ''[]''::jsonb,
      created_by UUID,
      updated_by UUID,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

-- form_template_versions (was created at runtime)
CREATE TABLE IF NOT EXISTS form_template_versions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      template_id UUID NOT NULL REFERENCES form_templates(id) ON DELETE CASCADE,
      version VARCHAR(20) NOT NULL,
      version_number INTEGER NOT NULL,
      fields JSONB DEFAULT ''[]''::jsonb,
      settings JSONB DEFAULT ''{}''::jsonb,
      fhir_questionnaire JSONB,
      change_summary TEXT,
      changed_by UUID,
      is_published BOOLEAN DEFAULT false,
      published_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    );

-- form_submissions (was created at runtime)
CREATE TABLE IF NOT EXISTS form_submissions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      template_id UUID REFERENCES form_templates(id),
      template_name VARCHAR(255),
      template_version VARCHAR(20),
      patient_id UUID,
      appointment_id UUID,
      intake_flow_id UUID,
      submitted_by UUID,
      submitted_by_role VARCHAR(50),
      form_data JSONB DEFAULT ''{}''::jsonb,
      status VARCHAR(50) DEFAULT ''draft'',
      language VARCHAR(10) DEFAULT ''en'',
      ip_address INET,
      user_agent TEXT,
      submitted_at TIMESTAMP,
      reviewed_by UUID,
      reviewed_at TIMESTAMP,
      reviewer_notes TEXT,
      expires_at TIMESTAMP,
      is_signed BOOLEAN DEFAULT false,
      fhir_response JSONB,
      metadata JSONB DEFAULT ''{}''::jsonb,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

-- form_signatures (was created at runtime)
CREATE TABLE IF NOT EXISTS form_signatures (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      submission_id UUID NOT NULL REFERENCES form_submissions(id) ON DELETE CASCADE,
      signer_name VARCHAR(255) NOT NULL,
      signer_role VARCHAR(100),
      signer_user_id UUID,
      signature_data TEXT NOT NULL,
      signature_type VARCHAR(50) DEFAULT ''drawn'',
      is_witness BOOLEAN DEFAULT false,
      relation VARCHAR(100),
      ip_address INET,
      user_agent TEXT,
      signed_at TIMESTAMP DEFAULT NOW(),
      created_at TIMESTAMP DEFAULT NOW()
    );

-- form_audit_logs (was created at runtime)
CREATE TABLE IF NOT EXISTS form_audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      resource_type VARCHAR(50) NOT NULL,
      resource_id UUID NOT NULL,
      action VARCHAR(100) NOT NULL,
      actor_id UUID,
      actor_role VARCHAR(50),
      actor_name VARCHAR(255),
      patient_id UUID,
      previous_state JSONB,
      new_state JSONB,
      change_details JSONB,
      ip_address INET,
      user_agent TEXT,
      session_id VARCHAR(255),
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );

-- intake_flow_templates (was created at runtime)
CREATE TABLE IF NOT EXISTS intake_flow_templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      flow_id UUID NOT NULL,
      template_id UUID NOT NULL REFERENCES form_templates(id),
      step_order INTEGER NOT NULL DEFAULT 0,
      is_required BOOLEAN DEFAULT true,
      is_conditional BOOLEAN DEFAULT false,
      condition_rules JSONB,
      created_at TIMESTAMP DEFAULT NOW()
    );

-- laboratories (was created at runtime)
CREATE TABLE IF NOT EXISTS laboratories (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          lab_name VARCHAR(255) NOT NULL,
          address_line1 VARCHAR(255),
          address_line2 VARCHAR(255),
          city VARCHAR(100),
          state VARCHAR(2),
          zip_code VARCHAR(10),
          phone VARCHAR(20),
          fax VARCHAR(20),
          email VARCHAR(255),
          website VARCHAR(255),
          clia_number VARCHAR(50),
          npi VARCHAR(20),
          is_active BOOLEAN DEFAULT true,
          accepts_electronic_orders BOOLEAN DEFAULT true,
          specialty VARCHAR(100),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

-- campaigns (was created at runtime)
CREATE TABLE IF NOT EXISTS campaigns (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          subject VARCHAR(500),
          email_content TEXT,
          target_audience VARCHAR(100),
          status VARCHAR(50) DEFAULT ''draft'',
          scheduled_date TIMESTAMP,
          offering_id TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

-- clinic_working_hours (was created at runtime)
CREATE TABLE IF NOT EXISTS clinic_working_hours (
        id SERIAL PRIMARY KEY,
        day VARCHAR(20) NOT NULL UNIQUE,
        is_working BOOLEAN DEFAULT true,
        start_time TIME,
        end_time TIME,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

-- clinic_appointment_settings (was created at runtime)
CREATE TABLE IF NOT EXISTS clinic_appointment_settings (
        id SERIAL PRIMARY KEY,
        default_duration INTEGER DEFAULT 30,
        slot_interval INTEGER DEFAULT 15,
        max_advance_booking INTEGER DEFAULT 90,
        cancellation_deadline INTEGER DEFAULT 24,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

-- telehealth_provider_settings (was created at runtime)
CREATE TABLE IF NOT EXISTS telehealth_provider_settings (
          id SERIAL PRIMARY KEY,
          provider_type VARCHAR(50) UNIQUE NOT NULL,
          is_enabled BOOLEAN DEFAULT false,
          client_id TEXT, client_secret TEXT,
          access_token TEXT, refresh_token TEXT,
          token_type VARCHAR(50) DEFAULT ''Bearer'',
          token_scope TEXT, token_expires_at BIGINT,
          account_id VARCHAR(255), zoom_user_id VARCHAR(255), zoom_user_email VARCHAR(255),
          api_key TEXT, api_secret TEXT, webhook_secret TEXT,
          settings JSONB DEFAULT ''{}''::jsonb,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

-- backup_provider_settings (was created at runtime)
CREATE TABLE IF NOT EXISTS backup_provider_settings (
            id SERIAL PRIMARY KEY,
            provider_type VARCHAR(50) UNIQUE NOT NULL,
            is_enabled BOOLEAN DEFAULT false,
            client_id VARCHAR(255),
            client_secret VARCHAR(255),
            settings JSONB DEFAULT ''{}''::jsonb,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );

-- vendor_integration_settings (was created at runtime)
CREATE TABLE IF NOT EXISTS vendor_integration_settings (
          id SERIAL PRIMARY KEY,
          vendor_type VARCHAR(50) UNIQUE NOT NULL,
          is_enabled BOOLEAN DEFAULT false,
          client_id VARCHAR(255), client_secret VARCHAR(255),
          api_key VARCHAR(255),
          settings JSONB DEFAULT ''{}''::jsonb,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

-- offering_form_links (was created at runtime)
CREATE TABLE IF NOT EXISTS offering_form_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offering_id UUID NOT NULL REFERENCES healthcare_offerings(id) ON DELETE CASCADE,
    form_template_id TEXT NOT NULL,
    form_template_name VARCHAR(255),
    trigger_on VARCHAR(50) DEFAULT ''order'',
    is_active BOOLEAN DEFAULT true,
    created_by UUID,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(offering_id, form_template_id)
  );

-- lab_orders (was created at runtime)
ALTER TABLE lab_orders ALTER COLUMN result_recipients TYPE JSONB USING result_recipients::jsonb;

-- prescriptions (was created at runtime)
ALTER TABLE prescriptions
        ADD COLUMN IF NOT EXISTS diagnosis_id UUID REFERENCES diagnosis(id) ON DELETE SET NULL;
'),
  (2, '002_audit_log_append_only.sql', '-- Tenant migration 002: make the per-tenant audit log append-only (SEC-25)
--
-- control.audit_log (the platform trail) was made immutable in migration 069, but each
-- tenant''s own audit_logs table — the one that records clinical activity, and the one an
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
LANGUAGE plpgsql AS $body002$
BEGIN
  RAISE EXCEPTION ''audit_logs is append-only (% is not permitted)'', TG_OP
    USING HINT = ''Audit records may be inserted and read, never altered or removed.'';
END $body002$;

DROP TRIGGER IF EXISTS audit_logs_no_mutate ON audit_logs;
CREATE TRIGGER audit_logs_no_mutate
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_append_only();
'),
  (3, '003_audit_logs_keep_history.sql', '-- Tenant migration 003: stop foreign keys from trying to rewrite the audit log.
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

DO $body003$
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
     WHERE k.contype = ''f''
       AND c.relname = ''audit_logs''
       AND n.nspname = current_schema()
       AND a.attname IN (''user_id'', ''patient_id'', ''provider_id'')
  LOOP
    EXECUTE format(''ALTER TABLE audit_logs DROP CONSTRAINT %I'', con.conname);
    RAISE NOTICE ''dropped %.% '', current_schema(), con.conname;
  END LOOP;
END $body003$;

-- The ids are still looked up constantly ("everything this user touched"), and without the
-- foreign key there is no longer an implicit index behind them.
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id    ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_patient_id ON audit_logs (patient_id);
');

DO $outer$
DECLARE
  sch  text;
  mig  record;
  done boolean;
  n_schemas int := 0;
  n_applied int := 0;
BEGIN
  FOR sch IN
    SELECT schema_name FROM control.tenants
     WHERE schema_name IS NOT NULL AND status <> 'suspended'
    UNION SELECT 'template'
    UNION SELECT nspname FROM pg_namespace WHERE nspname LIKE 'tenant~_%' ESCAPE '~'
  LOOP
    -- Only touch schemas that are actually provisioned tenants. Creating these objects in
    -- anything else would leave half a tenant behind.
    CONTINUE WHEN to_regclass(format('%I.patients', sch)) IS NULL;
    n_schemas := n_schemas + 1;

    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I.schema_migrations (
         version integer PRIMARY KEY, name text NOT NULL,
         applied_at timestamptz NOT NULL DEFAULT now())', sch);

    -- The runner pins search_path per tenant before each file; do the same.
    EXECUTE format('SET LOCAL search_path TO %I, public, control', sch);

    FOR mig IN SELECT * FROM tenant_migration_files ORDER BY version LOOP
      EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I.schema_migrations WHERE version = %s)',
                     sch, mig.version) INTO done;
      CONTINUE WHEN done;
      EXECUTE mig.body;
      EXECUTE format('INSERT INTO %I.schema_migrations (version, name) VALUES (%s, %L)',
                     sch, mig.version, mig.name);
      n_applied := n_applied + 1;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'tenant migrations: % schema(s) processed, % file(s) applied', n_schemas, n_applied;
END $outer$;

COMMIT;

-- ── Verification ─────────────────────────────────────────────────────────────
-- Each schema's ledger lives in that schema, so this needs dynamic SQL rather than a
-- plain SELECT — an earlier attempt tried the latter and failed with
--     ERROR: column "version" does not exist
-- Any shortfall is raised as a WARNING; silence means every provisioned schema is current.
DO $verify$
DECLARE
  sch text;
  got text;
  want int := (SELECT max(version) FROM (SELECT 1 AS version UNION SELECT 2 UNION SELECT 3) v);
  missing int := 0;
BEGIN
  FOR sch IN
    SELECT schema_name FROM control.tenants
     WHERE schema_name IS NOT NULL AND status <> 'suspended'
    UNION SELECT 'template'
    UNION SELECT nspname FROM pg_namespace WHERE nspname LIKE 'tenant~_%' ESCAPE '~'
  LOOP
    CONTINUE WHEN to_regclass(format('%I.patients', sch)) IS NULL;
    EXECUTE format(
      'SELECT string_agg(version::text, '','' ORDER BY version) FROM %I.schema_migrations
        WHERE version BETWEEN 1 AND %s', sch, want) INTO got;
    IF got IS DISTINCT FROM '1,2,3' THEN
      RAISE WARNING 'incomplete: % has [%], expected 1,2,3', sch, COALESCE(got, 'none');
      missing := missing + 1;
    END IF;
  END LOOP;

  IF missing = 0 THEN
    RAISE NOTICE 'verified: every provisioned tenant schema has tenant migrations 1, 2 and 3';
  ELSE
    RAISE WARNING '% schema(s) incomplete — see the warnings above', missing;
  END IF;
END $verify$;
