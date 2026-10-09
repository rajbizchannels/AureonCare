# Implementation Steps — Medical Camps & Specialty Configuration Wizard

Ordered runbook for the two proposals in `FEATURE_MEDICAL_CAMPS.md` and
`FEATURE_SPECIALTY_WIZARD.md`. Each step names the files to create or edit and the
acceptance check that proves it landed.

Migration numbering as of this document: next global is **083**, next tenant is **004**.
Renumber if other work merges first — the runners order by filename / version prefix.

---

## Rules that apply to every step

These are the things this codebase punishes you for getting wrong. Re-read before each
migration.

1. **Tenant migrations** (`backend/migrations/tenant/NNN_*.sql`) use **unqualified** table
   names. The runner sets `search_path` per schema and applies the file to every tenant
   plus the golden `template`.
2. **Global migrations** (`backend/migrations/NNN_*.sql`) must `SET search_path TO public;`
   **and** schema-qualify every object. Migration 066 set the *database* default
   `search_path` to `tenant_default, public, control`, so unqualified DDL in a global
   migration silently lands in `tenant_default`. Follow `072_global_runtime_ddl.sql`.
3. **Every new tenant table needs three things**, not one: created by a tenant migration,
   registered in `control.tenant_tables`, and cloned into `template` via
   `control.clone_table` + `control.replicate_intra_fks`. Pattern:
   `071_sec05_lazy_created_tenant_tables.sql`. Miss the registration and newly provisioned
   tenants lack the table, then routes that lazily `CREATE TABLE IF NOT EXISTS` make empty
   shadow copies that read zero rows.
4. Tenant migrations run **inside a transaction** — no `CREATE INDEX CONCURRENTLY`.
5. **Expand/contract only.** New columns are nullable; no `NOT NULL` in the same release as
   the column. Backfill in a later step.
6. Routes use **`req.db`** (per-request tenant pool), never `req.app.locals.pool`, except
   for genuinely global/control-plane reads.
7. Deploy order is always: `npm run migrate` then `npm run migrate:tenants`.
8. Verify with `npm run check:schema-health` and `npm run check:tenant-scoping` before
   calling a migration step done.

---

# Part A — Phase 0: `locations` (shared prerequisite)

Do this first. Both features need it, and building it twice is the expensive mistake.

### A1. Tenant migration — create the table
**Create** `backend/migrations/tenant/004_locations.sql`

- `CREATE TABLE IF NOT EXISTS locations (...)` per the DDL in `FEATURE_MEDICAL_CAMPS.md` §3.
- Indexes on `is_active`, `location_type`.
- Seed one `is_primary = true` row named from `practices.name` if the table is empty, so
  every existing tenant has a default site.

### A2. Global migration — register and clone
**Create** `backend/migrations/083_locations_tenant_table.sql`

- `SET search_path TO public;`
- `INSERT INTO control.tenant_tables (table_name, sort_order) VALUES ('locations', 400) ON CONFLICT DO NOTHING;`
- `SELECT control.clone_table('tenant_default', 'locations', 'template');`
- `SELECT control.replicate_intra_fks('tenant_default', 'template', ARRAY['locations']);`

**Accept:** `locations` exists in `template` and in every `tenant_*` schema;
`check:schema-health` clean.

### A3. Tenant migration — additive `location_id` columns
**Create** `backend/migrations/tenant/005_location_id_columns.sql`

Nullable `location_id uuid REFERENCES locations(id) ON DELETE SET NULL` on:
`appointments`, `inventory_stock_movements`, `doctor_availability`,
`clinic_working_hours`. Index each. Backfill all existing rows to the primary location
in the same file (row counts are small per tenant).

> `ON DELETE SET NULL`, not `CASCADE` — and note the `audit_logs` lesson from tenant/003:
> a `SET NULL` is an UPDATE, so never add one to an append-only table.

### A4. Backend — locations CRUD
**Create** `backend/routes/locations.js` (follow `routes/appointment-types.js` for shape:
`authenticate`, then `enforceActiveBilling`, then `req.db`).
**Edit** `backend/server.js` — `app.use('/api/locations', require('./routes/locations'));`
**Edit** `backend/migrations/083_*.sql` or a follow-up — add `locations.view` /
`locations.manage` to `permissions` + `role_permissions` for admin.

