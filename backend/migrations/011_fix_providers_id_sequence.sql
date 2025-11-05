-- Fix providers table id column to auto-generate values
-- This resolves the "null value in column id" error
-- Handles both UUID and INTEGER id types

DO $$
DECLARE
    id_data_type TEXT;
    id_default TEXT;
BEGIN
    -- Get the data type of the id column
    SELECT data_type, column_default
    INTO id_data_type, id_default
    FROM information_schema.columns
    WHERE table_name = 'providers' AND column_name = 'id';

    RAISE NOTICE 'Providers id column type: %', id_data_type;
    RAISE NOTICE 'Current default: %', COALESCE(id_default, 'NONE');

    -- Handle UUID type
    IF id_data_type = 'uuid' THEN
        RAISE NOTICE 'Setting UUID default for providers.id';

        -- Check if uuid-ossp extension exists, if not create it
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

        -- Set default to generate UUID
        ALTER TABLE providers ALTER COLUMN id SET DEFAULT uuid_generate_v4();

        RAISE NOTICE 'UUID default set successfully';

    -- Handle INTEGER type
    ELSIF id_data_type = 'integer' THEN
        RAISE NOTICE 'Setting sequence default for providers.id';

        -- Check if sequence exists
        IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'providers_id_seq') THEN
            -- Create sequence starting from 1
            CREATE SEQUENCE providers_id_seq START WITH 1;
            RAISE NOTICE 'Created providers_id_seq sequence';
        END IF;

        -- Set the default to use sequence
        ALTER TABLE providers ALTER COLUMN id SET DEFAULT nextval('providers_id_seq');

        -- Make the sequence owned by the column
        ALTER SEQUENCE providers_id_seq OWNED BY providers.id;

        -- Sync sequence with existing data if any
        DECLARE
            max_id INTEGER;
        BEGIN
            SELECT COALESCE(MAX(id), 0) INTO max_id FROM providers WHERE id IS NOT NULL;
            IF max_id > 0 THEN
                PERFORM setval('providers_id_seq', max_id);
                RAISE NOTICE 'Synced sequence to max id: %', max_id;
            END IF;
        END;

        RAISE NOTICE 'Sequence default set successfully';
    ELSE
        RAISE EXCEPTION 'Unsupported id data type: %', id_data_type;
    END IF;

    -- Ensure id column is NOT NULL
    ALTER TABLE providers ALTER COLUMN id SET NOT NULL;

    RAISE NOTICE 'Providers table id column fixed successfully';
END $$;

-- Verify the fix
SELECT
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'providers' AND column_name = 'id';
