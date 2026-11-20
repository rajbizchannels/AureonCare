// Phase 1: one person, several practices (memberships).
//
// A doctor at Practice A is invited by Practice B and accepts with their EXISTING password
// (or Google): one account, two memberships. Proves: the invite no longer refuses them;
// a wrong password adds nothing; switching gives that practice's data, role and 2FA rule;
// sessions in two practices work side by side; B's admin manages only the role HERE —
// never the account (no takeover via password/email); removing someone from B ends their
// B sessions only; lists and provider directories are per-membership; and staff sign-in
// prefers a staff membership.

const path = require('path');
const crypto = require('crypto');

const BACKEND = path.join(__dirname, '..', '..');
process.env.PORT = process.env.TEST_PORT || '4880';
process.env.NODE_ENV = 'development';
process.env.AC_JWT_S = process.env.AC_JWT_S || crypto.randomBytes(48).toString('base64');
process.env.AC_TK_S = process.env.AC_TK_S || process.env.AC_JWT_S;
process.env.AC_PW_BREACH_CHECK = 'false';
process.env.AC_RL_TEST_BYPASS = '1';   // many sign-ins in one run (development only)
const BASE = `http://127.0.0.1:${process.env.PORT}`;

let IDENTITY = null;
const stub = (rel, exportsObj) => {
  const p = require.resolve(path.join(BACKEND, rel));
  require.cache[p] = { id: p, filename: p, loaded: true, exports: exportsObj };
};
stub('utils/oauthExchange.js', { exchangeAuthCode: async () => ({ accessToken: 'server-side-token', refreshToken: null }) });
stub('utils/socialTokenValidator.js', {
  validateSocialToken: async () => { if (!IDENTITY) throw new Error('no identity'); return IDENTITY; },
  isProviderIdMatch: () => true,
});
const notify = require(path.join(BACKEND, 'services/notificationService.js'));
notify.sendEmail = async () => ({ sent: false, reason: 'test' });   // invites return their link
const { expandLink, tokenOf: tokenOfUrl } = require(path.join(__dirname, '..', 'helpers', 'links.js'));

const pool = require(path.join(BACKEND, 'db.js'));
const bcrypt = require(path.join(BACKEND, '..', 'node_modules', 'bcryptjs'));
const { provisionTenant } = require(path.join(BACKEND, 'services/tenantProvisioning.js'));
require(path.join(BACKEND, 'server.js'));

