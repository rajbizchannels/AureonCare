-- Grant Permissions Script for AureonCare Database
-- Run this script ONCE as a database administrator/superuser to grant necessary permissions
-- Replace 'aureoncare_user' with your actual database username if different

-- Grant all privileges on all tables in public schema
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO aureoncare_user;

-- Grant all privileges on all sequences (for auto-increment fields)
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO aureoncare_user;

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO aureoncare_user;

-- Grant privileges on future tables (so new tables automatically get permissions)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO aureoncare_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO aureoncare_user;

-- Specific table grants (explicit for all tables)
GRANT ALL PRIVILEGES ON TABLE practices TO aureoncare_user;
GRANT ALL PRIVILEGES ON TABLE users TO aureoncare_user;
GRANT ALL PRIVILEGES ON TABLE patients TO aureoncare_user;
GRANT ALL PRIVILEGES ON TABLE appointments TO aureoncare_user;
GRANT ALL PRIVILEGES ON TABLE claims TO aureoncare_user;
GRANT ALL PRIVILEGES ON TABLE payments TO aureoncare_user;
GRANT ALL PRIVILEGES ON TABLE prescriptions TO aureoncare_user;
GRANT ALL PRIVILEGES ON TABLE diagnosis TO aureoncare_user;
GRANT ALL PRIVILEGES ON TABLE medical_records TO aureoncare_user;
GRANT ALL PRIVILEGES ON TABLE tasks TO aureoncare_user;
GRANT ALL PRIVILEGES ON TABLE notifications TO aureoncare_user;
GRANT ALL PRIVILEGES ON TABLE telehealth_sessions TO aureoncare_user;
GRANT ALL PRIVILEGES ON TABLE fhir_resources TO aureoncare_user;
GRANT ALL PRIVILEGES ON TABLE patient_portal_sessions TO aureoncare_user;
GRANT ALL PRIVILEGES ON TABLE social_auth TO aureoncare_user;

-- Grant TRUNCATE privilege specifically (needed for reset script)
GRANT TRUNCATE ON ALL TABLES IN SCHEMA public TO aureoncare_user;

-- Confirm grants
\echo ''
\echo '✓ All permissions granted to aureoncare_user'
\echo ''
\echo 'The user can now:'
\echo '  - SELECT, INSERT, UPDATE, DELETE on all tables'
\echo '  - TRUNCATE tables (needed for reset script)'
\echo '  - Use sequences'
\echo ''
