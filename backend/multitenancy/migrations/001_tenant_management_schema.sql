-- =============================================================================
-- AUREONCARE MULTI-TENANT MANAGEMENT SCHEMA
-- Version: 1.0.0
-- Description: Complete tenant management database schema with isolation,
--              security, compliance, billing, and governance features
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- SECTION 1: TENANT REGISTRY AND CORE TABLES
-- =============================================================================

-- Tenant Status Enum
CREATE TYPE tenant_status AS ENUM (
    'pending_approval',
    'provisioning',
    'active',
    'suspended',
    'deactivated',
    'terminated'
);

-- Tenant Isolation Level
CREATE TYPE isolation_level AS ENUM (
    'shared_schema',      -- Row-level isolation with tenant_id
    'separate_schema',    -- Separate PostgreSQL schema per tenant
    'separate_database'   -- Separate database per tenant (highest isolation)
);

-- =============================================================================
-- TENANTS - Master tenant registry
-- =============================================================================
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Basic Information
    tenant_code VARCHAR(50) UNIQUE NOT NULL,  -- Short identifier (e.g., 'acme-clinic')
    name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255),
    description TEXT,

    -- Contact Information
    primary_email VARCHAR(255) NOT NULL,
    primary_phone VARCHAR(50),
    website VARCHAR(255),

    -- Address
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'USA',

    -- Business Information
    tax_id VARCHAR(50),
    business_type VARCHAR(100),  -- clinic, hospital, practice_group, etc.
    npi_number VARCHAR(20),       -- National Provider Identifier

    -- Technical Configuration
    status tenant_status DEFAULT 'pending_approval',
    isolation_level isolation_level DEFAULT 'shared_schema',
    database_name VARCHAR(100),   -- For separate_database isolation
    schema_name VARCHAR(100),     -- For separate_schema isolation

    -- Feature Flags & Limits
    max_users INTEGER DEFAULT 10,
    max_patients INTEGER DEFAULT 1000,
    max_providers INTEGER DEFAULT 5,
    max_storage_gb INTEGER DEFAULT 10,

    -- Branding & Customization
    branding JSONB DEFAULT '{
        "logo_url": null,
        "favicon_url": null,
        "primary_color": "#3B82F6",
        "secondary_color": "#1E40AF",
        "accent_color": "#10B981",
        "font_family": "Inter"
    }'::jsonb,

    -- Custom Domain
    custom_domain VARCHAR(255),
    subdomain VARCHAR(100) UNIQUE,

    -- Security Settings
    security_settings JSONB DEFAULT '{
        "mfa_required": false,
        "mfa_methods": ["totp", "sms"],
        "password_policy": {
            "min_length": 8,
            "require_uppercase": true,
            "require_lowercase": true,
            "require_numbers": true,
            "require_special": true,
            "max_age_days": 90,
            "history_count": 5
        },
        "session_timeout_minutes": 60,
        "max_failed_attempts": 5,
        "lockout_duration_minutes": 30,
        "ip_whitelist": [],
        "allowed_oauth_providers": ["google", "microsoft"]
    }'::jsonb,

    -- Compliance Settings
    compliance_settings JSONB DEFAULT '{
        "hipaa_enabled": true,
        "hipaa_baa_signed": false,
        "hipaa_baa_date": null,
        "data_retention_days": 2555,
        "audit_retention_days": 2555,
        "encryption_at_rest": true,
        "encryption_in_transit": true,
        "phi_access_logging": true,
        "require_consent_forms": true
    }'::jsonb,

    -- Feature Configuration
    features JSONB DEFAULT '{
        "telehealth": true,
        "erx": true,
        "fhir": true,
        "patient_portal": true,
        "crm": true,
        "edi_835": true,
        "edi_837": true,
        "lab_integration": false,
        "imaging_integration": false,
        "custom_forms": true,
        "api_access": false,
        "sso": false,
        "advanced_analytics": false,
        "white_label": false
    }'::jsonb,

    -- Localization
    default_timezone VARCHAR(100) DEFAULT 'America/New_York',
    default_language VARCHAR(10) DEFAULT 'en',
    supported_languages TEXT[] DEFAULT ARRAY['en'],
    date_format VARCHAR(50) DEFAULT 'MM/DD/YYYY',
    time_format VARCHAR(20) DEFAULT '12h',
    currency VARCHAR(10) DEFAULT 'USD',

    -- Metadata
    metadata JSONB DEFAULT '{}',

    -- Audit Fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,
    activated_at TIMESTAMP WITH TIME ZONE,
    suspended_at TIMESTAMP WITH TIME ZONE,
    terminated_at TIMESTAMP WITH TIME ZONE,

    -- Soft Delete
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID
);

-- Indexes for tenants
CREATE INDEX idx_tenants_status ON tenants(status);
CREATE INDEX idx_tenants_tenant_code ON tenants(tenant_code);
CREATE INDEX idx_tenants_subdomain ON tenants(subdomain);
CREATE INDEX idx_tenants_created_at ON tenants(created_at);

-- =============================================================================
-- TENANT ADMINISTRATORS - Super admins who manage tenants from central console
-- =============================================================================
CREATE TABLE IF NOT EXISTS tenant_administrators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Basic Info
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(50),

    -- Role & Permissions
    role VARCHAR(50) DEFAULT 'admin',  -- super_admin, admin, support, readonly
    permissions JSONB DEFAULT '[]'::jsonb,

    -- MFA
    mfa_enabled BOOLEAN DEFAULT false,
    mfa_secret VARCHAR(255),
    mfa_recovery_codes TEXT[],

    -- Status
    status VARCHAR(20) DEFAULT 'active',
    last_login_at TIMESTAMP WITH TIME ZONE,
    last_login_ip VARCHAR(50),
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,

    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    password_changed_at TIMESTAMP WITH TIME ZONE
);

