-- Real two-factor authentication for staff accounts, and a session idle timeout that is
-- actually enforced.
--
-- The settings dialog previously showed a hardcoded "Enabled" badge for 2FA and a
-- session-timeout dropdown wired to nothing. Both were removed rather than reproduced; this
-- is the replacement.
--
-- Operators (control.operators) have had working TOTP since the console was built. This
-- brings the same mechanism to tenant users, who are the accounts that actually touch PHI.
--
-- Idempotent.

-- ── TOTP enrolment ───────────────────────────────────────────────────────────
ALTER TABLE public.users
  -- Enrolment is two-phase. The secret is stored when enrolment starts, but mfa_enabled
  -- stays false until a code from it verifies. Without that split, an interrupted
  -- enrolment would lock the account out with a secret nobody has scanned.
  ADD COLUMN IF NOT EXISTS mfa_secret        text,
  ADD COLUMN IF NOT EXISTS mfa_enabled       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mfa_enrolled_at   timestamptz,
  -- SHA-256 of each single-use recovery code. Hashed for the same reason password hashes
  -- are: a recovery code is a credential that bypasses the second factor, so a database
  -- leak must not yield usable ones. Codes are shown to the user exactly once.
  ADD COLUMN IF NOT EXISTS mfa_backup_codes  text[] NOT NULL DEFAULT '{}',
  -- Last time this account did anything authenticated. The idle timeout is measured from
  -- here rather than from token issue, so "auto logout after 30 minutes" means 30 minutes
  -- of inactivity, which is what the phrase is normally taken to mean.
  ADD COLUMN IF NOT EXISTS last_activity_at  timestamptz;

-- ── Per-practice session policy ──────────────────────────────────────────────
ALTER TABLE public.practices
  -- Minutes of inactivity before a session stops being accepted. NULL means no idle limit
  -- (the JWT's own expiry still applies). Kept on the practice rather than the user so a
  -- clinic can set one policy for everyone; an individual cannot opt themselves out.
  ADD COLUMN IF NOT EXISTS session_idle_minutes integer,
  -- Whether every staff account at this practice must carry a second factor. Enforced at
  -- login: a user without 2FA is allowed in only far enough to enrol.
  ADD COLUMN IF NOT EXISTS require_mfa          boolean NOT NULL DEFAULT false;

-- A timeout so short nobody can work, or so long it is meaningless, is a configuration
-- mistake rather than a policy. Bound it in the database so it holds regardless of which
-- surface sets it.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'practices_session_idle_minutes_range'
  ) THEN
    ALTER TABLE public.practices
      ADD CONSTRAINT practices_session_idle_minutes_range
      CHECK (session_idle_minutes IS NULL
             OR (session_idle_minutes >= 5 AND session_idle_minutes <= 1440));
  END IF;
END $$;

-- last_activity_at is written on nearly every authenticated request, so the read that
-- follows it must not be a sequential scan.
CREATE INDEX IF NOT EXISTS idx_users_last_activity ON public.users (last_activity_at);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aureoncare_app') THEN
    GRANT SELECT, UPDATE ON public.users     TO aureoncare_app;
    GRANT SELECT, UPDATE ON public.practices TO aureoncare_app;
  END IF;
END $$;
