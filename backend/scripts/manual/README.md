# Hand-runnable SQL

For when you cannot run `node` against the database (the Supabase SQL editor, a psql session).

| Script | What it does |
|---|---|
| `apply-specialty-packs.sql` | publishes the specialty packs — the SQL equivalent of `npm run packs:load` |
| `audit-stored-secrets.sql` | read-only report of where secrets are stored |

The one-off `apply-*` scripts that applied migrations 080–099 by hand have all been applied in
production; they are kept for the record in `backend/migrations/history/manual-applied/`.
New migrations are written so the file itself can be pasted (a global file that fans out to every
practice schema and writes the ledger rows) — see `backend/migrations/README.md`.

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

## `audit-stored-secrets.sql`

Unrelated to migrations. A read-only audit of which provider secrets are held in the
database rather than in environment variables. Reports presence only, never values.
