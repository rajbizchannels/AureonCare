-- Migration 060: Normalize legacy Microsoft social_auth ids (SEC-19)
-- Legacy rows stored the MSAL homeAccountId ("<oid>.<tenantId>") in
-- provider_user_id, while token validation now returns the canonical Graph OID.
-- The login lookup used to also match on the client-supplied id to bridge this,
-- which let an attacker with any valid token match a victim's legacy row.
--
-- This migration rewrites legacy Microsoft rows to the canonical OID (the portion
-- before the first dot) so the lookup can match on the verified id alone. The
-- transformation is deterministic and derived entirely from stored data — it never
-- trusts client input.

-- 1) Drop legacy homeAccountId rows that would collide with an already-canonical
--    OID row (same OID prefix). The canonical row is authoritative; the legacy
--    duplicate is redundant. Guard prevents a UNIQUE(provider, provider_user_id)
--    violation in step 2.
DELETE FROM social_auth s
USING social_auth o
WHERE s.provider = 'microsoft'
  AND s.provider_user_id LIKE '%.%'
  AND o.provider = 'microsoft'
  AND o.id <> s.id
  AND o.provider_user_id = split_part(s.provider_user_id, '.', 1);

-- 2) Normalize the remaining legacy rows to the canonical OID.
UPDATE social_auth
SET provider_user_id = split_part(provider_user_id, '.', 1),
    updated_at = CURRENT_TIMESTAMP
WHERE provider = 'microsoft'
  AND provider_user_id LIKE '%.%';
