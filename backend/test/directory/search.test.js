// Directory search (Phase 3): one search box over SEARCHABLE practices only.
//
// Proves: only "Searchable" practices of active tenants are ever found (never link-only or
// off), only consented and unhidden providers can be found by name; specialty, place, name
// and "near me" reading; neutral ranking; the query is never logged and never accepted in a
// URL; answers are no-store; the sitemap lists only searchable profiles; and changes
// (visibility, suspension) take effect in search.

const path = require('path');
const crypto = require('crypto');

const BACKEND = path.join(__dirname, '..', '..');
process.env.PORT = process.env.TEST_PORT || '4879';
process.env.NODE_ENV = 'development';
process.env.AC_JWT_S = process.env.AC_JWT_S || crypto.randomBytes(48).toString('base64');
process.env.AC_TK_S = process.env.AC_TK_S || process.env.AC_JWT_S;
process.env.AC_PW_BREACH_CHECK = 'false';
process.env.FRONTEND_URL = 'https://app.example.test';
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
  const D = require(path.join(BACKEND, 'services/directorySearch.js'));
  const RUN = crypto.randomBytes(3).toString('hex');
  const PW = 'A-Strong-Passphrase!23';
  // Capture everything the server logs while searching.
  const logged = [];
  for (const k of ['log', 'warn', 'error', 'info']) { const o = console[k]; console[k] = (...a) => { logged.push(a.map(String).join(' ')); o.apply(console, a); }; }
  const search = async (q, extra = {}, headers = {}) => {
    const r = await fetch(`${BASE}/api/directory/search`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ q, ...extra }) });
    return { status: r.status, body: await r.json().catch(() => ({})), cache: r.headers.get('cache-control'), robots: r.headers.get('x-robots-tag') };
  };
  const names = (r) => (r.body.results || []).map((x) => x.name);

  const mk = async (label, { visibility, city, state, postal, lat, lng, specialty, docs }) => {
    const t = await provisionTenant(pool, { name: `${label} ${RUN}` });
    const email = `adm_${label}_${RUN}@example.com`.toLowerCase().replace(/\s+/g, '');
    const { rows: [a] } = await pool.query(`INSERT INTO public.users (id,email,first_name,last_name,role,status,password_hash,practice_id,created_at)
      VALUES (gen_random_uuid(),$1,'A','B','admin','active',$2,$3,NOW()) RETURNING id`, [email, await bcrypt.hash(PW, 12), t.practiceId]);
    const token = (await call('POST', '/api/auth/login', null, { email, password: PW })).body.token;
    const loc = crypto.randomUUID();
    await pool.query(`INSERT INTO ${t.tenant.schema_name}.locations (id, name, address, city, state, postal_code, country, latitude, longitude, is_active)
      VALUES ($1,'Main','1 Main St',$2,$3,$4,'US',$5,$6,true)`, [loc, city, state, postal, lat, lng]);
    const docIds = [];
    for (const d of docs || []) {
      const demail = `${d.first}_${label}_${RUN}@example.com`.toLowerCase().replace(/\s+/g, '');
      const { rows: [u] } = await pool.query(`INSERT INTO public.users (id,email,first_name,last_name,role,status,password_hash,practice_id,created_at)
        VALUES (gen_random_uuid(),$1,$2,$3,'doctor','active',$4,$5,NOW()) RETURNING id`, [demail, d.first, d.last, await bcrypt.hash(PW, 12), t.practiceId]);
      await pool.query(`INSERT INTO public.providers (id, first_name, last_name, specialization) VALUES ($1,$2,$3,$4)`, [u.id, d.first, d.last, d.spec]);
      const dt = (await call('POST', '/api/auth/login', null, { email: demail, password: PW })).body.token;
      if (d.consent) await call('PUT', '/api/practice-profile/me', dt, { consented: true });
      if (d.hidden) await call('PUT', `/api/practice-profile/providers/${u.id}/hidden`, token, { hidden: true });
      docIds.push(u.id);
    }
    const slug = `${label.toLowerCase().replace(/\s+/g, '-')}-${RUN}`;
    await call('PUT', '/api/practice-profile', token, { slug, display_name: `${label} ${RUN}`, visibility, location_ids: [loc], specialty_codes: specialty ? [specialty] : [] });
    return { t, token, slug, name: `${label} ${RUN}` };
  };
  const A = await mkPractice();
  async function mkPractice() {
    return mk('Alpha Skin', { visibility: 'searchable', city: 'Springfield', state: 'IL', postal: '62701', lat: 39.78, lng: -89.65, specialty: 'dermatology',
      docs: [{ first: 'Rina', last: 'Derm', spec: 'Dermatology', consent: true }, { first: 'Silent', last: 'Smithers', spec: 'Dermatology', consent: false },
        { first: 'Hidden', last: 'Hopkins', spec: 'Dermatology', consent: true, hidden: true }] });
  }
  const B = await mk('Bravo Family', { visibility: 'searchable', city: 'Austin', state: 'TX', postal: '73301', lat: null, lng: null, specialty: 'general_practice',
    docs: [{ first: 'Arjun', last: 'Patel', spec: 'Family Medicine', consent: true }] });
  const C = await mk('Charlie Skin', { visibility: 'link', city: 'Springfield', state: 'IL', postal: '62701', lat: 39.79, lng: -89.64, specialty: 'dermatology' });
  const Dp = await mk('Delta Skin', { visibility: 'off', city: 'Springfield', state: 'IL', postal: '62701', lat: 39.79, lng: -89.64, specialty: 'dermatology' });
  const ours = (r) => names(r).filter((n) => n.includes(RUN));
  D.invalidate();

  // ── what can be found ────────────────────────────────────────────────────────────
  let r = await search('dermatologist');
  check(`"dermatologist" finds the SEARCHABLE dermatology practice (got ${JSON.stringify(ours(r))})`, ours(r).includes(A.name));
  check('...NEVER the link-only or off ones', !ours(r).includes(C.name) && !ours(r).includes(Dp.name));
  check('the answer says what was understood', r.body.understood.specialties.includes('Dermatology'));
  r = await search('skin doctor in springfield');
  check('"skin doctor in springfield" → the Springfield dermatology practice', JSON.stringify(ours(r)) === JSON.stringify([A.name]));
  r = await search('dermatologist 62701');
  check('a postcode is understood as the place', ours(r).includes(A.name) && r.body.understood.place === '62701');
  r = await search('dermatologist in austin');
  check('specialty AND place must both match (none in Austin)', ours(r).length === 0);
  r = await search('family doctor austin tx');
  check('"family doctor austin tx" → the Austin GP', JSON.stringify(ours(r)) === JSON.stringify([B.name]));

  r = await search('Dr Patel');
  const bp = (r.body.results || []).find((x) => x.name === B.name);
  check('a CONSENTED provider is found by name, shown on the practice result', bp && bp.providers.some((p) => p.name === 'Dr. Arjun Patel'));
  r = await search('Patell');
  check('...even with a typo', ours(r).includes(B.name) && r.body.understood.name === 'patell');
  r = await search('Smithers');
  check('a provider who did NOT consent cannot be found by name', !JSON.stringify(r.body).includes('Smithers') && r.body.understood.name === null);
  r = await search('Hopkins');
  check('a provider an admin HID cannot be found by name', !JSON.stringify(r.body).includes('Hopkins'));
  r = await search('Alpha Skin');
  const ar = (r.body.results || []).find((x) => x.name === A.name);
  check('practice names are searchable; listed providers only on the card', ar && ar.providers.some((p) => p.name === 'Dr. Rina Derm')
    && !JSON.stringify(ar).includes('Smithers') && !JSON.stringify(ar).includes('Hopkins'));

  // ── near me ──────────────────────────────────────────────────────────────────────
  r = await search('dermatologist', { lat: 39.7817, lng: -89.6501 });
  const near = (r.body.results || []).find((x) => x.name === A.name);
  check('"near me" gives a distance where the practice published coordinates', near && near.distanceKm !== null && near.distanceKm < 5 && r.body.understood.nearby);
  r = await search('', { lat: 30.27, lng: -97.74 });
  check('"near me" far away leaves out practices beyond 100 km, keeps those without coordinates',
    !ours(r).includes(A.name) && ours(r).includes(B.name));

  // ── no logs, no URLs, no caching ─────────────────────────────────────────────────
  const secret = `uniquequery${RUN}`;
  logged.length = 0;
  await search(`${secret} dermatologist`);
  await search(`${secret}`, { lat: 'oops', lng: 12 });
  check('THE SEARCH TEXT APPEARS IN NO SERVER LOG', !logged.some((l) => l.includes(secret)));
  r = await search('dermatologist');
  check('answers are no-store and not indexed', /no-store/.test(r.cache || '') && /noindex/.test(r.robots || ''));
  check('a query in the URL is not accepted (GET → not found)', (await fetch(`${BASE}/api/directory/search?q=dermatologist`)).status === 404);
  const cookieOnly = await search('dermatologist', {}, { Cookie: 'ac_session=stale-session-cookie' });
  check('works for a signed-in browser without a CSRF header (session-independent)', cookieOnly.status === 200);
  check('an over-long query is cut, not an error', (await search('x'.repeat(5000))).status === 200);

  // ── practice names ───────────────────────────────────────────────────────────────
  // A clinic whose NAME contains a place and a specialty it does not list.
  const E = await mk('Springfield Family Clinic', { visibility: 'searchable', city: 'Shelbyville', state: 'IL', postal: '62565', lat: null, lng: null, specialty: 'dermatology' });
  const F = await mk('Echo Legal Name', { visibility: 'searchable', city: 'Austin', state: 'TX', postal: '73301', lat: null, lng: null, specialty: 'general_practice' });
  await call('PUT', '/api/practice-profile', F.token, { display_name: `Sunrise Care ${RUN}` });
  D.invalidate();
  r = await search(`Springfield Family Clinic ${RUN}`);
  check(`A PRACTICE NAME WITH A PLACE AND A SPECIALTY IN IT FINDS THAT PRACTICE FIRST (got ${JSON.stringify(ours(r))})`, ours(r)[0] === E.name);
  check('...and says it matched the practice name', r.body.results[0].matchedBy === 'practice-name' && r.body.understood.practiceName === true);
  r = await search(`Sprngfield Famly Clinic ${RUN}`);
  check(`...even with typos (got ${JSON.stringify(ours(r))})`, ours(r)[0] === E.name);
  r = await search(`Sunrise Care ${RUN}`);
  check('the name shown on the profile finds it', ours(r)[0] === `Sunrise Care ${RUN}`);
  r = await search(`Echo Legal Name ${RUN}`);
  check(`the practice's own (legal) name finds it too (got ${JSON.stringify(ours(r))})`, ours(r)[0] === `Sunrise Care ${RUN}`);
  r = await search(`Charlie Skin ${RUN}`);
  check('a LINK-ONLY practice is not found by its name either', !ours(r).includes(C.name));
  r = await search('skin doctor in springfield');
  check('specialty + place searches are unchanged', JSON.stringify(ours(r)) === JSON.stringify([A.name]));

  // ── changes take effect ──────────────────────────────────────────────────────────
  const sm = await (await fetch(`${BASE}/sitemap-practices.xml`)).text();
  check('the sitemap lists searchable profiles only', sm.includes(`/p/${A.slug}`) && sm.includes(`/p/${B.slug}`) && !sm.includes(C.slug) && !sm.includes(Dp.slug));
  const robots = await (await fetch(`${BASE}/robots.txt`)).text();
  check('robots.txt points to the sitemap and keeps /api and /s out', /Sitemap: .*\/sitemap-practices\.xml/.test(robots) && robots.includes('Disallow: /api/'));
  await call('PUT', '/api/practice-profile', A.token, { visibility: 'link' });
  check('switching a practice to Link only removes it from search at once', !ours(await search('dermatologist')).includes(A.name));
  await pool.query(`UPDATE control.tenants SET status = 'suspended' WHERE practice_id = $1`, [B.t.practiceId]);
  D.invalidate();
  check('a suspended practice is not found', !ours(await search('family doctor')).includes(B.name));
  await pool.query(`UPDATE control.tenants SET status = 'active' WHERE practice_id = $1`, [B.t.practiceId]);
})().then(() => report(), report);
