-- Migration: Create Patient Intake Forms, Flows, and Consent Forms
-- Description: Add tables for managing patient intake forms, workflows, and consent documentation

-- ============================================================================
-- PATIENT INTAKE FORMS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS patient_intake_forms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  form_type VARCHAR(100) NOT NULL, -- 'general', 'medical_history', 'insurance', 'emergency_contact', 'custom'
  form_name VARCHAR(255) NOT NULL,
  form_data JSONB NOT NULL DEFAULT '{}', -- Stores all form fields as JSON
  status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'submitted', 'reviewed', 'approved', 'rejected'
  submitted_at TIMESTAMP,
  reviewed_at TIMESTAMP,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  attachments JSONB DEFAULT '[]', -- Array of attachment URLs/paths
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- PATIENT INTAKE FLOWS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS patient_intake_flows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  flow_name VARCHAR(255) NOT NULL,
  flow_type VARCHAR(100) NOT NULL, -- 'new_patient', 'annual_checkup', 'pre_surgery', 'custom'
  current_step INTEGER DEFAULT 1,
  total_steps INTEGER NOT NULL,
  steps_completed JSONB DEFAULT '[]', -- Array of completed step numbers
  step_data JSONB DEFAULT '{}', -- Stores data for each step
  status VARCHAR(50) DEFAULT 'in_progress', -- 'in_progress', 'completed', 'abandoned', 'expired'
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  expires_at TIMESTAMP,
  reminder_sent BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- PATIENT CONSENT FORMS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS patient_consent_forms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  consent_type VARCHAR(100) NOT NULL, -- 'treatment', 'privacy', 'release_of_information', 'financial', 'research', 'telehealth', 'custom'
  consent_title VARCHAR(255) NOT NULL,
  consent_description TEXT,
  consent_content TEXT NOT NULL, -- Full consent form text/HTML
  version VARCHAR(50) DEFAULT '1.0',
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'signed', 'declined', 'expired', 'revoked'
  signed_at TIMESTAMP,
  signature_data TEXT, -- Base64 encoded signature image or digital signature
  signature_method VARCHAR(50), -- 'electronic', 'digital', 'physical_scan'
  witness_name VARCHAR(255),
  witness_signature TEXT,
  ip_address VARCHAR(45), -- For audit trail
  user_agent TEXT, -- For audit trail
  expires_at TIMESTAMP,
  revoked_at TIMESTAMP,
  revocation_reason TEXT,
  parent_guardian_name VARCHAR(255), -- For minors
  parent_guardian_relation VARCHAR(100),
  attachments JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_intake_forms_patient_id ON patient_intake_forms(patient_id);
CREATE INDEX IF NOT EXISTS idx_intake_forms_status ON patient_intake_forms(status);
CREATE INDEX IF NOT EXISTS idx_intake_forms_form_type ON patient_intake_forms(form_type);
CREATE INDEX IF NOT EXISTS idx_intake_forms_created_at ON patient_intake_forms(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_intake_flows_patient_id ON patient_intake_flows(patient_id);
CREATE INDEX IF NOT EXISTS idx_intake_flows_status ON patient_intake_flows(status);
CREATE INDEX IF NOT EXISTS idx_intake_flows_flow_type ON patient_intake_flows(flow_type);
CREATE INDEX IF NOT EXISTS idx_intake_flows_created_at ON patient_intake_flows(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_consent_forms_patient_id ON patient_consent_forms(patient_id);
CREATE INDEX IF NOT EXISTS idx_consent_forms_status ON patient_consent_forms(status);
CREATE INDEX IF NOT EXISTS idx_consent_forms_consent_type ON patient_consent_forms(consent_type);
CREATE INDEX IF NOT EXISTS idx_consent_forms_signed_at ON patient_consent_forms(signed_at DESC);
CREATE INDEX IF NOT EXISTS idx_consent_forms_expires_at ON patient_consent_forms(expires_at);

-- ============================================================================
-- SAMPLE DATA (Optional - can be removed in production)
-- ============================================================================
-- Insert sample intake form template data
COMMENT ON TABLE patient_intake_forms IS 'Stores patient intake forms with flexible JSON data structure';
COMMENT ON TABLE patient_intake_flows IS 'Tracks multi-step intake workflows and patient progress';
COMMENT ON TABLE patient_consent_forms IS 'Manages patient consent forms with digital signatures and audit trail';
