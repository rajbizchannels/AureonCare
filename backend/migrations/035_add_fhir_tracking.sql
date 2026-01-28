-- Migration: Add FHIR Tracking for Prescriptions and Lab Orders
-- Description: Comprehensive tracking system for FHIR resources with error handling and action suggestions

-- ============================================================================
-- 1. FHIR Tracking Table
-- ============================================================================
-- Main tracking table for FHIR resources (MedicationRequest and ServiceRequest)
CREATE TABLE IF NOT EXISTS fhir_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Resource identification
    fhir_resource_id UUID REFERENCES fhir_resources(id) ON DELETE CASCADE,
    resource_type VARCHAR(50) NOT NULL, -- 'MedicationRequest' or 'ServiceRequest'
    resource_reference VARCHAR(255) NOT NULL, -- Internal reference (prescription_id or lab_order_id)

    -- Status tracking
    current_status VARCHAR(50) NOT NULL, -- Current FHIR status
    previous_status VARCHAR(50), -- Previous status for audit trail
    status_reason TEXT, -- Reason for current status

    -- FHIR specific fields
    fhir_status VARCHAR(50), -- Official FHIR status (active, on-hold, cancelled, completed, etc.)
    intent VARCHAR(50), -- FHIR intent (proposal, plan, order, original-order, reflex-order, etc.)
    priority VARCHAR(20), -- routine, urgent, asap, stat

    -- Tracking metadata
    tracking_number VARCHAR(100) UNIQUE, -- Unique tracking number for end-to-end visibility

    -- Vendor integration
    vendor_name VARCHAR(50), -- 'surescripts', 'labcorp', etc.
    vendor_tracking_id VARCHAR(255), -- Vendor's tracking/order ID
    vendor_status VARCHAR(50), -- Vendor-specific status
    sent_to_vendor_at TIMESTAMP,
    vendor_last_updated TIMESTAMP,

    -- Error handling
    has_errors BOOLEAN DEFAULT FALSE,
    error_count INTEGER DEFAULT 0,
    last_error_message TEXT,
    last_error_code VARCHAR(50),
    last_error_at TIMESTAMP,
    error_details JSONB, -- Detailed error information

    -- Action suggestions
    suggested_actions JSONB, -- Array of suggested actions to fix errors
    action_required BOOLEAN DEFAULT FALSE,
    action_deadline TIMESTAMP,

    -- Lifecycle tracking
    initiated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    cancelled_at TIMESTAMP,

    -- Audit fields
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Indexes for performance
    CONSTRAINT check_resource_type CHECK (resource_type IN ('MedicationRequest', 'ServiceRequest'))
);

-- Indexes for fhir_tracking
CREATE INDEX idx_fhir_tracking_resource ON fhir_tracking(fhir_resource_id);
CREATE INDEX idx_fhir_tracking_reference ON fhir_tracking(resource_type, resource_reference);
CREATE INDEX idx_fhir_tracking_status ON fhir_tracking(current_status);
CREATE INDEX idx_fhir_tracking_vendor ON fhir_tracking(vendor_name, vendor_tracking_id);
CREATE INDEX idx_fhir_tracking_number ON fhir_tracking(tracking_number);
CREATE INDEX idx_fhir_tracking_errors ON fhir_tracking(has_errors, action_required);
CREATE INDEX idx_fhir_tracking_created_at ON fhir_tracking(created_at);

