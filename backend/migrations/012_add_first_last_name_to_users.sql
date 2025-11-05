-- Add first_name and last_name columns to users table
-- This allows better integration with providers and patients tables

DO $$
BEGIN
    -- Add first_name column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'first_name'
    ) THEN
        ALTER TABLE users ADD COLUMN first_name VARCHAR(100);
        RAISE NOTICE 'Added first_name column to users table';
    END IF;

    -- Add last_name column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'last_name'
    ) THEN
        ALTER TABLE users ADD COLUMN last_name VARCHAR(100);
        RAISE NOTICE 'Added last_name column to users table';
    END IF;

    -- Migrate data from name column to first_name and last_name
    -- Split the name on the first space
    UPDATE users
    SET
        first_name = CASE
            WHEN position(' ' in name) > 0 THEN split_part(name, ' ', 1)
            ELSE name
        END,
        last_name = CASE
            WHEN position(' ' in name) > 0 THEN substring(name from position(' ' in name) + 1)
            ELSE ''
        END
    WHERE first_name IS NULL OR last_name IS NULL;

    RAISE NOTICE 'Migrated existing user names to first_name and last_name';

END $$;

-- Verify the migration
SELECT id, name, first_name, last_name FROM users LIMIT 5;
