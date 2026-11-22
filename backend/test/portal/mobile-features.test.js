// The mobile app's own calls for Find a practice, the patient profile and sick notes —
// exactly the request shapes mobile/src/lib/{directory,profile,sickNotes}.ts build, sent the
// way the app sends them (Authorization: Bearer, no cookies, no CSRF header).

const path = require('path');
const crypto = require('crypto');

const BACKEND = path.join(__dirname, '..', '..');
process.env.PORT = process.env.TEST_PORT || '4891';
process.env.NODE_ENV = 'development';
process.env.AC_JWT_S = process.env.AC_JWT_S || crypto.randomBytes(48).toString('base64');
process.env.AC_TK_S = process.env.AC_TK_S || process.env.AC_JWT_S;
process.env.AC_IDX_K = process.env.AC_IDX_K || crypto.randomBytes(32).toString('base64');
process.env.AC_PW_BREACH_CHECK = 'false';
process.env.FRONTEND_URL = 'https://app.example.test';
const BASE = `http://127.0.0.1:${process.env.PORT}`;

const outbox = [];
const notify = require(path.join(BACKEND, 'services/notificationService.js'));
notify.sendEmail = async (to, subject, html) => { outbox.push({ to, subject, html }); return { sent: true }; };
const pool = require(path.join(BACKEND, 'db.js'));
const { expandLink, firstLinkIn, tokenOf } = require(path.join(__dirname, '..', 'helpers', 'links.js'));
const bcrypt = require(path.join(BACKEND, '..', 'node_modules', 'bcryptjs'));
const { provisionTenant } = require(path.join(BACKEND, 'services/tenantProvisioning.js'));
require(path.join(BACKEND, 'server.js'));

