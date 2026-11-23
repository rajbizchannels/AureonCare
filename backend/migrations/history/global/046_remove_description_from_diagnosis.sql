-- Migration 046: Remove description column from diagnosis table
-- Description is now captured in the SOAP Notes field

-- Drop the description column from diagnosis table
ALTER TABLE diagnosis
DROP COLUMN IF EXISTS description;
