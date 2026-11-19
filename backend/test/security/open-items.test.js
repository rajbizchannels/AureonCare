// The security-register items that were still open on 2026-11-19, exercised end to end.
//
//   SEC-11  every JWT check pins HS256        — a token re-signed HS512 is refused
//   SEC-12  breached passwords are refused     — via a stubbed HIBP range API; fails open
//   SEC-15  portal session in an HttpOnly cookie, CSRF-checked, revoked at logout
//   SEC-30  an anonymous booking link resolves to its own practice, and only its provider
//
// Each block fails against the code before its fix.

const path = require('path');
const crypto = require('crypto');

const BACKEND = path.join(__dirname, '..', '..');
process.env.PORT = process.env.TEST_PORT || '4893';
process.env.NODE_ENV = 'development';
process.env.AC_JWT_S = process.env.AC_JWT_S || crypto.randomBytes(48).toString('base64');
process.env.AC_TK_S = process.env.AC_TK_S || process.env.AC_JWT_S;
// The portal identity index key — required in production (SEC-05 deploy step). Without it
// password login only searches the default practice, which is not what this is testing.
process.env.AC_IDX_K = process.env.AC_IDX_K || crypto.randomBytes(32).toString('base64');
const BASE = `http://127.0.0.1:${process.env.PORT}`;

const pool = require(path.join(BACKEND, 'db.js'));
const bcrypt = require(path.join(BACKEND, '..', 'node_modules', 'bcryptjs'));
const jwt = require(path.join(BACKEND, '..', 'node_modules', 'jsonwebtoken'));
const { provisionTenant } = require(path.join(BACKEND, 'services/tenantProvisioning.js'));
const breach = require(path.join(BACKEND, 'utils/breachedPassword.js'));
// Portal access is granted by invitation; capture the email so the test can open the link.
const outbox = [];
const notify = require(path.join(BACKEND, 'services/notificationService.js'));
notify.sendEmail = async (to, subject, html) => { outbox.push({ to, html }); return { sent: true }; };
require(path.join(BACKEND, 'server.js'));

const results = [];
const check = (n, c) => results.push([n, !!c]);
const obj = (v) => v || {};

