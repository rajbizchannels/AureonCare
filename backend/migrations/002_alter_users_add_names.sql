-- Add first_name and last_name columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);

-- Migrate existing data from name to first_name and last_name
UPDATE users
SET
  first_name = SPLIT_PART(name, ' ', 1),
  last_name = SUBSTRING(name FROM POSITION(' ' IN name) + 1)
WHERE first_name IS NULL AND name IS NOT NULL;

-- For users with single-word names, set last_name to empty string
UPDATE users
SET last_name = ''
WHERE last_name IS NULL;

-- Update existing name column to be computed from first_name and last_name
-- (Keep the name column for backward compatibility but update it)
UPDATE users
SET name = CONCAT(first_name, ' ', last_name)
WHERE first_name IS NOT NULL;
