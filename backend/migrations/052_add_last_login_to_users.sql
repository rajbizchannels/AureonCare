-- Migration 052: Add last_login column to users table
-- The social-login route updates last_login on every successful OAuth sign-in.
-- This column was referenced in code but never created via a migration.

ALTER TABLE users
ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITHOUT TIME ZONE;
