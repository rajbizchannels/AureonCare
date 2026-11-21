// Sign-in lockout after 4 wrong passwords, unlocking, and the sign-in rate limit.
//
// Runs WITHOUT the rate-limit test bypass, so the real per-IP limiter is in play: it must
// count only credential attempts — page loads (/api/auth/me) and the practice switcher
// (/api/auth/memberships) used to use up the allowance and then refuse real sign-ins.

const path = require('path');
const crypto = require('crypto');

const BACKEND = path.join(__dirname, '..', '..');
process.env.PORT = process.env.TEST_PORT || '4885';
process.env.NODE_ENV = 'development';
delete process.env.AC_RL_TEST_BYPASS;
process.env.AC_JWT_S = process.env.AC_JWT_S || crypto.randomBytes(48).toString('base64');
process.env.AC_TK_S = process.env.AC_TK_S || process.env.AC_JWT_S;
process.env.AC_IDX_K = process.env.AC_IDX_K || crypto.randomBytes(32).toString('base64');
process.env.AC_PW_BREACH_CHECK = 'false';
process.env.FRONTEND_URL = 'https://app.example.test';
const BASE = `http://127.0.0.1:${process.env.PORT}`;

const outbox = [];
const notify = require(path.join(BACKEND, 'services/notificationService.js'));
notify.sendEmail = async (to, subject, html) => { outbox.push({ to, subject, html }); return { sent: true }; };

const pool = require(path.join(BACKEND, 'db.js'));
const { expandLink, firstLinkIn, tokenOf } = require(path.join(__dirname, '..', 'helpers', 'links.js'));
const bcrypt = require(path.join(BACKEND, '..', 'node_modules', 'bcryptjs'));
const { provisionTenant } = require(path.join(BACKEND, 'services/tenantProvisioning.js'));
require(path.join(BACKEND, 'server.js'));

