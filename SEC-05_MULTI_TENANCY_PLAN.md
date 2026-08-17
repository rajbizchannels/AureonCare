# SEC-05 — Multi-Tenant Data Isolation: Implementation Plan

**Finding (High / P1, effort XL):** No route scopes PHI queries by an owning clinic/org.
Any authenticated user can read every clinic's patients and PHI. Filters are by record id
only, never by an owner tied to `req.user`.

**Status:** Plan for sign-off. Nothing in here is built yet. One product decision (below)
gates the entire effort.

---

## 0. The decision that gates everything

The codebase was **built single-tenant**: `organization_settings` and `clinic_info` are
one-row singletons, and `clinicSettings.js` already assumes "the first `practices` row"
(`SELECT id FROM practices ORDER BY created_at ASC LIMIT 1`). A `practices` table exists,
but tenancy is **completely unenforced** — see §1.

Before any code, confirm the intended model:

| Option | What it means | When it's right | Cost |
|---|---|---|---|
| **A. Single-tenant per deployment** | Each clinic gets its own DB/instance. "Isolation" = deployment boundary. SEC-05 becomes: *guarantee* one practice per instance + a hard guard that rejects cross-practice data. | You sell/host one instance per clinic. | **S–M** |
| **B. Shared multi-tenant, app-enforced** | One DB, many practices. Every PHI query gains `WHERE practice_id = $me`. `practice_id` derived from `req.user`, never the client. | Multiple clinics share one deployment (SaaS). | **XL** |
| **C. Shared multi-tenant, DB-enforced (RLS)** | Option B **plus** Postgres Row-Level Security keyed on a per-request session variable, so isolation holds even if a query forgets its `WHERE`. | Same as B, but you want defense-in-depth for PHI/HIPAA. | **XL + ~15%** |

**Recommendation: C** if the product is genuinely SaaS (the safest posture for PHI); **A** if
each clinic is really its own instance (dramatically cheaper and the singletons suggest this
was the original intent). The rest of this plan details **B/C** since that's where the audit
risk lives; if you pick **A**, jump to §9.

---

## 1. Current state (grounded)

**Tenant primitive exists but is inert:**
- `practices` table — `schema.sql:2778` (`id uuid`, `name`, `plan_tier`, `country`, `timezone`).
- `practice_id uuid` (nullable, FK→`practices`) exists on **only 3 tables**: `patients`
  (`schema.sql:2426`), `appointments` (`:579`), `claims` (`:993`).
- It is **never populated from the authenticated user and never filtered on.** The only writer
  is `appointments.js`, which takes `practice_id` **from the request body** (untrusted) — so
  even that is not a security boundary. Effectively every `practice_id` is `NULL`.

**No user→tenant link:**
- `req.user` = `{ id, email, role, firstName, lastName }` (`middleware/auth.js:79`). No tenant.
- JWT carries `sub, role, email, tv` (`middleware/auth.js:33`). No tenant.
- `users.practice` is **free-text `varchar(255)`** (`schema.sql:3389`) — *not* a FK. Do not
  mistake it for the key. There is no `users.practice_id` and no `user_practices` join table.

**Scope of the change:**
- **~20 PHI-bearing tables** need scoping. 7 core ones have **no** `practice_id` today:
  `medical_records`, `prescriptions`, `lab_orders`, `diagnosis` **and** `diagnoses`
  (two overlapping tables — flag for cleanup), `payments`, `preapprovals`, `providers`. Plus
  satellites: `account_receivables`, `account_statements`, `account_journal_lines`, `denials`,
  `payment_postings`, `fhir_resources`, `patient_intake_forms`, `patient_portal_sessions`.
- **~490 raw `req.app.locals.pool.query()` calls across 55 route files. No repository/model
  layer** exists to centralize a `WHERE`. This is the crux of the effort and why RLS is
  attractive — it's the only way to *guarantee* coverage without touching all 490 sites.

**Highest-leakage surfaces (aggregate across all clinics today):**
- `routes/reports.js` — org-wide `COUNT/SUM` over appointments, patients, claims (no filter).
- `routes/search.js` — staff search spans the whole DB (comment even says "every patient in the practice").
- `routes/fhir.js` (`SELECT * FROM fhir_resources WHERE 1=1`), `routes/edi.js`, `routes/billing.js`.

