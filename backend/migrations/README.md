# AureonCare database migrations

Two sets of SQL live here, and they are run by two different runners:

| Directory | Targets | Runner |
|---|---|---|
| `migrations/*.sql` | `public` and `control` — the shared and control-plane schemas | `node backend/run-migrations.js` (`npm run migrate`) |
| `migrations/tenant/*.sql` | every tenant schema **and** the golden `template` | `node backend/run-tenant-migrations.js` (`npm run migrate:tenants`) |

Run them in that order, both of them, on every deploy:

```bash
npm run migrate          # global: public + control — applies only what is new
npm run migrate:tenants  # fans the tenant set across every schema and `template`
```

Add `--dry-run` to either to see what would run without touching anything.

## Do not run these files by hand

> **`001_update_users_table.sql` begins with `DROP TABLE IF EXISTS users CASCADE`.**

That was written for an empty development database. Applying it to a database with data in
it destroys the users table and everything referencing it. An earlier version of this file
told you to do exactly that, with a `psql -f` for each migration, which is why the warning
is this blunt.

The runners exist for three reasons that a `psql -f` loop does not provide:

- **A ledger.** Each applied file is recorded — globally in `public.schema_migrations`,
  and per schema in `<schema>.schema_migrations` — so nothing is applied twice. Running a
  file by hand applies the SQL without recording it, and the runner then runs it again
  later.
- **The right `search_path`.** Migration 066 set the database default to
  `tenant_default, public, control`, so an unqualified `CREATE TABLE` in a *global*
  migration silently lands in `tenant_default`. Global migrations pin `SET search_path TO
  public` and schema-qualify everything; see `072_global_runtime_ddl.sql`.
- **The fan-out.** A tenant migration is written with *unqualified* table names on
  purpose, because the tenant runner sets `search_path` to each schema in turn. Pasted
  into a SQL editor those same files resolve against `public`, where the tenant tables no
  longer live, and every one of them fails with `relation "..." does not exist`. That is
  the expected outcome, not a fault.

`backend/run_migrations.sh` does exactly the loop described above — `psql -f` over every
file in order, with no ledger and no `search_path` handling — so it carries the same
hazard as running them by hand, starting with that `DROP TABLE`. The previous version of
this file recommended it. It is left in place rather than deleted, because it may still be
useful for building a throwaway database from nothing, but it must not be pointed at a
database with data in it.

If you genuinely cannot run node against the database, use the hand-runnable equivalents
in `backend/scripts/manual/` — they loop the schemas and write the ledger rows themselves.
See `backend/scripts/manual/README.md`.

## Adding a migration

- **Global** (`public` / `control`): next free `NNN_description.sql`. Pin
  `SET search_path TO public` and schema-qualify every object.
- **Tenant**: `migrations/tenant/NNN_description.sql`, unqualified names only. The rules
  are in [`tenant/README.md`](tenant/README.md) — read it before writing one.

A new per-tenant table needs **three** things, and missing any one of them is the usual
cause of "it works on my tenant and not on a new one":

1. created by a tenant migration (which also creates it in `template`),
2. registered in `control.tenant_tables` by a global migration — `control.provision_schema`
   clones exactly what that table lists, so an unregistered table is absent from every
   tenant provisioned afterwards,
3. and therefore present in `template`, which is what a new tenant is cloned from.

`FEATURE_IMPLEMENTATION_STEPS.md` at the repository root works through this with a real
example.

## Checking the result

```bash
npm run check:schema-health    # reports any tenant schema that is behind
npm run check:tenant-scoping   # reports routes reading tenant tables off the wrong pool
```

A tenant left behind is reported by the first rather than failing at request time.

## Other notes in this directory

- [`MEDICATION_DATA_README.md`](MEDICATION_DATA_README.md) — loading the medication reference data
- [`README_MEDICAL_CODES.md`](README_MEDICAL_CODES.md) — the ICD/CPT code sets
- [`archive/README.md`](archive/README.md) — superseded migrations, kept for history
