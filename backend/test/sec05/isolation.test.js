// SEC-05 Model D — Step S9: cross-tenant isolation test.
//
// Proves the two isolation mechanisms the swept routes rely on:
//   1. Schema isolation via req.db (makeTenantDb sets search_path to the tenant schema),
//      so unqualified queries on tenant tables see ONLY the caller's tenant.
//   2. practice_id scoping for identity tables (users/providers live in public and are
//      filtered explicitly).
// Plus: resolveTenantForUser maps a user to the right tenant, and withTenant does not
// leak a tenant search_path back to the pool.
//
// Requires a database already migrated with schema.sql + SEC-05 migrations 063-068
// (run.sh sets that up). Connects via AC_DB_* (same env as the app). Exits 0 on pass,
// non-zero on any failure. No test framework — plain assertions so it runs anywhere.

const assert = require('assert');
const { Pool } = require('pg');
const { makeTenantDb } = require('../../db/requestTenantDb');
const { withTenant } = require('../../db/tenantClient');
const { resolveTenantForUser, invalidateUserTenant } = require('../../services/tenantCatalog');

const pool = new Pool({
  host: process.env.AC_DB_H || 'localhost',
  port: process.env.AC_DB_P || 5432,
  database: process.env.AC_DB_N || 'aureoncare',
  user: process.env.AC_DB_U || 'postgres',
  password: process.env.AC_DB_W || 'AureonCare2024!',
  max: 6,
});

let passed = 0;
const check = (name, cond) => {
  assert.ok(cond, `FAIL: ${name}`);
  console.log(`  ok  ${name}`);
  passed++;
};

// Fake response object so makeTenantDb can register its release-on-finish listeners.
const { EventEmitter } = require('events');
const fakeRes = () => new EventEmitter();

async function q(pool_, text, params) { return (await pool_.query(text, params)).rows; }

async function setupTenant(slug, practiceName) {
  // A practice, a control.tenants row, a schema, one staff user (public) + one patient.
  const [{ id: practiceId }] = await q(pool,
    `INSERT INTO public.practices (id, name) VALUES (gen_random_uuid(), $1) RETURNING id`, [practiceName]);
  const schema = `tenant_${slug}`;
  await pool.query(`SELECT control.provision_schema($1)`, [schema]);
  await pool.query(
    `INSERT INTO control.tenants (slug, name, schema_name, practice_id, status)
     VALUES ($1, $2, $3, $4, 'active')
     ON CONFLICT (slug) DO UPDATE SET schema_name = EXCLUDED.schema_name, practice_id = EXCLUDED.practice_id`,
    [slug, practiceName, schema, practiceId]);

  // Staff user in public with this practice_id.
  const [{ id: userId }] = await q(pool,
    `INSERT INTO public.users (id, email, first_name, last_name, role, status, practice_id)
     VALUES (gen_random_uuid(), $1, 'Staff', $2, 'admin', 'active', $3) RETURNING id`,
    [`staff_${slug}@example.com`, slug, practiceId]);

  // One patient: patients.id = users.id (FK to public.users), the patient row lives in
  // the tenant schema. Create the patient's user first, then the patient via withTenant.
  const [{ id: patientUserId }] = await q(pool,
    `INSERT INTO public.users (id, email, first_name, last_name, role, status, practice_id)
     VALUES (gen_random_uuid(), $1, 'Pat', $2, 'patient', 'active', $3) RETURNING id`,
    [`pat_${slug}@example.com`, slug, practiceId]);
  await withTenant(pool, schema, (c) => c.query(
    `INSERT INTO patients (id, mrn, first_name, last_name, date_of_birth, status, practice_id)
     VALUES ($1, $2, 'Pat', $3, '1990-01-01', 'active', $4)`,
    [patientUserId, `MRN-${slug}`, slug, practiceId]));

  return { slug, schema, practiceId, userId, patientUserId };
}

