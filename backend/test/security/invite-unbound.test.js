// Staff invitations and leftover UNBOUND accounts (practice_id NULL).
//
// The old self-registration page and social sign-in (SEC-39) left accounts with no
// practice. They never show in User Management, so no admin could remove them, and the
// invite check refused their email for good: "A user with that email already exists."
// Now such an account is adopted by whoever redeems an invite for that address — and,
// because it existed before the email was proved, every identity linked to it is dropped
// and its sessions revoked (pre-hijack defence). Accounts IN a practice still block.

const path = require('path');
const crypto = require('crypto');

const BACKEND = path.join(__dirname, '..', '..');
process.env.PORT = process.env.TEST_PORT || '4874';
process.env.NODE_ENV = 'development';
process.env.AC_JWT_S = process.env.AC_JWT_S || crypto.randomBytes(48).toString('base64');
process.env.AC_TK_S = process.env.AC_TK_S || process.env.AC_JWT_S;
process.env.AC_PW_BREACH_CHECK = 'false';
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
  const RUN = crypto.randomBytes(4).toString('hex');
  const PW = 'A-Strong-Passphrase!23';
  const t = await provisionTenant(pool, { name: `Adopt ${RUN}` });
  const other = await provisionTenant(pool, { name: `Other ${RUN}` });
  const mkUser = async (email, role, practiceId) => (await pool.query(
    `INSERT INTO public.users (id,email,first_name,last_name,role,status,password_hash,practice_id,created_at)
     VALUES (gen_random_uuid(),$1,'Old','Name',$2,'active',$3,$4,NOW()) RETURNING id, token_version`,
    [email, role, await bcrypt.hash('Old-Passphrase!987', 12), practiceId])).rows[0];
  const adminEmail = `adm_${RUN}@example.com`;
  await mkUser(adminEmail, 'admin', t.practiceId);
  await pool.query('UPDATE public.users SET password_hash=$2 WHERE email=$1', [adminEmail, await bcrypt.hash(PW, 12)]);
  const admin = (await call('POST', '/api/auth/login', null, { email: adminEmail, password: PW })).body.token;
  const tokenOf = (r) => r.body && r.body.inviteUrl && new URL(r.body.inviteUrl).searchParams.get('token');

  // ── 1. password acceptance adopts a leftover patient account ─────────────────────
  const leftover = `leftover_${RUN}@example.com`;
  const old = await mkUser(leftover, 'patient', null);
  await pool.query(`INSERT INTO public.social_auth (user_id, patient_id, provider, provider_user_id)
                    VALUES ($1,$1,'google',$2)`, [old.id, `g-attacker-${RUN}`]);
  const inv = await call('POST', '/api/invites', admin, { email: leftover, role: 'nurse' });
  check(`INVITING AN EMAIL HELD BY AN UNBOUND ACCOUNT IS ALLOWED (got ${inv.status}: ${JSON.stringify(inv.body).slice(0, 80)})`,
    inv.status === 201 && tokenOf(inv));
  const acc = await call('POST', '/api/invites/accept', null,
    { token: tokenOf(inv), password: PW, firstName: 'Nina', lastName: 'Nurse' });
  check(`accepting it succeeds (got ${acc.status})`, acc.status === 201);
  const [u] = await usersWith(leftover);
  check('the SAME account is reused (no duplicate)', (await usersWith(leftover)).length === 1 && u.id === old.id);
  check('...now bound to the inviting practice', u.practice_id === t.practiceId);
  check('...with the invited role and active', u.role === 'nurse' && u.status === 'active');
  check('...and the names given at acceptance', u.first_name === 'Nina' && u.last_name === 'Nurse');
  check('SOCIAL IDENTITIES LINKED BEFORE THE EMAIL WAS PROVED ARE REMOVED',
    (await pool.query('SELECT 1 FROM public.social_auth WHERE user_id = $1', [old.id])).rowCount === 0);
  check('EARLIER SESSIONS ARE REVOKED (token_version bumped)', Number(u.token_version) > Number(old.token_version || 0));
  check('the old password no longer works',
    (await call('POST', '/api/auth/login', null, { email: leftover, password: 'Old-Passphrase!987' })).status === 401);
  const li = await call('POST', '/api/auth/login', null, { email: leftover, password: PW });
  check(`the new password signs in (got ${li.status})`, li.status === 200 && li.body.token);
  check('the invite is used up', (await call('POST', '/api/invites/accept', null, { token: tokenOf(inv), password: PW })).status === 404);
  check('the attacker identity no longer signs in', await (async () => {
    IDENTITY = { email: leftover, emailVerified: false, providerId: `g-attacker-${RUN}`, firstName: 'X', lastName: 'Y' };
    const r = await call('POST', '/api/auth/oauth/google/exchange', null, { code: 'c', redirectUri: 'postmessage' });
    return r.status !== 200;
  })());

  // ── 2. accounts IN a practice still block, with a message that says which ────────
  const same = await call('POST', '/api/invites', admin, { email: leftover });
  check(`an email already in YOUR practice is refused (got ${same.status})`,
    same.status === 409 && /your practice/i.test(same.body.error || ''));
  const elsewhere = `elsewhere_${RUN}@example.com`;
  await mkUser(elsewhere, 'doctor', other.practiceId);
  const oth = await call('POST', '/api/invites', admin, { email: elsewhere });
  check(`an email in ANOTHER practice is refused (got ${oth.status})`,
    oth.status === 409 && /another practice/i.test(oth.body.error || ''));
  check('...and that account is untouched', (await usersWith(elsewhere))[0].practice_id === other.practiceId);

  // ── 3. Google acceptance adopts too, keeping only the identity signing in ────────
  const leftover2 = `leftover2_${RUN}@example.com`;
  const old2 = await mkUser(leftover2, 'patient', null);
  await pool.query(`INSERT INTO public.social_auth (user_id, patient_id, provider, provider_user_id)
                    VALUES ($1,$1,'microsoft',$2)`, [old2.id, `ms-attacker-${RUN}`]);
  const inv2 = await call('POST', '/api/invites', admin, { email: leftover2, role: 'doctor' });
  check('a second unbound address can be invited', inv2.status === 201);
  IDENTITY = { email: leftover2, emailVerified: true, providerId: `g-owner-${RUN}`, firstName: 'Dee', lastName: 'Doc' };
  const g = await call('POST', '/api/auth/oauth/google/exchange', null,
    { code: 'c', redirectUri: 'postmessage', inviteToken: tokenOf(inv2) });
  check(`signing in with the matching Google identity + invite succeeds (got ${g.status})`, g.status === 200);
  const [u2] = await usersWith(leftover2);
  check('...and binds the leftover account to the practice as invited', u2.id === old2.id && u2.practice_id === t.practiceId && u2.role === 'doctor');
  const links = (await pool.query('SELECT provider, provider_user_id FROM public.social_auth WHERE user_id = $1', [old2.id])).rows;
  check('...keeping ONLY the identity that redeemed the invite',
    links.length === 1 && links[0].provider_user_id === `g-owner-${RUN}`);

  // ── 4. an unbound account is never adopted without an invite ─────────────────────
  const leftover3 = `leftover3_${RUN}@example.com`;
  await mkUser(leftover3, 'patient', null);
  IDENTITY = { email: leftover3, emailVerified: true, providerId: `g-l3-${RUN}`, firstName: 'L', lastName: '3' };
  await call('POST', '/api/auth/oauth/google/exchange', null, { code: 'c', redirectUri: 'postmessage' });
  check('without an invite the account stays unbound', (await usersWith(leftover3))[0].practice_id === null);
})().then(() => report(), report);
