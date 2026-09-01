// Core (public/control) migration runner.
//
// Usage:
//   node backend/run-migrations.js            apply everything outstanding
//   node backend/run-migrations.js --adopt    record every file as applied WITHOUT running
//                                             it -- for an existing database that predates
//                                             the ledger and is already fully migrated
//   node backend/run-migrations.js --dry-run  list what would run, change nothing
//
// Two things this runner guarantees that the previous one did not:
//
//  1. A ledger (public.schema_migrations). Files are applied once and skipped thereafter,
//     so re-running is safe and cheap instead of replaying 90-odd files and swallowing
//     "already exists" errors to survive.
//
//  2. A from-scratch path. The historical chain cannot be replayed on an empty database --
//     it contains int->uuid rewrites and one-off repair files that assume a database in a
//     particular state. An empty database is therefore seeded from baseline/000_baseline.sql
//     and the superseded files listed in baseline/contains.txt are recorded as applied
//     without executing.
//
// Each migration runs in its own transaction: a failure rolls that file back and stops the
// run, leaving the ledger consistent with what actually landed.

const fs = require('fs');
const path = require('path');

// Share the app's pool config rather than re-deriving it. That one place understands
// AC_PG_URI (Supabase) and SSL, so this runner works against a managed/production
// database — not just a local socket — which is the only way to migrate a Vercel
// deployment, where there is no shell to run this in.
const pool = require('./db');
const { explainConnectionError } = require('./db');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const BASELINE_DIR = path.join(MIGRATIONS_DIR, 'baseline');
const BASELINE_FILE = path.join(BASELINE_DIR, '000_baseline.sql');
const CONTAINS_FILE = path.join(BASELINE_DIR, 'contains.txt');
const BASELINE_KEY = 'baseline/000_baseline.sql';

const ADOPT = process.argv.includes('--adopt');
const DRY_RUN = process.argv.includes('--dry-run');

/** Migration files, in apply order. Only the top level — archive/ and tenant/ are excluded. */
function listMigrations() {
  return fs
    .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.sql'))
    .map((e) => e.name)
    .sort();
}

function baselineContains() {
  if (!fs.existsSync(CONTAINS_FILE)) return new Set();
  return new Set(
    fs
      .readFileSync(CONTAINS_FILE, 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))
  );
}

async function ensureLedger() {
  // public-qualified on purpose: after the SEC-05 cutover the default search_path leads
  // with a tenant schema, and the ledger is emphatically not per-tenant.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      filename    TEXT PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      executed    BOOLEAN NOT NULL DEFAULT TRUE
    )
  `);
}

async function appliedSet() {
  const { rows } = await pool.query('SELECT filename FROM public.schema_migrations');
  return new Set(rows.map((r) => r.filename));
}

/** Is this an empty database, or one that already has the app's schema? */
async function isFreshDatabase() {
  const { rows } = await pool.query("SELECT to_regclass('public.users') AS t");
  return rows[0].t === null;
}

async function record(client, filename, executed) {
  await client.query(
    `INSERT INTO public.schema_migrations (filename, executed) VALUES ($1, $2)
     ON CONFLICT (filename) DO NOTHING`,
    [filename, executed]
  );
}

async function applyFile(filename, absPath) {
  const sql = fs.readFileSync(absPath, 'utf8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await record(client, filename, true);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function seedBaseline() {
  console.log('🌱 Empty database — seeding from baseline/000_baseline.sql');
  if (DRY_RUN) return baselineContains();
  await applyFile(BASELINE_KEY, BASELINE_FILE);

  const contained = baselineContains();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const f of contained) await record(client, f, false);
    await client.query('COMMIT');
  } finally {
    client.release();
  }
  console.log(`   baseline applied; ${contained.size} superseded migrations recorded as contained\n`);
  return contained;
}

async function adopt(files) {
  console.log('📌 --adopt: recording every migration as applied, running none of them.\n');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await record(client, BASELINE_KEY, false);
    for (const f of files) await record(client, f, false);
    await client.query('COMMIT');
  } finally {
    client.release();
  }
  console.log(`✅ ${files.length + 1} entries recorded. Future runs apply only new files.`);
}

async function main() {
  const files = listMigrations();
  await ensureLedger();

  if (ADOPT) return adopt(files);

  const fresh = await isFreshDatabase();
  const alreadyLedgered = (await appliedSet()).size > 0;

  if (fresh) {
    await seedBaseline();
  } else if (!alreadyLedgered) {
    console.error(
      '❌ This database already has a schema but no migration ledger.\n' +
        '   Refusing to guess which migrations it has. If it is fully migrated, run:\n' +
        '       node backend/run-migrations.js --adopt\n' +
        '   That records the current file set as applied without executing anything.'
    );
    process.exitCode = 1;
    return;
  }

  const applied = await appliedSet();
  const pending = files.filter((f) => !applied.has(f));

  if (pending.length === 0) {
    console.log('✨ Nothing to do — database is up to date.');
    return;
  }

  console.log(`🔄 ${pending.length} migration(s) to apply:\n`);
  for (const f of pending) {
    if (DRY_RUN) {
      console.log(`   would run: ${f}`);
      continue;
    }
    process.stdout.write(`📄 ${f} ... `);
    try {
      await applyFile(f, path.join(MIGRATIONS_DIR, f));
      console.log('ok');
    } catch (err) {
      console.log('FAILED');
      console.error(`\n❌ ${f}: [${err.code}] ${err.message}`);
      console.error('   Rolled back. Nothing after this point was applied.');
      process.exitCode = 1;
      return;
    }
  }

  if (!DRY_RUN) {
    console.log('\n✨ Migrations complete.');
    console.log('   Next: node backend/run-tenant-migrations.js  (fans tenant/*.sql across tenant schemas)');
  }
}

main()
  .catch((err) => {
    console.error('\n❌ Migration run failed:', err.message);
    const hint = explainConnectionError(err);
    if (hint) console.error('\n' + hint);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