(async () => {
  console.log('SEC-05 cross-tenant isolation test\n');
  try {
    // Clean any prior run.
    await pool.query(`DELETE FROM control.tenants WHERE slug IN ('t9a','t9b')`);
    await pool.query(`DROP SCHEMA IF EXISTS tenant_t9a CASCADE; DROP SCHEMA IF EXISTS tenant_t9b CASCADE;`);

    const A = await setupTenant('t9a', 'Alpha Clinic');
    const B = await setupTenant('t9b', 'Beta Clinic');

    // 1) Schema isolation: each tenant's req.db sees only its own patient.
    const dbA = makeTenantDb(pool, A.schema, fakeRes());
    const dbB = makeTenantDb(pool, B.schema, fakeRes());
    const aPatients = await q(dbA, `SELECT mrn FROM patients`);
    const bPatients = await q(dbB, `SELECT mrn FROM patients`);
    check('tenant A sees exactly its own patient', aPatients.length === 1 && aPatients[0].mrn === 'MRN-t9a');
    check('tenant B sees exactly its own patient', bPatients.length === 1 && bPatients[0].mrn === 'MRN-t9b');
    check('tenant A cannot see tenant B patient', !aPatients.some(r => r.mrn === 'MRN-t9b'));
    check('tenant B cannot see tenant A patient', !bPatients.some(r => r.mrn === 'MRN-t9a'));
    dbA.release(); dbB.release();

    // 2) resolveTenantForUser maps each staff user to the correct tenant schema.
    invalidateUserTenant(A.userId); invalidateUserTenant(B.userId);
    const tA = await resolveTenantForUser(pool, A.userId);
    const tB = await resolveTenantForUser(pool, B.userId);
    check('resolveTenantForUser(A) -> tenant_t9a', tA && tA.schemaName === 'tenant_t9a');
    check('resolveTenantForUser(B) -> tenant_t9b', tB && tB.schemaName === 'tenant_t9b');

    // 3) Identity scoping: users filtered by practice_id see only same-practice staff.
    const aUsers = await q(pool, `SELECT email FROM public.users WHERE practice_id = $1`, [A.practiceId]);
    const bUsers = await q(pool, `SELECT email FROM public.users WHERE practice_id = $1`, [B.practiceId]);
    check('users@practiceA excludes practiceB users',
      aUsers.some(u => u.email === 'staff_t9a@example.com') && !aUsers.some(u => u.email.includes('t9b')));
    check('users@practiceB excludes practiceA users',
      bUsers.some(u => u.email === 'staff_t9b@example.com') && !bUsers.some(u => u.email.includes('t9a')));

    // 4) No leak: after a withTenant(A) call releases, a plain pool query runs under the
    //    database default search_path (default tenant), not tenant A's.
    await withTenant(pool, A.schema, (c) => c.query('SELECT 1'));
    const sp = (await q(pool, `SHOW search_path`))[0].search_path;
    check('pool search_path is not pinned to tenant A after withTenant', !/tenant_t9a/.test(sp));

    // 5) Cross-tenant write attempt: writing via tenant A's db never lands in tenant B.
    const dbA2 = makeTenantDb(pool, A.schema, fakeRes());
    await dbA2.query(`INSERT INTO patients (id, mrn, first_name, last_name, date_of_birth, status, practice_id)
                      VALUES (gen_random_uuid(), 'MRN-t9a-2', 'X', 'Y', '1990-01-01', 'active', $1)`, [A.practiceId]);
    dbA2.release();
    const bAfter = await withTenant(pool, B.schema, (c) => c.query(`SELECT count(*)::int n FROM patients`));
    check('write via tenant A did not appear in tenant B', bAfter.rows[0].n === 1);

    // Cleanup
    await pool.query(`DELETE FROM control.tenants WHERE slug IN ('t9a','t9b')`);
    await pool.query(`DROP SCHEMA IF EXISTS tenant_t9a CASCADE; DROP SCHEMA IF EXISTS tenant_t9b CASCADE;`);
    await pool.query(`DELETE FROM public.users WHERE email LIKE '%t9a@example.com' OR email LIKE '%t9b@example.com'`);
    await pool.query(`DELETE FROM public.practices WHERE name IN ('Alpha Clinic','Beta Clinic')`);

    console.log(`\nPASS: ${passed} isolation checks green.`);
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error(`\n${err.message}`);
    console.error(err.stack);
    await pool.end().catch(() => {});
    process.exit(1);
  }
})();
