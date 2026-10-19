-- Migration 062: cascade social_auth on user deletion + purge existing orphans
--
-- social_auth had no foreign key to users, so deleting a user left its linked social
-- identities behind. Besides being stale data, an orphaned row keeps the
-- UNIQUE(provider, provider_user_id) slot occupied and can block that identity from
-- linking to a new account later. The DELETE /users/:id route now cleans these up
-- explicitly; this migration removes rows orphaned by past deletions and adds an
-- ON DELETE CASCADE foreign key so it stays consistent going forward.

-- 1) Purge rows whose owning account no longer exists.
DELETE FROM social_auth
WHERE user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = social_auth.user_id);

DELETE FROM social_auth
WHERE user_id IS NULL
  AND patient_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = social_auth.patient_id);

-- 2) Add the cascading foreign key (users.id is UUID as of migration 021).
ALTER TABLE social_auth DROP CONSTRAINT IF EXISTS social_auth_user_id_fkey;
ALTER TABLE social_auth
  ADD CONSTRAINT social_auth_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