### A5. Frontend — site selector
**Edit** `frontend/src/api/apiService.js` — locations CRUD calls.
**Edit** `frontend/src/constants/adminConstants.js` — add `LOCATIONS: 'locations'` to
`ADMIN_TABS`.
**Create** `frontend/src/components/admin/LocationsPanel.js`.
**Edit** `frontend/src/config/translations.js` — keys across all five locales.

**Accept:** an admin can add a second site; existing appointments still load; scheduling is
unchanged for single-site tenants (null `location_id` must behave exactly as today).

---

# Part B — Medical Camps

## B1. Schema

**Create** `backend/migrations/tenant/006_camps.sql`

| Table | Key columns |
|---|---|
| `camps` | `name`, `location_id`, `sponsor_name`, `starts_at`, `ends_at`, `status`, `capacity`, `is_free`, `budget`, `created_by` |
| `camp_services` | `camp_id`, `offering_id`, `is_free`, `price` |
| `camp_staff` | `camp_id`, `user_id`, `camp_role`, UNIQUE(`camp_id`,`user_id`) |
| `camp_stations` | `camp_id`, `name`, `step_order`, `offering_id`, `form_template_id` |
| `camp_inventory_allocations` | `camp_id`, `item_id`, `qty_issued`, `qty_consumed`, `qty_returned`, `reconciled_at` |
| `camp_registrations` | `camp_id`, `token_no`, `full_name`, `phone`, `age_years`, `date_of_birth`, `gender`, `consent_given_at`, `consent_form_submission_id`, `status`, `patient_id` (nullable) |
| `camp_station_visits` | `registration_id`, `station_id`, `queued_at`, `started_at`, `completed_at`, `handled_by`, `outcome`, `notes` |

- `status` as `varchar` + `CHECK`, not an enum — enums are painful to extend across 100+
  tenant schemas.
- `UNIQUE (camp_id, token_no)`.
- Nullable `camp_id` on `campaigns`, `appointments`, `medical_records`, `diagnosis`,
  `prescriptions`, `lab_orders` — the camp stamp. **Do not** create camp-only clinical
  tables.

**Create** `backend/migrations/084_camps_tenant_tables.sql` — register all seven in
`control.tenant_tables` (sort_order 410–416), clone into `template`, replicate FKs.

**Accept:** `check:schema-health` clean; a freshly provisioned tenant has all seven tables.

## B2. Camp planning API
**Create** `backend/routes/camps.js` — CRUD for camps, services, staff, stations,
allocations. Gate with `enforceFeature('camps')` from `middleware/planEnforcement.js`.
**Edit** `backend/server.js` — register `/api/camps`.
**Edit** permissions migration — `camps.view`, `camps.manage`, `camps.register`,
`camps.clinical`, `camps.sponsor_report`.

Enforce in the status transition handler:
- `draft → published` requires a location, at least one service and at least one staff member.
- `published → in_progress` requires inventory allocations recorded.
- `in_progress → closed` requires every allocation reconciled
  (`qty_issued = qty_consumed + qty_returned`) and freezes counts.

**Accept:** unit test per illegal transition; `enforceFeature` returns the upgrade error on
a plan without `features.camps`.

## B3. Staffing conflict check
**Edit** `backend/routes/camps.js` + `backend/routes/scheduling.js`

Adding a user to `camp_staff` must check for clinic appointments at another
`location_id` inside the camp window, and refuse with the specific conflicts listed (not a
generic "conflict" string — that pattern has cost this project repeated round trips).
Conversely, `scheduling.js` availability must exclude providers rostered to a camp.

**Accept:** a provider booked at the clinic cannot be silently rostered to a same-day camp.

## B4. Registration & token queue
**Create** `backend/routes/camp-registrations.js`

- `POST /api/camps/:id/registrations` — issues the next `token_no` inside a transaction.
- Consent gate: **reject any station write** for a registration with
  `consent_given_at IS NULL`. Enforce in the route *and* as a DB check where practical.
