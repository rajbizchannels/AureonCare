-- Fix appointments provider_id foreign key to reference providers table instead of users table

-- First, drop the existing constraint if it exists and references users table
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'appointments_provider_id_fkey'
        AND table_name = 'appointments'
    ) THEN
        ALTER TABLE appointments DROP CONSTRAINT appointments_provider_id_fkey;
    END IF;
END $$;

-- Clean up orphaned appointments data before adding new constraint
-- Set provider_id to NULL for any appointments that reference non-existent providers
DO $$
BEGIN
    -- Check if both tables exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'appointments')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'providers') THEN

        -- Update appointments with invalid provider_ids to NULL
        UPDATE appointments
        SET provider_id = NULL
        WHERE provider_id IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM providers WHERE providers.id = appointments.provider_id
        );

        RAISE NOTICE 'Cleaned up orphaned appointment provider references';
    END IF;
END $$;

-- Add the correct constraint that references providers table
-- Use CASCADE or SET NULL based on your requirements
-- SET NULL is safer as it won't delete appointments if provider is deleted
DO $$
BEGIN
    -- Check if providers table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'providers') THEN
        -- Add foreign key constraint to providers table
        -- First check if constraint doesn't already exist with correct reference
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.constraint_column_usage
            WHERE constraint_name = 'appointments_provider_id_fkey'
            AND table_name = 'providers'
        ) THEN
            ALTER TABLE appointments
            ADD CONSTRAINT appointments_provider_id_fkey
            FOREIGN KEY (provider_id)
            REFERENCES providers(id)
            ON DELETE SET NULL;

            RAISE NOTICE 'Added correct foreign key constraint to providers table';
        END IF;
    END IF;
END $$;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_appointments_provider_id ON appointments(provider_id);
