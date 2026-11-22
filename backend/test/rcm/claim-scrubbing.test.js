// Claim scrubbing before submission: rule checks, the AI review, and the submission gate.
//
// Proves each rule fires on the claim that breaks it (identifiers, ICD-10/CPT format and
// billability, dates and timely filing, amount, duplicates, prior auth, eligibility), a clean
// claim passes, the AI review runs only when switched on and gets codes but no patient name,
// nothing can be marked Submitted or sent as an 837 without a clean check made after the last
// change, an override needs an admin/billing manager and a reason, and practices are separate.

const path = require('path');
const crypto = require('crypto');

const BACKEND = path.join(__dirname, '..', '..');
process.env.PORT = process.env.TEST_PORT || '4900';
process.env.NODE_ENV = 'development';
process.env.AC_JWT_S = process.env.AC_JWT_S || crypto.randomBytes(48).toString('base64');
process.env.AC_TK_S = process.env.AC_TK_S || process.env.AC_JWT_S;
process.env.AC_IDX_K = process.env.AC_IDX_K || crypto.randomBytes(32).toString('base64');
process.env.AC_PW_BREACH_CHECK = 'false';
process.env.FRONTEND_URL = 'https://app.example.test';
delete process.env.AC_ADMIN_EMAIL; delete process.env.AC_ADMIN_PHONE;
const BASE = `http://127.0.0.1:${process.env.PORT}`;

const outbox = [];
const notify = require(path.join(BACKEND, 'services/notificationService.js'));
notify.sendEmail = async (to, subject, html) => { outbox.push({ to, subject, html }); return { sent: true }; };
const waSent = [];
notify.sendWhatsAppTo = async (phone, text) => { waSent.push({ phone, text }); };
const pool = require(path.join(BACKEND, 'db.js'));
const bcrypt = require(path.join(BACKEND, '..', 'node_modules', 'bcryptjs'));
const { provisionTenant } = require(path.join(BACKEND, 'services/tenantProvisioning.js'));
require(path.join(BACKEND, 'server.js'));