- `GET /api/camps/:id/registrations/match?phone=&name=` — fuzzy candidate patients.
- `POST /api/camp-registrations/:id/promote` — create or link a `patients` row inside a
  transaction, set `patient_id`. This is the **only** path that creates a patient from a
  camp, so dedup stays auditable.

**Accept:** a registration with name + phone + age only succeeds (no MRN, no DOB); clinical
writes are refused before consent; promotion is idempotent.

## B5. Station pipeline
**Edit** `backend/routes/camps.js` — station queue endpoints (claim next, start, complete),
each writing `camp_station_visits` and stamping `camp_id` on whatever clinical row the
station produces.

## B6. Camp frontend
**Create**:
- `frontend/src/views/CampsManagementView.js` — list, create, lifecycle
- `frontend/src/components/panels/CampPlanningPanel.js` — services, staff, stations, stock
- `frontend/src/views/CampRegistrationDeskView.js` — high-speed capture, token display
- `frontend/src/views/CampStationBoardView.js` — per-station queue
- `frontend/src/components/panels/CampDashboardPanel.js` — throughput, waits, referrals

**Edit**:
- `frontend/src/config/modules.js` — `{ id: 'camps', ... }`
- `frontend/src/config/navigation.js` — nav entries
- `frontend/src/config/planFeatures.js` — `camps` in `clinical_pro`, `enterprise`, `onprem`
- `frontend/src/utils/rolePermissions.js` — role access for `camps`
- `frontend/src/api/apiService.js` — camp API surface
- `frontend/src/config/translations.js` — keys × 5 locales

The registration desk is the only screen with a hard performance requirement: keyboard-only
capture, no modal chains, token visible immediately.

## B7. Outreach
**Edit** `backend/routes/campaigns.js` + `frontend/src/views/CampaignsManagementView.js` —
let a campaign target a camp (`camp_id`) and send through the existing
`services/notificationService.js` / `whatsappService.js`. No second messaging engine.

## B8. Sponsor report — treat as a security feature
**Create** `backend/routes/camp-reports.js`

- `GET /api/camps/:id/sponsor-report` — its own route, its own permission
  (`camps.sponsor_report`), and an **explicit allowlisted projection**: counts, age bands,
  gender split, conditions screened, referrals made. Never a filtered view of the clinical
  report — a filter can be forgotten, an allowlist cannot.
- Log every access to `audit_logs`.

**Accept:** a test asserts the response body contains **no** patient identifier, name,
phone, DOB or free-text clinical note. Make this test the gate on the endpoint.

## B9. Billing bypass
**Edit** `backend/routes/camps.js` / payment creation path — a camp with `is_free = true`
must not create `payments` or `claims` rows. Sponsor-funded camps record a single
camp-level budget entry, not per-attendee charges.

## B10. Tests
**Create** `backend/test/camps/*.test.js` following `backend/test/signup/` style:
lifecycle transitions, token uniqueness under concurrency, consent gate, promotion/dedup,
inventory reconciliation, staffing conflict, and the sponsor-report PHI assertion.

## B11. Docs
**Edit** `USER_MANUAL.md`, `DEPLOYMENT_CHECKLIST.md` (new env/plan feature flag),
`ARCHITECTURE_DIAGRAM.md`.

> **Phase 4 (offline capture) is deliberately not in this list.** Revisit only on real
> customer demand; if built, scope to registration/vitals/forms with server-pre-issued
> token ranges and a mandatory conflict-review screen.

---

# Part C — Specialty Configuration Wizard

Build the engine before the UI. Building the wizard first tends to bake pack semantics into
React state, where they cannot be re-applied, upgraded or audited.

## C1. Global catalog tables
**Create** `backend/migrations/085_specialty_catalog.sql` (`SET search_path TO public;`,
fully qualified)

- `public.specialties` — `code` PK, `name`, `parent_code`, `taxonomy_code`, `is_active`,
  `sort_order`. Seed the specialty list.
