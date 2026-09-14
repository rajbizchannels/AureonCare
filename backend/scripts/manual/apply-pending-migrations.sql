-- AureonCare — manual migration script
--
-- Everything outstanding for the self-service signup, 2FA/session and user-deletion work,
-- in the order it must run. Equivalent to:
--
--     node backend/run-migrations.js
--     node backend/run-tenant-migrations.js
--
-- for anyone who cannot run node against the database (Vercel, Supabase SQL editor, psql).
--
-- Safe to re-run: every statement is idempotent, and the migration ledgers are updated so
-- the node runners will not repeat this work.
--
-- Run it as ONE script, in one session. Section 4 loops over every tenant schema.

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- 080.  080_domain_join_requests.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Self-service joining: a practice claims an email domain, and people with an address at
-- that domain can sign themselves up without an admin minting an invite first.
--
-- The problem this solves is not convenience. An account created with no practice_id
-- resolves to the `public` schema, which holds no clinical tables — so the person logs in
-- successfully and then every screen fails. That looks like a broken application rather
-- than an access-control decision. After this, an unrecognised signup becomes an explicit
-- pending request that an administrator can see and act on, and the would-be user is told
-- they are waiting rather than shown a workspace that cannot work.
--
-- Trust model: an email domain proves nothing on its own — anyone can put "@clinic.com"
-- in a form. Two things must both hold before a domain grants anything:
--   1. the practice proved control of the domain via a DNS TXT record, and
--   2. the person proved control of the address (a verified OAuth email, or a clicked link).
-- Neither alone is sufficient, which is why verified_at and the per-request email
-- verification are separate columns rather than one flag.
--
-- Idempotent.

-- ── Claimed domains ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.practice_domains (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id        uuid NOT NULL REFERENCES public.practices(id) ON DELETE CASCADE,
  -- Stored lowercase, without the '@'. The unique index is global on purpose: two
  -- practices cannot both own example.com, or a signup would be ambiguous and the winner
  -- would depend on row order.
  domain             text NOT NULL,
  -- Proof of control. The practice publishes this as a TXT record at the domain apex;
  -- verification compares it and stamps verified_at.
  verification_token text NOT NULL,
  verified_at        timestamptz,
  -- What a matching, email-verified signup gets:
  --   auto_request — an account in 'pending' status plus a join request for an admin to
  --                  approve. The default: for a clinical system, a human should decide
  --                  who gets in, and a claimed domain is not the same as an employee list.
  --   auto_join    — bound to the practice immediately. For organisations that treat
  --                  control of a company mailbox as sufficient.
  --   disabled     — the domain is claimed but grants nothing (useful to hold a domain
  --                  while onboarding is being set up).
  join_policy        varchar(16) NOT NULL DEFAULT 'auto_request'
                     CHECK (join_policy IN ('auto_request', 'auto_join', 'disabled')),
  -- Role a self-serve joiner receives. Never 'admin': self-service must not be able to
  -- mint an administrator, or claiming a domain would be a privilege-escalation path.
  default_role       varchar(32) NOT NULL DEFAULT 'staff'
                     CHECK (default_role IN ('staff', 'nurse', 'doctor')),
  created_by         uuid REFERENCES public.users(id),
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_practice_domains_domain
  ON public.practice_domains (LOWER(domain));
CREATE INDEX IF NOT EXISTS idx_practice_domains_practice
  ON public.practice_domains (practice_id);

-- ── Requests to join ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.join_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id  uuid NOT NULL REFERENCES public.practices(id) ON DELETE CASCADE,
  -- The account is created up front in 'pending' status so the person has somewhere to
  -- sign in to be told they are waiting, and so the email address is claimed and cannot be
  -- registered twice while a decision is outstanding.
  user_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  email        text NOT NULL,
  requested_role varchar(32) NOT NULL DEFAULT 'staff',
  status       varchar(16) NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'approved', 'rejected')),
  -- How the address was proven at signup. Recorded because approving a request is a
  -- security decision and the approver should see what was actually established.
  email_verified_via varchar(32),
  decided_by   uuid REFERENCES public.users(id),
  decided_at   timestamptz,
  decision_note text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- One outstanding request per user. Partial, so a rejected request does not block a later
-- one — people change roles, and a rejection should not be permanent by accident.
CREATE UNIQUE INDEX IF NOT EXISTS idx_join_requests_pending_user
  ON public.join_requests (user_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_join_requests_practice_status
  ON public.join_requests (practice_id, status, created_at DESC);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aureoncare_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.practice_domains TO aureoncare_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.join_requests    TO aureoncare_app;
  END IF;
END $$;

-- Record it so run-migrations.js skips this file.
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  executed BOOLEAN NOT NULL DEFAULT TRUE
);
INSERT INTO public.schema_migrations (filename, executed) VALUES ('080_domain_join_requests.sql', TRUE)
  ON CONFLICT (filename) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- 081.  081_user_mfa_and_session_policy.sql
-- ═══════════════════════════════════════════════════════════════════════════
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

-- Record it so run-migrations.js skips this file.
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  executed BOOLEAN NOT NULL DEFAULT TRUE
);
INSERT INTO public.schema_migrations (filename, executed) VALUES ('081_user_mfa_and_session_policy.sql', TRUE)
  ON CONFLICT (filename) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- 082.  082_fix_user_delete_references.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Let a user be deleted after they have claimed a domain or decided a join request.
