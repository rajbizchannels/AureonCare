// Insurance eligibility checks (X12 270/271 as JSON) through the practice's clearinghouse.
//
// A stub gateway plays Optum: it issues a token and answers eligibility by member ID. Proves the
// request carries what the payer needs (payer ID, member, DOB, the practice's NPI and service
// type), missing details are named instead of sent, the 271 is summarised (active / inactive /
// not found; copay, deductible, coinsurance, out-of-pocket, plan dates), checks are stored and
// listed per patient, and practices cannot see each other's checks.

const path = require('path');
const crypto = require('crypto');

const BACKEND = path.join(__dirname, '..', '..');
process.env.PORT = process.env.TEST_PORT || '4899';
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
  const seen = [];
  const stub = http.createServer((req, res) => {
    let data = ''; req.on('data', (c) => { data += c; });
    req.on('end', () => {
      const body = data ? JSON.parse(data) : {};
      seen.push({ url: req.url, body, auth: req.headers.authorization });
      res.setHeader('Content-Type', 'application/json');
      if (req.url === '/apip/auth/v2/token') return res.end(JSON.stringify({ access_token: 'tok-1', expires_in: 3600 }));
      if (req.url !== '/medicalnetwork/eligibility/v3') { res.statusCode = 404; return res.end('{}'); }
      if (req.headers.authorization !== 'Bearer tok-1') { res.statusCode = 401; return res.end('{}'); }
      const m = body.subscriber && body.subscriber.memberId;
      if (m === 'ACT123') return res.end(JSON.stringify({
        controlNumber: body.controlNumber, payer: { name: 'Stub Health' },
        planInformation: { groupNumber: 'GRP-9' }, planDateInformation: { planBegin: '20260101', planEnd: '20261231' },
        planStatus: [{ statusCode: '1', status: 'Active Coverage', planDetails: 'Gold PPO', serviceTypeCodes: ['30'] }],
        benefitsInformation: [
          { code: '1', name: 'Active Coverage', planCoverage: 'Gold PPO', serviceTypeCodes: ['30'] },
          { code: 'B', name: 'Co-Payment', serviceTypeCodes: ['98'], benefitAmount: '40', inPlanNetworkIndicatorCode: 'N' },
          { code: 'B', name: 'Co-Payment', serviceTypeCodes: ['98'], benefitAmount: '25', inPlanNetworkIndicatorCode: 'Y' },
          { code: 'C', name: 'Deductible', coverageLevelCode: 'IND', timeQualifierCode: '23', benefitAmount: '1500', inPlanNetworkIndicatorCode: 'Y', serviceTypeCodes: ['30'] },
          { code: 'C', name: 'Deductible', coverageLevelCode: 'IND', timeQualifierCode: '29', benefitAmount: '600', inPlanNetworkIndicatorCode: 'Y', serviceTypeCodes: ['30'] },
          { code: 'A', name: 'Co-Insurance', benefitPercent: '0.2', inPlanNetworkIndicatorCode: 'Y', serviceTypeCodes: ['98'] },
          { code: 'G', name: 'Out of Pocket', coverageLevelCode: 'IND', timeQualifierCode: '23', benefitAmount: '5000', inPlanNetworkIndicatorCode: 'Y' },
          { code: 'G', name: 'Out of Pocket', coverageLevelCode: 'IND', timeQualifierCode: '29', benefitAmount: '4100', inPlanNetworkIndicatorCode: 'Y' },
        ],
      }));
      if (m === 'OLD456') return res.end(JSON.stringify({ planStatus: [{ statusCode: '6', status: 'Inactive' }], benefitsInformation: [{ code: '6', name: 'Inactive' }] }));
      res.statusCode = 400;
      return res.end(JSON.stringify({ errors: [{ field: 'AAA', code: '75', description: 'Subscriber/Insured Not Found', followupAction: 'Please Correct and Resubmit' }] }));
    });
  });
  await new Promise((r) => stub.listen(0, '127.0.0.1', r));
  const stubUrl = `http://127.0.0.1:${stub.address().port}`;

  const RUN = crypto.randomBytes(3).toString('hex');
  const PW = 'A-Strong-Passphrase!23';
  const mk = async (label, roles) => {
    const t = await provisionTenant(pool, { name: `${label} ${RUN}` });
    const out = { t, T: t.tenant.schema_name };
    for (const role of roles) {
      const email = `${role}_${label}_${RUN}@example.com`.toLowerCase();
      const { rows: [u] } = await pool.query(`INSERT INTO public.users (id,email,first_name,last_name,role,status,password_hash,practice_id,created_at)
        VALUES (gen_random_uuid(),$1,'Ed','Elig',$2,'active',$3,$4,NOW()) RETURNING id`, [email, role, await bcrypt.hash(PW, 12), t.practiceId]);
      await pool.query(`INSERT INTO public.memberships (user_id, practice_id, role, status) VALUES ($1,$2,$3,'active') ON CONFLICT DO NOTHING`, [u.id, t.practiceId, role]);
      out[role] = { id: u.id, token: obj((await api('POST', '/auth/login', null, { email, password: PW })).body).token };
    }
    return out;
  };
  const A = await mk('Elig', ['admin', 'receptionist']);
  const B = await mk('Other', ['admin']);
  const { rows: [payer] } = await pool.query(`INSERT INTO ${A.T}.insurance_payers (payer_id, name, electronic_payer_id, is_active) VALUES ('BCBS', 'Stub Health', '87726', true) RETURNING id`);
  const mkPatient = async (memberId, extra = {}) => (await pool.query(
    `INSERT INTO ${A.T}.patients (id, first_name, last_name, mrn, date_of_birth, gender, insurance_id, insurance_payer_id)
     VALUES (gen_random_uuid(), $1, 'Lopez', $2, $3, 'female', $4, $5) RETURNING id`,
    [extra.first || 'Maria', `MRN-${extra.first || 'Maria'}-${memberId || 'none'}-${RUN}`, extra.dob === undefined ? '1985-04-12' : extra.dob, memberId, extra.payer === undefined ? payer.id : extra.payer])).rows[0].id;
  const active = await mkPatient('ACT123');
  const check = (n, c) => results.push([n, !!c]);

  // ── before the clearinghouse is connected, and before the NPI is set ──
  const r0 = await api('POST', '/eligibility/check', A.receptionist.token, { patientId: active, serviceDate: '2026-11-25' });
  check(`no NPI yet: refused naming what is missing (got ${r0.status})`, r0.status === 422 && obj(r0.body).missing.some((m) => /NPI/.test(m)));
  await api('POST', '/clinic-settings', A.admin.token, { name: `Elig Clinic ${RUN}`, npi: '1234567893' });
  const r1 = await api('POST', '/eligibility/check', A.receptionist.token, { patientId: active, serviceDate: '2026-11-25' });
  check(`no clearinghouse connection: 409 saying where to switch it on (got ${r1.status})`, r1.status === 409 && /Settings → Integrations/.test(obj(r1.body).error));

  await pool.query(`INSERT INTO ${A.T}.vendor_integration_settings (vendor_type, is_enabled, client_id, client_secret, base_url, sandbox_mode, settings)
    VALUES ('optum', true, 'cid', 'csecret', $1, true, $2)`, [stubUrl, JSON.stringify({ token_path: '/apip/auth/v2/token' })]);

  // ── active coverage ──
  const ok = await api('POST', '/eligibility/check', A.receptionist.token, { patientId: active, serviceDate: '2026-11-25', serviceType: '98' });
  const c = obj(obj(ok.body).check);
  check(`active member: 200 (got ${ok.status} ${JSON.stringify(ok.body).slice(0, 120)})`, ok.status === 200 && c.status === 'active');
  const sent = seen.filter((s) => s.url === '/medicalnetwork/eligibility/v3').pop();
  const b = obj(sent && sent.body);
  check('the 270 carries the payer ID, member, name, DOB, practice NPI and service type', b.tradingPartnerServiceId === '87726'
    && b.subscriber.memberId === 'ACT123' && b.subscriber.lastName === 'Lopez' && b.subscriber.dateOfBirth === '19850412' && b.subscriber.gender === 'F'
    && b.provider.npi === '1234567893' && b.encounter.dateOfService === '20261125' && b.encounter.serviceTypeCodes[0] === '98' && /^\d{9}$/.test(b.controlNumber));
  check('token obtained from the gateway and sent as Bearer', seen.some((s) => s.url === '/apip/auth/v2/token') && sent.auth === 'Bearer tok-1');
  check('in-network copay chosen over out-of-network (25, not 40)', c.coverage.copay === 25);
  check('deductible total and remaining', c.coverage.deductible && c.coverage.deductible.total === 1500 && c.coverage.deductible.remaining === 600);
  check('coinsurance as a percentage and out-of-pocket', c.coverage.coinsurancePercent === 20 && c.coverage.outOfPocket.remaining === 4100);
  check('plan name, group and dates', c.coverage.planName === 'Gold PPO' && c.coverage.groupNumber === 'GRP-9' && c.coverage.coverageStart === '2026-01-01' && c.coverage.coverageEnd === '2026-12-31');
  check('stored with payer and who checked it', c.payerName === 'Stub Health' && c.memberId === 'ACT123' && c.checkedBy === A.receptionist.id);

  // ── inactive / not found / missing details ──
  const inactive = await mkPatient('OLD456', { first: 'Ines' });
  const in1 = obj(obj((await api('POST', '/eligibility/check', A.receptionist.token, { patientId: inactive })).body).check);
  check('inactive coverage reported as inactive', in1.status === 'inactive' && /not active/.test(in1.message));
  const unknown = await mkPatient('ZZZ999', { first: 'Nora' });
  const nf = obj(obj((await api('POST', '/eligibility/check', A.receptionist.token, { patientId: unknown })).body).check);
  check("payer's 'not found' reply shown in its own words (a 400 from the gateway is still a 271)", nf.status === 'error' && /Subscriber\/Insured Not Found/.test(nf.message));
  const noMember = await mkPatient(null, { first: 'Mo' });
  const nm = await api('POST', '/eligibility/check', A.receptionist.token, { patientId: noMember });
  check('no member ID: 422 naming it, nothing sent', nm.status === 422 && obj(nm.body).missing.some((m) => /member ID/.test(m)));
  const noPayer = await mkPatient('ACT123', { first: 'Pat', payer: null });
  check('no payer on the patient: 422 naming it', (await api('POST', '/eligibility/check', A.receptionist.token, { patientId: noPayer })).status === 422);

  // ── history / latest / isolation ──
  const hist = await api('GET', `/eligibility?patientId=${active}`, A.receptionist.token);
  check('history lists the patient\'s checks', hist.status === 200 && hist.body.length === 1 && hist.body[0].status === 'active');
  const latest = await api('GET', `/eligibility/latest?patientId=${active}&payerId=${payer.id}&serviceDate=2026-12-01`, A.receptionist.token);
  check('latest check that applies to a nearby service date', obj(obj(latest.body).check).status === 'active');
  const far = await api('GET', `/eligibility/latest?patientId=${active}&serviceDate=2027-06-01`, A.receptionist.token);
  check('...but not to one months away', far.status === 200 && obj(far.body).check === null);
  const leak = await api('GET', `/eligibility?patientId=${active}`, B.admin.token);
  check("another practice cannot read this practice's checks", leak.status === 200 && Array.isArray(leak.body) && leak.body.length === 0);
  check('another practice cannot run a check on this patient', (await api('POST', '/eligibility/check', B.admin.token, { patientId: active })).status === 404);
  await sleep(500); // the PHI audit row is written after the response
  const { rows: [phi] } = await pool.query(`SELECT count(*)::int AS n FROM ${A.T}.audit_logs WHERE resource_type = 'eligibility' AND resource_id = $1`, [String(active)]);
  check(`reading eligibility is PHI-audited (got ${phi.n} rows)`, phi.n >= 2);

  stub.close();
  report();
})().catch((e) => report(e));