-- ============================================================================
-- 2. FHIR Tracking Events Table
-- ============================================================================
-- Event log for all status changes and interactions
CREATE TABLE IF NOT EXISTS fhir_tracking_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Link to tracking
    fhir_tracking_id UUID NOT NULL REFERENCES fhir_tracking(id) ON DELETE CASCADE,

    -- Event details
    event_type VARCHAR(50) NOT NULL, -- 'status_change', 'vendor_sync', 'error', 'retry', 'manual_intervention'
    event_category VARCHAR(50), -- 'lifecycle', 'integration', 'error_handling', 'user_action'

    -- Status transition
    from_status VARCHAR(50),
    to_status VARCHAR(50),

    -- Event data
    event_description TEXT NOT NULL,
    event_data JSONB, -- Additional event metadata

    -- Error information (if applicable)
    is_error BOOLEAN DEFAULT FALSE,
    error_code VARCHAR(50),
    error_message TEXT,
    error_severity VARCHAR(20), -- 'info', 'warning', 'error', 'critical'

    -- Vendor information (if applicable)
    vendor_name VARCHAR(50),
    vendor_response JSONB,

    -- Action tracking
    action_taken TEXT,
    action_result VARCHAR(50), -- 'success', 'failed', 'pending'

    -- Audit
    triggered_by UUID REFERENCES users(id), -- User or system that triggered event
    triggered_by_system VARCHAR(100), -- System component that triggered event
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT check_event_type CHECK (event_type IN (
        'status_change', 'vendor_sync', 'error', 'retry', 'manual_intervention',
        'created', 'updated', 'cancelled', 'completed', 'sent_to_vendor',
        'vendor_response', 'error_resolved', 'action_applied'
    ))
);

-- Indexes for fhir_tracking_events
CREATE INDEX idx_fhir_tracking_events_tracking_id ON fhir_tracking_events(fhir_tracking_id);
CREATE INDEX idx_fhir_tracking_events_type ON fhir_tracking_events(event_type);
CREATE INDEX idx_fhir_tracking_events_created_at ON fhir_tracking_events(created_at);
CREATE INDEX idx_fhir_tracking_events_errors ON fhir_tracking_events(is_error, error_severity);

-- ============================================================================
-- 3. FHIR Error Actions Lookup Table
-- ============================================================================
-- Predefined actions for common FHIR errors
CREATE TABLE IF NOT EXISTS fhir_error_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Error identification
    error_code VARCHAR(50) UNIQUE NOT NULL,
    error_pattern TEXT, -- Regex pattern to match error messages
    resource_type VARCHAR(50), -- NULL means applies to all types
    vendor_name VARCHAR(50), -- NULL means applies to all vendors

    -- Error details
    error_title VARCHAR(255) NOT NULL,
    error_description TEXT,
    error_severity VARCHAR(20) DEFAULT 'error', -- 'info', 'warning', 'error', 'critical'

    -- Suggested actions
    suggested_actions JSONB NOT NULL, -- Array of action objects with priority and description
    auto_retry BOOLEAN DEFAULT FALSE,
    max_retry_attempts INTEGER DEFAULT 0,
    retry_delay_seconds INTEGER DEFAULT 60,

    -- Resolution
    requires_manual_intervention BOOLEAN DEFAULT FALSE,
    escalation_required BOOLEAN DEFAULT FALSE,

    -- Documentation
    resolution_guide TEXT,
    documentation_url VARCHAR(500),

    -- Metadata
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for error lookup
CREATE INDEX idx_fhir_error_actions_code ON fhir_error_actions(error_code);
CREATE INDEX idx_fhir_error_actions_resource ON fhir_error_actions(resource_type);
CREATE INDEX idx_fhir_error_actions_vendor ON fhir_error_actions(vendor_name);

-- ============================================================================
-- 4. Insert Common Error Actions
-- ============================================================================

INSERT INTO fhir_error_actions (error_code, error_pattern, resource_type, vendor_name, error_title, error_description, error_severity, suggested_actions, auto_retry, max_retry_attempts, requires_manual_intervention, resolution_guide) VALUES

-- Prescription/MedicationRequest Errors
('MED_REQ_INVALID_PATIENT', 'patient.*not found|invalid patient', 'MedicationRequest', NULL, 'Invalid Patient Reference', 'The patient reference in the MedicationRequest is invalid or not found.', 'error',
'[
  {"priority": 1, "action": "Verify patient ID exists in system", "type": "verification"},
  {"priority": 2, "action": "Check patient FHIR resource synchronization", "type": "sync"},
  {"priority": 3, "action": "Update patient reference in prescription", "type": "update"}
]'::jsonb, FALSE, 0, TRUE, 'Verify the patient exists in the system and has a valid FHIR Patient resource. Update the prescription with the correct patient reference.'),

