# AureonCare — Security Remediation Deployment & Verification Checklist

Covers everything needed to put the security work (SEC-01…SEC-26) into an environment.
**The order matters** — two steps are breaking if skipped, and they are marked ⚠️.

Nothing here changes application behaviour for a single-tenant install *except* where
noted; the multi-tenant machinery stays dormant until a second tenant is provisioned.

---

## 0. Before you start

- [ ] **Take a database backup.** Migration `066`/`068` relocate ~78 live tables between
      schemas. It is fast (a catalog operation) but it is not something to do untested.
- [ ] **Rehearse on a copy of production first.** The full chain is idempotent and has been
      verified on Postgres 16, but your data is not the test data.
- [ ] Confirm you can roll back: know your restore procedure before step 2.

---

## 1. Generate and store secrets

Generate each with `openssl rand -base64 48` and store in your secret manager — **not** in
the repo, and (for `AC_MSG_KEY`) **not** alongside the backups it protects.

| Variable | Purpose | If unset |
|---|---|---|
| `AC_MSG_KEY` | Encrypts PHI backups (SEC-26) and messages | Derived from `AC_TK_S` — rotating `AC_TK_S` would then make existing backups **unrecoverable** |
| `AC_PLAT_S` | Signs super-admin console tokens (SEC-10/S10) | `/api/platform/*` returns 503; rest of the app unaffected |
| `AC_IDX_K` | Blind-index pepper for portal tenant routing (SEC-05) | Portal **password** login only searches the default practice — patients of every other practice get "Invalid credentials" |
| `AC_RD_H` (+ `AC_RD_P`, `AC_RD_W`) or `AC_RD_URL` | Shared rate limits and send quotas (SEC-21/24) | Limits and quotas are **per instance** — much weaker on Vercel |

Not secrets, but new in this release:

| Variable | Purpose | Default |
|---|---|---|
| `AC_PW_BREACH_CHECK` | Refuse new passwords found in public breach lists (SEC-12), via the Have I Been Pwned range API — only the first 5 hex characters of the password's SHA-1 leave the server. Needs outbound HTTPS to `api.pwnedpasswords.com`. If unreachable, the password is **accepted** and a warning logged. | `true`; set `false` for an air-gapped install |
| `AC_PW_BREACH_TIMEOUT_MS` | How long to wait for that API before failing open | `2000` |

- [ ] `AC_MSG_KEY` set **and escrowed separately from backups**
- [ ] `AC_PLAT_S` set (≥32 bytes)
- [ ] `AC_IDX_K` set (≥32 bytes)
- [ ] Redis configured
- [ ] Existing `AC_TK_S` confirmed ≥32 bytes (the app **refuses to boot** otherwise — SEC-10)

---

## 2. ⚠️ Run migrations — BEFORE deploying the new code

Routes no longer create their own tables (SEC-05). Deploying the code first would 500 any
feature whose table is missing.

**On your existing database, run `--adopt` first — once, ever.** The runner now keeps a
ledger (`public.schema_migrations`). Your database predates it, so the runner cannot tell
which of the 92 files it has already had, and it refuses to guess:

```bash
node backend/run-migrations.js --adopt   # records the current file set as applied,
                                         # executing NOTHING. One-time, existing DBs only.
```

Then, and on every deploy after:

```bash
node backend/run-migrations.js          # global: public + control — applies only what is new
node backend/run-tenant-migrations.js   # fans the tenant/*.sql set (001-011) out to
                                        # every tenant schema and the golden `template`
```

Add `--dry-run` to either to see what would run without touching anything.

> **Tenant migrations are not optional.** `run-migrations.js` only touches `public` and
> `control`. Skipping `run-tenant-migrations.js` leaves per-tenant tables behind — and
> tenant/003 in particular is what makes it possible to delete a user at all: without it,
> the `ON DELETE SET NULL` on `audit_logs.user_id` tries to rewrite a table that
> tenant/002 made append-only, and the deletion fails with
> `P0001: audit_logs is append-only`.
>
> **Do not paste `migrations/tenant/*.sql` into a SQL editor.** Those files use
> *unqualified* table names because the runner sets `search_path` per tenant before each
> one. Run directly, `audit_logs` resolves against `public` where it does not exist and you
> get `ERROR: 42P01: relation "audit_logs" does not exist` — which describes how they were
> run, not the migrations. Without node, use
> `backend/scripts/manual/apply-tenant-migrations.sql`, which does the per-schema loop
> itself.

- [ ] `--adopt` run exactly once on the existing database (skip on a brand-new one)
- [ ] Global migrations complete without error
- [ ] Tenant fan-out reports `N/N schema(s) up to date; 0 failed`
- [ ] Check the `071` output: a `WARNING … manual reconciliation required` means a table
      exists in **both** `public` and `tenant_default` with data in each — reconcile before
      continuing (the migration deliberately does not guess)

### On an empty database

`node backend/run-migrations.js` handles it with no extra flags: it detects that
`public.users` is absent, restores `migrations/baseline/000_baseline.sql`, records the
superseded historical files listed in `baseline/contains.txt` as already-contained, and
applies the rest.

The historical chain is **not** replayable from empty and was never meant to be — several
early files open with `DROP TABLE … CASCADE` and rebuild tables in their old integer-keyed
shape, which is why they are skipped rather than run. Verified end to end: a clean
Postgres 16 through `migrate` → `migrate:tenants` → `check:tenant-scoping` → the SEC-05
isolation suite (10/10) → the app booting and a platform login succeeding.

---

### What this release adds to the migration run

Five global migrations and three tenant migrations, on top of everything above:

| Migration | What it does | Needed before |
|---|---|---|
| `086_subscription_change_accounting.sql` | `actor_type`/`actor_label` on `control.audit_log`, `entry_kind` on `control.billing_events`, `current_period_start` on `control.subscriptions` | a practice admin changes their own plan — the audit write names them, and without the column it is a 500 |
| `tenant/010_ai_integrations.sql` + `087` | the AI tables, then their registration for new tenants | any `/api/ai/*` call |
| `tenant/011_module_permissions.sql` + `088` | `module_permissions`, and its registration | the Roles & Permissions screen |
| `089_public_booking_routing.sql` | `control.booking_slug_route`: maps a public booking link to its practice, backfilled from existing links (SEC-30). Booking links become unique **across** practices; a collision is reported as a WARNING in the migration output and that link stays unreachable until renamed | the public booking page `/book/<slug>` — without it every anonymous booking call fails |
| `tenant/012_portal_invites.sql` + `090` | `portal_invites` in each practice's schema, and `control.portal_invite_route` (token hash → practice only; no patient identifier in the shared plane), plus registration for new practices | the **Invite to portal** button on a patient's record and the `/portal/activate` link the patient opens. The invitation email links to `FRONTEND_URL`, so make sure it is the public address of the app |

Both halves of each pair matter and the order is the usual one: the global runner
registers a table in `control.tenant_tables` so newly provisioned tenants inherit it; the
tenant runner creates it in `template` and in every existing schema. Run `migrate` then
`migrate:tenants`, as always.

Until `088` + `tenant/011` have run, permissions fall back to the built-in role defaults —
the same behaviour as before the feature existed — so the gap is safe. Until `086` has
run, a self-serve plan change fails outright.

`backend/scripts/manual/apply-module-permissions.sql` carries both halves of the
permissions pair for an operator who cannot run node against the database; the other
manual scripts are listed in `backend/scripts/manual/README.md`.

### Timezone-sensitive data

`db.js` now returns `timestamp without time zone` and `date` as the characters Postgres
holds, rather than letting node-postgres turn them into a JS `Date` that `res.json()` then
serialises as a UTC instant. That conversion was shifting appointment times by the
server/browser offset (a 6 PM booking listed as 7 PM) and moving dates of birth by a day
for anyone behind UTC. `timestamptz` is untouched and still returns a `Date`, because that
type genuinely is an instant.

Nothing to run — it is a code change — but it is worth knowing when reading any stored
timestamp, and `npm run test:endpoints` asserts the wall-clock behaviour end to end.

## 3. Deploy the application

- [ ] Deploy backend + frontend
- [ ] ⚠️ **Restart the API.** Migration `066` changes the database default `search_path`;
      pooled connections opened before it will not pick that up.
- [ ] Frontend build has real values for `REACT_APP_GG_CID` / `REACT_APP_MS_CID` —
      a stale build silently keeps the `YOUR_..._CLIENT_ID` placeholders and OAuth fails
- [ ] `REACT_APP_GG_CID` **equals** `AC_GG_CID` (a code issued to one client cannot be
      redeemed by another)

---

## 4. Switch to the least-privilege database role

Until this is done, the app runs as a superuser and **every database-side control is
inert** — REVOKE, grants and RLS are all bypassed.

```sql
ALTER ROLE aureoncare_app WITH PASSWORD '<from your secret manager>';
```

