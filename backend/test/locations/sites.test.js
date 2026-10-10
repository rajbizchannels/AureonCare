// Sites (locations) — the tenant-scoped site entity added for multi-branch practices,
// departments and off-site events.
//
// The checks that matter most are not the CRUD ones. They are:
//   * a NEWLY provisioned tenant gets both the table and its primary row. The table comes
//     from control.tenant_tables + provision_schema; the row comes from
//     tenantProvisioning.js, because tenant/004 can never run for a schema that inherited
//     template's schema_migrations. Either half missing leaves a tenant with no default
//     site and no migration that will ever fix it.
//   * the primary site cannot be deleted or deactivated, and a referenced site cannot be
//     deleted at all — the FK is ON DELETE SET NULL, so a permitted delete would silently
//     detach history rather than fail.
//   * one tenant cannot see another's sites.

const path = require('path');
const crypto = require('crypto');

const BACKEND = path.join(__dirname, '..', '..');
const results = [];
const check = (name, cond) => results.push([name, !!cond]);

process.env.PORT = process.env.TEST_PORT || '4896';
process.env.NODE_ENV = 'development';
process.env.AC_COOKIE_INSECURE = 'true';
process.env.AC_RL_TEST_BYPASS = '1';
process.env.AC_JWT_S = process.env.AC_JWT_S || crypto.randomBytes(48).toString('base64');
const BASE = `http://127.0.0.1:${process.env.PORT}`;

const pool = require(path.join(BACKEND, 'db.js'));
const bcrypt = require(path.join(BACKEND, '..', 'node_modules', 'bcryptjs'));
const { provisionTenant } = require(path.join(BACKEND, 'services/tenantProvisioning.js'));
const {
  primaryLocationId, resolveLocationId, assertUsableLocation,
} = require(path.join(BACKEND, 'utils/locations.js'));

require(path.join(BACKEND, 'server.js'));

const api = async (method, url, body, headers = {}) => {
  const res = await fetch(BASE + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* empty */ }
  return { status: res.status, body: json };
};

const PW = 'A-Strong-Passphrase!23';
const auth = (t) => ({ Authorization: `Bearer ${t}` });

/**
 * A query runner pinned to one tenant schema, for the DB-level assertions.
 *
 * The pin has to be inside a transaction: db.js opens every pooled connection with
 * `options: '-c search_path=public'`, so a bare `SET LOCAL` outside a transaction block
 * is a no-op and tenant tables then fail to resolve against public. Same reasoning as
 * db/requestTenantDb.js.
 */
const tenantSql = (schema) => async (text, params) => {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query(`SET LOCAL search_path TO ${schema}, public, control`);
    const out = await c.query(text, params);
    await c.query('COMMIT');
    return out;
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally { c.release(); }
};

/** Same, but inside a transaction the caller can roll back. */
const inRolledBackTx = async (schema, fn) => {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query(`SET LOCAL search_path TO ${schema}, public, control`);
    return await fn(c);
  } finally {
    await c.query('ROLLBACK').catch(() => {});
    c.release();
  }
};

