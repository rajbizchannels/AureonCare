-- Migration: Create Scheduling System (Calendly-like)
-- Description: Add doctor availability, time slots, booking configuration, and recurring appointments

-- ============================================================================
-- 1. DOCTOR AVAILABILITY TABLE
-- ============================================================================
-- Stores doctor's working hours, breaks, and time-off
CREATE TABLE IF NOT EXISTS doctor_availability (
    id SERIAL PRIMARY KEY,
    provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday, 6=Saturday
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_available BOOLEAN DEFAULT true,
    timezone VARCHAR(100) DEFAULT 'UTC',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_time_order CHECK (end_time > start_time)
);

CREATE INDEX idx_doctor_availability_provider ON doctor_availability(provider_id);
CREATE INDEX idx_doctor_availability_day ON doctor_availability(day_of_week);

-- ============================================================================
-- 2. DOCTOR TIME-OFF / EXCEPTIONS TABLE
-- ============================================================================
-- Handles vacation days, holidays, specific date exceptions
CREATE TABLE IF NOT EXISTS doctor_time_off (
    id SERIAL PRIMARY KEY,
    provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    reason VARCHAR(500),
    is_recurring BOOLEAN DEFAULT false, -- For annual holidays
    recurrence_rule VARCHAR(255), -- iCalendar RRULE format
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_date_order CHECK (end_date >= start_date)
);

CREATE INDEX idx_doctor_time_off_provider ON doctor_time_off(provider_id);
CREATE INDEX idx_doctor_time_off_dates ON doctor_time_off(start_date, end_date);