('MED_REQ_INVALID_MEDICATION', 'medication.*not found|invalid medication|unknown drug', 'MedicationRequest', NULL, 'Invalid Medication Code', 'The medication code or reference is invalid or not recognized.', 'error',
'[
  {"priority": 1, "action": "Verify medication code against formulary", "type": "verification"},
  {"priority": 2, "action": "Check RxNorm or NDC code validity", "type": "validation"},
  {"priority": 3, "action": "Update medication with valid code", "type": "update"},
  {"priority": 4, "action": "Contact pharmacy for alternative codes", "type": "communication"}
]'::jsonb, FALSE, 0, TRUE, 'Ensure the medication uses valid RxNorm or NDC codes. Check with the pharmacy system for accepted medication codes.'),

('MED_REQ_MISSING_PRESCRIBER', 'prescriber.*required|missing prescriber|invalid prescriber', 'MedicationRequest', NULL, 'Missing or Invalid Prescriber', 'The prescriber information is missing or invalid.', 'critical',
'[
  {"priority": 1, "action": "Add prescriber reference to MedicationRequest", "type": "update"},
  {"priority": 2, "action": "Verify prescriber has valid NPI", "type": "verification"},
  {"priority": 3, "action": "Check prescriber credentials and licenses", "type": "validation"}
]'::jsonb, FALSE, 0, TRUE, 'Add valid prescriber information including NPI number. Ensure prescriber has appropriate credentials for e-prescribing.'),

('MED_REQ_PHARMACY_ERROR', 'pharmacy.*not found|invalid pharmacy|pharmacy unavailable', 'MedicationRequest', 'surescripts', 'Pharmacy System Error', 'Unable to connect to pharmacy or pharmacy system is unavailable.', 'warning',
'[
  {"priority": 1, "action": "Retry sending to pharmacy", "type": "retry"},
  {"priority": 2, "action": "Verify pharmacy NCPDP number", "type": "verification"},
  {"priority": 3, "action": "Contact pharmacy to confirm system status", "type": "communication"},
  {"priority": 4, "action": "Send to alternative pharmacy", "type": "alternative"}
]'::jsonb, TRUE, 3, FALSE, 'Wait and retry. If problem persists, verify pharmacy details or select an alternative pharmacy.'),

('MED_REQ_VALIDATION_ERROR', 'validation.*failed|invalid format|missing required field', 'MedicationRequest', NULL, 'FHIR Validation Error', 'The MedicationRequest resource failed FHIR validation.', 'error',
'[
  {"priority": 1, "action": "Review FHIR validation errors", "type": "validation"},
  {"priority": 2, "action": "Ensure all required fields are populated", "type": "update"},
  {"priority": 3, "action": "Check dosage and timing instructions format", "type": "validation"},
  {"priority": 4, "action": "Validate against FHIR R4 schema", "type": "validation"}
]'::jsonb, FALSE, 0, TRUE, 'Review the FHIR validation errors and ensure all required fields are properly formatted according to FHIR R4 specification.'),

-- Lab Order/ServiceRequest Errors
('SVC_REQ_INVALID_TEST_CODE', 'test.*not found|invalid test|unknown test code', 'ServiceRequest', NULL, 'Invalid Test Code', 'The laboratory test code is invalid or not recognized.', 'error',
'[
  {"priority": 1, "action": "Verify test code against LOINC database", "type": "verification"},
  {"priority": 2, "action": "Check lab test catalog for valid codes", "type": "validation"},
  {"priority": 3, "action": "Update with correct LOINC code", "type": "update"},
  {"priority": 4, "action": "Contact laboratory for test code mapping", "type": "communication"}
]'::jsonb, FALSE, 0, TRUE, 'Verify the test uses valid LOINC codes. Contact the laboratory to confirm accepted test codes.'),

('SVC_REQ_SPECIMEN_ERROR', 'specimen.*invalid|specimen type.*required|collection.*failed', 'ServiceRequest', NULL, 'Specimen Collection Issue', 'Problem with specimen type or collection information.', 'error',
'[
  {"priority": 1, "action": "Specify correct specimen type (blood, urine, etc.)", "type": "update"},
  {"priority": 2, "action": "Add specimen collection details", "type": "update"},
  {"priority": 3, "action": "Verify specimen requirements for ordered tests", "type": "verification"},
  {"priority": 4, "action": "Reschedule specimen collection if needed", "type": "action"}
]'::jsonb, FALSE, 0, TRUE, 'Update the ServiceRequest with correct specimen type and collection information required for the ordered tests.'),

