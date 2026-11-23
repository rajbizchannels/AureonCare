# Backend scripts

Run everything from the repository root (the root `package.json` is the backend's).
Development setup, the migration runners and troubleshooting are in
[`docs/engineering/SETUP.md`](../../docs/engineering/SETUP.md); hand-runnable SQL is in
[`manual/README.md`](manual/README.md).

## Current

| Script | npm script | Purpose |
|---|---|---|
| `create-platform-operator.js` | `platform:operator` | create/update the first platform operator: `npm run platform:operator -- <email> <password> ["Name"]` |
| `load-specialty-packs.js` | `packs:load` | publish `backend/data/specialty-packs` into `public.specialty_packs` (`--dry-run`) |
| `build-manual-specialty-packs.js` | — | regenerate `manual/apply-specialty-packs.sql` |
| `repair-form-library.js` | `check:form-library` / `repair:form-library` | find (`--check`) or repair tenants whose system form library is missing or short |
| `generate-form-library-migration.js` | — | regenerate the tenant migration that seeds the system form library |
| `check-schema-health.js` | `check:schema-health` | every tenant schema complete and matching `template` |
| `check-tenant-scoping.js` | `check:tenant-scoping` | static guard: no route bypasses tenant isolation (CI) |
| `check-db-role.js` | `check:db-role` | the app does not connect as a superuser (CI/ops) |
| `check-jwt-algorithms.js` | `check:jwt` | every `jwt.verify()` pins its algorithms (SEC-11) |
| `check-frontend-logs.js` | `check:frontend-logs` | the frontend does not log whole records or credentials (SEC-14) |
| `check-route-shadowing.js` | `check:routes` | no route is unreachable behind an earlier parameter route |
| `backfill-portal-identities.js` | `backfill:portal-identities` | backfill `control.portal_identity_route` (SEC-05 deploy step; `--dry-run` first) |
| `deprecate-oauth-credentials.js` | — | report, then `--apply`, clearing OAuth client credentials stored in tenant settings |
| `whatsapp-templates.js` | `whatsapp:templates` | print / register the WhatsApp message templates and check approval |
| `load_medication_data.sh` / `.bat` | — | optional medication sample data (applies `backend/migrations/history/global/015_medications_sample_data.sql`); reads `DB_NAME`, `DB_USER`, `DB_HOST`, `DB_PORT` |
| `diagnose-archiving.js`, `clean-archive-database.js` | — | diagnose / reset the separate archive database |

## Removed (2026-11-23)

These predated the schema-per-tenant cut-over (migration 066) and the migration ledger: they
connected with `search_path=public`, where the clinical tables no longer live, applied migration
files outside the ledger, or deleted data. A database is built with `npm run migrate` then
`npm run migrate:tenants`; `npm run check:schema-health` and `GET /health` replace the diagnostics.

`reset-and-seed.js` (and `npm run reset-db`), `run-reset-simple.js`, `run-reset-and-seed.js`,
`run-reset-and-seed-delete.js`, `seed.js`, `migrate.js`, `migrate-enhanced.js`,
`migrate-telehealth.js`, `quick-setup.js`, `run-scheduling-migration.js`,
`run-appointments-migrations.js`, `run-single-migration.js`, `drop-tables.js`,
`fix-address-column.js`, `fix-appointments-table.js`, `fix-lab-orders-schema.js`,
`check-providers-schema.js`, `diagnose-patient-portal.js`, `inspect-schema.js`; and in `backend/`,
`test-db.js` and `check-audit-setup.js`. They remain in git history.

## Legacy SQL and shell — do not run against a current database

Left from the same era and used only by the scripts above: `init-database.sh` / `.bat` (drops the
`public` schema), `reset-and-seed*.sql`, `reset-database.sql`, `seed-data.sql`,
`seed-test-data.sql`, `check-database.sql`, `fix-patient-names.sql`, `grant-permissions.sql`.
Never run any reset or seed file against production: they delete data.
