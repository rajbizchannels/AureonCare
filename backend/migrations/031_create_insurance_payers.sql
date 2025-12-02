-- Create insurance payers table for claims management
CREATE TABLE IF NOT EXISTS insurance_payers (
    id SERIAL PRIMARY KEY,
    payer_id VARCHAR(50) UNIQUE NOT NULL, -- e.g., BC001, AE001
    name VARCHAR(255) NOT NULL,
    payer_type VARCHAR(50) DEFAULT 'insurance', -- 'insurance', 'government', 'self-pay'
    phone VARCHAR(50),
    email VARCHAR(255),
    website VARCHAR(255),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(50),
    zip_code VARCHAR(20),
    contact_person VARCHAR(255),
    contact_phone VARCHAR(50),
    contact_email VARCHAR(255),
    claim_submission_method VARCHAR(50), -- 'electronic', 'paper', 'portal'
    claim_submission_address TEXT,
    electronic_payer_id VARCHAR(100), -- For EDI submissions
    timely_filing_limit INTEGER DEFAULT 365, -- Days
    prior_authorization_required BOOLEAN DEFAULT FALSE,
    accepts_assignment BOOLEAN DEFAULT TRUE,
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_insurance_payers_payer_id ON insurance_payers(payer_id);
CREATE INDEX IF NOT EXISTS idx_insurance_payers_name ON insurance_payers(name);
CREATE INDEX IF NOT EXISTS idx_insurance_payers_active ON insurance_payers(is_active);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_insurance_payers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER insurance_payers_updated_at
BEFORE UPDATE ON insurance_payers
FOR EACH ROW
EXECUTE FUNCTION update_insurance_payers_updated_at();

-- Insert default insurance payers
INSERT INTO insurance_payers (payer_id, name, payer_type, phone, website, claim_submission_method, is_active) VALUES
    ('BC001', 'Blue Cross Blue Shield', 'insurance', '1-800-262-2583', 'www.bcbs.com', 'electronic', true),
    ('AE001', 'Aetna', 'insurance', '1-800-872-3862', 'www.aetna.com', 'electronic', true),
    ('UH001', 'UnitedHealthcare', 'insurance', '1-877-842-3210', 'www.uhc.com', 'electronic', true),
    ('CG001', 'Cigna', 'insurance', '1-800-244-6224', 'www.cigna.com', 'electronic', true),
    ('HU001', 'Humana', 'insurance', '1-800-448-6262', 'www.humana.com', 'electronic', true),
    ('MC001', 'Medicare', 'government', '1-800-633-4227', 'www.medicare.gov', 'electronic', true),
    ('MD001', 'Medicaid', 'government', '1-800-362-2827', 'www.medicaid.gov', 'electronic', true),
    ('KP001', 'Kaiser Permanente', 'insurance', '1-800-464-4000', 'www.kp.org', 'portal', true),
    ('AN001', 'Anthem', 'insurance', '1-800-331-1476', 'www.anthem.com', 'electronic', true),
    ('WC001', 'WellCare', 'insurance', '1-866-530-9491', 'www.wellcare.com', 'electronic', true),
    ('SP001', 'Self-Pay', 'self-pay', NULL, NULL, 'paper', true)
ON CONFLICT (payer_id) DO NOTHING;

-- Add comments
COMMENT ON TABLE insurance_payers IS 'Insurance payers and organizations for claims submission';
COMMENT ON COLUMN insurance_payers.payer_id IS 'Unique identifier for the payer (e.g., BC001)';
COMMENT ON COLUMN insurance_payers.electronic_payer_id IS 'EDI payer ID for electronic claims submission';
COMMENT ON COLUMN insurance_payers.timely_filing_limit IS 'Number of days within which claims must be filed';

SELECT
    'Insurance payers table created successfully' as status,
    (SELECT COUNT(*) FROM insurance_payers) as total_payers;
