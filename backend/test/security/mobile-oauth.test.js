// Google / Microsoft sign-in for the mobile app (services/mobileOAuth.js, migration 098).
//
// Drives the whole brokered flow the way the app does — start (browser) → provider →
// callback → app link → redeem — with the provider's token endpoint and identity check
// stubbed. Every scenario a person can hit, and every way the handoff could be abused.

const path = require('path');
const crypto = require('crypto');

const BACKEND = path.join(__dirname, '..', '..');
process.env.PORT = process.env.TEST_PORT || '4889';
process.env.NODE_ENV = 'development';
process.env.AC_JWT_S = process.env.AC_JWT_S || crypto.randomBytes(48).toString('base64');
process.env.AC_TK_S = process.env.AC_TK_S || process.env.AC_JWT_S;
process.env.AC_IDX_K = process.env.AC_IDX_K || crypto.randomBytes(32).toString('base64');
process.env.AC_PW_BREACH_CHECK = 'false';
process.env.FRONTEND_URL = 'https://app.example.test';
process.env.REACT_APP_GG_CID = 'google-client-id.apps.example';
process.env.AC_GG_CSK = 'google-secret';
process.env.REACT_APP_MS_CID = '00000000-0000-0000-0000-00000000c1d0';
process.env.AC_MS_CSK = 'ms-secret';
delete process.env.AC_MOBILE_REDIRECTS;
const BASE = `http://127.0.0.1:${process.env.PORT}`;

// The provider: its token endpoint (code -> token) and its identity check (token -> person).
let IDENTITY = null;
let EXCHANGE_FAIL = null;
const exchanges = [];
const stub = (rel, exportsObj) => {
  const p = require.resolve(path.join(BACKEND, rel));
  require.cache[p] = { id: p, filename: p, loaded: true, exports: exportsObj };
};
stub('utils/oauthExchange.js', {
  exchangeAuthCode: async (provider, params) => {
    exchanges.push({ provider, ...params });
    if (EXCHANGE_FAIL) { const e = new Error('Sign-in failed. Please try again.'); e.statusCode = 401; e.providerError = EXCHANGE_FAIL; throw e; }
    return { accessToken: `provider-access-${crypto.randomBytes(6).toString('hex')}`, refreshToken: null };
  },
});
stub('utils/socialTokenValidator.js', {
  validateSocialToken: async () => { if (!IDENTITY) throw new Error('no identity'); return IDENTITY; },
  isProviderIdMatch: () => true,
});
const outbox = [];
const notify = require(path.join(BACKEND, 'services/notificationService.js'));
notify.sendEmail = async (to, subject, html) => { outbox.push({ to, subject, html }); return { sent: true }; };

const pool = require(path.join(BACKEND, 'db.js'));
const bcrypt = require(path.join(BACKEND, '..', 'node_modules', 'bcryptjs'));
const { provisionTenant } = require(path.join(BACKEND, 'services/tenantProvisioning.js'));
require(path.join(BACKEND, 'server.js'));

// The real validator module (the stub above replaced only what the routes import).
const jest_free_require = (rel) => { const p = require.resolve(path.join(BACKEND, rel)); const keep = require.cache[p]; delete require.cache[p]; const m = require(p); require.cache[p] = keep; return m; };
const results = [];
const check = (n, c) => results.push([n, !!c]);
const report = (err) => {
  let failed = 0;
  for (const [n, c] of results) { console.log(`  ${c ? 'ok  ' : 'FAIL'} ${n}`); if (!c) failed += 1; }
  if (err) { console.error(`\nSTOPPED: ${err.message || err}`); console.error(err); }
  else console.log(`\n${results.length - failed}/${results.length} checks passed.`);
  process.exit(err || failed ? 1 : 0);
};
const get = async (url) => {
  const r = await fetch(BASE + url, { redirect: 'manual' });
  return { status: r.status, location: r.headers.get('location'), text: await r.text() };
};
const post = async (url, body, token) => {
  const r = await fetch(BASE + url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body) });
  const t = await r.text(); let b = null; try { b = JSON.parse(t); } catch { b = t; }
  return { status: r.status, body: b };
};

