// Patients request sick notes (web portal / mobile app); clinicians issue or decline.

const path = require('path');
const crypto = require('crypto');

const BACKEND = path.join(__dirname, '..', '..');
process.env.PORT = process.env.TEST_PORT || '4893';
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
const api = async (method, url, token, body) => {
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
  const mkPractice = async (label) => {
    const t = await provisionTenant(pool, { name: `${label} ${RUN}` });
    const mk = async (role, provider) => {
      const email = `${role}_${label}_${RUN}@example.com`.toLowerCase();
      const { rows: [u] } = await pool.query(`INSERT INTO public.users (id,email,first_name,last_name,role,status,password_hash,practice_id,created_at)
        VALUES (gen_random_uuid(),$1,'Maya',$2,$3,'active',$4,$5,NOW()) RETURNING id`, [email, role, role, await bcrypt.hash(PW, 12), t.practiceId]);
      if (provider) await pool.query(`INSERT INTO public.providers (id, first_name, last_name, specialization) VALUES ($1,'Maya',$2,'General Practice')`, [u.id, role]);
      return { id: u.id, token: obj((await api('POST', '/auth/login', null, { email, password: PW })).body).token };
    };
    return { t, T: t.tenant.schema_name, admin: await mk('admin'), doctor: await mk('doctor', true), nurse: await mk('nurse'), reception: await mk('receptionist') };
  };
  const A = await mkPractice('Alpha'); const B = await mkPractice('Beta');
  const mkPatient = async (P, first) => {
    const pid = crypto.randomUUID(); const email = `${first}_${RUN}@example.com`.toLowerCase();
    await pool.query(`INSERT INTO public.users (id,email,first_name,last_name,role,status,practice_id,created_at) VALUES ($1,$2,$3,'Parks','patient','active',$4,NOW())`, [pid, email, first, P.t.practiceId]);
    await pool.query(`INSERT INTO ${P.T}.patients (id, first_name, last_name, status, mrn, date_of_birth, email) VALUES ($1,$2,'Parks','Active',$3,'1970-02-04',$4)`, [pid, first, `MRN-${first}-${RUN}`, email]);
    await api('POST', '/portal-invites', P.admin.token, { patientId: pid });
    const mail = outbox.filter((m) => m.to === email).pop();
    await api('POST', '/portal-invites/accept', null, { token: tokenOf(await expandLink(firstLinkIn(mail.html), BASE)), password: PW });
    const tok = obj((await api('POST', '/patient-portal/login', null, { email, password: PW })).body).sessionToken;
    return { id: pid, email, tok };
  };
  const rosa = await mkPatient(A, 'Rosa'); const sam = await mkPatient(A, 'Sam'); const bea = await mkPatient(B, 'Bea');
  check('three patients signed in to their portals', Boolean(rosa.tok && sam.tok && bea.tok));

  // ── the patient asks ─────────────────────────────────────────────────────────────
  const ask = (p, body) => api('POST', `/patient-portal/${p.id}/sick-note-requests`, p.tok, body);
  const good = { purpose: 'work', startDate: day(-2), endDate: day(4), reason: 'Flu with fever since the weekend' };
  check('dates the wrong way round -> 400', (await ask(rosa, { ...good, startDate: day(4), endDate: day(-2) })).status === 400);
  check('more than 14 days back -> 400', (await ask(rosa, { ...good, startDate: day(-20) })).status === 400);
  check('more than 30 days ahead -> 400', (await ask(rosa, { ...good, startDate: day(40), endDate: day(41) })).status === 400);
  check('over 92 days -> 400', (await ask(rosa, { ...good, endDate: day(100) })).status === 400);
  check('no real reason -> 400', (await ask(rosa, { ...good, reason: 'ill' })).status === 400);
  const r1 = await ask(rosa, good);
  check(`A PATIENT REQUESTS A SICK NOTE (got ${r1.status})`, r1.status === 201 && r1.body.status === 'pending' && r1.body.days === 7);
  check('a second one while the first waits -> 409', (await ask(rosa, good)).status === 409);
  check('another patient\'s requests are not reachable', (await api('GET', `/patient-portal/${sam.id}/sick-note-requests`, rosa.tok)).status >= 400);
  const mine = await api('GET', `/patient-portal/${rosa.id}/sick-note-requests`, rosa.tok);
  check('the patient sees it, pending', mine.status === 200 && mine.body.length === 1 && mine.body[0].status === 'pending');

  // ── clinicians see it ────────────────────────────────────────────────────────────
  const q = await api('GET', '/sick-notes/requests', A.doctor.token);
  const inQueue = (q.body.requests || []).find((x) => x.id === r1.body.id);
  check(`it appears in the practice's queue with the patient's name (got ${q.status})`, q.status === 200 && inQueue && inQueue.patientName === 'Rosa Parks' && inQueue.reason === good.reason);
  check('...and on the patient\'s sick-notes list', ((await api('GET', `/sick-notes?patientId=${rosa.id}`, A.doctor.token)).body.requests || []).some((x) => x.id === r1.body.id));
  check('another practice does not see it', !((await api('GET', '/sick-notes/requests', B.doctor.token)).body.requests || []).some((x) => x.id === r1.body.id));
  check('reception cannot see the queue (403)', (await api('GET', '/sick-notes/requests', A.reception.token)).status === 403);
  check('a patient cannot use the staff queue', (await api('GET', '/sick-notes/requests', rosa.tok)).status >= 401);

  // ── issue from the request ───────────────────────────────────────────────────────
  const noteBody = { patientId: rosa.id, requestId: r1.body.id, fitness: 'not_fit', purpose: 'work', startDate: good.startDate, endDate: good.endDate };
  check('issuing against ANOTHER patient\'s request -> 409', (await api('POST', '/sick-notes', A.doctor.token, { ...noteBody, patientId: sam.id })).status === 409);
  outbox.length = 0;
  const iss = await api('POST', '/sick-notes', A.doctor.token, noteBody);
  check(`a clinician issues the note from the request (got ${iss.status})`, iss.status === 201 && iss.body.requestId === r1.body.id);
  const after = (await api('GET', `/patient-portal/${rosa.id}/sick-note-requests`, rosa.tok)).body[0];
  check('...the request shows as issued, linked to the note', after.status === 'issued' && after.sickNoteId === iss.body.note.id);
  check('...the patient is emailed that it is ready', outbox.some((m) => m.to === rosa.email && /ready/.test(m.subject)));
  check('...the note is in the patient\'s list', ((await api('GET', `/patient-portal/${rosa.id}/sick-notes`, rosa.tok)).body || []).some((n) => n.id === iss.body.note.id));
  check('...it leaves the queue', !((await api('GET', '/sick-notes/requests', A.doctor.token)).body.requests || []).some((x) => x.id === r1.body.id));
  check('the same request cannot be answered twice (409)', (await api('POST', '/sick-notes', A.doctor.token, noteBody)).status === 409);

  // ── decline ──────────────────────────────────────────────────────────────────────
  const r2 = await ask(sam, { ...good, purpose: 'school' });
  check('the patient can ask again for something else', r2.status === 201);
  check('declining needs a reason (400)', (await api('POST', `/sick-notes/requests/${r2.body.id}/decline`, A.nurse.token, {})).status === 400);
  check('an admin who is not a clinician cannot decline (403)', (await api('POST', `/sick-notes/requests/${r2.body.id}/decline`, A.admin.token, { reason: 'x' })).status === 403);
  check('another practice cannot decline it (404)', (await api('POST', `/sick-notes/requests/${r2.body.id}/decline`, B.doctor.token, { reason: 'x' })).status === 404);
  outbox.length = 0;
  const dec = await api('POST', `/sick-notes/requests/${r2.body.id}/decline`, A.doctor.token, { reason: 'Please book an appointment so we can assess you.' });
  check(`a clinician declines with a reason (got ${dec.status})`, dec.status === 200 && dec.body.request.status === 'declined');
  check('...the patient is emailed the reason', outbox.some((m) => m.to === sam.email && m.html.includes('Please book an appointment')));
  const samSees = (await api('GET', `/patient-portal/${sam.id}/sick-note-requests`, sam.tok)).body[0];
  check('...and sees it declined, with the reason', samSees.status === 'declined' && /book an appointment/.test(samSees.decisionReason));

  // ── the patient cancels ──────────────────────────────────────────────────────────
  const r3 = await ask(bea, good);
  check('another practice\'s patient can ask too', r3.status === 201);
  check('a patient cannot cancel someone else\'s request', (await api('POST', `/patient-portal/${rosa.id}/sick-note-requests/${r3.body.id}/cancel`, rosa.tok, {})).status === 404);
  const can = await api('POST', `/patient-portal/${bea.id}/sick-note-requests/${r3.body.id}/cancel`, bea.tok, {});
  check(`the patient cancels their request (got ${can.status})`, can.status === 200 && can.body.status === 'cancelled');
  check('...it is gone from the practice\'s queue', !((await api('GET', '/sick-notes/requests', B.doctor.token)).body.requests || []).some((x) => x.id === r3.body.id));
  check('...and cannot be cancelled twice', (await api('POST', `/patient-portal/${bea.id}/sick-note-requests/${r3.body.id}/cancel`, bea.tok, {})).status === 404);
  check('...after cancelling they can ask again', (await ask(bea, good)).status === 201);

  report();
})().catch(report);