- `public.specialty_packs` — `code`, `version`, `definition jsonb`, `is_active`,
  `published_at`, `reviewed_by`, UNIQUE(`code`,`version`).

These are **catalog, not tenant data** — they belong in `public` next to
`subscription_plans`, and must **not** be registered in `control.tenant_tables`.

## C2. Provenance columns
**Create** `backend/migrations/tenant/007_pack_provenance.sql`

Nullable `source_pack varchar(60)`, `source_pack_version integer`,
`is_customised boolean DEFAULT false` on every pack-seeded table:
`service_categories`, `healthcare_offerings`, `appointment_type_config`,
`appointment_types`, `form_templates`, `inventory_categories`, `roles`.
Plus nullable `department_id uuid` on the same tables — left null in this phase, but adding
the column now is cheap and re-attributing thousands of rows later is not.

**Also edit** the update paths in `routes/offerings.js`, `routes/form-management.js`,
`routes/appointment-types.js`, `routes/roles.js`, `routes/inventory.js` to set
`is_customised = true` when a user edits a row whose `source_pack` is non-null.
**This is the step that makes safe pack upgrades possible — if it is skipped, C5 cannot
work and cannot be retrofitted cheaply.**

## C3. `providers.specialty_code`
**Create** `backend/migrations/tenant/008_provider_specialty_code.sql`

Add nullable `specialty_code varchar(60)`; backfill by best-effort match against
`public.specialties` from the existing free-text `specialization`. Keep both columns for at
least one release; drop neither until every tenant is migrated.

## C4. Pack schema + validator
**Create**:
- `backend/data/specialty-packs/README.md` — the pack contract
- `backend/data/specialty-packs/dentistry.v1.json`
- `backend/utils/specialtyPackSchema.js` — validator

The validator **rejects** any pack containing SQL, function references, file paths, or role
definitions that are not `{ name, basedOn }` over an existing permission set. A pack may
only ever narrow plan/role visibility, never widen it. Enforce that here, not in review.

## C5. Apply engine
**Create** `backend/services/specialtyPack.js`

```js
applyPack(db, pack, { mode })   // 'preview' | 'seed' | 'upgrade'
```

- One transaction on `req.db`.
- Idempotent by natural key (`slug` / `code` / `name`).
- Stamps `source_pack`, `source_pack_version` on everything it writes.
- `upgrade` **never** overwrites a row with `is_customised = true` — returns it as a
  conflict for the admin to resolve.
- `preview` writes nothing and returns the exact create / update / skip / conflict diff the
  wizard renders at step 6.

**Accept:** apply twice → second run reports all-skip, zero writes. Edit a seeded offering,
bump the pack version, upgrade → the edit survives and is listed as a conflict.

## C6. Pack loader
**Create** `backend/scripts/load-specialty-packs.js`
**Edit** root `package.json` — `"packs:load": "node backend/scripts/load-specialty-packs.js"`

Validates each JSON file and upserts into `public.specialty_packs`. Run in deploy after
`migrate`.

## C7. Wizard API
**Create** `backend/routes/practiceSetup.js`

- `GET /api/practice-setup/state` — from `organization_settings.settings.onboarding`
- `PUT /api/practice-setup/state` — per-step save (resumable)
- `GET /api/practice-setup/specialties`
- `POST /api/practice-setup/preview` — `applyPack(..., { mode: 'preview' })`
- `POST /api/practice-setup/apply` — `seed` or `upgrade`, writes
  `settings.onboarding.appliedPacks`, logs to `audit_logs`

**Edit** `backend/server.js` — register `/api/practice-setup`.
**Edit** permissions — `practice.configure`, `practice.apply_specialty_pack`.
**Edit** `backend/services/tenantProvisioning.js` — set
`settings.onboarding = { startedAt: null, completedAt: null }` so the wizard knows to
offer itself. **Do not apply packs during provisioning** — pack application must be an
authenticated admin action so it is attributable.

Multi-specialty merge rule, implemented here: union for additive sections (offerings,
forms, codes), primary-specialty-wins for scalars and terminology, conflicts surfaced in
the preview diff rather than resolved silently.

