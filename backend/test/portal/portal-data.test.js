// The patient portal works end to end on its OWN endpoints.
//
// The portal screen used to read staff routes (/api/appointments, /api/medical-records,
// /api/pharmacies, …), which refuse a patient session — every tab answered 401/403. This
// drives the portal endpoints that replaced them with a real portal session (cookie +
// CSRF, as a browser sends), proves each is pinned to the session's own patient, and
// covers the related changes: inviting a patient from the staff Invite dialog by email,
// the staff login refusing patient accounts, and calendar sync accepting the portal session.

const path = require('path');
const crypto = require('crypto');

const BACKEND = path.join(__dirname, '..', '..');
process.env.PORT = process.env.TEST_PORT || '4876';
process.env.NODE_ENV = 'development';
process.env.AC_JWT_S = process.env.AC_JWT_S || crypto.randomBytes(48).toString('base64');
process.env.AC_TK_S = process.env.AC_TK_S || process.env.AC_JWT_S;
process.env.AC_PW_BREACH_CHECK = 'false';
process.env.AC_IDX_K = process.env.AC_IDX_K || crypto.randomBytes(32).toString('base64');
process.env.FRONTEND_URL = 'https://app.example.test';
const BASE = `http://127.0.0.1:${process.env.PORT}`;

// Capture outgoing mail on the real module, before the router destructures it.
const outbox = [];
let mailWorks = true;
const notify = require(path.join(BACKEND, 'services/notificationService.js'));
notify.sendEmail = async (to, subject, html) => {
  if (!mailWorks) return { sent: false, reason: 'smtp_not_configured' };
  outbox.push({ to, subject, html }); return { sent: true };
};
// Provider stubbed at the module boundary, as in the SEC-20 tests.
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
const call = async (method, url, { token, body, cookie, csrf } = {}) => {
  const r = await fetch(BASE + url, { method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(cookie ? { Cookie: cookie } : {}), ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text(); let b = null; try { b = JSON.parse(t); } catch { b = t; }
  return { status: r.status, body: b, text: t, setCookie: r.headers.getSetCookie ? r.headers.getSetCookie() : [] };
};
// Emails carry a short link (/s/<code>); follow it to the activation URL and take its token.
const { expandLink, firstLinkIn, tokenOf } = require(path.join(__dirname, '..', 'helpers', 'links.js'));
const linkIn = async (mail) => {
  if (!mail) return null;
  const full = /https:\/\/app\.example\.test\/portal\/activate\?token=[A-Za-z0-9_-]+/.exec(mail.html);
  const url = full ? full[0] : await expandLink(firstLinkIn(mail.html), BASE);
  return url && /\/portal\/activate\?/.test(url) ? tokenOf(url) : null;
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
  const t = await provisionTenant(pool, { name: `Portal Clinic ${RUN}` });
  const schema = t.tenant.schema_name;
  const mkStaff = async (role, extra = {}) => {
    const email = `${role}_${RUN}_${crypto.randomBytes(2).toString('hex')}@example.com`;
    const { rows: [u] } = await pool.query(`INSERT INTO public.users (id,email,first_name,last_name,role,status,password_hash,practice_id,created_at)
      VALUES (gen_random_uuid(),$1,$2,'Doc',$3,'active',$4,$5,NOW()) RETURNING id`,
      [email, extra.first || 'Sam', role, await bcrypt.hash(PW, 12), extra.practiceId === undefined ? t.practiceId : extra.practiceId]);
    return { id: u.id, email, token: (await call('POST', '/api/auth/login', { body: { email, password: PW } })).body.token };
  };
  const admin = await mkStaff('admin');
  const doc = await mkStaff('doctor', { first: 'Dana' });
  await pool.query(`INSERT INTO public.providers (id, first_name, last_name, specialization) VALUES ($1,'Dana','Doc','Family Medicine') ON CONFLICT (id) DO NOTHING`, [doc.id]);

  // ── 1. inviting a patient by email from the staff Invite dialog ───────────────────
  const pEmail = `pat_${RUN}@example.com`;
  const missing = await call('POST', '/api/portal-invites', { token: admin.token, body: { email: pEmail } });
  check(`a new patient needs name + date of birth (got ${missing.status})`, missing.status === 400 && /date of birth/i.test(missing.body.error || ''));
  const inv = await call('POST', '/api/portal-invites', { token: admin.token,
    body: { email: pEmail, firstName: 'Pia', lastName: 'Portal', dateOfBirth: '1980-03-04' } });
  check(`INVITING A PATIENT BY EMAIL CREATES THEIR CHART AND SENDS THE PORTAL INVITE (got ${inv.status})`, inv.status === 201 && inv.body.emailed === true);
  const { rows: [chart] } = await pool.query(`SELECT * FROM ${schema}.patients WHERE email = $1`, [pEmail]);
  check('...the chart has the name, date of birth and an MRN', chart && chart.first_name === 'Pia' && /^MRN\d{6}$/.test(chart.mrn));
  check('...and no staff account was created for the patient', (await pool.query('SELECT 1 FROM public.users WHERE email = $1', [pEmail])).rowCount === 0);
  const again = await call('POST', '/api/portal-invites', { token: admin.token, body: { email: pEmail.toUpperCase() } });
  check('inviting the same email again re-uses the chart (no duplicate)', again.status === 201
    && (await pool.query(`SELECT count(*)::int n FROM ${schema}.patients WHERE LOWER(email) = $1`, [pEmail])).rows[0].n === 1);
  const token = await linkIn(outbox.filter((m) => m.to === pEmail).pop());
  const acc = await call('POST', '/api/portal-invites/accept', { body: { token, password: PW } });
  check(`the patient accepts and is signed in (got ${acc.status})`, acc.status === 200);
  const jar = acc.setCookie.map((c) => c.split(';')[0]).join('; ');
  const csrf = (/ac_csrf=([^;]+)/.exec(jar) || [])[1];
  const P = chart.id;
  const get = (u) => call('GET', `/api/patient-portal/${P}${u}`, { cookie: jar });
  const send = (m, u, b) => call(m, `/api/patient-portal/${P}${u}`, { cookie: jar, csrf, body: b });

  // seed some practice data
  await pool.query(`INSERT INTO ${schema}.pharmacies (pharmacy_name, chain_name, is_active) VALUES ('Corner Pharmacy','Indie',true)`).catch((e) => console.log('seed pharmacy:', e.message));
  await pool.query(`INSERT INTO ${schema}.appointment_types (name, is_active) VALUES ('General Consultation', true)`).catch((e) => console.log('seed type:', e.message));

  // ── 2. every portal tab loads through portal endpoints ────────────────────────────
  for (const [label, u] of [['diagnoses', '/diagnoses'], ['active prescriptions', '/prescriptions/active'],
    ['pharmacies', '/pharmacies'], ['preferred pharmacies', '/pharmacies/preferred'], ['providers', '/providers'],
    ['appointment types', '/appointment-types'], ['insurance payers', '/insurance-payers'], ['featured services', '/offerings?featured=true'],
    ['waitlist', '/waitlist'], ['notification preferences', '/notification-preferences'], ['appointments', '/appointments'],
    ['medical records', '/medical-records'], ['profile', '/profile']]) {
    const r = await get(u);
    check(`portal ${label} loads for the patient (got ${r.status})`, r.status === 200 && (Array.isArray(r.body) || typeof r.body === 'object'));
  }
  const provs = (await get('/providers')).body;
  check("providers lists the practice's doctor, names only", provs.some((p) => p.id === doc.id)
    && provs.every((p) => !('email' in p) && !('license_number' in p) && !('phone' in p)));

  // ── 3. writes are pinned to the session's own patient ─────────────────────────────
  const start = new Date(Date.now() + 3 * 864e5); start.setUTCHours(10, 0, 0, 0);
  const iso = (d) => d.toISOString().replace('T', ' ').slice(0, 19);
  const end = new Date(start.getTime() + 30 * 60000);
  const other = crypto.randomUUID();
  await pool.query(`INSERT INTO ${schema}.patients (id, first_name, last_name, mrn, date_of_birth, email) VALUES ($1,'Other','Person',$2,'1970-01-01',$3)`,
    [other, `MRN-X${RUN}`, `other_${RUN}@example.com`]);
  const book = await send('POST', '/appointments', { patient_id: other, provider_id: doc.id, start_time: iso(start), end_time: iso(end), appointment_type: 'General Consultation', reason: 'Checkup' });
  check(`the patient can book an appointment (got ${book.status})`, book.status === 201);
  check('...ALWAYS for themselves, whatever patient_id the request names', book.body.patient_id === P);
  check('a clashing booking is refused (409)', (await send('POST', '/appointments', { provider_id: doc.id, start_time: iso(start), end_time: iso(end) })).status === 409);
  const foreignDoc = await mkStaff('doctor', { practiceId: null });
  check("a provider from outside the practice is refused (400)",
    (await send('POST', '/appointments', { provider_id: foreignDoc.id, start_time: iso(new Date(start.getTime() + 864e5)), end_time: iso(new Date(end.getTime() + 864e5)) })).status === 400);
  check('the booking shows in their appointments', (await get('/appointments')).body.some((a) => a.id === book.body.id));
  check('CSRF is enforced on portal writes (no header → 403)',
    (await call('POST', `/api/patient-portal/${P}/waitlist`, { cookie: jar, body: { preferredDate: '2030-01-01' } })).status === 403);
  const wl = await send('POST', '/waitlist', { providerId: doc.id, preferredDate: '2030-01-02', reason: 'sooner' });
  check(`joining the waitlist works (got ${wl.status})`, wl.status === 201 && wl.body.waitlistEntry.patientId === P);
  check('...and leaving it', (await send('DELETE', `/waitlist/${wl.body.waitlistEntry.id}`)).status === 200);
  const ph = (await get('/pharmacies')).body[0];
  check('choosing a preferred pharmacy works', ph && (await send('POST', '/pharmacies/preferred', { pharmacyId: ph.id, isPreferred: true })).status === 201
    && (await get('/pharmacies/preferred')).body.length === 1);
  const np = await send('PUT', '/notification-preferences', { channel_type: 'email', is_enabled: false });
  check('notification preferences save', np.status === 200 && np.body.is_enabled === false && np.body.patient_id === P);
  const prof = await send('PUT', '/profile', { height: '170 cm', allergies: 'Penicillin' });
  check('profile health details save', prof.status === 200 && prof.body.height === '170 cm' && prof.body.allergies === 'Penicillin');
  const { rows: [tpl] } = await pool.query(`SELECT id FROM ${schema}.form_templates LIMIT 1`);
  check('(the practice has a form template to request)', Boolean(tpl));
  const { rows: [fs] } = await pool.query(`INSERT INTO ${schema}.form_submissions (template_id, template_name, patient_id, status, form_data) VALUES ($2, 'Intake', $1, 'pending', '{}') RETURNING id`, [P, tpl.id]);
  const sub = await send('PUT', `/form-requests/${fs.id}`, { form_data: { q1: 'yes' } });
  check(`a requested form can be submitted (got ${sub.status})`, sub.status === 200 && sub.body.status === 'submitted');
  check('...only once', (await send('PUT', `/form-requests/${fs.id}`, { form_data: { q1: 'no' } })).status === 404);
  const { rows: [ofs] } = await pool.query(`INSERT INTO ${schema}.form_submissions (template_id, template_name, patient_id, status, form_data) VALUES ($2, 'Intake', $1, 'pending', '{}') RETURNING id`, [other, tpl.id]);
  check("another patient's form cannot be submitted", (await send('PUT', `/form-requests/${ofs.id}`, { form_data: { x: 1 } })).status === 404);

  // ── 4. one patient cannot reach another's portal ──────────────────────────────────
  for (const u of ['/diagnoses', '/waitlist', '/notification-preferences', '/prescriptions/active']) {
    const r = await call('GET', `/api/patient-portal/${other}${u}`, { cookie: jar });
    check(`another patient's ${u} is refused (got ${r.status})`, r.status === 403);
  }
  check('no session → 401', (await call('GET', `/api/patient-portal/${P}/diagnoses`)).status === 401);

  // ── 5. password change ────────────────────────────────────────────────────────────
  check('a wrong current password is refused', (await send('POST', '/change-password', { currentPassword: 'nope', newPassword: 'Another-Passphrase!45' })).status === 400);
  check('the password can be changed', (await send('POST', '/change-password', { currentPassword: PW, newPassword: 'Another-Passphrase!45' })).status === 200);
  check('...and the new one signs in', (await call('POST', '/api/patient-portal/login', { body: { email: pEmail, password: 'Another-Passphrase!45' } })).status === 200);
  check('...while this session keeps working', (await get('/profile')).status === 200);

  // ── 6. calendar sync accepts the portal session ───────────────────────────────────
  const cal = await call('GET', `/api/calendar-sync/status/${P}`, { cookie: jar });
  check(`calendar-sync status answers a portal patient (got ${cal.status})`, cal.status === 200);
  const calOther = await call('GET', `/api/calendar-sync/status/${other}`, { cookie: jar });
  check(`...but not for another patient (got ${calOther.status} ${JSON.stringify(calOther.body).slice(0, 80)})`, calOther.status === 403);

  // ── 7. staff login refuses patient accounts ───────────────────────────────────────
  const leftover = `leftover_${RUN}@example.com`;
  await pool.query(`INSERT INTO public.users (id,email,first_name,last_name,role,status,password_hash,created_at)
    VALUES (gen_random_uuid(),$1,'L','O','patient','active',$2,NOW())`, [leftover, await bcrypt.hash(PW, 12)]);
  const sl = await call('POST', '/api/auth/login', { body: { email: leftover, password: PW } });
  check(`STAFF LOGIN REFUSES A PATIENT ACCOUNT (got ${sl.status})`, sl.status === 403 && sl.body.patientAccount === true && !sl.body.token);
  check('...but only after the password: a wrong one still reads "invalid"',
    (await call('POST', '/api/auth/login', { body: { email: leftover, password: 'wrong-password' } })).status === 401);
})().then(() => report(), report);
