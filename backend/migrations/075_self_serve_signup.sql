-- Self-serve subscription signup, staff invites, and tenant binding.
--
-- Three gaps this closes:
--   1. There was no way for a customer to sign up: tenants existed only when an operator
--      created one by hand in the platform console.
--   2. Tenant creation never wrote control.subscriptions, so entitlements fell open to the
--      legacy global organization_settings row.
--   3. Nothing bound an OAuth-created staff user to a practice, so they resolved to the
--      `public` schema, which after the SEC-05 cutover holds no tenant tables.
--
-- Idempotent.

-- ── Stripe price mapping for plans ───────────────────────────────────────────
-- Checkout needs a Stripe Price, not our numeric plan id. Nullable: a plan with no price
-- id simply cannot be self-served (the signup route rejects it) while still working for
-- operator-created tenants.
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS stripe_price_id varchar(255),
  ADD COLUMN IF NOT EXISTS self_serve      boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_plans_stripe_price
  ON public.subscription_plans(stripe_price_id) WHERE stripe_price_id IS NOT NULL;

-- ── Signup intents ───────────────────────────────────────────────────────────
-- A signup is a two-phase commit across our database and Stripe: we take the details,
-- send the customer to Stripe Checkout, and only provision the tenant when the webhook
-- confirms payment. The intent is the record between those two points.
--
-- It holds a bcrypt password hash, never a plaintext password, and never any card data —
-- card entry happens entirely on Stripe's hosted page, so this table is out of PCI scope.
CREATE TABLE IF NOT EXISTS control.signup_intents (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email                      varchar(255) NOT NULL,
  practice_name              varchar(255) NOT NULL,
  first_name                 varchar(100),
  last_name                  varchar(100),
  password_hash              varchar(255) NOT NULL,
  plan_id                    integer,
  country                    varchar(2),
  timezone                   varchar(64),
  status                     varchar(20) NOT NULL DEFAULT 'pending',
                             -- pending | provisioning | completed | failed | expired
                             -- 'provisioning' is claimed by a conditional UPDATE so two
                             -- concurrent webhook deliveries cannot both provision.
  stripe_checkout_session_id varchar(255) UNIQUE,
  stripe_customer_id         varchar(255),
  stripe_subscription_id     varchar(255),
  tenant_id                  uuid REFERENCES control.tenants(id),
  failure_reason             text,
  expires_at                 timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  created_at                 timestamptz NOT NULL DEFAULT now(),
  completed_at               timestamptz
);

-- One live attempt per email. A customer who abandons checkout and starts again replaces
-- their pending intent rather than accumulating rows; completed intents are kept for audit.
CREATE UNIQUE INDEX IF NOT EXISTS idx_signup_intents_pending_email
  ON control.signup_intents(lower(email)) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_signup_intents_status ON control.signup_intents(status);

-- ── Staff invites ────────────────────────────────────────────────────────────
-- The binding that was missing. An admin invites a colleague; the invite carries the
-- practice. Accepting it — with a password OR with Google/Microsoft — creates the user
-- WITH practice_id set, so they resolve to their tenant instead of falling through to
-- `public`.
--
-- Only the SHA-256 of the token is stored: a database leak does not yield usable invites.
-- Lives in public because users do (identity is global; only clinical data is per-tenant).
CREATE TABLE IF NOT EXISTS public.staff_invites (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash   char(64) NOT NULL UNIQUE,
  email        varchar(255) NOT NULL,
  practice_id  uuid NOT NULL REFERENCES public.practices(id) ON DELETE CASCADE,
  role         varchar(100) NOT NULL DEFAULT 'staff',
  invited_by   uuid REFERENCES public.users(id) ON DELETE SET NULL,
  status       varchar(20) NOT NULL DEFAULT 'pending',  -- pending | accepted | revoked
  accepted_by  uuid REFERENCES public.users(id) ON DELETE SET NULL,
  expires_at   timestamptz NOT NULL DEFAULT now() + interval '14 days',
  created_at   timestamptz NOT NULL DEFAULT now(),
  accepted_at  timestamptz
);
CREATE INDEX IF NOT EXISTS idx_staff_invites_email ON public.staff_invites(lower(email));
CREATE INDEX IF NOT EXISTS idx_staff_invites_practice ON public.staff_invites(practice_id);

-- ── Backfill: every tenant gets a subscription row ───────────────────────────
-- Without one, getTenantEntitlements returns null and plan enforcement falls open to the
-- legacy global organization_settings row — meaning a tenant silently inherits another
-- tenant's limits. Seed the cheapest active plan for any tenant missing a row.
INSERT INTO control.subscriptions (tenant_id, practice_id, plan_id, plan_name, status)
SELECT t.id, t.practice_id, p.id, p.name, 'active'
  FROM control.tenants t
  LEFT JOIN control.subscriptions s ON s.tenant_id = t.id
  CROSS JOIN LATERAL (
    SELECT id, name FROM public.subscription_plans
     WHERE is_active = true ORDER BY price ASC NULLS LAST, id ASC LIMIT 1
  ) p
 WHERE s.id IS NULL
ON CONFLICT (tenant_id) DO NOTHING;

-- Least-privilege role (073) needs access to the new control table; the grant is a no-op
-- when the role does not exist (single-role deployments).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aureoncare_app') THEN
    GRANT SELECT, INSERT, UPDATE ON control.signup_intents TO aureoncare_app;
  END IF;
END $$;
