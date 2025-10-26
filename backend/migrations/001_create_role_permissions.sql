-- Create role_permissions table
CREATE TABLE IF NOT EXISTS role_permissions (
  id SERIAL PRIMARY KEY,
  role VARCHAR(50) NOT NULL,
  module VARCHAR(50) NOT NULL,
  view_permission BOOLEAN DEFAULT FALSE,
  create_permission BOOLEAN DEFAULT FALSE,
  edit_permission BOOLEAN DEFAULT FALSE,
  delete_permission BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(role, module)
);

-- Insert default permissions for admin role
INSERT INTO role_permissions (role, module, view_permission, create_permission, edit_permission, delete_permission) VALUES
('admin', 'patients', TRUE, TRUE, TRUE, TRUE),
('admin', 'appointments', TRUE, TRUE, TRUE, TRUE),
('admin', 'claims', TRUE, TRUE, TRUE, TRUE),
('admin', 'ehr', TRUE, TRUE, TRUE, TRUE),
('admin', 'users', TRUE, TRUE, TRUE, TRUE),
('admin', 'reports', TRUE, TRUE, TRUE, TRUE),
('admin', 'settings', TRUE, TRUE, TRUE, TRUE)
ON CONFLICT (role, module) DO NOTHING;

-- Insert default permissions for doctor role
INSERT INTO role_permissions (role, module, view_permission, create_permission, edit_permission, delete_permission) VALUES
('doctor', 'patients', TRUE, TRUE, TRUE, FALSE),
('doctor', 'appointments', TRUE, TRUE, TRUE, FALSE),
('doctor', 'claims', TRUE, TRUE, TRUE, FALSE),
('doctor', 'ehr', TRUE, TRUE, TRUE, FALSE),
('doctor', 'users', TRUE, FALSE, FALSE, FALSE),
('doctor', 'reports', TRUE, FALSE, FALSE, FALSE),
('doctor', 'settings', FALSE, FALSE, FALSE, FALSE)
ON CONFLICT (role, module) DO NOTHING;

-- Insert default permissions for staff role
INSERT INTO role_permissions (role, module, view_permission, create_permission, edit_permission, delete_permission) VALUES
('staff', 'patients', TRUE, TRUE, TRUE, FALSE),
('staff', 'appointments', TRUE, TRUE, TRUE, FALSE),
('staff', 'claims', TRUE, FALSE, FALSE, FALSE),
('staff', 'ehr', TRUE, FALSE, FALSE, FALSE),
('staff', 'users', FALSE, FALSE, FALSE, FALSE),
('staff', 'reports', TRUE, FALSE, FALSE, FALSE),
('staff', 'settings', FALSE, FALSE, FALSE, FALSE)
ON CONFLICT (role, module) DO NOTHING;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);
CREATE INDEX IF NOT EXISTS idx_role_permissions_module ON role_permissions(module);
