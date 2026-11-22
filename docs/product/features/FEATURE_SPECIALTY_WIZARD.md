# Specialty-Based Configuration Wizard — Evaluation and Implementation Approach

**Status:** proposal, not implemented
**Goal:** let a speciality hospital or clinic (dental, ophthalmology, orthopaedics,
cardiology, paediatrics, IVF, dermatology, behavioural health, …) reach a *configured,
relevant* system in minutes instead of discovering a generic multi-speciality EHR and
abandoning it.

---

## 1. Evaluation of the existing codebase

### 1.1 The concept is already half-born

- `form_templates.specialty varchar(100)` exists (migration `056a_create_form_management.sql`,
  line 45) **and is indexed** (`idx_form_templates_specialty`).
- `frontend/src/data/formTemplates.js` (825 lines) already tags templates with
  `behavioral_health`, `pediatrics`, `dentistry` — and leaves `specialty: ''` on most.
- `providers.specialization varchar(100)` exists.

So someone already reached for this idea and stopped. Nothing consumes those tags: there is
no taxonomy, no wizard, no seeding, and no other entity in the system is specialty-aware.

### 1.2 What is reusable as a seeding target

Every piece of configuration a specialty pack would need to create already has a home:

| Pack section | Existing table / asset |
|---|---|
| Service catalogue | `service_categories`, `healthcare_offerings` (already has `cpt_codes`, `icd_codes`, `hcpcs_codes`, `min_age`, `max_age`, `gender_restriction`, `allowed_provider_specializations`) |
| Appointment types | `appointment_type_config`, `appointment_types` |
| Forms & intake | `form_templates`, `intake_flow_templates`, `patient_intake_flows` |
| Code favourites | `medical_codes` |
| Supplies | `inventory_categories`, `inventory_items` |
| Roles | `roles`, `permissions`, `role_permissions` |
| Hours | `clinic_working_hours`, `clinic_appointment_settings` |
| Free-form settings | `organization_settings.settings jsonb` |
| Module visibility | `config/planFeatures.js` + `utils/rolePermissions.canAccessModule` |
| Labels | `config/translations.js` |
| Reports | `REPORT_CATEGORIES` in `views/ReportsView.js` |
| Single provisioning funnel | `services/tenantProvisioning.js` — the natural hook point |

### 1.3 Gaps

1. **No specialty taxonomy.** `providers.specialization` is free text, so nothing can be
   keyed off it reliably.
2. **No wizard and no first-run state.** Nothing records whether a tenant has ever been
   configured. A new tenant lands in a fully generic product.
3. **No content-pack format or seeding engine.** The only "system templates" that exist
   live in a *frontend* JS file, which cannot seed a tenant schema.
4. **Module visibility is tier × role only.** A dental practice on `enterprise` still sees
   RCM denials, FHIR tracking, laboratory management, pharmacy, pre-authorisation — all
   noise, and noise is what makes evaluators conclude the product "isn't for us".
5. **No drift story.** If a tenant edits a seeded form and the pack is later updated,
   there is nothing to reconcile and no way to know the row was customised.
6. **Terminology is hardcoded.** Dental says *chair*, physio says *session*, IVF says
   *cycle*. All five locales in `translations.js` are fixed strings.
7. **Multi-specialty hospitals have no department dimension** — the actual case behind
   "speciality hospitals", since most run several specialities under one tenant.

---

## 2. Recommended approach

**Design principle: the wizard is a thin UI over a declarative specialty pack, and the pack
is data, not code.** If a behaviour cannot be expressed as pack data, it does not belong in
the wizard. Corollaries that matter:

- The pack sets **defaults**, never constraints. An admin can always override or re-show
  anything the pack hid.
- Applying a pack must be **idempotent, previewable and transactional**.
- A pack may only ever *narrow* what the plan tier and the user's role already permit —
  never widen it. Specialty is not an entitlement mechanism.

### 2.1 Taxonomy — global, not per-tenant

```sql
-- global migration (public schema — catalog data, lives next to subscription_plans)
CREATE TABLE IF NOT EXISTS public.specialties (
  code        varchar(60) PRIMARY KEY,         -- 'dentistry', 'ophthalmology', 'cardiology'
  name        varchar(150) NOT NULL,
  parent_code varchar(60) REFERENCES public.specialties(code),
  taxonomy_code varchar(20),                   -- NUCC taxonomy, where one applies
  is_active   boolean DEFAULT true,
  sort_order  integer DEFAULT 0
);
```