const results = [];
const check = (n, c) => results.push([n, !!c]);
const obj = (v) => v || {};
const api = async (method, url, { body, token } = {}) => {
  const r = await fetch(BASE + url, { method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text(); let b = null; try { b = JSON.parse(t); } catch { b = t; }
  return { status: r.status, body: b };
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
  const t = await provisionTenant(pool, { name: `Lock ${RUN}` });
  const mk = async (role) => {
    const email = `${role}_${RUN}@example.com`;
    const { rows: [u] } = await pool.query(`INSERT INTO public.users (id,email,first_name,last_name,role,status,password_hash,practice_id,created_at)
      VALUES (gen_random_uuid(),$1,'Ada',$2,$3,'active',$4,$5,NOW()) RETURNING id`, [email, role, role, await bcrypt.hash(PW, 12), t.practiceId]);
    return { id: u.id, email };
  };
  const admin = await mk('admin'); const nurse = await mk('nurse'); const doc = await mk('doctor');
  const login = (email, password) => api('POST', '/api/auth/login', { body: { email, password } });
  const adminTok = obj((await login(admin.email, PW)).body).token;
  const nurseTok = obj((await login(nurse.email, PW)).body).token;
  check('admin and nurse sign in', Boolean(adminTok && nurseTok));

  // ── the rate limit no longer counts page loads ───────────────────────────────────
  for (let i = 0; i < 40; i++) await api('GET', '/api/auth/me', { token: adminTok });
  for (let i = 0; i < 15; i++) await api('GET', '/api/auth/memberships', { token: adminTok });
  const afterLoads = await login(doc.email, PW);
  check(`55 page-load auth calls later, sign-in still works (got ${afterLoads.status})`, afterLoads.status === 200);

  // ── lockout ──────────────────────────────────────────────────────────────────────
  const w1 = await login(doc.email, 'wrong-1'); const w2 = await login(doc.email, 'wrong-2');
  check('wrong passwords 1 and 2 -> 401', w1.status === 401 && w2.status === 401);
  const w3 = await login(doc.email, 'wrong-3');
  check('the 3rd says one attempt is left', w3.status === 401 && /1 attempt left/.test(obj(w3.body).error));
  const w4 = await login(doc.email, 'wrong-4');
  check(`THE 4TH WRONG PASSWORD LOCKS THE ACCOUNT (got ${w4.status})`, w4.status === 423 && obj(w4.body).locked === true && /locked for 15 minutes/.test(obj(w4.body).error));
  const right = await login(doc.email, PW);
  check('...even the right password is refused while locked', right.status === 423);
  check('...the stored row holds no email address',
    (await pool.query(`SELECT 1 FROM public.login_lockouts WHERE key_hash LIKE '%@%'`)).rowCount === 0);

  // An address with no account behaves exactly the same, so the lock reveals nothing.
  const ghost = `nobody_${RUN}@example.com`;
  const g = [];
  for (let i = 0; i < 4; i++) g.push((await login(ghost, 'x')).status);
  check(`an unknown address locks the same way (${g.join(',')})`, g.join(',') === '401,401,401,423');

  // ── admins see and clear it ──────────────────────────────────────────────────────
  const list = await api('GET', '/api/users', { token: adminTok });
  const row = (list.body || []).find((u) => u.id === doc.id);
  check('User Management shows the doctor as locked', row && row.locked === true);
  check('...and the admin as not locked', ((list.body || []).find((u) => u.id === admin.id) || {}).locked === false);
  check('a nurse cannot unlock (403)', (await api('POST', `/api/users/${doc.id}/unlock`, { token: nurseTok })).status === 403);
  const other = await provisionTenant(pool, { name: `Other ${RUN}` });
  const oEmail = `oadmin_${RUN}@example.com`;
  await pool.query(`INSERT INTO public.users (id,email,first_name,last_name,role,status,password_hash,practice_id,created_at)
    VALUES (gen_random_uuid(),$1,'O','A','admin','active',$2,$3,NOW())`, [oEmail, await bcrypt.hash(PW, 12), other.practiceId]);
  const oTok = obj((await login(oEmail, PW)).body).token;
  check('another practice\'s admin cannot unlock (404)', (await api('POST', `/api/users/${doc.id}/unlock`, { token: oTok })).status === 404);
  const un = await api('POST', `/api/users/${doc.id}/unlock`, { token: adminTok });
  check(`the admin unlocks (got ${un.status})`, un.status === 200 && obj(un.body).wasLocked === true);
  check('...and the doctor signs in', (await login(doc.email, PW)).status === 200);

  // A successful sign-in wipes earlier wrong tries.
  await login(doc.email, 'x'); await login(doc.email, 'x'); await login(doc.email, PW);
  const fresh = await login(doc.email, 'x');
  check('after a successful sign-in the count starts again', fresh.status === 401 && !/attempt left/.test(obj(fresh.body).error));
  await login(doc.email, PW);

  // A password reset unlocks.
  for (let i = 0; i < 4; i++) await login(doc.email, 'x');
  check('locked again', (await login(doc.email, PW)).status === 423);
  const resetToken = crypto.randomBytes(16).toString('hex');
  await pool.query(`UPDATE public.users SET reset_token = $2, reset_token_expires = now() + interval '1 hour' WHERE id = $1`, [doc.id, resetToken]);
  const NEW = 'Another-Strong-Pass!45';
  const rs = await api('POST', '/api/auth/reset-password', { body: { resetToken, newPassword: NEW } });
  check(`resetting the password unlocks the account (reset ${rs.status})`, rs.status === 200 && (await login(doc.email, NEW)).status === 200);

  // ── patient portal ───────────────────────────────────────────────────────────────
  const patientId = crypto.randomUUID();
  const pEmail = `pt_${RUN}@example.com`;
  await pool.query(`INSERT INTO public.users (id,email,first_name,last_name,role,status,practice_id,created_at)
    VALUES ($1,$2,'Rosa','Parks','patient','active',$3,NOW())`, [patientId, pEmail, t.practiceId]);
  await pool.query(`INSERT INTO ${t.tenant.schema_name}.patients (id, first_name, last_name, status, mrn, date_of_birth, email)
    VALUES ($1,'Rosa','Parks','Active',$2,'1970-02-04',$3)`, [patientId, `MRN-${RUN}`, pEmail]);
  await api('POST', '/api/portal-invites', { token: adminTok, body: { patientId } });
  const mail = outbox.filter((m) => m.to === pEmail).pop();
  const inviteToken = mail && tokenOf(await expandLink(firstLinkIn(mail.html), BASE));
  await api('POST', '/api/portal-invites/accept', { body: { token: inviteToken, password: PW } });
  const plogin = (password) => api('POST', '/api/patient-portal/login', { body: { email: pEmail, password } });
  check('the patient signs in to the portal', (await plogin(PW)).status === 200);
  const ps = [];
  for (let i = 0; i < 4; i++) ps.push((await plogin('x')).status);
  check(`portal: the 4th wrong password locks (${ps.join(',')})`, ps.join(',') === '401,401,401,423');
  check('...the right password is refused while locked', (await plogin(PW)).status === 423);
  const st = await api('GET', `/api/portal-invites/patient/${patientId}`, { token: nurseTok });
  check('the patient\'s chart shows the portal sign-in as locked', obj(st.body).locked === true);
  const pu = await api('POST', `/api/portal-invites/patient/${patientId}/unlock`, { token: nurseTok });
  check(`staff unlock it (got ${pu.status})`, pu.status === 200 && obj(pu.body).wasLocked === true);
  check('...and the patient signs in', (await plogin(PW)).status === 200);
  check('...and the chart no longer shows a lock',
    obj((await api('GET', `/api/portal-invites/patient/${patientId}`, { token: nurseTok })).body).locked === false);

  report();
})().catch(report);
