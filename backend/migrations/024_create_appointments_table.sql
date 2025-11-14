-- Migration: Create appointments table with proper schema
-- Description: Ensures appointments table exists with correct references to providers
-- This migration fixes the missing appointments table error

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. CREATE PROVIDERS TABLE IF IT DOESN'T EXIST
-- ============================================================================
CREATE TABLE IF NOT EXISTS providers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    specialization VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(20),
    license_number VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT providers_email_unique UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS idx_providers_user_id ON providers(user_id);

-- ============================================================================
-- 2. CREATE OR REPLACE APPOINTMENTS TABLE
-- ============================================================================
-- Drop the old appointments table if it exists with wrong schema
DO $$
BEGIN
    -- Check if appointments table exists and has provider_id referencing users
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'appointments'
        AND column_name = 'provider_id'
    ) AND EXISTS (
        SELECT 1
        FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu
            ON tc.constraint_name = ccu.constraint_name
        WHERE tc.table_name = 'appointments'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND ccu.table_name = 'users'
        AND ccu.column_name = 'id'
    ) THEN
        -- Drop the appointments table with wrong foreign key
        RAISE NOTICE 'Dropping old appointments table with incorrect schema...';
        DROP TABLE IF EXISTS appointments CASCADE;
    END IF;
END $$;

-- Create appointments table with correct schema
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    practice_id UUID,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    provider_id UUID REFERENCES providers(id) ON DELETE SET NULL,
    appointment_type VARCHAR(50),
    status VARCHAR(20) DEFAULT 'scheduled',
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    duration_minutes INTEGER,
    reason TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Additional fields from scheduling system
    appointment_type_id UUID,
    recurring_appointment_id UUID,
    timezone VARCHAR(100) DEFAULT 'UTC',
    booking_source VARCHAR(50) DEFAULT 'staff',
    confirmation_sent_at TIMESTAMP,
    reminder_sent_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    cancelled_by UUID,
    cancellation_reason TEXT,
    rescheduled_from UUID,
    no_show_notified_at TIMESTAMP,
    custom_form_data JSONB DEFAULT '{}',
    offering_id UUID,
    package_enrollment_id UUID
);

-- Create indexes for appointments table
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_provider ON appointments(provider_id);
CREATE INDEX IF NOT EXISTS idx_appointments_start_time ON appointments(start_time);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_type ON appointments(appointment_type_id);
CREATE INDEX IF NOT EXISTS idx_appointments_recurring ON appointments(recurring_appointment_id);
CREATE INDEX IF NOT EXISTS idx_appointments_booking_source ON appointments(booking_source);
CREATE INDEX IF NOT EXISTS idx_appointments_cancelled ON appointments(cancelled_at);

COMMENT ON TABLE appointments IS 'Patient appointments with healthcare providers';
COMMENT ON TABLE providers IS 'Healthcare providers - references users via user_id';

-- ============================================================================
-- 3. MIGRATE EXISTING USERS WITH DOCTOR ROLE TO PROVIDERS TABLE
-- ============================================================================
-- Insert doctors from users table into providers table if they don't exist
INSERT INTO providers (user_id, first_name, last_name, specialization, email, phone, license_number)
SELECT
    u.id,
    u.first_name,
    u.last_name,
    u.specialty,
    u.email,
    u.phone,
    u.license
FROM users u
WHERE u.role IN ('doctor', 'provider', 'admin')
AND NOT EXISTS (
    SELECT 1 FROM providers p WHERE p.user_id = u.id
)
ON CONFLICT (email) DO NOTHING;

-- ============================================================================
-- Success message
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '✓ Appointments table created successfully with proper provider references';
    RAISE NOTICE '✓ Providers table created and populated from users table';
END $$;