const results = [];
const check = (n, c) => results.push([n, !!c]);
const obj = (v) => v || {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
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

const http = require('http');
(async () => {
  for (let i = 0; i < 40; i++) { try { await fetch(BASE + '/health'); break; } catch { await sleep(250); } }
  const prompts = [];
  const mock = http.createServer((req, res) => {
    let b = ''; req.on('data', (c) => { b += c; });
    req.on('end', () => {
      res.setHeader('Content-Type', 'application/json');
      if (req.method === 'GET') return res.end(JSON.stringify({ data: [{ id: 'mock-model' }] }));
      const j = JSON.parse(b || '{}'); const u = (j.messages || []).find((m) => m.role === 'user');
      prompts.push(u ? u.content : '');
      res.end(JSON.stringify({ model: j.model, usage: { prompt_tokens: 50, completion_tokens: 20 },
        choices: [{ message: { role: 'assistant', content: '- 99214 with E11.9 alone: check the visit level is supported.' }, finish_reason: 'stop' }] }));
    });
  });
  await new Promise((r) => mock.listen(0, '127.0.0.1', r));

  const RUN = crypto.randomBytes(3).toString('hex');
  const PW = 'A-Strong-Passphrase!23';
  const mk = async (label, roles) => {
    const t = await provisionTenant(pool, { name: `${label} ${RUN}` });
    const out = { t, T: t.tenant.schema_name };
    for (const role of roles) {
      const email = `${role}_${label}_${RUN}@example.com`.toLowerCase();
      const { rows: [u] } = await pool.query(`INSERT INTO public.users (id,email,first_name,last_name,role,status,password_hash,practice_id,created_at)
        VALUES (gen_random_uuid(),$1,'Bo','Biller',$2,'active',$3,$4,NOW()) RETURNING id`, [email, role, await bcrypt.hash(PW, 12), t.practiceId]);
      await pool.query(`INSERT INTO public.memberships (user_id, practice_id, role, status) VALUES ($1,$2,$3,'active') ON CONFLICT DO NOTHING`, [u.id, t.practiceId, role]);
      out[role] = { id: u.id, token: obj((await api('POST', '/auth/login', null, { email, password: PW })).body).token };
    }
    return out;
  };
  const A = await mk('Scrub', ['admin', 'billing_manager', 'receptionist']);
  const B = await mk('Elsewhere', ['admin']);
  // Reference codes (production has the full sets; this database may have none).
  for (const [type, code] of [['ICD-10', 'E11.9'], ['ICD-10', 'E11.65'], ['ICD-10', 'I10'], ['CPT', '99213'], ['CPT', '99214']]) {
    await pool.query(`INSERT INTO public.medical_codes (code, description, code_type, is_active)
      SELECT $1::text, $1::text, $2::text, true WHERE NOT EXISTS (SELECT 1 FROM public.medical_codes WHERE code = $1::text AND code_type = $2::text)`, [code, type]);
  }
  await api('POST', '/clinic-settings', A.admin.token, { name: `Scrub Clinic ${RUN}`, npi: '1234567893', taxId: '12-3456789' });
  const { rows: [P] } = await pool.query(`INSERT INTO ${A.T}.insurance_payers (payer_id, name, electronic_payer_id, timely_filing_limit, prior_authorization_required, is_active)
    VALUES ('SH', 'Stub Health', '87726', 90, false, true) RETURNING id`);
  const { rows: [Q] } = await pool.query(`INSERT INTO ${A.T}.insurance_payers (payer_id, name, prior_authorization_required, is_active)
    VALUES ('PA', 'Paper Assurance', true, true) RETURNING id`);
  const mkPatient = async (first, { member = 'M-1', dob = '1980-01-01', gender = 'female', payer = P.id } = {}) => (await pool.query(
    `INSERT INTO ${A.T}.patients (id, first_name, last_name, mrn, date_of_birth, gender, insurance_id, insurance_payer_id)
     VALUES (gen_random_uuid(), $1, 'Quinn', $2, $3, $4, $5, $6) RETURNING id`, [first, `MRN-${first}-${RUN}`, dob, gender, member, payer])).rows[0].id;
  const good = await mkPatient('Grace');
  const day = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
  const codes = (s) => obj(obj(s).scrub).issues ? s.scrub.issues.map((i) => i.code) : [];
  const draft = (over) => api('POST', '/claims/scrub', A.billing_manager.token, {
    patient_id: good, payer_id: P.id, service_date: day(5), amount: 150, diagnosis_codes: ['E11.9'], procedure_codes: ['99213'], ...over });

  // ── rules ──
  const d1 = await draft({});
  check(`draft claim checks (got ${d1.status})`, d1.status === 200);
  check('no eligibility check yet: a warning, not an error', d1.body.scrub.status === 'warnings' && codes(d1.body).includes('ELIGIBILITY_UNCHECKED'));
  check('AI review reported as switched off (feature not enabled)', d1.body.scrub.ai.status === 'disabled');
  await pool.query(`INSERT INTO ${A.T}.eligibility_checks (patient_id, payer_id, payer_name, member_id, service_date, status) VALUES ($1,$2,'Stub Health','M-1',$3,'active')`, [good, P.id, day(5)]);
  const d2 = await draft({});
  check('clean claim with active eligibility passes', d2.body.scrub.status === 'passed' && d2.body.scrub.errors === 0 && d2.body.scrub.warnings === 0);

  const bad = await mkPatient('Bert', { member: null, gender: null });
  const d3 = await draft({ patient_id: bad, diagnosis_codes: ['E11', 'XYZ'], procedure_codes: ['9921'], amount: 0, service_date: day(-3) });
  const c3 = codes(d3.body);
  check('missing member ID is an error; missing sex a warning', c3.includes('MEMBER_ID') && c3.includes('PATIENT_SEX'));
  check('E11 is a category, not billable', c3.includes('DX_NOT_BILLABLE'));
  check('malformed ICD-10 and CPT codes', c3.includes('DX_FORMAT') && c3.includes('PX_FORMAT'));
  check('future date of service and zero amount', c3.includes('DOS_FUTURE') && c3.includes('AMOUNT'));
  check('a claim with errors fails', d3.body.scrub.status === 'failed' && d3.body.scrub.errors >= 5);
  const d4 = await draft({ service_date: day(120) });
  check('past the payer timely-filing limit (90 days) is an error', codes(d4.body).includes('TIMELY_FILING'));
  const d5 = await draft({ service_date: day(80) });
  check('close to the limit is a warning', codes(d5.body).includes('TIMELY_FILING_SOON'));
  const qPatient = await mkPatient('Quentin', { payer: Q.id });
  const d6 = await draft({ patient_id: qPatient, payer_id: Q.id });
  check('payer requiring prior auth with none linked: warning; no electronic payer ID: warning', codes(d6.body).includes('PRIOR_AUTH') && codes(d6.body).includes('PAYER_EDI_ID'));
  await pool.query(`INSERT INTO ${A.T}.eligibility_checks (patient_id, payer_id, payer_name, member_id, service_date, status, message) VALUES ($1,$2,'Paper Assurance','M-1',$3,'inactive','Coverage is not active')`, [qPatient, Q.id, day(5)]);
  const d7 = await draft({ patient_id: qPatient, payer_id: Q.id });
  check('eligibility reported inactive is an error', codes(d7.body).includes('ELIGIBILITY_INACTIVE') && d7.body.scrub.status === 'failed');

  // ── saved claims and the submission gate ──
  const mkClaim = async (over = {}) => obj((await api('POST', '/claims', A.billing_manager.token, {
    patient_id: good, payer: 'Stub Health', payer_id: P.id, amount: 150, service_date: day(5), diagnosis_codes: ['E11.9'], procedure_codes: ['99213'], status: 'pending', ...over })).body);
  const c1 = await mkClaim();
  check('claim saved', Boolean(c1.id));
  const dupe = await draft({});
  check('a second claim for the same patient, date and code is flagged as a duplicate', codes(dupe.body).includes('DUPLICATE'));
  const put0 = await api('PUT', `/claims/${c1.id}`, A.billing_manager.token, { status: 'Submitted' });
  check(`cannot mark Submitted before it is checked (got ${put0.status})`, put0.status === 409 && obj(put0.body).scrubRequired === true);
  const edi0 = await api('POST', `/edi/837/submit/${c1.id}`, A.billing_manager.token, {});
  check(`cannot send the 837 before it is checked (got ${edi0.status})`, edi0.status === 409);
  const s1 = await api('POST', `/claims/${c1.id}/scrub`, A.billing_manager.token, { payer_id: P.id, ai: false });
  check('saved claim checked and the result stored', s1.status === 200 && s1.body.scrub.status === 'passed');
  const { rows: [st] } = await pool.query(`SELECT scrub_status, scrubbed_at FROM ${A.T}.claims WHERE id = $1`, [c1.id]);
  check('...on the claim', st.scrub_status === 'passed' && st.scrubbed_at);
  check('mark Submitted with changes in the same request is refused', (await api('PUT', `/claims/${c1.id}`, A.billing_manager.token, { status: 'Submitted', amount: 999 })).status === 409);
  const put1 = await api('PUT', `/claims/${c1.id}`, A.billing_manager.token, { status: 'Submitted' });
  check(`checked and clean: can be marked Submitted (got ${put1.status})`, put1.status === 200);

  const c2 = await mkClaim({ procedure_codes: ['99214'], amount: 200 });
  await api('POST', `/claims/${c2.id}/scrub`, A.billing_manager.token, { payer_id: P.id, ai: false });
  await api('PUT', `/claims/${c2.id}`, A.billing_manager.token, { amount: 210 });
  check('edited after its check: must be checked again', (await api('PUT', `/claims/${c2.id}`, A.billing_manager.token, { status: 'Submitted' })).status === 409);

  const badClaim = await mkClaim({ patient_id: bad, diagnosis_codes: ['E11'], procedure_codes: ['99213'] });
  const s3 = await api('POST', `/claims/${badClaim.id}/scrub`, A.billing_manager.token, { payer_id: P.id, ai: false });
  check('failed check stored', s3.body.scrub.status === 'failed');
  const blocked = await api('PUT', `/claims/${badClaim.id}`, A.billing_manager.token, { status: 'Submitted' });
  check('a failed claim cannot be submitted', blocked.status === 409 && obj(blocked.body).scrubStatus === 'failed');
  check('receptionist cannot override (403)', (await api('POST', `/claims/${badClaim.id}/scrub/override`, A.receptionist.token, { reason: 'Payer confirmed by phone, ref 123' })).status === 403);
  check('override needs a real reason (400)', (await api('POST', `/claims/${badClaim.id}/scrub/override`, A.billing_manager.token, { reason: 'ok' })).status === 400);
  const ov = await api('POST', `/claims/${badClaim.id}/scrub/override`, A.billing_manager.token, { reason: 'Payer confirmed by phone, reference 12345' });
  check('billing manager overrides with a reason', ov.status === 200);
  const { rows: [ovr] } = await pool.query(`SELECT scrub_override_by, scrub_override_reason FROM ${A.T}.claims WHERE id = $1`, [badClaim.id]);
  check('...recorded with who and why', ovr.scrub_override_by === A.billing_manager.id && /12345/.test(ovr.scrub_override_reason));
  check('overridden claim can be submitted', (await api('PUT', `/claims/${badClaim.id}`, A.billing_manager.token, { status: 'Submitted' })).status === 200);

  const direct = obj((await api('POST', '/claims', A.billing_manager.token, {
    patient_id: bad, payer: 'Stub Health', payer_id: P.id, amount: 0, service_date: day(5), diagnosis_codes: ['E11'], procedure_codes: ['99213'], status: 'pending', submitToClearinghouse: true })).body);
  check('create-and-submit with errors: saved, checked, NOT sent', direct.id && direct.scrub && direct.scrub.status === 'failed' && /Not submitted/.test(direct.clearinghouse_error || '') && direct.status === 'pending');

  // ── AI review ──
  await api('PUT', '/ai/providers/offline', A.admin.token, { base_url: `http://127.0.0.1:${mock.address().port}/v1`, default_model: 'mock-model' });
  await api('PATCH', '/ai/providers/offline/toggle', A.admin.token, { is_enabled: true });
  const on = await api('PATCH', '/ai/features/claim_scrubbing', A.admin.token, { provider: 'offline', model: 'mock-model', is_enabled: true });
  check(`AI claim scrubbing switched on (got ${on.status})`, on.status === 200);
  const withAi = await draft({ procedure_codes: ['99214'] });
  const aiRes = obj(obj(withAi.body).scrub).ai || {};
  check(`AI review runs and returns its findings (got ${aiRes.status} ${aiRes.message || ''})`, aiRes.status === 'ok' && /visit level/.test(aiRes.text || ''));
  const prompt = prompts[prompts.length - 1] || '';
  check('the AI sees the codes, payer and dates', /E11\.9/.test(prompt) && /99214/.test(prompt) && /Stub Health/.test(prompt));
  check('...but not the patient\'s name or member ID', !/Grace/.test(prompt) && !/Quinn/.test(prompt) && !/M-1/.test(prompt));
  const rulesOnly = await draft({ procedure_codes: ['99214'], ai: false });
  check('AI findings never change the outcome: same status as the rules alone', withAi.body.scrub.status === rulesOnly.body.scrub.status
    && withAi.body.scrub.errors === rulesOnly.body.scrub.errors && rulesOnly.body.scrub.ai.status === 'skipped');

  // ── isolation ──
  check("another practice cannot check this practice's claim (404)", (await api('POST', `/claims/${c1.id}/scrub`, B.admin.token, { ai: false })).status === 404);

  mock.close();
  report();
})().catch((e) => report(e));