-- ============================================================================
-- 3. APPOINTMENT TYPE CONFIGURATIONS
-- ============================================================================
-- Define available appointment types with duration, buffer, and pricing
CREATE TABLE IF NOT EXISTS appointment_type_config (
    id SERIAL PRIMARY KEY,
    provider_id INTEGER REFERENCES providers(id) ON DELETE CASCADE, -- NULL means clinic-wide
    name VARCHAR(100) NOT NULL,
    description TEXT,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    buffer_minutes INTEGER DEFAULT 0, -- Time between appointments
    color VARCHAR(20) DEFAULT '#3B82F6',
    price DECIMAL(10, 2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT true,
    requires_approval BOOLEAN DEFAULT false, -- Manual confirmation needed
    max_advance_booking_days INTEGER DEFAULT 90, -- How far in advance patients can book
    min_advance_booking_hours INTEGER DEFAULT 24, -- Minimum notice required
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_appointment_type_provider ON appointment_type_config(provider_id);
CREATE INDEX idx_appointment_type_active ON appointment_type_config(is_active);

-- ============================================================================
-- 4. BOOKING CONFIGURATION TABLE
-- ============================================================================
-- Provider-specific booking settings and preferences
CREATE TABLE IF NOT EXISTS provider_booking_config (
    id SERIAL PRIMARY KEY,
    provider_id INTEGER UNIQUE NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    booking_url_slug VARCHAR(100) UNIQUE, -- e.g., 'dr-smith' for public link
    timezone VARCHAR(100) DEFAULT 'UTC',
    slot_interval_minutes INTEGER DEFAULT 15, -- Time slot increments
    max_concurrent_bookings INTEGER DEFAULT 1, -- Overbooking control
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
    custom_fields JSONB DEFAULT '[]', -- Additional form fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_booking_config_url ON provider_booking_config(booking_url_slug);
CREATE INDEX idx_booking_config_provider ON provider_booking_config(provider_id);

-- ============================================================================
-- 5. RECURRING APPOINTMENTS TABLE
-- ============================================================================
-- Track appointment series (e.g., weekly therapy sessions)
CREATE TABLE IF NOT EXISTS recurring_appointments (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    appointment_type_id INTEGER REFERENCES appointment_type_config(id) ON DELETE SET NULL,
    recurrence_rule VARCHAR(255) NOT NULL, -- iCalendar RRULE (e.g., "FREQ=WEEKLY;BYDAY=MO")
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP, -- NULL for indefinite
    duration_minutes INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'active', -- active, paused, cancelled
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_recurring_appointments_patient ON recurring_appointments(patient_id);
CREATE INDEX idx_recurring_appointments_provider ON recurring_appointments(provider_id);
CREATE INDEX idx_recurring_appointments_status ON recurring_appointments(status);

-- ============================================================================
-- 6. UPDATE APPOINTMENTS TABLE
-- ============================================================================
-- Add new columns to existing appointments table for scheduling features
ALTER TABLE appointments
    ADD COLUMN IF NOT EXISTS appointment_type_id INTEGER REFERENCES appointment_type_config(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS recurring_appointment_id INTEGER REFERENCES recurring_appointments(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS timezone VARCHAR(100) DEFAULT 'UTC',
    ADD COLUMN IF NOT EXISTS booking_source VARCHAR(50) DEFAULT 'staff', -- staff, public, patient_portal
    ADD COLUMN IF NOT EXISTS confirmation_sent_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS cancelled_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
    ADD COLUMN IF NOT EXISTS rescheduled_from INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS no_show_notified_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS custom_form_data JSONB DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_appointments_type ON appointments(appointment_type_id);
CREATE INDEX IF NOT EXISTS idx_appointments_recurring ON appointments(recurring_appointment_id);
CREATE INDEX IF NOT EXISTS idx_appointments_booking_source ON appointments(booking_source);
CREATE INDEX IF NOT EXISTS idx_appointments_cancelled ON appointments(cancelled_at);

-- ============================================================================
-- 7. APPOINTMENT WAITLIST TABLE
-- ============================================================================
-- Queue system for fully booked time slots
CREATE TABLE IF NOT EXISTS appointment_waitlist (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    appointment_type_id INTEGER REFERENCES appointment_type_config(id) ON DELETE CASCADE,
    preferred_date_start DATE NOT NULL,
    preferred_date_end DATE NOT NULL,
    preferred_time_start TIME,
    preferred_time_end TIME,
    notes TEXT,
    status VARCHAR(50) DEFAULT 'waiting', -- waiting, notified, scheduled, expired
    notified_at TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_waitlist_patient ON appointment_waitlist(patient_id);
CREATE INDEX idx_waitlist_provider ON appointment_waitlist(provider_id);
CREATE INDEX idx_waitlist_status ON appointment_waitlist(status);
CREATE INDEX idx_waitlist_dates ON appointment_waitlist(preferred_date_start, preferred_date_end);

-- ============================================================================
-- 8. APPOINTMENT REMINDERS TABLE
-- ============================================================================
-- Track scheduled reminders (email, SMS, push)
CREATE TABLE IF NOT EXISTS appointment_reminders (
    id SERIAL PRIMARY KEY,
    appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    reminder_type VARCHAR(50) NOT NULL, -- email, sms, push
    scheduled_for TIMESTAMP NOT NULL,
    sent_at TIMESTAMP,
    delivery_status VARCHAR(50) DEFAULT 'pending', -- pending, sent, failed, cancelled
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reminders_appointment ON appointment_reminders(appointment_id);
CREATE INDEX idx_reminders_scheduled ON appointment_reminders(scheduled_for);
CREATE INDEX idx_reminders_status ON appointment_reminders(delivery_status);

-- ============================================================================
-- 9. BOOKING ANALYTICS TABLE (Optional)
-- ============================================================================
-- Track booking metrics for insights
CREATE TABLE IF NOT EXISTS booking_analytics (
    id SERIAL PRIMARY KEY,
    provider_id INTEGER REFERENCES providers(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL, -- page_view, slot_selected, booking_started, booking_completed, booking_cancelled
    appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
    appointment_type_id INTEGER REFERENCES appointment_type_config(id) ON DELETE SET NULL,
    patient_id INTEGER REFERENCES patients(id) ON DELETE SET NULL,
    session_id VARCHAR(100),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_analytics_provider ON booking_analytics(provider_id);
CREATE INDEX idx_analytics_event ON booking_analytics(event_type);
CREATE INDEX idx_analytics_created ON booking_analytics(created_at);

-- ============================================================================
-- SEED DEFAULT DATA
-- ============================================================================

-- Insert default appointment types for existing providers
INSERT INTO appointment_type_config (provider_id, name, description, duration_minutes, buffer_minutes, color, price, is_active)
SELECT
    id,
    'Office Visit',
    'Standard in-person consultation',
    30,
    15,
    '#3B82F6',
    0.00,
    true
FROM providers
ON CONFLICT DO NOTHING;

-- Create booking configurations for all providers with unique slugs
INSERT INTO provider_booking_config (provider_id, booking_url_slug, timezone, slot_interval_minutes, allow_public_booking)
SELECT
    p.id,
    LOWER(REGEXP_REPLACE(CONCAT(p.first_name, '-', p.last_name, '-', p.id), '[^a-zA-Z0-9-]', '', 'g')),
    'America/New_York',
    15,
    true
FROM providers p
ON CONFLICT (provider_id) DO NOTHING;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to check if a time slot is available
CREATE OR REPLACE FUNCTION is_slot_available(
    p_provider_id INTEGER,
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
CREATE TRIGGER update_doctor_availability_updated_at BEFORE UPDATE ON doctor_availability
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_doctor_time_off_updated_at BEFORE UPDATE ON doctor_time_off
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appointment_type_config_updated_at BEFORE UPDATE ON appointment_type_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_provider_booking_config_updated_at BEFORE UPDATE ON provider_booking_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recurring_appointments_updated_at BEFORE UPDATE ON recurring_appointments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appointment_waitlist_updated_at BEFORE UPDATE ON appointment_waitlist
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appointment_reminders_updated_at BEFORE UPDATE ON appointment_reminders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================
COMMENT ON TABLE doctor_availability IS 'Stores doctor weekly availability schedule (working hours)';
COMMENT ON TABLE doctor_time_off IS 'Tracks doctor time-off, vacations, and schedule exceptions';
COMMENT ON TABLE appointment_type_config IS 'Defines available appointment types with duration and pricing';
COMMENT ON TABLE provider_booking_config IS 'Provider-specific booking settings and public booking URLs';
COMMENT ON TABLE recurring_appointments IS 'Manages recurring appointment series';
COMMENT ON TABLE appointment_waitlist IS 'Queue system for patients waiting for fully booked slots';
COMMENT ON TABLE appointment_reminders IS 'Tracks scheduled appointment reminders (email/SMS)';
COMMENT ON TABLE booking_analytics IS 'Booking funnel analytics for insights and reporting';
