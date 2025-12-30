-- Migration 036: Create Payment Postings Table
-- This table tracks insurance payments posted to claims

-- Create payment_postings table
CREATE TABLE IF NOT EXISTS payment_postings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    posting_number VARCHAR(50) UNIQUE NOT NULL,
    claim_id INTEGER REFERENCES claims(id) ON DELETE SET NULL,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    insurance_payer_id UUID REFERENCES insurance_payers(id) ON DELETE SET NULL,

    -- Payment details
    check_number VARCHAR(100),
    check_date DATE,
    payment_amount DECIMAL(10, 2) NOT NULL,
    allowed_amount DECIMAL(10, 2),
    deductible_amount DECIMAL(10, 2) DEFAULT 0,
    coinsurance_amount DECIMAL(10, 2) DEFAULT 0,
    copay_amount DECIMAL(10, 2) DEFAULT 0,

    -- Adjustment details
    adjustment_amount DECIMAL(10, 2) DEFAULT 0,
    adjustment_reason VARCHAR(255),
    adjustment_code VARCHAR(50),

    -- Status and tracking
    posting_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'posted' CHECK (status IN ('posted', 'pending', 'reversed', 'voided')),
    payment_method VARCHAR(50) DEFAULT 'check' CHECK (payment_method IN ('check', 'eft', 'credit_card', 'cash', 'other')),

    -- ERA/EOB details
    era_number VARCHAR(100),
    eob_number VARCHAR(100),

    -- Notes
    notes TEXT,
    internal_notes TEXT,

    -- Audit fields
    posted_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_payment_postings_claim_id ON payment_postings(claim_id);
CREATE INDEX IF NOT EXISTS idx_payment_postings_patient_id ON payment_postings(patient_id);
CREATE INDEX IF NOT EXISTS idx_payment_postings_insurance_payer_id ON payment_postings(insurance_payer_id);
CREATE INDEX IF NOT EXISTS idx_payment_postings_posting_date ON payment_postings(posting_date);
CREATE INDEX IF NOT EXISTS idx_payment_postings_status ON payment_postings(status);
CREATE INDEX IF NOT EXISTS idx_payment_postings_check_number ON payment_postings(check_number);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_payment_postings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_payment_postings_updated_at
    BEFORE UPDATE ON payment_postings
    FOR EACH ROW
    EXECUTE FUNCTION update_payment_postings_updated_at();

-- Create function to generate posting number
CREATE OR REPLACE FUNCTION generate_posting_number()
RETURNS VARCHAR(50) AS $$
DECLARE
    next_num INTEGER;
    year_prefix VARCHAR(4);
    posting_num VARCHAR(50);
BEGIN
    year_prefix := TO_CHAR(CURRENT_DATE, 'YYYY');

    SELECT COALESCE(MAX(CAST(SUBSTRING(posting_number FROM 9) AS INTEGER)), 0) + 1
    INTO next_num
    FROM payment_postings
    WHERE posting_number LIKE 'POST-' || year_prefix || '-%';

    posting_num := 'POST-' || year_prefix || '-' || LPAD(next_num::TEXT, 6, '0');
    RETURN posting_num;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate posting number
CREATE OR REPLACE FUNCTION set_posting_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.posting_number IS NULL OR NEW.posting_number = '' THEN
        NEW.posting_number := generate_posting_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_posting_number
    BEFORE INSERT ON payment_postings
    FOR EACH ROW
    EXECUTE FUNCTION set_posting_number();

-- Add comments for documentation
COMMENT ON TABLE payment_postings IS 'Tracks insurance payment postings to claims';
COMMENT ON COLUMN payment_postings.posting_number IS 'Unique identifier for the payment posting (e.g., POST-2024-000001)';
COMMENT ON COLUMN payment_postings.allowed_amount IS 'Amount allowed by insurance for the claim';
COMMENT ON COLUMN payment_postings.adjustment_amount IS 'Amount adjusted (write-off)';
COMMENT ON COLUMN payment_postings.era_number IS 'Electronic Remittance Advice number';
COMMENT ON COLUMN payment_postings.eob_number IS 'Explanation of Benefits number';
