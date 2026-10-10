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
-- ordinary single-quoted strings, and the only dollar-quoted blocks are the four
-- top-level ones below, whose tags are letters only.
--
-- Covers tenant migrations 001 to 006. Idempotent: each schema's own schema_migrations
-- ledger is consulted first, so re-pasting this skips whatever is already applied.

BEGIN;

-- The append-only guard, created ONCE in public rather than per schema, so its body is
-- dollar-quoted exactly once at the top level and never nested inside another block.
CREATE OR REPLACE FUNCTION public.audit_logs_append_only() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only (% is not permitted)', TG_OP
    USING HINT = 'Audit records may be inserted and read, never altered or removed.';
END $fn$;

-- ADD CONSTRAINT has no IF NOT EXISTS, and a manual run may meet a schema that is
-- half-applied. One helper keeps that check to a single line per constraint instead of a
-- four-line IF block, and keeps its body dollar-quoted once, at the top level.
CREATE OR REPLACE FUNCTION public.ac_add_constraint(p_schema text, p_table text, p_name text, p_def text)
RETURNS void LANGUAGE plpgsql AS $fnc$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = p_name AND connamespace = p_schema::regnamespace
  ) THEN
    EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I %s', p_schema, p_table, p_name, p_def);
  END IF;
END $fnc$;

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

    -- 004: locations (physical sites)
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I.schema_migrations WHERE version = 4)', sch) INTO done;
    IF NOT done THEN
      EXECUTE 'CREATE TABLE IF NOT EXISTS locations ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name varchar(255) NOT NULL, location_type varchar(30) NOT NULL DEFAULT ''clinic'', address text, city varchar(100), state varchar(100), country varchar(2), postal_code varchar(20), phone varchar(50), email varchar(255), latitude numeric(9,6), longitude numeric(9,6), timezone varchar(100), notes text, is_primary boolean NOT NULL DEFAULT false, is_active boolean NOT NULL DEFAULT true, created_at timestamp DEFAULT CURRENT_TIMESTAMP, updated_at timestamp DEFAULT CURRENT_TIMESTAMP, CONSTRAINT locations_type_chk CHECK (location_type IN (''clinic'', ''camp'', ''mobile'', ''partner'')) )';
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_locations_active ON %I.locations (is_active)', sch);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_locations_type ON %I.locations (location_type)', sch);
      EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS uq_locations_single_primary ON %I.locations (is_primary) WHERE is_primary', sch);
      -- Seed the primary site. current_schema() is sch because of the SET LOCAL above, so
      -- `template` (which has no control.tenants row) gets the table and no row — exactly
      -- as the runner leaves it. New tenants are seeded by services/tenantProvisioning.js.
      EXECUTE 'WITH tp AS (SELECT p.name, p.phone, p.email, p.country, p.timezone FROM control.tenants t JOIN public.practices p ON p.id = t.practice_id WHERE t.schema_name = current_schema() LIMIT 1), tc AS (SELECT name, address, phone, email FROM clinic_info ORDER BY id LIMIT 1) INSERT INTO locations (name, location_type, address, phone, email, country, timezone, is_primary, is_active) SELECT COALESCE(NULLIF(c.name, ''''), NULLIF(p.name, ''''), ''Main Clinic''), ''clinic'', c.address, COALESCE(c.phone, p.phone), COALESCE(c.email, p.email), p.country, p.timezone, true, true FROM tp p LEFT JOIN tc c ON true WHERE NOT EXISTS (SELECT 1 FROM locations)';
      EXECUTE format('INSERT INTO %I.schema_migrations (version, name) VALUES (4, %L)', sch, '004_locations.sql');
      n_applied := n_applied + 1;
    END IF;

    -- 005: location_id on the tables that need a site
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I.schema_migrations WHERE version = 5)', sch) INTO done;
    IF NOT done THEN
      EXECUTE 'ALTER TABLE appointments ADD COLUMN IF NOT EXISTS location_id uuid';
      EXECUTE 'ALTER TABLE inventory_stock_movements ADD COLUMN IF NOT EXISTS location_id uuid';
      EXECUTE 'ALTER TABLE doctor_availability ADD COLUMN IF NOT EXISTS location_id uuid';
      EXECUTE 'ALTER TABLE clinic_working_hours ADD COLUMN IF NOT EXISTS location_id uuid';
      PERFORM public.ac_add_constraint(sch, 'appointments', 'appointments_location_id_fkey', format('FOREIGN KEY (location_id) REFERENCES %I.locations(id) ON DELETE SET NULL', sch));
      PERFORM public.ac_add_constraint(sch, 'inventory_stock_movements', 'inventory_stock_movements_location_id_fkey', format('FOREIGN KEY (location_id) REFERENCES %I.locations(id) ON DELETE SET NULL', sch));
      PERFORM public.ac_add_constraint(sch, 'doctor_availability', 'doctor_availability_location_id_fkey', format('FOREIGN KEY (location_id) REFERENCES %I.locations(id) ON DELETE SET NULL', sch));
      PERFORM public.ac_add_constraint(sch, 'clinic_working_hours', 'clinic_working_hours_location_id_fkey', format('FOREIGN KEY (location_id) REFERENCES %I.locations(id) ON DELETE SET NULL', sch));
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_appointments_location ON %I.appointments (location_id)', sch);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_inv_movements_location ON %I.inventory_stock_movements (location_id)', sch);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_doctor_availability_location ON %I.doctor_availability (location_id)', sch);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_clinic_working_hours_location ON %I.clinic_working_hours (location_id)', sch);
      -- Configuration tables only. appointments and inventory_stock_movements grow without
      -- bound, so NULL there means the primary site (backend/utils/locations.js).
      EXECUTE 'UPDATE clinic_working_hours SET location_id = (SELECT id FROM locations WHERE is_primary LIMIT 1) WHERE location_id IS NULL AND EXISTS (SELECT 1 FROM locations WHERE is_primary)';
      EXECUTE 'UPDATE doctor_availability SET location_id = (SELECT id FROM locations WHERE is_primary LIMIT 1) WHERE location_id IS NULL AND EXISTS (SELECT 1 FROM locations WHERE is_primary)';
      EXECUTE format('INSERT INTO %I.schema_migrations (version, name) VALUES (5, %L)', sch, '005_location_id_columns.sql');
      n_applied := n_applied + 1;
    END IF;

    -- 006: medical camps
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I.schema_migrations WHERE version = 6)', sch) INTO done;
    IF NOT done THEN
      EXECUTE 'CREATE TABLE IF NOT EXISTS camps ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name varchar(255) NOT NULL, description text, location_id uuid REFERENCES locations(id) ON DELETE SET NULL, sponsor_name varchar(255), sponsor_contact varchar(255), funding_source varchar(30) NOT NULL DEFAULT ''self_funded'', is_free boolean NOT NULL DEFAULT true, budget numeric(14,2), currency varchar(3), starts_at timestamp NOT NULL, ends_at timestamp NOT NULL, timezone varchar(100), capacity integer, status varchar(20) NOT NULL DEFAULT ''draft'', next_token_no integer NOT NULL DEFAULT 1, published_at timestamp, started_at timestamp, closed_at timestamp, closed_by uuid, notes text, created_by uuid, created_at timestamp DEFAULT CURRENT_TIMESTAMP, updated_at timestamp DEFAULT CURRENT_TIMESTAMP, CONSTRAINT camps_status_chk CHECK (status IN (''draft'', ''published'', ''in_progress'', ''closed'', ''archived'')), CONSTRAINT camps_funding_chk CHECK (funding_source IN (''self_funded'', ''sponsored'', ''government'', ''ngo'', ''csr'')), CONSTRAINT camps_window_chk CHECK (ends_at > starts_at), CONSTRAINT camps_capacity_chk CHECK (capacity IS NULL OR capacity > 0), CONSTRAINT camps_budget_chk CHECK (budget IS NULL OR budget >= 0) )';
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_camps_status ON %I.camps (status)', sch);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_camps_starts ON %I.camps (starts_at)', sch);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_camps_location ON %I.camps (location_id)', sch);
      EXECUTE 'CREATE TABLE IF NOT EXISTS camp_services ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(), camp_id uuid NOT NULL REFERENCES camps(id) ON DELETE CASCADE, offering_id uuid REFERENCES healthcare_offerings(id) ON DELETE CASCADE, label varchar(255), is_free boolean NOT NULL DEFAULT true, price numeric(12,2), display_order integer NOT NULL DEFAULT 0, created_at timestamp DEFAULT CURRENT_TIMESTAMP, CONSTRAINT camp_services_identified_chk CHECK (offering_id IS NOT NULL OR label IS NOT NULL), CONSTRAINT camp_services_price_chk CHECK (price IS NULL OR price >= 0), CONSTRAINT camp_services_free_price_chk CHECK (NOT (is_free AND price IS NOT NULL AND price > 0)) )';
      EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS uq_camp_services_offering ON %I.camp_services (camp_id, offering_id) WHERE offering_id IS NOT NULL', sch);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_camp_services_camp ON %I.camp_services (camp_id)', sch);
      EXECUTE 'CREATE TABLE IF NOT EXISTS camp_staff ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(), camp_id uuid NOT NULL REFERENCES camps(id) ON DELETE CASCADE, user_id uuid NOT NULL, camp_role varchar(30) NOT NULL DEFAULT ''clinician'', notes text, created_at timestamp DEFAULT CURRENT_TIMESTAMP, CONSTRAINT camp_staff_role_chk CHECK (camp_role IN (''lead'', ''registrar'', ''clinician'', ''nurse'', ''lab'', ''pharmacy'', ''volunteer'')), CONSTRAINT uq_camp_staff UNIQUE (camp_id, user_id) )';
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_camp_staff_camp ON %I.camp_staff (camp_id)', sch);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_camp_staff_user ON %I.camp_staff (user_id)', sch);
      EXECUTE 'CREATE TABLE IF NOT EXISTS camp_stations ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(), camp_id uuid NOT NULL REFERENCES camps(id) ON DELETE CASCADE, name varchar(255) NOT NULL, step_order integer NOT NULL DEFAULT 0, offering_id uuid REFERENCES healthcare_offerings(id) ON DELETE SET NULL, form_template_id uuid REFERENCES form_templates(id) ON DELETE SET NULL, is_clinical boolean NOT NULL DEFAULT true, is_active boolean NOT NULL DEFAULT true, created_at timestamp DEFAULT CURRENT_TIMESTAMP, updated_at timestamp DEFAULT CURRENT_TIMESTAMP )';
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_camp_stations_camp ON %I.camp_stations (camp_id, step_order)', sch);
      EXECUTE 'CREATE TABLE IF NOT EXISTS camp_inventory_allocations ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(), camp_id uuid NOT NULL REFERENCES camps(id) ON DELETE CASCADE, item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT, qty_issued numeric(12,3) NOT NULL, qty_consumed numeric(12,3) NOT NULL DEFAULT 0, qty_returned numeric(12,3) NOT NULL DEFAULT 0, issue_movement_id uuid REFERENCES inventory_stock_movements(id) ON DELETE SET NULL, return_movement_id uuid REFERENCES inventory_stock_movements(id) ON DELETE SET NULL, reconciled_at timestamp, reconciled_by uuid, notes text, created_at timestamp DEFAULT CURRENT_TIMESTAMP, updated_at timestamp DEFAULT CURRENT_TIMESTAMP, CONSTRAINT camp_alloc_issued_chk CHECK (qty_issued > 0), CONSTRAINT camp_alloc_consumed_chk CHECK (qty_consumed >= 0), CONSTRAINT camp_alloc_returned_chk CHECK (qty_returned >= 0), CONSTRAINT camp_alloc_balance_chk CHECK (qty_consumed + qty_returned <= qty_issued), CONSTRAINT uq_camp_alloc UNIQUE (camp_id, item_id) )';
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_camp_alloc_camp ON %I.camp_inventory_allocations (camp_id)', sch);
      EXECUTE 'CREATE TABLE IF NOT EXISTS camp_registrations ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(), camp_id uuid NOT NULL REFERENCES camps(id) ON DELETE CASCADE, token_no integer NOT NULL, full_name varchar(255) NOT NULL, phone varchar(50), email varchar(255), age_years integer, date_of_birth date, gender varchar(20), address text, city varchar(100), consent_given_at timestamp, consent_form_submission_id uuid REFERENCES form_submissions(id) ON DELETE SET NULL, status varchar(20) NOT NULL DEFAULT ''registered'', patient_id uuid REFERENCES patients(id) ON DELETE SET NULL, promoted_at timestamp, registered_by uuid, notes text, created_at timestamp DEFAULT CURRENT_TIMESTAMP, updated_at timestamp DEFAULT CURRENT_TIMESTAMP, CONSTRAINT camp_reg_status_chk CHECK (status IN (''registered'', ''in_progress'', ''completed'', ''left_early'', ''cancelled'')), CONSTRAINT camp_reg_age_chk CHECK (age_years IS NOT NULL OR date_of_birth IS NOT NULL), CONSTRAINT camp_reg_age_range_chk CHECK (age_years IS NULL OR (age_years >= 0 AND age_years <= 130)), CONSTRAINT uq_camp_reg_token UNIQUE (camp_id, token_no) )';
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_camp_reg_camp ON %I.camp_registrations (camp_id, token_no)', sch);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_camp_reg_phone ON %I.camp_registrations (phone)', sch);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_camp_reg_patient ON %I.camp_registrations (patient_id)', sch);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_camp_reg_status ON %I.camp_registrations (camp_id, status)', sch);
      EXECUTE 'CREATE TABLE IF NOT EXISTS camp_station_visits ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(), registration_id uuid NOT NULL REFERENCES camp_registrations(id) ON DELETE CASCADE, station_id uuid NOT NULL REFERENCES camp_stations(id) ON DELETE CASCADE, status varchar(20) NOT NULL DEFAULT ''queued'', queued_at timestamp DEFAULT CURRENT_TIMESTAMP, started_at timestamp, completed_at timestamp, handled_by uuid, outcome varchar(30), notes text, created_at timestamp DEFAULT CURRENT_TIMESTAMP, updated_at timestamp DEFAULT CURRENT_TIMESTAMP, CONSTRAINT camp_visit_status_chk CHECK (status IN (''queued'', ''in_progress'', ''completed'', ''skipped'')), CONSTRAINT camp_visit_outcome_chk CHECK (outcome IS NULL OR outcome IN (''normal'', ''referred'', ''follow_up'', ''declined'', ''no_show'')), CONSTRAINT uq_camp_visit UNIQUE (registration_id, station_id) )';
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_camp_visit_station ON %I.camp_station_visits (station_id, status)', sch);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_camp_visit_reg ON %I.camp_station_visits (registration_id)', sch);
      -- The camp_id stamps. Nullable and ON DELETE SET NULL: deleting a camp must never
      -- cascade into clinical history.
      FOR con IN SELECT unnest(ARRAY['campaigns', 'appointments', 'medical_records', 'diagnosis', 'prescriptions', 'lab_orders']) AS t LOOP
        EXECUTE format('ALTER TABLE %I.%I ADD COLUMN IF NOT EXISTS camp_id uuid', sch, con.t);
        PERFORM public.ac_add_constraint(sch, con.t, con.t || '_camp_id_fkey', format('FOREIGN KEY (camp_id) REFERENCES %I.camps(id) ON DELETE SET NULL', sch));
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.%I (camp_id)', 'idx_' || con.t || '_camp', sch, con.t);
      END LOOP;
      -- 055 constrained reference_type to four values, so issuing stock to a camp would
      -- fail the CHECK. Widen it rather than overload 'department', which would make camp
      -- consumption indistinguishable from internal transfers in every stock report.
      EXECUTE format('ALTER TABLE %I.inventory_stock_movements DROP CONSTRAINT IF EXISTS inventory_stock_movements_reference_type_check', sch);
      PERFORM public.ac_add_constraint(sch, 'inventory_stock_movements', 'inventory_stock_movements_reference_type_check', 'CHECK (reference_type IS NULL OR reference_type IN (''purchase_order'', ''patient'', ''department'', ''adjustment'', ''camp''))');
      EXECUTE format('INSERT INTO %I.schema_migrations (version, name) VALUES (6, %L)', sch, '006_camps.sql');
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
    EXECUTE format('SELECT string_agg(version::text, '','' ORDER BY version) FROM %I.schema_migrations WHERE version BETWEEN 1 AND 6', sch) INTO got;
    IF got IS DISTINCT FROM '1,2,3,4,5,6' THEN
      RAISE WARNING 'incomplete: % has [%], expected 1,2,3,4,5,6', sch, COALESCE(got, 'none');
      missing := missing + 1;
    END IF;
  END LOOP;
  IF missing = 0 THEN
    RAISE NOTICE 'verified: every provisioned tenant schema has tenant migrations 1 to 6';
  END IF;
END $verify$;
