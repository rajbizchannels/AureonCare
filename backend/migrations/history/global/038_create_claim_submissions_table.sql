-- Migration 038: Create Claim Submissions Table
-- This table tracks EDI 837 claim submissions to clearinghouses

-- Create claim_submissions table
CREATE TABLE IF NOT EXISTS claim_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id UUID REFERENCES claims(id) ON DELETE CASCADE,
    submission_type VARCHAR(50) DEFAULT 'EDI_837' CHECK (submission_type IN ('EDI_837', 'Manual', 'Portal', 'Fax', 'Mail')),
    submission_date TIMESTAMP NOT NULL,
    submission_id VARCHAR(100),
    clearinghouse_name VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'accepted', 'rejected', 'acknowledged')),

    -- EDI file content (optional, for record keeping)
    edi_content TEXT,

    -- Response from clearinghouse
    response_code VARCHAR(50),
    response_message TEXT,
    response_date TIMESTAMP,

    -- Tracking
    acknowledgment_number VARCHAR(100),
    batch_number VARCHAR(100),

    -- Notes
    notes TEXT,

    -- Audit fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_claim_submissions_claim_id ON claim_submissions(claim_id);
CREATE INDEX IF NOT EXISTS idx_claim_submissions_submission_date ON claim_submissions(submission_date);
CREATE INDEX IF NOT EXISTS idx_claim_submissions_status ON claim_submissions(status);
CREATE INDEX IF NOT EXISTS idx_claim_submissions_submission_id ON claim_submissions(submission_id);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_claim_submissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_claim_submissions_updated_at
    BEFORE UPDATE ON claim_submissions
    FOR EACH ROW
    EXECUTE FUNCTION update_claim_submissions_updated_at();

-- Add comments for documentation
COMMENT ON TABLE claim_submissions IS 'Tracks EDI 837 and other claim submissions to clearinghouses';
COMMENT ON COLUMN claim_submissions.submission_type IS 'Type of submission (EDI_837, Manual, Portal, etc.)';
COMMENT ON COLUMN claim_submissions.submission_id IS 'Unique submission ID from clearinghouse';
COMMENT ON COLUMN claim_submissions.edi_content IS 'Full EDI 837 file content for record keeping';
COMMENT ON COLUMN claim_submissions.acknowledgment_number IS '997 Functional Acknowledgment number';
