-- Healthcare Offerings Management System
-- Migration: 018_create_healthcare_offerings.sql
-- Using UUID for all ID fields

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Service Categories Table
CREATE TABLE IF NOT EXISTS service_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    icon VARCHAR(100),
    color VARCHAR(50),
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Healthcare Offerings Table
CREATE TABLE IF NOT EXISTS healthcare_offerings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category_id UUID REFERENCES service_categories(id) ON DELETE SET NULL,

    -- Service Details
    duration_minutes INTEGER,
    requires_preparation BOOLEAN DEFAULT false,
    preparation_instructions TEXT,

    -- Availability
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    available_online BOOLEAN DEFAULT true,
    requires_referral BOOLEAN DEFAULT false,

    -- Clinical Information
    cpt_codes TEXT[], -- Array of CPT codes
    icd_codes TEXT[], -- Array of ICD-10 codes
    hcpcs_codes TEXT[], -- Array of HCPCS codes

    -- Constraints and Requirements
    min_age INTEGER,
    max_age INTEGER,
    gender_restriction VARCHAR(20), -- 'male', 'female', 'any'
    contraindications TEXT,
    prerequisites TEXT,

    -- Provider Assignment
    allowed_provider_specializations TEXT[], -- Array of specializations

    -- Metadata
    image_url TEXT,
    video_url TEXT,
    brochure_url TEXT,
    consent_form_required BOOLEAN DEFAULT false,
    consent_form_url TEXT,

    -- SEO and Marketing
    seo_title VARCHAR(255),
    seo_description TEXT,
    seo_keywords TEXT[],

    -- Tracking
    view_count INTEGER DEFAULT 0,
    booking_count INTEGER DEFAULT 0,

    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Offering Packages Table (Bundled Services)
CREATE TABLE IF NOT EXISTS offering_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category_id UUID REFERENCES service_categories(id) ON DELETE SET NULL,

    -- Package Details
    package_type VARCHAR(50) DEFAULT 'bundle', -- 'bundle', 'membership', 'subscription'
    validity_days INTEGER, -- How long the package is valid
    max_uses INTEGER, -- Max number of times services can be used

    -- Pricing
    base_price DECIMAL(10, 2),
    discount_percentage DECIMAL(5, 2),
    final_price DECIMAL(10, 2),

    -- Availability
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    available_from DATE,
    available_until DATE,

    -- Benefits and Features
    benefits TEXT[],
    features TEXT[],

    -- Metadata
    image_url TEXT,
    terms_and_conditions TEXT,

    -- Tracking
    enrollment_count INTEGER DEFAULT 0,

    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Package Offerings Junction Table
CREATE TABLE IF NOT EXISTS package_offerings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id UUID REFERENCES offering_packages(id) ON DELETE CASCADE,
    offering_id UUID REFERENCES healthcare_offerings(id) ON DELETE CASCADE,

    -- Quantity and Limits
    quantity_included INTEGER DEFAULT 1, -- How many times this service is included
    is_optional BOOLEAN DEFAULT false,
    display_order INTEGER DEFAULT 0,

    -- Pricing Override
    price_override DECIMAL(10, 2), -- Optional custom price for this service in the package

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(package_id, offering_id)
);

