-- Migration 042: Setup Archive Database
-- This migration should be run on the ARCHIVE database (aureoncare_archive)
-- It creates the necessary metadata tables to track archived data

-- Create archive_metadata table to track what has been archived
CREATE TABLE IF NOT EXISTS archive_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    archive_name VARCHAR(255) NOT NULL,
    description TEXT,
    archived_tables TEXT[] NOT NULL, -- Array of table names that were archived
    archived_modules TEXT[] NOT NULL, -- Array of module names
    record_counts JSONB, -- Record counts per table
    archive_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    archived_by UUID, -- User ID from main database
    status VARCHAR(50) DEFAULT 'active', -- active, restored, deleted
    metadata JSONB -- Additional metadata
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_archive_metadata_date ON archive_metadata(archive_date);
CREATE INDEX IF NOT EXISTS idx_archive_metadata_status ON archive_metadata(status);
CREATE INDEX IF NOT EXISTS idx_archive_metadata_modules ON archive_metadata USING GIN(archived_modules);

-- Comments
COMMENT ON TABLE archive_metadata IS 'Tracks archived data stored in this archive database';
COMMENT ON COLUMN archive_metadata.archived_tables IS 'List of tables that contain archived data';
COMMENT ON COLUMN archive_metadata.archived_modules IS 'List of modules (logical groupings) that were archived';
COMMENT ON COLUMN archive_metadata.record_counts IS 'JSON object with table names as keys and record counts as values';

-- NOTE: The actual data tables (patients, appointments, etc.) will be created
-- automatically when data is first archived, copying the structure from the main database
