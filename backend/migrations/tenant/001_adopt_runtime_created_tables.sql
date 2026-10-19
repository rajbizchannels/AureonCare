-- Tenant migration 001: adopt tables that routes used to create at runtime
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
      version VARCHAR(20) DEFAULT '1.0',
      version_number INTEGER DEFAULT 1,
      fields JSONB DEFAULT '[]'::jsonb,
      settings JSONB DEFAULT '{}'::jsonb,
      fhir_questionnaire JSONB,
      role_visibility JSONB DEFAULT '["admin","provider","staff","patient"]'::jsonb,
      require_signature BOOLEAN DEFAULT false,
      require_witness BOOLEAN DEFAULT false,
      allow_pdf_export BOOLEAN DEFAULT true,
      languages JSONB DEFAULT '["en"]'::jsonb,
      translations JSONB DEFAULT '{}'::jsonb,
      tags JSONB DEFAULT '[]'::jsonb,
      intake_flow_eligible BOOLEAN DEFAULT true,
      specialty VARCHAR(100),
      compliance_tags JSONB DEFAULT '[]'::jsonb,
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
      fields JSONB DEFAULT '[]'::jsonb,
      settings JSONB DEFAULT '{}'::jsonb,
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
      form_data JSONB DEFAULT '{}'::jsonb,
      status VARCHAR(50) DEFAULT 'draft',
      language VARCHAR(10) DEFAULT 'en',
      ip_address INET,
      user_agent TEXT,
      submitted_at TIMESTAMP,
      reviewed_by UUID,
      reviewed_at TIMESTAMP,
      reviewer_notes TEXT,
      expires_at TIMESTAMP,
      is_signed BOOLEAN DEFAULT false,
      fhir_response JSONB,
      metadata JSONB DEFAULT '{}'::jsonb,
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
      signature_type VARCHAR(50) DEFAULT 'drawn',
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
          status VARCHAR(50) DEFAULT 'draft',
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
          token_type VARCHAR(50) DEFAULT 'Bearer',
          token_scope TEXT, token_expires_at BIGINT,
          account_id VARCHAR(255), zoom_user_id VARCHAR(255), zoom_user_email VARCHAR(255),
          api_key TEXT, api_secret TEXT, webhook_secret TEXT,
          settings JSONB DEFAULT '{}'::jsonb,
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
            settings JSONB DEFAULT '{}'::jsonb,
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
          settings JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

-- offering_form_links (was created at runtime)
CREATE TABLE IF NOT EXISTS offering_form_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offering_id UUID NOT NULL REFERENCES healthcare_offerings(id) ON DELETE CASCADE,
    form_template_id TEXT NOT NULL,
    form_template_name VARCHAR(255),
    trigger_on VARCHAR(50) DEFAULT 'order',
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
