# AureonCare Development Setup

**Contents.** How to get AureonCare running locally: prerequisites, the PostgreSQL
database, `backend/.env` and `frontend/.env`, the two migration runners, the specialty
packs, the first platform operator, starting the API and the web app, and the
troubleshooting that applies to a current database. It replaces five older documents —
the root `SETUP.md`, `DATABASE_SETUP.md` and `MIGRATION_GUIDE.md`, `backend/DATABASE_SETUP.md`
and `backend/scripts/README-DATABASE-RESET.md` — and keeps what is still true of them.
OAuth provider registration is in [`../integrations/OAUTH_SETUP.md`](../integrations/OAUTH_SETUP.md);
production deployment is in [`DEPLOYMENT.md`](DEPLOYMENT.md) and the release checklist
[`../../DEPLOYMENT_CHECKLIST.md`](../../DEPLOYMENT_CHECKLIST.md).

---

## 1. Prerequisites

- **Node.js 18** — the version CI (`.github/workflows/ci.yml`) and the Docker images
  (`docker/*/Dockerfile`) use.
- **PostgreSQL** — `docker-compose.yml` runs `postgres:15-alpine`; use 15 or newer.
- **npm**.
- `psql` on your `PATH` is useful for the checks below but not required: the migration
  runners connect with node.

```bash
node --version
npm --version
psql --version
```

## 2. Repository layout

The **root** `package.json` is the backend: `npm install` at the root installs the API's
dependencies, and every `npm run …` script below is run from the root (there is no
`backend/package.json`). The web app has its own `package.json` in `frontend/`, and the
mobile app in `mobile/` (see [`../../mobile/README.md`](../../mobile/README.md)).

```bash
npm install                 # backend (root)
cd frontend && npm install  # web app
```

## 3. Create the database

```sql
-- psql -U postgres
CREATE DATABASE aureoncare;
CREATE USER aureoncare_user WITH ENCRYPTED PASSWORD '<choose one>';
GRANT ALL PRIVILEGES ON DATABASE aureoncare TO aureoncare_user;
-- PostgreSQL 15+: the public schema is no longer writable by every user by default
\c aureoncare
GRANT ALL ON SCHEMA public TO aureoncare_user;
```

The migrations create the `control` and tenant schemas themselves, and migration `073`
creates the least-privilege application role `aureoncare_app`. In development you can run
everything as one owner role; in production the app must run as `aureoncare_app` and only
the migration runners use the owner — see section 4 of
[`../../DEPLOYMENT_CHECKLIST.md`](../../DEPLOYMENT_CHECKLIST.md).

## 4. Configure the backend — `backend/.env`

```bash
cp backend/.env.example backend/.env
```

`backend/db.js` loads `backend/.env` (resolved from the file's own directory, so scripts
work from any working directory), then a `.env` in the working directory. Variables that
are already set in the environment always win over both files.

**Database connection.** `AC_PG_URI`, when set, is used as the whole connection string
(with SSL) and **overrides every `AC_DB_*` variable**. Without it the individual variables
are used:

| Variable | Meaning | Default |
|---|---|---|
| `AC_PG_URI` | full connection string (Supabase: use the Transaction Pooler, port 6543, for Vercel) | — |
| `AC_DB_H` | host | `localhost` |
| `AC_DB_P` | port | `5432` |
| `AC_DB_N` | database name | `aureoncare` |
| `AC_DB_U` | user | `postgres` |
| `AC_DB_W` | password | — (required by a server that asks for one) |
| `AC_DB_S` | `true` to use SSL without `AC_PG_URI` | `false` |

The older names `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DATABASE_URL`
and `JWT_SECRET` that earlier guides gave are **not read by the application**.

**Other variables you need locally:**

| Variable | Meaning |
|---|---|
| `PORT` | API port. Use `3001` locally — see section 8. (`server.js` defaults to 3000.) |
| `AC_TK_S` | JWT signing secret, **at least 32 bytes**; the API refuses to start without one |
| `AC_TK_E` | token lifetime, e.g. `24h` |
| `AC_EK` | 32-byte encryption key |
| `AC_MSG_KEY` | secure-messaging key (32 bytes, hex or base64); falls back to a key derived from `AC_TK_S`, which is fine locally but must be set in production |
| `FRONTEND_URL` | comma-separated CORS allow-list; defaults to `https://app.aureoncare.tech,http://localhost:3001` |
| `AC_BE_URL` / `AC_FE_URL` | public API / web origins, used to build OAuth redirect URIs |

