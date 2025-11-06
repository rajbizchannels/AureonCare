-- Create comprehensive role-based access control system
-- Supports predefined roles, custom roles, and fine-grained permissions

-- 1. Create roles table
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  is_system_role BOOLEAN DEFAULT FALSE, -- System roles cannot be deleted
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create permissions table
CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  module VARCHAR(50), -- e.g., 'patients', 'appointments', 'billing', 'crm'
  action VARCHAR(50), -- e.g., 'view', 'create', 'edit', 'delete'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create role-permissions mapping table
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- 4. Create plans table
CREATE TABLE IF NOT EXISTS subscription_plans (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2),
  billing_cycle VARCHAR(20), -- 'monthly', 'yearly'
  max_users INTEGER,
  max_patients INTEGER,
  features JSONB, -- Store plan features as JSON
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Create organization settings table for plan management
CREATE TABLE IF NOT EXISTS organization_settings (
  id SERIAL PRIMARY KEY,
  organization_name VARCHAR(255),
  current_plan_id INTEGER REFERENCES subscription_plans(id),
  plan_start_date DATE,
  plan_end_date DATE,
  auto_renew BOOLEAN DEFAULT TRUE,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Add language and active_role to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'en';
ALTER TABLE users ADD COLUMN IF NOT EXISTS active_role VARCHAR(100);

-- 7. Create user_roles table for multiple role support
CREATE TABLE IF NOT EXISTS user_roles (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  assigned_by INTEGER REFERENCES users(id),
  PRIMARY KEY (user_id, role_id)
);

-- Insert predefined system roles
INSERT INTO roles (name, display_name, description, is_system_role) VALUES
  ('admin', 'Administrator', 'Full system access including plan management', TRUE),
  ('doctor', 'Doctor/Provider', 'Medical provider with patient care access', TRUE),
  ('patient', 'Patient', 'Patient portal access and medical records', TRUE),
  ('nurse', 'Nurse', 'Clinical staff with patient care support', TRUE),
  ('receptionist', 'Receptionist', 'Front desk and appointment management', TRUE),
  ('billing_manager', 'Billing Manager', 'Billing and claims management access', TRUE),
  ('crm_manager', 'CRM Manager', 'Customer relationship management access', TRUE),
  ('staff', 'Staff', 'General staff with limited access', TRUE)
ON CONFLICT (name) DO NOTHING;

-- Insert predefined permissions
INSERT INTO permissions (name, display_name, description, module, action) VALUES
  -- Patient Management
  ('patients.view', 'View Patients', 'View patient list and details', 'patients', 'view'),
  ('patients.create', 'Create Patients', 'Add new patients', 'patients', 'create'),
  ('patients.edit', 'Edit Patients', 'Update patient information', 'patients', 'edit'),
  ('patients.delete', 'Delete Patients', 'Remove patients', 'patients', 'delete'),

  -- Appointments
  ('appointments.view', 'View Appointments', 'View appointment calendar', 'appointments', 'view'),
  ('appointments.create', 'Create Appointments', 'Schedule appointments', 'appointments', 'create'),
  ('appointments.edit', 'Edit Appointments', 'Modify appointments', 'appointments', 'edit'),
  ('appointments.delete', 'Delete Appointments', 'Cancel appointments', 'appointments', 'delete'),

  -- Billing
  ('billing.view', 'View Billing', 'View invoices and claims', 'billing', 'view'),
  ('billing.create', 'Create Billing', 'Create new invoices', 'billing', 'create'),
  ('billing.edit', 'Edit Billing', 'Modify invoices and claims', 'billing', 'edit'),
  ('billing.process', 'Process Payments', 'Process payment transactions', 'billing', 'process'),

  -- CRM
  ('crm.view', 'View CRM', 'View customer data and interactions', 'crm', 'view'),
  ('crm.create', 'Create CRM Records', 'Add new customer records', 'crm', 'create'),
  ('crm.edit', 'Edit CRM Records', 'Update customer information', 'crm', 'edit'),
  ('crm.delete', 'Delete CRM Records', 'Remove customer records', 'crm', 'delete'),

  -- Medical Records
  ('ehr.view', 'View Medical Records', 'Access patient medical records', 'ehr', 'view'),
  ('ehr.create', 'Create Medical Records', 'Add medical documentation', 'ehr', 'create'),
  ('ehr.edit', 'Edit Medical Records', 'Update medical records', 'ehr', 'edit'),

  -- Reports
  ('reports.view', 'View Reports', 'Access system reports', 'reports', 'view'),
  ('reports.export', 'Export Reports', 'Export report data', 'reports', 'export'),

  -- Administration
  ('admin.users', 'Manage Users', 'Create and manage user accounts', 'admin', 'manage'),
  ('admin.roles', 'Manage Roles', 'Create and manage roles', 'admin', 'manage'),
  ('admin.plans', 'Manage Plans', 'Change subscription plans', 'admin', 'manage'),
  ('admin.settings', 'Manage Settings', 'Configure system settings', 'admin', 'manage')
ON CONFLICT (name) DO NOTHING;

-- Assign permissions to roles
DO $$
DECLARE
  admin_role_id INTEGER;
  doctor_role_id INTEGER;
  patient_role_id INTEGER;
  nurse_role_id INTEGER;
  receptionist_role_id INTEGER;
  billing_role_id INTEGER;
  crm_role_id INTEGER;
BEGIN
  -- Get role IDs
  SELECT id INTO admin_role_id FROM roles WHERE name = 'admin';
  SELECT id INTO doctor_role_id FROM roles WHERE name = 'doctor';
  SELECT id INTO patient_role_id FROM roles WHERE name = 'patient';
  SELECT id INTO nurse_role_id FROM roles WHERE name = 'nurse';
  SELECT id INTO receptionist_role_id FROM roles WHERE name = 'receptionist';
  SELECT id INTO billing_role_id FROM roles WHERE name = 'billing_manager';
  SELECT id INTO crm_role_id FROM roles WHERE name = 'crm_manager';

  -- Admin gets all permissions
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT admin_role_id, id FROM permissions
  ON CONFLICT DO NOTHING;

  -- Doctor permissions
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT doctor_role_id, id FROM permissions
  WHERE module IN ('patients', 'appointments', 'ehr', 'reports')
  ON CONFLICT DO NOTHING;

  -- Patient permissions (limited)
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT patient_role_id, id FROM permissions
  WHERE name IN ('appointments.view', 'appointments.create', 'ehr.view')
  ON CONFLICT DO NOTHING;

  -- Nurse permissions
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT nurse_role_id, id FROM permissions
  WHERE module IN ('patients', 'appointments', 'ehr') AND action IN ('view', 'create', 'edit')
  ON CONFLICT DO NOTHING;

  -- Receptionist permissions
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT receptionist_role_id, id FROM permissions
  WHERE module IN ('patients', 'appointments') AND action IN ('view', 'create', 'edit')
  ON CONFLICT DO NOTHING;

  -- Billing Manager permissions
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT billing_role_id, id FROM permissions
  WHERE module IN ('billing', 'patients', 'reports')
  ON CONFLICT DO NOTHING;

  -- CRM Manager permissions
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT crm_role_id, id FROM permissions
  WHERE module IN ('crm', 'reports')
  ON CONFLICT DO NOTHING;
END $$;

-- Insert default subscription plans
INSERT INTO subscription_plans (name, display_name, description, price, billing_cycle, max_users, max_patients, features) VALUES
  ('free', 'Free Plan', 'Basic features for small practices', 0.00, 'monthly', 3, 50,
   '{"ehr": true, "appointments": true, "billing": false, "crm": false, "telehealth": false, "integrations": false}'::jsonb),
  ('starter', 'Starter Plan', 'Essential features for growing practices', 99.00, 'monthly', 10, 200,
   '{"ehr": true, "appointments": true, "billing": true, "crm": false, "telehealth": true, "integrations": false}'::jsonb),
  ('professional', 'Professional Plan', 'Advanced features for established practices', 299.00, 'monthly', 25, 1000,
   '{"ehr": true, "appointments": true, "billing": true, "crm": true, "telehealth": true, "integrations": true}'::jsonb),
  ('enterprise', 'Enterprise Plan', 'Complete solution for large organizations', 999.00, 'monthly', -1, -1,
   '{"ehr": true, "appointments": true, "billing": true, "crm": true, "telehealth": true, "integrations": true, "custom_branding": true, "api_access": true}'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- Insert default organization settings
INSERT INTO organization_settings (organization_name, current_plan_id, plan_start_date)
SELECT 'MedFlow Practice', id, CURRENT_DATE
FROM subscription_plans WHERE name = 'free'
ON CONFLICT DO NOTHING;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_language ON users(language);
CREATE INDEX IF NOT EXISTS idx_users_active_role ON users(active_role);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_permissions_module ON permissions(module);

-- Add comments
COMMENT ON TABLE roles IS 'System and custom user roles';
COMMENT ON TABLE permissions IS 'Granular permissions for role-based access control';
COMMENT ON TABLE role_permissions IS 'Mapping between roles and their permissions';
COMMENT ON TABLE subscription_plans IS 'Available subscription plans';
COMMENT ON TABLE organization_settings IS 'Organization-level settings including current plan';
COMMENT ON TABLE user_roles IS 'Users can have multiple roles';
COMMENT ON COLUMN users.language IS 'User preferred language (en, es, fr, etc.)';
COMMENT ON COLUMN users.active_role IS 'Currently active role when user has multiple roles';

SELECT
  'Role-based access control system created successfully' as status,
  (SELECT COUNT(*) FROM roles) as total_roles,
  (SELECT COUNT(*) FROM permissions) as total_permissions,
  (SELECT COUNT(*) FROM subscription_plans) as total_plans;
