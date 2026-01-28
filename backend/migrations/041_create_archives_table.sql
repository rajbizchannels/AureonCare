-- Migration 041: Create archives table for data archiving
-- This table stores archived data that can be selectively retrieved and merged back

CREATE TABLE IF NOT EXISTS archives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    archive_name VARCHAR(255) NOT NULL,
    description TEXT,
    modules TEXT[] NOT NULL, -- Array of module names that were archived
    archive_data JSONB NOT NULL, -- Complete archived data organized by module
    metadata JSONB, -- Additional metadata like record counts per module
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    size_bytes INTEGER, -- Size of the archive data
    record_count INTEGER, -- Total number of records archived
    status VARCHAR(50) DEFAULT 'active' -- active, restored, deleted
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_archives_created_by ON archives(created_by);
CREATE INDEX IF NOT EXISTS idx_archives_created_at ON archives(created_at);
CREATE INDEX IF NOT EXISTS idx_archives_status ON archives(status);
CREATE INDEX IF NOT EXISTS idx_archives_modules ON archives USING GIN(modules);

-- Add comment to the table
COMMENT ON TABLE archives IS 'Stores archived data with module selection and deduplication support';
COMMENT ON COLUMN archives.modules IS 'Array of module names included in this archive (e.g., patients, appointments, medical_records)';
COMMENT ON COLUMN archives.archive_data IS 'Complete archived data organized by module name as keys';
COMMENT ON COLUMN archives.metadata IS 'Statistics and metadata about the archive including record counts per module and timestamp';
