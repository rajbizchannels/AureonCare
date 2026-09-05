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
| `AC_IDX_K` | Blind-index pepper for portal tenant routing (SEC-05) | Portal always resolves to the default tenant |
| `AC_RD_H` (+ `AC_RD_P`, `AC_RD_W`) or `AC_RD_URL` | Shared rate limits and send quotas (SEC-21/24) | Limits and quotas are **per instance** — much weaker on Vercel |

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
node backend/run-tenant-migrations.js   # fans out tenant/001, 002 to every tenant schema
```

Add `--dry-run` to either to see what would run without touching anything.

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
- [ ] `AC_DB_U=aureoncare_app`, `AC_DB_W=<password>`
- [ ] Restart the API
- [ ] Verify: `npm run check:db-role` → exits 0 (non-superuser, DDL refused)

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
- [ ] Set `AC_DISABLE_LEGACY_SOCIAL_TOKEN=true` — this retires `POST /auth/social-login`
      (410) and is the step that actually closes SEC-20

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

- [ ] `AC_IDX_K` is set (otherwise portal logins all resolve to the default tenant)
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

- [ ] `AC_STRIPE_SK` — the **platform** Stripe secret key (clinics paying you). This is a
      different account from the per-clinic keys in Settings → Stripe, which are for
      clinics collecting money from *their* patients. Platform billing never reads those.
- [ ] `AC_STRIPE_WHS` — webhook signing secret, with `checkout.session.completed` and the
      `customer.subscription.*` events subscribed
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

## Routing

`/signup`, `/signup/complete` and `/accept-invite` are SPA routes served before the auth
gate. `vercel.json` carries the rewrites; replicate them behind your own proxy or those
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
