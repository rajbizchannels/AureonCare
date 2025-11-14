-- Migration: Merge providers.id with users.id
-- Description: Make providers.id directly reference users.id (removes user_id column)
-- This matches the pattern used in the patients table where patient.id = user.id

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. DROP AND RECREATE PROVIDERS TABLE WITH CORRECT SCHEMA
-- ============================================================================

-- Store existing provider data before dropping the table
DO $$
DECLARE
    has_providers BOOLEAN;
BEGIN
    -- Check if providers table exists and has data
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name = 'providers'
    ) INTO has_providers;

    IF has_providers THEN
        -- Create temporary table to store provider data
        CREATE TEMP TABLE IF NOT EXISTS temp_providers AS
        SELECT
            COALESCE(user_id, id) as user_id,
            first_name,
            last_name,
            specialization,
            email,
            phone,
            license_number,
            created_at,
            updated_at
        FROM providers;

        RAISE NOTICE 'Backed up existing providers data';
    END IF;
END $$;

-- Drop dependent objects first
DROP TABLE IF EXISTS doctor_availability CASCADE;
DROP TABLE IF EXISTS doctor_time_off CASCADE;
DROP TABLE IF EXISTS provider_booking_config CASCADE;
DROP TABLE IF EXISTS recurring_appointments CASCADE;
DROP TABLE IF EXISTS appointment_reminders CASCADE;
DROP TABLE IF EXISTS booking_analytics CASCADE;
DROP TABLE IF EXISTS appointment_waitlist CASCADE;
DROP TABLE IF EXISTS appointment_type_config CASCADE;

