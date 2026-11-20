// SEC-40: the server side of the session policy.
//   GET  /api/patient-portal/session  — who a portal session belongs to (for a reloaded tab)
//   POST /api/auth/session/end        — a new browser session starts signed out: clears this
//                                       browser's cookies, revokes a portal session, and does
//                                       NOT sign the person out on other devices.

const path = require('path');
const crypto = require('crypto');

const BACKEND = path.join(__dirname, '..', '..');
process.env.PORT = process.env.TEST_PORT || '4869';
process.env.NODE_ENV = 'development';
process.env.AC_JWT_S = process.env.AC_JWT_S || crypto.randomBytes(48).toString('base64');
process.env.AC_TK_S = process.env.AC_TK_S || process.env.AC_JWT_S;
process.env.AC_PW_BREACH_CHECK = 'false';
process.env.AC_IDX_K = process.env.AC_IDX_K || crypto.randomBytes(32).toString('base64');
const BASE = `http://127.0.0.1:${process.env.PORT}`;

const pool = require(path.join(BACKEND, 'db.js'));
const bcrypt = require(path.join(BACKEND, '..', 'node_modules', 'bcryptjs'));
const { provisionTenant } = require(path.join(BACKEND, 'services/tenantProvisioning.js'));
const { registerIdentity } = require(path.join(BACKEND, 'services/portalRouting.js'));
require(path.join(BACKEND, 'server.js'));

const results = [];
const check = (n, c) => results.push([n, !!c]);
const call = async (method, url, { cookie, token, body } = {}) => {
  const r = await fetch(BASE + url, { method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text(); let b = null; try { b = JSON.parse(t); } catch { b = t; }
  return { status: r.status, body: b, setCookie: r.headers.getSetCookie ? r.headers.getSetCookie() : [] };
};
const jarFrom = (setCookie, names) => setCookie.map((c) => c.split(';')[0]).filter((c) => names.some((n) => c.startsWith(n + '='))).join('; ');
const cleared = (setCookie, name) => setCookie.some((c) => c.startsWith(`${name}=;`) && /Expires=Thu, 01 Jan 1970|Max-Age=0/i.test(c));
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
  const t = await provisionTenant(pool, { name: `Session ${RUN}` });

  // ── staff ───────────────────────────────────────────────────────────────────────
  const email = `staff_${RUN}@example.com`;
  await pool.query(`INSERT INTO public.users (id,email,first_name,last_name,role,status,password_hash,practice_id,created_at)
    VALUES (gen_random_uuid(),$1,'S','T','doctor','active',$2,$3,NOW())`, [email, await bcrypt.hash(PW, 12), t.practiceId]);
  const loginA = await call('POST', '/api/auth/login', { body: { email, password: PW } });   // this browser
  const loginB = await call('POST', '/api/auth/login', { body: { email, password: PW } });   // another device
  const jarA = jarFrom(loginA.setCookie, ['ac_session', 'ac_csrf']);
  check('the browser session works', (await call('GET', '/api/auth/me', { cookie: jarA })).status === 200);

  const end = await call('POST', '/api/auth/session/end', { cookie: jarA });
  check(`ENDING THE BROWSER SESSION SUCCEEDS WITHOUT A CSRF HEADER (got ${end.status})`, end.status === 200);
  check('...and clears the session, portal and CSRF cookies',
    cleared(end.setCookie, 'ac_session') && cleared(end.setCookie, 'ac_portal') && cleared(end.setCookie, 'ac_csrf'));
  check('the same person on ANOTHER DEVICE stays signed in (no global logout)',
    (await call('GET', '/api/auth/me', { token: loginB.body.token })).status === 200);
  check('ending a session that does not exist is harmless', (await call('POST', '/api/auth/session/end')).status === 200);

  // ── portal patient ─────────────────────────────────────────────────────────────
  const pid = crypto.randomUUID(); const pEmail = `pt_${RUN}@example.com`;
  await pool.query(`INSERT INTO ${t.tenant.schema_name}.patients
      (id, first_name, last_name, status, mrn, date_of_birth, email, portal_enabled, portal_password_hash)
    VALUES ($1,'Rosa','Parks','Active',$2,'1970-02-04',$3,true,$4)`, [pid, `MRN-${RUN}`, pEmail, await bcrypt.hash(PW, 12)]);
  await registerIdentity(pool, pEmail, t.tenant.id);
  const plogin = await call('POST', '/api/patient-portal/login', { body: { email: pEmail, password: PW } });
  const pjar = jarFrom(plogin.setCookie, ['ac_portal', 'ac_csrf']);
  const who = await call('GET', '/api/patient-portal/session', { cookie: pjar });
  check(`A RELOADED PORTAL TAB CAN ASK WHO IT IS SIGNED IN AS (got ${who.status})`, who.status === 200 && who.body.patient.id === pid);
  check('...without the password hash', !JSON.stringify(who.body).includes('portal_password_hash'));
  check('no cookie -> 401', (await call('GET', '/api/patient-portal/session')).status === 401);
  check('a made-up token -> 401', (await call('GET', '/api/patient-portal/session', { cookie: 'ac_portal=not-a-session' })).status === 401);

  const pend = await call('POST', '/api/auth/session/end', { cookie: pjar });
  check('ending the browser session clears the portal cookie', pend.status === 200 && cleared(pend.setCookie, 'ac_portal'));
  check('...AND REVOKES THE PORTAL SESSION ON THE SERVER (the old cookie no longer works)',
    (await call('GET', '/api/patient-portal/session', { cookie: pjar })).status === 401);

  await pool.query('DELETE FROM public.users WHERE email = $1', [email]).catch(() => {});
  report();
})().catch(report);
