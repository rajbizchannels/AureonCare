-- Tenant migration 004: locations (physical sites)
--
-- Until now the product assumed exactly one implicit physical place: clinic_info is a
-- single row, clinic_working_hours is a flat weekday list, and nothing else carries a
-- site. That blocks multi-branch practices, departments, and anything held off-site
-- (medical camps, mobile clinics).
--
-- This introduces sites as a first-class tenant entity. Migration 005 hangs the
-- nullable location_id columns off it.
--
-- Unqualified names on purpose — the runner sets search_path to each tenant schema and
-- to `template`, so this one file applies everywhere. See tenant/README.md.

CREATE TABLE IF NOT EXISTS locations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          varchar(255) NOT NULL,
  location_type varchar(30)  NOT NULL DEFAULT 'clinic',
  address       text,
  city          varchar(100),
  state         varchar(100),
  country       varchar(2),
  postal_code   varchar(20),
  phone         varchar(50),
  email         varchar(255),
  latitude      numeric(9,6),
  longitude     numeric(9,6),
  timezone      varchar(100),
  notes         text,
  is_primary    boolean NOT NULL DEFAULT false,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamp DEFAULT CURRENT_TIMESTAMP,
  updated_at    timestamp DEFAULT CURRENT_TIMESTAMP,
  -- varchar + CHECK rather than an enum: extending an enum across 148 tenant schemas
  -- is a migration; extending a CHECK is one ALTER.
  CONSTRAINT locations_type_chk
    CHECK (location_type IN ('clinic', 'camp', 'mobile', 'partner'))
);

CREATE INDEX IF NOT EXISTS idx_locations_active ON locations (is_active);
CREATE INDEX IF NOT EXISTS idx_locations_type   ON locations (location_type);

-- At most one primary site. Enforced in the database because "which site is the default"
-- is read on nearly every scheduling path, and two primaries would make those reads
-- non-deterministic rather than merely wrong.
CREATE UNIQUE INDEX IF NOT EXISTS uq_locations_single_primary
  ON locations (is_primary) WHERE is_primary;

-- Seed the primary site for an EXISTING tenant, so no tenant is left without a default.
--
-- Sources, in order of preference: the tenant's own clinic_info row, then
-- public.practices via the control plane, then a literal fallback. practices.address is
-- jsonb and clinic_info.address is text, so only the latter is copied — rendering a
-- jsonb blob into a text address field would produce visible garbage.
--
-- tenant_practice is an INNER source, so `template` (which has no control.tenants row)
-- gets the table but no row: the golden template stays a purely structural copy, and
-- provision_schema clones structure only. NEWLY provisioned tenants are therefore seeded
-- by services/tenantProvisioning.js instead — this migration will never run for them,
-- because they inherit template's schema_migrations.
WITH tenant_practice AS (
  SELECT p.name, p.phone, p.email, p.country, p.timezone
    FROM control.tenants t
    JOIN public.practices p ON p.id = t.practice_id
   WHERE t.schema_name = current_schema()
   LIMIT 1
), tenant_clinic AS (
  SELECT name, address, phone, email
    FROM clinic_info
   ORDER BY id
   LIMIT 1
)
INSERT INTO locations
  (name, location_type, address, phone, email, country, timezone, is_primary, is_active)
SELECT COALESCE(NULLIF(c.name, ''), NULLIF(p.name, ''), 'Main Clinic'),
       'clinic',
       c.address,
       COALESCE(c.phone, p.phone),
       COALESCE(c.email, p.email),
       p.country,
       p.timezone,
       true,
       true
  FROM tenant_practice p
  LEFT JOIN tenant_clinic c ON true
 WHERE NOT EXISTS (SELECT 1 FROM locations);

COMMENT ON TABLE locations IS
  'Physical sites belonging to this tenant: clinics, branches, camp venues, mobile units. Exactly one row is is_primary.';
COMMENT ON COLUMN locations.location_type IS
  'clinic = owned premises, camp = temporary off-site venue, mobile = vehicle/van, partner = third-party premises';
