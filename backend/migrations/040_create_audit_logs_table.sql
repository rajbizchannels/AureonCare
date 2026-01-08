-- Migration 040: Create audit_logs table for comprehensive form/modal/view auditing
-- This table tracks all user interactions with forms, modals, and views across the system

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- User and session information
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_email VARCHAR(255),
  user_name VARCHAR(255),
  user_role VARCHAR(100),
  session_id VARCHAR(255),
  ip_address VARCHAR(45), -- IPv6 support
  user_agent TEXT,

  -- Action details
  action_type VARCHAR(50) NOT NULL, -- 'view', 'create', 'update', 'delete', 'submit', 'open', 'close'
  resource_type VARCHAR(100) NOT NULL, -- 'form', 'modal', 'view'
  resource_name VARCHAR(255) NOT NULL, -- 'DiagnosisForm', 'NewPatientForm', 'PatientLoginPage', etc.
  resource_id VARCHAR(255), -- ID of the specific resource instance (optional)

  -- Action context
  action_description TEXT, -- Human-readable description of the action
  module VARCHAR(100), -- 'EHR', 'RCM', 'Admin', 'Patient Portal', etc.

  -- Data changes (for create/update/delete actions)
  old_values JSONB, -- Previous values (for updates/deletes)
  new_values JSONB, -- New values (for creates/updates)
  changed_fields TEXT[], -- Array of field names that changed

  -- Related entities
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  provider_id UUID REFERENCES providers(id) ON DELETE SET NULL,
  appointment_id UUID, -- Can reference appointments if needed
  claim_id UUID, -- Can reference claims if needed

  -- Status and metadata
  status VARCHAR(50) DEFAULT 'success', -- 'success', 'error', 'warning'
  error_message TEXT,
  duration_ms INTEGER, -- Time taken for the action (in milliseconds)
  metadata JSONB DEFAULT '{}', -- Additional contextual data

  -- Audit trail
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Retention policy flag
  retention_days INTEGER DEFAULT 90 -- How long to keep this log (configurable per action type)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_email ON audit_logs(user_email);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_name ON audit_logs(resource_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_patient_id ON audit_logs(patient_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_provider_id ON audit_logs(provider_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON audit_logs(module);
CREATE INDEX IF NOT EXISTS idx_audit_logs_status ON audit_logs(status);

-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_date ON audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_date ON audit_logs(resource_type, resource_name, created_at DESC);

-- Add comment for documentation
COMMENT ON TABLE audit_logs IS 'Comprehensive audit trail for all forms, modals, and views in the system';
COMMENT ON COLUMN audit_logs.action_type IS 'Type of action: view, create, update, delete, submit, open, close';
COMMENT ON COLUMN audit_logs.resource_type IS 'Type of resource: form, modal, view';
COMMENT ON COLUMN audit_logs.resource_name IS 'Name of the specific form/modal/view component';
COMMENT ON COLUMN audit_logs.changed_fields IS 'Array of field names that were modified during update actions';
COMMENT ON COLUMN audit_logs.metadata IS 'Additional context like form validation errors, navigation path, etc.';

-- Insert audit permissions into permissions table
INSERT INTO permissions (name, display_name, description, module, action) VALUES
  ('audit.view', 'View Audit Logs', 'Can view audit logs and activity history', 'audit', 'view'),
  ('audit.export', 'Export Audit Logs', 'Can export audit logs to CSV/JSON', 'audit', 'export'),
  ('audit.delete', 'Delete Audit Logs', 'Can delete old audit log entries', 'audit', 'delete'),
  ('audit.admin', 'Audit Administration', 'Full access to audit log management', 'audit', 'admin')
ON CONFLICT (name) DO NOTHING;

-- Grant audit view permission to admin role by default
DO $$
DECLARE
  admin_role_id INTEGER;
  audit_view_permission_id INTEGER;
  audit_export_permission_id INTEGER;
  audit_admin_permission_id INTEGER;
BEGIN
  -- Get the admin role ID
  SELECT id INTO admin_role_id FROM roles WHERE name = 'admin' LIMIT 1;

  -- Get the audit permission IDs
  SELECT id INTO audit_view_permission_id FROM permissions WHERE name = 'audit.view' LIMIT 1;
  SELECT id INTO audit_export_permission_id FROM permissions WHERE name = 'audit.export' LIMIT 1;
  SELECT id INTO audit_admin_permission_id FROM permissions WHERE name = 'audit.admin' LIMIT 1;

  -- Assign permissions to admin role
  IF admin_role_id IS NOT NULL THEN
    IF audit_view_permission_id IS NOT NULL THEN
      INSERT INTO role_permissions (role_id, permission_id) VALUES (admin_role_id, audit_view_permission_id)
      ON CONFLICT DO NOTHING;
    END IF;

    IF audit_export_permission_id IS NOT NULL THEN
      INSERT INTO role_permissions (role_id, permission_id) VALUES (admin_role_id, audit_export_permission_id)
      ON CONFLICT DO NOTHING;
    END IF;

    IF audit_admin_permission_id IS NOT NULL THEN
      INSERT INTO role_permissions (role_id, permission_id) VALUES (admin_role_id, audit_admin_permission_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
END $$;
