-- Migration 037: Create Denials Table
-- This table tracks claim denials and denial management workflow

-- Create denials table
CREATE TABLE IF NOT EXISTS denials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    denial_number VARCHAR(50) UNIQUE NOT NULL,
    claim_id UUID REFERENCES claims(id) ON DELETE SET NULL,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    insurance_payer_id UUID REFERENCES insurance_payers(id) ON DELETE SET NULL,

    -- Denial details
    denial_date DATE NOT NULL,
    denial_amount DECIMAL(10, 2) NOT NULL,
    denied_service_date DATE,

    -- Denial reason
    denial_reason_code VARCHAR(50),
    denial_reason_description TEXT,
    denial_category VARCHAR(100) CHECK (denial_category IN (
        'Medical Necessity',
        'Prior Authorization Required',
        'Timely Filing',
        'Coordination of Benefits',
        'Duplicate Claim',
        'Invalid/Missing Information',
        'Non-Covered Service',
        'Patient Eligibility',
        'Coding Error',
        'Other'
    )),

    -- Appeal information
    appeal_status VARCHAR(50) DEFAULT 'not_appealed' CHECK (appeal_status IN (
        'not_appealed',
        'appeal_pending',
        'appeal_submitted',
        'appeal_approved',
        'appeal_denied',
        'appeal_withdrawn'
    )),
    appeal_deadline DATE,
    appeal_submitted_date DATE,
    appeal_decision_date DATE,
    appeal_outcome VARCHAR(50),
    appeal_amount_recovered DECIMAL(10, 2) DEFAULT 0,

    -- Resolution tracking
    status VARCHAR(50) DEFAULT 'open' CHECK (status IN (
        'open',
        'under_review',
        'appealing',
        'resolved',
        'written_off',
        'patient_responsibility'
    )),
    resolution_date DATE,
    resolution_notes TEXT,

    -- Document tracking
    eob_number VARCHAR(100),
    era_number VARCHAR(100),
    supporting_documents JSONB,

    -- Assignment
    assigned_to VARCHAR(255),
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),

    -- Notes
    notes TEXT,
    internal_notes TEXT,

    -- Audit fields
    created_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_denials_claim_id ON denials(claim_id);
CREATE INDEX IF NOT EXISTS idx_denials_patient_id ON denials(patient_id);
CREATE INDEX IF NOT EXISTS idx_denials_insurance_payer_id ON denials(insurance_payer_id);
CREATE INDEX IF NOT EXISTS idx_denials_denial_date ON denials(denial_date);
CREATE INDEX IF NOT EXISTS idx_denials_status ON denials(status);
CREATE INDEX IF NOT EXISTS idx_denials_appeal_status ON denials(appeal_status);
CREATE INDEX IF NOT EXISTS idx_denials_priority ON denials(priority);
CREATE INDEX IF NOT EXISTS idx_denials_appeal_deadline ON denials(appeal_deadline);
CREATE INDEX IF NOT EXISTS idx_denials_assigned_to ON denials(assigned_to);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_denials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_denials_updated_at
    BEFORE UPDATE ON denials
    FOR EACH ROW
    EXECUTE FUNCTION update_denials_updated_at();

-- Create function to generate denial number
CREATE OR REPLACE FUNCTION generate_denial_number()
RETURNS VARCHAR(50) AS $$
DECLARE
    next_num INTEGER;
    year_prefix VARCHAR(4);
    denial_num VARCHAR(50);
BEGIN
    year_prefix := TO_CHAR(CURRENT_DATE, 'YYYY');

    SELECT COALESCE(MAX(CAST(SUBSTRING(denial_number FROM 8) AS INTEGER)), 0) + 1
    INTO next_num
    FROM denials
    WHERE denial_number LIKE 'DEN-' || year_prefix || '-%';

    denial_num := 'DEN-' || year_prefix || '-' || LPAD(next_num::TEXT, 6, '0');
    RETURN denial_num;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate denial number
CREATE OR REPLACE FUNCTION set_denial_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.denial_number IS NULL OR NEW.denial_number = '' THEN
        NEW.denial_number := generate_denial_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_denial_number
    BEFORE INSERT ON denials
    FOR EACH ROW
    EXECUTE FUNCTION set_denial_number();

-- Create function to automatically set appeal deadline based on denial date
-- Default to 90 days from denial date if not specified
CREATE OR REPLACE FUNCTION set_appeal_deadline()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.appeal_deadline IS NULL THEN
        NEW.appeal_deadline := NEW.denial_date + INTERVAL '90 days';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_appeal_deadline
    BEFORE INSERT ON denials
    FOR EACH ROW
    EXECUTE FUNCTION set_appeal_deadline();

-- Add comments for documentation
COMMENT ON TABLE denials IS 'Tracks claim denials and appeal management';
COMMENT ON COLUMN denials.denial_number IS 'Unique identifier for the denial (e.g., DEN-2024-000001)';
COMMENT ON COLUMN denials.denial_category IS 'Category of denial reason for reporting and analysis';
COMMENT ON COLUMN denials.appeal_deadline IS 'Deadline for submitting appeal (auto-calculated as 90 days from denial date)';
COMMENT ON COLUMN denials.supporting_documents IS 'JSON array of document references for appeal';
COMMENT ON COLUMN denials.priority IS 'Priority level for denial management';