**Backfill reality:** no reliable existing owner. Patient/claims INSERTs omit `practice_id`;
`users.practice` won't map cleanly. Existing data must be assigned to a **single default
practice**, then `NOT NULL` enforced going forward.

---

## 2. Target design

1. **Tenant key:** `practices.id (uuid)` is *the* tenant. Standardize on `practice_id` everywhere.
2. **User↔practice:**
   - Add `users.practice_id uuid REFERENCES practices(id)`.
   - Staff belonging to multiple clinics? If **yes**, add a `user_practices(user_id, practice_id, is_default)` join and an "active practice" concept (like `active_role`); if **no**, the single column suffices. *(Open question Q2.)*
3. **Propagation:** `practice_id` flows **auth → request → query**:
   - `authenticate` selects `practice_id`, puts it on `req.user.practiceId`, and (for multi-clinic) resolves the active practice.
   - `signToken` adds a `pid` claim; `authenticate` still re-reads from DB (never trust the claim alone for the boundary).
4. **Enforcement (two layers, defense-in-depth):**
   - **Layer 1 — DB RLS (the guarantee):** enable RLS on every PHI table; policy
     `USING (practice_id = current_setting('app.current_practice')::uuid)`. A per-request
     middleware runs `SET LOCAL app.current_practice = $req.user.practiceId` on the connection.
     Forgetting a `WHERE` then returns **zero rows** instead of leaking.
   - **Layer 2 — explicit `WHERE practice_id` + trusted INSERT default** on the hot read/write
     paths, so behavior is obvious in code and correct even outside a transaction.
5. **Writes:** `practice_id` on INSERT is **always** `req.user.practiceId`, never request body.
   Remove the client-supplied `practice_id` in `appointments.js`.

---

## 3. Phased rollout

Each phase is independently shippable and reversible. Order matters.

**Phase 0 — Decide & fixture (S)**
- Resolve §0 (A vs B vs C) and Q1–Q4.
- Add integration-test fixtures: two practices, users in each, PHI in each. A cross-tenant test
  ("user of practice A must get 0 rows / 403 for practice B's patient") that **fails today** and
  becomes the acceptance gate for every later phase.

**Phase 1 — Schema & backfill (M)**
- Migration: add `practice_id uuid` to the ~17 PHI tables lacking it; add `users.practice_id`
  (+ `user_practices` if multi-clinic).
- Backfill: create/choose one default practice; set `practice_id` on all existing PHI rows and
  users to it. Derive child rows from their parent where possible (e.g. `medical_records` ←
  `patients.practice_id`).
- Leave columns nullable in this phase (backfill first, enforce later).

**Phase 2 — Identity propagation (M)**
- `authenticate`/`optionalAuth`/`requireAdmin`: select + attach `req.user.practiceId`.
- Add `pid` to JWT (existing tokens without it: fall back to DB value — no forced logout).
- Add the per-request `SET LOCAL app.current_practice` middleware (no policies yet — no-op).

**Phase 3 — Enforcement layer 1: RLS (L)**
- Enable RLS + policies on all PHI tables. Backend DB role must be non-superuser and not
  `BYPASSRLS` (verify — superusers ignore RLS). Add a service/migration role exception for jobs.
- Run the full suite; the cross-tenant test must now pass DB-side.

**Phase 4 — Enforcement layer 2: explicit query scoping (L, the long pole)**
- Route-by-route, add `WHERE practice_id = $me` to reads and set `practice_id = req.user.practiceId`
  on writes. Prioritize by leakage: `reports.js` → `search.js` → `patients/appointments/claims/
  medical-records/prescriptions/lab-orders/diagnosis/payments` → `fhir/edi/billing/denials/
  payment-postings`.
- Make `practice_id` `NOT NULL` once each table's writers are converted.

**Phase 5 — Cross-cutting & exports (M)**
- Reports/search/FHIR/EDI: confirm every aggregate is scoped. These are the biggest breach risk.
- Patient portal: confirm portal queries are patient-scoped *and* practice-scoped.
- Admin/cross-practice reads (if any legitimately exist, e.g. a super-admin) get an explicit,
  audited bypass — never implicit.

**Phase 6 — Hardening & cleanup (S)**
- Resolve the duplicate `diagnosis`/`diagnoses` tables.
- Add a CI guard/lint that flags new `pool.query` on a PHI table without a practice predicate.
- Update FHIR/EDI export docs; add an audit-log entry on any cross-practice access.

