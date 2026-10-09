-- Tenant migration 005: hang location_id off the tables that need a site
--
-- Additive and nullable throughout (expand/contract — no NOT NULL in the same release as
-- the column). ON DELETE SET NULL so removing a site never cascades into clinical or
-- stock history.
--
-- Backfill policy differs by table, deliberately:
--
--   * clinic_working_hours and doctor_availability are backfilled here. They are
--     configuration, bounded by (7 x sites) and (a few rows x providers), so the UPDATE
--     is trivially small and leaving them NULL would make "whose hours are these?"
--     ambiguous the moment a second site exists.
--
--   * appointments and inventory_stock_movements are NOT backfilled. They grow without
--     bound, and tenant migrations run inside a single transaction, so a blind UPDATE
--     over every historical row is exactly the lock-heavy change tenant/README.md warns
--     against. Instead the application treats `location_id IS NULL` as the primary site
--     (see backend/utils/locations.js -> primaryLocationId). A later migration can
--     batch-backfill these if an operational reason appears; nothing depends on it.

-- ── locations FK targets ─────────────────────────────────────────────────────────────

ALTER TABLE appointments               ADD COLUMN IF NOT EXISTS location_id uuid;
ALTER TABLE inventory_stock_movements  ADD COLUMN IF NOT EXISTS location_id uuid;
ALTER TABLE doctor_availability        ADD COLUMN IF NOT EXISTS location_id uuid;
ALTER TABLE clinic_working_hours       ADD COLUMN IF NOT EXISTS location_id uuid;

-- Real constraints, not conventions: control.replicate_intra_fks copies FKs from
-- `template` into each newly provisioned tenant, so a FK declared here is what makes new
-- tenants inherit the relationship. The runner guarantees this file runs at most once per
-- schema, so an unguarded ADD CONSTRAINT is safe.
ALTER TABLE appointments
  ADD CONSTRAINT appointments_location_id_fkey
  FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL;

ALTER TABLE inventory_stock_movements
  ADD CONSTRAINT inventory_stock_movements_location_id_fkey
  FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL;

ALTER TABLE doctor_availability
  ADD CONSTRAINT doctor_availability_location_id_fkey
  FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL;

ALTER TABLE clinic_working_hours
  ADD CONSTRAINT clinic_working_hours_location_id_fkey
  FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_location
  ON appointments (location_id);
CREATE INDEX IF NOT EXISTS idx_inv_movements_location
  ON inventory_stock_movements (location_id);
CREATE INDEX IF NOT EXISTS idx_doctor_availability_location
  ON doctor_availability (location_id);
CREATE INDEX IF NOT EXISTS idx_clinic_working_hours_location
  ON clinic_working_hours (location_id);

-- ── bounded backfill: configuration tables only ──────────────────────────────────────

UPDATE clinic_working_hours
   SET location_id = (SELECT id FROM locations WHERE is_primary LIMIT 1)
 WHERE location_id IS NULL
   AND EXISTS (SELECT 1 FROM locations WHERE is_primary);

UPDATE doctor_availability
   SET location_id = (SELECT id FROM locations WHERE is_primary LIMIT 1)
 WHERE location_id IS NULL
   AND EXISTS (SELECT 1 FROM locations WHERE is_primary);

COMMENT ON COLUMN appointments.location_id IS
  'Site this appointment happens at. NULL means the tenant primary site.';
COMMENT ON COLUMN inventory_stock_movements.location_id IS
  'Site this stock movement happened at. NULL means the tenant primary site.';
