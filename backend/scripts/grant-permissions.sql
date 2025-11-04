-- Grant Permissions Script for MedFlow Database
-- Run this script ONCE as a database administrator/superuser to grant necessary permissions
-- Replace 'medflow_user' with your actual database username if different

-- Grant all privileges on all tables in public schema
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO medflow_user;

-- Grant all privileges on all sequences (for auto-increment fields)
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO medflow_user;

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO medflow_user;

-- Grant privileges on future tables (so new tables automatically get permissions)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO medflow_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO medflow_user;

-- Specific table grants (explicit for all tables)
GRANT ALL PRIVILEGES ON TABLE practices TO medflow_user;
GRANT ALL PRIVILEGES ON TABLE users TO medflow_user;
GRANT ALL PRIVILEGES ON TABLE patients TO medflow_user;
GRANT ALL PRIVILEGES ON TABLE appointments TO medflow_user;
GRANT ALL PRIVILEGES ON TABLE claims TO medflow_user;
GRANT ALL PRIVILEGES ON TABLE payments TO medflow_user;
GRANT ALL PRIVILEGES ON TABLE prescriptions TO medflow_user;
GRANT ALL PRIVILEGES ON TABLE diagnosis TO medflow_user;
GRANT ALL PRIVILEGES ON TABLE medical_records TO medflow_user;
GRANT ALL PRIVILEGES ON TABLE tasks TO medflow_user;
GRANT ALL PRIVILEGES ON TABLE notifications TO medflow_user;
GRANT ALL PRIVILEGES ON TABLE telehealth_sessions TO medflow_user;
GRANT ALL PRIVILEGES ON TABLE fhir_resources TO medflow_user;
GRANT ALL PRIVILEGES ON TABLE patient_portal_sessions TO medflow_user;
GRANT ALL PRIVILEGES ON TABLE social_auth TO medflow_user;

-- Grant TRUNCATE privilege specifically (needed for reset script)
GRANT TRUNCATE ON ALL TABLES IN SCHEMA public TO medflow_user;

-- Confirm grants
\echo ''
\echo '✓ All permissions granted to medflow_user'
\echo ''
\echo 'The user can now:'
\echo '  - SELECT, INSERT, UPDATE, DELETE on all tables'
\echo '  - TRUNCATE tables (needed for reset script)'
\echo '  - Use sequences'
\echo ''