('SVC_REQ_LAB_UNAVAILABLE', 'lab.*unavailable|connection.*failed|timeout', 'ServiceRequest', 'labcorp', 'Laboratory System Unavailable', 'Unable to connect to laboratory system.', 'warning',
'[
  {"priority": 1, "action": "Retry sending to laboratory", "type": "retry"},
  {"priority": 2, "action": "Check laboratory system status", "type": "verification"},
  {"priority": 3, "action": "Queue for automatic retry", "type": "queue"},
  {"priority": 4, "action": "Contact laboratory IT support", "type": "communication"}
]'::jsonb, TRUE, 5, FALSE, 'Laboratory system is temporarily unavailable. Order will be automatically retried. Monitor status or contact laboratory.'),

('SVC_REQ_INSURANCE_ERROR', 'insurance.*invalid|authorization.*required|coverage.*denied', 'ServiceRequest', NULL, 'Insurance Authorization Issue', 'Lab order requires insurance authorization or has coverage issues.', 'warning',
'[
  {"priority": 1, "action": "Verify patient insurance information", "type": "verification"},
  {"priority": 2, "action": "Submit prior authorization request", "type": "action"},
  {"priority": 3, "action": "Check if test requires pre-approval", "type": "verification"},
  {"priority": 4, "action": "Inform patient of potential out-of-pocket costs", "type": "communication"}
]'::jsonb, FALSE, 0, TRUE, 'Review insurance requirements for the ordered tests. Submit prior authorization if required.'),

('SVC_REQ_PRIORITY_ERROR', 'priority.*invalid|stat order.*cannot be processed', 'ServiceRequest', NULL, 'Invalid Priority Setting', 'The order priority is invalid or cannot be fulfilled.', 'warning',
'[
  {"priority": 1, "action": "Change priority to routine if STAT is not available", "type": "update"},
  {"priority": 2, "action": "Contact laboratory about STAT capabilities", "type": "communication"},
  {"priority": 3, "action": "Consider alternative laboratory for urgent tests", "type": "alternative"}
]'::jsonb, FALSE, 0, TRUE, 'Adjust the order priority or contact the laboratory to confirm STAT order capabilities.'),

-- General FHIR Errors
('FHIR_AUTH_ERROR', 'authentication.*failed|unauthorized|invalid.*credentials', NULL, NULL, 'Authentication Failed', 'Failed to authenticate with external system.', 'critical',
'[
  {"priority": 1, "action": "Verify API credentials are current", "type": "verification"},
  {"priority": 2, "action": "Check if API key has expired", "type": "verification"},
  {"priority": 3, "action": "Regenerate authentication tokens", "type": "action"},
  {"priority": 4, "action": "Contact vendor support for access issues", "type": "communication"}
]'::jsonb, FALSE, 0, TRUE, 'Authentication credentials may have expired. Verify and update API credentials in vendor integration settings.'),

('FHIR_NETWORK_ERROR', 'network.*error|connection.*refused|timeout|socket', NULL, NULL, 'Network Connection Error', 'Unable to connect to external system due to network issues.', 'warning',
'[
  {"priority": 1, "action": "Retry the request", "type": "retry"},
  {"priority": 2, "action": "Check network connectivity", "type": "verification"},
  {"priority": 3, "action": "Verify firewall settings", "type": "verification"},
  {"priority": 4, "action": "Contact IT support if issue persists", "type": "communication"}
]'::jsonb, TRUE, 5, FALSE, 'Temporary network issue. Request will be automatically retried. Contact IT support if problem persists.'),

('FHIR_RATE_LIMIT', 'rate limit.*exceeded|too many requests|quota.*exceeded', NULL, NULL, 'API Rate Limit Exceeded', 'Too many requests sent to external system.', 'warning',
'[
  {"priority": 1, "action": "Wait before retrying (automatic)", "type": "retry"},
  {"priority": 2, "action": "Review and optimize API usage patterns", "type": "optimization"},
  {"priority": 3, "action": "Contact vendor to increase rate limits", "type": "communication"}
]'::jsonb, TRUE, 3, FALSE, 'API rate limit exceeded. System will automatically retry after delay. Consider optimizing request frequency.'),

