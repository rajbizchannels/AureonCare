-- ============================================
-- Fix appointment_types table
-- Run this to fix the "appointment_types does not exist" error
-- ============================================

-- Create the table (will skip if it already exists correctly)
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

-- Verify the table and data
SELECT COUNT(*) as total_types FROM appointment_types;
SELECT * FROM appointment_types ORDER BY display_order;

-- Success message
SELECT 'appointment_types table created successfully!' as status;