---

## 4. Testing strategy
- **Cross-tenant matrix test** (the gate): for each PHI route, user-of-A requesting B's data →
  404/empty, never data. Runs in CI on every phase.
- **RLS unit tests:** with `app.current_practice` set to A, raw `SELECT * FROM patients` returns
  only A's rows.
- **Regression:** existing single-practice behavior unchanged (all data maps to the default practice).
- **Write-path tests:** INSERTs ignore client `practice_id` and stamp `req.user.practiceId`.

## 5. Risks & rollback
- **Silent over-scoping** (legit data vanishes) — mitigate with the backfill-to-default-practice
  and staged `NOT NULL`. Each phase reversible (RLS can be disabled per-table; explicit `WHERE`
  reverts per-route).
- **Superuser bypass** — the #1 RLS footgun; the app DB role must not be superuser/BYPASSRLS.
- **Background jobs / migrations** need a scoped or explicitly-bypassing role.
- **Reports performance** — add composite indexes leading with `practice_id`.
- **Token migration** — `pid` absent on old tokens handled by DB fallback (no mass logout).

## 6. Effort
- **Option A:** ~2–4 days (guard + single-practice invariant + tests).
- **Option B:** ~3–4 weeks (Phase 4 route sweep dominates).
- **Option C:** Option B + ~3–4 days for RLS. **Recommended for PHI.**

## 7. Open questions
- **Q1 (gating):** A, B, or C? Is the product SaaS-shared or instance-per-clinic?
- **Q2:** Can one staff user belong to multiple practices? (single column vs `user_practices`.)
- **Q3:** Any legitimate cross-practice role (super-admin/support)? How audited?
- **Q4:** For the multi-tenant path, is a one-time backfill to a single default practice acceptable
  for all existing data (yes, per current single-tenant reality)?

---

## 8. Pros & cons of each isolation model

The industry names three patterns (AWS SaaS lens): **silo** (dedicated infra per tenant),
**bridge** (shared cluster, separated namespace per tenant), **pool** (fully shared, logical
isolation). Options A/B/C map onto these.

### A — Instance/DB per clinic (SILO)
**Pros:** Strongest isolation — a tenant is a physical boundary, so a forgotten `WHERE` cannot
leak across tenants. Per-tenant backup/restore, data residency, and even per-tenant encryption
keys are trivial. Noisy-neighbor and blast-radius contained. Easiest HIPAA story.
**Cons:** Cost and ops scale linearly with tenants (N databases/instances, N connection pools,
N monitoring targets). Cross-tenant analytics/reporting is hard. Onboarding a tenant = provision
infra. Fleet-wide app updates must fan out to N targets.

### B — Shared DB, app-enforced `practice_id` (POOL, app-only)
**Pros:** Cheapest infra (one DB). Trivial cross-tenant analytics. Simple provisioning (insert a
`practices` row). One migration run.
**Cons:** **Isolation is only as good as the weakest query** — a single missing `WHERE
practice_id` leaks PHI across clinics, and you have ~490 query sites to get right forever. Shared
blast radius (one bad migration/incident hits everyone). Per-tenant restore/residency is painful
(rows interleaved). Highest ongoing audit burden.

### C — Shared DB + RLS backstop (POOL, DB-enforced)
**Pros:** Same infra cost as B, but the database **guarantees** isolation even when a query forgets
its filter — the right posture for PHI. Cross-tenant analytics still easy (with an explicit
bypass role). Config is data, so app updates don't touch tenant data.
**Cons:** RLS footguns (superuser/BYPASSRLS ignore policies; every connection must `SET` the tenant
GUC). Shared blast radius remains. Per-tenant restore/residency still harder than silo.

### D — Schema-per-tenant (BRIDGE) — *the model that best delivers the ServiceNow/Okta/Microsoft **properties** on our stack (not their literal substrate — see §9)*
One Postgres cluster; a shared **control-plane** schema plus **one schema per tenant**
(`tenant_<uuid>`) holding all PHI/config tables. Connections set `search_path` to the tenant.
**Pros:** Strong isolation at the schema boundary (no cross-tenant `WHERE` to forget), yet one
cluster to run. Per-tenant backup/restore/export and per-tenant migration are natural. Cheaper
than silo, safer than pool. Best fit for "isolate each tenant, update the app centrally."
**Cons:** Migrations must **fan out across N schemas** (slower deploys; needs orchestration).
Connection/`search_path` management. Cross-tenant analytics needs a roll-up job. Postgres gets
unhappy with *very* large N (thousands) of schemas.

