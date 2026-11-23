-- Add status column to users table for managing user activation
-- Status values: pending, active, suspended

-- Add status column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'status'
    ) THEN
        ALTER TABLE users ADD COLUMN status VARCHAR(50) DEFAULT 'active';

        -- Create index for better query performance
        CREATE INDEX idx_users_status ON users(status);

        -- Update existing users to active status
        UPDATE users SET status = 'active' WHERE status IS NULL;
    END IF;
END $$;
