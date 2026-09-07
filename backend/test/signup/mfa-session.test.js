// Two-factor authentication and the session idle timeout.
//
// These replace a hardcoded "Enabled" badge and a dropdown wired to nothing, so the point
// of this suite is to show the controls actually do something. The checks are adversarial:
// a wrong code, a replayed backup code, disabling with only a stolen session, an admin
// locking themselves out, and a session that has gone quiet for too long.

const path = require('path');
const crypto = require('crypto');
const speakeasy = require('speakeasy');

const BACKEND = path.join(__dirname, '..', '..');
const results = [];
const check = (name, cond) => results.push([name, !!cond]);

const pool = require(path.join(BACKEND, 'db.js'));
const bcrypt = require(path.join(BACKEND, '..', 'node_modules', 'bcryptjs'));
const { provisionTenant } = require(path.join(BACKEND, 'services/tenantProvisioning.js'));

process.env.PORT = process.env.TEST_PORT || '4896';
process.env.NODE_ENV = 'development';
process.env.AC_COOKIE_INSECURE = 'true';
process.env.AC_JWT_S = process.env.AC_JWT_S || crypto.randomBytes(48).toString('base64');
const BASE = `http://127.0.0.1:${process.env.PORT}`;

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
const codeFor = (secret) => speakeasy.totp({ secret, encoding: 'base32' });

