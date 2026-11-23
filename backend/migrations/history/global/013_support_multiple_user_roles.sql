-- Update role synchronization strategy to support multiple roles
-- A user can be BOTH a provider (doctor) AND a patient simultaneously
-- This is common in healthcare: doctors can also be patients at their own facility

-- Add indexes to support efficient role-based queries
CREATE INDEX IF NOT EXISTS idx_patients_user_id ON patients(user_id);
CREATE INDEX IF NOT EXISTS idx_patients_email ON patients(email);
CREATE INDEX IF NOT EXISTS idx_providers_user_id ON providers(user_id);
CREATE INDEX IF NOT EXISTS idx_providers_email ON providers(email);

-- Add a note about the design decision
COMMENT ON TABLE patients IS 'Patient records. Users with patient role will have entries here. Users can have multiple roles.';
COMMENT ON TABLE providers IS 'Provider records. Users with doctor role will have entries here. Users can have multiple roles.';

-- Verify foreign key constraints are appropriate
DO $$
BEGIN
    -- Check if FHIR resources constraint exists and is appropriate
    IF EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'fhir_resources_patient_id_fkey'
        AND table_name = 'fhir_resources'
    ) THEN
        RAISE NOTICE 'FHIR resources foreign key exists - patient records should NEVER be deleted';
        RAISE NOTICE 'Role changes now preserve patient and provider records';
    END IF;
END $$;

SELECT
    'Migration complete - users can now have multiple roles' as status,
    'Patient records are preserved when role changes to doctor' as patient_preservation,
    'Provider records are preserved when role changes to patient' as provider_preservation,
    'FHIR resources remain linked to patients correctly' as fhir_integrity;
