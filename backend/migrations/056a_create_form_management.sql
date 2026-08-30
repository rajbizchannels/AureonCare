-- ============================================================================
-- FORM MANAGEMENT MODULE SCHEMA
-- ============================================================================

-- Form categories
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

-- Form templates
CREATE TABLE IF NOT EXISTS form_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE,
  description TEXT,
  category_id UUID REFERENCES form_categories(id),
  category_slug VARCHAR(100),
  subcategory VARCHAR(100),
  template_type VARCHAR(100), -- 'onboarding', 'consent', 'medical', 'billing', 'clinical', 'legal', 'operational', 'feedback', 'communication', 'scheduling'
  is_system_template BOOLEAN DEFAULT false, -- pre-built templates cannot be deleted
  is_active BOOLEAN DEFAULT true,
  version VARCHAR(20) DEFAULT '1.0',
  version_number INTEGER DEFAULT 1,
  fields JSONB DEFAULT '[]'::jsonb, -- Array of field definitions
  settings JSONB DEFAULT '{}'::jsonb, -- Form-level settings (title, header, footer, etc.)
  fhir_questionnaire JSONB, -- FHIR R4 Questionnaire resource mapping
  role_visibility JSONB DEFAULT '["admin","provider","staff","patient"]'::jsonb, -- Roles that can see/use this form
  require_signature BOOLEAN DEFAULT false,
  require_witness BOOLEAN DEFAULT false,
  allow_pdf_export BOOLEAN DEFAULT true,
  languages JSONB DEFAULT '["en"]'::jsonb, -- Supported languages
  translations JSONB DEFAULT '{}'::jsonb, -- Field label translations by language
  tags JSONB DEFAULT '[]'::jsonb,
  intake_flow_eligible BOOLEAN DEFAULT true, -- Can be added to patient intake flows
  specialty VARCHAR(100), -- Specialty-specific forms (behavioral_health, dentistry, pediatrics, etc.)
  compliance_tags JSONB DEFAULT '[]'::jsonb, -- HIPAA, GDPR, etc.
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Form template versions (version control)
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

-- Form submissions (patient-filled instances)
CREATE TABLE IF NOT EXISTS form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES form_templates(id),
  template_name VARCHAR(255),
  template_version VARCHAR(20),
  patient_id UUID,
  appointment_id UUID,
  intake_flow_id UUID,
  submitted_by UUID, -- user who submitted (could be patient or staff)
  submitted_by_role VARCHAR(50),
  form_data JSONB DEFAULT '{}'::jsonb, -- Submitted field values
  status VARCHAR(50) DEFAULT 'draft', -- draft, submitted, reviewed, approved, rejected, expired
  language VARCHAR(10) DEFAULT 'en',
  ip_address INET,
  user_agent TEXT,
  submitted_at TIMESTAMP,
  reviewed_by UUID,
  reviewed_at TIMESTAMP,
  reviewer_notes TEXT,
  expires_at TIMESTAMP,
  is_signed BOOLEAN DEFAULT false,
  fhir_response JSONB, -- FHIR QuestionnaireResponse resource
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Form signatures (eSignature storage)
CREATE TABLE IF NOT EXISTS form_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES form_submissions(id) ON DELETE CASCADE,
  signer_name VARCHAR(255) NOT NULL,
  signer_role VARCHAR(100), -- patient, guardian, provider, witness
  signer_user_id UUID,
  signature_data TEXT NOT NULL, -- Base64 encoded canvas image or typed name
  signature_type VARCHAR(50) DEFAULT 'drawn', -- drawn, typed, uploaded
  is_witness BOOLEAN DEFAULT false,
  relation VARCHAR(100), -- For guardian/representative signatures
  ip_address INET,
  user_agent TEXT,
  signed_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Form audit logs
CREATE TABLE IF NOT EXISTS form_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type VARCHAR(50) NOT NULL, -- 'template', 'submission', 'signature'
  resource_id UUID NOT NULL,
  action VARCHAR(100) NOT NULL, -- created, updated, deleted, submitted, signed, viewed, exported, etc.
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

-- Intake flow form assignments (which forms are in a flow)
CREATE TABLE IF NOT EXISTS intake_flow_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id UUID NOT NULL, -- references patient_intake_flows
  template_id UUID NOT NULL REFERENCES form_templates(id),
  step_order INTEGER NOT NULL DEFAULT 0,
  is_required BOOLEAN DEFAULT true,
  is_conditional BOOLEAN DEFAULT false,
  condition_rules JSONB, -- JSON condition to determine if this form shows
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_form_templates_category ON form_templates(category_slug);
CREATE INDEX IF NOT EXISTS idx_form_templates_type ON form_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_form_templates_active ON form_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_form_templates_specialty ON form_templates(specialty);
CREATE INDEX IF NOT EXISTS idx_form_submissions_patient ON form_submissions(patient_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_template ON form_submissions(template_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_status ON form_submissions(status);
CREATE INDEX IF NOT EXISTS idx_form_submissions_appointment ON form_submissions(appointment_id);
CREATE INDEX IF NOT EXISTS idx_form_audit_resource ON form_audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_form_audit_patient ON form_audit_logs(patient_id);
CREATE INDEX IF NOT EXISTS idx_form_audit_actor ON form_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_form_versions_template ON form_template_versions(template_id);
CREATE INDEX IF NOT EXISTS idx_form_signatures_submission ON form_signatures(submission_id);