Add `providers.specialty_code` alongside the existing free-text `specialization`
(expand/contract: backfill by best-effort match, keep both for a release, drop neither
until every tenant is migrated).

### 2.2 Pack format — versioned JSON, authored in-repo

Stored in `public.specialty_packs (code, version, definition jsonb, is_active, published_at)`,
authored as `backend/data/specialty-packs/<code>.v<N>.json`, loaded by a seed script.

```jsonc
{
  "code": "dentistry",
  "version": 3,
  "label": "Dental Practice",
  "modules":            { "hide": ["fhir", "laboratory", "denials"] },
  "terminology":        { "appointment": "Chair Visit", "provider": "Dentist" },
  "appointmentTypes":   [{ "name": "Scaling & Polishing", "durationMinutes": 30, "bufferMinutes": 10 }],
  "serviceCategories":  [{ "slug": "restorative", "name": "Restorative" }],
  "offerings":          [{ "slug": "composite-filling", "categorySlug": "restorative",
                            "cptCodes": ["D2391"], "durationMinutes": 45 }],
  "formTemplates":      ["dental-intake", "dental-consent-extraction"],
  "intakeFlow":         ["dental-intake", "hipaa-notice"],
  "codeSets":           { "icd10": ["K02.9", "K05.1"], "cpt": ["D0120", "D1110"] },
  "inventoryCategories":[{ "name": "Restorative Materials" }],
  "roles":              [{ "name": "Dental Assistant", "basedOn": "staff" }],
  "settings":           { "defaultAppointmentDuration": 30 },
  "reports":            { "show": ["clinical", "financial"] }
}
```

Note what is *absent*: no SQL, no function names, no permission definitions. Roles are
declared as a label over an **existing** permission set (`basedOn`), so a pack can never
invent authority.

### 2.3 Apply engine

`backend/services/specialtyPack.js`, one entry point:

```js
applyPack(db, pack, { mode })   // mode: 'preview' | 'seed' | 'upgrade'
```

- Single transaction on `req.db` (the tenant pool).
- Idempotent by natural key (`slug`, `code`, `name`) — re-applying changes nothing.
- Every seeded row stamped `source_pack`, `source_pack_version`, `is_customised boolean`.
- On `upgrade`, rows with `is_customised = true` are **never** overwritten; they are
  reported as conflicts for the admin to resolve. This is the whole answer to drift, and
  it has to be designed in from the first row written — retrofitting provenance onto
  already-seeded data is painful.
- `preview` writes nothing and returns the exact create/update/skip/conflict diff that the
  wizard's final step renders. The admin should never press Apply without seeing this.

### 2.4 Wizard UX — 6 steps, resumable, always skippable

State in `organization_settings.settings.onboarding`
(`{ startedAt, completedAt, currentStep, appliedPacks: [{code, version, appliedAt}] }`).