-- =============================================================================
-- TENANT USERS - Maps system users to tenants with tenant-specific roles
-- =============================================================================
CREATE TABLE IF NOT EXISTS tenant_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,  -- References users table in tenant schema

    -- Tenant-specific user settings
    is_tenant_admin BOOLEAN DEFAULT false,
    tenant_roles JSONB DEFAULT '[]'::jsonb,  -- Tenant-specific role overrides

    -- Access Control
    status VARCHAR(20) DEFAULT 'active',
    access_level VARCHAR(50) DEFAULT 'standard',  -- standard, restricted, elevated
    ip_restrictions JSONB DEFAULT '[]'::jsonb,

    -- Session Management
    max_concurrent_sessions INTEGER DEFAULT 3,
    session_timeout_override INTEGER,  -- Minutes, null = use tenant default

    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_access_at TIMESTAMP WITH TIME ZONE,
    invited_by UUID,
    invitation_accepted_at TIMESTAMP WITH TIME ZONE,

    UNIQUE(tenant_id, user_id)
);

CREATE INDEX idx_tenant_users_tenant ON tenant_users(tenant_id);
CREATE INDEX idx_tenant_users_user ON tenant_users(user_id);

-- =============================================================================
-- SECTION 2: BILLING AND SUBSCRIPTION MANAGEMENT
-- =============================================================================

-- Subscription Plans - Available plans for tenants
CREATE TABLE IF NOT EXISTS tenant_subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Plan Identity
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Pricing
    price_monthly DECIMAL(10, 2) NOT NULL DEFAULT 0,
    price_yearly DECIMAL(10, 2),
    price_per_user_monthly DECIMAL(10, 2) DEFAULT 0,
    price_per_patient_monthly DECIMAL(10, 4) DEFAULT 0,
    setup_fee DECIMAL(10, 2) DEFAULT 0,

    -- Plan Limits
    included_users INTEGER DEFAULT 5,
    max_users INTEGER DEFAULT 10,
    included_patients INTEGER DEFAULT 500,
    max_patients INTEGER DEFAULT 1000,
    included_providers INTEGER DEFAULT 2,
    max_providers INTEGER DEFAULT 5,
    included_storage_gb INTEGER DEFAULT 5,
    max_storage_gb INTEGER DEFAULT 10,
    api_calls_per_month INTEGER DEFAULT 10000,

    -- Features Included
    features JSONB DEFAULT '{
        "telehealth": true,
        "erx": false,
        "fhir": false,
        "patient_portal": true,
        "crm": false,
        "edi_835": false,
        "edi_837": false,
        "lab_integration": false,
        "imaging_integration": false,
        "custom_forms": false,
        "api_access": false,
        "sso": false,
        "advanced_analytics": false,
        "white_label": false,
        "priority_support": false,
        "dedicated_support": false,
        "custom_integrations": false,
        "data_export": true,
        "audit_logs": true,
        "backup_frequency": "daily"
    }'::jsonb,

    -- Plan Metadata
    tier INTEGER DEFAULT 1,  -- 1=Free, 2=Starter, 3=Professional, 4=Enterprise, 5=Custom
    is_public BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    trial_days INTEGER DEFAULT 14,

    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tenant Subscriptions - Active subscriptions for tenants
CREATE TABLE IF NOT EXISTS tenant_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES tenant_subscription_plans(id),

    -- Subscription Details
    status VARCHAR(50) DEFAULT 'active',  -- trial, active, past_due, canceled, expired
    billing_cycle VARCHAR(20) DEFAULT 'monthly',  -- monthly, yearly

    -- Dates
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    trial_start_date DATE,
    trial_end_date DATE,
    canceled_at TIMESTAMP WITH TIME ZONE,
    cancellation_reason TEXT,

    -- Pricing (Snapshot at time of subscription)
    base_price DECIMAL(10, 2) NOT NULL,
    per_user_price DECIMAL(10, 2) DEFAULT 0,
    per_patient_price DECIMAL(10, 4) DEFAULT 0,
    discount_percent DECIMAL(5, 2) DEFAULT 0,
    discount_amount DECIMAL(10, 2) DEFAULT 0,

    -- Current Usage
    current_users INTEGER DEFAULT 0,
    current_patients INTEGER DEFAULT 0,
    current_providers INTEGER DEFAULT 0,
    current_storage_gb DECIMAL(10, 2) DEFAULT 0,

    -- Billing
    next_billing_date DATE,
    last_billing_date DATE,
    payment_method_id UUID,
    auto_renew BOOLEAN DEFAULT true,

    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(tenant_id)  -- One active subscription per tenant
);

CREATE INDEX idx_tenant_subscriptions_tenant ON tenant_subscriptions(tenant_id);
CREATE INDEX idx_tenant_subscriptions_status ON tenant_subscriptions(status);

