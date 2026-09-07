-- Migration 059: Add token_version to users (SEC-09 / SEC-16 / SEC-18)
-- Stateless JWTs previously stayed valid for their full 24h lifetime even after a
-- password change, reset, or logout. We add a monotonically increasing token_version
-- that is embedded in each JWT (claim "tv") and re-checked in the auth middleware.
-- Bumping token_version invalidates every JWT issued before the bump, giving us
-- server-side revocation without a full session store.

ALTER TABLE users
ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
