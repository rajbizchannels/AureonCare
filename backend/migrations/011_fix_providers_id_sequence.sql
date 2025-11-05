-- Fix providers table id column to ensure SERIAL sequence works correctly
-- This resolves the "null value in column id" error

-- First, check if the sequence exists and is properly linked
DO $$
DECLARE
    seq_name TEXT;
    max_id INTEGER;
BEGIN
    -- Get the current sequence name
    SELECT pg_get_serial_sequence('providers', 'id') INTO seq_name;

    IF seq_name IS NULL THEN
        -- Sequence doesn't exist, create it
        RAISE NOTICE 'Creating sequence for providers.id';

        -- Get current max id
        SELECT COALESCE(MAX(id), 0) INTO max_id FROM providers;

        -- Create sequence
        EXECUTE 'CREATE SEQUENCE providers_id_seq START WITH ' || (max_id + 1);

        -- Set the default
        ALTER TABLE providers ALTER COLUMN id SET DEFAULT nextval('providers_id_seq');

        -- Make the sequence owned by the column
        ALTER SEQUENCE providers_id_seq OWNED BY providers.id;
    ELSE
        RAISE NOTICE 'Sequence already exists: %', seq_name;

        -- Ensure the default is set
        ALTER TABLE providers ALTER COLUMN id SET DEFAULT nextval('providers_id_seq');

        -- Sync the sequence with current max id
        SELECT COALESCE(MAX(id), 0) INTO max_id FROM providers;
        EXECUTE 'SELECT setval(''providers_id_seq'', ' || GREATEST(max_id, 1) || ')';
    END IF;

    -- Ensure id column is NOT NULL
    ALTER TABLE providers ALTER COLUMN id SET NOT NULL;

    RAISE NOTICE 'Providers table id column fixed successfully';
END $$;

-- Verify the fix
SELECT
    column_name,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'providers' AND column_name = 'id';
