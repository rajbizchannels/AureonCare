# Medical Camps — Evaluation and Implementation Approach

**Status:** proposal, not implemented
**Scope:** organise and run off-site medical camps (screening drives, health fairs,
corporate/community camps, mobile clinics) inside AureonCare.

---

## 1. What a camp actually is, operationally

A camp is not "a lot of appointments". It is a **time-boxed event at a venue the practice
does not own**, run as a *station pipeline* rather than a slot calendar:

```
outreach → pre-registration → on-site registration (token) → vitals → consult
         → lab / screening → pharmacy / dispensing → exit counselling → follow-up referral
```

Its distinguishing properties, each of which the current product contradicts somewhere:

| Property | Consequence |
|---|---|
| Off-site venue | needs a location entity — there is none |
| Hundreds of walk-ins in hours | registration must be seconds, not a full patient record |
| Staff are *away* from the clinic that day | provider availability must be site-aware |
| Usually free / sponsor-funded | must not generate claims or invoices |
| Supplies are physically carried to site | inventory must be allocatable and reconciled |
| Often poor connectivity | the SPA assumes an always-on API |
| Sponsors want results | sponsors must receive aggregates and never PHI |

---

## 2. Evaluation of the existing codebase

### 2.1 What is directly reusable

| Need | Existing asset |
|---|---|
| Outreach / invitations | `campaigns` table + `routes/campaigns.js`, `CampaignsManagementView.js` |
| Service menu for the camp | `healthcare_offerings`, `service_categories`, `offering_packages`, `routes/offerings.js` |
| Scheduling for pre-booked slots | `appointments`, `appointment_type_config`, `routes/scheduling.js` |
| Overflow handling | `appointment_waitlist`, `routes/waitlist.js` |
| Screening forms, consent, e-signature | `form_templates` / `form_submissions` / `form_signatures` / `intake_flow_templates` (migration `056a`) |
| Clinical capture | `medical_records`, `diagnosis`, `prescriptions`, `lab_orders`, `laboratories` |
| Supplies | `inventory_items`, `inventory_stock_movements`, `inventory_purchase_orders` (migration `055`) |
| Reminders / results / WhatsApp | `services/notificationService.js`, `reminderService.js`, `whatsappService.js` |
| Reporting | `routes/reports.js`, `booking_analytics`, `REPORT_CATEGORIES` |
| Access control + compliance | `roles` / `permissions` / `role_permissions`, append-only `audit_logs`, `archive_rules` |
| Plan gating | `middleware/planEnforcement.js` (`enforceFeature`, line ~226), `config/planFeatures.js` |

That is a lot — roughly 70% of a camp module already exists as parts. The missing 30% is
structural, not cosmetic.

### 2.2 Gaps — the real blockers

1. **There is no location / site / facility entity anywhere.**
   `grep -n location backend/schema.sql` returns nothing. `clinic_info` is a single row,
   `clinic_working_hours` is a flat weekday list, `appointments` has no site column. The
   whole product assumes exactly one implicit physical place. A camp is defined by *not*
   being that place.

2. **No event container.** Nothing can express "these 400 encounters, 6 providers,
   4 stations, 1 venue, 1 day, 1 sponsor are one thing" — which is what every camp report,
   budget and audit is keyed on.

3. **Provider availability is practice-wide.** `doctor_availability` and `doctor_time_off`
   cannot say "Dr X is at the Saturday camp and therefore not bookable at the clinic".
   Without this, camps will silently double-book clinicians.

4. **Registration is too heavy for walk-ins.** `patients.date_of_birth` and `patients.mrn`
   are `NOT NULL`, `mrn` is unique, and `users.first_name`/`last_name` are `NOT NULL`. Camp
   attendees routinely give a name, a phone and an approximate age. Forcing them through
   the full patient record will either block the queue or fill the patient index with
   junk and duplicates.

5. **No queue / token / station model.** Appointments are timed slots; camps are queues.