1. **Practice profile** — name, country, timezone, currency (mostly already captured at
   signup; pre-fill, don't re-ask).
2. **Specialty** — primary + optional additional specialities. Multi-select is the core
   requirement for speciality *hospitals*.
3. **Services & appointment types** — preview and edit what will be created.
4. **Providers & hours** — invite providers (reuse `InviteStaffPanel`), set
   `clinic_working_hours`.
5. **Forms & intake flow** — preview the pack's form set and ordering.
6. **Review & apply** — the diff from `preview` mode, then one transactional apply.

Entry points: auto-launched on first admin login when `onboarding.completedAt` is unset;
re-runnable any time from Admin → Practice Settings → Specialty Configuration. "Skip for
now" must leave a fully working generic practice — the wizard is an accelerator, never a
gate.

### 2.5 Module filtering — the third axis

Today: `visible = planModules ∩ roleModules`. Add specialty as a *subtractive* third term:

```
visible = (planModules ∩ roleModules) \ (specialtyHidden \ adminPinned)
```

- Specialty can only hide.
- An admin override (`adminPinned`) always wins, plus a persistent "Show all modules"
  toggle in Admin. Hiding modules a customer is paying for, with no way back, is both a
  support burden and lost upsell surface — the toggle is not optional.

### 2.6 Multi-specialty hospitals

Two levels, shipped in order:

1. **Tenant-level** (Phase 1): one primary specialty drives terminology and module
   defaults; additional packs merge for catalogue content. Merge rule: union for additive
   sections (offerings, forms, codes); primary-specialty-wins for scalar settings and
   terminology; conflicts surfaced in the preview diff rather than resolved silently.
2. **Department-level** (Phase 2): departments each with their own specialty, offerings
   and form set. If the `locations` table from the medical-camps proposal is built,
   departments can hang off it; otherwise a light `departments` table. **Design for this
   from day one** by giving every pack-seeded row a nullable `department_id`, even while
   Phase 1 leaves it null — adding the column later is cheap, re-attributing thousands of
   existing rows is not.

### 2.7 Consolidate the existing form library

Move `frontend/src/data/formTemplates.js` into specialty packs server-side so there is one
source of truth. `FormTemplateLibrary.js` then reads the API that `routes/form-management.js`
already exposes, instead of a bundled JS array.

---

## 3. Integration mechanics

- `specialties` and `specialty_packs` are **global** (`public`) — catalog, not tenant data.
  Create them in `backend/migrations/NNN_*.sql` and **schema-qualify every object**:
  migration 066 set the *database* default `search_path` to
  `tenant_default, public, control`, so unqualified DDL in a global migration lands in
  `tenant_default`. Follow the `SET search_path TO public;` + `public.` prefix pattern from
  `migrations/072_global_runtime_ddl.sql`.
- Provenance columns on existing tenant tables (`source_pack`, `source_pack_version`,
  `is_customised`) are **tenant** migrations: `backend/migrations/tenant/NNN_*.sql`,
  *unqualified* names, inside a transaction, additive and nullable.
- Any brand-new tenant table also needs a global migration registering it in
  `control.tenant_tables` and cloning it into the golden `template`
  (`control.clone_table` + `control.replicate_intra_fks`) — the
  `migrations/071_sec05_lazy_created_tenant_tables.sql` pattern. Without it, newly
  provisioned tenants lack the table and lazy `CREATE TABLE IF NOT EXISTS` produces empty
  shadow copies.
- Hook the wizard into `services/tenantProvisioning.js` only to *mark* onboarding as
  pending — do not apply packs during provisioning. Pack application is an authenticated
  admin action so it is attributable in `audit_logs`.
- Permission keys: `practice.configure`, `practice.apply_specialty_pack`.
- Translation keys across all five locales; terminology overrides resolve as
  `packOverride ?? translations[locale][key]`.

---

## 4. Risks

| Risk | Mitigation |
|---|---|
| **Pack upgrade clobbers tenant customisation** | `is_customised` stamp; conflicts reported, never auto-resolved |
| Over-hiding modules → lost upsell / support load | specialty subtracts only; admin pin + "Show all modules" |
| Packs drift into executable code | pack schema validated on load; no SQL, no function refs, roles only by `basedOn` |
| **Clinical/coding content liability** | CPT/ICD subsets and clinical forms are regulated content — each pack version clinician-reviewed, versioned, and auditable before publish |
| Free-text `providers.specialization` | add `specialty_code`, backfill, keep both for one release |
| Half-finished wizard leaves broken tenant | every step skippable; nothing applied until step 6's single transaction |
| Multi-specialty merge surprises | conflicts shown in the preview diff; primary specialty wins scalars |

---

## 5. Sequencing and rough effort

| Phase | Deliverable | Backend | Frontend |
|---|---|---|---|
| 1 | `specialties` taxonomy + `specialty_packs` + provenance columns | 3–4 d | — |
| 2 | `applyPack` engine with preview/seed/upgrade + validation | 5–7 d | — |
| 3 | 3 reference packs (dentistry, ophthalmology, paediatrics) incl. clinical review | 4–6 d | — |
| 4 | Wizard UI, 6 steps, resumable | 2–3 d | 8–12 d |
| 5 | Specialty module filtering + terminology overrides | 2 d | 3–4 d |
| 6 | Migrate `data/formTemplates.js` into packs | 3–4 d | 2 d |
| 7 | Departments (multi-specialty hospitals) | 5–7 d | 5–7 d |

Phases 1–5 are the shippable unit. Build the engine before the UI: the wizard is the easy
part, and building it first tends to bake pack semantics into React state where they cannot
be re-applied, upgraded or audited.

---

## 6. Shared dependency with the medical-camps proposal

Both features want the same missing dimension — *where / under which unit* a row belongs.
Camps need `locations`; multi-specialty hospitals need `departments`. Building one generic
site/unit entity once (camps Phase 0) and letting departments reference it is materially
cheaper than two near-duplicate hierarchies, and avoids a later migration that has to
reconcile them.
