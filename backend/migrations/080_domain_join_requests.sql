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
