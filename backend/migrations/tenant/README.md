# Tenant migrations (SEC-05 Model D)

SQL here is applied **inside every tenant schema** and the golden `template` by
`run-tenant-migrations.js` (Step S5) — separate from the global `migrations/*.sql`
(run by `run-migrations.js`), which target `public` / `control`.

## Rules
- **Name:** `NNN_description.sql` with a zero-padded numeric version prefix
  (`001_add_column.sql`, `002_...`). Version order = apply order.
- **Unqualified table names only.** Write `ALTER TABLE patients ADD COLUMN ...`, never
  `public.patients` or `tenant_x.patients`. The runner sets `search_path` to the target
  schema, so the one file applies to all tenants.
- **Runs inside a transaction.** Do NOT use statements that can't run in a transaction
  (e.g. `CREATE INDEX CONCURRENTLY`). Prefer additive, lock-light changes
  (`ADD COLUMN` nullable, then a batched backfill in a later step).
- **Expand/contract.** Ship additive changes first; drop old columns only in a later
  version once all code and tenants are upgraded.
- **Idempotency is provided by the runner** (each version applied at most once per
  schema, tracked in `<schema>.schema_migrations`) — you do not need `IF NOT EXISTS`,
  but it doesn't hurt.

## Order of operations on deploy
1. `node run-migrations.js`         # global (public/control), incl. control plane
2. `node run-tenant-migrations.js`  # fan out tenant migrations to every tenant + template

The directory may be empty — the runner is a safe no-op when there are no tenant
migrations yet.