-- Tenant Invoices - Billing invoices for tenants
CREATE TABLE IF NOT EXISTS tenant_invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES tenant_subscriptions(id),

    -- Invoice Details
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'draft',  -- draft, sent, paid, overdue, void, refunded

    -- Dates
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    paid_date DATE,

    -- Period
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,

    -- Amounts
    subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0,
    tax_rate DECIMAL(5, 2) DEFAULT 0,
    tax_amount DECIMAL(10, 2) DEFAULT 0,
    discount_amount DECIMAL(10, 2) DEFAULT 0,
    total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    amount_paid DECIMAL(10, 2) DEFAULT 0,
    amount_due DECIMAL(10, 2) NOT NULL DEFAULT 0,

    -- Currency
    currency VARCHAR(10) DEFAULT 'USD',

    -- Line Items (stored as JSONB for flexibility)
    line_items JSONB DEFAULT '[]'::jsonb,

    -- Notes
    notes TEXT,
    internal_notes TEXT,

    -- Payment
    payment_method VARCHAR(50),
    payment_reference VARCHAR(255),

    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_tenant_invoices_tenant ON tenant_invoices(tenant_id);
CREATE INDEX idx_tenant_invoices_status ON tenant_invoices(status);
CREATE INDEX idx_tenant_invoices_date ON tenant_invoices(invoice_date);

-- Payment Methods - Stored payment methods for tenants
CREATE TABLE IF NOT EXISTS tenant_payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Payment Method Type
    type VARCHAR(50) NOT NULL,  -- credit_card, bank_account, ach
    provider VARCHAR(50) NOT NULL,  -- stripe, paypal, etc.
    provider_payment_method_id VARCHAR(255),  -- External provider ID

    -- Card Details (tokenized/masked)
    card_brand VARCHAR(50),
    card_last_four VARCHAR(4),
    card_exp_month INTEGER,
    card_exp_year INTEGER,

    -- Bank Details (tokenized/masked)
    bank_name VARCHAR(100),
    bank_last_four VARCHAR(4),
    account_type VARCHAR(20),  -- checking, savings

    -- Billing Address
    billing_name VARCHAR(255),
    billing_address JSONB,

    -- Status
    is_default BOOLEAN DEFAULT false,
    is_verified BOOLEAN DEFAULT false,
    status VARCHAR(20) DEFAULT 'active',

    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tenant_payment_methods_tenant ON tenant_payment_methods(tenant_id);

-- Usage Tracking - Track resource usage per tenant
CREATE TABLE IF NOT EXISTS tenant_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Period
    usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
    usage_month VARCHAR(7) NOT NULL,  -- YYYY-MM format

    -- Resource Counts
    active_users INTEGER DEFAULT 0,
    active_patients INTEGER DEFAULT 0,
    active_providers INTEGER DEFAULT 0,

    -- Storage
    storage_used_bytes BIGINT DEFAULT 0,
    documents_count INTEGER DEFAULT 0,

    -- API Usage
    api_calls INTEGER DEFAULT 0,
    api_calls_by_endpoint JSONB DEFAULT '{}',

    -- Feature Usage
    appointments_created INTEGER DEFAULT 0,
    claims_submitted INTEGER DEFAULT 0,
    prescriptions_sent INTEGER DEFAULT 0,
    telehealth_minutes INTEGER DEFAULT 0,

    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(tenant_id, usage_date)
);

CREATE INDEX idx_tenant_usage_tenant ON tenant_usage(tenant_id);
CREATE INDEX idx_tenant_usage_date ON tenant_usage(usage_date);
CREATE INDEX idx_tenant_usage_month ON tenant_usage(usage_month);

-- =============================================================================
-- SECTION 3: AUDIT AND COMPLIANCE
-- =============================================================================

-- Audit Log Types
CREATE TYPE audit_action_type AS ENUM (
    'create', 'read', 'update', 'delete', 'login', 'logout', 'export',
    'import', 'approve', 'reject', 'suspend', 'activate', 'configure'
);

CREATE TYPE audit_severity AS ENUM (
    'low', 'medium', 'high', 'critical'
);

-- Tenant Audit Logs - Comprehensive audit trail
CREATE TABLE IF NOT EXISTS tenant_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,

    -- Who
    user_id UUID,
    user_email VARCHAR(255),
    user_role VARCHAR(100),
    ip_address VARCHAR(50),
    user_agent TEXT,

    -- What
    action audit_action_type NOT NULL,
    resource_type VARCHAR(100) NOT NULL,  -- tenant, user, patient, claim, etc.
    resource_id VARCHAR(255),

    -- Details
    description TEXT,
    old_values JSONB,
    new_values JSONB,
    metadata JSONB DEFAULT '{}',

    -- Classification
    severity audit_severity DEFAULT 'low',
    is_phi_access BOOLEAN DEFAULT false,  -- Protected Health Information access
    is_security_event BOOLEAN DEFAULT false,

    -- Request Context
    request_id VARCHAR(100),
    session_id VARCHAR(255),
    endpoint VARCHAR(500),
    http_method VARCHAR(10),

    -- Timestamp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Compliance
    compliance_flags JSONB DEFAULT '{}',  -- HIPAA, etc.
    retention_until DATE  -- For compliance retention periods
);

-- Partitioning by month for better performance
CREATE INDEX idx_tenant_audit_logs_tenant ON tenant_audit_logs(tenant_id);
CREATE INDEX idx_tenant_audit_logs_user ON tenant_audit_logs(user_id);
CREATE INDEX idx_tenant_audit_logs_action ON tenant_audit_logs(action);
CREATE INDEX idx_tenant_audit_logs_resource ON tenant_audit_logs(resource_type, resource_id);
CREATE INDEX idx_tenant_audit_logs_created ON tenant_audit_logs(created_at);
CREATE INDEX idx_tenant_audit_logs_phi ON tenant_audit_logs(is_phi_access) WHERE is_phi_access = true;
CREATE INDEX idx_tenant_audit_logs_security ON tenant_audit_logs(is_security_event) WHERE is_security_event = true;

