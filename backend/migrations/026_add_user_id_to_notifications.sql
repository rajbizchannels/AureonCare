-- Migration: Add user_id column to notifications table
-- Description: Links notifications to specific users instead of being global

BEGIN;

-- Add user_id column to notifications table
ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'notifications_user_id_fkey'
    ) THEN
        ALTER TABLE notifications
        ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;

COMMIT;
