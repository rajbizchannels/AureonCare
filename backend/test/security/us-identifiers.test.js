// US-only identifiers by geography, clinicians' personal NPI / DEA, the provider self-edit rule,
// and the Communication Preferences language options.
//
// NPI, DEA, X12 eligibility and Surescripts apply only to US practices (country US/territory, or no
// country and USD). Proves: the rule; Clinic Settings country; NPI/DEA validated and stored on the
// user; the claim check and eligibility switch off outside the US; e-prescriptions carry the
// clinician's own NPI/DEA; a doctor can edit only their own provider record; new practices get
// the language question without Portuguese.

const path = require('path');
const crypto = require('crypto');

const BACKEND = path.join(__dirname, '..', '..');
process.env.PORT = process.env.TEST_PORT || '4902';
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

(async () => {
  for (let i = 0; i < 40; i++) { try { await fetch(BASE + '/health'); break; } catch { await sleep(250); } }
  const R = require(path.join(BACKEND, 'utils/practiceRegion.js'));
  check('rule: US practice', R.usIdentifiersApply({ country: 'US' }) === true);
  check('rule: Puerto Rico uses the same systems', R.usIdentifiersApply({ country: 'PR' }) === true);
  check('rule: Germany does not', R.usIdentifiersApply({ country: 'DE', currency: 'USD' }) === false);
  check('rule: no country + USD → US', R.usIdentifiersApply({ country: null, currency: 'USD' }) === true);
  check('rule: no country + EUR → not US (production today)', R.usIdentifiersApply({ country: null, currency: 'EUR' }) === false);
  check('DEA check digit: AB1234563 valid, AB1234567 not', R.isValidDea('AB1234563') && !R.isValidDea('AB1234567'));

  const RUN = crypto.randomBytes(3).toString('hex');
  const PW = 'A-Strong-Passphrase!23';
  const mk = async (label, roles) => {
    const t = await provisionTenant(pool, { name: `${label} ${RUN}` });
    const out = { t, T: t.tenant.schema_name };
    for (const role of roles) {
      const email = `${role}_${label}_${RUN}@example.com`.toLowerCase();
      const { rows: [u] } = await pool.query(`INSERT INTO public.users (id,email,first_name,last_name,role,status,password_hash,practice_id,created_at)
        VALUES (gen_random_uuid(),$1,'Uma',$2,$5,'active',$3,$4,NOW()) RETURNING id`, [email, role, await bcrypt.hash(PW, 12), t.practiceId, role]);
      await pool.query(`INSERT INTO public.memberships (user_id, practice_id, role, status) VALUES ($1,$2,$3,'active') ON CONFLICT DO NOTHING`, [u.id, t.practiceId, role]);
      out[role] = { id: u.id, token: obj((await api('POST', '/auth/login', null, { email, password: PW })).body).token };
    }
    return out;
  };
  const US = await mk('Usa', ['admin', 'doctor']);
  const DE = await mk('Deu', ['admin']);

  // ── Clinic Settings country ──
  const s1 = await api('POST', '/clinic-settings', US.admin.token, { name: `US Clinic ${RUN}`, country: 'US', currency: 'USD' });
  check(`US practice saves country (got ${s1.status})`, s1.status === 200);
  check('...and its settings say US identifiers apply', obj((await api('GET', '/clinic-settings', US.admin.token)).body).usIdentifiers === true);
  await api('POST', '/clinic-settings', DE.admin.token, { name: `DE Praxis ${RUN}`, country: 'de', currency: 'EUR' });
  const de = obj((await api('GET', '/clinic-settings', DE.admin.token)).body);
  check('German practice: country stored as DE, US identifiers off', de.country === 'DE' && de.usIdentifiers === false);
  check('bad country refused (400)', (await api('POST', '/clinic-settings', DE.admin.token, { name: 'X', country: 'Germany1' })).status === 400);
  check('practice NPI with a wrong check digit refused (400)', (await api('POST', '/clinic-settings', US.admin.token, { name: 'X', npi: '1234567890' })).status === 400);

  // ── personal NPI / DEA on users ──
  const bad = await api('PUT', `/users/${US.doctor.id}`, US.admin.token, { npi: '1234567890' });
  check(`invalid personal NPI refused (got ${bad.status})`, bad.status === 400 && /NPI/.test(obj(bad.body).error));
  check('invalid DEA refused', (await api('PUT', `/users/${US.doctor.id}`, US.admin.token, { dea_number: 'AB1234567' })).status === 400);
  const ok = await api('PUT', `/users/${US.doctor.id}`, US.admin.token, { npi: '1245319599', dea_number: 'ab1234563' });
  check(`valid NPI and DEA saved (got ${ok.status})`, ok.status === 200);
  const { rows: [doc] } = await pool.query('SELECT npi, dea_number FROM public.users WHERE id = $1', [US.doctor.id]);
  check('...stored on the clinician (DEA upper-cased)', doc.npi === '1245319599' && doc.dea_number === 'AB1234563');
  await api('PUT', `/users/${US.doctor.id}`, US.admin.token, { dea_number: '' });
  const { rows: [doc2] } = await pool.query('SELECT npi, dea_number FROM public.users WHERE id = $1', [US.doctor.id]);
  check('an empty value clears it; others untouched', doc2.dea_number === null && doc2.npi === '1245319599');
  const nu = await api('POST', '/users', US.admin.token, { first_name: 'New', last_name: 'Doc', role: 'doctor', email: `nd_${RUN}@example.com`, npi: '1234567893' });
  const { rows: [created] } = nu.body && obj(nu.body).id ? await pool.query('SELECT npi FROM public.users WHERE id = $1', [nu.body.id]) : { rows: [{}] };
  check(`NPI accepted when creating a user (got ${nu.status})`, (nu.status === 201 || nu.status === 200) && created.npi === '1234567893');

  // ── e-prescriptions carry the clinician's own NPI / DEA ──
  const SS = require(path.join(BACKEND, 'services/vendorIntegrations/surescriptsService.js'));
  const svc = new SS({ is_enabled: true, settings: { spi: '6123456789001', npi: '1111111111' } });
  const msg = svc.toScript({ prescription: { provider_id: US.doctor.id }, provider: { id: US.doctor.id, npi: '1245319599', dea_number: 'AB1234563' } });
  check("e-prescription uses the prescriber's own NPI and DEA over the settings fallback", msg.prescriber.npi === '1245319599' && msg.prescriber.dea === 'AB1234563');

  // ── claim check and eligibility switch off outside the US ──
  const mkPatient = async (P) => (await pool.query(`INSERT INTO ${P.T}.patients (id, first_name, last_name, mrn, date_of_birth, gender, insurance_id)
    VALUES (gen_random_uuid(), 'Ida', 'Klein', $1, '1979-05-05', 'female', 'M-9') RETURNING id`, [`MRN-${RUN}-${P.T.slice(-4)}`])).rows[0].id;
  const pDE = await mkPatient(DE); const pUS = await mkPatient(US);
  const codes = (r) => ((obj(r.body).scrub || {}).issues || []).map((i) => i.code);
  const dayAgo = new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10);
  const scrubDE = await api('POST', '/claims/scrub', DE.admin.token, { patient_id: pDE, payer: 'AOK', amount: 80, service_date: dayAgo, diagnosis_codes: ['I10'], procedure_codes: ['99213'], ai: false });
  check('German practice: no NPI demand and no eligibility warning in the claim check', !codes(scrubDE).includes('NPI') && !codes(scrubDE).some((c) => c.startsWith('ELIGIBILITY')));
  const scrubUS = await api('POST', '/claims/scrub', US.admin.token, { patient_id: pUS, payer: 'X', amount: 80, service_date: dayAgo, diagnosis_codes: ['I10'], procedure_codes: ['99213'], ai: false });
  check('US practice without an NPI: the claim check asks for it', codes(scrubUS).includes('NPI'));
  const latDE = obj((await api('GET', `/eligibility/latest?patientId=${pDE}`, DE.admin.token)).body);
  check('German practice: eligibility reported not applicable (screens hide it)', latDE.applicable === false);
  const runDE = await api('POST', '/eligibility/check', DE.admin.token, { patientId: pDE });
  check('...and a check is refused with a reason (422)', runDE.status === 422 && /US payers/.test(obj(runDE.body).error));
  check('US practice: eligibility applicable', obj((await api('GET', `/eligibility/latest?patientId=${pUS}`, US.admin.token)).body).applicable === true);

  // ── provider self-edit ──
  const other = await mk('Usb', ['doctor']);
  await pool.query(`INSERT INTO public.providers (id, first_name, last_name, email) VALUES ($1,'Uma','Doctor',$2) ON CONFLICT DO NOTHING`, [US.doctor.id, `pd_${RUN}@example.com`]);
  const { rows: [doc3] } = await pool.query(`INSERT INTO public.users (id,email,first_name,last_name,role,status,password_hash,practice_id,created_at)
    VALUES (gen_random_uuid(),$1,'Ola','Other','doctor','active',$2,$3,NOW()) RETURNING id`, [`od_${RUN}@example.com`, await bcrypt.hash(PW, 12), US.t.practiceId]);
  await pool.query(`INSERT INTO public.memberships (user_id, practice_id, role, status) VALUES ($1,$2,'doctor','active') ON CONFLICT DO NOTHING`, [doc3.id, US.t.practiceId]);
  await pool.query(`INSERT INTO public.providers (id, first_name, last_name, email) VALUES ($1,'Ola','Other',$2) ON CONFLICT DO NOTHING`, [doc3.id, `po_${RUN}@example.com`]);
  check('a doctor cannot edit another doctor\'s provider record (403)', (await api('PUT', `/providers/${doc3.id}`, US.doctor.token, { specialization: 'Hacked' })).status === 403);
  check('...but can edit their own', (await api('PUT', `/providers/${US.doctor.id}`, US.doctor.token, { specialization: 'Cardiology' })).status === 200);
  void other;

  // ── Communication Preferences: no Portuguese in a new practice ──
  const { rows: [cp] } = await pool.query(`SELECT fields FROM ${US.T}.form_templates WHERE slug = 'communication-preferences'`);
  const q = cp && cp.fields.find((f) => f.id === 'preferred_language');
  check('new practice: the language question has no Portuguese option', q && !q.options.some((o) => /Portugu/.test(o)) && q.options.includes('English'));
  report();
})().catch((e) => report(e));