6. **Inventory has no location dimension.** `inventory_stock_movements` cannot express
   "200 units issued to Camp #17, 164 consumed, 36 returned".

7. **Billing assumes a payer.** Camps are usually free or sponsor-funded; RCM must be
   bypassed deliberately, not by leaving rows unpaid.

8. **No offline story.** CRA SPA + serverless Express; `AC_UPL_DIR=/tmp` on Vercel means
   even uploads are ephemeral. Field connectivity is a genuine risk for rural camps.

9. **Sponsor data boundary does not exist.** Nothing today distinguishes "data a sponsor
   may see" (counts, age bands, conditions screened) from PHI. This must be designed in,
   not bolted on — it is the highest-consequence risk in the whole feature.

---

## 3. Recommended approach

Design rule throughout: **a camp is a scheduling and aggregation context layered over the
existing clinical tables — not a parallel clinical system.** Every clinical row a camp
produces is an ordinary `medical_records` / `diagnosis` / `prescriptions` row with a
`camp_id` stamp. Nothing clinical gets a camp-only copy.

### Phase 0 — `locations` (prerequisite, and valuable on its own)

Introduce sites as a first-class tenant entity. This is the one change that unblocks camps
*and* multi-branch practices *and* department-level configuration (see the specialty wizard
proposal), so it should be costed as platform work rather than camp work.

```sql
-- backend/migrations/tenant/004_locations.sql   (unqualified names, see tenant/README.md)
CREATE TABLE IF NOT EXISTS locations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          varchar(255) NOT NULL,
  location_type varchar(30)  NOT NULL DEFAULT 'clinic',  -- clinic | camp | mobile | partner
  address       text,
  city          varchar(100),
  state         varchar(100),
  country       varchar(2),
  postal_code   varchar(20),
  latitude      numeric(9,6),
  longitude     numeric(9,6),
  timezone      varchar(100),
  is_primary    boolean DEFAULT false,
  is_active     boolean DEFAULT true,
  created_at    timestamp DEFAULT NOW(),
  updated_at    timestamp DEFAULT NOW()
);
```

Then, additively and nullable (expand/contract — never a `NOT NULL` in the same release):
`appointments.location_id`, `inventory_stock_movements.location_id`,
`doctor_availability.location_id`, `clinic_working_hours.location_id`.
Backfill every existing row to the tenant's primary location.

### Phase 1 — Organise (the planning side)

```
camps                       -- the event: name, location_id, sponsor, dates, status,
                            --   capacity, is_free, budget, visibility, created_by
camp_services               -- camps × healthcare_offerings (what is offered, free or priced)
camp_staff                  -- camps × users: role at camp (registrar, clinician, lab, pharmacy)
camp_stations               -- ordered pipeline stages; each maps to an offering and/or form
camp_inventory_allocations  -- items issued → consumed → returned, reconciled on close
```

Lifecycle: `draft → published → in_progress → closed → archived`. Only `published` camps
accept pre-registration; only `in_progress` accepts on-site capture; `closed` freezes
counts and generates the reconciliation and sponsor reports.

Outreach reuses `campaigns` with a new nullable `camp_id` — no second messaging engine.

### Phase 2 — Run (the field side)

The important decision: **do not weaken the `patients` table.**

```
camp_registrations   -- lightweight pre-patient: token_no, full_name, phone,
                     --   age_years OR date_of_birth, gender, consent_given_at,
                     --   consent_form_submission_id, camp_id, status,
                     --   patient_id (nullable — set on promotion)
camp_station_visits  -- registration × station: queued_at, started_at, completed_at,
                     --   handled_by, outcome, notes
```

A registration is **promoted** to a real `patients` row on first clinical touch (or on
follow-up referral), with a phone/name/DOB fuzzy-match step offering "link to existing
patient" before creating a new one. This keeps camp throughput fast, keeps the patient
index clean, and makes deduplication an explicit, auditable action rather than an
accident.

