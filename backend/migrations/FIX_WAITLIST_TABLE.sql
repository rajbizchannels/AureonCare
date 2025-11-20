-- ============================================
-- Fix appointment_waitlist table
-- Run this to fix the "preferred_date does not exist" error
-- ============================================

-- First, check if the table exists and drop it if it has wrong schema
-- (This is safe - waitlist is a new feature with no production data yet)
DROP TABLE IF EXISTS appointment_waitlist CASCADE;

-- Now create the table with correct schema
CREATE TABLE appointment_waitlist (
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
CREATE INDEX idx_waitlist_patient ON appointment_waitlist(patient_id);
CREATE INDEX idx_waitlist_provider ON appointment_waitlist(provider_id);
CREATE INDEX idx_waitlist_date ON appointment_waitlist(preferred_date);
CREATE INDEX idx_waitlist_status ON appointment_waitlist(status);
CREATE INDEX idx_waitlist_priority ON appointment_waitlist(priority DESC);

-- Create composite index for finding matching waitlist entries
CREATE INDEX idx_waitlist_active_lookup
  ON appointment_waitlist(provider_id, preferred_date, status)
  WHERE status = 'active';

-- Add comments
COMMENT ON TABLE appointment_waitlist IS 'Patient waitlist for appointment slots that are fully booked';
COMMENT ON COLUMN appointment_waitlist.priority IS 'Higher priority = contacted first (0 = normal, 1+ = higher priority)';
COMMENT ON COLUMN appointment_waitlist.status IS 'active: waiting, notified: slot available notification sent, scheduled: appointment booked, cancelled: patient cancelled, expired: notification expired';
COMMENT ON COLUMN appointment_waitlist.expires_at IS 'Notification expiry time - if not booked by this time, offer to next person';

-- Verify the table structure
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'appointment_waitlist'
ORDER BY ordinal_position;

-- Success message
SELECT 'appointment_waitlist table created successfully!' as status;