-- 5. Offering Pricing Table (Multiple pricing tiers)
CREATE TABLE IF NOT EXISTS offering_pricing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offering_id UUID REFERENCES healthcare_offerings(id) ON DELETE CASCADE,

    -- Pricing Type
    pricing_type VARCHAR(50) NOT NULL, -- 'cash', 'insurance', 'membership', 'discounted'
    pricing_name VARCHAR(255), -- e.g., "Medicare", "Blue Cross", "Cash Price"

    -- Price Details
    base_price DECIMAL(10, 2) NOT NULL,
    discount_percentage DECIMAL(5, 2) DEFAULT 0,
    final_price DECIMAL(10, 2),

    -- Insurance Specific
    insurance_provider VARCHAR(255),
    copay_amount DECIMAL(10, 2),
    requires_preauthorization BOOLEAN DEFAULT false,

    -- Validity
    effective_from DATE,
    effective_until DATE,
    is_active BOOLEAN DEFAULT true,

    -- Additional Costs
    additional_fees JSONB, -- {lab_fee: 50, facility_fee: 100}

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Patient Offering Enrollments Table
CREATE TABLE IF NOT EXISTS patient_offering_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,

    -- Package or Single Offering
    package_id UUID REFERENCES offering_packages(id) ON DELETE SET NULL,
    offering_id UUID REFERENCES healthcare_offerings(id) ON DELETE SET NULL,

    -- Enrollment Details
    enrollment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expiry_date DATE,
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'used', 'expired', 'cancelled'

    -- Usage Tracking
    total_allowed_uses INTEGER DEFAULT 1,
    used_count INTEGER DEFAULT 0,
    remaining_uses INTEGER,

    -- Payment
    amount_paid DECIMAL(10, 2),
    payment_method VARCHAR(50),
    payment_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'completed', 'refunded'
    payment_id UUID, -- FK constraint added in migration 020 after payments conversion

    -- Notes
    notes TEXT,
    cancellation_reason TEXT,
    cancelled_at TIMESTAMP,
    cancelled_by UUID REFERENCES users(id) ON DELETE SET NULL,

    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Offering Insurance Mappings Table
CREATE TABLE IF NOT EXISTS offering_insurance_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offering_id UUID REFERENCES healthcare_offerings(id) ON DELETE CASCADE,
    insurance_provider VARCHAR(255) NOT NULL,
    insurance_plan VARCHAR(255),

    -- Coverage Details
    is_covered BOOLEAN DEFAULT true,
    coverage_percentage DECIMAL(5, 2),
    copay_amount DECIMAL(10, 2),
    deductible_applies BOOLEAN DEFAULT false,

    -- Authorization
    requires_preauthorization BOOLEAN DEFAULT false,
    preauth_phone VARCHAR(50),
    preauth_instructions TEXT,

    -- Billing Codes
    primary_cpt_code VARCHAR(20),
    modifier_codes TEXT[],
    diagnosis_codes_required TEXT[],

    -- Notes
    coverage_notes TEXT,
    billing_notes TEXT,

    -- Status
    is_active BOOLEAN DEFAULT true,
    effective_from DATE,
    effective_until DATE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. Offering Reviews and Ratings Table
CREATE TABLE IF NOT EXISTS offering_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offering_id UUID REFERENCES healthcare_offerings(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,

    -- Review Details
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,

    -- Moderation
    is_approved BOOLEAN DEFAULT false,
    is_featured BOOLEAN DEFAULT false,
    moderated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    moderated_at TIMESTAMP,

    -- Response
    provider_response TEXT,
    response_date TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(offering_id, patient_id, appointment_id)
);

