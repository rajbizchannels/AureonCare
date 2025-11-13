-- ============================================================================
-- Fix Missing Patient Names
-- ============================================================================
-- This script checks for and fixes patients with NULL or empty first_name/last_name

BEGIN;

-- Check current state of patients table
SELECT
    id,
    first_name,
    last_name,
    email,
    CASE
        WHEN first_name IS NULL OR first_name = '' THEN 'MISSING FIRST NAME'
        ELSE 'OK'
    END as first_name_status,
    CASE
        WHEN last_name IS NULL OR last_name = '' THEN 'MISSING LAST NAME'
        ELSE 'OK'
    END as last_name_status
FROM patients
WHERE first_name IS NULL OR first_name = '' OR last_name IS NULL OR last_name = '';

-- If you want to update patients with missing names, uncomment below:
-- UPDATE patients
-- SET
--     first_name = COALESCE(NULLIF(first_name, ''), 'Patient'),
--     last_name = COALESCE(NULLIF(last_name, ''), CONCAT('User-', SUBSTRING(id::text, 1, 8)))
-- WHERE first_name IS NULL OR first_name = '' OR last_name IS NULL OR last_name = '';

ROLLBACK;  -- Remove this line if you want to commit the changes
