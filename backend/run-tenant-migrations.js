// SEC-05 Model D — Step S5: per-tenant migration fan-out runner.
//
// Two migration classes exist:
//   • GLOBAL migrations  (migrations/*.sql, run by run-migrations.js) — public/control,
//     one-time, includes the SEC-05 control-plane migrations themselves.
//   • TENANT migrations  (migrations/tenant/NNN_name.sql, run by THIS script) — applied
//     INSIDE every tenant schema and the golden `template`, tracked per schema.
//
// Tenant migrations are authored with UNQUALIFIED table names (e.g. `ALTER TABLE
// patients ...`); this runner executes each one with search_path set to the target
// schema, so the same file applies to every tenant. Run this AFTER run-migrations.js.
//
// Properties: idempotent & resumable (only missing versions run), failure-isolated
// (one tenant's failure never blocks the others; it's marked failed and retried next
// run), bounded concurrency, and `template` is migrated too so newly provisioned
// tenants start current.
//
// Usage:  node run-tenant-migrations.js
// Env:    AC_PG_URI or AC_DB_* (same as run-migrations.js), TENANT_MIGRATE_CONCURRENCY
//         (default 5).

const fs = require('fs');
const path = require('path');

// Shared pool config — understands AC_PG_URI (Supabase) and SSL. See run-migrations.js.
const pool = require('./db');
const { explainConnectionError } = require('./db');

const TENANT_DIR = path.join(__dirname, 'migrations', 'tenant');
const CONCURRENCY = Math.max(1, parseInt(process.env.TENANT_MIGRATE_CONCURRENCY || '5', 10));
const SAFE_SCHEMA = /^[a-z_][a-z0-9_]*$/;

function loadMigrations() {
  if (!fs.existsSync(TENANT_DIR)) return [];
  return fs.readdirSync(TENANT_DIR)
    .filter((f) => /^\d+_.*\.sql$/.test(f))
    .map((f) => ({
      version: parseInt(f.match(/^(\d+)/)[1], 10),
      name: f,
      sql: fs.readFileSync(path.join(TENANT_DIR, f), 'utf8'),
    }))
    .sort((a, b) => a.version - b.version);
}

async function listTargetSchemas() {
  // Fail loudly if the control plane is absent — global migrations must run first.
  let rows;
  try {
    ({ rows } = await pool.query(
      "SELECT schema_name FROM control.tenants WHERE schema_name IS NOT NULL AND status <> 'suspended'"
    ));
  } catch (e) {
    throw new Error(
      `control plane not found (run global migrations first): ${e.message}`
    );
  }
  const schemas = new Set(['template']); // always keep the golden template current
  rows.forEach((r) => schemas.add(r.schema_name));
  return [...schemas];
}

async function migrateSchema(schema, migrations) {
  if (!SAFE_SCHEMA.test(schema)) throw new Error(`unsafe schema name: ${schema}`);
  const client = await pool.connect();
  let appliedCount = 0;
  try {
    await client.query(
      `CREATE TABLE IF NOT EXISTS ${schema}.schema_migrations (
         version integer PRIMARY KEY, name text NOT NULL,
         applied_at timestamptz NOT NULL DEFAULT now())`
    );
    const { rows } = await client.query(`SELECT version FROM ${schema}.schema_migrations`);
    const applied = new Set(rows.map((r) => r.version));
    const pending = migrations.filter((m) => !applied.has(m.version));

    for (const m of pending) {
      await client.query('BEGIN');
      try {
        await client.query(`SET LOCAL search_path TO ${schema}, public, control`);
        await client.query(m.sql);
        await client.query(
          'INSERT INTO schema_migrations (version, name) VALUES ($1, $2)',
          [m.version, m.name]
        );
        await client.query('COMMIT');
        appliedCount++;
        console.log(`  [${schema}] applied ${m.name}`);
      } catch (e) {
        await client.query('ROLLBACK');
        throw new Error(`[${schema}] ${m.name} failed: ${e.message}`);
      }
    }
    return { schema, appliedCount };
  } finally {
    client.release();
  }
}

async function setTenantStatus(schema, status, version) {
  try {
    await pool.query(
      `UPDATE control.tenants
         SET migration_status = $1,
             schema_version = COALESCE($2, schema_version),
             updated_at = now()
       WHERE schema_name = $3`,
      [status, version, schema]
    );
  } catch (_) { /* template / missing row — ignore */ }
}

// Bounded-concurrency map that never rejects; captures per-item ok/error.
async function runPool(items, limit, fn) {
  const results = new Array(items.length);
  let i = 0;
  const worker = async () => {
    while (i < items.length) {
      const idx = i++;
      try { results[idx] = { ok: true, value: await fn(items[idx]) }; }
      catch (e) { results[idx] = { ok: false, error: e, item: items[idx] }; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

(async () => {
  try {
    const migrations = loadMigrations();
    const schemas = await listTargetSchemas();
    const targetVersion = migrations.length ? Math.max(...migrations.map((m) => m.version)) : 0;
    console.log(
      `Tenant migrations: ${migrations.length} file(s); targets (${schemas.length}): ${schemas.join(', ')}; concurrency ${CONCURRENCY}`
    );

    const results = await runPool(schemas, CONCURRENCY, async (schema) => {
      const r = await migrateSchema(schema, migrations);
      if (schema !== 'template') await setTenantStatus(schema, 'idle', targetVersion);
      return r;
    });

    const failed = results.filter((r) => !r.ok);
    for (const f of failed) {
      console.error(`FAILED ${f.item}: ${f.error.message}`);
      if (f.item !== 'template') await setTenantStatus(f.item, 'failed', null);
    }

    const okCount = results.length - failed.length;
    console.log(`\nDone: ${okCount}/${results.length} schema(s) up to date; ${failed.length} failed.`);
    await pool.end();
    process.exit(failed.length ? 1 : 0);
  } catch (e) {
    console.error(`Fatal: ${e.message}`);
    await pool.end().catch(() => {});
    process.exit(2);
  }
})();
