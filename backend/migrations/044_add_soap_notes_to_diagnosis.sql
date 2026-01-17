-- Migration 044: Add SOAP Notes field to diagnosis table
-- This adds a dedicated field for SOAP (Subjective, Objective, Assessment, Plan) notes

-- Add soap_notes column to diagnosis table
ALTER TABLE diagnosis
ADD COLUMN IF NOT EXISTS soap_notes TEXT;

-- Add comment for documentation
COMMENT ON COLUMN diagnosis.soap_notes IS 'SOAP notes: Subjective, Objective, Assessment, and Plan documentation for the diagnosis';

-- Create index for better search performance on soap_notes
CREATE INDEX IF NOT EXISTS idx_diagnosis_soap_notes ON diagnosis USING gin(to_tsvector('english', COALESCE(soap_notes, '')));
