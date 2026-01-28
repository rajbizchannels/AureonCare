-- Migration: Update users table structure
-- This script safely updates the users table to match the new schema

-- Drop the old users table and recreate with correct schema
DROP TABLE IF EXISTS users CASCADE;

-- Recreate users table with correct schema
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(100) DEFAULT 'user',
  practice VARCHAR(255),
  avatar VARCHAR(10),
  email VARCHAR(255),
  phone VARCHAR(20),
  license VARCHAR(50),
  specialty VARCHAR(100),
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample user
INSERT INTO users (name, role, practice, avatar, email, phone, license, specialty, preferences)
VALUES (
  'Dr. Sarah Chen',
  'admin',
  'Central Medical Group',
  'SC',
  'sarah.chen@aureoncare.com',
  '(555) 123-4567',
  'MD-123456',
  'Internal Medicine',
  '{"emailNotifications": true, "smsAlerts": true, "darkMode": true}'::jsonb
);

-- Add a few more sample users for testing
INSERT INTO users (name, role, practice, avatar, email, phone, license, specialty, preferences)
VALUES
(
  'Dr. Michael Johnson',
  'doctor',
  'Central Medical Group',
  'MJ',
  'michael.johnson@aureoncare.com',
  '(555) 234-5678',
  'MD-234567',
  'Cardiology',
  '{"emailNotifications": true, "smsAlerts": false, "darkMode": false}'::jsonb
),
(
  'Emily Davis',
  'staff',
  'Central Medical Group',
  'ED',
  'emily.davis@aureoncare.com',
  '(555) 345-6789',
  NULL,
  NULL,
  '{"emailNotifications": true, "smsAlerts": true, "darkMode": true}'::jsonb
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