('FHIR_SYNTAX_ERROR', 'syntax.*error|malformed.*json|invalid.*xml', NULL, NULL, 'FHIR Resource Syntax Error', 'The FHIR resource has syntax errors.', 'error',
'[
  {"priority": 1, "action": "Validate FHIR resource against schema", "type": "validation"},
  {"priority": 2, "action": "Check for malformed JSON/XML", "type": "validation"},
  {"priority": 3, "action": "Review recent code changes", "type": "review"},
  {"priority": 4, "action": "Contact development team", "type": "communication"}
]'::jsonb, FALSE, 0, TRUE, 'FHIR resource contains syntax errors. Validate the resource structure and fix formatting issues.');

-- ============================================================================
-- 5. Add tracking fields to existing tables
-- ============================================================================

-- Add tracking reference to prescriptions table (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='prescriptions' AND column_name='fhir_tracking_id') THEN
        ALTER TABLE prescriptions ADD COLUMN fhir_tracking_id UUID REFERENCES fhir_tracking(id);
        CREATE INDEX idx_prescriptions_fhir_tracking ON prescriptions(fhir_tracking_id);
    END IF;
END $$;

-- Add tracking reference to lab_orders table (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='lab_orders' AND column_name='fhir_tracking_id') THEN
        ALTER TABLE lab_orders ADD COLUMN fhir_tracking_id UUID REFERENCES fhir_tracking(id);
        CREATE INDEX idx_lab_orders_fhir_tracking ON lab_orders(fhir_tracking_id);
    END IF;
END $$;

-- ============================================================================
-- 6. Create helper functions
-- ============================================================================

-- Function to generate unique tracking number
CREATE OR REPLACE FUNCTION generate_fhir_tracking_number(resource_type VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
    prefix VARCHAR(4);
    timestamp_part VARCHAR(14);
    random_part VARCHAR(6);
BEGIN
    -- Set prefix based on resource type
    prefix := CASE resource_type
        WHEN 'MedicationRequest' THEN 'RX'
        WHEN 'ServiceRequest' THEN 'LAB'
        ELSE 'FHIR'
    END;

    -- Generate timestamp part (YYYYMMDDHHmmss)
    timestamp_part := TO_CHAR(NOW(), 'YYYYMMDDHH24MISS');

    -- Generate random part
    random_part := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));

    RETURN prefix || '-' || timestamp_part || '-' || random_part;
END;
$$ LANGUAGE plpgsql;

