-- Apply the TENANT migrations across every tenant schema.
--
-- Equivalent to: node backend/run-tenant-migrations.js
--
-- Why the raw files fail when pasted into a SQL editor: tenant/*.sql use UNQUALIFIED table
-- names on purpose, because the runner sets search_path per tenant before executing each
-- one. Run them directly and audit_logs resolves against public, where it does not exist:
--     ERROR: 42P01: relation "audit_logs" does not exist
--
-- Three earlier attempts failed in the Supabase SQL editor only (all fine under psql):
--   * nested dollar quoting, three deep
--   * the file bodies as one huge single-quoted literal
--   * per-statement dollar-quote tags containing DIGITS, which a letters-only tag matcher
--     does not recognise
-- So there is now NO nested dollar quoting anywhere. The per-schema DDL is executed from
-- ordinary single-quoted strings, and the only dollar-quoted blocks are the three
-- top-level ones below, whose tags are letters only.

BEGIN;

-- The append-only guard, created ONCE in public rather than per schema, so its body is
-- dollar-quoted exactly once at the top level and never nested inside another block.
CREATE OR REPLACE FUNCTION public.audit_logs_append_only() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only (% is not permitted)', TG_OP
    USING HINT = 'Audit records may be inserted and read, never altered or removed.';
END $fn$;

DO $outer$
DECLARE
  sch  text;
  con  record;
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
    CONTINUE WHEN to_regclass(format('%I.patients', sch)) IS NULL;
    n_schemas := n_schemas + 1;

    EXECUTE format('CREATE TABLE IF NOT EXISTS %I.schema_migrations (version integer PRIMARY KEY, name text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())', sch);
    EXECUTE format('SET LOCAL search_path TO %I, public, control', sch);

    -- 001: adopt the tables routes used to create at runtime
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I.schema_migrations WHERE version = 1)', sch) INTO done;
    IF NOT done THEN
      EXECUTE 'CREATE TABLE IF NOT EXISTS form_categories ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR(100) NOT NULL, slug VARCHAR(100) NOT NULL UNIQUE, description TEXT, color VARCHAR(50), icon VARCHAR(50), parent_id UUID REFERENCES form_categories(id), sort_order INTEGER DEFAULT 0, is_active BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW() )';
      EXECUTE 'CREATE TABLE IF NOT EXISTS form_templates ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR(255) NOT NULL, slug VARCHAR(255) UNIQUE, description TEXT, category_id UUID REFERENCES form_categories(id), category_slug VARCHAR(100), subcategory VARCHAR(100), template_type VARCHAR(100), is_system_template BOOLEAN DEFAULT false, is_active BOOLEAN DEFAULT true, version VARCHAR(20) DEFAULT ''1.0'', version_number INTEGER DEFAULT 1, fields JSONB DEFAULT ''[]''::jsonb, settings JSONB DEFAULT ''{}''::jsonb, fhir_questionnaire JSONB, role_visibility JSONB DEFAULT ''["admin","provider","staff","patient"]''::jsonb, require_signature BOOLEAN DEFAULT false, require_witness BOOLEAN DEFAULT false, allow_pdf_export BOOLEAN DEFAULT true, languages JSONB DEFAULT ''["en"]''::jsonb, translations JSONB DEFAULT ''{}''::jsonb, tags JSONB DEFAULT ''[]''::jsonb, intake_flow_eligible BOOLEAN DEFAULT true, specialty VARCHAR(100), compliance_tags JSONB DEFAULT ''[]''::jsonb, created_by UUID, updated_by UUID, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW() )';
      EXECUTE 'CREATE TABLE IF NOT EXISTS form_template_versions ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), template_id UUID NOT NULL REFERENCES form_templates(id) ON DELETE CASCADE, version VARCHAR(20) NOT NULL, version_number INTEGER NOT NULL, fields JSONB DEFAULT ''[]''::jsonb, settings JSONB DEFAULT ''{}''::jsonb, fhir_questionnaire JSONB, change_summary TEXT, changed_by UUID, is_published BOOLEAN DEFAULT false, published_at TIMESTAMP, created_at TIMESTAMP DEFAULT NOW() )';
      EXECUTE 'CREATE TABLE IF NOT EXISTS form_submissions ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), template_id UUID REFERENCES form_templates(id), template_name VARCHAR(255), template_version VARCHAR(20), patient_id UUID, appointment_id UUID, intake_flow_id UUID, submitted_by UUID, submitted_by_role VARCHAR(50), form_data JSONB DEFAULT ''{}''::jsonb, status VARCHAR(50) DEFAULT ''draft'', language VARCHAR(10) DEFAULT ''en'', ip_address INET, user_agent TEXT, submitted_at TIMESTAMP, reviewed_by UUID, reviewed_at TIMESTAMP, reviewer_notes TEXT, expires_at TIMESTAMP, is_signed BOOLEAN DEFAULT false, fhir_response JSONB, metadata JSONB DEFAULT ''{}''::jsonb, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW() )';
      EXECUTE 'CREATE TABLE IF NOT EXISTS form_signatures ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), submission_id UUID NOT NULL REFERENCES form_submissions(id) ON DELETE CASCADE, signer_name VARCHAR(255) NOT NULL, signer_role VARCHAR(100), signer_user_id UUID, signature_data TEXT NOT NULL, signature_type VARCHAR(50) DEFAULT ''drawn'', is_witness BOOLEAN DEFAULT false, relation VARCHAR(100), ip_address INET, user_agent TEXT, signed_at TIMESTAMP DEFAULT NOW(), created_at TIMESTAMP DEFAULT NOW() )';
      EXECUTE 'CREATE TABLE IF NOT EXISTS form_audit_logs ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), resource_type VARCHAR(50) NOT NULL, resource_id UUID NOT NULL, action VARCHAR(100) NOT NULL, actor_id UUID, actor_role VARCHAR(50), actor_name VARCHAR(255), patient_id UUID, previous_state JSONB, new_state JSONB, change_details JSONB, ip_address INET, user_agent TEXT, session_id VARCHAR(255), notes TEXT, created_at TIMESTAMP DEFAULT NOW() )';
      EXECUTE 'CREATE TABLE IF NOT EXISTS intake_flow_templates ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), flow_id UUID NOT NULL, template_id UUID NOT NULL REFERENCES form_templates(id), step_order INTEGER NOT NULL DEFAULT 0, is_required BOOLEAN DEFAULT true, is_conditional BOOLEAN DEFAULT false, condition_rules JSONB, created_at TIMESTAMP DEFAULT NOW() )';
      EXECUTE 'CREATE TABLE IF NOT EXISTS laboratories ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), lab_name VARCHAR(255) NOT NULL, address_line1 VARCHAR(255), address_line2 VARCHAR(255), city VARCHAR(100), state VARCHAR(2), zip_code VARCHAR(10), phone VARCHAR(20), fax VARCHAR(20), email VARCHAR(255), website VARCHAR(255), clia_number VARCHAR(50), npi VARCHAR(20), is_active BOOLEAN DEFAULT true, accepts_electronic_orders BOOLEAN DEFAULT true, specialty VARCHAR(100), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP )';
      EXECUTE 'CREATE TABLE IF NOT EXISTS campaigns ( id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, subject VARCHAR(500), email_content TEXT, target_audience VARCHAR(100), status VARCHAR(50) DEFAULT ''draft'', scheduled_date TIMESTAMP, offering_id TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP )';
      EXECUTE 'CREATE TABLE IF NOT EXISTS clinic_working_hours ( id SERIAL PRIMARY KEY, day VARCHAR(20) NOT NULL UNIQUE, is_working BOOLEAN DEFAULT true, start_time TIME, end_time TIME, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP )';
      EXECUTE 'CREATE TABLE IF NOT EXISTS clinic_appointment_settings ( id SERIAL PRIMARY KEY, default_duration INTEGER DEFAULT 30, slot_interval INTEGER DEFAULT 15, max_advance_booking INTEGER DEFAULT 90, cancellation_deadline INTEGER DEFAULT 24, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP )';
      EXECUTE 'CREATE TABLE IF NOT EXISTS telehealth_provider_settings ( id SERIAL PRIMARY KEY, provider_type VARCHAR(50) UNIQUE NOT NULL, is_enabled BOOLEAN DEFAULT false, client_id TEXT, client_secret TEXT, access_token TEXT, refresh_token TEXT, token_type VARCHAR(50) DEFAULT ''Bearer'', token_scope TEXT, token_expires_at BIGINT, account_id VARCHAR(255), zoom_user_id VARCHAR(255), zoom_user_email VARCHAR(255), api_key TEXT, api_secret TEXT, webhook_secret TEXT, settings JSONB DEFAULT ''{}''::jsonb, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP )';
      EXECUTE 'CREATE TABLE IF NOT EXISTS backup_provider_settings ( id SERIAL PRIMARY KEY, provider_type VARCHAR(50) UNIQUE NOT NULL, is_enabled BOOLEAN DEFAULT false, client_id VARCHAR(255), client_secret VARCHAR(255), settings JSONB DEFAULT ''{}''::jsonb, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP )';
      EXECUTE 'CREATE TABLE IF NOT EXISTS vendor_integration_settings ( id SERIAL PRIMARY KEY, vendor_type VARCHAR(50) UNIQUE NOT NULL, is_enabled BOOLEAN DEFAULT false, client_id VARCHAR(255), client_secret VARCHAR(255), api_key VARCHAR(255), settings JSONB DEFAULT ''{}''::jsonb, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP )';
      EXECUTE 'CREATE TABLE IF NOT EXISTS offering_form_links ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), offering_id UUID NOT NULL REFERENCES healthcare_offerings(id) ON DELETE CASCADE, form_template_id TEXT NOT NULL, form_template_name VARCHAR(255), trigger_on VARCHAR(50) DEFAULT ''order'', is_active BOOLEAN DEFAULT true, created_by UUID, created_at TIMESTAMP DEFAULT NOW(), UNIQUE(offering_id, form_template_id) )';
      EXECUTE 'ALTER TABLE lab_orders ALTER COLUMN result_recipients TYPE JSONB USING result_recipients::jsonb';
      EXECUTE 'ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS diagnosis_id UUID REFERENCES diagnosis(id) ON DELETE SET NULL';
      EXECUTE format('INSERT INTO %I.schema_migrations (version, name) VALUES (1, %L)', sch, '001_adopt_runtime_created_tables.sql');
      n_applied := n_applied + 1;
    END IF;

    -- 002: make audit_logs append-only
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I.schema_migrations WHERE version = 2)', sch) INTO done;
    IF NOT done THEN
      EXECUTE format('DROP TRIGGER IF EXISTS audit_logs_no_mutate ON %I.audit_logs', sch);
      EXECUTE format('CREATE TRIGGER audit_logs_no_mutate BEFORE UPDATE OR DELETE ON %I.audit_logs FOR EACH ROW EXECUTE FUNCTION public.audit_logs_append_only()', sch);
      EXECUTE format('INSERT INTO %I.schema_migrations (version, name) VALUES (2, %L)', sch, '002_audit_log_append_only.sql');
      n_applied := n_applied + 1;
    END IF;

    -- 003: stop the foreign keys rewriting the trail on delete
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I.schema_migrations WHERE version = 3)', sch) INTO done;
    IF NOT done THEN
      FOR con IN
        SELECT k.conname
          FROM pg_constraint k
          JOIN pg_class c ON c.oid = k.conrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
          JOIN unnest(k.conkey) AS ck(attnum) ON true
          JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ck.attnum
         WHERE k.contype = 'f' AND c.relname = 'audit_logs' AND n.nspname = sch
           AND a.attname IN ('user_id', 'patient_id', 'provider_id')
      LOOP
        EXECUTE format('ALTER TABLE %I.audit_logs DROP CONSTRAINT %I', sch, con.conname);
      END LOOP;
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON %I.audit_logs (user_id)', sch);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_audit_logs_patient_id ON %I.audit_logs (patient_id)', sch);
      EXECUTE format('INSERT INTO %I.schema_migrations (version, name) VALUES (3, %L)', sch, '003_audit_logs_keep_history.sql');
      n_applied := n_applied + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'tenant migrations: % schema(s) processed, % file(s) applied', n_schemas, n_applied;
END $outer$;

COMMIT;

-- Verification: silence means every provisioned schema is current.
DO $verify$
DECLARE
  sch text;
  got text;
  missing int := 0;
BEGIN
  FOR sch IN
    SELECT schema_name FROM control.tenants
     WHERE schema_name IS NOT NULL AND status <> 'suspended'
    UNION SELECT 'template'
    UNION SELECT nspname FROM pg_namespace WHERE nspname LIKE 'tenant~_%' ESCAPE '~'
  LOOP
    CONTINUE WHEN to_regclass(format('%I.patients', sch)) IS NULL;
    EXECUTE format('SELECT string_agg(version::text, '','' ORDER BY version) FROM %I.schema_migrations WHERE version BETWEEN 1 AND 3', sch) INTO got;
    IF got IS DISTINCT FROM '1,2,3' THEN
      RAISE WARNING 'incomplete: % has [%], expected 1,2,3', sch, COALESCE(got, 'none');
      missing := missing + 1;
    END IF;
  END LOOP;
  IF missing = 0 THEN
    RAISE NOTICE 'verified: every provisioned tenant schema has tenant migrations 1, 2 and 3';
  END IF;
END $verify$;