-- Security Events Log - High-priority security events
CREATE TABLE IF NOT EXISTS tenant_security_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,

    -- Event Type
    event_type VARCHAR(100) NOT NULL,  -- failed_login, suspicious_activity, data_export, etc.
    severity audit_severity NOT NULL,

    -- Actor
    user_id UUID,
    user_email VARCHAR(255),
    ip_address VARCHAR(50),
    geo_location JSONB,  -- Country, city, etc.

    -- Details
    description TEXT NOT NULL,
    details JSONB DEFAULT '{}',

    -- Response
    auto_response_taken BOOLEAN DEFAULT false,
    auto_response_details TEXT,
    manually_reviewed BOOLEAN DEFAULT false,
    reviewed_by UUID,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    resolution_notes TEXT,

    -- Status
    status VARCHAR(50) DEFAULT 'open',  -- open, investigating, resolved, false_positive

    -- Timestamp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tenant_security_events_tenant ON tenant_security_events(tenant_id);
CREATE INDEX idx_tenant_security_events_type ON tenant_security_events(event_type);
CREATE INDEX idx_tenant_security_events_severity ON tenant_security_events(severity);
CREATE INDEX idx_tenant_security_events_status ON tenant_security_events(status);

-- Compliance Reports - Generated compliance reports
CREATE TABLE IF NOT EXISTS tenant_compliance_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Report Details
    report_type VARCHAR(100) NOT NULL,  -- hipaa_audit, access_report, phi_disclosure
    report_name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Period
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,

    -- Status
    status VARCHAR(50) DEFAULT 'generating',  -- generating, completed, failed

    -- Content
    report_data JSONB,
    file_path VARCHAR(500),
    file_size_bytes BIGINT,

    -- Generation
    generated_by UUID,
    generated_at TIMESTAMP WITH TIME ZONE,
    generation_duration_seconds INTEGER,

    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_tenant_compliance_reports_tenant ON tenant_compliance_reports(tenant_id);
CREATE INDEX idx_tenant_compliance_reports_type ON tenant_compliance_reports(report_type);

-- =============================================================================
-- SECTION 4: TENANT CONFIGURATION AND CUSTOMIZATION
-- =============================================================================

-- Tenant Settings - Key-value configuration store
CREATE TABLE IF NOT EXISTS tenant_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Setting Identity
    category VARCHAR(100) NOT NULL,  -- general, security, notifications, integrations
    key VARCHAR(255) NOT NULL,

    -- Value
    value JSONB NOT NULL,
    value_type VARCHAR(50) DEFAULT 'string',  -- string, number, boolean, json, array

    -- Metadata
    display_name VARCHAR(255),
    description TEXT,
    is_sensitive BOOLEAN DEFAULT false,
    is_user_configurable BOOLEAN DEFAULT true,

    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID,

    UNIQUE(tenant_id, category, key)
);

CREATE INDEX idx_tenant_settings_tenant ON tenant_settings(tenant_id);
CREATE INDEX idx_tenant_settings_category ON tenant_settings(tenant_id, category);

-- Tenant Custom Fields - Allow tenants to define custom fields
CREATE TABLE IF NOT EXISTS tenant_custom_fields (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Field Definition
    entity_type VARCHAR(100) NOT NULL,  -- patient, appointment, claim, etc.
    field_name VARCHAR(100) NOT NULL,
    field_label VARCHAR(255) NOT NULL,
    field_type VARCHAR(50) NOT NULL,  -- text, number, date, select, multiselect, checkbox

    -- Validation
    is_required BOOLEAN DEFAULT false,
    validation_rules JSONB DEFAULT '{}',
    options JSONB DEFAULT '[]',  -- For select/multiselect types
    default_value JSONB,

    -- Display
    display_order INTEGER DEFAULT 0,
    show_in_list BOOLEAN DEFAULT false,
    show_in_detail BOOLEAN DEFAULT true,
    section VARCHAR(100),  -- Group fields into sections

    -- Status
    is_active BOOLEAN DEFAULT true,

    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,

    UNIQUE(tenant_id, entity_type, field_name)
);

CREATE INDEX idx_tenant_custom_fields_tenant ON tenant_custom_fields(tenant_id);
CREATE INDEX idx_tenant_custom_fields_entity ON tenant_custom_fields(tenant_id, entity_type);

-- Tenant Email Templates - Customizable email templates
CREATE TABLE IF NOT EXISTS tenant_email_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Template Identity
    template_code VARCHAR(100) NOT NULL,  -- appointment_reminder, password_reset, etc.
    language VARCHAR(10) DEFAULT 'en',

    -- Content
    subject VARCHAR(500) NOT NULL,
    body_html TEXT NOT NULL,
    body_text TEXT,

    -- Variables Available
    available_variables JSONB DEFAULT '[]',

    -- Status
    is_active BOOLEAN DEFAULT true,

    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID,

    UNIQUE(tenant_id, template_code, language)
);

CREATE INDEX idx_tenant_email_templates_tenant ON tenant_email_templates(tenant_id);

-- Tenant Workflows - Custom workflow definitions
CREATE TABLE IF NOT EXISTS tenant_workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Workflow Definition
    name VARCHAR(255) NOT NULL,
    description TEXT,
    trigger_type VARCHAR(100) NOT NULL,  -- event, schedule, manual
    trigger_event VARCHAR(255),  -- patient_created, appointment_scheduled, etc.
    trigger_schedule VARCHAR(100),  -- Cron expression for scheduled workflows

    -- Steps
    steps JSONB NOT NULL DEFAULT '[]',  -- Array of workflow steps

    -- Conditions
    conditions JSONB DEFAULT '{}',  -- When to trigger

    -- Status
    is_active BOOLEAN DEFAULT true,
    last_run_at TIMESTAMP WITH TIME ZONE,
    run_count INTEGER DEFAULT 0,

    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID
);

