// Guest bookings are REQUESTS, never matched to a chart by email.
//
// Someone who is not signed in books on a provider's public page: the slot is held as a
// pending appointment attached to no chart. Staff confirm it for an existing patient or as
// a new one, or decline it (which frees the slot). A patient signed in to the practice's
// portal books straight into their own chart. Proves: an existing patient's email does not
// attach the booking to them or email them; the request list, its "possible match" hint and
// tenancy; confirm (existing, new, clash 409, no date of birth 400); decline; and the
// portal-session path.

const path = require('path');
const crypto = require('crypto');

const BACKEND = path.join(__dirname, '..', '..');
process.env.PORT = process.env.TEST_PORT || '4881';
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

(async () => {
  for (let i = 0; i < 40; i++) { try { await fetch(BASE + '/health'); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  const RUN = crypto.randomBytes(4).toString('hex');
  const PW = 'A-Strong-Passphrase!23';
  const hash = await bcrypt.hash(PW, 12);

  const mkTenant = async (label) => {
    const t = await provisionTenant(pool, { name: `${label} ${RUN}` });
    const mk = async (role) => {
      const email = `${role}_${label.toLowerCase()}_${RUN}@example.com`;
      const { rows: [u] } = await pool.query(
        `INSERT INTO public.users (id,email,first_name,last_name,role,status,password_hash,practice_id,created_at)
         VALUES (gen_random_uuid(),$1,'Ada',$2,$3,'active',$4,$5,NOW()) RETURNING id`, [email, label, role, hash, t.practiceId]);
      const login = await api('POST', '/api/auth/login', { body: { email, password: PW } });
      return { id: u.id, email, token: obj(login.body).token };
    };
    const admin = await mk('admin');
    await pool.query(`INSERT INTO public.providers (id, first_name, last_name, specialization, email)
      VALUES ($1,'Ada',$2,'General',$3) ON CONFLICT (id) DO NOTHING`, [admin.id, label, admin.email]);
    return { schema: t.tenant.schema_name, practiceId: t.practiceId, admin, receptionist: await mk('receptionist') };
  };
  const A = await mkTenant('Alpha');
  const B = await mkTenant('Beta');
  check('two practices, each with an admin and a receptionist', Boolean(A.admin.token && A.receptionist.token && B.admin.token));

  // A booking link and an appointment type for Alpha's provider.
  const slug = `dr-req-${RUN}`;
  const cfg = await api('POST', '/api/scheduling/booking-config',
    { token: A.admin.token, body: { providerId: A.admin.id, bookingUrlSlug: slug, allowPublicBooking: true, sendConfirmationEmail: true, sendReminderEmail: true } });
  check(`a public booking link (got ${cfg.status})`, cfg.status === 201);
  const { rows: [type] } = await pool.query(
    `INSERT INTO ${A.schema}.appointment_type_config (provider_id, name, duration_minutes, is_active)
     VALUES ($1, 'Consult', 30, true) RETURNING id`, [A.admin.id]);
  const H = { 'X-Booking-Slug': slug };
  const at = (day, hour) => `2027-03-${String(day).padStart(2, '0')} ${String(hour).padStart(2, '0')}:00`;
  const book = (startTime, patientInfo, extra = {}) => api('POST', '/api/scheduling/book', { headers: { ...H, ...(extra.headers || {}) },
    body: { providerId: A.admin.id, appointmentTypeId: type.id, startTime, patientInfo, customFormData: { reason: 'Check-up' } } });
  const appt = async (id) => (await pool.query(`SELECT * FROM ${A.schema}.appointments WHERE id = $1`, [id])).rows[0];

  // An existing patient of Alpha.
  const patientId = crypto.randomUUID();
  const pEmail = `rosa_${RUN}@example.com`;
  await pool.query(`INSERT INTO public.users (id,email,first_name,last_name,role,status,practice_id,created_at)
    VALUES ($1,$2,'Rosa','Parks','patient','active',$3,NOW())`, [patientId, pEmail, A.practiceId]);
  await pool.query(`INSERT INTO ${A.schema}.patients (id, first_name, last_name, status, mrn, date_of_birth, email)
    VALUES ($1,'Rosa','Parks','Active',$2,'1970-02-04',$3)`, [patientId, `MRN-${RUN}`, pEmail]);

  // ── a guest using an existing patient's email ─────────────────────────────────────
  outbox.length = 0;
  const g1 = await book(at(1, 10), { firstName: 'Someone', lastName: 'Else', email: pEmail.toUpperCase(), phone: '555-0100' });
  check(`a guest can book (got ${g1.status})`, g1.status === 201);
  check('...the answer says it is a REQUEST', obj(g1.body).requested === true && /confirm/i.test(obj(g1.body).message || ''));
  const a1 = await appt(obj(obj(g1.body).appointment).id);
  check('THE BOOKING IS NOT ATTACHED TO THE PATIENT WITH THAT EMAIL', a1 && a1.patient_id === null);
  check('...it is pending, marked as a public request, with the guest\'s details kept',
    a1 && a1.status === 'pending' && a1.booking_source === 'public_request' && a1.custom_form_data.guest.email === pEmail && a1.custom_form_data.guest.firstName === 'Someone');
  check('...Rosa\'s chart has no new appointment',
    (await pool.query(`SELECT 1 FROM ${A.schema}.appointments WHERE patient_id = $1`, [patientId])).rowCount === 0);
  check('...no reminders are queued for a request',
    (await pool.query(`SELECT 1 FROM ${A.schema}.appointment_reminders WHERE appointment_id = $1`, [a1.id])).rowCount === 0);
  check('...and nobody was emailed', outbox.length === 0);
  check('the held time cannot be booked again (409)', (await book(at(1, 10), { firstName: 'X', lastName: 'Y', email: `x_${RUN}@example.com` })).status === 409);
  check('a guest must give a name and a valid email (400)',
    (await book(at(1, 11), { firstName: '', lastName: 'Y', email: 'nope' })).status === 400);

  // ── staff see the requests ─────────────────────────────────────────────────────────
  const list = await api('GET', '/api/booking-requests', { token: A.receptionist.token });
  const item = (list.body || []).find((r) => r.id === a1.id);
  check(`reception sees the request (got ${list.status})`, list.status === 200 && Boolean(item));
  check('...with the guest\'s details', item && item.guest.firstName === 'Someone' && item.guest.phone === '555-0100');
  check('...and the same-email chart offered only as a HINT', item && obj(item.possibleMatch).id === patientId);
  check('another practice does not see it', !((await api('GET', '/api/booking-requests', { token: B.admin.token })).body || []).some((r) => r.id === a1.id));
  check('...and cannot confirm it (404)',
    (await api('POST', `/api/booking-requests/${a1.id}/confirm`, { token: B.admin.token, body: { asNewPatient: true } })).status === 404);
  check('no session -> 401', (await api('GET', '/api/booking-requests')).status === 401);
  check('confirm needs a choice (400)', (await api('POST', `/api/booking-requests/${a1.id}/confirm`, { token: A.admin.token, body: {} })).status === 400);
  check('confirm as NEW refuses when that email is already a patient (409)',
    (await api('POST', `/api/booking-requests/${a1.id}/confirm`, { token: A.admin.token, body: { asNewPatient: true } })).status === 409);

  // ── confirm for the existing chart ───────────────────────────────────────────────
  outbox.length = 0;
  const c1 = await api('POST', `/api/booking-requests/${a1.id}/confirm`, { token: A.receptionist.token, body: { patientId } });
  const a1b = await appt(a1.id);
  check(`staff confirm it for Rosa (got ${c1.status})`, c1.status === 200 && a1b.patient_id === patientId && a1b.status === 'scheduled');
  check('...the guest is emailed the confirmation', outbox.some((m) => m.to === pEmail && /confirmed/i.test(m.subject)));
  check('...and it leaves the list', !((await api('GET', '/api/booking-requests', { token: A.admin.token })).body || []).some((r) => r.id === a1.id));
  check('...and cannot be confirmed twice (404)',
    (await api('POST', `/api/booking-requests/${a1.id}/confirm`, { token: A.admin.token, body: { patientId } })).status === 404);

  // ── confirm as a new patient ─────────────────────────────────────────────────────
  const nEmail = `newbie_${RUN}@example.com`;
  const g2 = await book(at(2, 9), { firstName: 'Nova', lastName: 'New', email: nEmail });
  const id2 = obj(obj(g2.body).appointment).id;
  check('a new patient without a date of birth cannot be created from the request (400)',
    (await api('POST', `/api/booking-requests/${id2}/confirm`, { token: A.admin.token, body: { asNewPatient: true } })).status === 400);
  const g3 = await book(at(2, 11), { firstName: 'Nova', lastName: 'New', email: nEmail, dob: '1990-05-06', phone: '555-0199' });
  const id3 = obj(obj(g3.body).appointment).id;
  const c3 = await api('POST', `/api/booking-requests/${id3}/confirm`, { token: A.admin.token, body: { asNewPatient: true } });
  const chart = (await pool.query(`SELECT * FROM ${A.schema}.patients WHERE LOWER(email) = $1`, [nEmail])).rows[0];
  check(`confirm as new creates the chart (got ${c3.status} ${JSON.stringify(c3.body).slice(0, 120)})`,
    c3.status === 200 && chart && obj(c3.body).patientId === chart.id && String(chart.date_of_birth).length > 0);
  check('...and attaches the appointment to it', (await appt(id3)).patient_id === chart.id);

  // ── decline ──────────────────────────────────────────────────────────────────────
  outbox.length = 0;
  const d2 = await api('POST', `/api/booking-requests/${id2}/decline`, { token: A.admin.token });
  check(`decline (got ${d2.status})`, d2.status === 200 && (await appt(id2)).status === 'cancelled');
  check('...the guest is told', outbox.some((m) => m.to === nEmail));
  check('...and the time is free again', (await book(at(2, 9), { firstName: 'Next', lastName: 'One', email: `next_${RUN}@example.com` })).status === 201);

  // ── a patient signed in to the portal books into their own chart ───────────────────
  await api('POST', '/api/portal-invites', { token: A.admin.token, body: { patientId } });
  const mail = outbox.filter((m) => m.to === pEmail).pop();
  const inviteToken = mail && tokenOf(await expandLink(firstLinkIn(mail.html), BASE));
  const acc = await api('POST', '/api/portal-invites/accept', { body: { token: inviteToken, password: PW } });
  const login = await api('POST', '/api/patient-portal/login', { body: { email: pEmail, password: PW } });
  const portalTok = cookieValue(login.setCookie, 'ac_portal');
  const csrf = cookieValue(login.setCookie, 'ac_csrf');
  check(`Rosa signs in to the portal (accept ${acc.status}, login ${login.status})`, Boolean(portalTok));
  const jar = { Cookie: `ac_portal=${encodeURIComponent(portalTok)}; ac_csrf=${encodeURIComponent(csrf)}`, 'X-CSRF-Token': csrf };
  const p1 = await book(at(3, 10), { firstName: 'Ignored', lastName: 'Ignored', email: 'ignored@example.com' }, { headers: jar });
  const ap1 = await appt(obj(obj(p1.body).appointment).id);
  check(`A SIGNED-IN PATIENT BOOKS STRAIGHT INTO THEIR OWN CHART (got ${p1.status})`,
    p1.status === 201 && obj(p1.body).requested === false && ap1 && ap1.patient_id === patientId && ap1.status === 'scheduled');
  check('...a confirmation email is queued for them',
    (await pool.query(`SELECT 1 FROM ${A.schema}.appointment_reminders WHERE appointment_id = $1`, [ap1.id])).rowCount >= 1);

  report();
})().catch(report);
