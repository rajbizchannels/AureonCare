-- Quick migration script for audit logs
-- Run this if PostgreSQL is accessible

\echo 'Creating audit_logs table...'

-- First, check if table exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'audit_logs') THEN
        RAISE NOTICE 'Table audit_logs does not exist. Creating...';
    ELSE
        RAISE NOTICE 'Table audit_logs already exists. Skipping creation.';
    END IF;
END $$;

-- Now run the full migration
\i backend/migrations/040_create_audit_logs_table.sql

\echo 'Migration complete!'