**Rule of thumb:** ≤ low-hundreds of clinics that want isolation without infra sprawl → **D
(schema-per-tenant)**. Strict residency/regulatory or very large tenants → **A (silo)**. Many
small tenants, analytics-heavy, willing to trust RLS → **C**.

---

## 9. The enterprise pattern: isolate tenants, update the app without touching their data

**Important accuracy note:** ServiceNow, Okta, and Microsoft do **not** all run schema-per-tenant
(D) — they use *different* isolation substrates. What they share is not the substrate but the set
of **invariants** below that decouple app releases from tenant state. The unifying principle is
**separate the *application* (code + baseline schema + default config) from the *tenant* (their
data + configuration overrides)**, then evolve the app under strict compatibility rules so a
rollout never rewrites tenant state.

**What each actually uses (substrate) vs. what's transferable (invariants):**
- **ServiceNow** — **instance-per-customer (silo, ≈ Model A):** each customer gets a dedicated app
  node + dedicated database; famously *single-tenant instances*, not shared multi-tenancy. The
  transferable part is its **metadata/config-as-data + upgrade three-way-merge** ("skip list",
  "Update Sets") that moves the baseline forward while preserving customer customizations.
- **Okta** — **pooled multi-tenant (≈ Model C):** shared platform, logical isolation by org/tenant
  id (subdomain boundary). Transferable part: config is data and schema changes are
  backward-compatible, so the shared platform updates continuously without touching tenant config.
- **Microsoft** — **mixed:** Entra ID (Azure AD) is **pooled** (tenant = logical security boundary,
  tenant id in every token); Dynamics 365 is **database-per-tenant**; M365/Exchange distribute
  tenants across databases. Transferable part: **ring/flight** progressive rollout and per-tenant
  version pinning.

So **Model D is our recommended way to get these vendors' *properties* (isolation + release-safe
config/data) on a single Postgres cluster — it is not a literal copy of any of their
architectures.** If the goal is to match ServiceNow specifically, that's **Model A**; to match
Okta/Entra, that's **Model C**. The five invariants below are what all of them rely on, and they
apply to A, C, and D alike.

**The five invariants that make "push an update without impacting tenant data" true** — adopt all
five regardless of A/C/D:

1. **Config-as-data, layered.** No tenant customization lives in code. Effective setting =
   `tenant_override ?? shipped_baseline`. Shipping a new default changes the baseline row; the
   tenant's override is a *different* row and is never overwritten. (AureonCare already leans this
   way — `clinic_info`, `organization_settings`, `clinicSettings.js` — but as singletons; they'd
   become per-tenant with a baseline layer.)
2. **Expand/contract (backward-compatible) migrations.** Every schema change is additive and
   reversible in two deploys: *expand* (add column/table, backfill, dual-write) → ship code that
   uses it → *contract* (drop the old) only after all code/tenants are upgraded. Old and new code
   must both work mid-rollout. **Never** a destructive migration in the same release that needs it.
3. **Idempotent, versioned, per-tenant migration tracking.** A `schema_migrations` table *per
   tenant schema* (D) or per DB (A) records applied versions; the runner is safe to re-run and
   applies only what's missing. This is what lets a lagging tenant catch up cleanly.
4. **Tenant data & config are never in a migration's payload.** Migrations change *structure and
   shipped baselines*, never tenant rows (except mechanical backfills). Tenant data moves only via
   the app, backup/restore, or export — so an app update is pure code + structure.
5. **Progressive rollout + per-tenant version pin (rings/flights).** Deploy code to a canary ring
   of tenants, then waves. A control-plane column pins each tenant's app/schema version so you can
   hold or roll back one tenant without touching others.

### Recommended concrete architecture for AureonCare — schema-per-tenant (D) with a control plane