-- Drop appointments table (we'll recreate it)
DROP TABLE IF EXISTS appointments CASCADE;

-- Drop the old providers table
DROP TABLE IF EXISTS providers CASCADE;

-- Create new providers table where id = user_id (references users.id directly)
CREATE TABLE providers (
    id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
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

COMMENT ON TABLE providers IS 'Provider records. id directly references users.id (provider IS a user). Users can have multiple roles.';
COMMENT ON COLUMN providers.id IS 'Primary key - references users.id directly (provider IS a user)';

-- ============================================================================
-- 2. RESTORE PROVIDER DATA
-- ============================================================================

-- Restore providers from temp table
INSERT INTO providers (id, first_name, last_name, specialization, email, phone, license_number, created_at, updated_at)
SELECT
    user_id as id,
    first_name,
    last_name,
    specialization,
    email,
    phone,
    license_number,
    created_at,
    updated_at
FROM temp_providers
WHERE user_id IS NOT NULL
ON CONFLICT (id) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    specialization = EXCLUDED.specialization,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    license_number = EXCLUDED.license_number;

-- Add any users with doctor/provider/admin roles who aren't in providers yet
INSERT INTO providers (id, first_name, last_name, specialization, email, phone, license_number)
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
AND NOT EXISTS (SELECT 1 FROM providers p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 3. RECREATE APPOINTMENTS TABLE WITH CORRECT FOREIGN KEY
-- ============================================================================

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

COMMENT ON TABLE appointments IS 'Patient appointments with healthcare providers';

-- ============================================================================
-- 4. RECREATE SCHEDULING SYSTEM TABLES
-- ============================================================================

-- Doctor Availability
CREATE TABLE IF NOT EXISTS doctor_availability (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_available BOOLEAN DEFAULT true,
    timezone VARCHAR(100) DEFAULT 'UTC',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_time_order CHECK (end_time > start_time)
);

COMMENT ON TABLE doctor_availability IS 'Stores doctor weekly availability schedule (working hours)';

-- Doctor Time Off
CREATE TABLE IF NOT EXISTS doctor_time_off (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    reason VARCHAR(500),
    is_recurring BOOLEAN DEFAULT false,
    recurrence_rule VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_date_order CHECK (end_date >= start_date)
);

COMMENT ON TABLE doctor_time_off IS 'Tracks doctor time-off, vacations, and schedule exceptions';

-- Appointment Type Configuration
CREATE TABLE IF NOT EXISTS appointment_type_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_id UUID REFERENCES providers(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    buffer_minutes INTEGER DEFAULT 0,
    color VARCHAR(20) DEFAULT '#3B82F6',
    price NUMERIC(10, 2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT true,
    requires_approval BOOLEAN DEFAULT false,
    max_advance_booking_days INTEGER DEFAULT 90,
    min_advance_booking_hours INTEGER DEFAULT 24,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE appointment_type_config IS 'Defines available appointment types with duration and pricing';

-- Provider Booking Config
CREATE TABLE IF NOT EXISTS provider_booking_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_id UUID UNIQUE NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    booking_url_slug VARCHAR(100) UNIQUE,
    timezone VARCHAR(100) DEFAULT 'UTC',
    slot_interval_minutes INTEGER DEFAULT 15,
    max_concurrent_bookings INTEGER DEFAULT 1,
    allow_public_booking BOOLEAN DEFAULT true,
    require_patient_account BOOLEAN DEFAULT false,
    send_confirmation_email BOOLEAN DEFAULT true,
    send_reminder_email BOOLEAN DEFAULT true,
    reminder_hours_before INTEGER DEFAULT 24,
    allow_cancellation BOOLEAN DEFAULT true,
    cancellation_hours_before INTEGER DEFAULT 24,
    allow_rescheduling BOOLEAN DEFAULT true,
    reschedule_hours_before INTEGER DEFAULT 24,
    booking_instructions TEXT,
    custom_fields JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE provider_booking_config IS 'Provider-specific booking settings and public booking URLs';

-- Recurring Appointments
CREATE TABLE IF NOT EXISTS recurring_appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    appointment_type_id UUID REFERENCES appointment_type_config(id) ON DELETE SET NULL,
    recurrence_rule VARCHAR(255) NOT NULL,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP,
    duration_minutes INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE recurring_appointments IS 'Manages recurring appointment series';

-- Appointment Waitlist
CREATE TABLE IF NOT EXISTS appointment_waitlist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    appointment_type_id UUID REFERENCES appointment_type_config(id) ON DELETE CASCADE,
    preferred_date_start DATE NOT NULL,
    preferred_date_end DATE NOT NULL,
    preferred_time_start TIME,
    preferred_time_end TIME,
    notes TEXT,
    status VARCHAR(50) DEFAULT 'waiting',
    notified_at TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE appointment_waitlist IS 'Queue system for patients waiting for fully booked slots';

-- Appointment Reminders
CREATE TABLE IF NOT EXISTS appointment_reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    reminder_type VARCHAR(50) NOT NULL,
    scheduled_for TIMESTAMP NOT NULL,
    sent_at TIMESTAMP,
    delivery_status VARCHAR(50) DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE appointment_reminders IS 'Tracks scheduled appointment reminders (email/SMS)';

-- Booking Analytics
CREATE TABLE IF NOT EXISTS booking_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_id UUID REFERENCES providers(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    appointment_type_id UUID REFERENCES appointment_type_config(id) ON DELETE SET NULL,
    patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
    session_id VARCHAR(100),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE booking_analytics IS 'Booking funnel analytics for insights and reporting';

-- ============================================================================
-- 5. ADD FOREIGN KEY CONSTRAINTS TO APPOINTMENTS
-- ============================================================================

ALTER TABLE appointments
DROP CONSTRAINT IF EXISTS fk_appointments_type;

ALTER TABLE appointments
ADD CONSTRAINT fk_appointments_type
FOREIGN KEY (appointment_type_id) REFERENCES appointment_type_config(id) ON DELETE SET NULL;

ALTER TABLE appointments
DROP CONSTRAINT IF EXISTS fk_appointments_recurring;

ALTER TABLE appointments
ADD CONSTRAINT fk_appointments_recurring
FOREIGN KEY (recurring_appointment_id) REFERENCES recurring_appointments(id) ON DELETE SET NULL;

ALTER TABLE appointments
DROP CONSTRAINT IF EXISTS fk_appointments_rescheduled_from;

ALTER TABLE appointments
ADD CONSTRAINT fk_appointments_rescheduled_from
FOREIGN KEY (rescheduled_from) REFERENCES appointments(id) ON DELETE SET NULL;

-- ============================================================================
-- 6. CREATE INDEXES
-- ============================================================================

-- Appointments indexes
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_provider ON appointments(provider_id);
CREATE INDEX IF NOT EXISTS idx_appointments_start_time ON appointments(start_time);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_type ON appointments(appointment_type_id);
CREATE INDEX IF NOT EXISTS idx_appointments_recurring ON appointments(recurring_appointment_id);
CREATE INDEX IF NOT EXISTS idx_appointments_booking_source ON appointments(booking_source);
CREATE INDEX IF NOT EXISTS idx_appointments_cancelled ON appointments(cancelled_at);

-- Doctor availability indexes
CREATE INDEX IF NOT EXISTS idx_doctor_availability_provider ON doctor_availability(provider_id);
CREATE INDEX IF NOT EXISTS idx_doctor_availability_day ON doctor_availability(day_of_week);

-- Doctor time off indexes
CREATE INDEX IF NOT EXISTS idx_doctor_time_off_provider ON doctor_time_off(provider_id);
CREATE INDEX IF NOT EXISTS idx_doctor_time_off_dates ON doctor_time_off(start_date, end_date);

-- Appointment type config indexes
CREATE INDEX IF NOT EXISTS idx_appointment_type_provider ON appointment_type_config(provider_id);
CREATE INDEX IF NOT EXISTS idx_appointment_type_active ON appointment_type_config(is_active);

-- Provider booking config indexes
CREATE INDEX IF NOT EXISTS idx_booking_config_url ON provider_booking_config(booking_url_slug);
CREATE INDEX IF NOT EXISTS idx_booking_config_provider ON provider_booking_config(provider_id);

-- Recurring appointments indexes
CREATE INDEX IF NOT EXISTS idx_recurring_appointments_patient ON recurring_appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_recurring_appointments_provider ON recurring_appointments(provider_id);
CREATE INDEX IF NOT EXISTS idx_recurring_appointments_status ON recurring_appointments(status);

-- Appointment waitlist indexes
CREATE INDEX IF NOT EXISTS idx_waitlist_patient ON appointment_waitlist(patient_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_provider ON appointment_waitlist(provider_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_status ON appointment_waitlist(status);
CREATE INDEX IF NOT EXISTS idx_waitlist_dates ON appointment_waitlist(preferred_date_start, preferred_date_end);

-- Appointment reminders indexes
CREATE INDEX IF NOT EXISTS idx_reminders_appointment ON appointment_reminders(appointment_id);
CREATE INDEX IF NOT EXISTS idx_reminders_scheduled ON appointment_reminders(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_reminders_status ON appointment_reminders(delivery_status);

-- Booking analytics indexes
CREATE INDEX IF NOT EXISTS idx_analytics_provider ON booking_analytics(provider_id);
CREATE INDEX IF NOT EXISTS idx_analytics_event ON booking_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_created ON booking_analytics(created_at);

-- ============================================================================
-- 7. CREATE HELPER FUNCTIONS
-- ============================================================================

-- Function to check if a time slot is available
CREATE OR REPLACE FUNCTION is_slot_available(
    p_provider_id UUID,
    p_start_time TIMESTAMP,
    p_end_time TIMESTAMP
) RETURNS BOOLEAN AS $$
DECLARE
    conflict_count INTEGER;
    time_off_count INTEGER;
BEGIN
    -- Check for conflicting appointments
    SELECT COUNT(*) INTO conflict_count
    FROM appointments
    WHERE provider_id = p_provider_id
      AND status NOT IN ('cancelled', 'no-show')
      AND (
          (start_time <= p_start_time AND end_time > p_start_time) OR
          (start_time < p_end_time AND end_time >= p_end_time) OR
          (start_time >= p_start_time AND end_time <= p_end_time)
      );

    -- Check for time-off periods
    SELECT COUNT(*) INTO time_off_count
    FROM doctor_time_off
    WHERE provider_id = p_provider_id
      AND (
          (start_date <= p_start_time AND end_date > p_start_time) OR
          (start_date < p_end_time AND end_date >= p_end_time) OR
          (start_date >= p_start_time AND end_date <= p_end_time)
      );

    RETURN (conflict_count = 0 AND time_off_count = 0);
END;
$$ LANGUAGE plpgsql;

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at columns
DROP TRIGGER IF EXISTS update_providers_updated_at ON providers;
CREATE TRIGGER update_providers_updated_at BEFORE UPDATE ON providers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_doctor_availability_updated_at ON doctor_availability;
CREATE TRIGGER update_doctor_availability_updated_at BEFORE UPDATE ON doctor_availability
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_doctor_time_off_updated_at ON doctor_time_off;
CREATE TRIGGER update_doctor_time_off_updated_at BEFORE UPDATE ON doctor_time_off
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_appointment_type_config_updated_at ON appointment_type_config;
CREATE TRIGGER update_appointment_type_config_updated_at BEFORE UPDATE ON appointment_type_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_provider_booking_config_updated_at ON provider_booking_config;
CREATE TRIGGER update_provider_booking_config_updated_at BEFORE UPDATE ON provider_booking_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_recurring_appointments_updated_at ON recurring_appointments;
CREATE TRIGGER update_recurring_appointments_updated_at BEFORE UPDATE ON recurring_appointments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_appointment_waitlist_updated_at ON appointment_waitlist;
CREATE TRIGGER update_appointment_waitlist_updated_at BEFORE UPDATE ON appointment_waitlist
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_appointment_reminders_updated_at ON appointment_reminders;
CREATE TRIGGER update_appointment_reminders_updated_at BEFORE UPDATE ON appointment_reminders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Success message
-- ============================================================================
DO $$
DECLARE
    provider_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO provider_count FROM providers;

    RAISE NOTICE '✓ Providers table recreated with id = user_id pattern';
    RAISE NOTICE '✓ Appointments table recreated with correct foreign keys';
    RAISE NOTICE '✓ All scheduling system tables recreated';
    RAISE NOTICE '✓ Total providers in system: %', provider_count;
    RAISE NOTICE '✓ Schema now matches patients table pattern (id references users.id)';
END $$;
