#!/usr/bin/env node
// Backfill the portal identity index (control.portal_identity_route) — SEC-05 deploy step.
//
// Portal password login finds a patient's practice through this index: a keyed hash of the
// email (AC_IDX_K) -> practice. Entries are written when a portal is enabled or on a
// successful login — but only while AC_IDX_K is set. A patient registered before the key
// existed therefore has no entry, so their login searches only the default practice,
// fails, and never gets the chance to write one. This registers every portal-enabled
// patient of every active practice.
//
// Safe to re-run: the register function upserts. Stores only HMACs, never addresses.
//
//   AC_IDX_K=... node backend/scripts/backfill-portal-identities.js --dry-run
//   AC_IDX_K=... node backend/scripts/backfill-portal-identities.js
//
// Run it with the SAME AC_IDX_K (and AC_IDX_KV) the app uses, or the entries will not match.

const path = require('path');
const pool = require(path.join(__dirname, '..', 'db.js'));
const { withTenant } = require(path.join(__dirname, '..', 'db', 'tenantClient.js'));
const { emailHmac, isConfigured, KEY_VERSION } = require(path.join(__dirname, '..', 'utils', 'blindIndex.js'));

const DRY = process.argv.includes('--dry-run');

(async () => {
  if (!isConfigured()) {
    console.error('AC_IDX_K is not set (or shorter than 32 bytes). Set it to the value the app uses.');
    process.exit(1);
  }
  const { rows: tenants } = await pool.query(
    "SELECT id, name, schema_name FROM control.tenants WHERE status = 'active' AND schema_name IS NOT NULL ORDER BY created_at");

  let total = 0; let failed = 0;
  for (const t of tenants) {
    let emails = [];
    try {
      // The same match the portal login uses: the patient's own email, or the email on
      // the linked user row (patients.id = users.id).
      emails = await withTenant(pool, t.schema_name, async (c) => {
        const { rows } = await c.query(`
          SELECT DISTINCT lower(trim(e)) AS email FROM (
            SELECT p.email AS e FROM patients p WHERE p.portal_enabled = true
            UNION ALL
            SELECT u.email FROM patients p JOIN users u ON u.id = p.id WHERE p.portal_enabled = true
          ) x WHERE e IS NOT NULL AND trim(e) <> ''`);
        return rows.map((r) => r.email);
      });
    } catch (err) {
      console.error(`  ${t.schema_name}: could not read patients (${err.message})`);
      failed += 1;
      continue;
    }
    let done = 0;
    if (!DRY) {
      for (const email of emails) {
        try {
          await pool.query('SELECT control.register_portal_identity($1, $2, $3)', [emailHmac(email), t.id, KEY_VERSION]);
          done += 1;
        } catch (err) {
          failed += 1;
          console.error(`  ${t.schema_name}: register failed (${err.message})`);
        }
      }
    }
    total += DRY ? emails.length : done;
    if (emails.length) console.log(`  ${t.schema_name} (${t.name}): ${emails.length} portal address(es)${DRY ? '' : `, ${done} registered`}`);
  }
  console.log(`\n${DRY ? 'Would register' : 'Registered'} ${total} identity route(s) across ${tenants.length} active practice(s), key version ${KEY_VERSION}.`
    + (failed ? ` ${failed} failure(s) — see above.` : ''));
  await pool.end();
  process.exit(failed ? 1 : 0);
})().catch((err) => { console.error(err); process.exit(1); });