## C8. Wizard UI
**Create** `frontend/src/views/PracticeSetupWizardView.js` plus one component per step
under `frontend/src/components/panels/setup/`:

1. Practice profile — pre-filled from signup, don't re-ask
2. Specialty (primary + additional, multi-select)
3. Services & appointment types (preview + edit)
4. Providers & hours (reuse `InviteStaffPanel`, `clinic_working_hours`)
5. Forms & intake flow
6. Review & apply — renders the `preview` diff, then one transactional apply

**Edit**:
- `frontend/src/App.js` — auto-launch when `onboarding.completedAt` is unset
- `frontend/src/constants/adminConstants.js` — `SETUP: 'setup'` in `ADMIN_TABS` for re-runs
- `frontend/src/api/apiService.js`, `frontend/src/config/translations.js`

Every step must be skippable. "Skip for now" leaves a fully working generic practice — the
wizard is an accelerator, never a gate.

## C9. Specialty module filtering
**Edit** `frontend/src/config/planFeatures.js`, `frontend/src/utils/rolePermissions.js`,
`frontend/src/components/layout/AppShell.js`

```
visible = (planModules ∩ roleModules) \ (specialtyHidden \ adminPinned)
```

Specialty **only subtracts**. Add an admin override list plus a persistent "Show all
modules" toggle — hiding modules a customer pays for with no way back is both a support
burden and lost upsell surface.

**Accept:** a dental tenant on `enterprise` no longer sees FHIR / denials / laboratory by
default, and an admin can restore them in one click.

## C10. Terminology overrides
**Edit** `frontend/src/config/translations.js` + its lookup helper — resolve as
`packOverride ?? translations[locale][key]`, sourced from
`organization_settings.settings.specialty.terminology`.

## C11. Consolidate the form library
**Move** the 825 lines of `frontend/src/data/formTemplates.js` into specialty packs
server-side, so there is one source of truth.
**Edit** `frontend/src/components/forms/FormTemplateLibrary.js` to read the API that
`backend/routes/form-management.js` already exposes.

## C12. Reference packs
**Create** `dentistry`, `ophthalmology`, `paediatrics` pack JSON.

**This step has a non-engineering gate:** CPT/ICD subsets and clinical forms are regulated
content. Each pack version needs clinician review recorded in
`specialty_packs.reviewed_by` before `is_active = true`. Do not ship packs on engineering
sign-off alone.

## C13. Tests
**Create** `backend/test/specialty/*.test.js` — validator rejection cases, apply
idempotency, upgrade-preserves-customisation, multi-pack merge conflicts, and that a pack
cannot widen plan or role visibility.

## C14. Docs
**Edit** `USER_MANUAL.md`, `DEPLOYMENT_CHECKLIST.md`,
`backend/data/specialty-packs/README.md`.

---

# Deploy sequence (every release in this plan)

```
npm run migrate            # global: public / control
npm run migrate:tenants    # fan out to every tenant schema + template
npm run packs:load         # Part C only
npm run check:schema-health
npm run check:tenant-scoping
```

Then redeploy backend and frontend.

---

# Suggested order of work

| # | Block | Why here |
|---|---|---|
| 1 | A1–A5 (`locations`) | unblocks both features; useful alone for multi-branch |
| 2 | C1–C6 (taxonomy, provenance, engine) | **provenance must precede any pack seeding** |
| 3 | C7–C10 (wizard API + UI + filtering) | first customer-visible win, lowest risk |
| 4 | B1–B5 (camp schema, API, registration, stations) | |
| 5 | B6–B9 (camp UI, outreach, sponsor report, billing) | |
| 6 | C11–C12 (form library, reference packs) | gated on clinician review |
| 7 | B10–B11, C13–C14 (tests, docs) | written alongside, not after |

Two ordering constraints are not negotiable:

- **C2 before any pack is ever applied.** Provenance columns cannot be retrofitted onto
  already-seeded rows without guessing which were customised.
- **A1–A3 before B1.** Camps without `locations` means camp-local address fields, which is
  exactly the duplicate hierarchy this plan exists to avoid.
