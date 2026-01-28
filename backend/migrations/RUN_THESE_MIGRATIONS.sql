-- ============================================
-- AureonCare Database Migrations
-- Run these in your PostgreSQL database
-- ============================================

-- Migration 1: Create appointment_types table
-- ============================================
CREATE TABLE IF NOT EXISTS appointment_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  duration_minutes INTEGER DEFAULT 30,
  color VARCHAR(20) DEFAULT '#3B82F6',
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default appointment types
INSERT INTO appointment_types (name, description, duration_minutes, color, display_order) VALUES
  ('General Consultation', 'General medical consultation and check-up', 30, '#3B82F6', 1),
  ('Follow-up', 'Follow-up visit for existing condition', 20, '#10B981', 2),
  ('Check-up', 'Routine health check-up', 30, '#F59E0B', 3),
  ('Physical Exam', 'Complete physical examination', 45, '#8B5CF6', 4),
  ('Vaccination', 'Immunization and vaccination services', 15, '#EC4899', 5),
  ('Lab Results', 'Review and discuss lab results', 15, '#06B6D4', 6)
ON CONFLICT (name) DO NOTHING;

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_appointment_types_active ON appointment_types(is_active);
CREATE INDEX IF NOT EXISTS idx_appointment_types_order ON appointment_types(display_order);

-- Migration 2: Create appointment_waitlist table
-- ============================================
CREATE TABLE IF NOT EXISTS appointment_waitlist (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_id INTEGER REFERENCES providers(id) ON DELETE SET NULL,
  preferred_date DATE NOT NULL,
  preferred_time_start TIME,
  preferred_time_end TIME,
  appointment_type VARCHAR(100),
  reason TEXT,
  priority INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'notified', 'scheduled', 'cancelled', 'expired')),
  notified_at TIMESTAMP,
  expires_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_waitlist_patient ON appointment_waitlist(patient_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_provider ON appointment_waitlist(provider_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_date ON appointment_waitlist(preferred_date);
CREATE INDEX IF NOT EXISTS idx_waitlist_status ON appointment_waitlist(status);
CREATE INDEX IF NOT EXISTS idx_waitlist_priority ON appointment_waitlist(priority DESC);

-- Create composite index for finding matching waitlist entries
CREATE INDEX IF NOT EXISTS idx_waitlist_active_lookup
  ON appointment_waitlist(provider_id, preferred_date, status)
  WHERE status = 'active';

-- Add comments
COMMENT ON TABLE appointment_waitlist IS 'Patient waitlist for appointment slots that are fully booked';
COMMENT ON COLUMN appointment_waitlist.priority IS 'Higher priority = contacted first (0 = normal, 1+ = higher priority)';
COMMENT ON COLUMN appointment_waitlist.status IS 'active: waiting, notified: slot available notification sent, scheduled: appointment booked, cancelled: patient cancelled, expired: notification expired';
COMMENT ON COLUMN appointment_waitlist.expires_at IS 'Notification expiry time - if not booked by this time, offer to next person';

-- ============================================
-- Verification Queries (Run these to verify)
-- ============================================

-- Check appointment_types table
SELECT COUNT(*) as appointment_types_count FROM appointment_types;
SELECT * FROM appointment_types ORDER BY display_order;

-- Check appointment_waitlist table structure
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'appointment_waitlist'
ORDER BY ordinal_position;

-- Success message
SELECT 'Migrations completed successfully!' as status;
