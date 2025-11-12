-- Add RBAC Permissions for Healthcare Offerings Management
-- Migration: 019_add_offering_permissions.sql

-- Insert new permissions for healthcare offerings management
-- Permissions follow the pattern: module.action (e.g., offerings.view)
INSERT INTO permissions (name, display_name, description, module, action) VALUES
-- Healthcare Offerings Permissions
('offerings.view', 'View Offerings', 'View healthcare offerings and services', 'offerings', 'view'),
('offerings.create', 'Create Offerings', 'Create new healthcare offerings', 'offerings', 'create'),
('offerings.edit', 'Edit Offerings', 'Edit existing healthcare offerings', 'offerings', 'edit'),
('offerings.delete', 'Delete Offerings', 'Delete healthcare offerings', 'offerings', 'delete'),
('offerings.manage_pricing', 'Manage Pricing', 'Manage offering pricing and discounts', 'offerings', 'manage_pricing'),

-- Package Permissions
('packages.view', 'View Packages', 'View healthcare packages', 'offerings', 'view'),
('packages.create', 'Create Packages', 'Create new healthcare packages', 'offerings', 'create'),
('packages.edit', 'Edit Packages', 'Edit existing healthcare packages', 'offerings', 'edit'),
('packages.delete', 'Delete Packages', 'Delete healthcare packages', 'offerings', 'delete'),

-- Enrollment Permissions
('enrollments.view', 'View Enrollments', 'View patient enrollments', 'offerings', 'view'),
('enrollments.create', 'Create Enrollments', 'Create patient enrollments', 'offerings', 'create'),
('enrollments.manage', 'Manage Enrollments', 'Manage patient enrollments and usage', 'offerings', 'manage'),

-- Promotion Permissions
('promotions.view', 'View Promotions', 'View promotions and discount codes', 'offerings', 'view'),
('promotions.create', 'Create Promotions', 'Create new promotions', 'offerings', 'create'),
('promotions.edit', 'Edit Promotions', 'Edit existing promotions', 'offerings', 'edit'),
('promotions.manage', 'Manage Promotions', 'Manage promotion usage and validation', 'offerings', 'manage'),

-- Review Permissions
('reviews.view', 'View Reviews', 'View offering reviews', 'offerings', 'view'),
('reviews.moderate', 'Moderate Reviews', 'Moderate and approve offering reviews', 'offerings', 'moderate'),

-- Category Permissions
('categories.manage', 'Manage Categories', 'Manage service categories', 'offerings', 'manage')
ON CONFLICT (name) DO NOTHING;

-- Assign offerings permissions to relevant roles

-- System Administrator - Full access to all offerings features
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'System Administrator'
  AND p.module = 'offerings'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Practice Manager - Full operational access to offerings
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Practice Manager'
  AND p.name IN (
    'offerings.view', 'offerings.create', 'offerings.edit', 'offerings.manage_pricing',
    'packages.view', 'packages.create', 'packages.edit',
    'enrollments.view', 'enrollments.create', 'enrollments.manage',
    'promotions.view', 'promotions.create', 'promotions.edit', 'promotions.manage',
    'reviews.view', 'reviews.moderate',
    'categories.manage'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Billing Manager - Access to pricing, enrollments, and promotions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Billing Manager'
  AND p.name IN (
    'offerings.view', 'offerings.manage_pricing',
    'packages.view',
    'enrollments.view', 'enrollments.create', 'enrollments.manage',
    'promotions.view', 'promotions.create', 'promotions.edit', 'promotions.manage'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Physician - View offerings, packages, and create enrollments
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Physician'
  AND p.name IN (
    'offerings.view',
    'packages.view',
    'enrollments.view', 'enrollments.create',
    'reviews.view'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Nurse - View offerings and packages, limited enrollment access
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Nurse'
  AND p.name IN (
    'offerings.view',
    'packages.view',
    'enrollments.view'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Receptionist - View offerings, create enrollments, view promotions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Receptionist'
  AND p.name IN (
    'offerings.view',
    'packages.view',
    'enrollments.view', 'enrollments.create',
    'promotions.view', 'promotions.manage'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Medical Assistant - View offerings and packages
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Medical Assistant'
  AND p.name IN (
    'offerings.view',
    'packages.view',
    'enrollments.view'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Insurance Coordinator - View all, manage enrollments
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Insurance Coordinator'
  AND p.name IN (
    'offerings.view',
    'packages.view',
    'enrollments.view', 'enrollments.create', 'enrollments.manage',
    'promotions.view'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

COMMENT ON TABLE permissions IS 'RBAC permissions including offerings management permissions';
