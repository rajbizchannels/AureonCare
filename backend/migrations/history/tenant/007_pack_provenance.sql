-- Tenant migration 007: provenance for specialty-pack-seeded rows
--
-- THIS MUST EXIST BEFORE ANY PACK IS EVER APPLIED. It is the whole mechanism by which a
-- pack upgrade can tell "this row is still as we seeded it" from "the practice has since
-- edited it". Retrofitting that onto rows already seeded means guessing which were
-- customised, and the only safe guess is "all of them", which makes upgrades useless.
--
-- Three columns per seeded table:
--   source_pack / source_pack_version  what put the row here, and which version
--   is_customised                      set to true by the route that handles a user edit
--
-- A fourth, department_id, is added now and left NULL throughout. Departments are a later
-- phase (multi-specialty hospitals), but adding the column while these tables are small
-- costs nothing, whereas re-attributing thousands of existing rows later does not.
--
-- Only the five tables a pack actually seeds are touched. Notably absent, and why:
--   roles, medical_codes   — public tables shared by every tenant, so a pack cannot seed
--                            them per-practice without polluting other practices
--   organization_settings  — a single shared row; see migration 085
--
-- Unqualified names: the runner sets search_path per tenant schema and for `template`.

ALTER TABLE service_categories    ADD COLUMN IF NOT EXISTS source_pack varchar(60);
ALTER TABLE healthcare_offerings  ADD COLUMN IF NOT EXISTS source_pack varchar(60);
ALTER TABLE appointment_types     ADD COLUMN IF NOT EXISTS source_pack varchar(60);
ALTER TABLE form_templates        ADD COLUMN IF NOT EXISTS source_pack varchar(60);
ALTER TABLE inventory_categories  ADD COLUMN IF NOT EXISTS source_pack varchar(60);

ALTER TABLE service_categories    ADD COLUMN IF NOT EXISTS source_pack_version integer;
ALTER TABLE healthcare_offerings  ADD COLUMN IF NOT EXISTS source_pack_version integer;
ALTER TABLE appointment_types     ADD COLUMN IF NOT EXISTS source_pack_version integer;
ALTER TABLE form_templates        ADD COLUMN IF NOT EXISTS source_pack_version integer;
ALTER TABLE inventory_categories  ADD COLUMN IF NOT EXISTS source_pack_version integer;

ALTER TABLE service_categories    ADD COLUMN IF NOT EXISTS is_customised boolean NOT NULL DEFAULT false;
ALTER TABLE healthcare_offerings  ADD COLUMN IF NOT EXISTS is_customised boolean NOT NULL DEFAULT false;
ALTER TABLE appointment_types     ADD COLUMN IF NOT EXISTS is_customised boolean NOT NULL DEFAULT false;
ALTER TABLE form_templates        ADD COLUMN IF NOT EXISTS is_customised boolean NOT NULL DEFAULT false;
ALTER TABLE inventory_categories  ADD COLUMN IF NOT EXISTS is_customised boolean NOT NULL DEFAULT false;

ALTER TABLE service_categories    ADD COLUMN IF NOT EXISTS department_id uuid;
ALTER TABLE healthcare_offerings  ADD COLUMN IF NOT EXISTS department_id uuid;
ALTER TABLE appointment_types     ADD COLUMN IF NOT EXISTS department_id uuid;
ALTER TABLE form_templates        ADD COLUMN IF NOT EXISTS department_id uuid;
ALTER TABLE inventory_categories  ADD COLUMN IF NOT EXISTS department_id uuid;

-- Partial indexes: the only interesting queries are "what did pack X put here" and "what
-- has the practice since changed", both of which concern a small subset of rows.
CREATE INDEX IF NOT EXISTS idx_service_categories_pack   ON service_categories   (source_pack) WHERE source_pack IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_healthcare_offerings_pack ON healthcare_offerings (source_pack) WHERE source_pack IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_appointment_types_pack    ON appointment_types    (source_pack) WHERE source_pack IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_form_templates_pack       ON form_templates       (source_pack) WHERE source_pack IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_categories_pack ON inventory_categories (source_pack) WHERE source_pack IS NOT NULL;

COMMENT ON COLUMN healthcare_offerings.is_customised IS
  'True once a user has edited this row. A pack upgrade never overwrites a customised row; it reports it as a conflict instead.';
COMMENT ON COLUMN healthcare_offerings.department_id IS
  'Reserved for department-level configuration (multi-specialty hospitals). NULL means practice-wide.';
