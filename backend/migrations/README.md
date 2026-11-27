# AureonCare database migrations

```
migrations/
  baseline/000_baseline.sql   the whole history (global 001–100, tenant 001–016) as ONE snapshot
  baseline/contains.txt       the historical files the baseline contains
  NNN_description.sql         new GLOBAL migrations (public / control) — next number: 111
  tenant/NNN_description.sql  new TENANT migrations (every practice schema + template) — next: 021
  history/                    the historical files, kept for reference — never run
    global/  tenant/  manual-applied/  legacy-repair-scripts/
```

## Running

```bash
npm run migrate            # global: public + control — applies only what is new
npm run migrate:tenants    # fans tenant/*.sql across every practice schema and `template`
npm run check:schema-health
```

Add `--dry-run` to either runner to see what would run without changing anything.

**An empty database** (no `public.users`) is built from `baseline/000_baseline.sql`; every file
in `contains.txt` is then recorded as applied, and only newer files run. The baseline was made
by running the full historical chain on an empty database and dumping it (schema, privileges,
seed rows); a database built from it was checked against one built from the chain — same 276
tables, 4,314 columns, 1,045 constraints, 1,069 indexes, 103 functions, 1,081 grants and
identical seed data — and the test suites pass on it.

**An existing database** (production included) never runs the baseline: its ledger already
records the historical files, so the runner applies only files that are new. Nothing changed for
it when the history was consolidated.

**A database with a schema but no ledger** is refused. If it is fully migrated, record the
current file set without executing anything: `node backend/run-migrations.js --adopt`.

The runners keep ledgers — `public.schema_migrations` (global, by filename) and
`<schema>.schema_migrations` (tenant, by version) — so nothing is applied twice. Running a file
by hand with `psql -f` applies it without recording it; do not.

## Adding a migration

- **Global** (`public` / `control`): `migrations/NNN_description.sql` with the next number.
  Start with `SET search_path TO public` and schema-qualify every object — the database default
  `search_path` leads with a tenant schema, so an unqualified `CREATE TABLE` lands there.
- **Tenant**: `migrations/tenant/NNN_description.sql`, **unqualified** names only — the runner sets
  `search_path` to each practice schema in turn. Rules in [`tenant/README.md`](tenant/README.md).

A new per-practice table needs three things, or it works on existing practices and is missing on
new ones:

1. created by a tenant migration (which also creates it in `template`),
2. registered in `control.tenant_tables` by a global migration — `control.provision_schema` clones
   exactly what that table lists,
3. and therefore present in `template`, which new practices are cloned from.

### Migrations someone will paste into the Supabase SQL editor

Production is migrated by pasting files into the SQL editor as `postgres`. A tenant file pasted
there resolves against `public` and fails, so changes to practice schemas ship as a **global**
file that fans out itself — the pattern used by 096, 099 and 100 (see
`history/global/100_notifications_eligibility_scrub.sql`): register the table in
`control.tenant_tables`, then loop `template` + every `control.tenants.schema_name`, set
`search_path`, create/alter, grant to `aureoncare_app`, and write the per-schema ledger row; plus
the equivalent tenant file for the runner. Make both safe to re-run.

## Reference data

The medical code sets (ICD-10, CPT) and the medication catalogue are not part of the baseline: a
fresh install has the tables, empty. Production's code sets were loaded separately. Optional
medication sample data: `backend/scripts/load_medication_data.sh` (or `.bat`), which applies
`history/global/015_medications_sample_data.sql`. Specialty packs: `npm run packs:load`.

## Hand-runnable SQL

`backend/scripts/manual/` holds SQL that can be pasted when node cannot reach the database:
specialty packs (`apply-specialty-packs.sql`) and an audit of stored secrets. The one-off
`apply-*` scripts for migrations 083–099 have all been applied in production and are kept in
`history/manual-applied/`.

## History

`history/global` and `history/tenant` are the files the baseline was built from;
`history/legacy-repair-scripts` are early copy-paste repair scripts that were never part of the
chain. `history/README_MEDICAL_CODES.md` and `history/MEDICATION_DATA_README.md` describe what
migrations 015 and 027–030 did. To regenerate the baseline after a future squash: build an empty
database with the chain, `pg_dump --no-owner --inserts --exclude-table-data=public.schema_migrations`,
then apply the same clean-up as the current file's header describes (no psql meta-commands, session
settings as `SET LOCAL`, ledger table left to the runner, `aureoncare_app` created first).