`backend/.env.example` lists the rest (email, uploads, logging, Zoom, Stripe, OAuth).
Generate a random key with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Redis is optional.** The client in `backend/server.js` is commented out, so the API
starts without Redis; the `AC_USE_RD` / `AC_RD_*` variables are placeholders for when it is
enabled.

## 5. Configure the web app — `frontend/.env`

```bash
cp frontend/.env.example frontend/.env
```

| Variable | Meaning |
|---|---|
| `REACT_APP_SVC_URL` | API base. **Leave unset locally**: the default is the relative `/api`, which keeps the API same-origin with the SPA (first-party session cookie). `frontend/package.json` proxies `/api` to `http://localhost:3001` in development. |
| `REACT_APP_GG_CID` | Google OAuth client id (the backend reads the same name — keep them equal) |
| `REACT_APP_MS_CID` | Microsoft OAuth client id |
| `REACT_APP_FB_AID` | Facebook app id |
| `REACT_APP_REDIRECT_URI` | the **frontend** origin, registered as a redirect URI with Microsoft; `http://localhost:3000` locally (`REACT_APP_AUTH_URI` is a legacy alias) |

Provider registration steps: [`../integrations/OAUTH_SETUP.md`](../integrations/OAUTH_SETUP.md).

## 6. Run the migrations

There are two runners and you run **both, in this order**, on a new database and on every
deploy:

```bash
npm run migrate          # node backend/run-migrations.js — global: public + control
npm run migrate:tenants  # node backend/run-tenant-migrations.js — every tenant schema + template
```

- **`npm run migrate`** keeps a ledger in `public.schema_migrations` and applies only what
  is new, each file in its own transaction. On an **empty** database it first loads
  `backend/migrations/baseline/000_baseline.sql` and records the files the baseline already
  contains as applied — the historical chain cannot be replayed from nothing.
  `--dry-run` lists what would run; `--adopt` records every file as applied without running
  it, for an existing, fully migrated database that predates the ledger.
- **`npm run migrate:tenants`** applies `backend/migrations/tenant/*.sql` inside every
  tenant schema and the golden `template`, with `search_path` set per schema and a ledger
  per schema. One tenant's failure does not block the others; it is retried on the next
  run. `TENANT_MIGRATE_CONCURRENCY` (default 5) bounds parallelism.

Both use the same connection settings as the app (`AC_PG_URI` or `AC_DB_*`), so they work
against a managed database from a laptop — the only way to migrate a Vercel deployment.

**Do not apply migration files by hand with `psql -f`**, and do not use
`backend/run_migrations.sh` on a database with data in it: it loops `psql -f` over every
file with no ledger and no `search_path` handling, and `001_update_users_table.sql` begins
with `DROP TABLE IF EXISTS users CASCADE`. If you genuinely cannot run node against the
database (e.g. the Supabase SQL editor), use the hand-runnable scripts and run order in
[`../../backend/scripts/manual/README.md`](../../backend/scripts/manual/README.md). The rules
for writing migrations are in [`../../backend/migrations/README.md`](../../backend/migrations/README.md)
and [`../../backend/migrations/tenant/README.md`](../../backend/migrations/tenant/README.md);
adding a per-tenant table is walked through in
[`FEATURE_IMPLEMENTATION_STEPS.md`](FEATURE_IMPLEMENTATION_STEPS.md).

**Back up first** on any database whose data you care about:

```bash
pg_dump -h localhost -U aureoncare_user -d aureoncare > backup_$(date +%Y%m%d).sql
# restore, if you must:
psql -h localhost -U aureoncare_user -d aureoncare < backup_YYYYMMDD.sql
```

## 7. Load reference content and create the first accounts

```bash
npm run packs:load        # publish the specialty packs (needs public.specialties, from migration 085)
npm run check:form-library  # every tenant has the system form library
npm run platform:operator -- <email> <password> ["Full Name"]
```

- Without `packs:load`, the setup wizard lists every specialty as having "no starter
  content yet" — `public.specialty_packs` is simply empty. Authoring packs:
  [`../../backend/data/specialty-packs/README.md`](../../backend/data/specialty-packs/README.md).
- `platform:operator` (`backend/scripts/create-platform-operator.js`) creates the first
  platform operator (super-admin). Credentials are never seeded by a migration. The
  password must meet the shared policy (at least 12 characters, mixed classes); re-running
  with the same email updates the password and name.
- A clinic (tenant) is created either by an operator (`POST /api/platform/tenants`, the
  operator console) or by self-serve signup (`/signup` → Stripe Checkout → webhook
  provisions the tenant); both go through the same provisioning code. Signup and Stripe
  configuration are in [`../../DEPLOYMENT_CHECKLIST.md`](../../DEPLOYMENT_CHECKLIST.md).
  Public self-registration (`/api/auth/register`) was removed (SEC-39); patients get portal
  access through invitations.