```
Postgres cluster
├── control  (control-plane schema)
│   ├── tenants(id, slug, schema_name, app_version, status, region, created_at)
│   ├── plans / subscription baseline
│   └── config_baseline(key, value)        -- shipped defaults (versioned with the app)
├── template (golden schema: all PHI/config tables, no data)   -- the "baseline app schema"
├── tenant_<uuidA>   -- clone of template; this clinic's PHI + config_override table
├── tenant_<uuidB>
└── ...
```

- **Tenant context:** `authenticate` resolves the tenant from the user, and a per-request
  middleware sets `SET search_path TO tenant_<id>, control` on the pooled connection (reset on
  release). All existing raw SQL then hits the right tenant **without adding `WHERE practice_id`
  to 490 queries** — the schema boundary does it. (Keep RLS off; the schema is the boundary.)
- **Config layering:** `control.config_baseline` holds shipped defaults; each tenant schema has a
  `config_override` table. App reads `COALESCE(override, baseline)`. App updates rewrite the
  baseline; overrides are untouched — the ServiceNow-style guarantee.
- **Migrations:** a deploy step enumerates `control.tenants` and applies pending versioned
  migrations to **each** tenant schema + the template, tracked per schema, idempotent, isolated
  per tenant (one tenant's failure doesn't block others; it's flagged and retried).
- **Provisioning:** create tenant = `CREATE SCHEMA tenant_x` from the template + a `tenants` row.
  **Deprovisioning/export/residency** = operate on one schema (dump/drop) — clean and per-tenant.

### Implementation steps (D)

**S1. Control plane (M).** Add the `control` schema: `tenants`, `config_baseline`, plan tables.
Seed one tenant for the current data ("default clinic").

**S2. Golden template (M).** Script that builds `template` from the current PHI/config tables
(minus data). This becomes the versioned baseline app schema. Add a per-schema `schema_migrations`
table.

**S3. Tenant-context middleware (M).** Resolve tenant from `req.user`; `SET search_path` per
request on the connection; guarantee reset on release (pool `afterCreate`/release hook). Add a
"no tenant resolved → refuse" guard. Put `tenantId` on `req.user` and a `tid` JWT claim (DB
fallback for old tokens).

**S4. Migrate existing data into `tenant_default` (M).** Move current rows out of `public` into the
default tenant schema (rename/relocate), leaving `control` + `template` in shared space. Validate
row counts; this is the one-time cutover.

**S5. Migration fan-out runner (L).** Replace the single `run-migrations.js` with a runner that
loops `control.tenants` + `template`, applying expand/contract migrations per schema with
per-tenant tracking, idempotent, failure-isolated, and logged. Wire into deploy/CI.

**S6. Config layering (M).** Introduce `config_baseline` (shipped) + per-tenant `config_override`;
refactor `clinicSettings.js`/`organization_settings` reads to `COALESCE(override, baseline)`.

**S7. Provisioning API + rollout rings (M).** Endpoint/job to create/suspend/export a tenant
(schema clone/dump/drop). Add `app_version` per tenant + a ring/canary deploy flow.

**S8. Backup/restore & residency (S–M).** Per-tenant `pg_dump`/restore; document per-schema export
for data-subject/residency requests.

**S9. Cross-tenant guards & tests (M).** Cross-tenant test (user of A cannot reach B) — now enforced
by `search_path`. CI check that no query hardcodes a schema. Super-admin cross-tenant access via an
explicit, audited path only.

**Effort (D):** ~4–6 weeks. More than C up front (control plane + fan-out runner + cutover), but it
buys true per-tenant isolation, per-tenant migration/restore, and the clean "update the app without
touching tenant data" property you asked for. **A** is cheaper if instance-per-clinic is acceptable;
**C** is cheaper if you accept shared-DB pooling with RLS.

### Quick chooser
- Want the **ServiceNow/Okta/Microsoft property** (isolated tenants, central app updates, config &
  data untouched by releases) with manageable ops → **D (schema-per-tenant) + the five invariants.**
- Regulatory/residency-driven, few large tenants, budget for infra → **A (silo).**
- Many small tenants, analytics-first, trust RLS discipline → **C (pool + RLS).**
- The **five invariants in §9 apply to all of them** — they're what decouple app releases from
  tenant state.

---

*Prepared for review. §0/§8 choose the model; §9 details the enterprise "isolate + update-safely"
pattern. On sign-off of the model + Q1–Q4, Phase 0/1 (or S1/S2 for model D) can start behind the
cross-tenant test.*