(async () => {
  for (let i = 0; i < 40; i++) {
    try { await fetch(BASE + '/health'); break; } catch { await new Promise((r) => setTimeout(r, 250)); }
  }
  console.log('\nTwo-factor authentication and session idle timeout\n');

  const RUN = crypto.randomBytes(4).toString('hex');
  const { practiceId } = await provisionTenant(pool, { name: `MFA Clinic ${RUN}` });
  const hash = await bcrypt.hash(PW, 12);

  const mkUser = async (label, role) => {
    const email = `${label}_${RUN}@example.com`;
    const { rows } = await pool.query(
      `INSERT INTO public.users (id,email,first_name,last_name,role,status,password_hash,practice_id,created_at)
       VALUES (gen_random_uuid(),$1,'Test','User',$2,'active',$3,$4,NOW()) RETURNING id`,
      [email, role, hash, practiceId]
    );
    return { id: rows[0].id, email };
  };
  const admin = await mkUser('admin', 'admin');
  const doctor = await mkUser('doc', 'doctor');
  const auth = (t) => ({ Authorization: `Bearer ${t}` });

  const login = async (email, extra = {}) => api('POST', '/api/auth/login', { email, password: PW, ...extra });

  const docLogin = await login(doctor.email);
  check('a user without 2FA signs in normally', docLogin.status === 200);
  let docToken = docLogin.body.token;

  const status0 = await api('GET', '/api/auth/mfa/status', undefined, auth(docToken));
  check('status reports 2FA off before enrolment', status0.body && status0.body.enabled === false);

  // ── Enrolment ──────────────────────────────────────────────────────────────
  const enrol = await api('POST', '/api/auth/mfa/enroll', {}, auth(docToken));
  check('enrolment returns a base32 key', Boolean(enrol.body && enrol.body.base32));
  check('the key is valid base32 (no illegal characters for an authenticator app)',
    /^[A-Z2-7]+=*$/.test(enrol.body.base32));
  check('enrolment returns a scannable QR', Boolean(enrol.body.qrDataUrl
    && enrol.body.qrDataUrl.startsWith('data:image/')));
  const secret = enrol.body.base32;

  const stillOff = await api('GET', '/api/auth/mfa/status', undefined, auth(docToken));
  check('starting enrolment does NOT enable 2FA on its own',
    stillOff.body && stillOff.body.enabled === false);
  const loginMidEnrol = await login(doctor.email);
  check('an abandoned enrolment does not lock the account out', loginMidEnrol.status === 200);

  const badVerify = await api('POST', '/api/auth/mfa/verify', { code: '000000' }, auth(docToken));
  check('a wrong code does not enable 2FA', badVerify.status === 400);

  const verify = await api('POST', '/api/auth/mfa/verify', { code: codeFor(secret) }, auth(docToken));
  check('a correct code enables 2FA', verify.status === 200 && verify.body.enabled === true);
  check('recovery codes are issued', Array.isArray(verify.body.backupCodes)
    && verify.body.backupCodes.length === 10);
  const backupCodes = verify.body.backupCodes;

  const reEnrol = await api('POST', '/api/auth/mfa/enroll', {}, auth(docToken));
  check('re-enrolling while enabled is refused', reEnrol.status === 409);

  // ── Login now demands the second factor ────────────────────────────────────
  const noCode = await login(doctor.email);
  check('password alone is no longer enough', noCode.status === 401);
  check('and the client is told a code is needed', noCode.body && noCode.body.mfaRequired === true);

  const wrongCode = await login(doctor.email, { mfaCode: '000000' });
  check('a wrong code is refused', wrongCode.status === 401);

  const wrongPw = await api('POST', '/api/auth/login',
    { email: doctor.email, password: 'not-the-password', mfaCode: codeFor(secret) });
  check('a valid code does not rescue a wrong password', wrongPw.status === 401);
  check('and the failure does not admit the account exists',
    wrongPw.body && !wrongPw.body.mfaRequired);

  const good = await login(doctor.email, { mfaCode: codeFor(secret) });
  check('password plus code signs in', good.status === 200);
  docToken = good.body.token;
  check('the response never carries the TOTP secret',
    !JSON.stringify(good.body).includes(secret));

  // ── Recovery codes ─────────────────────────────────────────────────────────
  const viaBackup = await login(doctor.email, { mfaCode: backupCodes[0] });
  check('a recovery code works in place of the app', viaBackup.status === 200);

  const replay = await login(doctor.email, { mfaCode: backupCodes[0] });
  check('the same recovery code cannot be used twice', replay.status === 401);

  const stillWorks = await login(doctor.email, { mfaCode: backupCodes[1] });
  check('the other recovery codes still work', stillWorks.status === 200);
  docToken = stillWorks.body.token;

  const { rows: stored } = await pool.query('SELECT mfa_backup_codes FROM users WHERE id = $1', [doctor.id]);
  check('recovery codes are stored hashed, not in plain text',
    stored[0].mfa_backup_codes.every((c) => /^[0-9a-f]{64}$/.test(c))
    && !stored[0].mfa_backup_codes.includes(backupCodes[2]));

  const regen = await api('POST', '/api/auth/mfa/backup-codes',
    { code: codeFor(secret) }, auth(docToken));
  check('recovery codes can be regenerated with a current code', regen.status === 200);
  const oldCode = await login(doctor.email, { mfaCode: backupCodes[3] });
  check('regenerating invalidates the old recovery codes', oldCode.status === 401);
  const regenNoCode = await api('POST', '/api/auth/mfa/backup-codes', {}, auth(docToken));
  check('a session alone cannot mint new recovery codes', regenNoCode.status === 401);

  // ── Disabling ──────────────────────────────────────────────────────────────
  const sessionOnly = await api('POST', '/api/auth/mfa/disable', {}, auth(docToken));
  check('a stolen session alone cannot turn 2FA off', sessionOnly.status === 401);

  const noSecondFactor = await api('POST', '/api/auth/mfa/disable', { password: PW }, auth(docToken));
  check('the password alone cannot turn 2FA off', noSecondFactor.status === 401);

  const wrongPwDisable = await api('POST', '/api/auth/mfa/disable',
    { password: 'wrong', code: codeFor(secret) }, auth(docToken));
  check('a wrong password cannot turn 2FA off', wrongPwDisable.status === 401);

  // ── Practice policy: require MFA ───────────────────────────────────────────
  const adminLogin = await login(admin.email);
  const adminToken = adminLogin.body.token;

  const lockout = await api('PATCH', '/api/team-access/security-policy',
    { requireMfa: true }, auth(adminToken));
  check('requiring 2FA is refused while an admin has none', lockout.status === 409);
  check('and it names the administrators who would be locked out',
    Array.isArray(lockout.body.administratorsWithout)
    && lockout.body.administratorsWithout.includes(admin.email));

  // Enrol the admin, then the policy may be enabled.
  const aEnrol = await api('POST', '/api/auth/mfa/enroll', {}, auth(adminToken));
  await api('POST', '/api/auth/mfa/verify', { code: codeFor(aEnrol.body.base32) }, auth(adminToken));
  const adminAfter = await login(admin.email, { mfaCode: codeFor(aEnrol.body.base32) });
  const adminToken2 = adminAfter.body.token;

  const required = await api('PATCH', '/api/team-access/security-policy',
    { requireMfa: true }, auth(adminToken2));
  check('requiring 2FA succeeds once administrators are covered', required.status === 200);

  const cantDisable = await api('POST', '/api/auth/mfa/disable',
    { password: PW, code: codeFor(secret) }, auth(docToken));
  check('a user cannot opt out of a practice-wide 2FA requirement', cantDisable.status === 403);

  // A user with no second factor is refused under the policy, and told to enrol.
  const bare = await mkUser('bare', 'nurse');
  const bareLogin = await login(bare.email);
  check('an account without 2FA is refused when the practice requires it', bareLogin.status === 403);
  check('and is told to enrol rather than left guessing',
    bareLogin.body && bareLogin.body.mfaEnrolmentRequired === true);

  await api('PATCH', '/api/team-access/security-policy', { requireMfa: false }, auth(adminToken2));

  // ── Session idle timeout ───────────────────────────────────────────────────
  const badTimeout = await api('PATCH', '/api/team-access/security-policy',
    { sessionIdleMinutes: 2 }, auth(adminToken2));
  check('an unusably short idle timeout is refused', badTimeout.status === 400);
  const hugeTimeout = await api('PATCH', '/api/team-access/security-policy',
    { sessionIdleMinutes: 99999 }, auth(adminToken2));
  check('an absurdly long idle timeout is refused', hugeTimeout.status === 400);

  const setTimeout15 = await api('PATCH', '/api/team-access/security-policy',
    { sessionIdleMinutes: 15 }, auth(adminToken2));
  check('a sane idle timeout is accepted',
    setTimeout15.status === 200 && setTimeout15.body.sessionIdleMinutes === 15);

  const active = await api('GET', '/api/auth/mfa/status', undefined, auth(docToken));
  check('an active session keeps working', active.status === 200);

  // Backdate the activity stamp past the limit: the same token must stop being accepted
  // without anything else changing.
  await pool.query(
    "UPDATE users SET last_activity_at = now() - interval '16 minutes' WHERE id = $1", [doctor.id]);
  const timedOut = await api('GET', '/api/auth/mfa/status', undefined, auth(docToken));
  check('a session idle past the limit is rejected', timedOut.status === 401);
  check('and says so, rather than looking like a broken login',
    timedOut.body && timedOut.body.sessionTimedOut === true);

  // Just inside the limit is fine — the boundary is a timeout, not a token expiry.
  await pool.query(
    "UPDATE users SET last_activity_at = now() - interval '14 minutes' WHERE id = $1", [doctor.id]);
  const stillIn = await api('GET', '/api/auth/mfa/status', undefined, auth(docToken));
  check('a session inside the limit still works', stillIn.status === 200);

  // Activity refreshes the clock, so continuous work is never interrupted.
  const { rows: act } = await pool.query('SELECT last_activity_at FROM users WHERE id = $1', [doctor.id]);
  check('activity refreshes the idle clock',
    Date.now() - new Date(act[0].last_activity_at).getTime() < 60_000);

  const cleared = await api('PATCH', '/api/team-access/security-policy',
    { sessionIdleMinutes: null }, auth(adminToken2));
  check('the idle timeout can be switched off', cleared.body && cleared.body.sessionIdleMinutes === null);
  const noLimit = await api('GET', '/api/auth/mfa/status', undefined, auth(docToken));
  check('with no limit set, an old session is accepted again', noLimit.status === 200);

  // ── Authorisation ──────────────────────────────────────────────────────────
  const docPolicy = await api('GET', '/api/team-access/security-policy', undefined, auth(docToken));
  check('a non-admin cannot read the security policy', docPolicy.status === 403);
  const docSet = await api('PATCH', '/api/team-access/security-policy',
    { sessionIdleMinutes: 60 }, auth(docToken));
  check('a non-admin cannot change the security policy', docSet.status === 403);
  const anonEnrol = await api('POST', '/api/auth/mfa/enroll', {});
  check('enrolment requires authentication', anonEnrol.status === 401);

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
