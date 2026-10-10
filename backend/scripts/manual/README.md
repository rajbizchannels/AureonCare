# Manual migration scripts

For applying migrations when you cannot run `node` against the database — the Supabase SQL
editor, a psql session, a locked-down network. Each script is the hand-runnable equivalent
of part of:

```bash
node backend/run-migrations.js        # global: public / control
node backend/run-tenant-migrations.js # tenant: every tenant schema + template
```

## Do not paste `migrations/tenant/*.sql` directly

Those files use **unqualified** table names on purpose, because the runner sets
`search_path` to each tenant schema before executing them. Pasted raw into a SQL editor
they resolve against `public`, where the tenant tables no longer live since migration 066
moved them — so every one of them fails with:

```
ERROR: 42P01: relation "audit_logs" does not exist
ERROR: 42P01: relation "healthcare_offerings" does not exist
ERROR: 42P01: relation "clinic_info" does not exist
```

That is the expected outcome, not a sign anything is broken. Use `apply-tenant-migrations.sql`
instead: it loops over every tenant schema, sets `search_path` per schema, and records each
file in that schema's own `schema_migrations` ledger so the node runner will not repeat it.

Global migrations (`migrations/0NN_*.sql`) **can** be pasted raw — they are schema-qualified
throughout — but they will not be recorded in `public.schema_migrations`, so the node runner
would run them again later. The scripts here add the ledger row.

## Run order

Global first, then tenant. Always.

| # | Script | Covers |
|---|---|---|
| 1 | `apply-pending-migrations.sql` | globals 080–082, and tenant/003 |
| 2 | `apply-global-083-084.sql` | globals 083–084 — registers `locations` and the camp tables, and gates camps by plan |
| 3 | `apply-tenant-migrations.sql` | tenant 001–006 — creates the tables in every tenant schema and in `template` |

Step 2 before step 3 matters because `control.provision_schema` clones exactly what
`control.tenant_tables` lists. Get the order wrong and nothing breaks permanently — a
tenant provisioned in the gap is picked up by the next tenant run — but until then it is
missing those tables.

All three are safe to re-run: every statement is idempotent and the ledgers are consulted
first, so a re-paste reports `0 file(s) applied`.

## Why these scripts look the way they do

Four earlier attempts failed **in the Supabase SQL editor only** — all of them were fine
under `psql`, which is why they shipped broken. Its parser is stricter than the server's:

- dollar quoting nested three deep is rejected
- the migration bodies as one huge single-quoted literal is rejected
- dollar-quote tags containing **digits** (`$do1$`) are not recognised by its letters-only
  tag matcher

So: no nested dollar quoting anywhere, the only dollar-quoted blocks are top level with
letters-only tags (`$fn$`, `$fnc$`, `$outer$`, `$verify$`), and the per-schema DDL runs from
ordinary single-quoted strings kept to one statement each.

## Verifying a run

Each script ends with a verification block. Silence or a `verified:` notice means it is
done; a `WARNING` names the schema or table that is short. Afterwards, if you can run node:

```bash
npm run check:schema-health     # every tenant schema complete and matching template
npm run check:tenant-scoping
```

`apply-tenant-migrations.sql` is checked against the runner rather than only eyeballed: on
a database built by the script, `template` and `tenant_default` match a runner-built
database across all ~2,400 column, constraint and index facts, including the seeded primary
location (one row in `tenant_default`, none in `template`).

## `audit-stored-secrets.sql`

Unrelated to migrations. A read-only audit of which provider secrets are held in the
database rather than in environment variables. Reports presence only, never values.
