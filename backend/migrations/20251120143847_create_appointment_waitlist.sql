-- Create appointment_waitlist table
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

COMMENT ON TABLE appointment_waitlist IS 'Patient waitlist for appointment slots that are fully booked';
COMMENT ON COLUMN appointment_waitlist.priority IS 'Higher priority = contacted first (0 = normal, 1+ = higher priority)';
COMMENT ON COLUMN appointment_waitlist.status IS 'active: waiting, notified: slot available notification sent, scheduled: appointment booked, cancelled: patient cancelled, expired: notification expired';
COMMENT ON COLUMN appointment_waitlist.expires_at IS 'Notification expiry time - if not booked by this time, offer to next person';
