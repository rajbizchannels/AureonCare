-- Migration to add vendor integration settings table
-- This table stores configuration for various healthcare vendor integrations
-- including Surescripts (ePrescribe), Labcorp (Lab orders), and Optum (Clearinghouse)

CREATE TABLE IF NOT EXISTS vendor_integration_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_type VARCHAR(50) NOT NULL UNIQUE, -- 'surescripts', 'labcorp', 'optum'
    is_enabled BOOLEAN DEFAULT false,

    -- Common authentication fields
    api_key VARCHAR(500),
    api_secret VARCHAR(500),
    client_id VARCHAR(500),
    client_secret VARCHAR(500),
    username VARCHAR(255),
    password VARCHAR(500),

    -- Endpoint configuration
    base_url VARCHAR(500),
    sandbox_mode BOOLEAN DEFAULT true,

    -- Vendor-specific settings (JSONB for flexibility)
    settings JSONB DEFAULT '{}',

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_tested_at TIMESTAMP,
    test_status VARCHAR(50), -- 'success', 'failed', 'not_tested'
    test_message TEXT
);

-- Create index on vendor_type for faster lookups
CREATE INDEX IF NOT EXISTS idx_vendor_integration_vendor_type ON vendor_integration_settings(vendor_type);

-- Create index on is_enabled for faster filtering
CREATE INDEX IF NOT EXISTS idx_vendor_integration_enabled ON vendor_integration_settings(is_enabled);

-- Insert default records for the three vendors
INSERT INTO vendor_integration_settings (vendor_type, is_enabled, sandbox_mode) VALUES
    ('surescripts', false, true),
    ('labcorp', false, true),
    ('optum', false, true)
ON CONFLICT (vendor_type) DO NOTHING;

-- Create vendor transaction log table to track all API interactions
CREATE TABLE IF NOT EXISTS vendor_transaction_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_type VARCHAR(50) NOT NULL,
    transaction_type VARCHAR(100) NOT NULL, -- 'prescription_send', 'lab_order', 'claim_submit', etc.

    -- Request/Response tracking
    request_data JSONB,
    response_data JSONB,
    status VARCHAR(50), -- 'success', 'failed', 'pending'
    error_message TEXT,

    -- Reference IDs
    external_id VARCHAR(255), -- Vendor's transaction ID
    internal_reference_id UUID, -- Our internal record ID (prescription_id, claim_id, etc.)
    patient_id UUID REFERENCES users(id),

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Create indexes for transaction log
CREATE INDEX IF NOT EXISTS idx_vendor_transaction_vendor_type ON vendor_transaction_log(vendor_type);
CREATE INDEX IF NOT EXISTS idx_vendor_transaction_status ON vendor_transaction_log(status);
CREATE INDEX IF NOT EXISTS idx_vendor_transaction_patient ON vendor_transaction_log(patient_id);
CREATE INDEX IF NOT EXISTS idx_vendor_transaction_internal_ref ON vendor_transaction_log(internal_reference_id);
CREATE INDEX IF NOT EXISTS idx_vendor_transaction_created ON vendor_transaction_log(created_at);

-- Add vendor integration fields to existing tables

-- Add vendor fields to prescriptions table for Surescripts integration
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'prescriptions' AND column_name = 'vendor_prescription_id') THEN
        ALTER TABLE prescriptions
        ADD COLUMN vendor_prescription_id VARCHAR(255),
        ADD COLUMN vendor_status VARCHAR(50),
        ADD COLUMN sent_to_vendor_at TIMESTAMP,
        ADD COLUMN vendor_response JSONB;
    END IF;
END $$;

-- Add vendor fields to claims table for Optum integration
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'claims' AND column_name = 'clearinghouse_claim_id') THEN
        ALTER TABLE claims
        ADD COLUMN clearinghouse_claim_id VARCHAR(255),
        ADD COLUMN clearinghouse_status VARCHAR(50),
        ADD COLUMN submitted_to_clearinghouse_at TIMESTAMP,
        ADD COLUMN clearinghouse_response JSONB;
    END IF;
END $$;

-- Create lab orders table for Labcorp integration
CREATE TABLE IF NOT EXISTS lab_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider_id UUID NOT NULL REFERENCES users(id),

    -- Order details
    order_number VARCHAR(100) UNIQUE,
    order_type VARCHAR(50) DEFAULT 'lab_test', -- 'lab_test', 'pathology', 'genetic_test'
    priority VARCHAR(20) DEFAULT 'routine', -- 'stat', 'urgent', 'routine'
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'sent_to_lab', 'in_progress', 'completed', 'cancelled'

    -- Lab vendor integration
    vendor_order_id VARCHAR(255), -- Labcorp's order ID
    vendor_status VARCHAR(50),
    sent_to_vendor_at TIMESTAMP,
    vendor_response JSONB,

    -- Clinical information
    diagnosis_codes JSONB, -- Array of ICD-10 codes
    test_codes JSONB, -- Array of CPT/LOINC codes for tests ordered
    clinical_notes TEXT,
    special_instructions TEXT,

    -- Specimen information
    specimen_type VARCHAR(100),
    collection_date TIMESTAMP,
    collection_site VARCHAR(255),

    -- Results
    results_data JSONB,
    results_received_at TIMESTAMP,
    results_reviewed_by UUID REFERENCES users(id),
    results_reviewed_at TIMESTAMP,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for lab orders
CREATE INDEX IF NOT EXISTS idx_lab_orders_patient ON lab_orders(patient_id);
CREATE INDEX IF NOT EXISTS idx_lab_orders_provider ON lab_orders(provider_id);
CREATE INDEX IF NOT EXISTS idx_lab_orders_status ON lab_orders(status);
CREATE INDEX IF NOT EXISTS idx_lab_orders_order_number ON lab_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_lab_orders_vendor_order ON lab_orders(vendor_order_id);
CREATE INDEX IF NOT EXISTS idx_lab_orders_created ON lab_orders(created_at);

COMMENT ON TABLE vendor_integration_settings IS 'Stores configuration and credentials for healthcare vendor integrations (Surescripts, Labcorp, Optum)';
COMMENT ON TABLE vendor_transaction_log IS 'Audit log for all vendor API transactions';
COMMENT ON TABLE lab_orders IS 'Laboratory test orders with Labcorp integration support';