-- 9. Offering Promotions Table
CREATE TABLE IF NOT EXISTS offering_promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    promo_code VARCHAR(50) UNIQUE,

    -- Discount Details
    discount_type VARCHAR(20), -- 'percentage', 'fixed_amount', 'bundle_deal'
    discount_value DECIMAL(10, 2),

    -- Applicability
    applicable_to VARCHAR(20) DEFAULT 'all', -- 'all', 'offerings', 'packages'
    offering_ids UUID[], -- Specific offerings
    package_ids UUID[], -- Specific packages
    category_ids UUID[], -- Specific categories

    -- Validity
    valid_from TIMESTAMP,
    valid_until TIMESTAMP,
    max_uses INTEGER,
    max_uses_per_patient INTEGER DEFAULT 1,
    current_uses INTEGER DEFAULT 0,

    -- Conditions
    min_purchase_amount DECIMAL(10, 2),
    new_patients_only BOOLEAN DEFAULT false,

    -- Status
    is_active BOOLEAN DEFAULT true,

    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 10. Link Offerings to Appointments (extend appointments table)
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS offering_id UUID REFERENCES healthcare_offerings(id) ON DELETE SET NULL;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS package_enrollment_id UUID REFERENCES patient_offering_enrollments(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_offerings_category ON healthcare_offerings(category_id);
CREATE INDEX IF NOT EXISTS idx_offerings_active ON healthcare_offerings(is_active);
CREATE INDEX IF NOT EXISTS idx_offerings_featured ON healthcare_offerings(is_featured);
CREATE INDEX IF NOT EXISTS idx_package_offerings_package ON package_offerings(package_id);
CREATE INDEX IF NOT EXISTS idx_package_offerings_offering ON package_offerings(offering_id);
CREATE INDEX IF NOT EXISTS idx_pricing_offering ON offering_pricing(offering_id);
CREATE INDEX IF NOT EXISTS idx_pricing_type ON offering_pricing(pricing_type);
CREATE INDEX IF NOT EXISTS idx_enrollments_patient ON patient_offering_enrollments(patient_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON patient_offering_enrollments(status);
CREATE INDEX IF NOT EXISTS idx_insurance_mappings_offering ON offering_insurance_mappings(offering_id);
CREATE INDEX IF NOT EXISTS idx_reviews_offering ON offering_reviews(offering_id);
CREATE INDEX IF NOT EXISTS idx_reviews_patient ON offering_reviews(patient_id);
CREATE INDEX IF NOT EXISTS idx_promotions_code ON offering_promotions(promo_code);
CREATE INDEX IF NOT EXISTS idx_promotions_active ON offering_promotions(is_active);
CREATE INDEX IF NOT EXISTS idx_appointments_offering ON appointments(offering_id);

-- Insert default service categories
INSERT INTO service_categories (name, description, icon, color, display_order) VALUES
('Preventive Care', 'Annual checkups, screenings, and preventive health services', 'Shield', '#10B981', 1),
('Primary Care', 'General medical consultations and family practice', 'Stethoscope', '#3B82F6', 2),
('Specialty Care', 'Specialized medical consultations and treatments', 'UserCog', '#8B5CF6', 3),
('Diagnostics', 'Laboratory tests, imaging, and diagnostic procedures', 'Activity', '#F59E0B', 4),
('Vaccinations', 'Immunizations and vaccines for all ages', 'Syringe', '#EF4444', 5),
('Chronic Care', 'Ongoing management of chronic conditions', 'Heart', '#EC4899', 6),
('Mental Health', 'Psychological counseling and psychiatric services', 'Brain', '#06B6D4', 7),
('Women''s Health', 'Obstetrics, gynecology, and women''s wellness', 'Baby', '#F97316', 8),
('Pediatrics', 'Child and adolescent healthcare services', 'Users', '#14B8A6', 9),
('Telehealth', 'Virtual consultations and remote monitoring', 'Video', '#6366F1', 10)
ON CONFLICT DO NOTHING;

-- Get category UUIDs for sample data
DO $$
DECLARE
    preventive_care_id UUID;
    pediatrics_id UUID;
    vaccinations_id UUID;
    chronic_care_id UUID;
    mental_health_id UUID;
    preventive_care_id UUID;
    telehealth_id UUID;

    physical_exam_id UUID;
    well_child_id UUID;
    covid_vax_id UUID;
    flu_shot_id UUID;
    diabetes_consult_id UUID;
    mental_health_consult_id UUID;
    bp_check_id UUID;
    telehealth_consult_id UUID;

    wellness_pkg_id UUID;
    diabetes_pkg_id UUID;
BEGIN
    -- Get category IDs
    SELECT id INTO preventive_care_id FROM service_categories WHERE name = 'Preventive Care';
    SELECT id INTO pediatrics_id FROM service_categories WHERE name = 'Pediatrics';
    SELECT id INTO vaccinations_id FROM service_categories WHERE name = 'Vaccinations';
    SELECT id INTO chronic_care_id FROM service_categories WHERE name = 'Chronic Care';
    SELECT id INTO mental_health_id FROM service_categories WHERE name = 'Mental Health';
    SELECT id INTO telehealth_id FROM service_categories WHERE name = 'Telehealth';

    -- Insert sample healthcare offerings
    INSERT INTO healthcare_offerings (name, description, category_id, duration_minutes, cpt_codes, is_active, is_featured) VALUES
    ('Annual Physical Exam', 'Comprehensive annual health checkup including vitals, physical examination, and preventive care counseling', preventive_care_id, 60, ARRAY['99385', '99386'], true, true),
    ('Well-Child Visit', 'Pediatric wellness examination with developmental assessment and immunization review', pediatrics_id, 45, ARRAY['99381', '99382'], true, true),
    ('COVID-19 Vaccination', 'COVID-19 vaccine administration with observation period', vaccinations_id, 30, ARRAY['91300', '0001A'], true, false),
    ('Flu Shot', 'Seasonal influenza vaccination', vaccinations_id, 15, ARRAY['90686', '90688'], true, true),
    ('Diabetes Management Consultation', 'Comprehensive diabetes care visit with A1C review and treatment adjustment', chronic_care_id, 45, ARRAY['99214', '99215'], true, false),
    ('Mental Health Consultation', 'Initial psychiatric evaluation and treatment planning', mental_health_id, 60, ARRAY['90792'], true, true),
    ('Blood Pressure Check', 'Quick blood pressure screening and assessment', preventive_care_id, 15, ARRAY['99211'], true, false),
    ('Telehealth Consultation', 'Virtual video consultation with healthcare provider', telehealth_id, 30, ARRAY['99213', '95'], true, true)
    RETURNING id INTO physical_exam_id;

    -- Get offering IDs for pricing
    SELECT id INTO physical_exam_id FROM healthcare_offerings WHERE name = 'Annual Physical Exam';
    SELECT id INTO well_child_id FROM healthcare_offerings WHERE name = 'Well-Child Visit';
    SELECT id INTO covid_vax_id FROM healthcare_offerings WHERE name = 'COVID-19 Vaccination';
    SELECT id INTO flu_shot_id FROM healthcare_offerings WHERE name = 'Flu Shot';
    SELECT id INTO diabetes_consult_id FROM healthcare_offerings WHERE name = 'Diabetes Management Consultation';
    SELECT id INTO mental_health_consult_id FROM healthcare_offerings WHERE name = 'Mental Health Consultation';
    SELECT id INTO bp_check_id FROM healthcare_offerings WHERE name = 'Blood Pressure Check';
    SELECT id INTO telehealth_consult_id FROM healthcare_offerings WHERE name = 'Telehealth Consultation';

    -- Insert sample offering pricing
    INSERT INTO offering_pricing (offering_id, pricing_type, pricing_name, base_price, final_price, is_active) VALUES
    (physical_exam_id, 'cash', 'Cash Price', 250.00, 250.00, true),
    (physical_exam_id, 'insurance', 'Medicare', 250.00, 0.00, true),
    (physical_exam_id, 'insurance', 'Blue Cross Blue Shield', 250.00, 25.00, true),
    (well_child_id, 'cash', 'Cash Price', 200.00, 200.00, true),
    (covid_vax_id, 'cash', 'Cash Price', 0.00, 0.00, true),
    (flu_shot_id, 'cash', 'Cash Price', 35.00, 35.00, true),
    (diabetes_consult_id, 'cash', 'Cash Price', 180.00, 180.00, true),
    (mental_health_consult_id, 'cash', 'Cash Price', 300.00, 300.00, true),
    (bp_check_id, 'cash', 'Cash Price', 25.00, 25.00, true),
    (telehealth_consult_id, 'cash', 'Cash Price', 100.00, 100.00, true);

    -- Insert sample packages
    INSERT INTO offering_packages (name, description, category_id, package_type, validity_days, base_price, discount_percentage, final_price, benefits, is_active, is_featured) VALUES
    ('Annual Wellness Package', 'Complete annual wellness package including physical exam, labs, and vaccinations', preventive_care_id, 'bundle', 365, 500.00, 15.00, 425.00,
    ARRAY['Annual Physical Exam', 'Complete Blood Count', 'Lipid Panel', 'Flu Vaccination', '24/7 Nurse Hotline Access'], true, true),
    ('Diabetes Care Package', 'Comprehensive 6-month diabetes management program', chronic_care_id, 'subscription', 180, 1200.00, 20.00, 960.00,
    ARRAY['Quarterly Diabetes Consultations', 'Monthly A1C Testing', 'Nutrition Counseling', 'Foot Care Examination', 'Retinal Screening'], true, true)
    RETURNING id INTO wellness_pkg_id;

    -- Get package IDs
    SELECT id INTO wellness_pkg_id FROM offering_packages WHERE name = 'Annual Wellness Package';
    SELECT id INTO diabetes_pkg_id FROM offering_packages WHERE name = 'Diabetes Care Package';

    -- Insert package offerings relationships
    INSERT INTO package_offerings (package_id, offering_id, quantity_included, display_order) VALUES
    (wellness_pkg_id, physical_exam_id, 1, 1), -- Annual Physical in Wellness Package
    (wellness_pkg_id, flu_shot_id, 1, 2), -- Flu Shot in Wellness Package
    (diabetes_pkg_id, diabetes_consult_id, 3, 1); -- 3 Diabetes consultations in Diabetes Package
END $$;

-- Create trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_offerings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_service_categories_updated_at BEFORE UPDATE ON service_categories
    FOR EACH ROW EXECUTE FUNCTION update_offerings_updated_at();

CREATE TRIGGER update_healthcare_offerings_updated_at BEFORE UPDATE ON healthcare_offerings
    FOR EACH ROW EXECUTE FUNCTION update_offerings_updated_at();

CREATE TRIGGER update_offering_packages_updated_at BEFORE UPDATE ON offering_packages
    FOR EACH ROW EXECUTE FUNCTION update_offerings_updated_at();

CREATE TRIGGER update_offering_pricing_updated_at BEFORE UPDATE ON offering_pricing
    FOR EACH ROW EXECUTE FUNCTION update_offerings_updated_at();

CREATE TRIGGER update_patient_offering_enrollments_updated_at BEFORE UPDATE ON patient_offering_enrollments
    FOR EACH ROW EXECUTE FUNCTION update_offerings_updated_at();

CREATE TRIGGER update_offering_insurance_mappings_updated_at BEFORE UPDATE ON offering_insurance_mappings
    FOR EACH ROW EXECUTE FUNCTION update_offerings_updated_at();

CREATE TRIGGER update_offering_reviews_updated_at BEFORE UPDATE ON offering_reviews
    FOR EACH ROW EXECUTE FUNCTION update_offerings_updated_at();

CREATE TRIGGER update_offering_promotions_updated_at BEFORE UPDATE ON offering_promotions
    FOR EACH ROW EXECUTE FUNCTION update_offerings_updated_at();

COMMENT ON TABLE service_categories IS 'Categories for organizing healthcare offerings';
COMMENT ON TABLE healthcare_offerings IS 'Individual medical services and procedures available to patients';
COMMENT ON TABLE offering_packages IS 'Bundled healthcare service packages and memberships';
COMMENT ON TABLE package_offerings IS 'Junction table linking packages to individual offerings';
COMMENT ON TABLE offering_pricing IS 'Multiple pricing tiers for offerings (cash, insurance, membership)';
COMMENT ON TABLE patient_offering_enrollments IS 'Track patient enrollments in packages and offerings';
COMMENT ON TABLE offering_insurance_mappings IS 'Insurance coverage details for specific offerings';
COMMENT ON TABLE offering_reviews IS 'Patient reviews and ratings for healthcare offerings';
COMMENT ON TABLE offering_promotions IS 'Promotional campaigns and discount codes for offerings';
