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
| 4 | `apply-tenant-migrations-007-009.sql` | tenant 007–009 — pack provenance columns, the system form library, and handing five specialty forms to their packs |
| 5 | `apply-global-085.sql` | global 085 — the specialty taxonomy, pack catalogue and `practices.setup` |
| 6 | `apply-specialty-packs.sql` | publishes the specialty packs — the SQL equivalent of `npm run packs:load` |

Without step 6 the setup wizard lists every specialty as having **"no starter content
yet"**. That is not a fault in the wizard: `public.specialty_packs` is simply empty,
because the packs are JSON files that a node script normally publishes.

If you can run node, `npm run packs:load` does the same thing, and
`npm run check:form-library` confirms every tenant has the form library.

Step 2 before step 3 matters because `control.provision_schema` clones exactly what
`control.tenant_tables` lists. Get the order wrong and nothing breaks permanently — a
tenant provisioned in the gap is picked up by the next tenant run — but until then it is
missing those tables.

Step 5 before `packs:load`, because the loader refuses to run until `public.specialties`
exists.

All of them are safe to re-run: every statement is idempotent and the ledgers are consulted
first, so a re-paste reports `0 file(s) applied`.

## `apply-specialty-packs.sql` is generated

```bash
node backend/scripts/build-manual-specialty-packs.js > backend/scripts/manual/apply-specialty-packs.sql
```

Each pack is written as one INSERT for everything except its form templates, then one
UPDATE per form template. A whole pack as a single quoted literal reaches 17 KB and this
project's SQL has been rejected by the editor for exactly that before; split this way no
literal passes about 4 KB. Re-running replaces the definition and rebuilds the templates,
so the end state is the same however many times it runs, and a pack a clinician has
approved is skipped entirely.

Checked against the node loader rather than eyeballed: on two databases, one published by
`npm run packs:load` and one by this script, the pack definitions are identical across all
3,440 lines of pretty-printed JSON, and still identical after three runs.

## `apply-tenant-migrations-007-009.sql` is generated

tenant/008 is 283 form-field definitions inside jsonb literals. The other scripts run their
DDL from inside a loop via `EXECUTE '...'`, which here would mean doubling every single
quote in all of it. So `backend/scripts/build-manual-tenant-007-009.js` embeds 008's body
**verbatim** at the top level, under a `search_path` pinned to `template`, then copies the
rows out of `template` into every tenant schema — the same copy that provisioning and
`scripts/repair-form-library.js` already perform. Nothing is retyped and nothing is escaped.

Regenerate it rather than hand-editing:

```bash
node backend/scripts/build-manual-tenant-007-009.js > backend/scripts/manual/apply-tenant-migrations-007-009.sql
```

One subtlety worth knowing if you change it: the embedded 008 body is plain top-level SQL
and therefore has **no ledger guard** — a second run re-inserts the five specialty forms
into `template`, because migration 009 removed them and so `ON CONFLICT` does not fire. The
script repeats the removal from `template` unconditionally, immediately after the body and
before the fan-out, so the end state is the same however many times it runs. Without that,
a second run would leave `template` holding 22 base templates instead of 17 and every
tenant provisioned afterwards would silently get the five back.

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

Both tenant scripts are checked against the runner rather than only eyeballed: on a
database built from the scripts alone, `template` and `tenant_default` match a runner-built
database across all 2,411 and 1,638 facts respectively — columns, constraints, indexes, the
seeded primary location, and every form template's id, field count, signature and witness
flags, category, subcategory, languages, tags and compliance tags. Run three times in
succession with the same result each time.

## `audit-stored-secrets.sql`

Unrelated to migrations. A read-only audit of which provider secrets are held in the
database rather than in environment variables. Reports presence only, never values.
