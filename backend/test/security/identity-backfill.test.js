// SEC-05 deploy step: scripts/backfill-portal-identities.js.
//
// A portal patient registered before AC_IDX_K was set has no identity route, so password
// login only searches the default practice and fails — and since only a successful login
// (or enabling the portal) writes the route, it never fixes itself. This builds exactly
// that patient, shows the login failing, runs the backfill, and shows it succeeding.

const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const BACKEND = path.join(__dirname, '..', '..');
process.env.PORT = process.env.TEST_PORT || '4877';
process.env.NODE_ENV = 'development';
process.env.AC_JWT_S = process.env.AC_JWT_S || crypto.randomBytes(48).toString('base64');
process.env.AC_TK_S = process.env.AC_TK_S || process.env.AC_JWT_S;
process.env.AC_IDX_K = process.env.AC_IDX_K || crypto.randomBytes(32).toString('base64');
const BASE = `http://127.0.0.1:${process.env.PORT}`;

const pool = require(path.join(BACKEND, 'db.js'));
const bcrypt = require(path.join(BACKEND, '..', 'node_modules', 'bcryptjs'));
const { provisionTenant } = require(path.join(BACKEND, 'services/tenantProvisioning.js'));
const { emailHmac } = require(path.join(BACKEND, 'utils/blindIndex.js'));
require(path.join(BACKEND, 'server.js'));

const results = [];
const check = (n, c) => results.push([n, !!c]);
const login = async (email, password) => {
  const r = await fetch(BASE + '/api/patient-portal/login', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  return r.status;
};
const report = (err) => {
  let failed = 0;
  for (const [n, c] of results) { console.log(`  ${c ? 'ok  ' : 'FAIL'} ${n}`); if (!c) failed += 1; }
  if (err) { console.error(`\nSTOPPED: ${err.message || err}`); console.error(err); }
  else console.log(`\n${results.length - failed}/${results.length} checks passed.`);
  process.exit(err || failed ? 1 : 0);
};

(async () => {
  for (let i = 0; i < 40; i++) { try { await fetch(BASE + '/health'); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  const RUN = crypto.randomBytes(4).toString('hex');
  const PW = 'A-Strong-Passphrase!23';
  const t = await provisionTenant(pool, { name: `Backfill ${RUN}` });
  const email = `Late.Patient_${RUN}@Example.com`;          // mixed case: matching is case-insensitive
  const pid = crypto.randomUUID();
  await pool.query(`INSERT INTO public.users (id,email,first_name,last_name,role,status,practice_id,created_at)
    VALUES ($1,$2,'Late','Patient','patient','active',$3,NOW())`, [pid, email.toLowerCase(), t.practiceId]);
  // Portal enabled directly in the practice's schema — no identity route, exactly as a
  // patient enabled before AC_IDX_K existed.
  await pool.query(`INSERT INTO ${t.tenant.schema_name}.patients
      (id, first_name, last_name, status, mrn, date_of_birth, email, portal_enabled, portal_password_hash)
    VALUES ($1,'Late','Patient','Active',$2,'1975-05-05',$3,true,$4)`,
    [pid, `MRN-${RUN}`, email, await bcrypt.hash(PW, 12)]);
  check('the patient has no identity route yet',
    (await pool.query('SELECT 1 FROM control.portal_identity_route WHERE email_hmac = $1 AND tenant_id = $2',
      [emailHmac(email), t.tenant.id])).rowCount === 0);
  check('...SO THEIR PORTAL LOGIN FAILS (the stuck state)', (await login(email, PW)) === 401);

  const script = path.join(BACKEND, 'scripts', 'backfill-portal-identities.js');
  const dry = execFileSync(process.execPath, [script, '--dry-run'], { env: process.env, encoding: 'utf8' });
  check('a dry run reports what it would do', /Would register \d+ identity route/.test(dry));
  check('...and writes nothing',
    (await pool.query('SELECT 1 FROM control.portal_identity_route WHERE email_hmac = $1', [emailHmac(email)])).rowCount === 0);

  const out = execFileSync(process.execPath, [script], { env: process.env, encoding: 'utf8' });
  check('the backfill completes', /Registered \d+ identity route/.test(out));
  check('the route now exists for this practice',
    (await pool.query('SELECT 1 FROM control.portal_identity_route WHERE email_hmac = $1 AND tenant_id = $2',
      [emailHmac(email), t.tenant.id])).rowCount === 1);
  check('AFTER THE BACKFILL THE SAME LOGIN SUCCEEDS', (await login(email, PW)) === 200);
  check('...with the address typed in any case', (await login(email.toUpperCase(), PW)) === 200);
  check('a wrong password is still refused', (await login(email, 'Wrong-Passphrase!99')) === 401);

  // Re-running is safe.
  execFileSync(process.execPath, [script], { env: process.env, encoding: 'utf8' });
  check('re-running does not duplicate routes',
    (await pool.query('SELECT count(*)::int AS n FROM control.portal_identity_route WHERE email_hmac = $1', [emailHmac(email)])).rows[0].n === 1);

  // Without the key it refuses rather than writing hashes nobody can match.
  let refused = false;
  try { execFileSync(process.execPath, [script], { env: { ...process.env, AC_IDX_K: '' }, encoding: 'utf8', stdio: 'pipe' }); }
  catch (e) { refused = e.status === 1; }
  check('without AC_IDX_K the script refuses to run', refused);

  report();
})().catch(report);
