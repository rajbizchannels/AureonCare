-- =============================================================================
-- AUREONCARE MULTI-TENANT MIGRATION - ADD TENANT COLUMNS
-- Version: 1.0.0
-- Description: Adds tenant_id column to existing tables for multi-tenant support
-- =============================================================================

-- This migration adds tenant_id to all existing tables that need tenant isolation

-- =============================================================================
-- STEP 1: Add tenant_id column to existing tables
-- =============================================================================

-- Users table (main users remain global, tenant_users handles tenant association)
-- No change needed - users are managed through tenant_users junction table

-- Patients table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'patients' AND column_name = 'tenant_id') THEN
        ALTER TABLE patients ADD COLUMN tenant_id UUID REFERENCES tenants(id);
        CREATE INDEX idx_patients_tenant ON patients(tenant_id);
    END IF;
END $$;

-- Providers table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'providers' AND column_name = 'tenant_id') THEN
        ALTER TABLE providers ADD COLUMN tenant_id UUID REFERENCES tenants(id);
        CREATE INDEX idx_providers_tenant ON providers(tenant_id);
    END IF;
END $$;

-- Appointments table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'appointments' AND column_name = 'tenant_id') THEN
        ALTER TABLE appointments ADD COLUMN tenant_id UUID REFERENCES tenants(id);
        CREATE INDEX idx_appointments_tenant ON appointments(tenant_id);
    END IF;
END $$;

-- Prescriptions table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'prescriptions' AND column_name = 'tenant_id') THEN
        ALTER TABLE prescriptions ADD COLUMN tenant_id UUID REFERENCES tenants(id);
        CREATE INDEX idx_prescriptions_tenant ON prescriptions(tenant_id);
    END IF;
END $$;

-- Diagnosis table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'diagnosis' AND column_name = 'tenant_id') THEN
        ALTER TABLE diagnosis ADD COLUMN tenant_id UUID REFERENCES tenants(id);
        CREATE INDEX idx_diagnosis_tenant ON diagnosis(tenant_id);
    END IF;
END $$;

-- Medical Records table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'medical_records' AND column_name = 'tenant_id') THEN
        ALTER TABLE medical_records ADD COLUMN tenant_id UUID REFERENCES tenants(id);
        CREATE INDEX idx_medical_records_tenant ON medical_records(tenant_id);
    END IF;
END $$;

-- Claims table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'claims' AND column_name = 'tenant_id') THEN
        ALTER TABLE claims ADD COLUMN tenant_id UUID REFERENCES tenants(id);
        CREATE INDEX idx_claims_tenant ON claims(tenant_id);
    END IF;
END $$;

-- Payments table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'payments' AND column_name = 'tenant_id') THEN
        ALTER TABLE payments ADD COLUMN tenant_id UUID REFERENCES tenants(id);
        CREATE INDEX idx_payments_tenant ON payments(tenant_id);
    END IF;
END $$;

-- Payment Postings table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'payment_postings' AND column_name = 'tenant_id') THEN
        ALTER TABLE payment_postings ADD COLUMN tenant_id UUID REFERENCES tenants(id);
        CREATE INDEX idx_payment_postings_tenant ON payment_postings(tenant_id);
    END IF;
END $$;

-- Denials table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'denials' AND column_name = 'tenant_id') THEN
        ALTER TABLE denials ADD COLUMN tenant_id UUID REFERENCES tenants(id);
        CREATE INDEX idx_denials_tenant ON denials(tenant_id);
    END IF;
END $$;

-- Lab Orders table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'lab_orders' AND column_name = 'tenant_id') THEN
        ALTER TABLE lab_orders ADD COLUMN tenant_id UUID REFERENCES tenants(id);
        CREATE INDEX idx_lab_orders_tenant ON lab_orders(tenant_id);
    END IF;
END $$;

-- Telehealth Sessions table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'telehealth_sessions' AND column_name = 'tenant_id') THEN
        ALTER TABLE telehealth_sessions ADD COLUMN tenant_id UUID REFERENCES tenants(id);
        CREATE INDEX idx_telehealth_sessions_tenant ON telehealth_sessions(tenant_id);
    END IF;
END $$;

-- Healthcare Offerings table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'healthcare_offerings' AND column_name = 'tenant_id') THEN
        ALTER TABLE healthcare_offerings ADD COLUMN tenant_id UUID REFERENCES tenants(id);
        CREATE INDEX idx_healthcare_offerings_tenant ON healthcare_offerings(tenant_id);
    END IF;
END $$;

-- Patient Offering Enrollments table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'patient_offering_enrollments' AND column_name = 'tenant_id') THEN
        ALTER TABLE patient_offering_enrollments ADD COLUMN tenant_id UUID REFERENCES tenants(id);
        CREATE INDEX idx_patient_offering_enrollments_tenant ON patient_offering_enrollments(tenant_id);
    END IF;
END $$;