const api = async (method, url, { body, token, headers = {} } = {}) => {
  const r = await fetch(BASE + url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  let parsed = null; try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { status: r.status, body: parsed, setCookie: r.headers.getSetCookie ? r.headers.getSetCookie() : [] };
};
const cookieValue = (setCookie, name) => {
  const c = setCookie.find((s) => s.startsWith(name + '='));
  return c ? decodeURIComponent(c.split(';')[0].slice(name.length + 1)) : null;
};

const report = (err) => {
  let failed = 0;
  for (const [n, c] of results) { console.log(`  ${c ? 'ok  ' : 'FAIL'} ${n}`); if (!c) failed += 1; }
  if (err) {
    console.log(`\n${results.length - failed}/${results.length} passed before the suite stopped early.`);
    console.error(`\nSTOPPED: ${err.message || err}`);
    console.error(err);
  } else {
    console.log(`\n${results.length - failed}/${results.length} checks passed.`);
  }
  process.exit(err || failed ? 1 : 0);
};

const sha1 = (s) => crypto.createHash('sha1').update(s).digest('hex').toUpperCase();
// A stub range API that knows exactly one breached password, with padding entries.
const stubKnowing = (pw) => async (prefix) => {
  const lines = ['0000000000000000000000000000000000A:0', '0000000000000000000000000000000000B:0'];
  if (sha1(pw).slice(0, 5) === prefix) lines.push(`${sha1(pw).slice(5)}:52341`);
  return lines.join('\r\n');
};

(async () => {
  for (let i = 0; i < 40; i++) {
    try { await fetch(BASE + '/health'); break; } catch { await new Promise((r) => setTimeout(r, 250)); }
  }
  const RUN = crypto.randomBytes(4).toString('hex');
  const PW = 'A-Strong-Passphrase!23';
  const hash = await bcrypt.hash(PW, 12);
  breach._setRangeFetcher(async () => '');   // nothing breached unless a check says so

  const mkTenant = async (label) => {
    const t = await provisionTenant(pool, { name: `${label} ${RUN}` });
    const email = `adm_${label.toLowerCase()}_${RUN}@example.com`;
    const { rows: [me] } = await pool.query(
      `INSERT INTO public.users (id,email,first_name,last_name,role,status,password_hash,practice_id,created_at)
       VALUES (gen_random_uuid(),$1,'Ada',$2,'admin','active',$3,$4,NOW()) RETURNING id`,
      [email, label, hash, t.practiceId]);
    await pool.query(
      `INSERT INTO public.providers (id, first_name, last_name, specialization, email)
       VALUES ($1,'Ada',$2,'General',$3) ON CONFLICT (id) DO NOTHING`, [me.id, label, email]);
    const login = await api('POST', '/api/auth/login', { body: { email, password: PW } });
    return { schema: t.tenant.schema_name, tenantId: t.tenant.id, userId: me.id, email, token: obj(login.body).token };
  };
  const A = await mkTenant('Alpha');
  const B = await mkTenant('Beta');
  check('two practices with an admin each', Boolean(A.token && B.token));

  // ── SEC-11 ──────────────────────────────────────────────────────────────────────
  const claims = jwt.decode(A.token);
  delete claims.iat; delete claims.exp;
  const hs512 = jwt.sign(claims, process.env.AC_TK_S, { algorithm: 'HS512', expiresIn: '5m' });
  const hs256 = jwt.sign(claims, process.env.AC_TK_S, { algorithm: 'HS256', expiresIn: '5m' });
  check('SEC-11: messaging accepts the normal HS256 token',
    (await api('GET', '/api/messages/unread-count', { token: hs256 })).status === 200);
  check('SEC-11: MESSAGING REFUSES THE SAME CLAIMS SIGNED HS512',
    (await api('GET', '/api/messages/unread-count', { token: hs512 })).status === 401);
  check('SEC-11: and so does the main API (unchanged)',
    (await api('GET', '/api/auth/me', { token: hs512 })).status === 401);

  // ── SEC-15 + SEC-12 (portal) ─────────────────────────────────────────────────────
  const patientId = crypto.randomUUID();
  const pEmail = `pt_${RUN}@example.com`;
  await pool.query(
    `INSERT INTO public.users (id,email,first_name,last_name,role,status,practice_id,created_at)
     SELECT $1,$2,'Rosa','Parks','patient','active',practice_id,NOW() FROM public.users WHERE id=$3`,
    [patientId, pEmail, A.userId]);
  await pool.query(
    `INSERT INTO ${A.schema}.patients (id, first_name, last_name, status, mrn, date_of_birth, email)
     VALUES ($1,'Rosa','Parks','Active',$2,'1970-02-04',$3)`, [patientId, `MRN-${RUN}`, pEmail]);

  const BREACHED = 'Summer2024!Password';
  breach._setRangeFetcher(stubKnowing(BREACHED));
  // The patient sets their portal password from the practice's invitation link.
  const sentInvite = await api('POST', '/api/portal-invites', { token: A.token, body: { patientId } });
  const mail = outbox.filter((m) => m.to === pEmail).pop();
  const inviteToken = mail && (/activate\?token=([A-Za-z0-9_-]+)/.exec(mail.html) || [])[1];
  check('the practice can invite the patient to the portal', sentInvite.status === 201 && Boolean(inviteToken));
  const reg1 = await api('POST', '/api/portal-invites/accept', { body: { token: inviteToken, password: BREACHED } });
  check('SEC-12: A BREACHED PASSWORD IS REFUSED (400)', reg1.status === 400);
  check('SEC-12: ...and the message says why', /breach/i.test(obj(reg1.body).error || ''));

  const reg2 = await api('POST', '/api/portal-invites/accept', { body: { token: inviteToken, password: PW } });
  check('the patient can set a strong password from the invitation', reg2.status === 200);

  breach._setRangeFetcher(async () => { const e = new Error('fetch failed'); e.cause = { code: 'ENOTFOUND' }; throw e; });
  const chg = await api('POST', '/api/auth/change-password',
    { token: B.token, body: { currentPassword: PW, newPassword: 'Another-Strong-Pass!45' } });
  check('SEC-12: breach service down -> the change is still allowed (fail-open)', chg.status === 200);
  // A password change revokes the old JWT (SEC-09) and reissues one; carry on with that.
  if (obj(chg.body).token) B.token = chg.body.token;
  breach._setRangeFetcher(stubKnowing(BREACHED));
  const chg2 = await api('POST', '/api/auth/change-password',
    { token: B.token, body: { currentPassword: 'Another-Strong-Pass!45', newPassword: BREACHED } });
  check('SEC-12: change-password refuses a breached password too', chg2.status === 400);
  breach._setRangeFetcher(async () => '');

  const login = await api('POST', '/api/patient-portal/login', { body: { email: pEmail, password: PW } });
  check(`portal login succeeds (${login.status} ${JSON.stringify(login.body).slice(0, 100)})`, login.status === 200);
  const portalCookie = login.setCookie.find((c) => c.startsWith('ac_portal='));
  check('SEC-15: LOGIN SETS THE ac_portal COOKIE', Boolean(portalCookie));
  check('SEC-15: ...HttpOnly, so page script cannot read it', /;\s*HttpOnly/i.test(portalCookie || ''));
  check('SEC-15: ...scoped to /api', /;\s*Path=\/api(;|$)/i.test(portalCookie || ''));
  const portalTok = cookieValue(login.setCookie, 'ac_portal');
  const csrf = cookieValue(login.setCookie, 'ac_csrf');
  check('SEC-15: a CSRF cookie comes with it', Boolean(csrf) && obj(login.body).csrfToken === csrf);
  const jar = `ac_portal=${encodeURIComponent(portalTok)}; ac_csrf=${encodeURIComponent(csrf)}`;

  const viaCookie = await api('GET', `/api/patient-portal/${patientId}/profile`, { headers: { Cookie: jar } });
  check('SEC-15: THE COOKIE ALONE AUTHENTICATES THE PORTAL (no Authorization header)', viaCookie.status === 200);
  check('SEC-15: the cookie is bound to its patient (other id -> 403)',
    (await api('GET', `/api/patient-portal/${crypto.randomUUID()}/profile`, { headers: { Cookie: jar } })).status === 403);
  check('SEC-15: no cookie, no header -> 401',
    (await api('GET', `/api/patient-portal/${patientId}/profile`)).status === 401);

  const forged = await api('PUT', `/api/patient-portal/${patientId}/profile`,
    { headers: { Cookie: jar }, body: { phone: '555-0199' } });
  check('SEC-15: A COOKIE-ONLY WRITE WITHOUT THE CSRF HEADER IS REFUSED (403)', forged.status === 403);
  const honest = await api('PUT', `/api/patient-portal/${patientId}/profile`,
    { headers: { Cookie: jar, 'X-CSRF-Token': csrf }, body: { phone: '555-0199' } });
  check('SEC-15: the same write with the CSRF header goes through', honest.status !== 403 && honest.status < 500);

  check('SEC-15: messaging accepts the portal cookie too',
    (await api('GET', '/api/messages/unread-count', { headers: { Cookie: jar } })).status === 200);

  const out = await api('POST', '/api/patient-portal/logout', { headers: { Cookie: jar, 'X-CSRF-Token': csrf }, body: {} });
  check('SEC-15: logout by cookie succeeds', out.status === 200);
  check('SEC-15: ...clears the cookie', out.setCookie.some((c) => /^ac_portal=;/.test(c)));
  check('SEC-15: ...and revokes the session server-side',
    (await api('GET', `/api/patient-portal/${patientId}/profile`, { headers: { Cookie: jar } })).status === 401);

  // ── SEC-30 ─────────────────────────────────────────────────────────────────────
  const slug = `dr-alpha-${RUN}`;
  const cfg = await api('POST', '/api/scheduling/booking-config',
    { token: A.token, body: { providerId: A.userId, bookingUrlSlug: slug, allowPublicBooking: true } });
  check('a booking link can be created', cfg.status === 201);
  await pool.query(
    `INSERT INTO ${A.schema}.appointment_type_config (provider_id, name, duration_minutes, is_active)
     VALUES ($1, $2, 30, true)`, [A.userId, `Consult ${RUN}`]).catch((e) => console.error('type insert:', e.message));

  const pub = await api('GET', `/api/scheduling/booking-config/slug/${slug}`);
  check('SEC-30: ANONYMOUS SLUG LOOKUP FINDS THE PRACTICE (was 500)', pub.status === 200 && obj(pub.body).provider_id === A.userId);
  const H = { 'X-Booking-Slug': slug };
  const types = await api('GET', `/api/scheduling/appointment-types/${A.userId}`, { headers: H });
  check('SEC-30: anonymous appointment types for that provider', types.status === 200
    && (types.body || []).some((t) => t.name === `Consult ${RUN}`));
  const slots = await api('GET', `/api/scheduling/slots/${A.userId}?date=2026-12-01`, { headers: H });
  check('SEC-30: anonymous slots answer (not 500)', slots.status === 200);
  check('SEC-30: clinic-wide /api/appointment-types works anonymously with the slug',
    (await api('GET', '/api/appointment-types', { headers: H })).status === 200);

  check('SEC-30: no slug and no session -> 409, not 500',
    (await api('GET', `/api/scheduling/appointment-types/${A.userId}`)).status === 409);
  check('SEC-30: an unknown slug -> 404',
    (await api('GET', `/api/scheduling/appointment-types/${A.userId}`, { headers: { 'X-Booking-Slug': `nope-${RUN}` } })).status === 404);
  check('SEC-30: A SLUG CANNOT OPEN ANOTHER PROVIDER\'S CALENDAR',
    (await api('GET', `/api/scheduling/slots/${B.userId}?date=2026-12-01`, { headers: H })).status === 404);
  check('SEC-30: ...nor book with one',
    (await api('POST', '/api/scheduling/book', { headers: H, body: { providerId: B.userId, patientInfo: {}, startTime: '2026-12-01 10:00', appointmentTypeId: crypto.randomUUID() } })).status === 404);

  const steal = await api('POST', '/api/scheduling/booking-config',
    { token: B.token, body: { providerId: B.userId, bookingUrlSlug: slug } });
  check(`SEC-30: ANOTHER PRACTICE CANNOT CLAIM THE SAME LINK (409; got ${steal.status} ${JSON.stringify(steal.body).slice(0, 120)})`, steal.status === 409);

  // Signed in at B, opening A's link: the link decides, so it shows A.
  const crossed = await api('GET', `/api/scheduling/booking-config/slug/${slug}`, { token: B.token });
  check('SEC-30: a signed-in user of another practice still sees the link\'s own practice',
    crossed.status === 200 && obj(crossed.body).provider_id === A.userId);

  await api('PUT', `/api/scheduling/booking-config/${A.userId}`, { token: A.token, body: { allowPublicBooking: false } });
  check('SEC-30: switching public booking off closes the link (404)',
    (await api('GET', `/api/scheduling/appointment-types/${A.userId}`, { headers: H })).status === 404);

  const renamed = `dr-alpha-new-${RUN}`;
  await api('PUT', `/api/scheduling/booking-config/${A.userId}`, { token: A.token, body: { allowPublicBooking: true, bookingUrlSlug: renamed } });
  check('SEC-30: a renamed link works under the new slug',
    (await api('GET', `/api/scheduling/booking-config/slug/${renamed}`)).status === 200);
  check('SEC-30: ...and the old slug is released',
    (await pool.query('SELECT 1 FROM control.booking_slug_route WHERE slug = $1', [slug])).rowCount === 0);

  await pool.query('DELETE FROM public.users WHERE id = ANY($1::uuid[])', [[A.userId, B.userId, patientId]]).catch(() => {});
  report();
})().catch(report);