**Data model note — `patients.id = users.id`.** A patient's chart row and their login
share one id (migration 025 did the same for providers), so there is no separate
`user_id` column on either. Several paths depend on it: the portal reuses the id when it
creates a login, and a patient created without one gets a generated uuid instead.

## 8. Start the application

```bash
# Terminal 1 — API on 3001 (matches the frontend dev proxy)
PORT=3001 npm run dev        # nodemon backend/server.js; or: PORT=3001 npm start

# Terminal 2 — web app on 3000
cd frontend && npm start
```

Open `http://localhost:3000`. The browser calls `/api/...` on port 3000 and the
Create React App dev server proxies it to the API on 3001, so the session cookie is
same-origin. (`start-all.bat`, `start-backend.bat` and `start-frontend.bat` at the root are
Windows conveniences hard-coded to `D:\AureonCare`.)

## 9. Checks and tests

```bash
npm run check:schema-health     # every tenant schema complete and matching template
npm run check:tenant-scoping    # no route reads tenant tables off the wrong pool
npm run check:db-role           # the app connects as a non-superuser, DDL refused
npm run test:sec05              # cross-tenant isolation suite (stands up a throwaway Postgres)
npm run test:frontend           # React tests
```

`npm run` lists the per-area suites (`test:signup`, `test:permissions`, `test:camps`, …).
Run the one that covers what you changed.

Selected API routes, for a quick check with curl (all mounted under `/api`; see
`backend/server.js` for the full list):

- auth: `POST /api/auth/login`; `POST /api/auth/social-login` (legacy path, behind a guard)
- telehealth: `GET|POST /api/telehealth`, `PUT /api/telehealth/:id`, `POST /api/telehealth/:id/join`
- FHIR: `GET|POST /api/fhir/resources`, `GET /api/fhir/patient/:patientId`,
  `POST /api/fhir/sync/patient/:patientId`, `GET /api/fhir/bundle/:patientId`
  (see [`FHIR_TRACKING.md`](FHIR_TRACKING.md))
- patient portal: `POST /api/patient-portal/login`, `GET /api/patient-portal/:patientId/appointments`,
  `GET|PUT /api/patient-portal/:patientId/profile`, `GET /api/patient-portal/:patientId/medical-records`
- medical records: `GET|POST /api/medical-records`, `PUT /api/medical-records/:id`,
  `POST /api/medical-records/upload`, `POST /api/medical-records/with-file`
  (10 MB limit; JPEG, PNG, PDF, DOC, DOCX, TXT)

## 10. Troubleshooting

**Could not connect to server / connection refused** — start PostgreSQL
(`sudo systemctl start postgresql`, `brew services start postgresql`, or the PostgreSQL
service on Windows), check `pg_hba.conf` allows your authentication method, and confirm
the variables in `backend/.env`. Remember `AC_PG_URI` overrides `AC_DB_*`.

**"client password must be a string"** (SASL / SCRAM) — no password reached a server that
requires one: `AC_DB_W` is unset or `backend/.env` was not found. The runners print a
plainer explanation of known connection errors (`explainConnectionError` in `backend/db.js`).

**"database does not exist"** — `psql -U postgres -c "CREATE DATABASE aureoncare;"`.

**"permission denied"** — the role needs rights on the database and schema:

```sql
GRANT ALL PRIVILEGES ON DATABASE aureoncare TO aureoncare_user;
GRANT ALL ON SCHEMA public TO aureoncare_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO aureoncare_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO aureoncare_user;
```

If you have already switched the app to `aureoncare_app`, DDL being refused is correct —
run migrations with the owner connection.

**`relation "..." does not exist` (42P01)** — either the migrations have not run (run both
runners), or a tenant migration was pasted into a SQL editor, where its unqualified names
resolve against `public`, which has held no tenant tables since migration 066. Use the
runners or `backend/scripts/manual/`.

**`psql: command not found`** — install the PostgreSQL client tools or add their `bin`
directory to `PATH` (Windows: e.g. `C:\Program Files\PostgreSQL\15\bin`).

**OAuth errors** — redirect URIs must match the provider console exactly; see
[`../integrations/OAUTH_SETUP.md`](../integrations/OAUTH_SETUP.md).

## 11. Legacy database scripts — do not use on a current database

Several scripts in `backend/scripts/` predate the schema-per-tenant cut-over (migration 066)
and the migration ledger. They connect with `search_path=public`, where the clinical tables
no longer live, and some run migration files directly. They are listed in
[`../../backend/scripts/README.md`](../../backend/scripts/README.md) together with the
scripts that are current.
