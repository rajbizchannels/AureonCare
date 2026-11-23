-- Migration: Update tasks table structure
-- This script ensures the tasks table has the description field

-- Add description column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='tasks' AND column_name='description'
  ) THEN
    ALTER TABLE tasks ADD COLUMN description TEXT;
  END IF;
END $$;

-- Insert some sample tasks for testing
INSERT INTO tasks (title, priority, due_date, status, description)
VALUES
  ('Review lab results for John Doe', 'High', CURRENT_DATE, 'Pending', 'Check latest blood work and follow up if abnormal'),
  ('Call pharmacy for Jane Smith prescription', 'High', CURRENT_DATE, 'Pending', 'Refill approval needed for blood pressure medication'),
  ('Complete insurance verification', 'Medium', CURRENT_DATE + INTERVAL '1 day', 'Pending', 'Verify coverage for upcoming procedures'),
  ('Schedule follow-up appointments', 'Low', CURRENT_DATE + INTERVAL '2 days', 'Pending', 'Contact patients who need routine checkups')
ON CONFLICT DO NOTHING;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
