-- MedFlow Database Schema
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- USERS TABLE (Must be defined first - referenced by patients)
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  role VARCHAR(100) DEFAULT 'user',
  practice VARCHAR(255),
  avatar VARCHAR(10),
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(20),
  license VARCHAR(50),
  specialty VARCHAR(100),
  password_hash VARCHAR(255),
  reset_token VARCHAR(255),
  reset_token_expires TIMESTAMP,
  preferences JSONB DEFAULT '{}',
  language VARCHAR(10) DEFAULT 'en',
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- PATIENTS TABLE
-- ============================================================================
-- Note: patients.id directly references users.id (no separate user_id column)
-- A patient IS a user, so they share the same ID
CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  mrn VARCHAR(50) UNIQUE NOT NULL,
  dob DATE,
  date_of_birth DATE,
  gender VARCHAR(50),
  phone VARCHAR(20),
  email VARCHAR(255),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(2),
  zip VARCHAR(10),
  insurance VARCHAR(100),
  insurance_id VARCHAR(100),
  status VARCHAR(50) DEFAULT 'Active',
  portal_enabled BOOLEAN DEFAULT FALSE,
  portal_password_hash VARCHAR(255),
  emergency_contact JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- PROVIDERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS providers (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  specialization VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(20),
  license_number VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- APPOINTMENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS appointments (
  id SERIAL PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  provider_id INTEGER REFERENCES providers(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  time TIME NOT NULL,
  type VARCHAR(100),
  appointment_type VARCHAR(100),
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  duration INTEGER,
  duration_minutes INTEGER,
  reason TEXT,
  notes TEXT,
  status VARCHAR(50) DEFAULT 'Scheduled',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- CLAIMS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS claims (
  id SERIAL PRIMARY KEY,
  claim_number VARCHAR(50) UNIQUE NOT NULL,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  payer VARCHAR(100),
  payer_id VARCHAR(100),
  amount DECIMAL(10, 2),
  status VARCHAR(50) DEFAULT 'Pending',
  date DATE,
  service_date DATE,
  diagnosis_codes JSONB,
  procedure_codes JSONB,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- NOTIFICATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50),
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- TASKS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  priority VARCHAR(50) DEFAULT 'Medium',
  due_date DATE,
  status VARCHAR(50) DEFAULT 'Pending',
  description TEXT,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- PAYMENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  claim_id INTEGER REFERENCES claims(id) ON DELETE SET NULL,
  amount DECIMAL(10, 2) NOT NULL,
  payment_method VARCHAR(50),
  payment_date DATE,
  status VARCHAR(50) DEFAULT 'pending',
  transaction_id VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- PRESCRIPTIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS prescriptions (
  id SERIAL PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  provider_id INTEGER REFERENCES providers(id) ON DELETE SET NULL,
  medication_name VARCHAR(255) NOT NULL,
  dosage VARCHAR(100),
  frequency VARCHAR(100),
  duration VARCHAR(100),
  quantity INTEGER,
  refills INTEGER DEFAULT 0,
  instructions TEXT,
  status VARCHAR(50) DEFAULT 'Active',
  prescribed_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- DIAGNOSIS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS diagnosis (
  id SERIAL PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  provider_id INTEGER REFERENCES providers(id) ON DELETE SET NULL,
  code VARCHAR(20),
  description TEXT,
  date DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- MEDICAL RECORDS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS medical_records (
  id SERIAL PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  provider_id INTEGER REFERENCES providers(id) ON DELETE SET NULL,
  visit_date DATE,
  chief_complaint TEXT,
  diagnosis TEXT,
  treatment TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- PATIENT PORTAL SESSIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS patient_portal_sessions (
  id SERIAL PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  session_token VARCHAR(255) UNIQUE NOT NULL,
  ip_address VARCHAR(50),
  user_agent TEXT,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- SOCIAL AUTH TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS social_auth (
  id SERIAL PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL, -- google, microsoft, etc.
  provider_user_id VARCHAR(255) NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  profile_data JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider, provider_user_id)
);

-- ============================================================================
-- PHARMACIES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS pharmacies (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(2),
  zip VARCHAR(10),
  phone VARCHAR(20),
  fax VARCHAR(20),
  email VARCHAR(255),
  ncpdp_id VARCHAR(50),
  npi VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- PATIENT PREFERRED PHARMACIES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS patient_preferred_pharmacies (
  id SERIAL PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  pharmacy_id INTEGER REFERENCES pharmacies(id) ON DELETE CASCADE,
  is_preferred BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(patient_id, pharmacy_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_patients_mrn ON patients(mrn);
CREATE INDEX IF NOT EXISTS idx_patients_email ON patients(email);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_provider ON appointments(provider_id);
CREATE INDEX IF NOT EXISTS idx_claims_patient ON claims(patient_id);
CREATE INDEX IF NOT EXISTS idx_claims_claim_number ON claims(claim_number);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_patient ON payments(patient_id);
CREATE INDEX IF NOT EXISTS idx_payments_claim ON payments(claim_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_status ON prescriptions(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_portal_sessions_token ON patient_portal_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_portal_sessions_expires ON patient_portal_sessions(expires_at);

-- ============================================================================
-- SAMPLE DATA (optional - can be removed for production)
-- ============================================================================

-- Insert sample admin user
INSERT INTO users (id, name, first_name, last_name, role, practice, avatar, email, phone, license, specialty, preferences)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Dr. Sarah Chen',
  'Sarah',
  'Chen',
  'admin',
  'Central Medical Group',
  'SC',
  'sarah.chen@medflow.com',
  '(555) 123-4567',
  'MD-123456',
  'Internal Medicine',
  '{"emailNotifications": true, "smsAlerts": true, "darkMode": true}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- Insert sample provider
INSERT INTO providers (id, user_id, first_name, last_name, specialization, email, phone, license_number)
VALUES (
  1,
  'a0000000-0000-0000-0000-000000000001',
  'Sarah',
  'Chen',
  'Family Medicine',
  'dr.chen@medflow.com',
  '+1-555-0100',
  'MD-123456'
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================
COMMENT ON TABLE users IS 'Core users table - all system users (staff, doctors, patients)';
COMMENT ON TABLE patients IS 'Patient records - id references users.id directly (no separate user_id)';
COMMENT ON TABLE providers IS 'Healthcare providers - references users via user_id';
COMMENT ON TABLE appointments IS 'Patient appointments with providers';
COMMENT ON TABLE claims IS 'Insurance claims for patient services';

COMMENT ON COLUMN patients.id IS 'Primary key - references users.id directly (patient IS a user)';
COMMENT ON COLUMN providers.user_id IS 'Optional reference to users table for provider login';
-- This script was generated by the ERD tool in pgAdmin 4.
-- Please log an issue at https://github.com/pgadmin-org/pgadmin4/issues/new/choose if you find any bugs, including reproduction steps.
BEGIN;


CREATE TABLE IF NOT EXISTS public.appointment_reminders
(
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    appointment_id uuid NOT NULL,
    reminder_type character varying(50) COLLATE pg_catalog."default" NOT NULL,
    scheduled_for timestamp without time zone NOT NULL,
    sent_at timestamp without time zone,
    delivery_status character varying(50) COLLATE pg_catalog."default" DEFAULT 'pending'::character varying,
    error_message text COLLATE pg_catalog."default",
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT appointment_reminders_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE public.appointment_reminders
    IS 'Tracks scheduled appointment reminders (email/SMS)';

CREATE TABLE IF NOT EXISTS public.appointment_type_config
(
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    provider_id uuid,
    name character varying(100) COLLATE pg_catalog."default" NOT NULL,
    description text COLLATE pg_catalog."default",
    duration_minutes integer NOT NULL DEFAULT 30,
    buffer_minutes integer DEFAULT 0,
    color character varying(20) COLLATE pg_catalog."default" DEFAULT '#3B82F6'::character varying,
    price numeric(10, 2) DEFAULT 0.00,
    is_active boolean DEFAULT true,
    requires_approval boolean DEFAULT false,
    max_advance_booking_days integer DEFAULT 90,
    min_advance_booking_hours integer DEFAULT 24,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT appointment_type_config_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE public.appointment_type_config
    IS 'Defines available appointment types with duration and pricing';

CREATE TABLE IF NOT EXISTS public.appointment_waitlist
(
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    patient_id uuid NOT NULL,
    provider_id uuid NOT NULL,
    appointment_type_id uuid,
    preferred_date_start date NOT NULL,
    preferred_date_end date NOT NULL,
    preferred_time_start time without time zone,
    preferred_time_end time without time zone,
    notes text COLLATE pg_catalog."default",
    status character varying(50) COLLATE pg_catalog."default" DEFAULT 'waiting'::character varying,
    notified_at timestamp without time zone,
    expires_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT appointment_waitlist_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE public.appointment_waitlist
    IS 'Queue system for patients waiting for fully booked slots';

CREATE TABLE IF NOT EXISTS public.appointments
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    practice_id uuid,
    patient_id uuid,
    provider_id uuid,
    appointment_type character varying(50) COLLATE pg_catalog."default",
    status character varying(20) COLLATE pg_catalog."default" DEFAULT 'scheduled'::character varying,
    start_time timestamp without time zone NOT NULL,
    end_time timestamp without time zone NOT NULL,
    duration_minutes integer,
    reason text COLLATE pg_catalog."default",
    notes text COLLATE pg_catalog."default",
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    appointment_type_id uuid,
    recurring_appointment_id uuid,
    timezone character varying(100) COLLATE pg_catalog."default" DEFAULT 'UTC'::character varying,
    booking_source character varying(50) COLLATE pg_catalog."default" DEFAULT 'staff'::character varying,
    confirmation_sent_at timestamp without time zone,
    reminder_sent_at timestamp without time zone,
    cancelled_at timestamp without time zone,
    cancelled_by uuid,
    cancellation_reason text COLLATE pg_catalog."default",
    rescheduled_from uuid,
    no_show_notified_at timestamp without time zone,
    custom_form_data jsonb DEFAULT '{}'::jsonb,
    offering_id uuid,
    package_enrollment_id uuid,
    CONSTRAINT appointments_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.booking_analytics
(
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    provider_id uuid,
    event_type character varying(50) COLLATE pg_catalog."default" NOT NULL,
    appointment_id uuid,
    appointment_type_id uuid,
    patient_id uuid,
    session_id character varying(100) COLLATE pg_catalog."default",
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT booking_analytics_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE public.booking_analytics
    IS 'Booking funnel analytics for insights and reporting';

CREATE TABLE IF NOT EXISTS public.claims
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    practice_id uuid,
    patient_id uuid,
    claim_number character varying(50) COLLATE pg_catalog."default" NOT NULL,
    payer character varying(255) COLLATE pg_catalog."default",
    service_date date NOT NULL,
    amount numeric(10, 2),
    status character varying(20) COLLATE pg_catalog."default" DEFAULT 'pending'::character varying,
    diagnosis_codes text[] COLLATE pg_catalog."default",
    procedure_codes text[] COLLATE pg_catalog."default",
    notes text COLLATE pg_catalog."default",
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT claims_pkey PRIMARY KEY (id),
    CONSTRAINT claims_claim_number_key UNIQUE (claim_number)
);

CREATE TABLE IF NOT EXISTS public.diagnosis
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    patient_id uuid,
    provider_id uuid,
    appointment_id uuid,
    diagnosis_code character varying(20) COLLATE pg_catalog."default",
    diagnosis_name character varying(255) COLLATE pg_catalog."default" NOT NULL,
    description text COLLATE pg_catalog."default",
    severity character varying(50) COLLATE pg_catalog."default",
    status character varying(50) COLLATE pg_catalog."default" DEFAULT 'Active'::character varying,
    diagnosed_date date DEFAULT CURRENT_DATE,
    notes text COLLATE pg_catalog."default",
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT diagnosis_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE public.diagnosis
    IS 'Stores patient diagnoses with ICD codes and severity';

CREATE TABLE IF NOT EXISTS public.doctor_availability
(
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    provider_id uuid NOT NULL,
    day_of_week integer NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    is_available boolean DEFAULT true,
    timezone character varying(100) COLLATE pg_catalog."default" DEFAULT 'UTC'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT doctor_availability_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE public.doctor_availability
    IS 'Stores doctor weekly availability schedule (working hours)';

CREATE TABLE IF NOT EXISTS public.doctor_time_off
(
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    provider_id uuid NOT NULL,
    start_date timestamp without time zone NOT NULL,
    end_date timestamp without time zone NOT NULL,
    reason character varying(500) COLLATE pg_catalog."default",
    is_recurring boolean DEFAULT false,
    recurrence_rule character varying(255) COLLATE pg_catalog."default",
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT doctor_time_off_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE public.doctor_time_off
    IS 'Tracks doctor time-off, vacations, and schedule exceptions';

CREATE TABLE IF NOT EXISTS public.drug_interactions
(
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    drug1_ndc character varying(20) COLLATE pg_catalog."default" NOT NULL,
    drug2_ndc character varying(20) COLLATE pg_catalog."default" NOT NULL,
    interaction_severity character varying(50) COLLATE pg_catalog."default" NOT NULL,
    interaction_type character varying(100) COLLATE pg_catalog."default",
    description text COLLATE pg_catalog."default" NOT NULL,
    clinical_effects text COLLATE pg_catalog."default",
    management_recommendations text COLLATE pg_catalog."default",
    reference_sources text COLLATE pg_catalog."default",
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT drug_interactions_pkey PRIMARY KEY (id),
    CONSTRAINT drug_interactions_drug1_ndc_drug2_ndc_key UNIQUE (drug1_ndc, drug2_ndc)
);

COMMENT ON TABLE public.drug_interactions
    IS 'Known drug-drug interactions database';

CREATE TABLE IF NOT EXISTS public.erx_message_queue
(
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    prescription_id uuid,
    message_type character varying(50) COLLATE pg_catalog."default" NOT NULL,
    message_direction character varying(20) COLLATE pg_catalog."default" NOT NULL,
    pharmacy_id uuid,
    message_payload jsonb NOT NULL,
    message_status character varying(50) COLLATE pg_catalog."default" DEFAULT 'pending'::character varying,
    retry_count integer DEFAULT 0,
    max_retries integer DEFAULT 3,
    error_message text COLLATE pg_catalog."default",
    sent_date timestamp without time zone,
    delivered_date timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT erx_message_queue_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE public.erx_message_queue
    IS 'Queue for electronic prescription messages to/from pharmacies';

CREATE TABLE IF NOT EXISTS public.fhir_resources
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    resource_type character varying(50) COLLATE pg_catalog."default" NOT NULL,
    resource_id character varying(100) COLLATE pg_catalog."default" NOT NULL,
    patient_id uuid,
    fhir_version character varying(10) COLLATE pg_catalog."default" DEFAULT 'R4'::character varying,
    resource_data jsonb NOT NULL,
    last_updated timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fhir_resources_pkey PRIMARY KEY (id),
    CONSTRAINT fhir_resources_resource_type_resource_id_key UNIQUE (resource_type, resource_id)
);

CREATE TABLE IF NOT EXISTS public.healthcare_offerings
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name character varying(255) COLLATE pg_catalog."default" NOT NULL,
    description text COLLATE pg_catalog."default",
    category_id uuid,
    duration_minutes integer,
    requires_preparation boolean DEFAULT false,
    preparation_instructions text COLLATE pg_catalog."default",
    is_active boolean DEFAULT true,
    is_featured boolean DEFAULT false,
    available_online boolean DEFAULT true,
    requires_referral boolean DEFAULT false,
    cpt_codes text[] COLLATE pg_catalog."default",
    icd_codes text[] COLLATE pg_catalog."default",
    hcpcs_codes text[] COLLATE pg_catalog."default",
    min_age integer,
    max_age integer,
    gender_restriction character varying(20) COLLATE pg_catalog."default",
    contraindications text COLLATE pg_catalog."default",
    prerequisites text COLLATE pg_catalog."default",
    allowed_provider_specializations text[] COLLATE pg_catalog."default",
    image_url text COLLATE pg_catalog."default",
    video_url text COLLATE pg_catalog."default",
    brochure_url text COLLATE pg_catalog."default",
    consent_form_required boolean DEFAULT false,
    consent_form_url text COLLATE pg_catalog."default",
    seo_title character varying(255) COLLATE pg_catalog."default",
    seo_description text COLLATE pg_catalog."default",
    seo_keywords text[] COLLATE pg_catalog."default",
    view_count integer DEFAULT 0,
    booking_count integer DEFAULT 0,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT healthcare_offerings_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE public.healthcare_offerings
    IS 'Individual medical services and procedures available to patients';

CREATE TABLE IF NOT EXISTS public.medical_records
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    patient_id uuid,
    provider_id uuid,
    record_type character varying(50) COLLATE pg_catalog."default" NOT NULL,
    record_date date NOT NULL,
    title character varying(255) COLLATE pg_catalog."default",
    description text COLLATE pg_catalog."default",
    diagnosis text COLLATE pg_catalog."default",
    treatment text COLLATE pg_catalog."default",
    medications jsonb,
    attachments jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT medical_records_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.medication_alternatives
(
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    original_ndc character varying(20) COLLATE pg_catalog."default",
    alternative_ndc character varying(20) COLLATE pg_catalog."default",
    relationship_type character varying(50) COLLATE pg_catalog."default" NOT NULL,
    cost_difference numeric(10, 2),
    notes text COLLATE pg_catalog."default",
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT medication_alternatives_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE public.medication_alternatives
    IS 'Generic and therapeutic alternatives for cost savings';

CREATE TABLE IF NOT EXISTS public.medications
(
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    ndc_code character varying(20) COLLATE pg_catalog."default" NOT NULL,
    drug_name character varying(255) COLLATE pg_catalog."default" NOT NULL,
    generic_name character varying(255) COLLATE pg_catalog."default",
    brand_name character varying(255) COLLATE pg_catalog."default",
    drug_class character varying(100) COLLATE pg_catalog."default",
    strength character varying(50) COLLATE pg_catalog."default",
    dosage_form character varying(50) COLLATE pg_catalog."default",
    route character varying(50) COLLATE pg_catalog."default",
    manufacturer character varying(255) COLLATE pg_catalog."default",
    controlled_substance boolean DEFAULT false,
    dea_schedule character varying(10) COLLATE pg_catalog."default",
    requires_prior_auth boolean DEFAULT false,
    formulary_status character varying(50) COLLATE pg_catalog."default" DEFAULT 'preferred'::character varying,
    average_cost numeric(10, 2),
    common_dosages text[] COLLATE pg_catalog."default",
    indications text[] COLLATE pg_catalog."default",
    contraindications text[] COLLATE pg_catalog."default",
    warnings text COLLATE pg_catalog."default",
    side_effects text[] COLLATE pg_catalog."default",
    drug_interactions text COLLATE pg_catalog."default",
    pregnancy_category character varying(5) COLLATE pg_catalog."default",
    is_generic boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT medications_pkey PRIMARY KEY (id),
    CONSTRAINT medications_ndc_code_key UNIQUE (ndc_code)
);

COMMENT ON TABLE public.medications
    IS 'Drug formulary database with NDC codes and drug information';

CREATE TABLE IF NOT EXISTS public.notifications
(
    id serial NOT NULL,
    user_id uuid,
    type character varying(50) COLLATE pg_catalog."default",
    message text COLLATE pg_catalog."default" NOT NULL,
    read boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT notifications_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.offering_insurance_mappings
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    offering_id uuid,
    insurance_provider character varying(255) COLLATE pg_catalog."default" NOT NULL,
    insurance_plan character varying(255) COLLATE pg_catalog."default",
    is_covered boolean DEFAULT true,
    coverage_percentage numeric(5, 2),
    copay_amount numeric(10, 2),
    deductible_applies boolean DEFAULT false,
    requires_preauthorization boolean DEFAULT false,
    preauth_phone character varying(50) COLLATE pg_catalog."default",
    preauth_instructions text COLLATE pg_catalog."default",
    primary_cpt_code character varying(20) COLLATE pg_catalog."default",
    modifier_codes text[] COLLATE pg_catalog."default",
    diagnosis_codes_required text[] COLLATE pg_catalog."default",
    coverage_notes text COLLATE pg_catalog."default",
    billing_notes text COLLATE pg_catalog."default",
    is_active boolean DEFAULT true,
    effective_from date,
    effective_until date,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT offering_insurance_mappings_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE public.offering_insurance_mappings
    IS 'Insurance coverage details for specific offerings';

CREATE TABLE IF NOT EXISTS public.offering_packages
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name character varying(255) COLLATE pg_catalog."default" NOT NULL,
    description text COLLATE pg_catalog."default",
    category_id uuid,
    package_type character varying(50) COLLATE pg_catalog."default" DEFAULT 'bundle'::character varying,
    validity_days integer,
    max_uses integer,
    base_price numeric(10, 2),
    discount_percentage numeric(5, 2),
    final_price numeric(10, 2),
    is_active boolean DEFAULT true,
    is_featured boolean DEFAULT false,
    available_from date,
    available_until date,
    benefits text[] COLLATE pg_catalog."default",
    features text[] COLLATE pg_catalog."default",
    image_url text COLLATE pg_catalog."default",
    terms_and_conditions text COLLATE pg_catalog."default",
    enrollment_count integer DEFAULT 0,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT offering_packages_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE public.offering_packages
    IS 'Bundled healthcare service packages and memberships';

CREATE TABLE IF NOT EXISTS public.offering_pricing
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    offering_id uuid,
    pricing_type character varying(50) COLLATE pg_catalog."default" NOT NULL,
    pricing_name character varying(255) COLLATE pg_catalog."default",
    base_price numeric(10, 2) NOT NULL,
    discount_percentage numeric(5, 2) DEFAULT 0,
    final_price numeric(10, 2),
    insurance_provider character varying(255) COLLATE pg_catalog."default",
    copay_amount numeric(10, 2),
    requires_preauthorization boolean DEFAULT false,
    effective_from date,
    effective_until date,
    is_active boolean DEFAULT true,
    additional_fees jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT offering_pricing_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE public.offering_pricing
    IS 'Multiple pricing tiers for offerings (cash, insurance, membership)';

CREATE TABLE IF NOT EXISTS public.offering_promotions
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name character varying(255) COLLATE pg_catalog."default" NOT NULL,
    description text COLLATE pg_catalog."default",
    promo_code character varying(50) COLLATE pg_catalog."default",
    discount_type character varying(20) COLLATE pg_catalog."default",
    discount_value numeric(10, 2),
    applicable_to character varying(20) COLLATE pg_catalog."default" DEFAULT 'all'::character varying,
    offering_ids uuid[],
    package_ids uuid[],
    category_ids uuid[],
    valid_from timestamp without time zone,
    valid_until timestamp without time zone,
    max_uses integer,
    max_uses_per_patient integer DEFAULT 1,
    current_uses integer DEFAULT 0,
    min_purchase_amount numeric(10, 2),
    new_patients_only boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT offering_promotions_pkey PRIMARY KEY (id),
    CONSTRAINT offering_promotions_promo_code_key UNIQUE (promo_code)
);

COMMENT ON TABLE public.offering_promotions
    IS 'Promotional campaigns and discount codes for offerings';

CREATE TABLE IF NOT EXISTS public.offering_reviews
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    offering_id uuid,
    patient_id uuid,
    appointment_id uuid,
    rating integer,
    review_text text COLLATE pg_catalog."default",
    is_approved boolean DEFAULT false,
    is_featured boolean DEFAULT false,
    moderated_by uuid,
    moderated_at timestamp without time zone,
    provider_response text COLLATE pg_catalog."default",
    response_date timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT offering_reviews_pkey PRIMARY KEY (id),
    CONSTRAINT offering_reviews_offering_id_patient_id_appointment_id_key UNIQUE (offering_id, patient_id, appointment_id)
);

COMMENT ON TABLE public.offering_reviews
    IS 'Patient reviews and ratings for healthcare offerings';

CREATE TABLE IF NOT EXISTS public.organization_settings
(
    id serial NOT NULL,
    organization_name character varying(255) COLLATE pg_catalog."default",
    current_plan_id integer,
    plan_start_date date,
    plan_end_date date,
    auto_renew boolean DEFAULT true,
    settings jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT organization_settings_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE public.organization_settings
    IS 'Organization-level settings including current plan';

CREATE TABLE IF NOT EXISTS public.package_offerings
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    package_id uuid,
    offering_id uuid,
    quantity_included integer DEFAULT 1,
    is_optional boolean DEFAULT false,
    display_order integer DEFAULT 0,
    price_override numeric(10, 2),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT package_offerings_pkey PRIMARY KEY (id),
    CONSTRAINT package_offerings_package_id_offering_id_key UNIQUE (package_id, offering_id)
);

COMMENT ON TABLE public.package_offerings
    IS 'Junction table linking packages to individual offerings';

CREATE TABLE IF NOT EXISTS public.patient_allergies
(
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    patient_id uuid,
    allergen_type character varying(50) COLLATE pg_catalog."default" NOT NULL,
    allergen_name character varying(255) COLLATE pg_catalog."default" NOT NULL,
    ndc_code character varying(20) COLLATE pg_catalog."default",
    reaction_type character varying(100) COLLATE pg_catalog."default",
    severity character varying(50) COLLATE pg_catalog."default",
    onset_date date,
    reported_date date DEFAULT CURRENT_DATE,
    reported_by uuid,
    verified boolean DEFAULT false,
    verified_by uuid,
    verified_date timestamp without time zone,
    notes text COLLATE pg_catalog."default",
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT patient_allergies_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE public.patient_allergies
    IS 'Patient allergy and adverse reaction tracking';

CREATE TABLE IF NOT EXISTS public.patient_offering_enrollments
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    patient_id uuid,
    package_id uuid,
    offering_id uuid,
    enrollment_date date NOT NULL DEFAULT CURRENT_DATE,
    expiry_date date,
    status character varying(50) COLLATE pg_catalog."default" DEFAULT 'active'::character varying,
    total_allowed_uses integer DEFAULT 1,
    used_count integer DEFAULT 0,
    remaining_uses integer,
    amount_paid numeric(10, 2),
    payment_method character varying(50) COLLATE pg_catalog."default",
    payment_status character varying(50) COLLATE pg_catalog."default" DEFAULT 'pending'::character varying,
    payment_id uuid,
    notes text COLLATE pg_catalog."default",
    cancellation_reason text COLLATE pg_catalog."default",
    cancelled_at timestamp without time zone,
    cancelled_by uuid,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT patient_offering_enrollments_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE public.patient_offering_enrollments
    IS 'Track patient enrollments in packages and offerings';

CREATE TABLE IF NOT EXISTS public.patient_pharmacies
(
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    patient_id uuid,
    pharmacy_id uuid,
    is_preferred boolean DEFAULT false,
    added_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT patient_pharmacies_pkey PRIMARY KEY (id),
    CONSTRAINT patient_pharmacies_patient_id_pharmacy_id_key UNIQUE (patient_id, pharmacy_id)
);

COMMENT ON TABLE public.patient_pharmacies
    IS 'Patient preferred pharmacy selections';

CREATE TABLE IF NOT EXISTS public.patient_portal_sessions
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    patient_id uuid,
    session_token character varying(255) COLLATE pg_catalog."default" NOT NULL,
    ip_address character varying(45) COLLATE pg_catalog."default",
    user_agent text COLLATE pg_catalog."default",
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT patient_portal_sessions_pkey PRIMARY KEY (id),
    CONSTRAINT patient_portal_sessions_session_token_key UNIQUE (session_token)
);

CREATE TABLE IF NOT EXISTS public.patients
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    practice_id uuid,
    mrn character varying(50) COLLATE pg_catalog."default" NOT NULL,
    first_name character varying(100) COLLATE pg_catalog."default" NOT NULL,
    last_name character varying(100) COLLATE pg_catalog."default" NOT NULL,
    date_of_birth date NOT NULL,
    gender character varying(20) COLLATE pg_catalog."default",
    phone character varying(20) COLLATE pg_catalog."default",
    email character varying(255) COLLATE pg_catalog."default",
    address text COLLATE pg_catalog."default",
    emergency_contact jsonb,
    insurance_info jsonb,
    status character varying(20) COLLATE pg_catalog."default" DEFAULT 'active'::character varying,
    portal_enabled boolean DEFAULT false,
    portal_password_hash character varying(255) COLLATE pg_catalog."default",
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    height character varying(20) COLLATE pg_catalog."default",
    weight character varying(20) COLLATE pg_catalog."default",
    blood_type character varying(10) COLLATE pg_catalog."default",
    allergies text COLLATE pg_catalog."default",
    past_history text COLLATE pg_catalog."default",
    family_history text COLLATE pg_catalog."default",
    current_medications text COLLATE pg_catalog."default",
    user_id uuid,
    CONSTRAINT patients_pkey PRIMARY KEY (id),
    CONSTRAINT patients_email_unique UNIQUE (email),
    CONSTRAINT patients_mrn_key UNIQUE (mrn)
);

COMMENT ON TABLE public.patients
    IS 'Patient records. Users with patient role will have entries here. Users can have multiple roles.';

COMMENT ON COLUMN public.patients.height
    IS 'Patient height (e.g., 5''10", 178cm)';

COMMENT ON COLUMN public.patients.weight
    IS 'Patient weight (e.g., 180 lbs, 82kg)';

COMMENT ON COLUMN public.patients.blood_type
    IS 'Patient blood type (e.g., O+, A-, AB+)';

CREATE TABLE IF NOT EXISTS public.payments
(
    payment_number character varying(50) COLLATE pg_catalog."default" NOT NULL,
    patient_id uuid,
    claim_id uuid,
    amount numeric(10, 2) NOT NULL,
    payment_method character varying(50) COLLATE pg_catalog."default" NOT NULL,
    payment_status character varying(50) COLLATE pg_catalog."default" NOT NULL DEFAULT 'pending'::character varying,
    transaction_id character varying(100) COLLATE pg_catalog."default",
    card_last_four character varying(4) COLLATE pg_catalog."default",
    card_brand character varying(20) COLLATE pg_catalog."default",
    payment_date timestamp without time zone,
    description text COLLATE pg_catalog."default",
    notes text COLLATE pg_catalog."default",
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    CONSTRAINT payments_pkey PRIMARY KEY (id),
    CONSTRAINT payments_payment_number_key UNIQUE (payment_number)
);

COMMENT ON TABLE public.payments
    IS 'Payment tracking with UUID primary key';

COMMENT ON COLUMN public.payments.id
    IS 'UUID primary key for payments';

CREATE TABLE IF NOT EXISTS public.permissions
(
    id serial NOT NULL,
    name character varying(100) COLLATE pg_catalog."default" NOT NULL,
    display_name character varying(100) COLLATE pg_catalog."default" NOT NULL,
    description text COLLATE pg_catalog."default",
    module character varying(50) COLLATE pg_catalog."default",
    action character varying(50) COLLATE pg_catalog."default",
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT permissions_pkey PRIMARY KEY (id),
    CONSTRAINT permissions_name_key UNIQUE (name)
);

COMMENT ON TABLE public.permissions
    IS 'RBAC permissions including offerings management permissions';

CREATE TABLE IF NOT EXISTS public.pharmacies
(
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    ncpdp_id character varying(20) COLLATE pg_catalog."default",
    npi character varying(20) COLLATE pg_catalog."default",
    pharmacy_name character varying(255) COLLATE pg_catalog."default" NOT NULL,
    chain_name character varying(255) COLLATE pg_catalog."default",
    address_line1 character varying(255) COLLATE pg_catalog."default",
    address_line2 character varying(255) COLLATE pg_catalog."default",
    city character varying(100) COLLATE pg_catalog."default",
    state character varying(2) COLLATE pg_catalog."default",
    zip_code character varying(10) COLLATE pg_catalog."default",
    phone character varying(20) COLLATE pg_catalog."default",
    fax character varying(20) COLLATE pg_catalog."default",
    email character varying(255) COLLATE pg_catalog."default",
    website character varying(255) COLLATE pg_catalog."default",
    is_24_hours boolean DEFAULT false,
    accepts_erx boolean DEFAULT true,
    erx_endpoint_url character varying(500) COLLATE pg_catalog."default",
    erx_system_type character varying(50) COLLATE pg_catalog."default",
    delivery_available boolean DEFAULT false,
    drive_through boolean DEFAULT false,
    accepts_insurance boolean DEFAULT true,
    preferred_network boolean DEFAULT false,
    distance_miles numeric(10, 2),
    latitude numeric(10, 8),
    longitude numeric(11, 8),
    operating_hours jsonb,
    services jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pharmacies_pkey PRIMARY KEY (id),
    CONSTRAINT pharmacies_ncpdp_id_key UNIQUE (ncpdp_id)
);

COMMENT ON TABLE public.pharmacies
    IS 'Network of pharmacies that accept electronic prescriptions';

CREATE TABLE IF NOT EXISTS public.practices
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name character varying(255) COLLATE pg_catalog."default" NOT NULL,
    tax_id character varying(20) COLLATE pg_catalog."default",
    phone character varying(20) COLLATE pg_catalog."default",
    email character varying(255) COLLATE pg_catalog."default",
    address jsonb,
    plan_tier character varying(20) COLLATE pg_catalog."default" DEFAULT 'professional'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT practices_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.prescription_history
(
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    prescription_id uuid,
    action character varying(50) COLLATE pg_catalog."default" NOT NULL,
    action_by uuid,
    action_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    old_status character varying(50) COLLATE pg_catalog."default",
    new_status character varying(50) COLLATE pg_catalog."default",
    pharmacy_id uuid,
    fill_number integer,
    quantity_dispensed integer,
    pharmacist_name character varying(255) COLLATE pg_catalog."default",
    pharmacist_license character varying(50) COLLATE pg_catalog."default",
    notes text COLLATE pg_catalog."default",
    metadata jsonb,
    CONSTRAINT prescription_history_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE public.prescription_history
    IS 'Audit log of all prescription actions and fills';

CREATE TABLE IF NOT EXISTS public.prescriptions
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    patient_id uuid,
    provider_id uuid,
    appointment_id uuid,
    medication_name character varying(255) COLLATE pg_catalog."default" NOT NULL,
    dosage character varying(100) COLLATE pg_catalog."default" NOT NULL,
    frequency character varying(100) COLLATE pg_catalog."default" NOT NULL,
    duration character varying(100) COLLATE pg_catalog."default",
    instructions text COLLATE pg_catalog."default",
    refills integer DEFAULT 0,
    status character varying(50) COLLATE pg_catalog."default" DEFAULT 'Active'::character varying,
    prescribed_date date DEFAULT CURRENT_DATE,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    ndc_code character varying(20) COLLATE pg_catalog."default",
    drug_strength character varying(50) COLLATE pg_catalog."default",
    drug_form character varying(50) COLLATE pg_catalog."default",
    quantity integer,
    days_supply integer,
    daw_code integer DEFAULT 0,
    prior_auth_required boolean DEFAULT false,
    prior_auth_number character varying(50) COLLATE pg_catalog."default",
    pharmacy_id uuid,
    erx_message_id character varying(100) COLLATE pg_catalog."default",
    erx_status character varying(50) COLLATE pg_catalog."default" DEFAULT 'draft'::character varying,
    erx_sent_date timestamp without time zone,
    erx_response_date timestamp without time zone,
    erx_error_message text COLLATE pg_catalog."default",
    controlled_substance_class character varying(10) COLLATE pg_catalog."default",
    prescriber_dea_number character varying(20) COLLATE pg_catalog."default",
    diagnosis_code character varying(20) COLLATE pg_catalog."default",
    substitution_allowed boolean DEFAULT true,
    sig_code text COLLATE pg_catalog."default",
    notes_to_pharmacist text COLLATE pg_catalog."default",
    refills_remaining integer DEFAULT 0,
    last_filled_date date,
    cancelled_reason text COLLATE pg_catalog."default",
    cancelled_date timestamp without time zone,
    cancelled_by uuid,
    CONSTRAINT prescriptions_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE public.prescriptions
    IS 'Stores patient prescriptions with medication details';

CREATE TABLE IF NOT EXISTS public.provider_booking_config
(
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    provider_id uuid NOT NULL,
    booking_url_slug character varying(100) COLLATE pg_catalog."default",
    timezone character varying(100) COLLATE pg_catalog."default" DEFAULT 'UTC'::character varying,
    slot_interval_minutes integer DEFAULT 15,
    max_concurrent_bookings integer DEFAULT 1,
    allow_public_booking boolean DEFAULT true,
    require_patient_account boolean DEFAULT false,
    send_confirmation_email boolean DEFAULT true,
    send_reminder_email boolean DEFAULT true,
    reminder_hours_before integer DEFAULT 24,
    allow_cancellation boolean DEFAULT true,
    cancellation_hours_before integer DEFAULT 24,
    allow_rescheduling boolean DEFAULT true,
    reschedule_hours_before integer DEFAULT 24,
    booking_instructions text COLLATE pg_catalog."default",
    custom_fields jsonb DEFAULT '[]'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT provider_booking_config_pkey PRIMARY KEY (id),
    CONSTRAINT provider_booking_config_booking_url_slug_key UNIQUE (booking_url_slug),
    CONSTRAINT provider_booking_config_provider_id_key UNIQUE (provider_id)
);

COMMENT ON TABLE public.provider_booking_config
    IS 'Provider-specific booking settings and public booking URLs';

CREATE TABLE IF NOT EXISTS public.providers
(
    first_name character varying(100) COLLATE pg_catalog."default" NOT NULL,
    last_name character varying(100) COLLATE pg_catalog."default" NOT NULL,
    specialization character varying(100) COLLATE pg_catalog."default",
    email character varying(255) COLLATE pg_catalog."default",
    phone character varying(20) COLLATE pg_catalog."default",
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    user_id uuid,
    CONSTRAINT providers_pkey PRIMARY KEY (id),
    CONSTRAINT providers_email_unique UNIQUE (email)
);

COMMENT ON TABLE public.providers
    IS 'Provider records. Users with doctor role will have entries here. Users can have multiple roles.';

CREATE TABLE IF NOT EXISTS public.recurring_appointments
(
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    patient_id uuid NOT NULL,
    provider_id uuid NOT NULL,
    appointment_type_id uuid,
    recurrence_rule character varying(255) COLLATE pg_catalog."default" NOT NULL,
    start_date timestamp without time zone NOT NULL,
    end_date timestamp without time zone,
    duration_minutes integer NOT NULL,
    status character varying(50) COLLATE pg_catalog."default" DEFAULT 'active'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT recurring_appointments_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE public.recurring_appointments
    IS 'Manages recurring appointment series';

CREATE TABLE IF NOT EXISTS public.role_permissions
(
    role_id integer NOT NULL,
    permission_id integer NOT NULL,
    CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, permission_id)
);

COMMENT ON TABLE public.role_permissions
    IS 'Mapping between roles and their permissions';

CREATE TABLE IF NOT EXISTS public.roles
(
    id serial NOT NULL,
    name character varying(100) COLLATE pg_catalog."default" NOT NULL,
    display_name character varying(100) COLLATE pg_catalog."default" NOT NULL,
    description text COLLATE pg_catalog."default",
    is_system_role boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT roles_pkey PRIMARY KEY (id),
    CONSTRAINT roles_name_key UNIQUE (name)
);

COMMENT ON TABLE public.roles
    IS 'System and custom user roles';

CREATE TABLE IF NOT EXISTS public.service_categories
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name character varying(255) COLLATE pg_catalog."default" NOT NULL,
    description text COLLATE pg_catalog."default",
    icon character varying(100) COLLATE pg_catalog."default",
    color character varying(50) COLLATE pg_catalog."default",
    display_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT service_categories_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE public.service_categories
    IS 'Categories for organizing healthcare offerings';

CREATE TABLE IF NOT EXISTS public.social_auth
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid,
    patient_id uuid,
    provider character varying(20) COLLATE pg_catalog."default" NOT NULL,
    provider_user_id character varying(255) COLLATE pg_catalog."default" NOT NULL,
    access_token text COLLATE pg_catalog."default",
    refresh_token text COLLATE pg_catalog."default",
    token_expires_at timestamp without time zone,
    profile_data jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT social_auth_pkey PRIMARY KEY (id),
    CONSTRAINT social_auth_provider_provider_user_id_key UNIQUE (provider, provider_user_id)
);

CREATE TABLE IF NOT EXISTS public.subscription_plans
(
    id serial NOT NULL,
    name character varying(100) COLLATE pg_catalog."default" NOT NULL,
    display_name character varying(100) COLLATE pg_catalog."default" NOT NULL,
    description text COLLATE pg_catalog."default",
    price numeric(10, 2),
    billing_cycle character varying(20) COLLATE pg_catalog."default",
    max_users integer,
    max_patients integer,
    features jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT subscription_plans_pkey PRIMARY KEY (id),
    CONSTRAINT subscription_plans_name_key UNIQUE (name)
);

COMMENT ON TABLE public.subscription_plans
    IS 'Available subscription plans';

CREATE TABLE IF NOT EXISTS public.tasks
(
    id serial NOT NULL,
    title text COLLATE pg_catalog."default" NOT NULL,
    priority character varying(50) COLLATE pg_catalog."default" DEFAULT 'Medium'::character varying,
    due_date date,
    status character varying(50) COLLATE pg_catalog."default" DEFAULT 'Pending'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    description text COLLATE pg_catalog."default",
    CONSTRAINT tasks_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.telehealth_sessions
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    appointment_id uuid,
    patient_id uuid,
    provider_id uuid,
    session_status character varying(20) COLLATE pg_catalog."default" DEFAULT 'scheduled'::character varying,
    room_id character varying(100) COLLATE pg_catalog."default" NOT NULL,
    meeting_url text COLLATE pg_catalog."default",
    start_time timestamp without time zone,
    end_time timestamp without time zone,
    duration_minutes integer,
    recording_url text COLLATE pg_catalog."default",
    recording_enabled boolean DEFAULT false,
    participants jsonb DEFAULT '[]'::jsonb,
    session_notes text COLLATE pg_catalog."default",
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT telehealth_sessions_pkey PRIMARY KEY (id),
    CONSTRAINT telehealth_sessions_room_id_key UNIQUE (room_id)
);

CREATE TABLE IF NOT EXISTS public.user_role_history
(
    id serial NOT NULL,
    user_id uuid,
    old_role character varying(50) COLLATE pg_catalog."default",
    new_role character varying(50) COLLATE pg_catalog."default",
    changed_at timestamp without time zone DEFAULT now(),
    changed_by uuid,
    CONSTRAINT user_role_history_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.user_roles
(
    role_id integer NOT NULL,
    assigned_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    user_id uuid,
    assigned_by uuid
);

COMMENT ON TABLE public.user_roles
    IS 'Users can have multiple roles';

CREATE TABLE IF NOT EXISTS public.users
(
    name character varying(255) COLLATE pg_catalog."default",
    role character varying(100) COLLATE pg_catalog."default" DEFAULT 'user'::character varying,
    practice character varying(255) COLLATE pg_catalog."default",
    avatar character varying(10) COLLATE pg_catalog."default",
    email character varying(255) COLLATE pg_catalog."default",
    phone character varying(20) COLLATE pg_catalog."default",
    license character varying(50) COLLATE pg_catalog."default",
    specialty character varying(100) COLLATE pg_catalog."default",
    preferences jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    first_name character varying(100) COLLATE pg_catalog."default" NOT NULL,
    last_name character varying(100) COLLATE pg_catalog."default" NOT NULL,
    password_hash character varying(255) COLLATE pg_catalog."default",
    reset_token character varying(255) COLLATE pg_catalog."default",
    reset_token_expires timestamp without time zone,
    status character varying(20) COLLATE pg_catalog."default" DEFAULT 'active'::character varying,
    language character varying(10) COLLATE pg_catalog."default" DEFAULT 'en'::character varying,
    active_role character varying(100) COLLATE pg_catalog."default",
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    CONSTRAINT users_pkey PRIMARY KEY (id),
    CONSTRAINT users_email_key UNIQUE (email)
);

COMMENT ON COLUMN public.users.status
    IS 'User account status: active (can login), blocked (cannot login), pending (awaiting approval)';

COMMENT ON COLUMN public.users.language
    IS 'User preferred language (en, es, fr, etc.)';

COMMENT ON COLUMN public.users.active_role
    IS 'Currently active role when user has multiple roles';

ALTER TABLE IF EXISTS public.appointment_reminders
    ADD CONSTRAINT fk_appointment_reminders_appointment FOREIGN KEY (appointment_id)
    REFERENCES public.appointments (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_reminders_appointment
    ON public.appointment_reminders(appointment_id);


ALTER TABLE IF EXISTS public.appointment_type_config
    ADD CONSTRAINT fk_appointment_type_config_provider FOREIGN KEY (provider_id)
    REFERENCES public.providers (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_appointment_type_provider
    ON public.appointment_type_config(provider_id);


ALTER TABLE IF EXISTS public.appointment_waitlist
    ADD CONSTRAINT fk_appointment_waitlist_patient FOREIGN KEY (patient_id)
    REFERENCES public.patients (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_waitlist_patient
    ON public.appointment_waitlist(patient_id);


ALTER TABLE IF EXISTS public.appointment_waitlist
    ADD CONSTRAINT fk_appointment_waitlist_provider FOREIGN KEY (provider_id)
    REFERENCES public.providers (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_waitlist_provider
    ON public.appointment_waitlist(provider_id);


ALTER TABLE IF EXISTS public.appointment_waitlist
    ADD CONSTRAINT fk_appointment_waitlist_type FOREIGN KEY (appointment_type_id)
    REFERENCES public.appointment_type_config (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;


ALTER TABLE IF EXISTS public.appointments
    ADD CONSTRAINT appointments_offering_id_fkey FOREIGN KEY (offering_id)
    REFERENCES public.healthcare_offerings (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_appointments_offering
    ON public.appointments(offering_id);


ALTER TABLE IF EXISTS public.appointments
    ADD CONSTRAINT appointments_package_enrollment_id_fkey FOREIGN KEY (package_enrollment_id)
    REFERENCES public.patient_offering_enrollments (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;


ALTER TABLE IF EXISTS public.appointments
    ADD CONSTRAINT appointments_patient_id_fkey FOREIGN KEY (patient_id)
    REFERENCES public.patients (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
CREATE INDEX IF NOT EXISTS idx_appointments_patient
    ON public.appointments(patient_id);


ALTER TABLE IF EXISTS public.appointments
    ADD CONSTRAINT appointments_practice_id_fkey FOREIGN KEY (practice_id)
    REFERENCES public.practices (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;


ALTER TABLE IF EXISTS public.appointments
    ADD CONSTRAINT appointments_provider_id_fkey FOREIGN KEY (provider_id)
    REFERENCES public.providers (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_appointments_provider
    ON public.appointments(provider_id);


ALTER TABLE IF EXISTS public.appointments
    ADD CONSTRAINT fk_appointments_recurring FOREIGN KEY (recurring_appointment_id)
    REFERENCES public.recurring_appointments (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_appointments_recurring
    ON public.appointments(recurring_appointment_id);


ALTER TABLE IF EXISTS public.appointments
    ADD CONSTRAINT fk_appointments_rescheduled_from FOREIGN KEY (rescheduled_from)
    REFERENCES public.appointments (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;


ALTER TABLE IF EXISTS public.appointments
    ADD CONSTRAINT fk_appointments_type FOREIGN KEY (appointment_type_id)
    REFERENCES public.appointment_type_config (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_appointments_type
    ON public.appointments(appointment_type_id);


ALTER TABLE IF EXISTS public.booking_analytics
    ADD CONSTRAINT fk_booking_analytics_appointment FOREIGN KEY (appointment_id)
    REFERENCES public.appointments (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;


ALTER TABLE IF EXISTS public.booking_analytics
    ADD CONSTRAINT fk_booking_analytics_patient FOREIGN KEY (patient_id)
    REFERENCES public.patients (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;


ALTER TABLE IF EXISTS public.booking_analytics
    ADD CONSTRAINT fk_booking_analytics_provider FOREIGN KEY (provider_id)
    REFERENCES public.providers (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_analytics_provider
    ON public.booking_analytics(provider_id);


ALTER TABLE IF EXISTS public.booking_analytics
    ADD CONSTRAINT fk_booking_analytics_type FOREIGN KEY (appointment_type_id)
    REFERENCES public.appointment_type_config (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;


ALTER TABLE IF EXISTS public.claims
    ADD CONSTRAINT claims_patient_id_fkey FOREIGN KEY (patient_id)
    REFERENCES public.patients (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;


ALTER TABLE IF EXISTS public.claims
    ADD CONSTRAINT claims_practice_id_fkey FOREIGN KEY (practice_id)
    REFERENCES public.practices (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;


ALTER TABLE IF EXISTS public.diagnosis
    ADD CONSTRAINT diagnosis_appointment_id_fkey FOREIGN KEY (appointment_id)
    REFERENCES public.appointments (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;


ALTER TABLE IF EXISTS public.diagnosis
    ADD CONSTRAINT diagnosis_patient_id_fkey FOREIGN KEY (patient_id)
    REFERENCES public.patients (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_diagnosis_patient
    ON public.diagnosis(patient_id);


ALTER TABLE IF EXISTS public.doctor_availability
    ADD CONSTRAINT fk_doctor_availability_provider FOREIGN KEY (provider_id)
    REFERENCES public.providers (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_doctor_availability_provider
    ON public.doctor_availability(provider_id);


ALTER TABLE IF EXISTS public.doctor_time_off
    ADD CONSTRAINT fk_doctor_time_off_provider FOREIGN KEY (provider_id)
    REFERENCES public.providers (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_doctor_time_off_provider
    ON public.doctor_time_off(provider_id);


ALTER TABLE IF EXISTS public.erx_message_queue
    ADD CONSTRAINT erx_message_queue_pharmacy_id_fkey FOREIGN KEY (pharmacy_id)
    REFERENCES public.pharmacies (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
CREATE INDEX IF NOT EXISTS idx_erx_queue_pharmacy
    ON public.erx_message_queue(pharmacy_id);


ALTER TABLE IF EXISTS public.erx_message_queue
    ADD CONSTRAINT erx_message_queue_prescription_id_fkey FOREIGN KEY (prescription_id)
    REFERENCES public.prescriptions (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;


ALTER TABLE IF EXISTS public.fhir_resources
    ADD CONSTRAINT fhir_resources_patient_id_fkey FOREIGN KEY (patient_id)
    REFERENCES public.patients (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
CREATE INDEX IF NOT EXISTS idx_fhir_patient
    ON public.fhir_resources(patient_id);


ALTER TABLE IF EXISTS public.healthcare_offerings
    ADD CONSTRAINT healthcare_offerings_category_id_fkey FOREIGN KEY (category_id)
    REFERENCES public.service_categories (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_offerings_category
    ON public.healthcare_offerings(category_id);


ALTER TABLE IF EXISTS public.medical_records
    ADD CONSTRAINT medical_records_patient_id_fkey FOREIGN KEY (patient_id)
    REFERENCES public.patients (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
CREATE INDEX IF NOT EXISTS idx_medical_records_patient
    ON public.medical_records(patient_id);


ALTER TABLE IF EXISTS public.medication_alternatives
    ADD CONSTRAINT medication_alternatives_alternative_ndc_fkey FOREIGN KEY (alternative_ndc)
    REFERENCES public.medications (ndc_code) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;


ALTER TABLE IF EXISTS public.medication_alternatives
    ADD CONSTRAINT medication_alternatives_original_ndc_fkey FOREIGN KEY (original_ndc)
    REFERENCES public.medications (ndc_code) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;


ALTER TABLE IF EXISTS public.offering_insurance_mappings
    ADD CONSTRAINT offering_insurance_mappings_offering_id_fkey FOREIGN KEY (offering_id)
    REFERENCES public.healthcare_offerings (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_insurance_mappings_offering
    ON public.offering_insurance_mappings(offering_id);


ALTER TABLE IF EXISTS public.offering_packages
    ADD CONSTRAINT offering_packages_category_id_fkey FOREIGN KEY (category_id)
    REFERENCES public.service_categories (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;


ALTER TABLE IF EXISTS public.offering_pricing
    ADD CONSTRAINT offering_pricing_offering_id_fkey FOREIGN KEY (offering_id)
    REFERENCES public.healthcare_offerings (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_pricing_offering
    ON public.offering_pricing(offering_id);


ALTER TABLE IF EXISTS public.offering_reviews
    ADD CONSTRAINT offering_reviews_appointment_id_fkey FOREIGN KEY (appointment_id)
    REFERENCES public.appointments (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;


ALTER TABLE IF EXISTS public.offering_reviews
    ADD CONSTRAINT offering_reviews_offering_id_fkey FOREIGN KEY (offering_id)
    REFERENCES public.healthcare_offerings (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_reviews_offering
    ON public.offering_reviews(offering_id);


ALTER TABLE IF EXISTS public.offering_reviews
    ADD CONSTRAINT offering_reviews_patient_id_fkey FOREIGN KEY (patient_id)
    REFERENCES public.patients (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_reviews_patient
    ON public.offering_reviews(patient_id);


ALTER TABLE IF EXISTS public.organization_settings
    ADD CONSTRAINT organization_settings_current_plan_id_fkey FOREIGN KEY (current_plan_id)
    REFERENCES public.subscription_plans (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;


ALTER TABLE IF EXISTS public.package_offerings
    ADD CONSTRAINT package_offerings_offering_id_fkey FOREIGN KEY (offering_id)
    REFERENCES public.healthcare_offerings (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_package_offerings_offering
    ON public.package_offerings(offering_id);


ALTER TABLE IF EXISTS public.package_offerings
    ADD CONSTRAINT package_offerings_package_id_fkey FOREIGN KEY (package_id)
    REFERENCES public.offering_packages (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_package_offerings_package
    ON public.package_offerings(package_id);


ALTER TABLE IF EXISTS public.patient_allergies
    ADD CONSTRAINT patient_allergies_patient_id_fkey FOREIGN KEY (patient_id)
    REFERENCES public.patients (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_patient_allergies_patient
    ON public.patient_allergies(patient_id);


ALTER TABLE IF EXISTS public.patient_offering_enrollments
    ADD CONSTRAINT patient_offering_enrollments_offering_id_fkey FOREIGN KEY (offering_id)
    REFERENCES public.healthcare_offerings (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;


ALTER TABLE IF EXISTS public.patient_offering_enrollments
    ADD CONSTRAINT patient_offering_enrollments_package_id_fkey FOREIGN KEY (package_id)
    REFERENCES public.offering_packages (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;


ALTER TABLE IF EXISTS public.patient_offering_enrollments
    ADD CONSTRAINT patient_offering_enrollments_patient_id_fkey FOREIGN KEY (patient_id)
    REFERENCES public.patients (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_enrollments_patient
    ON public.patient_offering_enrollments(patient_id);


ALTER TABLE IF EXISTS public.patient_pharmacies
    ADD CONSTRAINT patient_pharmacies_patient_id_fkey FOREIGN KEY (patient_id)
    REFERENCES public.patients (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_patient_pharmacies_patient
    ON public.patient_pharmacies(patient_id);


ALTER TABLE IF EXISTS public.patient_pharmacies
    ADD CONSTRAINT patient_pharmacies_pharmacy_id_fkey FOREIGN KEY (pharmacy_id)
    REFERENCES public.pharmacies (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_patient_pharmacies_pharmacy
    ON public.patient_pharmacies(pharmacy_id);


ALTER TABLE IF EXISTS public.patient_portal_sessions
    ADD CONSTRAINT patient_portal_sessions_patient_id_fkey FOREIGN KEY (patient_id)
    REFERENCES public.patients (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
CREATE INDEX IF NOT EXISTS idx_portal_sessions_patient
    ON public.patient_portal_sessions(patient_id);


ALTER TABLE IF EXISTS public.patients
    ADD CONSTRAINT patients_practice_id_fkey FOREIGN KEY (practice_id)
    REFERENCES public.practices (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;


ALTER TABLE IF EXISTS public.patients
    ADD CONSTRAINT patients_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES public.users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_patients_user_id
    ON public.patients(user_id);


ALTER TABLE IF EXISTS public.payments
    ADD CONSTRAINT payments_claim_id_fkey FOREIGN KEY (claim_id)
    REFERENCES public.claims (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_payments_claim_id
    ON public.payments(claim_id);


ALTER TABLE IF EXISTS public.payments
    ADD CONSTRAINT payments_patient_id_fkey FOREIGN KEY (patient_id)
    REFERENCES public.patients (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_payments_patient_id
    ON public.payments(patient_id);


ALTER TABLE IF EXISTS public.prescription_history
    ADD CONSTRAINT prescription_history_pharmacy_id_fkey FOREIGN KEY (pharmacy_id)
    REFERENCES public.pharmacies (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
CREATE INDEX IF NOT EXISTS idx_prescription_history_pharmacy
    ON public.prescription_history(pharmacy_id);


ALTER TABLE IF EXISTS public.prescription_history
    ADD CONSTRAINT prescription_history_prescription_id_fkey FOREIGN KEY (prescription_id)
    REFERENCES public.prescriptions (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_prescription_history_prescription
    ON public.prescription_history(prescription_id);


ALTER TABLE IF EXISTS public.prescriptions
    ADD CONSTRAINT prescriptions_appointment_id_fkey FOREIGN KEY (appointment_id)
    REFERENCES public.appointments (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;


ALTER TABLE IF EXISTS public.prescriptions
    ADD CONSTRAINT prescriptions_patient_id_fkey FOREIGN KEY (patient_id)
    REFERENCES public.patients (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient
    ON public.prescriptions(patient_id);


ALTER TABLE IF EXISTS public.provider_booking_config
    ADD CONSTRAINT fk_provider_booking_config_provider FOREIGN KEY (provider_id)
    REFERENCES public.providers (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS provider_booking_config_provider_id_key
    ON public.provider_booking_config(provider_id);


ALTER TABLE IF EXISTS public.providers
    ADD CONSTRAINT providers_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES public.users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_providers_user_id
    ON public.providers(user_id);


ALTER TABLE IF EXISTS public.recurring_appointments
    ADD CONSTRAINT fk_recurring_appointments_patient FOREIGN KEY (patient_id)
    REFERENCES public.patients (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_recurring_appointments_patient
    ON public.recurring_appointments(patient_id);


ALTER TABLE IF EXISTS public.recurring_appointments
    ADD CONSTRAINT fk_recurring_appointments_provider FOREIGN KEY (provider_id)
    REFERENCES public.providers (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_recurring_appointments_provider
    ON public.recurring_appointments(provider_id);


ALTER TABLE IF EXISTS public.recurring_appointments
    ADD CONSTRAINT fk_recurring_appointments_type FOREIGN KEY (appointment_type_id)
    REFERENCES public.appointment_type_config (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;


ALTER TABLE IF EXISTS public.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id)
    REFERENCES public.permissions (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;


ALTER TABLE IF EXISTS public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id)
    REFERENCES public.roles (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id
    ON public.role_permissions(role_id);


ALTER TABLE IF EXISTS public.social_auth
    ADD CONSTRAINT social_auth_patient_id_fkey FOREIGN KEY (patient_id)
    REFERENCES public.patients (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
CREATE INDEX IF NOT EXISTS idx_social_auth_patient
    ON public.social_auth(patient_id);


ALTER TABLE IF EXISTS public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES public.users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;


ALTER TABLE IF EXISTS public.telehealth_sessions
    ADD CONSTRAINT telehealth_sessions_appointment_id_fkey FOREIGN KEY (appointment_id)
    REFERENCES public.appointments (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
CREATE INDEX IF NOT EXISTS idx_telehealth_appointment
    ON public.telehealth_sessions(appointment_id);


ALTER TABLE IF EXISTS public.telehealth_sessions
    ADD CONSTRAINT telehealth_sessions_patient_id_fkey FOREIGN KEY (patient_id)
    REFERENCES public.patients (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;


ALTER TABLE IF EXISTS public.user_roles
    ADD CONSTRAINT user_roles_assigned_by_fkey FOREIGN KEY (assigned_by)
    REFERENCES public.users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;


ALTER TABLE IF EXISTS public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id)
    REFERENCES public.roles (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id
    ON public.user_roles(role_id);


ALTER TABLE IF EXISTS public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES public.users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;


-- Telehealth Provider Settings
CREATE TABLE IF NOT EXISTS public.telehealth_provider_settings
(
    id serial NOT NULL,
    provider_type character varying(50) COLLATE pg_catalog."default" NOT NULL,
    is_enabled boolean DEFAULT false,
    api_key text COLLATE pg_catalog."default",
    api_secret text COLLATE pg_catalog."default",
    client_id text COLLATE pg_catalog."default",
    client_secret text COLLATE pg_catalog."default",
    webhook_secret text COLLATE pg_catalog."default",
    settings jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT telehealth_provider_settings_pkey PRIMARY KEY (id),
    CONSTRAINT telehealth_provider_settings_provider_type_key UNIQUE (provider_type)
);

COMMENT ON TABLE public.telehealth_provider_settings
    IS 'Settings for different telehealth providers (Zoom, Google Meet, Webex)';

-- Add provider_type column to telehealth_sessions if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'telehealth_sessions' AND column_name = 'provider_type'
    ) THEN
        ALTER TABLE public.telehealth_sessions
        ADD COLUMN provider_type character varying(50) DEFAULT 'medflow';
    END IF;
END $$;

-- WhatsApp notification settings (stored in organization_settings.settings JSONB)
-- Structure: {"whatsapp": {"enabled": true, "phone_number": "+1234567890", "api_key": "..."}}

-- Notification channels table for tracking patient notification preferences
CREATE TABLE IF NOT EXISTS public.notification_preferences
(
    id serial NOT NULL,
    patient_id uuid NOT NULL,
    channel_type character varying(20) COLLATE pg_catalog."default" NOT NULL,
    is_enabled boolean DEFAULT true,
    contact_info character varying(255) COLLATE pg_catalog."default",
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT notification_preferences_pkey PRIMARY KEY (id),
    CONSTRAINT notification_preferences_patient_channel_key UNIQUE (patient_id, channel_type),
    CONSTRAINT notification_preferences_patient_id_fkey FOREIGN KEY (patient_id)
        REFERENCES public.patients (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE
);

COMMENT ON TABLE public.notification_preferences
    IS 'Patient notification preferences for different channels (email, sms, whatsapp)';

CREATE INDEX IF NOT EXISTS idx_notification_preferences_patient
    ON public.notification_preferences(patient_id);

END;
