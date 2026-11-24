# AureonCare

**Practice management for clinics — EHR, scheduling, billing, telehealth and patient engagement
in one multi-tenant platform, with a web app for staff, a patient portal and a mobile app.**

Production: `app.aureoncare.tech` (Vercel + Supabase Postgres). Each practice has its own
database schema (schema-per-tenant); one sign-in can belong to several practices.

---

## Contents

- [What is in this repository](#what-is-in-this-repository)
- [Features](#features)
- [Integrations — what is live and what needs a vendor account](#integrations--what-is-live-and-what-needs-a-vendor-account)
- [Getting started](#getting-started)
- [Database and migrations](#database-and-migrations)
- [Tests](#tests)
- [Deploying](#deploying)
- [Documentation](#documentation)
- [Security](#security)
- [Contributing](#contributing)

---

## What is in this repository

| Path | What it is |
|---|---|
| `backend/` | Node.js / Express API (`backend/server.js`; routes under `/api`), PostgreSQL via `node-postgres` |
| `frontend/` | React web app — staff app and patient portal (Create React App) |
| `mobile/` | Expo (SDK 54) app for patients and staff, phone and tablet — see [`mobile/README.md`](mobile/README.md) |
| `backend/migrations/` | database baseline + new migrations — see [`backend/migrations/README.md`](backend/migrations/README.md) |
| `backend/test/` | API test suites (`npm run test:<name>`) |
| `docs/` | product, engineering, security and integration documentation — [`docs/README.md`](docs/README.md) |
| `DEPLOYMENT_CHECKLIST.md` | the release-by-release checklist: migrations to run and settings to change |
| `vercel.json` | production hosting (API as a serverless function, web app as static files) |
| `docker/`, `docker-compose.yml`, `helm/`, `deployment/` | container, Kubernetes and on-premises installs |

---

## Features

**Clinical**
- Patient records, medical history, vitals, diagnoses with SOAP notes, ICD-10 / CPT coding
- e-Prescribing with allergy and drug-interaction checks; NCPDP SCRIPT (Surescripts) messaging
- Lab orders and results; FHIR R4 resources and exchange tracking
- Sick notes (fit notes): issue, print as a locked PDF, email; patients can request them
- Forms designer (14 field types, conditions, role-only questions, signatures); patients and staff
  fill forms on web, phone or tablet, checked by the server
- Telehealth (Zoom, Google Meet, Microsoft Teams, Webex) with short join links
- AI assistance, each feature switched on per practice and reviewed by a person: scribe (SOAP note
  from visit text), coding suggestions, claim review, prior-auth letters, chart questions,
  document extraction, lab explanations and more — PHI is anonymised before anything is sent

**Scheduling and patients**
- Calendar, appointment types, provider schedules, waitlist, booking requests
- Public booking page and "Find a practice" directory (practice profiles: off / link-only / searchable)
- Patient portal (web and mobile): appointments, records, forms, messages, sick notes, profile
- Medical camps: planning, registration desk, station board, outcomes
- Multi-location, practice specialty packs (dentistry, ophthalmology, paediatrics)

**Billing and operations**
- Claims with a **pre-submission check** (rules + optional AI review; errors block submission)
- **Insurance eligibility checks** (X12 270/271) from the patient record and the claim form
- Pre-authorisations, payments and payment posting (EDI 835), denials and appeals, EDI 837 files
- Quotes, invoices, packages and promotions; Stripe for practice subscriptions
- Double-entry accounting; inventory (items, lots and expiry, stock movements, purchase orders,
  suppliers) with **low-stock alerts** to the people who can reorder
- Reports: operational, financial, claims, patients, providers, compliance, inventory, custom

**Practice administration**
- Roles and fine-grained module permissions, enforced on the server
- Users in several practices, practice chooser after sign-in, join requests and invitations
- Sign-in with password (lockout after 4 failures, admin unlock), MFA, Google and Microsoft
  (web and mobile)
- **My notifications**: each staff member chooses, per notification and per channel (in the app,
  email, WhatsApp), what they receive
- **Appointment reminders** to patients (their portal channel choices), providers and front desk
  (daily summary), each on the channels they chose; scheduled by Vercel Cron (`CRON_SECRET`)
- **Self-serve free trial** (no card, email-confirmed) with sample data; subscribe in-app via Stripe
- Notifications by email and WhatsApp (approved templates), secure messaging
- **Data import** of suppliers, products & stock, services & prices, insurers, patients and appointments:
  CSV or Excel with published templates (Settings → Import Data)
  or the API with practice API keys — checked first, all or nothing, re-runnable
  ([`docs/integrations/DATA_IMPORT.md`](docs/integrations/DATA_IMPORT.md))
- Audit log of PHI access and changes; backup, restore and archiving
- 5 languages: English, Spanish, French, German, Arabic

---

## Integrations — what is live and what needs a vendor account

| Integration | Status |
|---|---|
| Google / Microsoft sign-in (web and mobile) | Live |
| Email (SMTP), WhatsApp (Meta / Twilio) | Live when the practice configures them |
| Zoom / Google Meet / Teams / Webex | Live when configured |
| Stripe (platform subscriptions) | Live — check `AC_STRIPE_SK` (see DEPLOYMENT_CHECKLIST) |
| AI providers (Anthropic, OpenAI, Azure OpenAI, Gemini, Mistral, offline/self-hosted) | Live when an admin switches a feature on |
| Optum clearinghouse — eligibility (270/271) | Built and tested against a stub; needs an Optum API account and a first sandbox run |
| Optum clearinghouse — claims (837) | Connector present; 837 files can be generated and downloaded |
| Surescripts e-prescribing (NCPDP SCRIPT 2017071) | Built; needs Surescripts certification, an account, prescriber SPIs, EPCS for controlled drugs |
| Labcorp | **Not usable with keys alone** — needs Labcorp's connectivity onboarding (usually HL7 v2) |
| Redis (shared rate limits) | Not provisioned — limits are per server instance until it is |

---

## Getting started

**Prerequisites:** Node.js 20 or newer, PostgreSQL 14 or newer, npm.

```bash
git clone https://github.com/rajbizchannels/AureonCare.git
cd AureonCare
npm install                      # backend (root package.json)
(cd frontend && npm install)     # web app
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Edit `backend/.env` — the essentials:

| Variable | Purpose |
|---|---|
| `AC_DB_H`, `AC_DB_P`, `AC_DB_N`, `AC_DB_U`, `AC_DB_W` | PostgreSQL host, port, database, user, password — or `AC_PG_URI` for a connection string (Supabase) |
| `AC_TK_S` | JWT signing secret, **at least 32 bytes** (the server refuses to start otherwise) |
| `AC_MSG_KEY`, `AC_IDX_K` | encryption key for messages and documents; key for searchable (blind) indexes |
| `AC_FE_URL`, `AC_BE_URL` | public addresses of the web app and the API |
| `AC_SM_H`, `AC_SM_P`, `AC_SM_U`, `AC_SM_W` | SMTP for email (optional in development) |
| `AC_GG_CSK`, `AC_MS_CSK` + `REACT_APP_GG_CID`, `REACT_APP_MS_CID` | Google / Microsoft sign-in |
| `AC_STRIPE_SK`, `AC_STRIPE_WHS` | platform billing (optional) |

`docs/engineering/SETUP.md` lists every variable and the optional ones.

Then create the database and start:

```bash
createdb aureoncare
npm run migrate            # an empty database is built from the baseline
npm run migrate:tenants
npm run packs:load         # optional: specialty packs
npm run platform:operator  # optional: a platform operator account for /platform
npm run dev                # API (auto-restart) — set PORT=3001 in backend/.env: both default to 3000
(cd frontend && npm start) # web app on http://localhost:3000
```

Mobile app: see [`mobile/README.md`](mobile/README.md) (`cd mobile && npm install && npx expo start`).

---

## Database and migrations

- `npm run migrate` applies global migrations (`public` / `control` schemas); `npm run
  migrate:tenants` applies per-practice migrations to every practice schema and the `template`
  new practices are cloned from. Run both, in that order, on every deploy.
- The full history (global 001–100, tenant 001–016) is one baseline,
  `backend/migrations/baseline/000_baseline.sql`, used only for empty databases; the historical
  files are kept in `backend/migrations/history/`. Next numbers: global **107**, tenant **020**.
- Production is migrated by pasting the new migration into the Supabase SQL editor; migrations
  that touch practice schemas are written to fan out to every schema themselves.
- Health checks: `npm run check:schema-health`, `npm run check:tenant-scoping`, `npm run check:db-role`.

Details and rules: [`backend/migrations/README.md`](backend/migrations/README.md).

---

## Tests

55 API suites plus the React tests, each run on its own:

```bash
export AC_DB_H=localhost AC_DB_P=5432 AC_DB_N=<test db> AC_DB_U=<user> AC_DB_W=<password> AC_RL_TEST_BYPASS=1
npm run test:claim-scrubbing     # any suite: npm run | grep test:
npm run test:frontend            # React (163 tests)
(cd mobile && npm test && npx tsc --noEmit)
```

The suites create their own practices in the database they are pointed at — use a test database.
`npm run test:specialty` needs `npm run packs:load` first. `test:sec05` starts its own throwaway
Postgres. Known failures that predate current work: `settings-authz` (4 checks that sign a patient
in through the staff login, which is now refused by design), `vendor-tenancy` (1),
`identity-backfill` (2).

---

## Deploying

Production deploys from `main` on Vercel (`vercel.json`). For each release follow
[`DEPLOYMENT_CHECKLIST.md`](DEPLOYMENT_CHECKLIST.md): it lists the migration to paste **before**
deploying, settings to change, and what to verify afterwards. Other targets:
[`docs/engineering/DEPLOYMENT.md`](docs/engineering/DEPLOYMENT.md) (Docker, Helm, on-premises).

---

## Documentation

Start at [`docs/README.md`](docs/README.md). The most used:

| Document | For |
|---|---|
| [`docs/product/USER_MANUAL.md`](docs/product/USER_MANUAL.md) | how the product works, screen by screen (also in-app help under `frontend/public/docs/`) |
| [`docs/engineering/SETUP.md`](docs/engineering/SETUP.md) | development environment and every setting |
| [`docs/engineering/ARCHITECTURE.md`](docs/engineering/ARCHITECTURE.md) | how the pieces fit together |
| [`docs/security/SEC-05_MULTI_TENANCY_PLAN.md`](docs/security/SEC-05_MULTI_TENANCY_PLAN.md) | the schema-per-tenant design |
| [`docs/security/AureonCare_Security_Audit_ToDos.xlsx`](docs/security/AureonCare_Security_Audit_ToDos.xlsx) | the security register (SEC-01 … SEC-54) |
| [`docs/engineering/FEATURE_IMPLEMENTATION_STEPS.md`](docs/engineering/FEATURE_IMPLEMENTATION_STEPS.md) | adding a feature that needs per-practice tables |
| [`docs/product/COMPETITIVE_ANALYSIS.md`](docs/product/COMPETITIVE_ANALYSIS.md) | feature status against competitors |
| [`frontend/src/utils/PERMISSIONS_GUIDE.md`](frontend/src/utils/PERMISSIONS_GUIDE.md) | which permission layer stops a request |

---

## Security

Schema-per-tenant isolation with a least-privilege database role; server-enforced role and module
permissions; JWT with token versioning, MFA, account lockout; secrets encrypted at rest; PHI
access audited; AI requests anonymised. The security register (54 entries, all fixed but the Redis
deployment item) is in `docs/security/`. Report vulnerabilities to support@aureoncare.tech.

---

## Contributing

Conventions are written down where they apply: per-practice tables and migrations in
[`backend/migrations/README.md`](backend/migrations/README.md), security expectations in
[`docs/security/SSDLC.md`](docs/security/SSDLC.md). Run the suite for the area you change and
`npm run test:frontend`; add a release note to `DEPLOYMENT_CHECKLIST.md` when a change needs a
migration or a setting.

## License

Proprietary — all rights reserved (license details to be added).

## Contact

support@aureoncare.tech · https://aureoncare.tech · https://github.com/rajbizchannels/AureonCare/issues
