// SEC-36 / SEC-38: practice integration settings — who may change them, what reads expose,
// and whether a practice can forge the platform's Stripe webhook.
//
// Before the fix, ANY signed-in user (a patient included) could replace the practice's
// Stripe keys, Zoom and backup OAuth credentials, clinic settings and license keys, and
// the reads returned vendor API secrets, passwords and the Zoom/backup OAuth tokens. The
// Stripe settings row is global, and its webhook secret overrode the platform's, so whoever
// set it could sign forged Stripe events. Each block fails against the code before the fix.

const path = require('path');
const crypto = require('crypto');

const BACKEND = path.join(__dirname, '..', '..');
process.env.PORT = process.env.TEST_PORT || '4887';
process.env.NODE_ENV = 'development';
process.env.AC_JWT_S = process.env.AC_JWT_S || crypto.randomBytes(48).toString('base64');
process.env.AC_TK_S = process.env.AC_TK_S || process.env.AC_JWT_S;
process.env.AC_PW_BREACH_CHECK = 'false';
const PLATFORM_WHS = 'whsec_platform_' + crypto.randomBytes(8).toString('hex');
process.env.AC_STRIPE_WHS = PLATFORM_WHS;
const BASE = `http://127.0.0.1:${process.env.PORT}`;

const pool = require(path.join(BACKEND, 'db.js'));
const bcrypt = require(path.join(BACKEND, '..', 'node_modules', 'bcryptjs'));
const { provisionTenant } = require(path.join(BACKEND, 'services/tenantProvisioning.js'));
const { SECRET_FIELDS } = require(path.join(BACKEND, 'utils/redactSecrets.js'));
require(path.join(BACKEND, 'server.js'));

