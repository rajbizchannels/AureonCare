-- Migration 006: Ensure first_name/last_name and medical attributes exist (UUID version)
-- Compatible with UUID-based schema from migrate-enhanced.js

-- ============================================
-- PART 1: Add medical attributes to patients table (if not already added)
-- ============================================

-- Add medical attributes columns to patients table if they don't exist
-- (This might be redundant with migration 005, but IF NOT EXISTS makes it safe)
ALTER TABLE patients
ADD COLUMN IF NOT EXISTS height VARCHAR(20),
ADD COLUMN IF NOT EXISTS weight VARCHAR(20),
ADD COLUMN IF NOT EXISTS blood_type VARCHAR(10),
ADD COLUMN IF NOT EXISTS allergies TEXT,
ADD COLUMN IF NOT EXISTS past_history TEXT,
ADD COLUMN IF NOT EXISTS family_history TEXT,
ADD COLUMN IF NOT EXISTS current_medications TEXT;

-- ============================================
-- PART 2: Ensure users table has first_name and last_name
-- ============================================

-- These should already exist from migrate-enhanced.js, but add them just in case
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);

-- For any users that might have a 'name' field but not first_name/last_name, migrate the data
DO $$
BEGIN
  -- Check if 'name' column exists
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'users' AND column_name = 'name') THEN

    -- Migrate data from name to first_name/last_name if they're null
    UPDATE users
    SET
      first_name = COALESCE(first_name, SPLIT_PART(name, ' ', 1)),
      last_name = COALESCE(last_name,
        CASE
          WHEN POSITION(' ' IN name) > 0 THEN SUBSTRING(name FROM POSITION(' ' IN name) + 1)
          ELSE ''
        END
      )
    WHERE (first_name IS NULL OR first_name = '') AND name IS NOT NULL AND name != '';
  END IF;
END $$;

-- Set empty string for any remaining NULL names
UPDATE users
SET first_name = ''
WHERE first_name IS NULL;

UPDATE users
SET last_name = ''
WHERE last_name IS NULL;

-- Make first_name and last_name NOT NULL if they aren't already
DO $$
BEGIN
  ALTER TABLE users ALTER COLUMN first_name SET NOT NULL;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'first_name is already NOT NULL or cannot be set to NOT NULL';
END $$;

DO $$
BEGIN
  ALTER TABLE users ALTER COLUMN last_name SET NOT NULL;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'last_name is already NOT NULL or cannot be set to NOT NULL';
END $$;

-- ============================================
-- NOTES:
-- ============================================
-- The 'name' column in users table can be dropped in a future migration
-- once all code is verified to use first_name/last_name exclusively.
