// SEC-20: with AC_DISABLE_LEGACY_SOCIAL_TOKEN=true, NO route accepts a provider access
// token posted by the browser — while the authorization-code routes (which redeem the
// code server-side) keep working for sign-in, sign-up and the patient portal.
//
// The flag used to guard only /api/auth/social-login. A browser-held token was still
// accepted by /auth/social-register (since removed with the sign-up page), /auth/link-social-account,
// /patient-portal/login and /patient-portal/:id/link-social — so setting the flag did
// not actually finish SEC-20.

const path = require('path');
const crypto = require('crypto');

const BACKEND = path.join(__dirname, '..', '..');
process.env.PORT = process.env.TEST_PORT || '4881';
process.env.NODE_ENV = 'development';
process.env.AC_JWT_S = process.env.AC_JWT_S || crypto.randomBytes(48).toString('base64');
process.env.AC_TK_S = process.env.AC_TK_S || process.env.AC_JWT_S;
process.env.AC_PW_BREACH_CHECK = 'false';
process.env.AC_IDX_K = process.env.AC_IDX_K || crypto.randomBytes(32).toString('base64');
process.env.AC_DISABLE_LEGACY_SOCIAL_TOKEN = 'true';
const BASE = `http://127.0.0.1:${process.env.PORT}`;

// The provider is stubbed at the module boundary: a "code" redeems to a token, and a token
// validates to the identity the test sets. No network.
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
  const t = await provisionTenant(pool, { name: `Legacy ${RUN}` });
  const adminEmail = `adm_${RUN}@example.com`;
  await pool.query(`INSERT INTO public.users (id,email,first_name,last_name,role,status,password_hash,practice_id,created_at)
    VALUES (gen_random_uuid(),$1,'A','B','admin','active',$2,$3,NOW())`, [adminEmail, await bcrypt.hash(PW, 12), t.practiceId]);
  const admin = (await call('POST', '/api/auth/login', null, { email: adminEmail, password: PW })).body.token;

  // A portal patient with a password, for a portal session.
  const pid = crypto.randomUUID(); const pEmail = `pt_${RUN}@example.com`;
  await pool.query(`INSERT INTO public.users (id,email,first_name,last_name,role,status,practice_id,created_at)
    VALUES ($1,$2,'P','Q','patient','active',$3,NOW())`, [pid, pEmail, t.practiceId]);
  await pool.query(`INSERT INTO ${t.tenant.schema_name}.patients (id, first_name, last_name, status, mrn, date_of_birth, email)
    VALUES ($1,'P','Q','Active',$2,'1970-01-01',$3)`, [pid, `MRN-${RUN}`, pEmail]);
  // Portal enabled with a password, as accepting a portal invitation leaves it, and the
  // identity routed so password login can find the practice.
  await pool.query(`UPDATE ${t.tenant.schema_name}.patients SET portal_enabled = true, portal_password_hash = $2 WHERE id = $1`,
    [pid, await bcrypt.hash(PW, 12)]);
  await require(path.join(BACKEND, 'services/portalRouting.js')).registerIdentity(pool, pEmail, t.tenant.id);
  const portal = await call('POST', '/api/patient-portal/login', null, { email: pEmail, password: PW });
  check('password portal login still works with the flag on', portal.status === 200);
  const portalTok = portal.body && portal.body.sessionToken;

  // ── every browser-token route is closed ─────────────────────────────────────────
  IDENTITY = { email: `new_${RUN}@example.com`, emailVerified: true, providerId: `g-${RUN}`, firstName: 'N', lastName: 'U' };
  const T = { provider: 'google', providerId: `g-${RUN}`, accessToken: 'token-from-the-browser' };
  const closed = [
    ['POST', '/api/auth/social-login', null, T],
    ['POST', '/api/auth/link-social-account', admin, T],
    ['POST', '/api/patient-portal/login', null, T],
    ['POST', `/api/patient-portal/${pid}/link-social`, portalTok, T],
  ];
  for (const [m, u, tok, b] of closed) {
    const r = await call(m, u, tok, b);
    check(`${m} ${u} REFUSES A BROWSER-HELD PROVIDER TOKEN (410; got ${r.status})`, r.status === 410);
  }

  // ── the authorization-code routes still work ────────────────────────────────────
  // The public sign-up page and its routes are gone (SEC-39): accounts come from invitations.
  for (const u of ['/api/auth/social-register', '/api/auth/oauth/google/register', '/api/patient-portal/register']) {
    const r = await call('POST', u, admin, T);
    check(`${u} no longer exists (got ${r.status})`, r.status === 404);
  }
  const login = await call('POST', '/api/auth/oauth/google/exchange', null, { code: 'one-time-code', redirectUri: 'postmessage' });
  check(`social SIGN-IN by code still works (got ${login.status})`, login.status === 200 && login.body && login.body.token);
  // Portal: an identity no practice knows reaches the handler and is answered 404 — i.e.
  // the server-exchanged token is NOT mistaken for a browser-held one.
  IDENTITY = { email: `ghost_${RUN}@example.com`, emailVerified: true, providerId: `ghost-${RUN}` };
  const pex = await call('POST', '/api/patient-portal/oauth/google/exchange', null, { code: 'one-time-code', redirectUri: 'postmessage' });
  check(`the portal code exchange is not blocked by the flag (got ${pex.status}, not 410)`, pex.status !== 410 && pex.status < 500);

  await pool.query('DELETE FROM public.users WHERE email = ANY($1)', [[adminEmail, pEmail, `new_${RUN}@example.com`]]).catch(() => {});
  report();
})().catch(report);
