// Filling in forms — a patient completing a requested form (portal web / app), staff
// completing one for a patient or filling a new one on a tablet. Proves the server returns
// the practice's REAL template to the patient, checks every submission against it
// (required, types, choices, conditions, role-visible fields), drops answers to questions
// that do not exist, and records the signed-in user (not a client header) as the actor.

const path = require('path');
const crypto = require('crypto');

const BACKEND = path.join(__dirname, '..', '..');
process.env.PORT = process.env.TEST_PORT || '4895';
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
const api = async (method, url, token, body, headers = {}) => {
  const r = await fetch(BASE + '/api' + url, { method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
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

const SIG = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0L10 10"/></svg>').toString('base64')}`;
const FIELDS = [
  { id: 'h1', type: 'heading', label: 'About you' },
  { id: 'p1', type: 'paragraph', label: 'Please answer honestly.' },
  { id: 'full_name', type: 'text', label: 'Full name', required: true },
  { id: 'email', type: 'email', label: 'Email' },
  { id: 'phone', type: 'phone', label: 'Phone' },
  { id: 'age', type: 'number', label: 'Age', min: 0, max: 120, required: true },
  { id: 'dob', type: 'date', label: 'Date of birth' },
  { id: 'notes', type: 'textarea', label: 'Notes' },
  { id: 'smoker', type: 'radio', label: 'Do you smoke?', options: ['Yes', 'No'], required: true },
  { id: 'per_day', type: 'number', label: 'How many a day?', required: true, conditional: { field: 'smoker', operator: 'equals', value: 'Yes' } },
  { id: 'blood', type: 'select', label: 'Blood type', options: [{ value: 'A', label: 'A' }, { value: 'B', label: 'B' }, { value: 'O', label: 'O' }] },
  { id: 'symptoms', type: 'checkboxes', label: 'Symptoms', options: ['Cough', 'Fever', 'Headache'] },
  { id: 'pain', type: 'scale', label: 'Pain', min: 0, max: 10, required: true },
  { id: 'consent', type: 'checkbox', label: 'I consent', required: true },
  { id: 'clinician_note', type: 'textarea', label: 'Clinician note', required: true, visibility_roles: ['doctor', 'nurse'] },
  { id: 'sig', type: 'signature', label: 'Signature', required: true },
];
const GOOD = { full_name: 'Rosa Parks', email: 'rosa@example.com', phone: '+44 7700 900123', age: '56', dob: '1970-02-04', notes: 'None',
  smoker: 'No', blood: 'O', symptoms: ['Cough'], pain: 3, consent: true, sig: SIG };

(async () => {
  for (let i = 0; i < 40; i++) { try { await fetch(BASE + '/health'); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  const RUN = crypto.randomBytes(3).toString('hex');
  const PW = 'A-Strong-Passphrase!23';
  const mkPractice = async (label) => {
    const t = await provisionTenant(pool, { name: `${label} ${RUN}` });
    const mk = async (role) => {
      const email = `${role}_${label}_${RUN}@example.com`.toLowerCase();
      const { rows: [u] } = await pool.query(`INSERT INTO public.users (id,email,first_name,last_name,role,status,password_hash,practice_id,created_at)
        VALUES (gen_random_uuid(),$1,'Maya',$2,$3,'active',$4,$5,NOW()) RETURNING id`, [email, role, role, await bcrypt.hash(PW, 12), t.practiceId]);
      return { id: u.id, token: obj((await api('POST', '/auth/login', null, { email, password: PW })).body).token };
    };
    return { t, T: t.tenant.schema_name, admin: await mk('admin'), doctor: await mk('doctor') };
  };
  const A = await mkPractice('Alpha'); const B = await mkPractice('Beta');
  const tpl = await api('POST', '/form-management/templates', A.admin.token, { name: `Mobile intake ${RUN}`, slug: `mobile-intake-${RUN}`, fields: FIELDS });
  check(`a practice designs its own form (got ${tpl.status})`, tpl.status === 201);
  const templateId = tpl.body.id;

  const mkPatient = async (P, first) => {
    const pid = crypto.randomUUID(); const email = `${first}_${RUN}@example.com`.toLowerCase();
    await pool.query(`INSERT INTO public.users (id,email,first_name,last_name,role,status,practice_id,created_at) VALUES ($1,$2,$3,'Parks','patient','active',$4,NOW())`, [pid, email, first, P.t.practiceId]);
    await pool.query(`INSERT INTO ${P.T}.patients (id, first_name, last_name, status, mrn, date_of_birth, email) VALUES ($1,$2,'Parks','Active',$3,'1970-02-04',$4)`, [pid, first, `MRN-${first}-${RUN}`, email]);
    await api('POST', '/portal-invites', P.admin.token, { patientId: pid });
    const mail = outbox.filter((m) => m.to === email).pop();
    await api('POST', '/portal-invites/accept', null, { token: tokenOf(await expandLink(firstLinkIn(mail.html), BASE)), password: PW });
    return { id: pid, tok: obj((await api('POST', '/patient-portal/login', null, { email, password: PW })).body).sessionToken };
  };
  const rosa = await mkPatient(A, 'Rosa'); const sam = await mkPatient(A, 'Sam');

  // ── the practice requests it; the patient fills it in ────────────────────────────
  const reqd = await api('POST', '/form-management/submissions', A.doctor.token, { template_id: templateId, patient_id: rosa.id, status: 'pending' });
  check(`the practice requests the form from the patient (got ${reqd.status})`, reqd.status === 201);
  const sid = reqd.body.id;
  const list = await api('GET', `/patient-portal/${rosa.id}/form-requests`, rosa.tok);
  check('the patient sees it requested', list.status === 200 && list.body.some((f) => f.id === sid));
  const detail = await api('GET', `/patient-portal/${rosa.id}/form-requests/${sid}`, rosa.tok);
  check(`THE PATIENT GETS THE PRACTICE'S OWN QUESTIONS (got ${detail.status}, ${obj(detail.body).fields ? detail.body.fields.length : 0} fields)`,
    detail.status === 200 && detail.body.fields.length === FIELDS.length && detail.body.editable === true && detail.body.templateName === `Mobile intake ${RUN}`);
  check('another patient cannot open it', (await api('GET', `/patient-portal/${sam.id}/form-requests/${sid}`, sam.tok)).status === 404);
  check('...nor with someone else\'s session', (await api('GET', `/patient-portal/${rosa.id}/form-requests/${sid}`, sam.tok)).status >= 400);

  const submit = (data) => api('PUT', `/patient-portal/${rosa.id}/form-requests/${sid}`, rosa.tok, { form_data: data });
  let r = await submit({});
  check('an empty form is refused, naming the missing answers', r.status === 400 && ['full_name', 'age', 'smoker', 'pain', 'consent', 'sig'].every((k) => r.body.fieldErrors[k]));
  check('...a staff-only question is NOT required of the patient', r.status === 400 && !r.body.fieldErrors.clinician_note);
  check('...nor a question hidden by its condition', !r.body.fieldErrors.per_day);
  r = await submit({ ...GOOD, smoker: 'Yes' });
  check('answering "Yes" makes the follow-up question required', r.status === 400 && r.body.fieldErrors.per_day);
  r = await submit({ ...GOOD, email: 'not-an-email', age: '200', blood: 'Z', symptoms: ['Cough', 'Rash'], pain: 11, sig: 'javascript:alert(1)' });
  check('wrong types and choices are refused', r.status === 400 && ['email', 'age', 'blood', 'symptoms', 'pain', 'sig'].every((k) => r.body.fieldErrors[k]));
  r = await submit({ ...GOOD, made_up: 'x', clinician_note: 'patient tried', per_day: 20 });
  check(`a complete form is accepted (got ${r.status})`, r.status === 200 && r.body.status === 'submitted');
  const saved = (await pool.query(`SELECT form_data, submitted_by_role FROM ${A.T}.form_submissions WHERE id = $1`, [sid])).rows[0];
  check('...answers to questions that do not exist, hidden questions and staff-only ones are dropped',
    !('made_up' in saved.form_data) && !('per_day' in saved.form_data) && !('clinician_note' in saved.form_data) && saved.form_data.full_name === 'Rosa Parks');
  check('...numbers are stored as numbers', saved.form_data.age === 56 && saved.form_data.pain === 3 && saved.submitted_by_role === 'patient');
  check('it cannot be submitted twice', (await submit(GOOD)).status === 404);
  check('...and now reads as not editable', (await api('GET', `/patient-portal/${rosa.id}/form-requests/${sid}`, rosa.tok)).body.editable === false);

  // ── staff fill one for the patient ───────────────────────────────────────────────
  const bad = await api('POST', '/form-management/submissions', A.doctor.token, { template_id: templateId, patient_id: sam.id, status: 'submitted', form_data: { ...GOOD } });
  check('staff must answer the staff-only question (400)', bad.status === 400 && bad.body.fieldErrors.clinician_note);
  const ok = await api('POST', '/form-management/submissions', A.doctor.token, { template_id: templateId, patient_id: sam.id, status: 'submitted', form_data: { ...GOOD, clinician_note: 'Reviewed with patient' } },
    { 'X-User-Id': A.admin.id, 'X-User-Role': 'admin' });
  check(`staff fill a form for a patient (got ${ok.status})`, ok.status === 201 && ok.body.status === 'submitted' && ok.body.form_data.clinician_note === 'Reviewed with patient');
  const audit = (await pool.query(`SELECT actor_id, actor_role FROM ${A.T}.form_audit_logs WHERE resource_id = $1 ORDER BY created_at DESC LIMIT 1`, [ok.body.id])).rows[0];
  check('THE AUDIT TRAIL RECORDS THE SIGNED-IN USER, NOT A CLIENT HEADER', audit && audit.actor_id === A.doctor.id && audit.actor_role === 'doctor');
  const draft = await api('POST', '/form-management/submissions', A.doctor.token, { template_id: templateId, patient_id: sam.id, status: 'draft', form_data: {} });
  check('a draft can be saved incomplete', draft.status === 201);
  check('completing a requested form checks it (400)', (await api('PUT', `/form-management/submissions/${draft.body.id}`, A.doctor.token, { status: 'submitted', form_data: {} })).status === 400);
  const done = await api('PUT', `/form-management/submissions/${draft.body.id}`, A.doctor.token, { status: 'submitted', form_data: { ...GOOD, clinician_note: 'ok' } });
  check(`...and accepts it when complete (got ${done.status})`, done.status === 200 && done.body.status === 'submitted');
  const own = await api('GET', `/form-management/templates/${templateId}`, A.doctor.token);
  check(`staff open their own template by id (got ${own.status})`, own.status === 200 && own.body.fields.length === FIELDS.length);
  check('...and by its slug', (await api('GET', `/form-management/templates/mobile-intake-${RUN}`, A.doctor.token)).status === 200);
  const other = await api('GET', `/form-management/templates/${templateId}`, B.doctor.token);
  check(`another practice cannot see the template (got ${other.status} ${JSON.stringify(other.body).slice(0, 120)})`, other.status === 404);

  report();
})().catch(report);