- [ ] Password set on the role created by migration `073`
- [ ] Point the app at that role. **If `AC_PG_URI` is set it overrides every `AC_DB_*`
      variable**, so change the user and password *inside the connection string* (on
      Supabase's pooler the user is usually written `aureoncare_app.<project-ref>`).
      Otherwise set `AC_DB_U=aureoncare_app`, `AC_DB_W=<password>`.
- [ ] Keep the owner/admin connection string out of the app's environment — only the
      migration runners use it (the app role is refused DDL by design)
- [ ] Restart / redeploy the API
- [ ] Verify: `npm run check:db-role` → exits 0 (non-superuser, DDL refused). It uses the
      app's own connection (`AC_PG_URI` or `AC_DB_*`) and prints which one it checked.

---

## 5. Verification

```bash
npm run check:tenant-scoping   # static: no route bypasses tenant isolation
npm run check:db-role          # app connects as a non-superuser, DDL refused
npm run test:sec05             # cross-tenant isolation suite (needs a disposable Postgres)
```

- [ ] All three pass
- [ ] Add `check:tenant-scoping` and the SEC-05 job as **required** CI checks (already in
      `.github/workflows/ci.yml`)

Smoke tests in the running app:

- [ ] Staff login works; DevTools → Application → Session Storage shows **no `token`**
      (SEC-15: the session is now an HttpOnly cookie)
- [ ] Patient list, a patient record, and a medical record all load
- [ ] User Management lists users (only your practice's)
- [ ] Inventory and Accounts roles/permissions render

---

## 6. OAuth — provider console then cut-over

**Google**
- [ ] The login redirect URI is registered on the same client as `AC_GG_CID`

**Microsoft**
- [ ] ⚠️ Register `https://<your-frontend-origin>/ms-oauth-callback.html` under the
      **Web** platform — *not* "Single-page application". Azure refuses a client secret for
      SPA-registered redirect URIs, and the code is redeemed with the secret.

Then test **before** locking anything down:
- [ ] Google sign-in works (staff **and** patient portal)
- [ ] Microsoft sign-in works with a **work/school** account
- [ ] Microsoft sign-in works with a **personal** Microsoft account
- [ ] An existing social user (created before this work) can still sign in

Only once all four pass:
- [ ] Set `AC_DISABLE_LEGACY_SOCIAL_TOKEN=true` and redeploy. This is the step that closes
      SEC-20: every route that accepted a provider access token posted by the browser
      answers 410 — `/api/auth/social-login`,
      `/api/auth/link-social-account`, `/api/patient-portal/login` (with a token) and
      `/api/patient-portal/:id/link-social`. The code-exchange routes keep working.

---

## 7. Optional hardening cleanups

- [ ] `node backend/scripts/deprecate-oauth-credentials.js` (report), then `--apply` to
      clear OAuth secrets stored in per-tenant rows. It only clears providers whose env
      credentials are present, so it cannot break a live integration.
- [ ] Confirm the backup path: run a backup, download the file, and check it is an
      `aureoncare-encrypted-backup` envelope with no readable PHI.

---

## 8. Before onboarding a SECOND tenant

The isolation machinery is complete, but these are worth confirming deliberately:

- [ ] `AC_IDX_K` is set (otherwise portal password logins only search the default tenant)
- [ ] **Backfill the portal identity index** with the same `AC_IDX_K` the app uses:
      `npm run backfill:portal-identities -- --dry-run`, then without `--dry-run`.
      Patients whose portal was enabled before the key existed have no entry, so their
      login searches only the default practice and fails — and it cannot repair itself.
      Safe to re-run.
- [ ] Backfill portal session routes for existing sessions, or accept that current portal
      users are re-routed to the default tenant until they sign in again
- [ ] Run `npm run test:sec05` against a copy that has two tenants provisioned

---

# Self-serve signup

A customer can now subscribe, pay and start working without any operator action:

```
/signup  ->  Stripe Checkout  ->  webhook provisions the tenant  ->  /signup/complete  ->  sign in
```

Nothing is created before payment: the form stores a *signup intent*, and the tenant,
subscription and admin user are provisioned by Stripe's **signed webhook**, not by the
browser returning to the success URL. A customer who closes the tab still gets their
workspace; a forged redirect gets nothing.

## What must be configured once

- [ ] `AC_STRIPE_SK` — the **platform** Stripe secret key (clinics paying you). Stripe is
      configured only here, by the platform operator: practices no longer have Stripe keys
      to enter (Settings → Integrations shows a read-only status). Patient payments are
      taken outside AureonCare and recorded under Billing › Payments.
- [ ] `AC_STRIPE_WHS` — webhook signing secret, with `checkout.session.completed` and the
      `customer.subscription.*` events subscribed. This is the **only** supported source of
      the webhook secret.
      **Upgrading an install that saved a webhook secret on the old Integrations screen:**
      set `AC_STRIPE_WHS` to that value. Until you do, the webhook falls back to the stored
      value and logs `using the legacy webhook secret stored in the database` — that
      fallback will be removed.
- [ ] `FRONTEND_URL` — used to build the checkout return URLs
- [ ] In the console's **Plans** tab, create or configure a plan and press **Create in
      Stripe** — that builds the Product and recurring Price in your Stripe account and
      records the ids, so there is no copying price ids out of the Stripe dashboard. Then
      tick *Sell on the public signup page*. Each plan shows its own status: *live on the
      signup page*, *not sellable — no Stripe price yet*, or *inactive*.

**Changing a plan's price:** Stripe Prices are immutable. Edit the price, save, then press
**Re-create price in Stripe** — that mints a new Price and archives the old one. Existing
subscribers keep billing at the price they agreed to; only new customers see the new one.
The console asks for confirmation and names the price being archived.

**Retiring a plan:** untick *Active* rather than deleting it. It disappears from the signup
page immediately; tenants already subscribed to it are unaffected.

Coupons are Stripe **promotion codes**, managed in the Stripe dashboard — one source of
truth for what a code is worth and how often it may be used. The signup form previews the
discount and Checkout also lets the customer enter one.

Card details never reach this application, which keeps the deployment in PCI **SAQ-A**.

## Billing & accounting (platform console)

The **Billing** tab reports on `control.billing_events`, an append-only local ledger written
by the Stripe webhook. Stripe remains the system of record for the money; the ledger is what
makes revenue reportable without querying Stripe per page, and it survives a rotated key.

- **MRR/ARR** is computed from the plans tenants are *on* — contracted recurring value.
- **Collected** is money actually received, from the ledger. These are deliberately
  different numbers: MRR excludes discounts and failed payments; collected is history.
- **Per tenant** shows collected, refunded and net, plus last payment date.
- A tenant's **invoices** come live from Stripe (`GET /api/platform/tenants/:id/invoices`).

The ledger is **not backfilled** — it fills from the moment the webhook is configured. If
you need history from before that, export it from Stripe.

Two properties worth knowing: rows are keyed on Stripe's own object id, so a retried
webhook cannot book a payment twice; and the table has a trigger rejecting UPDATE and
DELETE, so the revenue record cannot be rewritten by the application.

Changing a tenant's plan from the console now pushes the change to **Stripe**, prorated,
rather than only recording it. Preview the amount first with
`GET /api/platform/tenants/:id/subscription/preview/:planId`. Pass `pushToStripe: false`
to correct our records without touching billing — for reconciling a change made by hand in
the Stripe dashboard.

## Operator roles

Migration `078` adds roles. **Existing operators become `owner`** so nothing they can do
today stops working — narrow them deliberately in the console's **Operators** tab.

| Role | Can do |
|---|---|
| `readonly` | Read every report. Change nothing. |
| `billing` | + plans, coupons, subscriptions, adjustments, free months |
| `support` | + tenant lifecycle (create/suspend/resume) and **break-glass over PHI** |
| `owner` | + manage operators |

The split matters: a finance contractor who needs revenue reports should not be able to
open PHI, and a support engineer should not be able to move money. Changing a role or
disabling an account bumps `token_version`, so that operator's live session ends at once —
a demotion that leaves an 8-hour token holding the old power is not a demotion.

The last active owner cannot demote or disable themselves; promote someone else first.

## Accounting

- **Aging** — tenants whose last payment failed or whose subscription is `past_due`/
  `canceled`, with MRR at risk. This is "who owes us money", which the collected totals do
  not answer.
- **Adjustments** — post a manual credit or debit (goodwill, a written-off invoice, a bank
  transfer). This records that money moved; it does **not** move money in Stripe. A reason
  of 10+ characters is mandatory and the operator is recorded, because an adjustment nobody
  signed for is not an accounting record. A credit is negative, the same sign convention as
  a refund.
- **CSV export** — the ledger for an accountant, every field quoted so a comma in a
  description cannot shift columns.

## Email alerts to operators

Migration `079`. Operators are emailed when something notable happens, **routed by role** so
a finance contractor is not paged about break-glass and a support engineer is not paged
about coupons:

| Event | Goes to | Severity |
|---|---|---|
| Operator created or changed | owner | critical |
| Break-glass opened over tenant data | owner, support | critical |
| Billing credit/debit posted, free months granted | owner, billing | warning |
| Tenant suspended, payment failed, subscription canceled | owner, billing/support | warning |
| Tenant created, customer signed up, coupon changes | per role | info |

Security-relevant events also mail the person who performed them — a message you did not
expect is how a compromised account gets noticed. Routine actions do not mail the actor back.

- **Requires SMTP** (`AC_SM_U` and the rest of the mail configuration). Without it
  `sendEmail` is a no-op, so alerting silently does nothing — the events are still audited.
- **`AC_PLATFORM_ALERTS=false`** silences platform email entirely. Set this in staging,
  especially if that database is ever restored from production.
- Each operator can opt out for themselves in **Security → Email alerts**. Who currently
  receives alerts is shown in the Operators tab.
- Every send is recorded in `control.platform_notifications` with its recipients, visible
  under Operators → Recent alerts. That record is also the idempotency key, so a retried
  Stripe webhook cannot produce duplicate mail.
- Alerting never blocks the action it reports: a mail failure is logged, and the action
  still completes and is still audited.

## Coupons

Created in the console, stored in Stripe. A *coupon* is the discount; a *promotion code* is
the string a customer types — both are created together. Restricting a coupon to specific
plans uses each plan's Stripe **product**, so a plan must have been pushed to Stripe first;
the form disables plans that have not been.

Deactivating a code stops new redemptions. Customers already on the discount keep it, which
is what withdrawing an offer means — use a refund if you need to claw one back.

## Free months

**Per tenant:** Billing tab → *Grant free months*. Applied in Stripe as a 100%-off discount
repeating for N months on that subscription, recorded locally with the reason and operator.
Implemented as a discount rather than by moving `trial_end`, which would void the current
period's invoice and reset the billing anchor on a paying customer.

**Per plan:** set *Free months* on the plan. Checkout converts it to Stripe's
`trial_period_days` (months × 30), taking whichever of that and `trial_days` is larger.

Renaming a plan's **key** rewrites the `plan_name` snapshot on every subscription holding
it, so the console and the tenant's own settings page keep agreeing.

## Staff onboarding

An admin invites colleagues from **Settings → User Management → Invite team members**. The
invite is what binds a new account to a practice — including accounts created with Google
or Microsoft. Previously an OAuth signup had `practice_id` NULL, resolved to the `public`
schema (which holds no tenant tables after the SEC-05 cutover) and hit fail-closed guards
everywhere.

Only the SHA-256 of an invite token is stored, so a database leak yields no usable invites,
and the raw link is shown exactly once. Server-side, an invite is honoured only when the
provider itself vouches for the email *and* that verified address matches the invited one —
so a valid token cannot bind somebody else's Google account.

### Self-service joining by email domain

Requires migration `080_domain_join_requests.sql`.

Under **Settings → User Management → Team access** an admin claims a domain the practice
controls and publishes the shown value as a TXT record at the domain apex (or at
`_aureoncare.<domain>`). Until that record is found the claim grants nothing at all — an
unverified claim is invisible even to the public lookup.

A domain sets one of three policies:

| Policy | What a matching signup gets |
|---|---|
| `auto_request` (default) | An account in `pending` status plus a request in the admin queue. They cannot sign in until approved. |
| `auto_join` | Bound to the practice immediately. |
| `disabled` | Nothing — the claim is held but grants no access. |

`auto_request` is the default deliberately: a claimed domain is not an employee list, and
for a clinical system a human should decide who gets in.

Two proofs are required and neither is sufficient alone — the practice must have proven it
controls the **domain** (the DNS record), and the signup must have proven it controls the
**address** (a provider-verified OAuth email, or a password signup at that address). Public
mailbox providers (gmail.com, outlook.com and the rest) cannot be claimed at all; without
that rule, claiming gmail.com would capture every Google signup on the platform.

A self-serve joiner is never made an admin — the role is limited to staff, nurse or doctor,
so claiming a domain cannot become a privilege-escalation path.

Rejecting a request blocks the account rather than leaving it pending, so a rejected
applicant cannot later be approved by accident.

### Two-factor authentication and session timeout

Requires migration `081_user_mfa_and_session_policy.sql`.

The old settings dialog displayed a hardcoded "Enabled" badge for 2FA and a session-timeout
dropdown bound to nothing. Both were removed rather than reproduced. These are the real
controls.

**Per user** — Profile (header avatar) → Two-factor authentication. Standard TOTP, so any
authenticator app works. Enrolment is two-phase: the secret is stored when enrolment starts
but the factor only switches on once a code from it verifies, so an abandoned enrolment
cannot lock anyone out. Ten single-use recovery codes are issued on success and shown
**once** — only their SHA-256 hashes are stored, so they cannot be displayed again.

Turning 2FA off needs the account password **and** a current code. A signed-in session is
deliberately not sufficient: removing the second factor is exactly what someone holding a
stolen session would want to do.

**Per practice** — Settings → User Management → Team access → Security policy:

- **Sign out after inactivity** — 5 to 1440 minutes, or empty for no limit. Enforced
  server-side on every authenticated request and measured from the last action rather than
  from sign-in, so continuous work is never interrupted and an unattended workstation is.
  The activity stamp is written at most once a minute, so this does not put the app behind
  one row's lock.
- **Require two-factor authentication** — refused while any administrator still lacks a
  second factor, and the error names them. Enabling it otherwise would lock the person
  enabling it out of their own practice at the next sign-in.

Under that requirement a user cannot turn their own 2FA off, and an account without it is
refused at login with an explicit "set it up" message rather than a generic failure.

## Routing

`/signup`, `/signup/complete`, `/accept-invite` and `/join` are SPA routes served before the
auth gate. `vercel.json` carries the rewrites; replicate them behind your own proxy or those
paths will 404.

---

# Accessing the super-admin console

The control plane has two front doors onto the same API (`/api/platform/*`):

- **The console UI at `https://<host>/platform`** — served by the **backend**, not by the
  tenant SPA. Operator code is never shipped to clinic users' browsers, and the tenant app
  has no knowledge of these endpoints. The page is `noindex, no-store`; consider putting it
  behind an IP allowlist or your VPN as well.
- **`curl` / Postman**, for scripted or emergency use, with `Authorization: Bearer <token>`.

The two authenticate differently on purpose. The UI signs in to an **HttpOnly** `ac_platform`
cookie scoped to `/api/platform`, so the token is never readable by JavaScript, and every
state-changing call must echo the `ac_platform_csrf` cookie in an `X-CSRF-Token` header
(the console does this for you). Scripted clients keep using the Bearer header, which the
browser never attaches automatically and so needs no CSRF token.

## One-time setup

1. Set `AC_PLAT_S` and run the migrations (step 1–2 above; `069` creates the tables).
2. Create the first operator — credentials are deliberately **not** seeded by any migration:

```bash
npm run platform:operator -- \
     admin@yourdomain.com 'A-Strong-Passphrase!23' "Platform Admin"
```
Password must satisfy the shared policy (≥12 chars, mixed classes). The script is
idempotent on email, so re-running it **resets that operator's password** — that is also
the recovery path if everyone is locked out.

### Running this on Vercel (or any serverless host)

There is no shell on Vercel — no SSH, no `vercel run`, and a function invocation is not a
place to bootstrap credentials. **Run the command from your machine, pointed at the managed
database.** The database is the shared resource; where the command runs is irrelevant.

```bash
vercel env pull .env.production            # fetches AC_PG_URI and friends
set -a && . ./.env.production && set +a    # load them into the shell
npm run platform:operator -- admin@yourdomain.com 'A-Strong-Passphrase!23' "Platform Admin"
rm .env.production                         # it holds live secrets — do not leave it around
```

### If the console says billing is not configured

The **Billing** tab reports what the running process can actually see. A shared variable set
in the Vercel dashboard is not enough on its own:

1. A **shared** variable must be **linked to this project** (Settings → Environment
   Variables → Shared), not merely defined at the team level.
2. Variables are baked into a deployment. An existing deployment never picks up a new
   value — **redeploy** after adding it.
3. Check the environment: a Production value is not visible to a Preview deployment.

`GET /api/platform/billing/config` (operator-only) returns whether each variable is present
and which Stripe mode the key is for. It never returns key material.

`AC_PG_URI` (the Supabase connection string) is all that is needed; the scripts share the
app's pool config, so they connect over TLS exactly as the deployed app does. Use the
**direct** connection string here rather than the transaction pooler — the pooler does not
support the session-level state that DDL and `SET search_path` rely on.

The same applies to the migration runners, which are the other two things people look for a
shell to run:

```bash
npm run migrate:core       # public/control migrations
npm run migrate:tenants    # fans the tenant/*.sql set out across every tenant schema
```

Run them **in that order, both of them**, every release. A table that only the first runner
knows about does not exist in any tenant; a table only the second knows about is missing
from every tenant provisioned afterwards, because `control.provision_schema` clones exactly
what `control.tenant_tables` lists. Migrations 083 and 084 (locations, medical camps) are
registration-only for that reason, with the tables themselves created by `tenant/004`–`006`.

Afterwards, `npm run check:schema-health` should report every tenant schema complete. A
tenant left behind is reported there rather than failing at request time.

Camps are gated by the `camps` key in `subscription_plans.features`, which migration 084
adds to `clinical_pro`, `enterprise` and `onprem` and deliberately not to `essentials`. No
new environment variables are involved.

The specialty packs need a third command, after both runners:

```bash
npm run packs:load         # validates backend/data/specialty-packs/*.json, then loads them
```

It validates every file first and loads nothing if any one fails, so a bad pack cannot
leave a half-populated catalogue.

`migrate:tenants` also seeds the system form library (tenant/008): 22 templates, 14
categories and 283 field definitions per tenant. After it runs,
`SELECT count(*) FROM <schema>.form_templates WHERE source_pack = 'base'` should be 22 in
every tenant schema and in `template`. If it is 0 anywhere, forms sent to patients from
that tenant will have no template linkage — which is the defect tenant/008 exists to fix.
`npm run test:forms` asserts it end to end, and `npm run check:form-library` reports any
tenant that is short (with `npm run repair:form-library` to copy the missing rows from
`template`). Worth running after any deploy that provisions tenants: the provisioning copy
is the only route the library takes into a new tenant, and a tenant that misses it cannot
be fixed by re-running the migrations. Packs land with `clinical_review_status = 'pending'` —
they are usable, but the API refuses to apply one without an explicit acknowledgement and
the wizard says the content is an engineering draft. Re-running never overwrites a version
a clinician has approved; edited content must get a new version number. No new environment
variables are involved here either.

If your Supabase project blocks connections from arbitrary IPs, either allowlist your
address for the duration or run these from a bastion — do **not** add a bootstrap endpoint
to the API to work around it. An HTTP route that can mint an operator is a permanent
privilege-escalation path in exchange for a one-time convenience.

## Signing in

**In the browser:** open `https://<host>/platform`, enter the operator email and password
(plus the 6-digit code once MFA is enrolled). The session lasts **8 hours**; "Sign out"
clears the cookies server-side.

**From a script:**

```bash
curl -X POST https://<host>/api/platform/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@yourdomain.com","password":"A-Strong-Passphrase!23"}'
# -> { "token": "...", "operator": { ... } }
```

Use that token as `Authorization: Bearer <token>` on every call below. It lasts **8 hours**.

## Enable MFA (do this immediately)

In the console: **Security** tab → *Set up MFA*. **Scan the QR code** with your
authenticator app, then enter the 6-digit code.

To add it by hand instead, use the **setup key** shown under the QR — that is the base32
secret. In Google Authenticator choose *Enter a setup key*, put your email in *Account* and
the key in *Key*. Do **not** paste the `otpauth://` link there: base32 allows only A–Z and
2–7, so the link's `:` `/` `?` `=` are rejected as illegal characters.

Or by hand over the API:

```bash
curl -X POST https://<host>/api/platform/mfa/enroll -H "Authorization: Bearer $TOK"
# -> otpauthUrl — add it to your authenticator app, then:
curl -X POST https://<host>/api/platform/mfa/verify -H "Authorization: Bearer $TOK" \
  -H 'Content-Type: application/json' -d '{"code":"123456"}'
```
After this, `login` requires `mfaCode`.

## What the console can do

| Action | Console | Endpoint |
|---|---|---|
| List / view tenants | Tenants tab | `GET /api/platform/tenants`, `GET /api/platform/tenants/:id` |
| Create a tenant (provisions its schema) | Tenants → *New tenant* | `POST /api/platform/tenants` `{ name, planTier, country, timezone }` |
| Suspend / resume | Tenants → row actions | `POST /api/platform/tenants/:id/suspend` · `/resume` |
| Plan catalog | (fills the plan picker) | `GET /api/platform/plans` |
| View / set a subscription | Tenant detail → *Subscription* | `GET`/`PUT /api/platform/tenants/:id/subscription` |
| Platform audit trail | Platform audit tab | `GET /api/platform/audit` |

## Reading a tenant's data (break-glass)

Operators have **no standing access to PHI**. To read a tenant's own audit log you must
open a time-boxed, justified session — and that act is itself audited. In the console, the
tenant detail view's *View tenant audit* prompts for a justification (minimum 20 characters)
before it will open one, and shows a banner with the session's expiry and an *End session*
button. By hand:

```bash
curl -X POST https://<host>/api/platform/tenants/$TENANT/break-glass \
  -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' \
  -d '{"reason":"investigating reported unauthorised access","ttlMinutes":30}'

curl https://<host>/api/platform/tenants/$TENANT/tenant-audit -H "Authorization: Bearer $TOK"

curl -X POST https://<host>/api/platform/break-glass/$SESSION/end -H "Authorization: Bearer $TOK"
```

Without an active session the read returns **403**. End the session when finished rather
than letting it expire.

## Security properties worth knowing

- Operators live in `control.operators` with their **own signing secret** — a tenant admin
  can never become a platform operator; there is no privilege path between the two.
- `control.audit_log` is **append-only** (enforced by trigger *and* by permissions), so the
  platform trail cannot be rewritten from the application.
- To revoke one operator, bump their `token_version` or set `status='disabled'`.
  Changing `AC_PLAT_S` logs out **all** operators at once (an 8-hour blast radius).
- The `ac_platform` cookie is scoped to `/api/platform`, so it is not attached to any tenant
  API call — and the tenant `ac_session` cookie is never attached to platform calls.
- The console loads no third-party scripts and stores nothing in `localStorage`; everything
  the server returns is HTML-escaped before it is rendered.

## Routing note (Vercel and similar)

`/platform` is served by the **backend** process, so the edge config must send it there and
not to the SPA. `vercel.json` already carries:

```json
{ "src": "/platform(/.*)?", "dest": "backend/server.js" }
```

If you deploy behind your own proxy, add the equivalent rule — otherwise `/platform` will
404 or fall through to the tenant app's index.html.

## Short links (`/s/<code>`)

Every link AureonCare sends or shares — staff and patient-portal invitations, password
reset, telehealth join links, and the booking / meeting links staff copy — goes out as a
short link on your own domain, e.g. `https://app.aureoncare.tech/s/k3J9xQ2mWb7Z`.

- **Migration:** `backend/migrations/091_short_links.sql` (safe to paste into the SQL editor).
- **Routing:** `/s/(.*)` must reach the backend. `vercel.json` and `docker/nginx/nginx.conf`
  already route it.
- **Optional:** `AC_SHORT_BASE=https://<short-domain>` to use a dedicated short domain. It must
  route `/s/*` to the backend too. Without it, links use the first `FRONTEND_URL`.
- Nothing readable is stored: the table keeps a hash of each code and the destination
  encrypted under a key derived from the code. Links expire with what they point to
  (invites at their expiry, reset links after 1 hour, meeting links a day after the session).
- If the table is missing, messages still go out with the full link.

## WhatsApp

Credentials are environment variables only (platform-wide sender). Values left in
`organization_settings.settings.whatsapp` are ignored, with a warning in the server log.

| Provider | Variables |
|---|---|
| Twilio | `AC_WA_PROVIDER=twilio`, `AC_WA_TWILIO_SID`, `AC_WA_TWILIO_TOKEN`, `AC_WA_TWILIO_FROM` (+E.164 WhatsApp sender) |
| Meta Cloud API | `AC_WA_PROVIDER=whatsapp_business`, `AC_WA_META_TOKEN` (permanent system-user token), `AC_WA_META_PHONE_ID`, optional `AC_WA_GRAPH_VERSION` (default `v26.0`) |

- Redeploy after setting them; each server instance reads the configuration once.
- Off switch without touching the environment:
  `UPDATE public.organization_settings SET settings = jsonb_set(settings, '{whatsapp}', '{"enabled": false}') WHERE id = 1;`
- Patients receive WhatsApp only after enabling it in their portal notification settings;
  staff and admins when their profile has a phone number.
### Message templates (WhatsApp's 24-hour rule)

Free-form messages reach only people who messaged your number in the last 24 hours.
Everything else must be an approved template. AureonCare has 9 (`npm run whatsapp:templates`
prints them): appointment scheduled / changed / cancelled / status / reminder, telehealth
session (with the QR code as its image), new prescription, new lab order, and a general
update for staff notices.

1. With the AC_WA_* variables available (e.g. `vercel env pull .env.vercel`, then prefix the
   commands with `npx dotenv-cli -e .env.vercel --`):
   - **Meta:** also set `AC_WA_META_WABA_ID` (WhatsApp Business Account ID) and
     `AC_WA_META_APP_ID` (to upload the example image Meta requires for the QR header).
   - `npm run whatsapp:templates -- --register` — submits them for approval.
2. `npm run whatsapp:templates -- --status` — once approved, it prints the value to set:
   - **Meta:** `AC_WA_TEMPLATES=all` (or a comma list of the approved ones)
   - **Twilio:** `AC_WA_TWILIO_CONTENT_SIDS={"appointment_scheduled":"HX…",…}`
3. Set it in the backend environment and redeploy.

Optional: `AC_WA_TEMPLATE_PREFIX` (default `aureoncare_`), `AC_WA_TEMPLATE_LANG` (default `en`).
A message whose template is not set up yet, or fails, is still sent as free-form text. A
refusal under the 24-hour rule is logged with the template to approve. Email is unaffected.
- When Meta retires the Graph API version, set `AC_WA_GRAPH_VERSION` to a current one
  (https://developers.facebook.com/docs/graph-api/changelog/versions/).

## Practice profiles (directory Phase 2)

- **Migration:** `backend/migrations/092_practice_profiles.sql` (safe to paste into the SQL editor).
- **Routing:** `/p/(.*)` must reach the backend; `vercel.json` and `docker/nginx/nginx.conf` already do.
- **Visibility** (Settings → Practice Profile, admins only, default **Off**):
  Off = the page does not exist; Link only = by link/QR, `noindex`, optionally an unguessable
  `/p/<random>` address (can be re-issued); Searchable = indexable (directory search is Phase 3).
- **Providers** list themselves (avatar → My profile → Practice profile listing), per practice,
  choosing which details show; admins can hide but never list them. Consents carry a text version.
- **Photos:** JPEG/PNG ≤ 2 MB, metadata (incl. GPS) stripped; provider photos need admin approval.
- Every visibility, consent, hide and photo decision is in `public.directory_events` (append-only).

## Directory search (Phase 3)

- Public page **/find** (one search box: specialty, place, doctor). Results: only practices set
  to **Searchable** (active practices), only consented and unhidden providers, neutral ranking
  (specialty, place, name, then distance) — no paid placement.
- **No search logs:** the query is sent in a POST body (never the URL), not logged, answered
  `no-store`; "Use my location" is rounded to ~1 km in the browser and never stored.
- Distance needs map coordinates on the practice's locations (Settings → Locations).
- `/sitemap-practices.xml` and `/robots.txt` come from the backend (routed in `vercel.json` and
  nginx); submit the sitemap in Google Search Console if you want profile pages indexed.
- No migration needed. Ranking runs in memory from a 60-second cache; plan a database search
  index when the directory passes ~10,000 practices.

## People in several practices (Phase 1: memberships)

**Order matters: apply the migration BEFORE deploying this code.**
1. Paste `backend/migrations/093_memberships.sql` into the SQL editor. It creates
   `public.memberships`, gives every existing account its membership, and adds a trigger that
   keeps memberships in step with `users.practice_id` / `users.role`. Check:
   `SELECT count(*) FROM public.users WHERE practice_id IS NOT NULL;` equals
   `SELECT count(*) FROM public.memberships;`
2. Deploy.

What changes:
- One account (login, password, 2FA, Google/Microsoft) can belong to several practices,
  with a role at each. The top bar shows a practice switcher to people with more than one.
- A session works in one practice at a time; sessions on different devices can be in
  different practices. Removing someone from a practice ends their sessions there at once.
- Inviting someone who already works at another practice adds this practice to their account
  when they accept with their existing password or Google/Microsoft.
- Admins manage a shared person's role in THEIR practice and can remove them from it; account
  details (name, email, password, status) stay with the person.
- Plan seats count memberships: a person at two practices takes a seat at each.
- Sign-in starts in the most recently used practice; if that practice requires 2FA the person
  lacks, it starts in one that does not (switching in then asks for 2FA).

Not yet: a patient with charts at several practices still has one portal sign-in per practice.

## Guest booking requests, "Find a practice" link, "Ask to join" from profile pages

**Order matters: apply the migration BEFORE deploying this code.**
1. Paste `backend/migrations/094_profile_join_requests.sql` into the SQL editor (safe to re-run).
   Check: `SELECT filename FROM public.schema_migrations WHERE filename LIKE '094%';` returns one row.
2. Deploy.

What changes:
- **Guest bookings are requests.** Someone not signed in who books on a provider's public page
  gets "Request sent"; the time is held as a pending appointment attached to NO chart, even
  if their email matches a patient. Staff see "Booking requests" above the calendar
  (Scheduling → Calendar), with a same-email chart shown only as a hint, and confirm it for that
  patient, confirm as a new patient (needs a date of birth; refused if the email is already a
  patient), or decline (frees the time). The guest is emailed the outcome. A patient signed in
  to the practice's portal still books straight into their own chart.
- Staff and patient sign-in pages link to `/find` ("Looking for a doctor? Find a practice").
- **Ask to join.** Public practice pages show "Work here? Ask to join this practice". The
  person gives name, work email and role (doctor, nurse or staff — never admin), confirms by a
  24-hour emailed link, and only then do the practice's admins get an email and see the request
  in Settings → User Management → Team access. Approving sends a normal staff invitation;
  nothing is granted until it is accepted. Answers never reveal whether someone already works
  there. No new environment variables.

## Sign-in rate limit fix + lockout after 4 wrong passwords

1. Paste `backend/migrations/095_login_lockouts.sql` into the SQL editor (safe to re-run).
   Until it is applied, sign-in works but WITHOUT lockout (it fails open; the logs say
   "[lockout] disabled … apply migration 095").
2. Deploy.

What changes:
- **Fixes "existing passwords don't work".** The strict sign-in limit (10 per 15 min per IP)
  counted EVERY `/api/auth` request — `/me` on each page load, the practice switcher's
  `/memberships`, session end — so an office behind one IP used it up and real sign-ins got
  "Too many attempts". It now counts only credential attempts (sign-in, password reset,
  Google/Microsoft, second factor, change password), up to 30 per IP per 15 min.
- **Lockout:** the 4th wrong password (or 2FA code) within 15 minutes locks that address for
  15 minutes — staff sign-in and the patient portal alike. The 3rd wrong try warns "1 attempt
  left". Unknown addresses lock the same way, so it reveals nothing about who has an account.
  Override with `AC_LOCKOUT_MAX` / `AC_LOCKOUT_MIN` if ever needed.
- **Unlocking:** admins see "Sign-in locked" with an **Unlock** button in Settings → User
  Management; staff see the same on a patient's portal panel. A password reset (or portal
  set-up link), or a successful sign-in, also clears it.

## Sick notes

1. Paste `backend/migrations/096_sick_notes.sql` into the SQL editor as the database owner
   (safe to re-run). It registers the table for new practices and creates it in `template`
   and every existing practice. The notice says how many schemas it created it in.
2. Deploy.

What changes:
- Patient chart (Patients → Patient History → a patient) has a **Sick Notes** tab. Doctors and
  nurses — or an admin who is also a provider — issue a note: for work / school / normal
  activities, not fit or may be fit with adjustments (phased return, altered hours, amended
  duties, workplace adaptations), the period (max 92 days per note), the condition as it
  should appear (blank prints "A medical condition"), comments and whether a review is needed.
  "Issue and print" prints an A4 certificate with the practice's name, address and phone,
  the clinician's registration number and a reference (SN-YYYY-XXXXXX) to verify it by.
- Notes can be printed again or emailed to the patient; they are never edited or deleted. A
  wrong one is **voided** with a reason (by the issuer or an admin) and prints marked VOID.
- Patients see and print their notes in the portal (Sick Notes tab).
- Permission: Clinical Records → `sick_notes` (doctors all, nurses read/write, reception none
  by default; change in Settings → Permissions).

## Patient sign-in fix + practice chooser

No migration. Deploy.
- **Patients can sign in from the main sign-in page and the mobile app.** The staff sign-in
  answers a patient account with 401 "patient account" (it was a 403 dead end), and the web
  page — like the mobile app already does on a 401 — carries straight on to the patient-portal
  sign-in with the same details. Installed mobile apps work without an update.
- **Older patient accounts** (password on the account, no portal password — 3 such patients in
  production) can sign in to the portal; their password becomes the portal password on first use.
- A patient with no portal route yet is looked up in the practices on their own account, not
  only the default practice.
- **Practice switcher** is gone from the top bar. People at 2+ practices pick one in a
  "Which practice are you working in?" step right after signing in, and switch later from their
  profile (avatar → Switch practice).

## Patient Google/Microsoft sign-in + tenant migrations 010/013

1. Paste `backend/scripts/manual/apply-tenant-migrations-010-013.sql` into the SQL editor as
   postgres. Production is missing tenant migration 010 (the five AI tables) in `template`
   and tenant_default — found by the SEC-05 schema check. The last query must return
   `missing_tables = 0`. Safe to re-run.
2. Deploy (vercel.json changed).

What changes:
- The patient-portal invitation link (`/portal/activate?token=…`) was not routed by Vercel
  and answered with Vercel's own 404. vercel.json now serves `/portal/*` and every other app
  path without a file extension from the app (deep links and reloads too).
- A patient account signing in with Google or Microsoft on the main sign-in page is taken to
  their portal (was 403 "This is a patient account…"). If the practice has not switched on
  portal access for them, they are told so.
- The "Cross-Origin-Opener-Policy would block the window.closed call" console line comes from
  Google's sign-in script polling its popup; it is harmless (sign-in completes).

## Google / Microsoft sign-in in the mobile app (+ SEC-48)

1. Paste `backend/migrations/098_mobile_oauth_flows.sql` into the SQL editor (safe to re-run).
2. Register one more redirect URI with each provider (same clients the web app uses):
   - Google Cloud Console → APIs & Services → Credentials → the web OAuth client →
     Authorized redirect URIs: `https://app.aureoncare.tech/api/auth/mobile/oauth/google/callback`
   - Microsoft Entra → App registrations → the app → Authentication → **Web** platform →
     Redirect URIs: `https://app.aureoncare.tech/api/auth/mobile/oauth/microsoft/callback`
   Microsoft: it must be under the **Web** platform. Under "Mobile and desktop applications" or
   "Single-page application" the sign-in fails with AADSTS90023 (public clients cannot send a
   secret). Google: under the **Web application** client, else `redirect_uri_mismatch`.
   (Verified working on Android emulator 2026-11-21 for both.)
   To see the exact addresses for a server, open `https://<server>/api/auth/mobile/oauth/setup`
   — they must match character for character (https, no trailing slash). The server uses the
   address the phone reached; set `AC_PUBLIC_URL` only to pin a different one.
3. Deploy, then build the app (the `aureoncare://` link needs a development or store build;
   Expo Go uses `exp://` links — allow them on a TEST server only with `AC_MOBILE_REDIRECTS=exp://`).

How it works: the app opens the system browser at the server; the server signs the person
in with Google/Microsoft using its existing web client and hands the app a one-time code over
`aureoncare://auth`; the app redeems it with a PKCE verifier only it holds. No client ids or
secrets in the app, works against any AureonCare server, and an app that intercepts the link
cannot use the code. Same outcomes as the web: staff session, patient portal (an invitation
to the verified address is accepted), "no account — ask for an invitation", blocked, pending.

SEC-48 (in the same deploy): Google/Microsoft re-linking now requires a provider-verified
email, and a Microsoft `mail` value counts as verified only in the UPN's own domain.

## Patients can request a sick note (web portal and mobile app)

1. Paste `backend/migrations/099_sick_note_requests.sql` into the SQL editor as postgres (safe to
   re-run; it creates the table in `template` and every practice and registers it for new ones).
2. Deploy; ship a new app build for the mobile part.

What changes:
- Patients: Sick Notes tab (portal) / More → Sick notes (app) → "Request a sick note": what it
  is for, first and last day (up to 14 days back, 30 days ahead, max 92 days) and why. One open
  request at a time; it can be cancelled while it waits. They see Waiting / Issued / Not issued
  (with the clinician's note) and are emailed when it is answered.
- Clinicians: "Sick note requests" above the calendar (Scheduling → Calendar) lists open requests
  across the practice; "Review" opens the patient's sick notes with the request. Also on the
  patient's Sick Notes tab, and in the app (Patients → patient → Sick notes). "Issue from
  request" pre-fills the dates and purpose; "Decline" needs a reason the patient sees. Nothing is
  issued automatically. Same permission as sick notes (reception does not see requests by default).