const results = [];
const check = (n, c) => results.push([n, !!c]);
const call = async (method, url, token, body) => {
  const r = await fetch(BASE + url, { method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text(); let b = null; try { b = JSON.parse(t); } catch { b = t; }
  return { status: r.status, body: b };
};
const usersWith = async (email) => (await pool.query('SELECT * FROM public.users WHERE LOWER(email) = LOWER($1)', [email])).rows;
const report = (err) => {
  let failed = 0;
  for (const [n, c] of results) { console.log(`  ${c ? 'ok  ' : 'FAIL'} ${n}`); if (!c) failed += 1; }
  if (err) { console.error(`\nSTOPPED: ${err.message || err}`); console.error(err); }
  else console.log(`\n${results.length - failed}/${results.length} checks passed.`);
  process.exit(err || failed ? 1 : 0);
};


(async () => {
  for (let i = 0; i < 40; i++) { try { await fetch(BASE + '/health'); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  const RUN = crypto.randomBytes(3).toString('hex');
  const PW = 'A-Strong-Passphrase!23';
  const mkUser = async (email, role, practiceId) => (await pool.query(
    `INSERT INTO public.users (id,email,first_name,last_name,role,status,password_hash,practice_id,created_at)
     VALUES (gen_random_uuid(),$1,'Pat','Doe',$2,'active',$3,$4,NOW()) RETURNING id`, [email, role, await bcrypt.hash(PW, 12), practiceId])).rows[0].id;
  const login = async (email, password = PW) => (await call('POST', '/api/auth/login', null, { email, password }));
  const A = await provisionTenant(pool, { name: `Alpha ${RUN}` });
  const B = await provisionTenant(pool, { name: `Beta ${RUN}` });
  const adminA = (await login(await (async () => { const e = `adma_${RUN}@example.com`; await mkUser(e, 'admin', A.practiceId); return e; })())).body.token;
  const adminBEmail = `admb_${RUN}@example.com`; await mkUser(adminBEmail, 'admin', B.practiceId);
  const adminB = (await login(adminBEmail)).body.token;
  const docEmail = `doc_${RUN}@example.com`;
  const docId = await mkUser(docEmail, 'doctor', A.practiceId);
  await pool.query(`INSERT INTO public.providers (id, first_name, last_name, specialization) VALUES ($1,'Pat','Doe','Cardiology')`, [docId]);
  const mems = async () => (await pool.query('SELECT practice_id, role, status FROM public.memberships WHERE user_id = $1 ORDER BY created_at', [docId])).rows;
  check('creating an account creates its membership (trigger)', (await mems()).length === 1 && (await mems())[0].practice_id === A.practiceId);

  // ── joining a second practice ────────────────────────────────────────────────────
  const inv = await call('POST', '/api/invites', adminB, { email: docEmail, role: 'doctor' });
  check(`B CAN INVITE A DOCTOR WHO WORKS AT A (got ${inv.status}; was 409)`, inv.status === 201 && inv.body.existingAccount === true);
  const tok = tokenOfUrl(await expandLink(inv.body.inviteUrl, BASE));
  const look = await call('GET', `/api/invites/lookup/${tok}`);
  check('the invite page knows they already have an account', look.body.existingAccount === true && look.body.hasPassword === true);
  check('A WRONG PASSWORD ADDS NOTHING', (await call('POST', '/api/invites/accept', null, { token: tok, password: 'Not-My-Password!99' })).status === 401
    && (await mems()).length === 1);
  const acc = await call('POST', '/api/invites/accept', null, { token: tok, password: PW });
  check(`accepting with their existing password adds Practice B (got ${acc.status})`, acc.status === 201 && acc.body.addedToPractice === true);
  const m2 = await mems();
  check('...one account, two memberships', m2.length === 2 && m2.some((m) => m.practice_id === B.practiceId && m.role === 'doctor'));
  check('...the password was checked, not replaced', (await login(docEmail)).status === 200);
  check('...and the invite is used up', (await call('POST', '/api/invites/accept', null, { token: tok, password: PW })).status === 404);
  check('inviting them to B again is refused: already in your practice', (await call('POST', '/api/invites', adminB, { email: docEmail })).status === 409);

  // ── sessions and switching ───────────────────────────────────────────────────────
  const sessB = (await login(docEmail)).body.token;   // default is now B (where they joined)
  const status = async (t) => (await call('GET', '/api/auth/tenant-status', t)).body;
  check('signing in starts in the most recent practice (B)', (await status(sessB)).practiceId === B.practiceId);
  const list = await call('GET', '/api/auth/memberships', sessB);
  check('they see both practices, B active', list.body.practices.length === 2 && list.body.practices.find((p) => p.active).practiceId === B.practiceId);
  const sw = await call('POST', '/api/auth/switch-practice', sessB, { practiceId: A.practiceId });
  check(`switching to A gives a new session for A (got ${sw.status})`, sw.status === 200 && sw.body.token);
  const sessA = sw.body.token;
  check('...working in A\'s data space', (await status(sessA)).schemaName === A.tenant.schema_name);
  check('THE B SESSION STILL WORKS IN B AT THE SAME TIME (another device)', (await status(sessB)).schemaName === B.tenant.schema_name);
  check('switching to a practice they do not belong to is refused', (await call('POST', '/api/auth/switch-practice', sessA, { practiceId: crypto.randomUUID() })).status === 404);

  // ── lists are per membership ─────────────────────────────────────────────────────
  const provIn = async (t) => ((await call('GET', '/api/providers', t)).body || []).some((p) => String(p.id) === String(docId));
  check('the doctor is in BOTH practices\' provider lists', await provIn(adminA) && await provIn(adminB));
  const usersB = (await call('GET', '/api/users', adminB)).body;
  const meInB = usersB.find((u) => String(u.id) === String(docId));
  check('B\'s user list shows them, marked as also working elsewhere', meInB && meInB.otherPractices === 1);
  check('A admin does not see B\'s admin', !((await call('GET', '/api/users', adminA)).body || []).some((u) => u.email === adminBEmail));

  // ── B's admin manages the role HERE, never the account ───────────────────────────
  const ed = await call('PUT', `/api/users/${docId}`, adminB, { role: 'nurse', email: `taken_${RUN}@evil.example`, password: 'Evil-Takeover-Pass!1', firstName: 'Mallory' });
  check(`B's admin edit changes only the role in B (got ${ed.status})`, ed.status === 200 && ed.body.accountFieldsIgnored === true);
  const { rows: [after] } = await pool.query('SELECT email, first_name FROM public.users WHERE id = $1', [docId]);
  check('NO ACCOUNT TAKEOVER: email, name and password unchanged', after.email === docEmail && after.first_name === 'Pat' && (await login(docEmail)).status === 200
    && (await login(docEmail, 'Evil-Takeover-Pass!1')).status === 401);
  const roles = Object.fromEntries((await mems()).map((m) => [m.practice_id, m.role]));
  check('...role is nurse in B and still doctor in A', roles[B.practiceId] === 'nurse' && roles[A.practiceId] === 'doctor');
  check('...and the session in B now has the nurse role', (await call('GET', '/api/auth/me', sessB)).body.role === 'nurse');

  // ── removing them from B ─────────────────────────────────────────────────────────
  const del = await call('DELETE', `/api/users/${docId}`, adminB);
  check(`"delete" by B only REMOVES them from B (got ${del.status})`, del.status === 200 && del.body.removedFromPractice === true);
  check('...their B sessions stop at once', (await call('GET', '/api/auth/me', sessB)).status === 401);
  check('...their A session keeps working, account intact', (await call('GET', '/api/auth/me', sessA)).status === 200
    && (await pool.query('SELECT 1 FROM public.users WHERE id = $1', [docId])).rowCount === 1);
  check('...and they now sign in to A', (await status((await login(docEmail)).body.token)).practiceId === A.practiceId);

  // ── two-factor rule of the target practice ───────────────────────────────────────
  const inv2 = await call('POST', '/api/invites', adminB, { email: docEmail, role: 'doctor' });
  await call('POST', '/api/invites/accept', null, { token: tokenOfUrl(await expandLink(inv2.body.inviteUrl, BASE)), password: PW });
  await pool.query('UPDATE public.practices SET require_mfa = true WHERE id = $1', [B.practiceId]);
  const l2 = await login(docEmail);
  check('their default (B) now requires 2FA they lack: they sign in to A instead of being locked out',
    l2.status === 200 && (await status(l2.body.token)).practiceId === A.practiceId);
  const toB = await call('POST', '/api/auth/switch-practice', l2.body.token, { practiceId: B.practiceId });
  check('switching into a practice that requires 2FA, without 2FA, is refused', toB.status === 403 && toB.body.mfaEnrolmentRequired === true);
  await pool.query('UPDATE public.practices SET require_mfa = false WHERE id = $1', [B.practiceId]);

  // ── Google acceptance for an existing account ────────────────────────────────────
  const C = await provisionTenant(pool, { name: `Charlie ${RUN}` });
  const adminCEmail = `admc_${RUN}@example.com`; await mkUser(adminCEmail, 'admin', C.practiceId);
  const adminC = (await login(adminCEmail)).body.token;
  const invC = await call('POST', '/api/invites', adminC, { email: docEmail, role: 'admin' });
  IDENTITY = { email: docEmail, emailVerified: true, providerId: `g-doc-${RUN}`, firstName: 'Pat', lastName: 'Doe' };
  const g = await call('POST', '/api/auth/oauth/google/exchange', null, { code: 'c', redirectUri: 'postmessage', inviteToken: tokenOfUrl(await expandLink(invC.body.inviteUrl, BASE)) });
  check(`Google + invite adds Practice C to the existing account (got ${g.status})`, g.status === 200
    && (await mems()).some((m) => m.practice_id === C.practiceId && m.role === 'admin'));
  check('...a person can be admin at one practice and doctor at another', (await mems()).find((m) => m.practice_id === A.practiceId).role === 'doctor');

  // ── staff sign-in prefers a staff membership ─────────────────────────────────────
  const both = `both_${RUN}@example.com`;
  const bothId = await mkUser(both, 'patient', A.practiceId);
  await pool.query(`INSERT INTO public.memberships (user_id, practice_id, role) VALUES ($1,$2,'nurse')`, [bothId, B.practiceId]);
  const bl = await login(both);
  check('a patient at A who is a nurse at B signs in to B as a nurse', bl.status === 200 && (await call('GET', '/api/auth/me', bl.body.token)).body.role === 'nurse');
  const onlyPt = `pt_${RUN}@example.com`; await mkUser(onlyPt, 'patient', A.practiceId);
  check('a patient-only account is still refused at the staff sign-in', (await login(onlyPt)).status === 403);
})().then(() => report(), report);