CREATE INDEX idx_tenant_workflows_tenant ON tenant_workflows(tenant_id);
CREATE INDEX idx_tenant_workflows_trigger ON tenant_workflows(trigger_type, trigger_event);

-- =============================================================================
-- SECTION 5: TENANT ROLES AND PERMISSIONS (GOVERNANCE)
-- =============================================================================

-- Tenant Role Templates - Default roles that can be assigned to tenants
CREATE TABLE IF NOT EXISTS tenant_role_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Role Identity
    code VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Permissions
    permissions JSONB NOT NULL DEFAULT '[]',

    -- Type
    is_system_role BOOLEAN DEFAULT false,  -- Cannot be modified
    is_default BOOLEAN DEFAULT false,  -- Automatically assigned to new tenants

    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tenant-Specific Roles - Roles customized per tenant
CREATE TABLE IF NOT EXISTS tenant_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Role Identity
    code VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Permissions
    permissions JSONB NOT NULL DEFAULT '[]',

    -- Hierarchy
    parent_role_id UUID REFERENCES tenant_roles(id),
    hierarchy_level INTEGER DEFAULT 0,

    -- Type
    is_system_role BOOLEAN DEFAULT false,
    is_custom BOOLEAN DEFAULT false,  -- Created by tenant admin

    -- Status
    is_active BOOLEAN DEFAULT true,

    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,

    UNIQUE(tenant_id, code)
);

CREATE INDEX idx_tenant_roles_tenant ON tenant_roles(tenant_id);

-- Tenant Permission Definitions - All available permissions
CREATE TABLE IF NOT EXISTS tenant_permission_definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Permission Identity
    code VARCHAR(200) UNIQUE NOT NULL,  -- module.resource.action format
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Categorization
    module VARCHAR(100) NOT NULL,  -- patients, appointments, billing, etc.
    resource VARCHAR(100) NOT NULL,  -- patient, appointment, claim, etc.
    action VARCHAR(100) NOT NULL,  -- view, create, update, delete, export, etc.

    -- Risk Level
    risk_level VARCHAR(20) DEFAULT 'low',  -- low, medium, high, critical
    requires_mfa BOOLEAN DEFAULT false,

    -- Dependencies
    depends_on TEXT[],  -- Other permissions required

    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tenant_permission_definitions_module ON tenant_permission_definitions(module);

-- =============================================================================
-- SECTION 6: API AND INTEGRATION MANAGEMENT
-- =============================================================================

-- Tenant API Keys - API access for tenants
CREATE TABLE IF NOT EXISTS tenant_api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Key Identity
    name VARCHAR(255) NOT NULL,
    key_prefix VARCHAR(10) NOT NULL,  -- First 10 chars for identification
    key_hash VARCHAR(255) NOT NULL,  -- Hashed full key

    -- Permissions
    scopes JSONB DEFAULT '[]',  -- API scopes allowed
    rate_limit_per_minute INTEGER DEFAULT 60,
    rate_limit_per_day INTEGER DEFAULT 10000,

    -- Restrictions
    allowed_ips JSONB DEFAULT '[]',
    allowed_origins JSONB DEFAULT '[]',

    -- Status
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMP WITH TIME ZONE,
    usage_count BIGINT DEFAULT 0,

    -- Expiration
    expires_at TIMESTAMP WITH TIME ZONE,

    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    revoked_at TIMESTAMP WITH TIME ZONE,
    revoked_by UUID,
    revocation_reason TEXT
);

CREATE INDEX idx_tenant_api_keys_tenant ON tenant_api_keys(tenant_id);
CREATE INDEX idx_tenant_api_keys_prefix ON tenant_api_keys(key_prefix);

-- Tenant Integrations - Third-party integrations per tenant
CREATE TABLE IF NOT EXISTS tenant_integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Integration Identity
    integration_type VARCHAR(100) NOT NULL,  -- lab, pharmacy, clearinghouse, etc.
    provider_name VARCHAR(255) NOT NULL,

    -- Configuration (encrypted sensitive data)
    config JSONB DEFAULT '{}',
    credentials_encrypted BYTEA,  -- Encrypted credentials

    -- Endpoints
    base_url VARCHAR(500),
    webhook_url VARCHAR(500),

    -- Status
    status VARCHAR(50) DEFAULT 'pending',  -- pending, active, error, disabled
    last_sync_at TIMESTAMP WITH TIME ZONE,
    last_error TEXT,
    error_count INTEGER DEFAULT 0,

    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID
);

CREATE INDEX idx_tenant_integrations_tenant ON tenant_integrations(tenant_id);
CREATE INDEX idx_tenant_integrations_type ON tenant_integrations(integration_type);

-- Tenant Webhooks - Outgoing webhooks configuration
CREATE TABLE IF NOT EXISTS tenant_webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Webhook Configuration
    name VARCHAR(255) NOT NULL,
    url VARCHAR(500) NOT NULL,
    secret_hash VARCHAR(255),  -- For signature verification

    -- Events
    events JSONB NOT NULL DEFAULT '[]',  -- Events to trigger webhook

    -- Request Config
    http_method VARCHAR(10) DEFAULT 'POST',
    headers JSONB DEFAULT '{}',
    retry_count INTEGER DEFAULT 3,
    timeout_seconds INTEGER DEFAULT 30,

    -- Status
    is_active BOOLEAN DEFAULT true,
    last_triggered_at TIMESTAMP WITH TIME ZONE,
    success_count BIGINT DEFAULT 0,
    failure_count BIGINT DEFAULT 0,

    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID
);

