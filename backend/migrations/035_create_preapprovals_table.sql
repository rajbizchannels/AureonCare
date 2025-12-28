-- Migration: Create preapprovals table for prior authorization requests
-- This table stores preapproval/prior authorization requests for treatments

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS preapprovals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    preapproval_number VARCHAR(100) UNIQUE NOT NULL,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    insurance_payer_id UUID REFERENCES insurance_payers(id) ON DELETE SET NULL,

    -- Treatment information
    requested_service VARCHAR(255) NOT NULL,
    diagnosis_codes JSONB,
    procedure_codes JSONB,
    service_start_date DATE,
    service_end_date DATE,
    estimated_cost DECIMAL(10, 2),

    -- Authorization details
    authorization_number VARCHAR(100),
    status VARCHAR(50) DEFAULT 'Pending', -- Pending, Approved, Denied, Expired

    -- Clearinghouse integration fields
    clearinghouse_request_id VARCHAR(255),
    clearinghouse_status VARCHAR(50),
    submitted_to_clearinghouse_at TIMESTAMP,
    clearinghouse_response JSONB,

    -- Approval details
    approved_by VARCHAR(255),
    approved_at TIMESTAMP,
    approval_valid_until DATE,
    denied_reason TEXT,

    -- Additional information
    clinical_notes TEXT,
    supporting_documents JSONB,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add index for faster lookups
CREATE INDEX idx_preapprovals_patient_id ON preapprovals(patient_id);
CREATE INDEX idx_preapprovals_insurance_payer_id ON preapprovals(insurance_payer_id);
CREATE INDEX idx_preapprovals_status ON preapprovals(status);
CREATE INDEX idx_preapprovals_preapproval_number ON preapprovals(preapproval_number);

-- Add trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_preapprovals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_preapprovals_updated_at
    BEFORE UPDATE ON preapprovals
    FOR EACH ROW
    EXECUTE FUNCTION update_preapprovals_updated_at();

-- Add preapproval_id to claims table to link claims with preapprovals
ALTER TABLE claims ADD COLUMN IF NOT EXISTS preapproval_id UUID REFERENCES preapprovals(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_claims_preapproval_id ON claims(preapproval_id);