// What the app does (mobile/src/lib/socialSignIn.ts): a verifier, its S256 challenge.
const pkce = () => {
  const verifier = crypto.randomBytes(48).toString('base64url');
  return { verifier, challenge: crypto.createHash('sha256').update(verifier).digest('base64url') };
};
const APP = 'aureoncare://auth';
const startPath = (provider, { redirect = APP, challenge, method = 'S256' } = {}) =>
  `/api/auth/mobile/oauth/${provider}/start?${new URLSearchParams({ redirect_uri: redirect, ...(challenge ? { code_challenge: challenge } : {}), code_challenge_method: method })}`;

/** The whole browser leg; returns { appLink, providerUrl, app } */
async function browser(provider, { app = pkce(), redirect = APP, providerSays } = {}) {
  const s = await get(startPath(provider, { redirect, challenge: app.challenge }));
  if (s.status !== 302) return { start: s, app };
  const providerUrl = new URL(s.location);
  const state = providerUrl.searchParams.get('state');
  const q = providerSays || { code: `provider-code-${crypto.randomBytes(4).toString('hex')}`, state };
  const cb = await get(`/api/auth/mobile/oauth/${provider}/callback?${new URLSearchParams({ state, ...q })}`);
  return { start: s, providerUrl, state, callback: cb, appLink: cb.location, app };
}
const codeOf = (link) => new URL(link.replace('aureoncare://', 'https://x/')).searchParams.get('code');
/** The whole flow as the app runs it: browser leg, then redeem. */
async function signIn(provider, identity) {
  IDENTITY = identity;
  const b = await browser(provider);
  return { ...b, redeem: await post('/api/auth/mobile/oauth/redeem', { code: codeOf(b.appLink), code_verifier: b.app.verifier }) };
}