--
-- Migration 080 pointed practice_domains.created_by and join_requests.decided_by at
-- public.users(id) with no ON DELETE action, which defaults to NO ACTION. Deleting such a
-- user therefore raises a foreign key violation, which the users route turns into a flat
-- 500 "Failed to delete user" — and the account most likely to hold those references is the
-- administrator who set the practice up in the first place.
--
-- SET NULL rather than CASCADE. These columns record WHO did something; the domain claim
-- and the decision are still true after the person leaves, and cascading would delete a
-- practice's verified domain — and with it everyone's ability to self-join — because an
-- administrator was offboarded. Losing the attribution is the lesser harm, and the audit
-- log retains the full record independently.
--
-- join_requests.user_id keeps ON DELETE CASCADE: that column is the subject of the request,
-- not its author, and a request about a deleted account is meaningless.
--
-- Idempotent.

ALTER TABLE public.practice_domains
  DROP CONSTRAINT IF EXISTS practice_domains_created_by_fkey;
ALTER TABLE public.practice_domains
  ADD CONSTRAINT practice_domains_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.join_requests
  DROP CONSTRAINT IF EXISTS join_requests_decided_by_fkey;
ALTER TABLE public.join_requests
  ADD CONSTRAINT join_requests_decided_by_fkey
  FOREIGN KEY (decided_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- Record it so run-migrations.js skips this file.
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  executed BOOLEAN NOT NULL DEFAULT TRUE
);
INSERT INTO public.schema_migrations (filename, executed) VALUES ('082_fix_user_delete_references.sql', TRUE)
  ON CONFLICT (filename) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4.  tenant/003_audit_logs_keep_history.sql — across EVERY tenant schema
-- ═══════════════════════════════════════════════════════════════════════════
--
-- This is the one that makes user deletion possible again. audit_logs was made
-- append-only by tenant/002, but its user_id / patient_id / provider_id foreign keys were
-- declared ON DELETE SET NULL — and SET NULL is an UPDATE, which the trigger rejects with
--     P0001: audit_logs is append-only (UPDATE is not permitted)
-- so the whole deletion fails. The keys go; the trigger stays. Attribution survives in
-- user_email / user_name / user_role, which the rows already carry.
--
-- Applies to every non-suspended tenant schema AND to `template`, so tenants provisioned
-- later start correct.
DO $outer$
DECLARE
  sch   text;
  con   record;
  n_dropped int := 0;
  n_schemas int := 0;
BEGIN
  FOR sch IN
    SELECT schema_name FROM control.tenants
     WHERE schema_name IS NOT NULL AND status <> 'suspended'
    UNION
    SELECT 'template'
    UNION
    SELECT nspname FROM pg_namespace WHERE nspname LIKE 'tenant\\_%'
  LOOP
    -- Skip anything that is not actually present, or has no audit_logs table.
    CONTINUE WHEN to_regclass(format('%I.audit_logs', sch)) IS NULL;
    n_schemas := n_schemas + 1;

    -- Found by DEFINITION, not by name: these constraints were created at different times
    -- across tenants, so a hardcoded name would be silently skipped in some schemas.
    FOR con IN
      SELECT k.conname
        FROM pg_constraint k
        JOIN pg_class c ON c.oid = k.conrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN unnest(k.conkey) AS ck(attnum) ON true
        JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ck.attnum
       WHERE k.contype = 'f'
         AND c.relname = 'audit_logs'
         AND n.nspname = sch
         AND a.attname IN ('user_id', 'patient_id', 'provider_id')
    LOOP
      EXECUTE format('ALTER TABLE %I.audit_logs DROP CONSTRAINT %I', sch, con.conname);
      n_dropped := n_dropped + 1;
    END LOOP;

    -- Dropping the keys also drops the implicit indexes behind lookups that run constantly
    -- ("everything this user touched").
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON %I.audit_logs (user_id)', sch);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_audit_logs_patient_id ON %I.audit_logs (patient_id)', sch);

    -- Per-tenant ledger, so run-tenant-migrations.js will not repeat this.
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I.schema_migrations (
         version integer PRIMARY KEY, name text NOT NULL,
         applied_at timestamptz NOT NULL DEFAULT now())', sch);
    EXECUTE format(
      'INSERT INTO %I.schema_migrations (version, name) VALUES (3, $q$003_audit_logs_keep_history.sql$q$)
         ON CONFLICT (version) DO NOTHING', sch);
  END LOOP;

  RAISE NOTICE 'tenant/003: % schema(s) processed, % constraint(s) dropped', n_schemas, n_dropped;
END $outer$;

COMMIT;

-- ── Verification — expect zero rows from both ──────────────────────────────────
-- 1. Any audit_logs foreign key left that would rewrite the trail on delete:
SELECT n.nspname AS schema, k.conname
  FROM pg_constraint k
  JOIN pg_class c ON c.oid = k.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE k.contype = 'f' AND c.relname = 'audit_logs'
   AND k.confdeltype = 'n';   -- 'n' = SET NULL

-- 2. Any tenant schema that did not get the migration recorded:
SELECT t.schema_name
  FROM control.tenants t
 WHERE t.schema_name IS NOT NULL AND t.status <> 'suspended'
   AND to_regclass(format('%I.schema_migrations', t.schema_name)) IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM pg_class pc JOIN pg_namespace pn ON pn.oid = pc.relnamespace
      WHERE pn.nspname = t.schema_name AND pc.relname = 'schema_migrations'
   );
