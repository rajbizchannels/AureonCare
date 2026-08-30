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

```bash
node backend/run-migrations.js          # global: public + control, incl. 063–074
node backend/run-tenant-migrations.js   # fans out tenant/001, 002 to every tenant schema
```

- [ ] Global migrations complete without error
- [ ] Tenant fan-out reports `N/N schema(s) up to date; 0 failed`
- [ ] Check the `071` output: a `WARNING … manual reconciliation required` means a table
      exists in **both** `public` and `tenant_default` with data in each — reconcile before
      continuing (the migration deliberately does not guess)

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
node backend/scripts/create-platform-operator.js \
     admin@yourdomain.com 'A-Strong-Passphrase!23' "Platform Admin"
```
Password must satisfy the shared policy (≥12 chars, mixed classes).

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

In the console: **Security** tab → *Enrol authenticator* → scan/paste the `otpauth://` URL
into your authenticator app → enter the 6-digit code to confirm. Or by hand:

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
