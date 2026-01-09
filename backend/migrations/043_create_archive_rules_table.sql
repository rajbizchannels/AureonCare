-- Migration 043: Create archive_rules table for automatic archiving
-- This table stores rules that define when and what to archive automatically

CREATE TABLE IF NOT EXISTS archive_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    enabled BOOLEAN DEFAULT true,

    -- What to archive
    selected_modules TEXT[] NOT NULL,

    -- When to archive
    schedule_type VARCHAR(50) NOT NULL, -- 'daily', 'weekly', 'monthly', 'custom'
    schedule_cron VARCHAR(100), -- Cron expression for custom schedules
    schedule_time TIME DEFAULT '02:00:00', -- Time of day to run (for daily/weekly/monthly)
    schedule_day_of_week INTEGER, -- 0-6 for weekly (0 = Sunday)
    schedule_day_of_month INTEGER, -- 1-31 for monthly

    -- What data to archive (retention rules)
    retention_days INTEGER, -- Archive data older than X days (optional)
    retention_criteria JSONB, -- Additional criteria (e.g., {"status": "completed"})

    -- Execution tracking
    last_run_at TIMESTAMP WITH TIME ZONE,
    last_run_status VARCHAR(50), -- 'success', 'failed', 'running'
    last_run_details JSONB, -- Details about last execution (records archived, errors, etc.)
    next_run_at TIMESTAMP WITH TIME ZONE,

    -- Metadata
    created_by UUID, -- User who created the rule
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_archive_rules_enabled ON archive_rules(enabled);
CREATE INDEX IF NOT EXISTS idx_archive_rules_next_run ON archive_rules(next_run_at) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_archive_rules_schedule_type ON archive_rules(schedule_type);

-- Comments
COMMENT ON TABLE archive_rules IS 'Defines automatic archiving rules with schedules';
COMMENT ON COLUMN archive_rules.schedule_type IS 'Type of schedule: daily, weekly, monthly, or custom (cron)';
COMMENT ON COLUMN archive_rules.schedule_cron IS 'Cron expression for custom schedules (e.g., "0 2 * * *")';
COMMENT ON COLUMN archive_rules.retention_days IS 'Archive data older than this many days (null = archive all)';
COMMENT ON COLUMN archive_rules.retention_criteria IS 'Additional filtering criteria for data to archive';
COMMENT ON COLUMN archive_rules.last_run_status IS 'Status of last execution: success, failed, or running';

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_archive_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER archive_rules_updated_at
    BEFORE UPDATE ON archive_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_archive_rules_updated_at();
