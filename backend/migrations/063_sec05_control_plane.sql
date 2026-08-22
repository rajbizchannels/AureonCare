-- Migration 063: SEC-05 Model D — Step S1: tenant control plane
--
-- Additive and non-invasive: creates a `control` schema that holds the tenant
-- catalog and shipped config baseline. It does NOT touch any PHI table, does NOT
-- move data, and is NOT yet consulted by any request path (that arrives in S3).
-- Safe to run on a live single-tenant database — it only adds new objects and
-- seeds one "default" tenant row describing the data that already exists today.
--
-- Everything here is idempotent (IF NOT EXISTS / ON CONFLICT DO NOTHING) so the
-- file-based migration runner can re-run it harmlessly.

CREATE SCHEMA IF NOT EXISTS control;

-- ── Tenant catalog ────────────────────────────────────────────────────────────
-- One row per clinic/organization. `schema_name` is where that tenant's data
-- physically lives; today the legacy data is in `public`, and S4 will relocate the
-- default tenant to its own `tenant_default` schema and update this value.
-- `app_version` / `schema_version` enable per-tenant version pinning and the
-- migration fan-out runner (S5); `migration_status` lets the runner isolate and
-- retry a single tenant without blocking the fleet.
CREATE TABLE IF NOT EXISTS control.tenants (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id      uuid,                         -- FK-in-spirit to public.practices(id); left loose so the
                                                 -- control plane never blocks on the PHI schema being present
  slug             varchar(63)  NOT NULL UNIQUE, -- URL/label-safe tenant key
  name             varchar(255) NOT NULL,
  schema_name      varchar(63)  NOT NULL UNIQUE, -- where this tenant's data lives (e.g. 'tenant_<uuid>')
  status           varchar(20)  NOT NULL DEFAULT 'active',   -- active | suspended | provisioning
  plan_tier        varchar(20)  DEFAULT 'professional',
  region           varchar(64),
  country          varchar(2),
  timezone         varchar(100),
  app_version      varchar(32),                  -- pinned app version (NULL = follow fleet)
  schema_version   integer      NOT NULL DEFAULT 0,           -- last migration applied to this tenant's schema
  migration_status varchar(20)  NOT NULL DEFAULT 'idle',      -- idle | running | failed
  created_at       timestamptz  NOT NULL DEFAULT now(),
  updated_at       timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_control_tenants_status ON control.tenants(status);

-- ── Shipped config baseline ──────────────────────────────────────────────────
-- Application defaults that ship WITH the code. Per-tenant overrides (added in S6
-- inside each tenant schema) win at read time via COALESCE(override, baseline), so
-- shipping a new default here never overwrites a tenant's customization.
CREATE TABLE IF NOT EXISTS control.config_baseline (
  key          varchar(120) PRIMARY KEY,
  value        jsonb        NOT NULL,
  description  text,
  updated_at   timestamptz  NOT NULL DEFAULT now()
);

-- ── Seed the default tenant from existing data ───────────────────────────────
-- Represent today's single-tenant install as one "default" tenant. Derive its
-- attributes from the first practices row if one exists (the convention already
-- used by clinicSettings.js), otherwise fall back to a placeholder. schema_name is
-- 'public' for now because the data physically lives there until the S4 cutover.
INSERT INTO control.tenants (practice_id, slug, name, schema_name, plan_tier, country, timezone)
SELECT p.id, 'default', COALESCE(p.name, 'Default Clinic'), 'public',
       COALESCE(p.plan_tier, 'professional'), p.country, p.timezone
FROM public.practices p
ORDER BY p.created_at ASC
LIMIT 1
ON CONFLICT (slug) DO NOTHING;

-- If there is no practices row at all, still create the default tenant so the
-- control plane is never empty.
INSERT INTO control.tenants (slug, name, schema_name)
SELECT 'default', 'Default Clinic', 'public'
WHERE NOT EXISTS (SELECT 1 FROM control.tenants WHERE slug = 'default')
ON CONFLICT (slug) DO NOTHING;

-- ── Seed a minimal shipped baseline ──────────────────────────────────────────
INSERT INTO control.config_baseline (key, value, description) VALUES
  ('default_plan_tier', '"professional"',  'Default subscription tier for new tenants'),
  ('default_timezone',  '"UTC"',           'Fallback timezone when a tenant has none set'),
  ('default_language',  '"en"',            'Fallback UI language'),
  ('schema_version',    '0',               'Baseline schema version shipped with this app build')
ON CONFLICT (key) DO NOTHING;
