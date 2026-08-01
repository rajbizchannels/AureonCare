-- Migration 051: Restore DEFAULT on users.id
-- After migration 021 converted users.id from SERIAL to UUID, the DEFAULT
-- (uuid_generate_v4()) was lost, causing any INSERT that does not explicitly
-- provide an id to fail with a NOT NULL violation.
-- This migration restores the default using gen_random_uuid() which is
-- available via the built-in pgcrypto extension (no uuid-ossp required).

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

ALTER TABLE users ALTER COLUMN id SET DEFAULT gen_random_uuid();
