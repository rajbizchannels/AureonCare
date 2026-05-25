-- Migration 058: Sync social_auth.user_id and social_auth.patient_id
--
-- In the current schema patients.id = users.id (one shared UUID).
-- Historically some rows had only patient_id set (schema2.sql era) and some
-- had only user_id set (migration-050 era), causing fallback query chains on
-- every social login.  This migration ensures both columns always hold the
-- same value so the login path can read user_id directly without branching.

-- 1. Fill user_id from patient_id where user_id is missing
UPDATE social_auth
SET user_id = patient_id
WHERE user_id IS NULL AND patient_id IS NOT NULL;

-- 2. Fill patient_id from user_id where patient_id is missing
UPDATE social_auth
SET patient_id = user_id
WHERE patient_id IS NULL AND user_id IS NOT NULL;

-- 3. Drop the now-redundant separate index on patient_id (user_id index covers lookups)
DROP INDEX IF EXISTS idx_social_auth_patient;
