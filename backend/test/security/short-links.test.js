// Short links (/s/<code>) for every link AureonCare sends or shares.
//
// Self-hosted: invite and reset links carry one-time sign-in tokens, so they must not pass
// through a third-party shortener. Proves: links redirect and expire with what they point
// to; the table holds neither the code nor the destination in readable form; unknown codes
// reveal nothing; staff can shorten only their own booking page or appointment meeting;
// and invite / reset emails now carry the short form.

const path = require('path');
const crypto = require('crypto');

const BACKEND = path.join(__dirname, '..', '..');
process.env.PORT = process.env.TEST_PORT || '4877';
process.env.NODE_ENV = 'development';
process.env.AC_JWT_S = process.env.AC_JWT_S || crypto.randomBytes(48).toString('base64');
process.env.AC_TK_S = process.env.AC_TK_S || process.env.AC_JWT_S;
process.env.AC_PW_BREACH_CHECK = 'false';
process.env.FRONTEND_URL = 'https://app.example.test';
process.env.AC_SHORT_BASE = '';
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
const outbox = [];
notify.sendEmail = async (to, subject, html) => { outbox.push({ to, subject, html }); return { sent: true }; };

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
  const { shorten, _codeHash } = require(path.join(BACKEND, 'services/shortLinks.js'));
  const { registerBookingSlug } = require(path.join(BACKEND, 'services/bookingRouting.js'));
  const RUN = crypto.randomBytes(4).toString('hex');
  const PW = 'A-Strong-Passphrase!23';
  const open = (url) => fetch(BASE + new URL(url).pathname, { redirect: 'manual' });

  // ── 1. shorten + open ───────────────────────────────────────────────────────────
  const target = `https://app.example.test/portal/activate?token=secret-${RUN}`;
  const short = await shorten(target, { expiresAt: new Date(Date.now() + 3600e3), kind: 'test' });
  check(`a short link is <app>/s/<12 characters> (got ${short})`, /^https:\/\/app\.example\.test\/s\/[A-Za-z0-9]{12}$/.test(short));
  check('...and is much shorter than the original', short.length < target.length);
  const r = await open(short);
  check(`OPENING IT REDIRECTS TO THE DESTINATION (got ${r.status})`, r.status === 302 && r.headers.get('location') === target);
  check('...never cached, no Referer sent, not indexed',
    /no-store/.test(r.headers.get('cache-control') || '') && r.headers.get('referrer-policy') === 'no-referrer' && /noindex/.test(r.headers.get('x-robots-tag') || ''));
  check('it can be opened more than once (until it expires)', (await open(short)).status === 302);

  // ── 1b. QR code image for a short link ──────────────────────────────────────────
  const qr = await fetch(`${short}/qr.png`.replace('https://app.example.test', BASE));
  const qrBytes = Buffer.from(await qr.arrayBuffer());
  check(`the QR image is a PNG (got ${qr.status} ${qr.headers.get('content-type')})`,
    qr.status === 200 && /image\/png/.test(qr.headers.get('content-type') || '') && qrBytes.slice(1, 4).toString() === 'PNG');
  check('...and fetching it does not count as opening the link', await (async () => {
    const c = short.split('/s/')[1];
    const before = (await pool.query('SELECT use_count FROM public.short_links WHERE code_hash = $1', [_codeHash(c)])).rows[0].use_count;
    await fetch(`${BASE}/s/${c}/qr.png`);
    const after = (await pool.query('SELECT use_count FROM public.short_links WHERE code_hash = $1', [_codeHash(c)])).rows[0].use_count;
    return before === after;
  })());
  check('a malformed code gets no QR image (404)', (await fetch(`${BASE}/s/bad/qr.png`)).status === 404);

  // ── 2. nothing readable at rest ─────────────────────────────────────────────────
  const code = short.split('/s/')[1];
  const { rows: [row] } = await pool.query('SELECT * FROM public.short_links WHERE code_hash = $1', [_codeHash(code)]);
  const dump = JSON.stringify(row) + Buffer.from(row.target_enc).toString('latin1');
  check('THE TABLE HOLDS NEITHER THE CODE NOR THE DESTINATION', row && !dump.includes(code) && !dump.includes('secret-' + RUN) && !dump.includes('activate'));
  check('opens are counted', row.use_count >= 2);

  // ── 3. expiry, unknown and malformed codes ──────────────────────────────────────
  const dead = await shorten('https://app.example.test/x', { expiresAt: new Date(Date.now() - 1000) });
  const d = await open(dead);
  check(`an expired link does not redirect (got ${d.status})`, d.status === 404 && !d.headers.get('location') && /no longer valid/.test(await d.text()));
  const u = await fetch(`${BASE}/s/AAAAAAAAAAAA`, { redirect: 'manual' });
  check('an unknown code gets the same page (no hint it never existed)', u.status === 404 && /no longer valid/.test(await u.text()));
  check('a malformed code is refused the same way', (await fetch(`${BASE}/s/../../etc`, { redirect: 'manual' })).status === 404);
  check('a non-http target is not shortened (returned as is)', (await shorten('javascript:alert(1)')) === 'javascript:alert(1)');

  // ── 4. staff API: only their own booking page / meeting ─────────────────────────
  const mkPractice = async (label) => {
    const t = await provisionTenant(pool, { name: `${label} ${RUN}` });
    const email = `adm_${label}_${RUN}@example.com`.toLowerCase();
    const { rows: [u2] } = await pool.query(`INSERT INTO public.users (id,email,first_name,last_name,role,status,password_hash,practice_id,created_at)
      VALUES (gen_random_uuid(),$1,'A','B','admin','active',$2,$3,NOW()) RETURNING id`, [email, await bcrypt.hash(PW, 12), t.practiceId]);
    const token = (await call('POST', '/api/auth/login', null, { email, password: PW })).body.token;
    return { t, token, userId: u2.id, email, schema: t.tenant.schema_name };
  };
  const A = await mkPractice('Alpha'); const B = await mkPractice('Beta');
  const slugA = `dr-a-${RUN}`; const slugB = `dr-b-${RUN}`;
  await registerBookingSlug(pool, slugA, A.t.tenant.id, A.userId);
  await registerBookingSlug(pool, slugB, B.t.tenant.id, B.userId);
  const bk = await call('POST', '/api/short-links', A.token, { kind: 'booking', slug: slugA });
  check(`staff can shorten their booking link (got ${bk.status})`, bk.status === 200 && /\/s\/[A-Za-z0-9]{12}$/.test(bk.body.url));
  check('...and it opens their booking page', (await open(bk.body.url)).headers.get('location') === `https://app.example.test/book/${slugA}`);
  check("ANOTHER PRACTICE'S BOOKING LINK IS REFUSED (404)", (await call('POST', '/api/short-links', A.token, { kind: 'booking', slug: slugB })).status === 404);
  check('an arbitrary destination cannot be shortened (400)',
    (await call('POST', '/api/short-links', A.token, { kind: 'url', url: 'https://evil.example' })).status === 400);
  const apptId = crypto.randomUUID(); const pid = crypto.randomUUID();
  await pool.query(`INSERT INTO ${A.schema}.patients (id, first_name, last_name, mrn, date_of_birth) VALUES ($1,'P','Q',$2,'1970-01-01')`, [pid, `M-${RUN}`]);
  await pool.query(`INSERT INTO ${A.schema}.appointments (id, patient_id, start_time, end_time, status, meeting_url)
    VALUES ($1,$2, now() + interval '1 day', now() + interval '1 day 30 minutes', 'scheduled', 'https://zoom.example/j/123?pwd=abc')`, [apptId, pid]);
  const mt = await call('POST', '/api/short-links', A.token, { kind: 'meeting', appointmentId: apptId });
  check(`staff can shorten an appointment's meeting link (got ${mt.status})`, mt.status === 200
    && (await open(mt.body.url)).headers.get('location') === 'https://zoom.example/j/123?pwd=abc');
  check("another practice cannot shorten that appointment's link (404)",
    (await call('POST', '/api/short-links', B.token, { kind: 'meeting', appointmentId: apptId })).status === 404);
  check('no session → 401', (await call('POST', '/api/short-links', null, { kind: 'booking', slug: slugA })).status === 401);

  // ── 5. invites and password reset now send short links ──────────────────────────
  const inviteEmail = `new_${RUN}@example.com`;
  const inv = await call('POST', '/api/invites', A.token, { email: inviteEmail, role: 'nurse' });
  check(`a staff invite's link is short (got ${inv.body && inv.body.inviteUrl})`, /\/s\/[A-Za-z0-9]{12}$/.test(inv.body.inviteUrl || ''));
  const mailed = outbox.find((m) => m.to === inviteEmail);
  check('...the email carries the short link, not the token', mailed && mailed.html.includes(inv.body.inviteUrl) && !/accept-invite\?token=/.test(mailed.html));
  check('...with a scan-to-open QR code of that link', mailed && mailed.html.includes(`src="${inv.body.inviteUrl}/qr.png"`) && /alt="QR code for the link above"/.test(mailed.html));
  const loc = (await open(inv.body.inviteUrl)).headers.get('location') || '';
  check('...and it opens the invite acceptance page', /^https:\/\/app\.example\.test\/accept-invite\?token=[A-Za-z0-9_-]{30,}$/.test(loc));
  await call('POST', '/api/auth/forgot-password', null, { email: A.email });
  const reset = outbox.find((m) => m.to === A.email && /reset/i.test(m.subject));
  const resetShort = reset && (/https:\/\/app\.example\.test\/s\/[A-Za-z0-9]{12}/.exec(reset.html) || [])[0];
  check('the password reset email carries a short link', Boolean(resetShort));
  check('...and its QR code', reset && reset.html.includes(`${resetShort}/qr.png`));
  check('...which opens the reset page', resetShort && /\/reset-password\?token=[a-f0-9]{64}$/.test((await open(resetShort)).headers.get('location') || ''));
  const { rows: [exp] } = await pool.query('SELECT expires_at FROM public.short_links ORDER BY created_at DESC LIMIT 1');
  check('...and expires with the reset token (about an hour)', exp.expires_at && Math.abs(new Date(exp.expires_at) - Date.now() - 3600e3) < 120e3);
})().then(() => report(), report);
