-- Tenant migration 006: medical camps
--
-- A camp is a time-boxed event at a venue the practice does not own, run as a station
-- pipeline rather than a slot calendar. These tables are the scheduling and aggregation
-- context; the clinical rows a camp produces stay ordinary medical_records / diagnosis /
-- prescriptions / lab_orders rows carrying a camp_id stamp. There is deliberately no
-- camp-only clinical storage.
--
-- Unqualified names: the runner sets search_path per tenant schema and for `template`.
--
-- NOTE ON ACTOR COLUMNS. created_by / closed_by / user_id / handled_by / registered_by
-- are plain uuid with NO foreign key, matching every existing tenant table. `users` lives
-- in `public`, and control.replicate_intra_fks only reproduces FKs whose parent is itself
-- a tenant table — so a FK to public.users would exist in migrated tenants and silently
-- NOT exist in newly provisioned ones. template currently has zero cross-schema FKs; do
-- not add the first one here.

-- ── the event ────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS camps (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            varchar(255) NOT NULL,
  description     text,
  location_id     uuid REFERENCES locations(id) ON DELETE SET NULL,
  sponsor_name    varchar(255),
  sponsor_contact varchar(255),
  funding_source  varchar(30) NOT NULL DEFAULT 'self_funded',
  is_free         boolean NOT NULL DEFAULT true,
  budget          numeric(14,2),
  currency        varchar(3),
  starts_at       timestamp NOT NULL,
  ends_at         timestamp NOT NULL,
  timezone        varchar(100),
  capacity        integer,
  status          varchar(20) NOT NULL DEFAULT 'draft',
  -- Token numbers are handed out by incrementing this under a row lock on the camp, so
  -- two registration desks never collide and no gap appears when one rolls back.
  next_token_no   integer NOT NULL DEFAULT 1,
  published_at    timestamp,
  started_at      timestamp,
  closed_at       timestamp,
  closed_by       uuid,
  notes           text,
  created_by      uuid,
  created_at      timestamp DEFAULT CURRENT_TIMESTAMP,
  updated_at      timestamp DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT camps_status_chk
    CHECK (status IN ('draft', 'published', 'in_progress', 'closed', 'archived')),
  CONSTRAINT camps_funding_chk
    CHECK (funding_source IN ('self_funded', 'sponsored', 'government', 'ngo', 'csr')),
  CONSTRAINT camps_window_chk  CHECK (ends_at > starts_at),
  CONSTRAINT camps_capacity_chk CHECK (capacity IS NULL OR capacity > 0),
  CONSTRAINT camps_budget_chk   CHECK (budget IS NULL OR budget >= 0)
);

CREATE INDEX IF NOT EXISTS idx_camps_status   ON camps (status);
CREATE INDEX IF NOT EXISTS idx_camps_starts   ON camps (starts_at);
CREATE INDEX IF NOT EXISTS idx_camps_location ON camps (location_id);

