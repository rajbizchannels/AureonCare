-- Add status column to users table for allow/block functionality
ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';

-- Update any NULL statuses to active
UPDATE users SET status = 'active' WHERE status IS NULL;

-- Add check constraint to ensure valid status values
ALTER TABLE users ADD CONSTRAINT user_status_check
  CHECK (status IN ('active', 'blocked', 'pending'));

-- Add index for faster status lookups
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- Comment on column
COMMENT ON COLUMN users.status IS 'User account status: active (can login), blocked (cannot login), pending (awaiting approval)';