(async () => {
  for (let i = 0; i < 40; i++) {
    try { await fetch(BASE + '/health'); break; } catch { await new Promise((r) => setTimeout(r, 250)); }
  }
  console.log('\nSites (locations)\n');

  const RUN = crypto.randomBytes(4).toString('hex');

  const mkPractice = async (label) => {
    const { practiceId, tenant } = await provisionTenant(pool, {
      name: `Sites ${label} ${RUN}`, country: 'GB', timezone: 'Europe/London',
    });
    const email = `admin_${label}_${RUN}@sites-${RUN}.example`;
    const hash = await bcrypt.hash(PW, 12);
    await pool.query(
      `INSERT INTO public.users (id,email,first_name,last_name,role,status,password_hash,practice_id,created_at)
       VALUES (gen_random_uuid(),$1,'Ada','Admin','admin','active',$2,$3,NOW())`,
      [email, hash, practiceId]
    );
    const login = await api('POST', '/api/auth/login', { email, password: PW });
    return {
      practiceId, schema: tenant.schema_name, email,
      token: login.body && login.body.token,
      sql: tenantSql(tenant.schema_name),
    };
  };

  const A = await mkPractice('A');
  const B = await mkPractice('B');
  check('practice admins can sign in', Boolean(A.token) && Boolean(B.token));

  // ── Provisioning: table AND row ────────────────────────────────────────────
  const tableHere = await pool.query('SELECT to_regclass($1) IS NOT NULL AS ok', [`${A.schema}.locations`]);
  check('a newly provisioned tenant has the locations table', tableHere.rows[0].ok === true);

  const seeded = await A.sql('SELECT * FROM locations');
  check('provisioning seeds exactly one site', seeded.rows.length === 1);
  check('the seeded site is primary and active',
    seeded.rows[0] && seeded.rows[0].is_primary === true && seeded.rows[0].is_active === true);
  check('the seeded site is named after the practice',
    seeded.rows[0] && seeded.rows[0].name === `Sites A ${RUN}`);
  check('the seeded site carries the practice country/timezone',
    seeded.rows[0] && seeded.rows[0].country === 'GB' && seeded.rows[0].timezone === 'Europe/London');
  check('the seeded site is of type clinic',
    seeded.rows[0] && seeded.rows[0].location_type === 'clinic');

  // ── Reads ──────────────────────────────────────────────────────────────────
  const list = await api('GET', '/api/locations', undefined, auth(A.token));
  check('GET /api/locations returns the tenant site', list.status === 200 && list.body.length === 1);
  check('the list is camelCased', list.body[0] && 'isPrimary' in list.body[0] && 'locationType' in list.body[0]);

  const primary = await api('GET', '/api/locations/primary', undefined, auth(A.token));
  check('GET /api/locations/primary resolves the default site',
    primary.status === 200 && primary.body.id === seeded.rows[0].id);

  const anon = await api('GET', '/api/locations');
  check('sites are not readable without authentication', anon.status === 401);

  // ── Validation ─────────────────────────────────────────────────────────────
  const noName = await api('POST', '/api/locations', { name: '   ' }, auth(A.token));
  check('a blank name is rejected', noName.status === 400);

  const badType = await api('POST', '/api/locations',
    { name: 'Nonsense', locationType: 'spaceship' }, auth(A.token));
  check('an unknown site type is rejected with 400, not 500', badType.status === 400);
  check('the rejection names the allowed types',
    badType.body && /clinic/.test(badType.body.error || ''));

  const badCountry = await api('POST', '/api/locations',
    { name: 'Nonsense', country: 'GBR' }, auth(A.token));
  check('a 3-letter country code is rejected', badCountry.status === 400);

  const badLat = await api('POST', '/api/locations',
    { name: 'Nonsense', latitude: 120 }, auth(A.token));
  check('an out-of-range latitude is rejected', badLat.status === 400);

  // ── Authorization ──────────────────────────────────────────────────────────
  const staffEmail = `staff_${RUN}@sites-${RUN}.example`;
  await pool.query(
    `INSERT INTO public.users (id,email,first_name,last_name,role,status,password_hash,practice_id,created_at)
     VALUES (gen_random_uuid(),$1,'Sam','Staff','staff','active',$2,$3,NOW())`,
    [staffEmail, await bcrypt.hash(PW, 12), A.practiceId]
  );
  const staffLogin = await api('POST', '/api/auth/login', { email: staffEmail, password: PW });
  const staffToken = staffLogin.body && staffLogin.body.token;

  const staffRead = await api('GET', '/api/locations', undefined, auth(staffToken));
  check('a non-admin can READ sites (scheduling needs the list)', staffRead.status === 200);

  const staffWrite = await api('POST', '/api/locations', { name: 'Sneaky' }, auth(staffToken));
  check('a non-admin cannot create a site', staffWrite.status === 403);

  const staffPrimary = await api('POST', `/api/locations/${seeded.rows[0].id}/make-primary`, {}, auth(staffToken));
  check('a non-admin cannot change the primary site', staffPrimary.status === 403);

  // ── Create ─────────────────────────────────────────────────────────────────
  const camp = await api('POST', '/api/locations', {
    name: 'Riverside Camp', locationType: 'camp', city: 'Leeds', country: 'GB',
    timezone: 'Europe/London', latitude: 53.8, longitude: -1.55,
  }, auth(A.token));
  check('an admin can add a camp venue', camp.status === 201);
  check('a new site is NOT primary implicitly', camp.body && camp.body.isPrimary === false);
  check('a new site is active by default', camp.body && camp.body.isActive === true);

  const branch = await api('POST', '/api/locations',
    { name: 'North Branch', locationType: 'clinic' }, auth(A.token));
  check('an admin can add a second clinic', branch.status === 201);

  // ── Tenant isolation ───────────────────────────────────────────────────────
  const crossList = await api('GET', '/api/locations', undefined, auth(B.token));
  check('practice B sees only its own site',
    crossList.status === 200 && crossList.body.length === 1
    && crossList.body[0].name === `Sites B ${RUN}`);

  const crossGet = await api('GET', `/api/locations/${camp.body.id}`, undefined, auth(B.token));
  check("practice B cannot fetch practice A's site by id", crossGet.status === 404);

  const crossDelete = await api('DELETE', `/api/locations/${camp.body.id}`, undefined, auth(B.token));
  check("practice B cannot delete practice A's site", crossDelete.status === 404);

  // ── Primary-site invariants ────────────────────────────────────────────────
  const delPrimary = await api('DELETE', `/api/locations/${seeded.rows[0].id}`, undefined, auth(A.token));
  check('the primary site cannot be deleted', delPrimary.status === 409);
  check('the refusal says why', delPrimary.body && delPrimary.body.error === 'PrimaryLocationRequired');

  const deactPrimary = await api('PUT', `/api/locations/${seeded.rows[0].id}`,
    { isActive: false }, auth(A.token));
  check('the primary site cannot be deactivated', deactPrimary.status === 409);
  check('that refusal says why too',
    deactPrimary.body && deactPrimary.body.error === 'PrimaryLocationRequired');

  const promote = await api('POST', `/api/locations/${branch.body.id}/make-primary`, {}, auth(A.token));
  check('an admin can promote another site to primary', promote.status === 200);
  check('the promoted site is primary', promote.body && promote.body.isPrimary === true);

  const primaries = await A.sql('SELECT count(*)::int AS n FROM locations WHERE is_primary');
  check('exactly one site is primary after promotion', primaries.rows[0].n === 1);

  const nowPrimary = await api('GET', '/api/locations/primary', undefined, auth(A.token));
  check('the primary lookup follows the promotion',
    nowPrimary.status === 200 && nowPrimary.body.id === branch.body.id);

  // The original site is no longer primary, so it may now be deactivated.
  const deactOld = await api('PUT', `/api/locations/${seeded.rows[0].id}`,
    { isActive: false }, auth(A.token));
  check('a demoted site can be deactivated', deactOld.status === 200 && deactOld.body.isActive === false);

  const activeList = await api('GET', '/api/locations', undefined, auth(A.token));
  check('deactivated sites are hidden by default',
    activeList.status === 200 && !activeList.body.some((l) => l.id === seeded.rows[0].id));

  const allList = await api('GET', '/api/locations?includeInactive=true', undefined, auth(A.token));
  check('includeInactive reveals them',
    allList.status === 200 && allList.body.some((l) => l.id === seeded.rows[0].id));

  const typeFilter = await api('GET', '/api/locations?type=camp', undefined, auth(A.token));
  check('the type filter works',
    typeFilter.status === 200 && typeFilter.body.length === 1 && typeFilter.body[0].locationType === 'camp');

  const promoteInactive = await api('POST', `/api/locations/${seeded.rows[0].id}/make-primary`, {}, auth(A.token));
  check('a deactivated site cannot be made primary', promoteInactive.status === 409);
  check('and it says which rule was hit',
    promoteInactive.body && promoteInactive.body.error === 'LocationInactive');

  // ── Referenced sites ───────────────────────────────────────────────────────
  // An appointment at the camp venue. patient_id/provider_id are nullable, so this needs
  // no fixture patient.
  await A.sql(
    `INSERT INTO appointments (id, practice_id, start_time, end_time, status, location_id)
     VALUES (gen_random_uuid(), $1, NOW(), NOW() + interval '30 minutes', 'scheduled', $2)`,
    [A.practiceId, camp.body.id]
  );

  const delReferenced = await api('DELETE', `/api/locations/${camp.body.id}`, undefined, auth(A.token));
  check('a referenced site cannot be deleted', delReferenced.status === 409);
  check('the refusal is LocationInUse',
    delReferenced.body && delReferenced.body.error === 'LocationInUse');
  check('the refusal names what references it',
    delReferenced.body && Array.isArray(delReferenced.body.references)
    && delReferenced.body.references.some((r) => r.label === 'appointments' && r.count === 1));

  // An unreferenced, non-primary site deletes cleanly.
  const scratch = await api('POST', '/api/locations',
    { name: 'Scratch Venue', locationType: 'mobile' }, auth(A.token));
  const delScratch = await api('DELETE', `/api/locations/${scratch.body.id}`, undefined, auth(A.token));
  check('an unreferenced non-primary site can be deleted', delScratch.status === 200);
  const goneCheck = await api('GET', `/api/locations/${scratch.body.id}`, undefined, auth(A.token));
  check('and it is really gone', goneCheck.status === 404);

  // ── Database-level invariants ──────────────────────────────────────────────
  await inRolledBackTx(A.schema, async (c) => {
    let err = null;
    try {
      await c.query("INSERT INTO locations (name, is_primary) VALUES ('Rival Primary', true)");
    } catch (e) { err = e.code; }
    check('the database refuses a second primary site (23505)', err === '23505');
  });

  await inRolledBackTx(A.schema, async (c) => {
    let err = null;
    try {
      await c.query("INSERT INTO locations (name, location_type) VALUES ('Bad', 'spaceship')");
    } catch (e) { err = e.code; }
    check('the database refuses an unknown site type (23514)', err === '23514');
  });

  await inRolledBackTx(A.schema, async (c) => {
    // The FK is ON DELETE SET NULL by design: removing a site must never cascade into
    // clinical history. The route refuses such a delete; this proves the fallback is
    // detachment, not deletion.
    await c.query('DELETE FROM locations WHERE id = $1', [camp.body.id]);
    const { rows } = await c.query(
      'SELECT location_id FROM appointments WHERE practice_id = $1 AND location_id IS NULL', [A.practiceId]
    );
    check('deleting a site sets referencing rows to NULL, never deletes them', rows.length === 1);
  });

  // ── Helper semantics ───────────────────────────────────────────────────────
  {
    const db = { query: A.sql };
    const pid = await primaryLocationId(db);
    check('primaryLocationId returns the current primary', pid === branch.body.id);
    check('resolveLocationId passes an explicit id through',
      (await resolveLocationId(db, camp.body.id)) === camp.body.id);
    check('resolveLocationId falls back to the primary when null',
      (await resolveLocationId(db, null)) === branch.body.id);

    let notFound = null;
    try { await assertUsableLocation(db, crypto.randomUUID()); } catch (e) { notFound = e.code; }
    check('assertUsableLocation reports an unknown site', notFound === 'LocationNotFound');

    let inactive = null;
    try { await assertUsableLocation(db, seeded.rows[0].id); } catch (e) { inactive = e.code; }
    check('assertUsableLocation reports a deactivated site', inactive === 'LocationInactive');
  }

  // ── Backfill of the configuration tables ───────────────────────────────────
  // tenant/005 backfills clinic_working_hours and doctor_availability; rows created after
  // the migration are the application's responsibility, so only the migration's own
  // statement is asserted here, against a row inserted the way the migration saw them.
  await inRolledBackTx(A.schema, async (c) => {
    await c.query(
      "INSERT INTO clinic_working_hours (day, is_working, start_time, end_time) VALUES ('monday', true, '09:00', '17:00')"
    );
    const { rowCount } = await c.query(
      `UPDATE clinic_working_hours
          SET location_id = (SELECT id FROM locations WHERE is_primary LIMIT 1)
        WHERE location_id IS NULL
          AND EXISTS (SELECT 1 FROM locations WHERE is_primary)`
    );
    check("the migration's backfill statement attributes rows to the primary site", rowCount === 1);
  });

  // ── Report ─────────────────────────────────────────────────────────────────
  let pass = 0;
  for (const [name, ok] of results) {
    console.log(`  ${ok ? 'ok ' : 'FAIL'}  ${name}`);
    if (ok) pass++;
  }
  console.log(`\n${pass}/${results.length} checks passed.`);
  await pool.end();
  process.exit(pass === results.length ? 0 : 1);
})().catch((err) => {
  console.error('harness error:', err);
  process.exit(1);
});
