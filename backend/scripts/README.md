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

## Legacy — do not run against a current database

These predate the schema-per-tenant cut-over (migration 066, which moved the clinical
tables out of `public`) and the migration ledger. Most connect with `search_path=public`,
where those tables no longer exist; several apply migration files directly, outside the
ledger. A fresh database is built by `npm run migrate` then `npm run migrate:tenants`
instead.

- **Reset and seed:** `reset-and-seed.js` (`npm run reset-db`) — runs historical migrations
  021, 022, 009 and 017 directly, deletes all data in `public`, then loads
  `seed-test-data.sql`; `run-reset-simple.js`, `run-reset-and-seed-delete.js`,
  `run-reset-and-seed.js` and their `reset-and-seed*.sql`; `reset-database.sql`;
  `seed-test-data.sql`, `seed-data.sql`, `seed.js`. It also contains a hard-coded fallback
  database password.
- **Schema builders:** `migrate.js`, `migrate-enhanced.js`, `migrate-telehealth.js`,
  `quick-setup.js`, `init-database.sh` / `.bat` (drops the `public` schema, applies
  `backend/schema.sql`), `run-scheduling-migration.js`, `run-appointments-migrations.js`,
  `run-single-migration.js`, `drop-tables.js`, `check-database.sql`.
- **One-off repairs and diagnostics:** `fix-address-column.js`, `fix-appointments-table.js`,
  `fix-lab-orders-schema.js`, `fix-patient-names.sql`, `check-providers-schema.js`,
  `diagnose-patient-portal.js`, `inspect-schema.js`, `grant-permissions.sql`.

Never run any reset or seed script against production: they delete data.
