// Directory Phase 2: practice profiles, provider listing consent, Off / Link only / Searchable.
//
// Proves the visibility rules (including the unguessable link-only address), that only
// admins edit and only providers consent (admins can hide, never list), that the page shows
// only consented providers and only the fields they chose, photo safety (metadata stripped,
// provider photos need approval), published locations, booking buttons, escaping, and the
// append-only event log.

const path = require('path');
const crypto = require('crypto');

const BACKEND = path.join(__dirname, '..', '..');
process.env.PORT = process.env.TEST_PORT || '4878';
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
  const RUN = crypto.randomBytes(3).toString('hex');
  const PW = 'A-Strong-Passphrase!23';
  const page = async (slug) => { const r = await fetch(`${BASE}/p/${slug}`); return { status: r.status, html: await r.text(), robots: r.headers.get('x-robots-tag') }; };
  const mkPractice = async (label) => {
    const t = await provisionTenant(pool, { name: `${label} Clinic ${RUN}` });
    const mk = async (role, first, last, provider = false) => {
      const email = `${role}_${label}_${first}_${RUN}@example.com`.toLowerCase();
      const { rows: [u] } = await pool.query(`INSERT INTO public.users (id,email,first_name,last_name,role,status,password_hash,practice_id,created_at)
        VALUES (gen_random_uuid(),$1,$2,$3,$4,'active',$5,$6,NOW()) RETURNING id`, [email, first, last, role, await bcrypt.hash(PW, 12), t.practiceId]);
      if (provider) await pool.query(`INSERT INTO public.providers (id, first_name, last_name, specialization) VALUES ($1,$2,$3,'Family Medicine')`, [u.id, first, last]);
      return { id: u.id, token: (await call('POST', '/api/auth/login', null, { email, password: PW })).body.token };
    };
    return { t, schema: t.tenant.schema_name, admin: await mk('admin', 'Ada', 'Admin'),
      doc: await mk('doctor', 'Maya', 'Lee', true), doc2: await mk('doctor', 'Omar', 'Khan', true), nurse: await mk('nurse', 'Nia', 'Nurse') };
  };
  const A = await mkPractice('Alpha'); const B = await mkPractice('Beta');

  // ── defaults ─────────────────────────────────────────────────────────────────────
  const g0 = await call('GET', '/api/practice-profile', A.admin.token);
  check(`staff can read the profile (got ${g0.status})`, g0.status === 200);
  check('DEFAULT IS OFF, with a suggested address and no public URL', g0.body.profile.visibility === 'off' && /^alpha-clinic-/.test(g0.body.profile.slug) && g0.body.publicUrl === null);
  check('the practice\'s providers are listed for the admin, none listed publicly', g0.body.providers.length === 2 && g0.body.providers.every((p) => !p.listed));
  check('a nurse can read but not edit', (await call('GET', '/api/practice-profile', A.nurse.token)).body.canEdit === false
    && (await call('PUT', '/api/practice-profile', A.nurse.token, { visibility: 'searchable' })).status === 403);
  check('...a doctor cannot change visibility either', (await call('PUT', '/api/practice-profile', A.doc.token, { visibility: 'searchable' })).status === 403);

  // ── visibility ───────────────────────────────────────────────────────────────────
  const slug = `alpha-${RUN}`;
  const sv = await call('PUT', '/api/practice-profile', A.admin.token, { slug, display_name: 'Alpha Family Clinic', about: 'We care.\n\n<script>alert(1)</script>' });
  check(`saving keeps it OFF (got ${sv.status})`, sv.status === 200 && sv.body.profile.visibility === 'off' && sv.body.publicUrl === null);
  check('OFF: the page is not found, even by direct link', (await page(slug)).status === 404);
  const rnd = sv.body.profile.random_slug;
  check('an unguessable random address exists (14 characters)', /^[A-Za-z0-9]{14}$/.test(rnd));
  check('OFF: the random address is not found either', (await page(rnd)).status === 404);

  await call('PUT', '/api/practice-profile', A.admin.token, { visibility: 'link' });
  let pg = await page(slug);
  check(`LINK ONLY: the page opens by direct link (got ${pg.status})`, pg.status === 200 && pg.html.includes('Alpha Family Clinic'));
  check('...and tells search engines not to index it', /noindex/.test(pg.robots) && pg.html.includes('content="noindex,nofollow"') && !pg.html.includes('application/ld+json'));
  check('...and the about text is escaped (no script)', !pg.html.includes('<script>alert') && pg.html.includes('&lt;script&gt;'));

  const lr = await call('PUT', '/api/practice-profile', A.admin.token, { use_random_link: true });
  check('LINK ONLY + random address: the public URL is the random one', lr.body.publicUrl === `https://app.example.test/p/${rnd}`);
  check('...the readable address no longer opens', (await page(slug)).status === 404);
  check('...the random address does', (await page(rnd)).status === 200);
  const regen = await call('PUT', '/api/practice-profile', A.admin.token, { regenerate_random_link: true });
  const rnd2 = regen.body.profile.random_slug;
  check('a new random address can be issued; the old one stops working', rnd2 !== rnd && (await page(rnd)).status === 404 && (await page(rnd2)).status === 200);

  await call('PUT', '/api/practice-profile', A.admin.token, { visibility: 'searchable', use_random_link: false });
  pg = await page(slug);
  check('SEARCHABLE: indexable, with a canonical URL and schema.org data',
    pg.status === 200 && /index, follow/.test(pg.robots) && pg.html.includes(`<link rel="canonical" href="https://app.example.test/p/${slug}">`) && pg.html.includes('"@type":"MedicalClinic"'));
  check('...a printed random-address QR code keeps working', (await page(rnd2)).status === 200);
  check('no third-party scripts or trackers on the page', !/<script(?![^>]*application\/ld\+json)/.test(pg.html) && !/googletagmanager|facebook\.net|analytics/.test(pg.html));

  check('another practice cannot take the same address (409)', (await call('PUT', '/api/practice-profile', B.admin.token, { slug })).status === 409);
  check('a malformed address is refused (400)', (await call('PUT', '/api/practice-profile', A.admin.token, { slug: 'Bad Slug!' })).status === 400);
  check('a bad website is refused (400)', (await call('PUT', '/api/practice-profile', A.admin.token, { website: 'javascript:alert(1)' })).status === 400);

  // ── provider consent ─────────────────────────────────────────────────────────────
  check('providers are NOT on the page without consent', !pg.html.includes('Maya') && !pg.html.includes('Omar'));
  const me0 = await call('GET', '/api/practice-profile/me', A.doc.token);
  check('a provider sees their consent screen, with the consent text and version', me0.body.isProvider === true && me0.body.consent.consented === false && /withdraw/i.test(me0.body.consentText));
  check('an admin who is not a provider has no listing (403 on consent)', (await call('PUT', '/api/practice-profile/me', A.admin.token, { consented: true })).status === 403);
  check('there is no way for an admin to consent on a provider\'s behalf', (await call('PUT', `/api/practice-profile/providers/${A.doc.id}/consent`, A.admin.token, { consented: true })).status === 404);
  await call('PUT', '/api/practice-profile/me', A.doc.token, { consented: true, show_bio: true, bio: 'Family doctor <b>since</b> 2010', show_languages: false, languages: ['Spanish'] });
  pg = await page(slug);
  check('AFTER CONSENT the provider is listed', pg.html.includes('Dr. Maya Lee'));
  check('...with the bio they chose to show (escaped)', pg.html.includes('Family doctor &lt;b&gt;since&lt;/b&gt; 2010'));
  check('...but not what they chose to hide (languages)', !pg.html.includes('Spanish'));
  check('...and the other provider (no consent) is still absent', !pg.html.includes('Omar'));
  await call('PUT', `/api/practice-profile/providers/${A.doc.id}/hidden`, A.admin.token, { hidden: true });
  check('an admin can HIDE a consented provider', !(await page(slug)).html.includes('Maya'));
  await call('PUT', `/api/practice-profile/providers/${A.doc.id}/hidden`, A.admin.token, { hidden: false });
  check('...and show them again', (await page(slug)).html.includes('Maya'));
  await call('PUT', '/api/practice-profile/me', A.doc.token, { consented: false });
  check('WITHDRAWING removes the listing immediately', !(await page(slug)).html.includes('Maya'));
  const { rows: ev } = await pool.query(`SELECT action, detail FROM public.directory_events WHERE practice_id = $1 AND provider_id = $2 ORDER BY id`, [A.t.practiceId, A.doc.id]);
  check('every consent change is logged with the consent version', ev.map((e) => e.action).join(',') === 'consent_given,provider_hidden,provider_unhidden,consent_withdrawn'
    && ev[0].detail.version);
  check('consent is per practice: nothing changed at the other practice',
    (await pool.query('SELECT 1 FROM public.provider_listing_consents WHERE practice_id = $1', [B.t.practiceId])).rowCount === 0);

  // ── photos ───────────────────────────────────────────────────────────────────────
  const qr = require(path.join(BACKEND, '..', 'node_modules', 'qrcode'));
  const png = await qr.toBuffer('photo', { type: 'png' });
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const text = Buffer.from('Comment\0GPS 51.50,-0.12');
  const len = Buffer.alloc(4); len.writeUInt32BE(text.length); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc(Buffer.concat([Buffer.from('tEXt'), text])));
  const pngGps = Buffer.concat([png.subarray(0, 33), len, Buffer.from('tEXt'), text, cr, png.subarray(33)]);
  const up = await call('POST', '/api/practice-profile/photos', A.admin.token, { kind: 'cover', data: pngGps.toString('base64') });
  check(`an admin's cover photo is accepted and approved (got ${up.status})`, up.status === 201 && up.body.status === 'approved');
  const { rows: [stored] } = await pool.query('SELECT bytes FROM public.practice_profile_photos WHERE id = $1', [up.body.id]);
  check('PHOTO METADATA (incl. GPS) IS STRIPPED before storing', !Buffer.from(stored.bytes).includes('GPS'));
  check('a GIF is refused', (await call('POST', '/api/practice-profile/photos', A.admin.token, { kind: 'gallery', data: Buffer.from('GIF89a......').toString('base64') })).status === 400);
  await call('PUT', '/api/practice-profile', A.admin.token, { cover_photo_id: up.body.id });
  pg = await page(slug);
  check('the cover photo shows on the page and is served', pg.html.includes(`/p/${slug}/photo/${up.body.id}`)
    && (await fetch(`${BASE}/p/${slug}/photo/${up.body.id}`)).status === 200);
  const pp = await call('POST', '/api/practice-profile/photos', A.doc2.token, { kind: 'provider', data: png.toString('base64') });
  check('a provider\'s own photo waits for approval', pp.status === 201 && pp.body.status === 'pending');
  check('a provider cannot upload practice photos', (await call('POST', '/api/practice-profile/photos', A.doc2.token, { kind: 'cover', data: png.toString('base64') })).status === 403);
  await call('PUT', '/api/practice-profile/me', A.doc2.token, { consented: true, show_photo: true, photo_id: pp.body.id });
  check('PENDING provider photo is not public', (await fetch(`${BASE}/p/${slug}/photo/${pp.body.id}`)).status === 404);
  await call('PUT', `/api/practice-profile/photos/${pp.body.id}`, A.admin.token, { status: 'approved' });
  check('after approval it is served, while the provider shows it', (await fetch(`${BASE}/p/${slug}/photo/${pp.body.id}`)).status === 200);
  await call('PUT', '/api/practice-profile/me', A.doc2.token, { consented: true, show_photo: false, photo_id: pp.body.id });
  check('...and not once they choose to hide it', (await fetch(`${BASE}/p/${slug}/photo/${pp.body.id}`)).status === 404);
  check("another practice's staff cannot see this practice's photos", (await call('GET', `/api/practice-profile/photos/${up.body.id}`, B.admin.token)).status === 404);

  // ── locations, booking, specialties ──────────────────────────────────────────────
  const locId = crypto.randomUUID();
  await pool.query(`INSERT INTO ${A.schema}.locations (id, name, address, city, state, postal_code, country, email, notes, is_active)
    VALUES ($1,'Main Street','1 Main St','Springfield','IL','62701','US','private@clinic.test','door code 1234', true)`, [locId]);
  const bLoc = crypto.randomUUID();
  await pool.query(`INSERT INTO ${B.schema}.locations (id, name, address, city, is_active) VALUES ($1,'Beta Secret','9 Hidden Rd','Nowhere', true)`, [bLoc]);
  const spec = (await pool.query('SELECT code, name FROM public.specialties LIMIT 1')).rows[0];
  await call('PUT', '/api/practice-profile', A.admin.token, { location_ids: [locId, bLoc], specialty_codes: spec ? [spec.code, 'not-a-code'] : [] });
  await pool.query(`INSERT INTO ${A.schema}.provider_booking_config (provider_id, booking_url_slug, allow_public_booking) VALUES ($1,$2,true)`, [A.doc2.id, `omar-${RUN}`]);
  pg = await page(slug);
  check('the chosen location is published with its address', pg.html.includes('Main Street') && pg.html.includes('1 Main St') && pg.html.includes('Springfield'));
  check('...but not its private fields (email, notes)', !pg.html.includes('private@clinic.test') && !pg.html.includes('door code'));
  check("another practice's location cannot be published", !pg.html.includes('Beta Secret'));
  check('specialties come from the catalogue (unknown codes dropped)', !spec || (pg.html.includes(spec.name.replace(/&/g, '&amp;')) && !pg.html.includes('not-a-code')));
  check('a listed provider with online booking gets a Book button', pg.html.includes(`href="/book/omar-${RUN}"`));

  // ── off again, patients ──────────────────────────────────────────────────────────
  await call('PUT', '/api/practice-profile', A.admin.token, { visibility: 'off' });
  check('turning it OFF hides the page and its photos immediately',
    (await page(slug)).status === 404 && (await page(rnd2)).status === 404 && (await fetch(`${BASE}/p/${slug}/photo/${up.body.id}`)).status === 404);
  const { rows: pv } = await pool.query(`SELECT action, detail FROM public.directory_events WHERE practice_id = $1 AND action = 'profile_saved' ORDER BY id`, [A.t.practiceId]);
  check('visibility changes are logged (from → to)', pv.some((e) => e.detail.visibility && e.detail.visibility.to === 'off'));
  check('an unknown address is the same 404', (await page('no-such-practice')).status === 404);
})().then(() => report(), report);
