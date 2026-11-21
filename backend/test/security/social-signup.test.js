// SEC-39: "Sign in with Google/Microsoft" never creates a practice-less account.
//
// The social sign-in handler used to fall through to a patient "self-registration" for any
// identity it did not know: an account with no practice, which could never reach a chart.
// A new account is now created only with a staff invitation or a verified work email at a
// domain a practice has claimed; anything else is refused and nothing is written.

const path = require('path');
const crypto = require('crypto');

const BACKEND = path.join(__dirname, '..', '..');
process.env.PORT = process.env.TEST_PORT || '4873';
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
const { expandLink, tokenOf: tokenOfUrl } = require(path.join(__dirname, '..', 'helpers', 'links.js'));
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
  const t = await provisionTenant(pool, { name: `Social ${RUN}` });
  const adminEmail = `adm_${RUN}@example.com`;
  await pool.query(`INSERT INTO public.users (id,email,first_name,last_name,role,status,password_hash,practice_id,created_at)
    VALUES (gen_random_uuid(),$1,'A','B','admin','active',$2,$3,NOW())`, [adminEmail, await bcrypt.hash(PW, 12), t.practiceId]);
  const admin = (await call('POST', '/api/auth/login', null, { email: adminEmail, password: PW })).body.token;
  const signIn = (provider = 'google', extra = {}) =>
    call('POST', `/api/auth/oauth/${provider}/exchange`, null, { code: 'one-time-code', redirectUri: 'postmessage', ...extra });

  // ── 1. a stranger ────────────────────────────────────────────────────────────────
  const stranger = `stranger_${RUN}@gmail.example`;
  IDENTITY = { email: stranger, emailVerified: true, providerId: `g-stranger-${RUN}`, firstName: 'S', lastName: 'T' };
  const s1 = await signIn('google');
  check(`AN UNKNOWN GOOGLE IDENTITY WITH NO INVITATION IS REFUSED (got ${s1.status})`, s1.status === 404);
  check('...with a message that says what to do', /invitation/i.test((s1.body || {}).error || ''));
  check('...AND NO ACCOUNT IS CREATED', (await usersWith(stranger)).length === 0);
  check('...nor any social link',
    (await pool.query('SELECT 1 FROM public.social_auth WHERE provider_user_id = $1', [`g-stranger-${RUN}`])).rowCount === 0);
  IDENTITY = { ...IDENTITY, providerId: `ms-stranger-${RUN}` };
  check('the same holds for Microsoft', (await signIn('microsoft', { codeVerifier: 'v' })).status === 404 && (await usersWith(stranger)).length === 0);

  // An unverified address is not an identity to build on, whatever its domain.
  const unverified = `unverified_${RUN}@example.com`;
  IDENTITY = { email: unverified, emailVerified: false, providerId: `g-unv-${RUN}` };
  check('an unverified email is refused and creates nothing',
    (await signIn('google')).status === 404 && (await usersWith(unverified)).length === 0);

  // ── 2. a staff invitation creates a staff account in that practice ───────────────
  const staffEmail = `nurse_${RUN}@example.com`;
  const inv = await call('POST', '/api/invites', admin, { email: staffEmail, role: 'nurse' });
  const inviteToken = inv.body && inv.body.inviteUrl && tokenOfUrl(await expandLink(inv.body.inviteUrl, BASE));
  check('an admin can invite a colleague', inv.status === 201 && Boolean(inviteToken));
  IDENTITY = { email: staffEmail, emailVerified: true, providerId: `g-nurse-${RUN}`, firstName: 'N', lastName: 'U' };
  const s2 = await signIn('google', { inviteToken });
  const [nurse] = await usersWith(staffEmail);
  check(`WITH AN INVITATION, SOCIAL SIGN-IN CREATES THE ACCOUNT (got ${s2.status})`, s2.status === 200 && Boolean(nurse));
  check('...bound to the inviting practice, with the invited role', nurse && nurse.practice_id === t.practiceId && nurse.role === 'nurse');
  check('...and signs them in', Boolean(s2.body && s2.body.token));
  check('the same invitation cannot be used twice',
    (await call('GET', `/api/invites/lookup/${inviteToken}`)).status !== 200);

  // ── 3. an existing account signs in and is linked ────────────────────────────────
  IDENTITY = { email: adminEmail, emailVerified: true, providerId: `g-adm-${RUN}`, firstName: 'A', lastName: 'B' };
  const s3 = await signIn('google');
  check(`an existing account can sign in with Google (got ${s3.status})`, s3.status === 200 && s3.body.user && s3.body.user.email === adminEmail);
  check('...and no second account is made', (await usersWith(adminEmail)).length === 1);
  check('...and next time the link alone finds it', (await signIn('google')).status === 200);

  await pool.query('DELETE FROM public.social_auth WHERE provider_user_id = ANY($1)', [[`g-nurse-${RUN}`, `g-adm-${RUN}`]]).catch(() => {});
  await pool.query('DELETE FROM public.users WHERE email = ANY($1)', [[adminEmail, staffEmail]]).catch(() => {});
  report();
})().catch(report);
