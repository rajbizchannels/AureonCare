#!/usr/bin/env node
// SEC-05 Model D — clear OAuth client credentials stored in per-tenant settings rows.
//
// The OAuth client id/secret are GLOBAL (one app registration per provider) and belong
// in the environment. They were also being written into the provider settings tables,
// which — now that those tables live in each tenant schema — copies the same secret into
// every tenant's data. Only the per-practice account and its tokens belong there.
//
// This is a Node script rather than a SQL migration on purpose: it must read the
// environment to decide what is SAFE to clear. A provider's stored credential is only
// removed when the corresponding env var is present, so clearing can never break a
// working integration. Providers without env configuration are reported and skipped.
//
// Usage:
//   node backend/scripts/deprecate-oauth-credentials.js          # report only (default)
//   node backend/scripts/deprecate-oauth-credentials.js --apply  # perform the clearing

const { Pool } = require('pg');

const APPLY = process.argv.includes('--apply');

const pool = new Pool({
  host: process.env.AC_DB_H || 'localhost',
  port: process.env.AC_DB_P || 5432,
  database: process.env.AC_DB_N || 'aureoncare',
  user: process.env.AC_DB_U || 'postgres',
  password: process.env.AC_DB_W || 'AureonCare2024!',
});

// settings table -> column holding the provider key
const TABLES = [
  { table: 'telehealth_provider_settings', keyCol: 'provider_type' },
  { table: 'backup_provider_settings', keyCol: 'provider_type' },
  { table: 'vendor_integration_settings', keyCol: 'vendor_type' },
];

// Mirrors resolveClientCredentials() in routes/integrationOAuth.js.
function envConfigured(providerKey) {
  const prefixes = providerKey === 'microsoft_teams'
    ? ['TEAMS', providerKey.toUpperCase()]
    : [providerKey.toUpperCase()];
  for (const p of prefixes) {
    const id = process.env[`${p}_CLIENT_ID`] || process.env[`AC_${p}_CID`];
    const secret = process.env[`${p}_CLIENT_SECRET`] || process.env[`AC_${p}_CSK`];
    if (id && secret) return true;
  }
  return false;
}

(async () => {
  let cleared = 0, skipped = 0, scanned = 0;
  try {
    // Settings tables are per-tenant: sweep every tenant schema (and public, for an
    // install that predates the cutover).
    const { rows: schemas } = await pool.query(
      `SELECT nspname FROM pg_namespace
        WHERE nspname = 'public' OR nspname LIKE 'tenant\\_%' ORDER BY nspname`
    );

    for (const { nspname: schema } of schemas) {
      for (const { table, keyCol } of TABLES) {
        const exists = await pool.query('SELECT to_regclass($1) AS t', [`${schema}.${table}`]);
        if (!exists.rows[0].t) continue;

        const { rows } = await pool.query(
          `SELECT ${keyCol} AS provider FROM ${schema}.${table}
            WHERE client_id IS NOT NULL OR client_secret IS NOT NULL`
        );
        for (const r of rows) {
          scanned++;
          if (envConfigured(r.provider)) {
            if (APPLY) {
              await pool.query(
                `UPDATE ${schema}.${table} SET client_id = NULL, client_secret = NULL,
                        updated_at = CURRENT_TIMESTAMP WHERE ${keyCol} = $1`,
                [r.provider]
              );
            }
            console.log(`${APPLY ? 'cleared' : 'would clear'}  ${schema}.${table} [${r.provider}] (env configured)`);
            cleared++;
          } else {
            console.warn(
              `SKIP     ${schema}.${table} [${r.provider}] — no env credentials found. ` +
              `Set ${r.provider.toUpperCase()}_CLIENT_ID / _CLIENT_SECRET first, or this integration would break.`
            );
            skipped++;
          }
        }
      }
    }

    console.log(`\nScanned ${scanned} row(s): ${cleared} ${APPLY ? 'cleared' : 'clearable'}, ${skipped} skipped.`);
    if (!APPLY && cleared > 0) console.log('Re-run with --apply to perform the clearing.');
    if (skipped > 0) process.exitCode = 1;
    await pool.end();
  } catch (err) {
    console.error('Failed:', err.message);
    await pool.end().catch(() => {});
    process.exit(2);
  }
})();
