// Sick notes: who may issue, the rules, the printable certificate, email, voiding,
// practice isolation, and the patient seeing their own notes in the portal.

const path = require('path');
const crypto = require('crypto');

const BACKEND = path.join(__dirname, '..', '..');
process.env.PORT = process.env.TEST_PORT || '4887';
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
const api = async (method, url, { body, token, headers = {} } = {}) => {
  const r = await fetch(BASE + url, { method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text(); let b = null; try { b = JSON.parse(t); } catch { b = t; }
  return { status: r.status, body: b, setCookie: r.headers.getSetCookie ? r.headers.getSetCookie() : [] };
};
const cookieValue = (setCookie, name) => {
  const c = setCookie.find((s) => s.startsWith(name + '='));
  return c ? decodeURIComponent(c.split(';')[0].slice(name.length + 1)) : null;
};
const report = (err) => {
  let failed = 0;
  for (const [n, c] of results) { console.log(`  ${c ? 'ok  ' : 'FAIL'} ${n}`); if (!c) failed += 1; }
  if (err) { console.error(`\nSTOPPED: ${err.message || err}`); console.error(err); }
  else console.log(`\n${results.length - failed}/${results.length} checks passed.`);
  process.exit(err || failed ? 1 : 0);
};
const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

(async () => {
  for (let i = 0; i < 40; i++) { try { await fetch(BASE + '/health'); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  const RUN = crypto.randomBytes(4).toString('hex');
  const PW = 'A-Strong-Passphrase!23';
  const hash = await bcrypt.hash(PW, 12);
  const mkPractice = async (label) => {
    const t = await provisionTenant(pool, { name: `${label} ${RUN}` });
    await pool.query(`UPDATE public.practices SET address = '{"street":"1 High Street","city":"Springfield"}'::jsonb, phone = '555-0101' WHERE id = $1`, [t.practiceId]);
    const mk = async (role, provider = false) => {
      const email = `${role}_${label}_${RUN}@example.com`.toLowerCase();
      const { rows: [u] } = await pool.query(`INSERT INTO public.users (id,email,first_name,last_name,role,status,password_hash,practice_id,created_at)
        VALUES (gen_random_uuid(),$1,'Maya',$2,$3,'active',$4,$5,NOW()) RETURNING id`, [email, role, role, hash, t.practiceId]);
      if (provider) await pool.query(`INSERT INTO public.providers (id, first_name, last_name, specialization, license_number) VALUES ($1,'Maya',$2,'General Practice','GMC 1234567')`, [u.id, role]);
      const token = obj((await api('POST', '/api/auth/login', { body: { email, password: PW } })).body).token;
      return { id: u.id, email, token };
    };
    return { t, schema: t.tenant.schema_name, admin: await mk('admin'), doctor: await mk('doctor', true), nurse: await mk('nurse'), reception: await mk('receptionist') };
  };
  const A = await mkPractice('Alpha'); const B = await mkPractice('Beta');
  check('two practices with admin, doctor, nurse and receptionist', Boolean(A.doctor.token && A.reception.token && B.doctor.token));

  const patientId = crypto.randomUUID();
  const pEmail = `pt_${RUN}@example.com`;
  await pool.query(`INSERT INTO public.users (id,email,first_name,last_name,role,status,practice_id,created_at)
    VALUES ($1,$2,'Rosa','Parks','patient','active',$3,NOW())`, [patientId, pEmail, A.t.practiceId]);
  await pool.query(`INSERT INTO ${A.schema}.patients (id, first_name, last_name, status, mrn, date_of_birth, email)
    VALUES ($1,'Rosa','Parks','Active',$2,'1970-02-04',$3)`, [patientId, `MRN-${RUN}`, pEmail]);

  const base = { patientId, fitness: 'not_fit', startDate: day(0), endDate: day(6), conditionText: 'Influenza <script>x</script>', followUp: true };

  // ── issuing ──────────────────────────────────────────────────────────────────────
  const n1 = await api('POST', '/api/sick-notes', { token: A.doctor.token, body: base });
  const note = obj(obj(n1.body).note);
  check(`A DOCTOR ISSUES A SICK NOTE (got ${n1.status})`, n1.status === 201 && /^SN-\d{4}-[A-Z2-9]{6}$/.test(note.reference || ''));
  check('...it records the issuer, period and advice', note.issuerName === 'Dr Maya doctor' && note.issuerRegistration === 'GMC 1234567' && note.days === 7 && note.fitness === 'not_fit');
  const nurseNote = await api('POST', '/api/sick-notes', { token: A.nurse.token, body: { ...base, startDate: day(1), endDate: day(2) } });
  check(`a nurse can issue one too (got ${nurseNote.status})`, nurseNote.status === 201);
  check('an admin who is not a clinician cannot (403)', (await api('POST', '/api/sick-notes', { token: A.admin.token, body: base })).status === 403);
  check('reception has no access to sick notes by default (403)',
    (await api('GET', `/api/sick-notes?patientId=${patientId}`, { token: A.reception.token })).status === 403);

  const bad = async (body) => (await api('POST', '/api/sick-notes', { token: A.doctor.token, body: { ...base, ...body } })).status;
  check('the last day before the first -> 400', (await bad({ startDate: day(5), endDate: day(1) })) === 400);
  check('more than 92 days in one note -> 400', (await bad({ startDate: day(0), endDate: day(120) })) === 400);
  check('"may be fit" with no adjustments or advice -> 400', (await bad({ fitness: 'may_be_fit' })) === 400);
  check('an assessment date in the future -> 400', (await bad({ assessedOn: day(3) })) === 400);
  check('an unknown patient -> 404', (await bad({ patientId: crypto.randomUUID() })) === 404);
  const mbf = await api('POST', '/api/sick-notes', { token: A.doctor.token,
    body: { ...base, fitness: 'may_be_fit', adjustments: ['phased_return', 'altered_hours', 'bogus'], comments: 'Mornings only for two weeks.', purpose: 'work' } });
  check('"may be fit" with adjustments is accepted, unknown ones dropped',
    mbf.status === 201 && JSON.stringify(obj(mbf.body).note.adjustments) === '["phased_return","altered_hours"]');

  const list = await api('GET', `/api/sick-notes?patientId=${patientId}`, { token: A.nurse.token });
  check(`the chart lists the notes, newest first (got ${list.status})`, list.status === 200 && obj(list.body).notes.length === 3 && obj(list.body).notes[2].id === note.id);
  check('...and says this clinician can issue', obj(list.body).canIssue === true);

  // ── the certificate ──────────────────────────────────────────────────────────────
  const doc = await api('GET', `/api/sick-notes/${note.id}/document`, { token: A.doctor.token });
  const html = obj(doc.body).html || '';
  check(`the printable certificate (got ${doc.status})`, doc.status === 200 && html.includes('Rosa Parks') && html.includes(note.reference)
    && html.includes('is not fit for work') && html.includes('1 High Street, Springfield') && html.includes('GMC 1234567'));
  check('...escapes what was typed', html.includes('Influenza &lt;script&gt;') && !html.includes('<script>x'));
  const mdoc = obj((await api('GET', `/api/sick-notes/${obj(mbf.body).note.id}/document`, { token: A.doctor.token })).body).html || '';
  check('..."may be fit" lists the adjustments and comments', mdoc.includes('A phased return to work') && mdoc.includes('Altered hours') && mdoc.includes('Mornings only'));
  check('another practice cannot open it (404)', (await api('GET', `/api/sick-notes/${note.id}/document`, { token: B.doctor.token })).status === 404);

  // ── email ────────────────────────────────────────────────────────────────────────
  outbox.length = 0;
  const em = await api('POST', `/api/sick-notes/${note.id}/email`, { token: A.nurse.token });
  check(`email it to the patient (got ${em.status})`, em.status === 200 && outbox.some((m) => m.to === pEmail && m.subject.includes(note.reference)));

  // ── voiding ──────────────────────────────────────────────────────────────────────
  check('a nurse cannot void the doctor\'s note (403)', (await api('POST', `/api/sick-notes/${note.id}/void`, { token: A.nurse.token, body: { reason: 'x' } })).status === 403);
  check('voiding needs a reason (400)', (await api('POST', `/api/sick-notes/${note.id}/void`, { token: A.doctor.token, body: {} })).status === 400);
  const vd = await api('POST', `/api/sick-notes/${note.id}/void`, { token: A.doctor.token, body: { reason: 'Wrong dates' } });
  check(`the issuer voids it (got ${vd.status})`, vd.status === 200 && obj(vd.body).note.status === 'voided');
  check('...it cannot be voided twice (409)', (await api('POST', `/api/sick-notes/${note.id}/void`, { token: A.doctor.token, body: { reason: 'again' } })).status === 409);
  check('...nor emailed (409)', (await api('POST', `/api/sick-notes/${note.id}/email`, { token: A.doctor.token })).status === 409);
  const vdoc = obj((await api('GET', `/api/sick-notes/${note.id}/document`, { token: A.doctor.token })).body).html || '';
  check('...and prints marked VOID with the reason', vdoc.includes('class="void">VOID') && vdoc.includes('Wrong dates'));
  check('notes cannot be edited or deleted (no route)',
    (await api('PUT', `/api/sick-notes/${note.id}`, { token: A.doctor.token, body: {} })).status === 404
    && (await api('DELETE', `/api/sick-notes/${note.id}`, { token: A.doctor.token })).status === 404);

  // ── the patient's portal ─────────────────────────────────────────────────────────
  await api('POST', '/api/portal-invites', { token: A.admin.token, body: { patientId } });
  const mail = outbox.filter((m) => m.to === pEmail).pop();
  const inviteToken = mail && tokenOf(await expandLink(firstLinkIn(mail.html), BASE));
  await api('POST', '/api/portal-invites/accept', { body: { token: inviteToken, password: PW } });
  const login = await api('POST', '/api/patient-portal/login', { body: { email: pEmail, password: PW } });
  const jar = { Cookie: `ac_portal=${encodeURIComponent(cookieValue(login.setCookie, 'ac_portal'))}` };
  const pl = await api('GET', `/api/patient-portal/${patientId}/sick-notes`, { headers: jar });
  check(`the patient sees their notes in the portal (got ${pl.status})`, pl.status === 200 && Array.isArray(pl.body) && pl.body.length === 3);
  const pd = await api('GET', `/api/patient-portal/${patientId}/sick-notes/${obj(mbf.body).note.id}/document`, { headers: jar });
  check('...and can print one', pd.status === 200 && (obj(pd.body).html || '').includes('Rosa Parks'));
  check('a staff token cannot use the patient routes for another chart',
    (await api('GET', `/api/patient-portal/${patientId}/sick-notes`, { token: B.doctor.token })).status >= 400);

  report();
})().catch(report);