-- ── what is offered, who runs it, how it flows ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS camp_services (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  camp_id       uuid NOT NULL REFERENCES camps(id) ON DELETE CASCADE,
  offering_id   uuid REFERENCES healthcare_offerings(id) ON DELETE CASCADE,
  -- Kept alongside offering_id so a camp can list a service the catalogue does not carry
  -- (a one-off screening) without polluting healthcare_offerings.
  label         varchar(255),
  is_free       boolean NOT NULL DEFAULT true,
  price         numeric(12,2),
  display_order integer NOT NULL DEFAULT 0,
  created_at    timestamp DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT camp_services_identified_chk CHECK (offering_id IS NOT NULL OR label IS NOT NULL),
  CONSTRAINT camp_services_price_chk      CHECK (price IS NULL OR price >= 0),
  -- A free service cannot carry a price. The reverse (a camp marked free holding a priced
  -- service) is enforced in the route, because a CHECK cannot read the parent row.
  CONSTRAINT camp_services_free_price_chk CHECK (NOT (is_free AND price IS NOT NULL AND price > 0))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_camp_services_offering
  ON camp_services (camp_id, offering_id) WHERE offering_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_camp_services_camp ON camp_services (camp_id);

CREATE TABLE IF NOT EXISTS camp_staff (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  camp_id    uuid NOT NULL REFERENCES camps(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL,
  camp_role  varchar(30) NOT NULL DEFAULT 'clinician',
  notes      text,
  created_at timestamp DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT camp_staff_role_chk
    CHECK (camp_role IN ('lead', 'registrar', 'clinician', 'nurse', 'lab', 'pharmacy', 'volunteer')),
  CONSTRAINT uq_camp_staff UNIQUE (camp_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_camp_staff_camp ON camp_staff (camp_id);
CREATE INDEX IF NOT EXISTS idx_camp_staff_user ON camp_staff (user_id);

CREATE TABLE IF NOT EXISTS camp_stations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  camp_id          uuid NOT NULL REFERENCES camps(id) ON DELETE CASCADE,
  name             varchar(255) NOT NULL,
  step_order       integer NOT NULL DEFAULT 0,
  offering_id      uuid REFERENCES healthcare_offerings(id) ON DELETE SET NULL,
  form_template_id uuid REFERENCES form_templates(id) ON DELETE SET NULL,
  -- A clinical station may not be entered before consent is recorded. Registration and
  -- exit counselling are not clinical; vitals, consult, lab and pharmacy are.
  is_clinical      boolean NOT NULL DEFAULT true,
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamp DEFAULT CURRENT_TIMESTAMP,
  updated_at       timestamp DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_camp_stations_camp ON camp_stations (camp_id, step_order);

-- ── supplies carried to site ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS camp_inventory_allocations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  camp_id       uuid NOT NULL REFERENCES camps(id) ON DELETE CASCADE,
  item_id       uuid NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  qty_issued    numeric(12,3) NOT NULL,
  qty_consumed  numeric(12,3) NOT NULL DEFAULT 0,
  qty_returned  numeric(12,3) NOT NULL DEFAULT 0,
  -- The stock movement that took the goods out of the store, so the allocation can be
  -- traced back to the ledger rather than merely asserted.
  issue_movement_id  uuid REFERENCES inventory_stock_movements(id) ON DELETE SET NULL,
  return_movement_id uuid REFERENCES inventory_stock_movements(id) ON DELETE SET NULL,
  reconciled_at timestamp,
  reconciled_by uuid,
  notes         text,
  created_at    timestamp DEFAULT CURRENT_TIMESTAMP,
  updated_at    timestamp DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT camp_alloc_issued_chk   CHECK (qty_issued > 0),
  CONSTRAINT camp_alloc_consumed_chk CHECK (qty_consumed >= 0),
  CONSTRAINT camp_alloc_returned_chk CHECK (qty_returned >= 0),
  CONSTRAINT camp_alloc_balance_chk  CHECK (qty_consumed + qty_returned <= qty_issued),
  CONSTRAINT uq_camp_alloc UNIQUE (camp_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_camp_alloc_camp ON camp_inventory_allocations (camp_id);

-- ── attendees ────────────────────────────────────────────────────────────────────────
--
-- A registration is a lightweight pre-patient record. It is PROMOTED to a patients row on
-- first clinical touch or follow-up referral — the patients table keeps its NOT NULL mrn
-- and date_of_birth, so camp throughput never costs us the integrity of the patient index,
-- and deduplication stays an explicit, auditable action.

CREATE TABLE IF NOT EXISTS camp_registrations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  camp_id       uuid NOT NULL REFERENCES camps(id) ON DELETE CASCADE,
  token_no      integer NOT NULL,
  full_name     varchar(255) NOT NULL,
  phone         varchar(50),
  email         varchar(255),
  -- Attendees routinely know their age but not their date of birth. One or the other is
  -- required; neither alone is optional.
  age_years     integer,
  date_of_birth date,
  gender        varchar(20),
  address       text,
  city          varchar(100),
  consent_given_at           timestamp,
  consent_form_submission_id uuid REFERENCES form_submissions(id) ON DELETE SET NULL,
  status        varchar(20) NOT NULL DEFAULT 'registered',
  patient_id    uuid REFERENCES patients(id) ON DELETE SET NULL,
  promoted_at   timestamp,
  registered_by uuid,
  notes         text,
  created_at    timestamp DEFAULT CURRENT_TIMESTAMP,
  updated_at    timestamp DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT camp_reg_status_chk
    CHECK (status IN ('registered', 'in_progress', 'completed', 'left_early', 'cancelled')),
  CONSTRAINT camp_reg_age_chk
    CHECK (age_years IS NOT NULL OR date_of_birth IS NOT NULL),
  CONSTRAINT camp_reg_age_range_chk
    CHECK (age_years IS NULL OR (age_years >= 0 AND age_years <= 130)),
  CONSTRAINT uq_camp_reg_token UNIQUE (camp_id, token_no)
);

CREATE INDEX IF NOT EXISTS idx_camp_reg_camp    ON camp_registrations (camp_id, token_no);
CREATE INDEX IF NOT EXISTS idx_camp_reg_phone   ON camp_registrations (phone);
CREATE INDEX IF NOT EXISTS idx_camp_reg_patient ON camp_registrations (patient_id);
CREATE INDEX IF NOT EXISTS idx_camp_reg_status  ON camp_registrations (camp_id, status);

CREATE TABLE IF NOT EXISTS camp_station_visits (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES camp_registrations(id) ON DELETE CASCADE,
  station_id      uuid NOT NULL REFERENCES camp_stations(id) ON DELETE CASCADE,
  status          varchar(20) NOT NULL DEFAULT 'queued',
  queued_at       timestamp DEFAULT CURRENT_TIMESTAMP,
  started_at      timestamp,
  completed_at    timestamp,
  handled_by      uuid,
  outcome         varchar(30),
  notes           text,
  created_at      timestamp DEFAULT CURRENT_TIMESTAMP,
  updated_at      timestamp DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT camp_visit_status_chk
    CHECK (status IN ('queued', 'in_progress', 'completed', 'skipped')),
  CONSTRAINT camp_visit_outcome_chk
    CHECK (outcome IS NULL OR outcome IN ('normal', 'referred', 'follow_up', 'declined', 'no_show')),
  CONSTRAINT uq_camp_visit UNIQUE (registration_id, station_id)
);

CREATE INDEX IF NOT EXISTS idx_camp_visit_station ON camp_station_visits (station_id, status);
CREATE INDEX IF NOT EXISTS idx_camp_visit_reg     ON camp_station_visits (registration_id);

-- ── camp stamps on existing tables ───────────────────────────────────────────────────
--
-- Additive and nullable. These are what make a camp reportable without a parallel
-- clinical store. ON DELETE SET NULL: deleting a camp must never cascade into clinical
-- history.

ALTER TABLE campaigns       ADD COLUMN IF NOT EXISTS camp_id uuid;
ALTER TABLE appointments    ADD COLUMN IF NOT EXISTS camp_id uuid;
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS camp_id uuid;
ALTER TABLE diagnosis       ADD COLUMN IF NOT EXISTS camp_id uuid;
ALTER TABLE prescriptions   ADD COLUMN IF NOT EXISTS camp_id uuid;
ALTER TABLE lab_orders      ADD COLUMN IF NOT EXISTS camp_id uuid;

ALTER TABLE campaigns
  ADD CONSTRAINT campaigns_camp_id_fkey
  FOREIGN KEY (camp_id) REFERENCES camps(id) ON DELETE SET NULL;
ALTER TABLE appointments
  ADD CONSTRAINT appointments_camp_id_fkey
  FOREIGN KEY (camp_id) REFERENCES camps(id) ON DELETE SET NULL;
ALTER TABLE medical_records
  ADD CONSTRAINT medical_records_camp_id_fkey
  FOREIGN KEY (camp_id) REFERENCES camps(id) ON DELETE SET NULL;
ALTER TABLE diagnosis
  ADD CONSTRAINT diagnosis_camp_id_fkey
  FOREIGN KEY (camp_id) REFERENCES camps(id) ON DELETE SET NULL;
ALTER TABLE prescriptions
  ADD CONSTRAINT prescriptions_camp_id_fkey
  FOREIGN KEY (camp_id) REFERENCES camps(id) ON DELETE SET NULL;
ALTER TABLE lab_orders
  ADD CONSTRAINT lab_orders_camp_id_fkey
  FOREIGN KEY (camp_id) REFERENCES camps(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_campaigns_camp       ON campaigns (camp_id);
CREATE INDEX IF NOT EXISTS idx_appointments_camp    ON appointments (camp_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_camp ON medical_records (camp_id);
CREATE INDEX IF NOT EXISTS idx_diagnosis_camp       ON diagnosis (camp_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_camp   ON prescriptions (camp_id);
CREATE INDEX IF NOT EXISTS idx_lab_orders_camp      ON lab_orders (camp_id);

-- ── stock movements need a 'camp' reference type ─────────────────────────────────────
--
-- Migration 055 constrained reference_type to purchase_order/patient/department/
-- adjustment, so an allocation issue would be rejected by the CHECK. Widen it rather than
-- overload 'department', which would make camp consumption indistinguishable from internal
-- transfers in every stock report.
ALTER TABLE inventory_stock_movements
  DROP CONSTRAINT IF EXISTS inventory_stock_movements_reference_type_check;
ALTER TABLE inventory_stock_movements
  ADD CONSTRAINT inventory_stock_movements_reference_type_check
  CHECK (reference_type IS NULL OR reference_type IN
    ('purchase_order', 'patient', 'department', 'adjustment', 'camp'));

COMMENT ON TABLE camps IS
  'Medical camps: time-boxed events at a venue, run as a station pipeline. Clinical output is stamped onto the ordinary clinical tables with camp_id.';
COMMENT ON TABLE camp_registrations IS
  'Lightweight pre-patient records for camp attendees. Promoted to a patients row on first clinical touch; patient_id is null until then.';
COMMENT ON COLUMN camps.next_token_no IS
  'Next queue token to hand out. Incremented under a row lock on this camp so concurrent registration desks cannot collide.';