CREATE INDEX idx_tenant_webhooks_tenant ON tenant_webhooks(tenant_id);

-- =============================================================================
-- SECTION 7: NOTIFICATIONS AND COMMUNICATION
-- =============================================================================

-- Tenant Notification Settings
CREATE TABLE IF NOT EXISTS tenant_notification_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Email Settings
    email_enabled BOOLEAN DEFAULT true,
    email_from_name VARCHAR(255),
    email_from_address VARCHAR(255),
    email_reply_to VARCHAR(255),
    smtp_config JSONB,  -- Custom SMTP settings (encrypted)

    -- SMS Settings
    sms_enabled BOOLEAN DEFAULT false,
    sms_provider VARCHAR(100),
    sms_config JSONB,  -- Provider config (encrypted)
    sms_from_number VARCHAR(50),

    -- Push Notification Settings
    push_enabled BOOLEAN DEFAULT false,
    push_provider VARCHAR(100),
    push_config JSONB,

    -- In-App Notifications
    in_app_enabled BOOLEAN DEFAULT true,

    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_tenant_notification_settings_tenant ON tenant_notification_settings(tenant_id);

-- =============================================================================
-- SECTION 8: DATA MANAGEMENT
-- =============================================================================

-- Tenant Data Exports - Track data export requests
CREATE TABLE IF NOT EXISTS tenant_data_exports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Export Details
    export_type VARCHAR(100) NOT NULL,  -- full_backup, patient_data, audit_logs
    format VARCHAR(50) DEFAULT 'json',  -- json, csv, xml

    -- Filters
    filters JSONB DEFAULT '{}',
    date_range_start DATE,
    date_range_end DATE,

    -- Status
    status VARCHAR(50) DEFAULT 'pending',  -- pending, processing, completed, failed
    progress_percent INTEGER DEFAULT 0,

    -- File Info
    file_path VARCHAR(500),
    file_size_bytes BIGINT,
    checksum VARCHAR(255),

    -- Expiration
    expires_at TIMESTAMP WITH TIME ZONE,
    download_count INTEGER DEFAULT 0,
    max_downloads INTEGER DEFAULT 5,

    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    requested_by UUID,
    request_reason TEXT
);

CREATE INDEX idx_tenant_data_exports_tenant ON tenant_data_exports(tenant_id);
CREATE INDEX idx_tenant_data_exports_status ON tenant_data_exports(status);

-- Tenant Data Retention Policies
CREATE TABLE IF NOT EXISTS tenant_data_retention_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Policy Definition
    data_type VARCHAR(100) NOT NULL,  -- audit_logs, patient_records, archived_data
    retention_days INTEGER NOT NULL,

    -- Actions
    action_on_expiry VARCHAR(50) DEFAULT 'archive',  -- archive, delete, anonymize

    -- Status
    is_active BOOLEAN DEFAULT true,
    last_run_at TIMESTAMP WITH TIME ZONE,
    next_run_at TIMESTAMP WITH TIME ZONE,

    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(tenant_id, data_type)
);

CREATE INDEX idx_tenant_data_retention_policies_tenant ON tenant_data_retention_policies(tenant_id);

-- =============================================================================
-- SECTION 9: SESSION AND ACCESS MANAGEMENT
-- =============================================================================

-- Active Sessions - Track active user sessions
CREATE TABLE IF NOT EXISTS tenant_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,

    -- Session Info
    session_token_hash VARCHAR(255) NOT NULL,
    refresh_token_hash VARCHAR(255),

    -- Device Info
    device_id VARCHAR(255),
    device_type VARCHAR(100),
    device_name VARCHAR(255),
    browser VARCHAR(100),
    os VARCHAR(100),

    -- Location
    ip_address VARCHAR(50),
    geo_country VARCHAR(100),
    geo_city VARCHAR(100),

    -- Status
    is_active BOOLEAN DEFAULT true,
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Expiration
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE,
    revoked_reason VARCHAR(255)
);

CREATE INDEX idx_tenant_sessions_tenant ON tenant_sessions(tenant_id);
CREATE INDEX idx_tenant_sessions_user ON tenant_sessions(user_id);
CREATE INDEX idx_tenant_sessions_token ON tenant_sessions(session_token_hash);
CREATE INDEX idx_tenant_sessions_active ON tenant_sessions(is_active, expires_at);

-- =============================================================================
-- SECTION 10: HELPER FUNCTIONS
-- =============================================================================

-- Function to get tenant by subdomain
CREATE OR REPLACE FUNCTION get_tenant_by_subdomain(p_subdomain VARCHAR)
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT id FROM tenants
        WHERE subdomain = p_subdomain
        AND status = 'active'
        AND deleted_at IS NULL
    );
END;
$$ LANGUAGE plpgsql;

-- Function to check if tenant feature is enabled
CREATE OR REPLACE FUNCTION tenant_has_feature(p_tenant_id UUID, p_feature VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        SELECT (features->>p_feature)::boolean
        FROM tenants
        WHERE id = p_tenant_id
    );
END;
$$ LANGUAGE plpgsql;

