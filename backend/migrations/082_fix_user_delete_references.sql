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
