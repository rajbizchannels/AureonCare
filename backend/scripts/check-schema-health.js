// Schema health check: is every tenant schema actually complete?
//
// Written because `run-migrations.js --adopt` records migrations as applied WITHOUT
// executing them. That is correct for adopting a database that really is up to date, but
// if any file was never applied, the ledger says "done", `run-migrations` reports nothing
// outstanding, and the gap only surfaces later as a bare 42P01/42703 from whichever route
// happens to touch the missing object first.
//
// This finds those gaps in one pass instead of one error at a time:
//
//   * every table registered in control.tenant_tables exists in every active tenant
//     schema, and in `template` (a gap there means every FUTURE tenant is born broken)
//   * the tenant migration files in migrations/tenant/ have been recorded per schema
//   * a handful of columns that later migrations add and that routes depend on
//
// Exits 0 when clean, 1 when anything is missing. Read-only — it changes nothing.
//
//   node backend/scripts/check-schema-health.js

const fs = require('fs');
const path = require('path');
const pool = require('../db');
const { explainConnectionError } = require('../db');

// Columns added by migrations that are easy to miss and that break a visible screen.
// Format: [table, column, "migration that adds it"].
const REQUIRED_PUBLIC_COLUMNS = [
  ['subscription_plans', 'max_providers', '053_update_subscription_tiers.sql'],
  ['subscription_plans', 'trial_days', '053_update_subscription_tiers.sql'],
  ['subscription_plans', 'self_serve', '075_self_serve_signup.sql'],
  ['subscription_plans', 'stripe_price_id', '075_self_serve_signup.sql'],
  ['users', 'practice_id', '065_sec05_users_practice_id.sql'],
  ['users', 'token_version', '061_add_token_version_to_users.sql'],
];

const problems = [];
const note = (s) => console.log(s);

async function tenantSchemas() {
  const { rows } = await pool.query(
    `SELECT schema_name FROM control.tenants WHERE status = 'active' AND schema_name IS NOT NULL
      ORDER BY created_at`
  );
  const list = rows.map((r) => r.schema_name);
  // The golden template is not a tenant but must stay current: every new tenant is a copy
  // of it, so a gap here is a gap in every tenant you have not created yet.
  const { rows: tmpl } = await pool.query(
    "SELECT 1 FROM information_schema.schemata WHERE schema_name = 'template'"
  );
  if (tmpl.length) list.push('template');
  return list;
}

async function main() {
  note('Schema health check\n');

  // 1. Control plane present at all?
  const { rows: ctl } = await pool.query(
    "SELECT 1 FROM information_schema.schemata WHERE schema_name = 'control'"
  );
  if (!ctl.length) {
    console.error('  FAIL  the `control` schema does not exist — migrations 063+ have not been applied.');
    process.exitCode = 1;
    return;
  }

  // 2. Public columns that later migrations add.
  for (const [table, column, source] of REQUIRED_PUBLIC_COLUMNS) {
    const { rows } = await pool.query(
      `SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name=$1 AND column_name=$2`, [table, column]
    );
    if (rows.length === 0) {
      problems.push(`public.${table}.${column} is missing — re-apply migrations/${source}`);
    }
  }
  note(`  checked ${REQUIRED_PUBLIC_COLUMNS.length} required public columns`);

  // 3. Every registered tenant table present in every tenant schema.
  const { rows: expected } = await pool.query(
    'SELECT table_name FROM control.tenant_tables ORDER BY table_name'
  );
  const expectedNames = expected.map((r) => r.table_name);
  const schemas = await tenantSchemas();
  note(`  checking ${expectedNames.length} tenant tables across ${schemas.length} schema(s)`);

  for (const schema of schemas) {
    const { rows: present } = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = $1`, [schema]
    );
    const have = new Set(present.map((r) => r.table_name));
    const missing = expectedNames.filter((t) => !have.has(t));
    if (missing.length) {
      problems.push(
        `${schema}: ${missing.length} tenant table(s) missing — ${missing.slice(0, 8).join(', ')}` +
        (missing.length > 8 ? `, +${missing.length - 8} more` : '')
      );
    }
  }

  // 4. Tenant migration files recorded per schema.
  const tenantDir = path.join(__dirname, '..', 'migrations', 'tenant');
  const files = fs.existsSync(tenantDir)
    ? fs.readdirSync(tenantDir).filter((f) => /^\d+_.*\.sql$/.test(f)).sort()
    : [];
  for (const schema of schemas) {
    const { rows: has } = await pool.query(
      `SELECT 1 FROM information_schema.tables
        WHERE table_schema=$1 AND table_name='schema_migrations'`, [schema]
    );
    if (!has.length) {
      if (files.length) problems.push(`${schema}: no schema_migrations table — run: npm run migrate:tenants`);
      continue;
    }
    const { rows: applied } = await pool.query(`SELECT name FROM ${schema}.schema_migrations`);
    const set = new Set(applied.map((r) => r.name));
    const outstanding = files.filter((f) => !set.has(f));
    if (outstanding.length) {
      problems.push(`${schema}: tenant migrations not applied — ${outstanding.join(', ')} (run: npm run migrate:tenants)`);
    }
  }

  note('');
  if (problems.length === 0) {
    note('OK — every tenant schema is complete and up to date.');
    return;
  }
  console.error(`${problems.length} problem(s) found:\n`);
  for (const p of problems) console.error(`  - ${p}`);
  console.error(
    '\nA missing table or column with a ledger that says "up to date" almost always means\n' +
    'run-migrations.js --adopt recorded a file that was never actually applied. Re-apply the\n' +
    'named migration directly; the files are idempotent.'
  );
  process.exitCode = 1;
}

main()
  .catch((err) => {
    const hint = explainConnectionError(err);
    console.error('Check failed:', err.message);
    if (hint) console.error('\n' + hint);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