(async () => {
  for (let i = 0; i < 40; i++) { try { await fetch(BASE + '/health'); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  const RUN = crypto.randomBytes(4).toString('hex');
  const PW = 'A-Strong-Passphrase!23';
  const t = await provisionTenant(pool, { name: `Mobile OAuth ${RUN}` });
  const T = t.tenant.schema_name;
  const mkUser = async (role, extra = {}) => {
    const email = `${role}_${RUN}_${crypto.randomBytes(2).toString('hex')}@gmail.example`;
    const { rows: [u] } = await pool.query(`INSERT INTO public.users (id,email,first_name,last_name,role,status,password_hash,practice_id,created_at)
      VALUES (gen_random_uuid(),$1,'Ada','Lovelace',$2,$3,$4,$5,NOW()) RETURNING id`,
    [email, role, extra.status || 'active', role === 'patient' ? null : await bcrypt.hash(PW, 12), extra.noPractice ? null : t.practiceId]);
    return { id: u.id, email };
  };
  const admin = await mkUser('admin');
  const adminTok = (await post('/api/auth/login', { email: admin.email, password: PW })).body.token;

  // ── start: what is refused ───────────────────────────────────────────────────────
  const { challenge } = pkce();
  check('an unsupported provider is refused (400)', (await get(startPath('facebook', { challenge }))).status === 400);
  for (const bad of ['https://evil.example/steal', 'http://localhost/x', 'javascript:alert(1)', 'otherapp://auth', 'exp://192.168.0.2:8081/--/auth']) {
    check(`app link ${bad} is refused (400)`, (await get(startPath('google', { challenge, redirect: bad }))).status === 400);
  }
  check('no PKCE challenge -> 400', (await get(startPath('google', {}))).status === 400);
  check('a "plain" PKCE method -> 400', (await get(startPath('google', { challenge, method: 'plain' }))).status === 400);
  check('a too-short challenge -> 400', (await get(startPath('google', { challenge: 'short' }))).status === 400);
  const savedSecret = process.env.AC_GG_CSK; delete process.env.AC_GG_CSK;
  const unconf = await get(startPath('google', { challenge }));
  check('Google not configured on the server -> 503 with a readable page', unconf.status === 503 && /not configured/.test(unconf.text));
  process.env.AC_GG_CSK = savedSecret;
  process.env.AC_MOBILE_REDIRECTS = 'exp://';
  check('Expo Go links are allowed only when the server opts in (AC_MOBILE_REDIRECTS)',
    (await get(startPath('google', { challenge, redirect: 'exp://192.168.0.2:8081/--/auth' }))).status === 302);
  delete process.env.AC_MOBILE_REDIRECTS;

  // ── start: the provider redirect ─────────────────────────────────────────────────
  const g = await browser('google', { providerSays: { error: 'access_denied' } });
  const gu = g.providerUrl;
  check('Google start -> 302 to Google', g.start.status === 302 && gu.origin === 'https://accounts.google.com');
  check('...with the server\'s client id and its OWN callback (not the app link)',
    gu.searchParams.get('client_id') === 'google-client-id.apps.example'
    && gu.searchParams.get('redirect_uri') === 'https://app.example.test/api/auth/mobile/oauth/google/callback');
  check('...with a random state and the server\'s own S256 challenge (not the app\'s)',
    /^[A-Za-z0-9_-]{40,}$/.test(g.state) && gu.searchParams.get('code_challenge_method') === 'S256'
    && gu.searchParams.get('code_challenge') !== g.app.challenge);
  check('...openid email profile, account picker', /openid/.test(gu.searchParams.get('scope')) && /email/.test(gu.searchParams.get('scope')) && gu.searchParams.get('prompt') === 'select_account');
  check('only hashes of state are stored', (await pool.query('SELECT 1 FROM public.mobile_oauth_flows WHERE state_hash = $1', [g.state])).rowCount === 0);
  const m = await browser('microsoft', { providerSays: { error: 'access_denied' } });
  check('Microsoft start -> 302 to login.microsoftonline.com (common) with its callback and Graph scope',
    m.providerUrl.origin === 'https://login.microsoftonline.com' && m.providerUrl.pathname === '/common/oauth2/v2.0/authorize'
    && m.providerUrl.searchParams.get('redirect_uri') === 'https://app.example.test/api/auth/mobile/oauth/microsoft/callback'
    && /User\.Read/.test(m.providerUrl.searchParams.get('scope')));

  // ── the person cancels at the provider ───────────────────────────────────────────
  check('cancelling at the provider sends the app error=cancelled', g.callback.status === 302 && g.appLink === `${APP}?error=cancelled`);
  check('...and that attempt cannot be continued', (await get(`/api/auth/mobile/oauth/google/callback?state=${g.state}&code=x`)).status === 400);
  check('an unknown state -> 400 page, nothing sent to any app', (await get('/api/auth/mobile/oauth/google/callback?state=nope&code=x')).status === 400);
  check('a state used with the other provider -> 400', await (async () => {
    const x = await get(startPath('google', { challenge }));
    const st = new URL(x.location).searchParams.get('state');
    return (await get(`/api/auth/mobile/oauth/microsoft/callback?state=${st}&code=x`)).status === 400;
  })());

  // ── the provider's token endpoint refuses (a configuration fault) ─────────────────
  EXCHANGE_FAIL = 'invalid_client';
  const pf = await browser('google');
  EXCHANGE_FAIL = null;
  check('a provider refusal reaches the app with its short reason', pf.appLink === `${APP}?error=provider_error&reason=invalid_client`);

  // ── staff ─────────────────────────────────────────────────────────────────────────
  exchanges.length = 0;
  const s1 = await signIn('google', { email: admin.email, emailVerified: true, providerId: `g-${RUN}`, firstName: 'Ada', lastName: 'Lovelace' });
  check(`the browser returns to the app with a one-time code (got ${s1.callback.status})`, s1.callback.status === 302 && /^aureoncare:\/\/auth\?code=[A-Za-z0-9_-]{40,}$/.test(s1.appLink));
  const ex = exchanges[0] || {};
  check('the server redeemed the provider code with its callback URL and its PKCE verifier',
    ex.redirectUri === 'https://app.example.test/api/auth/mobile/oauth/google/callback'
    && crypto.createHash('sha256').update(ex.codeVerifier || '').digest('base64url') === s1.providerUrl.searchParams.get('code_challenge'));
  check(`A STAFF MEMBER SIGNS IN WITH GOOGLE ON MOBILE (got ${s1.redeem.status})`, s1.redeem.status === 200 && Boolean(s1.redeem.body.token) && s1.redeem.body.user.email === admin.email);
  const me = await fetch(`${BASE}/api/auth/me`, { headers: { Authorization: 'Bearer ' + s1.redeem.body.token } });
  check('...and the session works', me.status === 200);
  check('the code cannot be redeemed twice', (await post('/api/auth/mobile/oauth/redeem', { code: codeOf(s1.appLink), code_verifier: s1.app.verifier })).status === 400);
  const wiped = (await pool.query(`SELECT token_ciphertext, used_at FROM public.mobile_oauth_flows ORDER BY created_at DESC LIMIT 1`)).rows[0];
  check('the provider tokens are wiped once redeemed', wiped.token_ciphertext === null && wiped.used_at !== null);
  const s1m = await signIn('microsoft', { email: admin.email, emailVerified: true, providerId: `ms-${RUN}`, firstName: 'Ada', lastName: 'Lovelace' });
  check('...and with Microsoft', s1m.redeem.status === 200 && Boolean(s1m.redeem.body.token));

  // ── the handoff cannot be stolen ─────────────────────────────────────────────────
  IDENTITY = { email: admin.email, emailVerified: true, providerId: `g-${RUN}` };
  const stolen = await browser('google');
  const sealed = (await pool.query(`SELECT token_ciphertext FROM public.mobile_oauth_flows WHERE used_at IS NULL AND code_hash IS NOT NULL ORDER BY created_at DESC LIMIT 1`)).rows[0];
  check('while waiting, the provider token is stored encrypted, not in clear', sealed && sealed.token_ciphertext && !/provider-access-/.test(sealed.token_ciphertext));
  const thief = pkce();
  check('ANOTHER APP THAT CAUGHT THE LINK CANNOT USE THE CODE (wrong verifier -> 400)',
    (await post('/api/auth/mobile/oauth/redeem', { code: codeOf(stolen.appLink), code_verifier: thief.verifier })).status === 400);
  check('...and the attempt burns the code, so the real app must start again',
    (await post('/api/auth/mobile/oauth/redeem', { code: codeOf(stolen.appLink), code_verifier: stolen.app.verifier })).status === 400);
  check('a made-up code -> 400', (await post('/api/auth/mobile/oauth/redeem', { code: 'x'.repeat(43), code_verifier: thief.verifier })).status === 400);
  check('missing fields -> 400', (await post('/api/auth/mobile/oauth/redeem', {})).status === 400);
  const late = await browser('google');
  await pool.query(`UPDATE public.mobile_oauth_flows SET expires_at = now() - interval '1 second' WHERE used_at IS NULL AND code_hash IS NOT NULL`);
  check('a code older than two minutes -> 400', (await post('/api/auth/mobile/oauth/redeem', { code: codeOf(late.appLink), code_verifier: late.app.verifier })).status === 400);
  check('the same provider callback cannot be replayed', (await get(`/api/auth/mobile/oauth/google/callback?state=${late.state}&code=again`)).status === 400);

  // ── patients ─────────────────────────────────────────────────────────────────────
  const pt = await mkUser('patient');
  await pool.query(`INSERT INTO ${T}.patients (id, first_name, last_name, mrn, date_of_birth, email, portal_enabled) VALUES ($1,'Ada','Lovelace',$2,'1980-01-01',$3,true)`, [pt.id, `MRN-${RUN}`, pt.email]);
  const p1 = await signIn('google', { email: pt.email, emailVerified: true, providerId: `g-pt-${RUN}` });
  check(`A PATIENT SIGNS IN WITH GOOGLE ON MOBILE AND GETS THEIR PORTAL (got ${p1.redeem.status})`,
    p1.redeem.status === 200 && p1.redeem.body.portal === true && p1.redeem.body.patient.id === pt.id && Boolean(p1.redeem.body.sessionToken) && !p1.redeem.body.token);
  const prof = await fetch(`${BASE}/api/patient-portal/${pt.id}/profile`, { headers: { Authorization: 'Bearer ' + p1.redeem.body.sessionToken } });
  check('...and that portal session works', prof.status === 200);
  const p1m = await signIn('microsoft', { email: pt.email, emailVerified: true, providerId: `ms-pt-${RUN}` });
  check('...and with Microsoft', p1m.redeem.status === 200 && p1m.redeem.body.portal === true);

  const inv = await mkUser('patient');
  await pool.query(`INSERT INTO ${T}.patients (id, first_name, last_name, mrn, date_of_birth, email, portal_enabled) VALUES ($1,'Ina','Vited',$2,'1985-01-01',$3,false)`, [inv.id, `MRN-I-${RUN}`, inv.email]);
  check('the practice invites a patient to the portal', (await post('/api/portal-invites', { patientId: inv.id }, adminTok)).status === 201);
  const p2 = await signIn('microsoft', { email: inv.email, emailVerified: true, providerId: `ms-inv-${RUN}` });
  check(`AN INVITED PATIENT SIGNING IN ON MOBILE ACCEPTS THE INVITATION (got ${p2.redeem.status})`, p2.redeem.status === 200 && p2.redeem.body.portal === true);
  check('...portal access is now on', (await pool.query(`SELECT portal_enabled FROM ${T}.patients WHERE id = $1`, [inv.id])).rows[0].portal_enabled === true);

  const off = await mkUser('patient');
  await pool.query(`INSERT INTO ${T}.patients (id, first_name, last_name, mrn, date_of_birth, email, portal_enabled) VALUES ($1,'Off','Line',$2,'1990-01-01',$3,false)`, [off.id, `MRN-O-${RUN}`, off.email]);
  const p3 = await signIn('google', { email: off.email, emailVerified: true, providerId: `g-off-${RUN}` });
  check('a patient with portal access off (no invitation) is told so (403)', p3.redeem.status === 403 && /not switched on/.test(p3.redeem.body.error));

  // ── people who must not get in ───────────────────────────────────────────────────
  const p4 = await signIn('google', { email: `stranger_${RUN}@gmail.example`, emailVerified: true, providerId: `g-str-${RUN}` });
  check(`an unknown Google account gets no account (404, "ask for an invitation") (got ${p4.redeem.status})`, p4.redeem.status === 404 && /invitation/i.test(p4.redeem.body.error));
  check('...and none is created', (await pool.query('SELECT 1 FROM public.users WHERE email = $1', [`stranger_${RUN}@gmail.example`])).rowCount === 0);
  const blocked = await mkUser('nurse', { status: 'blocked' });
  const p5 = await signIn('google', { email: blocked.email, emailVerified: true, providerId: `g-blk-${RUN}` });
  check('a blocked account is refused (403)', p5.redeem.status === 403 && /blocked/.test(p5.redeem.body.error));
  const pending = await mkUser('nurse', { status: 'pending' });
  const p6 = await signIn('microsoft', { email: pending.email, emailVerified: true, providerId: `ms-pen-${RUN}` });
  check('a pending account is told it awaits approval (403)', p6.redeem.status === 403 && /pending/.test(p6.redeem.body.error));
  const p7 = await signIn('google', { email: admin.email, emailVerified: false, providerId: `g-unv-${RUN}` });
  check(`an UNVERIFIED provider email does not sign in to the matching account (got ${p7.redeem.status})`, p7.redeem.status !== 200 && !(p7.redeem.body && p7.redeem.body.token));

  // SEC-48: the "nOAuth" pattern. A foreign tenant's admin can set Graph `mail` to anyone's
  // address; it counts as verified only within the UPN's (tenant-proven) domain.
  const { microsoftMailVerified: mv } = jest_free_require('utils/socialTokenValidator.js');
  check('Microsoft: mail in the UPN\'s own domain is verified', mv('ada@contoso.com', 'ada@contoso.com') && mv('Ada@Contoso.com', 'a.l@contoso.com'));
  check('Microsoft: mail set to SOMEONE ELSE\'S domain is NOT verified', !mv(admin.email, 'evil@attacker.onmicrosoft.com'));
  check('Microsoft: no mailbox, or a guest (#EXT#) account, is NOT verified', !mv(null, 'a@contoso.com') && !mv('a@x.com', 'a_x.com#EXT#@t.onmicrosoft.com'));

  report();
})().catch(report);