-- Tasks table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'tasks' AND column_name = 'tenant_id') THEN
        ALTER TABLE tasks ADD COLUMN tenant_id UUID REFERENCES tenants(id);
        CREATE INDEX idx_tasks_tenant ON tasks(tenant_id);
    END IF;
END $$;

-- Notifications table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'notifications' AND column_name = 'tenant_id') THEN
        ALTER TABLE notifications ADD COLUMN tenant_id UUID REFERENCES tenants(id);
        CREATE INDEX idx_notifications_tenant ON notifications(tenant_id);
    END IF;
END $$;

-- Campaigns table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'campaigns' AND column_name = 'tenant_id') THEN
        ALTER TABLE campaigns ADD COLUMN tenant_id UUID REFERENCES tenants(id);
        CREATE INDEX idx_campaigns_tenant ON campaigns(tenant_id);
    END IF;
END $$;

-- Audit Logs table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'audit_logs' AND column_name = 'tenant_id') THEN
        ALTER TABLE audit_logs ADD COLUMN tenant_id UUID REFERENCES tenants(id);
        CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id);
    END IF;
END $$;

-- Insurance Payers table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'insurance_payers' AND column_name = 'tenant_id') THEN
        ALTER TABLE insurance_payers ADD COLUMN tenant_id UUID REFERENCES tenants(id);
        CREATE INDEX idx_insurance_payers_tenant ON insurance_payers(tenant_id);
    END IF;
END $$;

-- Appointment Types table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'appointment_types' AND column_name = 'tenant_id') THEN
        ALTER TABLE appointment_types ADD COLUMN tenant_id UUID REFERENCES tenants(id);
        CREATE INDEX idx_appointment_types_tenant ON appointment_types(tenant_id);
    END IF;
END $$;

-- Waitlist table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'waitlist' AND column_name = 'tenant_id') THEN
        ALTER TABLE waitlist ADD COLUMN tenant_id UUID REFERENCES tenants(id);
        CREATE INDEX idx_waitlist_tenant ON waitlist(tenant_id);
    END IF;
END $$;

-- Documents table (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'documents') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name = 'documents' AND column_name = 'tenant_id') THEN
            ALTER TABLE documents ADD COLUMN tenant_id UUID REFERENCES tenants(id);
            CREATE INDEX idx_documents_tenant ON documents(tenant_id);
        END IF;
    END IF;
END $$;

-- =============================================================================
-- STEP 2: Create default tenant for existing data migration
-- =============================================================================

-- Create a default tenant for existing data
INSERT INTO tenants (
    id,
    tenant_code,
    name,
    legal_name,
    primary_email,
    status,
    isolation_level,
    max_users,
    max_patients,
    max_providers,
    max_storage_gb,
    features,
    activated_at
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'default',
    'Default Organization',
    'Default Organization',
    'admin@aureoncare.com',
    'active',
    'shared_schema',
    -1,  -- Unlimited
    -1,  -- Unlimited
    -1,  -- Unlimited
    -1,  -- Unlimited
    '{
        "telehealth": true,
        "erx": true,
        "fhir": true,
        "patient_portal": true,
        "crm": true,
        "edi_835": true,
        "edi_837": true,
        "lab_integration": true,
        "imaging_integration": true,
        "custom_forms": true,
        "api_access": true,
        "sso": true,
        "advanced_analytics": true,
        "white_label": true
    }'::jsonb,
    NOW()
) ON CONFLICT (tenant_code) DO NOTHING;

-- Create default subscription for the default tenant
INSERT INTO tenant_subscription_plans (
    id,
    code,
    name,
    display_name,
    description,
    price_monthly,
    price_yearly,
    included_users,
    max_users,
    included_patients,
    max_patients,
    included_providers,
    max_providers,
    tier,
    is_active,
    features
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'unlimited',
    'Unlimited',
    'Unlimited Plan',
    'Full access plan for existing installations',
    0,
    0,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    5,
    false,  -- Not publicly available
    '{
        "telehealth": true,
        "erx": true,
        "fhir": true,
        "patient_portal": true,
        "crm": true,
        "edi_835": true,
        "edi_837": true,
        "api_access": true,
        "sso": true,
        "advanced_analytics": true,
        "white_label": true,
        "priority_support": true,
        "dedicated_support": true
    }'::jsonb
) ON CONFLICT (code) DO NOTHING;

-- Create subscription for default tenant
INSERT INTO tenant_subscriptions (
    tenant_id,
    plan_id,
    status,
    billing_cycle,
    base_price,
    start_date
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'active',
    'yearly',
    0,
    CURRENT_DATE
) ON CONFLICT (tenant_id) DO NOTHING;

-- =============================================================================
-- STEP 3: Migrate existing data to default tenant
-- =============================================================================

-- Update patients
UPDATE patients SET tenant_id = '00000000-0000-0000-0000-000000000001'
WHERE tenant_id IS NULL;

-- Update providers
UPDATE providers SET tenant_id = '00000000-0000-0000-0000-000000000001'
WHERE tenant_id IS NULL;

