-- Migration 045: Remove notes column from diagnosis table
-- Clinical notes are now captured in the dedicated soap_notes field

-- Drop the notes column from diagnosis table
ALTER TABLE diagnosis
DROP COLUMN IF EXISTS notes;