Consent is a hard gate: no station past registration may write clinical data for a
registration with `consent_given_at IS NULL`. Enforce in the route layer *and* as a
check constraint where practical.

### Phase 3 — Outcome, follow-up, and the sponsor boundary

- Camp dashboard: throughput per station, wait times, screening positives, referrals made.
- **Referral conversion** — camp attendee → clinic appointment. This is the commercial
  justification for camps and should be a first-class, measured funnel, not a footnote.
- **Sponsor report**: a separate, explicitly-whitelisted aggregate endpoint
  (`GET /api/camps/:id/sponsor-report`) returning counts, age bands and condition
  categories only. Implement it as its own route with its own allowlisted projection —
  never as a filtered view of the clinical report, because a filter can be forgotten and
  an allowlist cannot. Every access logged to `audit_logs`.

### Phase 4 — Offline capture (defer until a customer actually needs it)

Scope it narrowly if built: registration, vitals and screening forms only — never
prescriptions or diagnoses. IndexedDB queue, server-assigned token ranges handed out
before going offline (so tokens never collide), last-write-wins only for rows created
offline, and a mandatory human review screen for every conflict. This is the single most
expensive item in the proposal and the easiest to get wrong; it should not be in the MVP.

---

## 4. Integration mechanics (easy to get wrong in this codebase)

- **New tenant tables must be registered, not just created.** Create them in
  `backend/migrations/tenant/NNN_*.sql` with *unqualified* names (the runner sets
  `search_path` per schema), then add a **global** migration that inserts into
  `control.tenant_tables` and clones into the golden `template` via
  `control.clone_table` + `control.replicate_intra_fks` — exactly the pattern in
  `migrations/071_sec05_lazy_created_tenant_tables.sql`. Skip this and newly provisioned
  tenants silently lack the tables, and routes that lazily `CREATE TABLE IF NOT EXISTS`
  will create empty shadow copies that read zero rows.
- Tenant migrations run **inside a transaction** — no `CREATE INDEX CONCURRENTLY`.
- All routes use `req.db` (per-request tenant pool), never `req.app.locals.pool`.
- Gate the module: `subscription_plans.features.camps` + `enforceFeature('camps')` in
  `middleware/planEnforcement.js`, a `camps` entry in `config/planFeatures.js`
  (clinical_pro and above), a module in `config/modules.js`, and nav in
  `config/navigation.js`.
- Add permission keys to `permissions` / `role_permissions` (`camps.view`, `camps.manage`,
  `camps.register`, `camps.clinical`, `camps.sponsor_report`) rather than role-name checks.
- Add translation keys across all five locales in `config/translations.js`.

---

## 5. Risks

| Risk | Mitigation |
|---|---|
| **PHI leaking to sponsors** | allowlisted aggregate endpoint, separate permission, audited |
| Duplicate patient records | promotion step with fuzzy match + explicit link action |
| Provider double-booked clinic/camp | `location_id` on availability; conflict check at camp staffing |
| Inventory never reconciled | `closed` transition requires allocation reconciliation |
| Consent skipped under queue pressure | hard gate before any clinical station |
| Offline sync corruption | defer; if built, pre-issued token ranges + mandatory conflict review |
| Scope creep into a parallel EHR | camps stamp existing clinical tables; no camp-only clinical storage |

## 6. Rough effort

| Phase | Backend | Frontend | Notes |
|---|---|---|---|
| 0 — locations | 3–4 d | 2 d | reusable beyond camps |
| 1 — organise | 5–7 d | 5–7 d | camp CRUD, staffing, services, outreach hook |
| 2 — run | 7–10 d | 8–12 d | registration, token queue, station board |
| 3 — outcomes | 4–5 d | 4–5 d | dashboard, referral funnel, sponsor report |
| 4 — offline | 10–15 d | 10–15 d | **defer** |

Phases 0–3 give a complete, shippable camp module. Phase 4 is a separate business decision.
