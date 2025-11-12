-- Add RBAC Permissions for Healthcare Offerings Management
-- Migration: 019_add_offering_permissions.sql

-- Insert new permissions for healthcare offerings management
INSERT INTO permissions (name, description, category, is_system) VALUES
-- Healthcare Offerings Permissions
('offerings.view', 'View healthcare offerings and services', 'offerings', true),
('offerings.create', 'Create new healthcare offerings', 'offerings', true),
('offerings.edit', 'Edit existing healthcare offerings', 'offerings', true),
('offerings.delete', 'Delete healthcare offerings', 'offerings', true),
('offerings.manage_pricing', 'Manage offering pricing and discounts', 'offerings', true),

-- Package Permissions
('packages.view', 'View healthcare packages', 'offerings', true),
('packages.create', 'Create new healthcare packages', 'offerings', true),
('packages.edit', 'Edit existing healthcare packages', 'offerings', true),
('packages.delete', 'Delete healthcare packages', 'offerings', true),

-- Enrollment Permissions
('enrollments.view', 'View patient enrollments', 'offerings', true),
('enrollments.create', 'Create patient enrollments', 'offerings', true),
('enrollments.manage', 'Manage patient enrollments and usage', 'offerings', true),

-- Promotion Permissions
('promotions.view', 'View promotions and discount codes', 'offerings', true),
('promotions.create', 'Create new promotions', 'offerings', true),
('promotions.edit', 'Edit existing promotions', 'offerings', true),
('promotions.manage', 'Manage promotion usage and validation', 'offerings', true),

-- Review Permissions
('reviews.view', 'View offering reviews', 'offerings', true),
('reviews.moderate', 'Moderate and approve offering reviews', 'offerings', true),

-- Category Permissions
('categories.manage', 'Manage service categories', 'offerings', true)
ON CONFLICT (name) DO NOTHING;

-- Assign offerings permissions to relevant roles

-- System Administrator - Full access to all offerings features
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'System Administrator'
  AND p.category = 'offerings'
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