const results = [];
const check = (n, c) => results.push([n, !!c]);
const obj = (v) => v || {};
// The app's client: JSON + Bearer, nothing else.
const app = async (method, url, token, body) => {
  const r = await fetch(BASE + '/api' + url, { method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
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
const day = (o) => new Date(Date.now() + o * 86400000).toISOString().slice(0, 10);

(async () => {
  for (let i = 0; i < 40; i++) { try { await fetch(BASE + '/health'); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  const RUN = crypto.randomBytes(3).toString('hex');
  const PW = 'A-Strong-Passphrase!23';
  const t = await provisionTenant(pool, { name: `Riverside Family Practice ${RUN}` });
  const T = t.tenant.schema_name;
  const mk = async (role, provider) => {
    const email = `${role}_${RUN}@example.com`;
    const { rows: [u] } = await pool.query(`INSERT INTO public.users (id,email,first_name,last_name,role,status,password_hash,practice_id,created_at)
      VALUES (gen_random_uuid(),$1,'Maya',$2,$3,'active',$4,$5,NOW()) RETURNING id`, [email, role, role, await bcrypt.hash(PW, 12), t.practiceId]);
    if (provider) await pool.query(`INSERT INTO public.providers (id, first_name, last_name, specialization, license_number) VALUES ($1,'Maya',$2,'General Practice','GMC 1')`, [u.id, role]);
    return { id: u.id, token: obj((await app('POST', '/auth/login', null, { email, password: PW })).body).token };
  };
  const admin = await mk('admin'); const doctor = await mk('doctor', true); const reception = await mk('receptionist');

  // ── Find a practice (signed out, then signed in) ─────────────────────────────────
  await app('PUT', '/practice-profile', admin.token, { slug: `riverside-${RUN}`, visibility: 'searchable', specialty_codes: ['dermatology'] });
  require(path.join(BACKEND, 'services/directorySearch.js')).invalidate();
  const s1 = await app('POST', '/directory/search', null, { q: `Riverside Family Practice ${RUN}` });
  const hit = (obj(s1.body).results || [])[0];
  check(`signed out, the app finds a practice by its name (got ${s1.status})`, s1.status === 200 && hit && hit.name === `Riverside Family Practice ${RUN}` && hit.matchedBy === 'practice-name');
  check('...with a /p/<slug> page the app opens on the same server', hit && hit.url === `/p/riverside-${RUN}`);
  const page = await fetch(BASE + hit.url);
  check('...and that page opens', page.status === 200);
  check('signed in (Bearer, no CSRF header) the search works too', (await app('POST', '/directory/search', doctor.token, { q: 'dermatologist' })).status === 200);

  // ── a patient with the app ───────────────────────────────────────────────────────
  const pid = crypto.randomUUID(); const pEmail = `pt_${RUN}@example.com`;
  await pool.query(`INSERT INTO public.users (id,email,first_name,last_name,role,status,practice_id,created_at) VALUES ($1,$2,'Rosa','Parks','patient','active',$3,NOW())`, [pid, pEmail, t.practiceId]);
  await pool.query(`INSERT INTO ${T}.patients (id, first_name, last_name, status, mrn, date_of_birth, email, phone, address, emergency_contact)
    VALUES ($1,'Rosa','Parks','Active',$2,'1970-02-04',$3,'555 0100','1 High St','{"name":"Jo","phone":"555 0101","relationship":"Sister"}')`, [pid, `MRN-${RUN}`, pEmail]);
  await app('POST', '/portal-invites', admin.token, { patientId: pid });
  const mail = outbox.filter((m) => m.to === pEmail).pop();
  await app('POST', '/portal-invites/accept', null, { token: tokenOf(await expandLink(firstLinkIn(mail.html), BASE)), password: PW });
  const pl = await app('POST', '/patient-portal/login', null, { email: pEmail, password: PW });
  const ptok = obj(pl.body).sessionToken;
  check('the patient signs in (portal session token, as the app stores it)', Boolean(ptok));

  // Profile: the app sends only what changed, never identity fields.
  const prof = await app('GET', `/patient-portal/${pid}/profile`, ptok);
  check(`the app reads the patient's profile (got ${prof.status})`, prof.status === 200 && prof.body.first_name === 'Rosa' && !('portal_password_hash' in prof.body));
  const patch = { phone: '+44 7700 900123', address: '2 Low Rd', emergencyContact: { name: 'Jo', phone: '555 0199', relationship: 'Sister' }, allergies: 'Penicillin', current_medications: 'None' };
  const up = await app('PUT', `/patient-portal/${pid}/profile`, ptok, patch);
  const row = (await pool.query(`SELECT * FROM ${T}.patients WHERE id = $1`, [pid])).rows[0];
  check(`the patient updates contact and health details (got ${up.status})`, up.status === 200 && row.phone === '+44 7700 900123' && row.address === '2 Low Rd' && row.allergies === 'Penicillin');
  const ec = typeof row.emergency_contact === 'string' ? JSON.parse(row.emergency_contact) : row.emergency_contact;
  check('...the emergency contact is stored as the app sent it', ec && ec.phone === '555 0199' && ec.relationship === 'Sister');
  check('...and name, date of birth and email are untouched', row.first_name === 'Rosa' && row.email === pEmail && String(row.date_of_birth).length > 0);
  // Identity fields: a patient cannot change them (SEC-50).
  const other = `other_${RUN}@example.com`;
  const idChange = async (patchX) => (await app('PUT', `/patient-portal/${pid}/profile`, ptok, patchX)).status;
  check('A PATIENT CANNOT SET THEIR EMAIL TO SOMEONE ELSE\'S (403)', await idChange({ email: other }) === 403);
  check('...nor change their name (403)', await idChange({ first_name: 'Mallory' }) === 403);
  check('...nor their date of birth (403)', await idChange({ date_of_birth: '1999-09-09' }) === 403);
  const webForm = { first_name: 'Rosa', last_name: 'Parks', email: pEmail.toUpperCase(), date_of_birth: '1970-02-04', phone: '+44 7700 900999', address: '2 Low Rd' };
  check('the web portal\'s whole-form save (identity unchanged) still works', await idChange(webForm) === 200);
  const row2 = (await pool.query(`SELECT first_name, email, phone FROM ${T}.patients WHERE id = $1`, [pid])).rows[0];
  check('...and identity stayed as it was', row2.first_name === 'Rosa' && row2.email === pEmail && row2.phone === '+44 7700 900999');
  check('the profile is the patient\'s own only (another patient id -> refused)', (await app('GET', `/patient-portal/${crypto.randomUUID()}/profile`, ptok)).status >= 400);
  check('no session -> refused', (await app('GET', `/patient-portal/${pid}/profile`, null)).status === 401);

  // ── sick notes: clinician issues from Chart (toRequest shape), patient views ────────
  const body = { patientId: pid, purpose: 'work', fitness: 'may_be_fit', assessedOn: day(0), startDate: day(0), endDate: day(13),
    adjustments: ['phased_return'], comments: 'Light duties', followUp: true };
  const iss = await app('POST', '/sick-notes', doctor.token, body);
  check(`a clinician issues a sick note from the app (got ${iss.status})`, iss.status === 201 && /^SN-/.test(obj(obj(iss.body).note).reference));
  const noteId = obj(obj(iss.body).note).id;
  const list = await app('GET', `/sick-notes?patientId=${pid}`, doctor.token);
  check('the chart lists it and says the clinician may issue', list.status === 200 && list.body.notes.length === 1 && list.body.canIssue === true);
  const doc = await app('GET', `/sick-notes/${noteId}/document`, doctor.token);
  check('the app gets the printable document', doc.status === 200 && /may be fit for work/.test(doc.body.html) && doc.body.html.includes('Rosa Parks'));
  check('emailing it from the app works', (await app('POST', `/sick-notes/${noteId}/email`, doctor.token, {})).status === 200);
  check('reception cannot open sick notes (403)', (await app('GET', `/sick-notes?patientId=${pid}`, reception.token)).status === 403);
  const mine = await app('GET', `/patient-portal/${pid}/sick-notes`, ptok);
  check(`the patient sees the note in the app (got ${mine.status})`, mine.status === 200 && mine.body.length === 1 && mine.body[0].reference === iss.body.note.reference);
  const myDoc = await app('GET', `/patient-portal/${pid}/sick-notes/${noteId}/document`, ptok);
  check('...and can print it', myDoc.status === 200 && myDoc.body.html.includes(iss.body.note.reference));
  check('a patient cannot use the staff sick-note routes', (await app('GET', `/sick-notes?patientId=${pid}`, ptok)).status >= 401);
  check('voiding from the app (a listed reason) works', (await app('POST', `/sick-notes/${noteId}/void`, doctor.token, { reason: 'Wrong dates' })).status === 200);
  const after = await app('GET', `/patient-portal/${pid}/sick-notes`, ptok);
  check('...and the patient sees it marked void', after.body[0].status === 'voided' && after.body[0].voidReason === 'Wrong dates');

  report();
})().catch(report);