-- Function to log tracking event
CREATE OR REPLACE FUNCTION log_fhir_tracking_event(
    p_tracking_id UUID,
    p_event_type VARCHAR,
    p_event_description TEXT,
    p_from_status VARCHAR DEFAULT NULL,
    p_to_status VARCHAR DEFAULT NULL,
    p_is_error BOOLEAN DEFAULT FALSE,
    p_error_code VARCHAR DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL,
    p_event_data JSONB DEFAULT NULL,
    p_triggered_by UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    event_id UUID;
BEGIN
    INSERT INTO fhir_tracking_events (
        fhir_tracking_id,
        event_type,
        event_description,
        from_status,
        to_status,
        is_error,
        error_code,
        error_message,
        event_data,
        triggered_by
    ) VALUES (
        p_tracking_id,
        p_event_type,
        p_event_description,
        p_from_status,
        p_to_status,
        p_is_error,
        p_error_code,
        p_error_message,
        p_event_data,
        p_triggered_by
    ) RETURNING id INTO event_id;

    RETURN event_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. Create triggers for automatic event logging
-- ============================================================================

-- Trigger function to log status changes
CREATE OR REPLACE FUNCTION trigger_log_fhir_tracking_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE' AND OLD.current_status != NEW.current_status) THEN
        PERFORM log_fhir_tracking_event(
            NEW.id,
            'status_change',
            'Status changed from ' || COALESCE(OLD.current_status, 'NULL') || ' to ' || NEW.current_status,
            OLD.current_status,
            NEW.current_status,
            NEW.has_errors,
            NEW.last_error_code,
            NEW.last_error_message,
            jsonb_build_object(
                'previous_status', OLD.current_status,
                'new_status', NEW.current_status,
                'status_reason', NEW.status_reason
            ),
            NEW.updated_by
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS fhir_tracking_status_change_trigger ON fhir_tracking;
CREATE TRIGGER fhir_tracking_status_change_trigger
    AFTER UPDATE ON fhir_tracking
    FOR EACH ROW
    EXECUTE FUNCTION trigger_log_fhir_tracking_status_change();

-- ============================================================================
-- 8. Create views for easier querying
-- ============================================================================

-- View for active prescriptions with tracking
CREATE OR REPLACE VIEW v_prescription_tracking AS
SELECT
    p.id as prescription_id,
    p.patient_id,
    p.provider_id,
    p.medication_name,
    p.status as prescription_status,
    ft.id as tracking_id,
    ft.tracking_number,
    ft.current_status as tracking_status,
    ft.fhir_status,
    ft.vendor_name,
    ft.vendor_tracking_id,
    ft.vendor_status,
    ft.has_errors,
    ft.error_count,
    ft.last_error_message,
    ft.suggested_actions,
    ft.action_required,
    ft.initiated_at,
    ft.completed_at,
    p.created_at as prescription_created_at
FROM prescriptions p
LEFT JOIN fhir_tracking ft ON p.fhir_tracking_id = ft.id
WHERE p.status != 'Deleted';

-- View for active lab orders with tracking
CREATE OR REPLACE VIEW v_lab_order_tracking AS
SELECT
    lo.id as lab_order_id,
    lo.patient_id,
    lo.provider_id,
    lo.order_number,
    lo.order_type,
    lo.status as lab_order_status,
    ft.id as tracking_id,
    ft.tracking_number,
    ft.current_status as tracking_status,
    ft.fhir_status,
    ft.priority,
    ft.vendor_name,
    ft.vendor_tracking_id,
    ft.vendor_status,
    ft.has_errors,
    ft.error_count,
    ft.last_error_message,
    ft.suggested_actions,
    ft.action_required,
    ft.initiated_at,
    ft.completed_at,
    lo.created_at as order_created_at
FROM lab_orders lo
LEFT JOIN fhir_tracking ft ON lo.fhir_tracking_id = ft.id;

-- View for tracking with error details and actions
CREATE OR REPLACE VIEW v_fhir_tracking_errors AS
SELECT
    ft.id,
    ft.resource_type,
    ft.resource_reference,
    ft.tracking_number,
    ft.current_status,
    ft.has_errors,
    ft.error_count,
    ft.last_error_code,
    ft.last_error_message,
    ft.last_error_at,
    ft.suggested_actions,
    ft.action_required,
    ft.action_deadline,
    ea.error_title,
    ea.error_description,
    ea.error_severity,
    ea.requires_manual_intervention,
    ea.resolution_guide,
    ft.vendor_name,
    ft.vendor_tracking_id
FROM fhir_tracking ft
LEFT JOIN fhir_error_actions ea ON ft.last_error_code = ea.error_code
WHERE ft.has_errors = TRUE;

-- View for complete tracking timeline
CREATE OR REPLACE VIEW v_fhir_tracking_timeline AS
SELECT
    ft.id as tracking_id,
    ft.tracking_number,
    ft.resource_type,
    ft.resource_reference,
    fte.id as event_id,
    fte.event_type,
    fte.event_description,
    fte.from_status,
    fte.to_status,
    fte.is_error,
    fte.error_code,
    fte.error_message,
    fte.error_severity,
    fte.vendor_name,
    fte.action_taken,
    fte.action_result,
    fte.created_at as event_time
FROM fhir_tracking ft
LEFT JOIN fhir_tracking_events fte ON ft.id = fte.fhir_tracking_id
ORDER BY ft.created_at DESC, fte.created_at DESC;

-- ============================================================================
-- Migration Complete
-- ============================================================================

COMMENT ON TABLE fhir_tracking IS 'End-to-end tracking for FHIR resources (MedicationRequest and ServiceRequest)';
COMMENT ON TABLE fhir_tracking_events IS 'Event log for all FHIR tracking status changes and interactions';
COMMENT ON TABLE fhir_error_actions IS 'Predefined actions and resolution guides for common FHIR errors';