-- Function to check tenant limits
CREATE OR REPLACE FUNCTION check_tenant_limit(
    p_tenant_id UUID,
    p_resource VARCHAR,
    p_current_count INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    v_max_limit INTEGER;
BEGIN
    SELECT
        CASE p_resource
            WHEN 'users' THEN max_users
            WHEN 'patients' THEN max_patients
            WHEN 'providers' THEN max_providers
            WHEN 'storage' THEN max_storage_gb
        END INTO v_max_limit
    FROM tenants
    WHERE id = p_tenant_id;

    IF v_max_limit = -1 THEN
        RETURN true;  -- Unlimited
    END IF;

    RETURN p_current_count < v_max_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to generate invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number(p_tenant_id UUID)
RETURNS VARCHAR AS $$
DECLARE
    v_tenant_code VARCHAR;
    v_year VARCHAR;
    v_sequence INTEGER;
BEGIN
    SELECT tenant_code INTO v_tenant_code FROM tenants WHERE id = p_tenant_id;
    v_year := TO_CHAR(CURRENT_DATE, 'YYYY');

    SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM '\d+$') AS INTEGER)), 0) + 1
    INTO v_sequence
    FROM tenant_invoices
    WHERE tenant_id = p_tenant_id
    AND invoice_number LIKE 'INV-' || v_tenant_code || '-' || v_year || '-%';

    RETURN 'INV-' || UPPER(v_tenant_code) || '-' || v_year || '-' || LPAD(v_sequence::VARCHAR, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all tables
DO $$
DECLARE
    t_name TEXT;
BEGIN
    FOR t_name IN
        SELECT table_name
        FROM information_schema.columns
        WHERE column_name = 'updated_at'
        AND table_schema = 'public'
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS trigger_update_updated_at ON %I;
            CREATE TRIGGER trigger_update_updated_at
            BEFORE UPDATE ON %I
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        ', t_name, t_name);
    END LOOP;
END;
$$;

-- =============================================================================
-- SECTION 11: DEFAULT DATA
-- =============================================================================

-- Insert default subscription plans
INSERT INTO tenant_subscription_plans (code, name, display_name, description, price_monthly, price_yearly, included_users, max_users, included_patients, max_patients, included_providers, max_providers, tier, features) VALUES
('free', 'Free', 'Free Plan', 'Basic plan for small practices', 0, 0, 1, 2, 50, 100, 1, 1, 1,
    '{"telehealth": false, "erx": false, "fhir": false, "patient_portal": true, "crm": false, "edi_835": false, "edi_837": false, "api_access": false, "sso": false, "advanced_analytics": false, "white_label": false, "priority_support": false, "data_export": false, "audit_logs": true, "backup_frequency": "weekly"}'::jsonb),

('starter', 'Starter', 'Starter Plan', 'For growing practices', 99, 990, 5, 10, 500, 1000, 2, 5, 2,
    '{"telehealth": true, "erx": true, "fhir": false, "patient_portal": true, "crm": true, "edi_835": false, "edi_837": false, "api_access": false, "sso": false, "advanced_analytics": false, "white_label": false, "priority_support": false, "data_export": true, "audit_logs": true, "backup_frequency": "daily"}'::jsonb),

('professional', 'Professional', 'Professional Plan', 'Full-featured for established practices', 299, 2990, 20, 50, 5000, 10000, 10, 20, 3,
    '{"telehealth": true, "erx": true, "fhir": true, "patient_portal": true, "crm": true, "edi_835": true, "edi_837": true, "api_access": true, "sso": false, "advanced_analytics": true, "white_label": false, "priority_support": true, "data_export": true, "audit_logs": true, "backup_frequency": "daily"}'::jsonb),

('enterprise', 'Enterprise', 'Enterprise Plan', 'Unlimited features for large organizations', 799, 7990, 100, -1, 50000, -1, 50, -1, 4,
    '{"telehealth": true, "erx": true, "fhir": true, "patient_portal": true, "crm": true, "edi_835": true, "edi_837": true, "api_access": true, "sso": true, "advanced_analytics": true, "white_label": true, "priority_support": true, "dedicated_support": true, "custom_integrations": true, "data_export": true, "audit_logs": true, "backup_frequency": "hourly"}'::jsonb)

ON CONFLICT (code) DO NOTHING;

-- Insert default permission definitions
INSERT INTO tenant_permission_definitions (code, name, description, module, resource, action, risk_level) VALUES
-- Patient Permissions
('patients.patient.view', 'View Patients', 'View patient records and demographics', 'patients', 'patient', 'view', 'low'),
('patients.patient.create', 'Create Patients', 'Create new patient records', 'patients', 'patient', 'create', 'medium'),
('patients.patient.update', 'Update Patients', 'Update patient information', 'patients', 'patient', 'update', 'medium'),
('patients.patient.delete', 'Delete Patients', 'Delete patient records', 'patients', 'patient', 'delete', 'critical'),
('patients.patient.export', 'Export Patients', 'Export patient data', 'patients', 'patient', 'export', 'high'),

-- Appointment Permissions
('appointments.appointment.view', 'View Appointments', 'View appointment schedules', 'appointments', 'appointment', 'view', 'low'),
('appointments.appointment.create', 'Create Appointments', 'Schedule new appointments', 'appointments', 'appointment', 'create', 'low'),
('appointments.appointment.update', 'Update Appointments', 'Modify existing appointments', 'appointments', 'appointment', 'update', 'low'),
('appointments.appointment.delete', 'Delete Appointments', 'Cancel or delete appointments', 'appointments', 'appointment', 'delete', 'medium'),

-- Clinical Permissions
('clinical.record.view', 'View Medical Records', 'View patient medical records', 'clinical', 'record', 'view', 'medium'),
('clinical.record.create', 'Create Medical Records', 'Create medical documentation', 'clinical', 'record', 'create', 'medium'),
('clinical.record.update', 'Update Medical Records', 'Update medical documentation', 'clinical', 'record', 'update', 'medium'),
('clinical.prescription.view', 'View Prescriptions', 'View prescription information', 'clinical', 'prescription', 'view', 'medium'),
('clinical.prescription.create', 'Create Prescriptions', 'Write new prescriptions', 'clinical', 'prescription', 'create', 'high'),

-- Billing Permissions
('billing.claim.view', 'View Claims', 'View billing claims', 'billing', 'claim', 'view', 'low'),
('billing.claim.create', 'Create Claims', 'Submit new claims', 'billing', 'claim', 'create', 'medium'),
('billing.claim.update', 'Update Claims', 'Modify claims', 'billing', 'claim', 'update', 'medium'),
('billing.payment.view', 'View Payments', 'View payment information', 'billing', 'payment', 'view', 'low'),
('billing.payment.process', 'Process Payments', 'Process and record payments', 'billing', 'payment', 'process', 'high'),

-- Admin Permissions
('admin.user.view', 'View Users', 'View user accounts', 'admin', 'user', 'view', 'low'),
('admin.user.create', 'Create Users', 'Create new user accounts', 'admin', 'user', 'create', 'high'),
('admin.user.update', 'Update Users', 'Update user accounts', 'admin', 'user', 'update', 'high'),
('admin.user.delete', 'Delete Users', 'Delete user accounts', 'admin', 'user', 'delete', 'critical'),
('admin.role.manage', 'Manage Roles', 'Create and modify roles', 'admin', 'role', 'manage', 'critical'),
('admin.settings.manage', 'Manage Settings', 'Configure system settings', 'admin', 'settings', 'manage', 'high'),
('admin.audit.view', 'View Audit Logs', 'View system audit logs', 'admin', 'audit', 'view', 'medium'),

-- Reports Permissions
('reports.general.view', 'View Reports', 'View standard reports', 'reports', 'general', 'view', 'low'),
('reports.financial.view', 'View Financial Reports', 'View financial reports', 'reports', 'financial', 'view', 'medium'),
('reports.compliance.view', 'View Compliance Reports', 'View compliance reports', 'reports', 'compliance', 'view', 'high'),
('reports.custom.create', 'Create Custom Reports', 'Create custom reports', 'reports', 'custom', 'create', 'medium')

ON CONFLICT (code) DO NOTHING;

-- Insert default role templates
INSERT INTO tenant_role_templates (code, name, description, is_system_role, is_default, permissions) VALUES
('admin', 'Administrator', 'Full system access', true, true,
    '["patients.patient.view", "patients.patient.create", "patients.patient.update", "patients.patient.delete", "patients.patient.export", "appointments.appointment.view", "appointments.appointment.create", "appointments.appointment.update", "appointments.appointment.delete", "clinical.record.view", "clinical.record.create", "clinical.record.update", "clinical.prescription.view", "clinical.prescription.create", "billing.claim.view", "billing.claim.create", "billing.claim.update", "billing.payment.view", "billing.payment.process", "admin.user.view", "admin.user.create", "admin.user.update", "admin.user.delete", "admin.role.manage", "admin.settings.manage", "admin.audit.view", "reports.general.view", "reports.financial.view", "reports.compliance.view", "reports.custom.create"]'::jsonb),

('doctor', 'Doctor/Provider', 'Clinical staff with full patient access', true, true,
    '["patients.patient.view", "patients.patient.create", "patients.patient.update", "appointments.appointment.view", "appointments.appointment.create", "appointments.appointment.update", "clinical.record.view", "clinical.record.create", "clinical.record.update", "clinical.prescription.view", "clinical.prescription.create", "billing.claim.view", "reports.general.view"]'::jsonb),

('nurse', 'Nurse', 'Clinical support staff', true, true,
    '["patients.patient.view", "patients.patient.update", "appointments.appointment.view", "appointments.appointment.create", "appointments.appointment.update", "clinical.record.view", "clinical.record.create", "clinical.record.update", "clinical.prescription.view"]'::jsonb),

('receptionist', 'Receptionist', 'Front desk staff', true, true,
    '["patients.patient.view", "patients.patient.create", "patients.patient.update", "appointments.appointment.view", "appointments.appointment.create", "appointments.appointment.update", "appointments.appointment.delete"]'::jsonb),

('billing_manager', 'Billing Manager', 'Billing and claims staff', true, true,
    '["patients.patient.view", "billing.claim.view", "billing.claim.create", "billing.claim.update", "billing.payment.view", "billing.payment.process", "reports.general.view", "reports.financial.view"]'::jsonb),

('patient', 'Patient', 'Patient portal access', true, true,
    '["appointments.appointment.view", "appointments.appointment.create", "clinical.record.view", "clinical.prescription.view", "billing.payment.view"]'::jsonb)

ON CONFLICT (code) DO NOTHING;

-- =============================================================================
-- COMMENTS
-- =============================================================================
COMMENT ON TABLE tenants IS 'Master tenant registry containing all tenant configurations';
COMMENT ON TABLE tenant_administrators IS 'Central administrators who manage the multi-tenant platform';
COMMENT ON TABLE tenant_subscriptions IS 'Active subscription information for each tenant';
COMMENT ON TABLE tenant_audit_logs IS 'Comprehensive audit trail for compliance and security';
COMMENT ON TABLE tenant_security_events IS 'High-priority security events requiring attention';
COMMENT ON TABLE tenant_settings IS 'Key-value configuration store for tenant-specific settings';
COMMENT ON TABLE tenant_api_keys IS 'API keys for programmatic tenant access';
COMMENT ON TABLE tenant_sessions IS 'Active user sessions for security monitoring';