const results = [];
const check = (n, c) => results.push([n, !!c]);
const call = async (method, url, token, body) => {
  const r = await fetch(BASE + url, { method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text(); let b = null; try { b = JSON.parse(t); } catch { b = t; }
  return { status: r.status, body: b, text: t };
};
const report = (err) => {
  let failed = 0;
  for (const [n, c] of results) { console.log(`  ${c ? 'ok  ' : 'FAIL'} ${n}`); if (!c) failed += 1; }
  if (err) { console.error(`\nSTOPPED: ${err.message || err}`); console.error(err); }
  else console.log(`\n${results.length - failed}/${results.length} checks passed.`);
  process.exit(err || failed ? 1 : 0);
};
// Any stored secret value showing up anywhere in a response body.
const leaks = (text, values) => values.filter((v) => v && text.includes(v));

(async () => {
  for (let i = 0; i < 40; i++) { try { await fetch(BASE + '/health'); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  const RUN = crypto.randomBytes(4).toString('hex');
  const t = await provisionTenant(pool, { name: `Authz Clinic ${RUN}` });
  const schema = t.tenant.schema_name;
  const mk = async (role) => {
    const email = `${role}_${RUN}@example.com`;
    await pool.query(`INSERT INTO public.users (id,email,first_name,last_name,role,status,password_hash,practice_id,created_at)
      VALUES (gen_random_uuid(),$1,'A','B',$2,'active',$3,$4,NOW())`,
      [email, role, await bcrypt.hash('A-Strong-Passphrase!23', 12), t.practiceId]);
    const r = await call('POST', '/api/auth/login', null, { email, password: 'A-Strong-Passphrase!23' });
    return r.body.token;
  };
  const admin = await mk('admin');
  const patient = await mk('patient');
  const receptionist = await mk('receptionist');
  check('admin, patient and receptionist can sign in', admin && patient && receptionist);

  const { rows: [stripeBefore] } = await pool.query('SELECT * FROM public.stripe_integration_settings LIMIT 1');

  // ── 1. writes: refused for non-admins ───────────────────────────────────────────
  const WRITES = [
    ['POST', '/api/stripe-settings', { publishable_key: 'pk_test_x', secret_key: 'sk_test_attacker' }],
    ['PATCH', '/api/stripe-settings/toggle', { is_enabled: false }],
    ['POST', '/api/stripe-settings/test', {}],
    ['POST', '/api/telehealth-settings/zoom', { api_key: 'k', api_secret: 'attacker' }],
    ['PATCH', '/api/telehealth-settings/zoom/toggle', { is_enabled: true }],
    ['POST', '/api/telehealth-settings/zoom/test', {}],
    ['DELETE', '/api/telehealth-settings/zoom'],
    ['POST', '/api/vendor-integration-settings/labcorp', { api_key: 'k', api_secret: 'attacker' }],
    ['PATCH', '/api/vendor-integration-settings/labcorp/toggle', { is_enabled: true }],
    ['DELETE', '/api/vendor-integration-settings/labcorp'],
    ['POST', '/api/backup-providers/google_drive', { client_id: 'x', client_secret: 'attacker' }],
    ['DELETE', '/api/backup-providers/google_drive'],
    ['POST', '/api/clinic-settings', { name: 'Hijacked' }],
    ['POST', '/api/clinic-settings/working-hours', {}],
    ['POST', '/api/clinic-settings/appointment-settings', {}],
    ['POST', '/api/licenses/generate', { planName: 'enterprise' }],
    ['POST', '/api/licenses/activate', { key: 'x' }],
    ['POST', '/api/licenses/revoke', { key: 'x' }],
    ['GET', '/api/licenses'],
    ['GET', '/api/integrations/oauth/zoom/initiate'],
    ['GET', '/api/integrations/oauth/zoom/credentials'],
    ['POST', '/api/integrations/oauth/zoom/credentials', { client_id: 'x', client_secret: 'attacker' }],
    ['POST', '/api/integrations/oauth/zoom/refresh', {}],
    ['DELETE', '/api/integrations/oauth/zoom'],
  ];
  for (const [who, tok] of [['patient', patient], ['receptionist', receptionist]]) {
    const allowed = [];
    for (const [m, u, b] of WRITES) {
      const r = await call(m, u, tok, b);
      if (r.status !== 403) allowed.push(`${m} ${u} -> ${r.status}`);
    }
    check(`A ${who.toUpperCase()} IS REFUSED (403) ON ALL ${WRITES.length} SETTINGS WRITES${allowed.length ? ': ' + allowed.join('; ') : ''}`,
      allowed.length === 0);
  }
  check('patients cannot fetch the Zoom host token',
    (await call('GET', '/api/telehealth-settings/zoom/host-token', patient)).status === 403);
  check('...nor start a meeting as the practice',
    (await call('POST', '/api/telehealth-settings/zoom/instant-meeting', patient, {})).status === 403);

  // ── 2. admins can still do their job ───────────────────────────────────────────
  const V1 = 'vendor-secret-' + RUN; const PW = 'vendor-pass-' + RUN; const T1 = 'tele-secret-' + RUN; const B1 = 'backup-secret-' + RUN;
  const vsave = await call('POST', '/api/vendor-integration-settings/labcorp', admin,
    // No base_url: the SSRF guard resolves it in DNS, which a sandboxed runner may not have.
    { api_key: 'key-' + RUN, api_secret: V1, username: 'u', password: PW });
  check(`an admin can save vendor settings (got ${vsave.status})`, vsave.status === 200);
  // Option (a): Stripe is platform-managed. Its shared row cannot be edited from a practice
  // at all — not even by an admin — and the read is a status, with no keys in it.
  const adminStripe = [];
  for (const [m, u, b] of [['POST', '/api/stripe-settings', { secret_key: 'sk_test_admin' }],
                           ['PATCH', '/api/stripe-settings/toggle', { is_enabled: true }],
                           ['POST', '/api/stripe-settings/test', {}]]) {
    const r = await call(m, u, admin, b);
    if (r.status !== 403) adminStripe.push(`${m} ${u} -> ${r.status}`);
  }
  check(`EVEN A PRACTICE ADMIN CANNOT EDIT THE SHARED STRIPE SETTINGS${adminStripe.length ? ': ' + adminStripe.join('; ') : ''}`,
    adminStripe.length === 0);
  const sread = await call('GET', '/api/stripe-settings', admin);
  check('the Stripe read is a platform-managed status with no key fields',
    sread.status === 200 && sread.body.managed_by === 'platform'
    && !/publishable_key|secret_key|webhook_secret/.test(sread.text));
  const { rows: [stripeAfter] } = await pool.query('SELECT secret_key FROM public.stripe_integration_settings LIMIT 1');
  check('and the row was not changed by those attempts',
    (stripeAfter && stripeAfter.secret_key) === (stripeBefore && stripeBefore.secret_key));
  const vtog = await call('PATCH', '/api/vendor-integration-settings/labcorp/toggle', admin, { is_enabled: false });
  check(`vendor toggle no longer answers 500 (got ${vtog.status})`, vtog.status === 200);
  check('an admin can save telehealth settings',
    (await call('POST', '/api/telehealth-settings/zoom', admin, { api_key: 'k', api_secret: T1, client_id: 'c', client_secret: T1 })).status === 200);
  await pool.query(`UPDATE ${schema}.telehealth_provider_settings SET access_token = $1, refresh_token = $1, is_enabled = true WHERE provider_type = 'zoom'`, ['zoom-token-' + RUN]);
  check('an admin can save backup provider settings',
    (await call('POST', '/api/backup-providers/google_drive', admin, { client_id: 'x', client_secret: B1 })).status === 200);
  await pool.query(`UPDATE ${schema}.backup_provider_settings SET settings = $1 WHERE provider_type = 'google_drive'`,
    [JSON.stringify({ access_token: 'drive-token-' + RUN, refresh_token: 'drive-refresh-' + RUN, folder: 'AureonCare' })]);
  check('an admin can save clinic settings',
    (await call('POST', '/api/clinic-settings/working-hours', admin, {})).status < 400);

  // ── 3. no read carries a secret ────────────────────────────────────────────────
  const secrets = [V1, PW, T1, B1, 'zoom-token-' + RUN, 'drive-token-' + RUN, 'drive-refresh-' + RUN];
  const READS = ['/api/vendor-integration-settings', '/api/vendor-integration-settings/labcorp',
    '/api/telehealth-settings', '/api/telehealth-settings/zoom', '/api/telehealth-settings/active/provider',
    '/api/backup-providers', '/api/backup-providers/google_drive', '/api/integrations/oauth/zoom/credentials',
    '/api/stripe-settings'];
  for (const who of [['admin', admin], ['patient', patient]]) {
    const found = [];
    for (const u of READS) {
      const r = await call('GET', u, who[1]);
      const l = leaks(r.text, secrets);
      if (l.length) found.push(`${u}: ${l.join(',')}`);
      if (r.status === 200 && /"(api_secret|client_secret|webhook_secret|access_token|refresh_token|password|secret_key)"\s*:\s*"[^"•]/.test(r.text)) found.push(`${u}: raw secret field`);
    }
    check(`NO SETTINGS READ RETURNS A STORED SECRET (as ${who[0]})${found.length ? ': ' + found.join('; ') : ''}`, found.length === 0);
  }
  const vread = await call('GET', '/api/vendor-integration-settings/labcorp', admin);
  check('reads say whether each secret is set instead',
    vread.body && vread.body.has_api_secret === true && vread.body.has_password === true);
  const bread = await call('GET', '/api/backup-providers/google_drive', admin);
  check('tokens inside the settings JSON are scrubbed too, other settings kept',
    bread.body && bread.body.settings && bread.body.settings.has_access_token === true && bread.body.settings.folder === 'AureonCare');

  // ── 4. a blank secret on save keeps the stored one ─────────────────────────────
  await call('POST', '/api/vendor-integration-settings/labcorp', admin, { api_key: 'key2-' + RUN, api_secret: '', password: '' });
  const { rows: [vrow] } = await pool.query(`SELECT api_key, api_secret, password FROM ${schema}.vendor_integration_settings WHERE vendor_type='labcorp'`);
  check('re-saving a form whose secret fields are blank keeps the stored secrets',
    vrow.api_secret === V1 && vrow.password === PW && vrow.api_key === 'key2-' + RUN);
  await call('POST', '/api/telehealth-settings/zoom', admin, { api_key: 'k2', api_secret: '', client_secret: '' });
  const { rows: [trow] } = await pool.query(`SELECT api_secret, client_secret FROM ${schema}.telehealth_provider_settings WHERE provider_type='zoom'`);
  check('...for telehealth too', trow.api_secret === T1 && trow.client_secret === T1);

  // ── 5. the platform's Stripe webhook cannot be forged via the settings row ──────
  const sign = (secret, body, ts = Math.floor(Date.now() / 1000)) =>
    `t=${ts},v1=${crypto.createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex')}`;
  const ATTACKER_WHS = 'whsec_attacker_' + RUN;
  await pool.query(`UPDATE public.stripe_integration_settings SET webhook_secret = $1, use_platform_integration = false`, [ATTACKER_WHS]);
  const evt = JSON.stringify({ id: 'evt_' + RUN, type: 'test.ping', data: { object: {} } });
  const post = (sig) => fetch(BASE + '/api/stripe-webhook', { method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Stripe-Signature': sig }, body: evt }).then((r) => r.status);
  const forged = await post(sign(ATTACKER_WHS, evt));
  check(`AN EVENT SIGNED WITH A SECRET SET IN THE SETTINGS ROW IS REJECTED (got ${forged})`, forged >= 400);
  const genuine = await post(sign(PLATFORM_WHS, evt));
  check(`an event signed with the platform secret is still accepted (got ${genuine})`, genuine < 300);

  // restore the global row exactly as it was
  if (stripeBefore) {
    await pool.query(`UPDATE public.stripe_integration_settings SET webhook_secret = $1, use_platform_integration = $2,
      secret_key = $3, publishable_key = $4, is_enabled = $5`,
      [stripeBefore.webhook_secret, stripeBefore.use_platform_integration, stripeBefore.secret_key,
       stripeBefore.publishable_key, stripeBefore.is_enabled]);
  }
  report();
})().catch(report);