-- Update appointments
UPDATE appointments SET tenant_id = '00000000-0000-0000-0000-000000000001'
WHERE tenant_id IS NULL;

-- Update prescriptions
UPDATE prescriptions SET tenant_id = '00000000-0000-0000-0000-000000000001'
WHERE tenant_id IS NULL;

-- Update diagnosis
UPDATE diagnosis SET tenant_id = '00000000-0000-0000-0000-000000000001'
WHERE tenant_id IS NULL;

-- Update medical_records
UPDATE medical_records SET tenant_id = '00000000-0000-0000-0000-000000000001'
WHERE tenant_id IS NULL;

-- Update claims
UPDATE claims SET tenant_id = '00000000-0000-0000-0000-000000000001'
WHERE tenant_id IS NULL;

-- Update payments
UPDATE payments SET tenant_id = '00000000-0000-0000-0000-000000000001'
WHERE tenant_id IS NULL;

-- Update payment_postings (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payment_postings') THEN
        EXECUTE 'UPDATE payment_postings SET tenant_id = ''00000000-0000-0000-0000-000000000001'' WHERE tenant_id IS NULL';
    END IF;
END $$;

-- Update denials (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'denials') THEN
        EXECUTE 'UPDATE denials SET tenant_id = ''00000000-0000-0000-0000-000000000001'' WHERE tenant_id IS NULL';
    END IF;
END $$;

-- Update lab_orders (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lab_orders') THEN
        EXECUTE 'UPDATE lab_orders SET tenant_id = ''00000000-0000-0000-0000-000000000001'' WHERE tenant_id IS NULL';
    END IF;
END $$;

-- Update telehealth_sessions (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'telehealth_sessions') THEN
        EXECUTE 'UPDATE telehealth_sessions SET tenant_id = ''00000000-0000-0000-0000-000000000001'' WHERE tenant_id IS NULL';
    END IF;
END $$;

-- Update healthcare_offerings (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'healthcare_offerings') THEN
        EXECUTE 'UPDATE healthcare_offerings SET tenant_id = ''00000000-0000-0000-0000-000000000001'' WHERE tenant_id IS NULL';
    END IF;
END $$;

-- Update tasks (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tasks') THEN
        EXECUTE 'UPDATE tasks SET tenant_id = ''00000000-0000-0000-0000-000000000001'' WHERE tenant_id IS NULL';
    END IF;
END $$;

-- Update notifications (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
        EXECUTE 'UPDATE notifications SET tenant_id = ''00000000-0000-0000-0000-000000000001'' WHERE tenant_id IS NULL';
    END IF;
END $$;

-- Update campaigns (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaigns') THEN
        EXECUTE 'UPDATE campaigns SET tenant_id = ''00000000-0000-0000-0000-000000000001'' WHERE tenant_id IS NULL';
    END IF;
END $$;

-- Update audit_logs (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
        EXECUTE 'UPDATE audit_logs SET tenant_id = ''00000000-0000-0000-0000-000000000001'' WHERE tenant_id IS NULL';
    END IF;
END $$;

-- Update insurance_payers (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'insurance_payers') THEN
        EXECUTE 'UPDATE insurance_payers SET tenant_id = ''00000000-0000-0000-0000-000000000001'' WHERE tenant_id IS NULL';
    END IF;
END $$;

-- =============================================================================
-- STEP 4: Add existing users to default tenant
-- =============================================================================

-- Add all existing users to the default tenant
INSERT INTO tenant_users (tenant_id, user_id, is_tenant_admin, status)
SELECT
    '00000000-0000-0000-0000-000000000001',
    id,
    CASE WHEN role = 'admin' THEN true ELSE false END,
    'active'
FROM users
WHERE id NOT IN (
    SELECT user_id FROM tenant_users
    WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
)
ON CONFLICT (tenant_id, user_id) DO NOTHING;

-- =============================================================================
-- STEP 5: Initialize default roles for the default tenant
-- =============================================================================

INSERT INTO tenant_roles (tenant_id, code, name, description, permissions, is_system_role)
SELECT
    '00000000-0000-0000-0000-000000000001',
    code,
    name,
    description,
    permissions,
    is_system_role
FROM tenant_role_templates
WHERE is_default = true
ON CONFLICT (tenant_id, code) DO NOTHING;

-- =============================================================================
-- STEP 6: Create first platform administrator
-- =============================================================================

-- Create default admin (password: Admin123!)
INSERT INTO tenant_administrators (
    email,
    password_hash,
    first_name,
    last_name,
    role,
    status
) VALUES (
    'admin@aureoncare.com',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyNiAYMyzJ/Iie',  -- Admin123!
    'Platform',
    'Administrator',
    'super_admin',
    'active'
) ON CONFLICT (email) DO NOTHING;

-- =============================================================================
-- COMPLETE
-- =============================================================================

SELECT 'Multi-tenant migration completed successfully' as status;
