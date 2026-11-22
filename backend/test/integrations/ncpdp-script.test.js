// Surescripts e-prescribing over NCPDP SCRIPT 2017071.
//
// 1. The message builder: NewRx / CancelRx carry what routing and dispensing need, escape what
//    a prescriber types, include the DEA number for controlled drugs, and refuse to build when
//    data is missing (with a list a prescriber can act on).
// 2. The response reader: Status / Verify / Error.
// 3. The service posts the XML to the endpoint (a local stub here) with Basic auth and maps
//    the answer.
// 4. The routes: Send/Cancel eRx no longer answer 501 for every practice (the schema check
//    looked in `public`); with Surescripts on, a NewRx is sent and only marked sent when the
//    network accepts it; missing data and network Errors are 422s; a cancel sends a CancelRx
//    pointing at the NewRx.

const path = require('path');
const http = require('http');
const crypto = require('crypto');

const BACKEND = path.join(__dirname, '..', '..');
const script = require(path.join(BACKEND, 'services/ncpdp/script.js'));
const SurescriptsService = require(path.join(BACKEND, 'services/vendorIntegrations/surescriptsService.js'));

const results = [];
const check = (n, c) => results.push([n, !!c]);
const report = (err) => {
  let failed = 0;
  for (const [n, c] of results) { console.log(`  ${c ? 'ok  ' : 'FAIL'} ${n}`); if (!c) failed += 1; }
  if (err) { console.error(`\nSTOPPED: ${err.message || err}`); console.error(err); }
  else console.log(`\n${results.length - failed}/${results.length} checks passed.`);
  process.exit(err || failed ? 1 : 0);
};

const RX = () => ({
  prescriberOrderNumber: 'ORD123',
  patient: { firstName: 'Ann & Co', lastName: "O'Brien <Jr>", gender: 'female', dateOfBirth: '1980-04-02', phone: '(555) 201-3344',
    address: { line1: '12 Elm St', city: 'Springfield', state: 'il', postalCode: '62701' } },
  pharmacy: { ncpdpId: '1234567', npi: '1112223334', name: 'Main Street Pharmacy', phone: '555-111-2222',
    address: { line1: '1 Main St', city: 'Springfield', state: 'IL', postalCode: '62701' } },
  prescriber: { spi: '6123456789001', npi: '1234567890', dea: 'AB1234563', firstName: 'Dana', lastName: 'Lee', phone: '555-333-4444',
    address: { line1: '100 Clinic Rd', city: 'Springfield', state: 'IL', postalCode: '62702' } },
  medication: { description: 'Amoxicillin 500 mg capsule', ndc: '00093-3109-01', quantity: 21, unit: 'capsule', daysSupply: 7,
    writtenDate: '2026-11-22', substitutionAllowed: true, refills: 0, sig: 'Take 1 capsule by mouth 3 times a day & finish <all>',
    diagnosisCode: 'J02.9', diagnosisDescription: 'Pharyngitis' },
});
const has = (xml, s) => xml.includes(s);

async function unitChecks() {
  // ── builder ──
  const b = script.buildNewRx(RX(), { messageId: 'MSG1', at: new Date('2026-11-22T10:00:00Z') });
  check('a complete NewRx builds', b.ok && b.messageId === 'MSG1');
  const x = b.xml;
  check('SCRIPT 2017071 envelope with the NCPDP namespace', has(x, 'xmlns="http://www.ncpdp.org/schema/SCRIPT"') && has(x, 'TransactionVersion="2017071"'));
  check('header: To = pharmacy NCPDP ID (P), From = prescriber SPI (C)', has(x, '<To Qualifier="P">1234567</To>') && has(x, '<From Qualifier="C">6123456789001</From>'));
  check('header: MessageID, UTC SentTime, PrescriberOrderNumber, SenderSoftware',
    has(x, '<MessageID>MSG1</MessageID>') && has(x, '<SentTime>2026-11-22T10:00:00.000Z</SentTime>') && has(x, '<PrescriberOrderNumber>ORD123</PrescriberOrderNumber>') && has(x, '<SenderSoftwareProduct>'));
  check('body is a NewRx with patient, pharmacy, prescriber, medication', /<Body><NewRx><Patient>.*<\/Patient><Pharmacy>.*<\/Pharmacy><Prescriber>.*<\/Prescriber><MedicationPrescribed>.*<\/MedicationPrescribed><\/NewRx><\/Body>/.test(x));
  check('patient: gender F, DOB, state upper-cased, ZIP', has(x, '<Gender>F</Gender>') && has(x, '<DateOfBirth><Date>1980-04-02</Date></DateOfBirth>') && has(x, '<StateProvince>IL</StateProvince>'));
  check('drug coded by NDC (11 digits, qualifier ND)', has(x, '<ProductCode><Code>00093310901</Code><Qualifier>ND</Qualifier></ProductCode>'));
  check('quantity with original-quantity qualifier and the capsule unit code', has(x, '<Value>21</Value><CodeListQualifier>38</CodeListQualifier><QuantityUnitOfMeasure><Code>C48480</Code>'));
  check('days supply, written date, refills', has(x, '<DaysSupply>7</DaysSupply>') && has(x, '<WrittenDate><Date>2026-11-22</Date></WrittenDate>') && has(x, '<NumberOfRefills>0</NumberOfRefills>'));
  check('substitution allowed = 0 (dispense as written would be 1)', has(x, '<Substitutions>0</Substitutions>'));
  check('ICD-10 diagnosis (qualifier ABF)', has(x, '<Code>J029</Code><Qualifier>ABF</Qualifier>'));
  check('XML special characters in names and sig are escaped',
    has(x, '<FirstName>Ann &amp; Co</FirstName>') && has(x, '<LastName>O&apos;Brien &lt;Jr&gt;</LastName>') && has(x, 'finish &lt;all&gt;') && !has(x, '<all>'));
  check('no DEA number for a non-controlled drug', !has(x, 'DEANumber') && !has(x, 'DEASchedule'));
  const xr = await require('xml2js').parseStringPromise(x).catch(() => null);
  check('the message is well-formed XML', Boolean(xr && xr.Message));

  const daw = script.buildNewRx({ ...RX(), medication: { ...RX().medication, substitutionAllowed: false } });
  check('dispense as written → Substitutions 1', daw.ok && has(daw.xml, '<Substitutions>1</Substitutions>'));

  // ── controlled substances ──
  const ctl = { ...RX(), medication: { ...RX().medication, description: 'Oxycodone 5 mg tablet', deaSchedule: 'CII', unit: 'tablet' } };
  const refused = script.buildNewRx(ctl);
  check('a Schedule II drug is refused without EPCS', !refused.ok && refused.missing.some((m) => /EPCS/.test(m)));
  const ctlOk = script.buildNewRx(ctl, { allowControlled: true });
  check('...and when allowed, carries the DEA number and Schedule II code', ctlOk.ok && has(ctlOk.xml, '<DEANumber>AB1234563</DEANumber>') && has(ctlOk.xml, '<DEASchedule><Code>C48675</Code></DEASchedule>') && has(ctlOk.xml, '<Code>C48542</Code>'));
  const noDea = script.buildNewRx({ ...ctl, prescriber: { ...ctl.prescriber, dea: '' } }, { allowControlled: true });
  check('a controlled drug without a prescriber DEA number is refused', !noDea.ok && noDea.missing.some((m) => /DEA/.test(m)));

  // ── missing data ──
  const bad = script.buildNewRx({ ...RX(), pharmacy: { ...RX().pharmacy, ncpdpId: '' }, prescriber: { ...RX().prescriber, spi: '', npi: '123' }, medication: { ...RX().medication, ndc: '' } });
  check('missing data is refused, not sent broken', !bad.ok && !bad.xml);
  check('...and named for the prescriber', ['Pharmacy NCPDP ID', 'Prescriber Surescripts SPI', 'Prescriber NPI', 'Drug NDC'].every((l) => bad.missing.some((m) => m.startsWith(l))));
  check('an unknown unit falls back to "unspecified"', script.unitCode('puffs') === script.UNIT_UNSPECIFIED);

  // ── CancelRx ──
  const c = script.buildCancelRx({ ...RX(), originalMessageId: 'MSG1' }, { messageId: 'MSG2' });
  check('CancelRx points at the NewRx it cancels', c.ok && has(c.xml, '<RelatesToMessageID>MSG1</RelatesToMessageID>') && has(c.xml, '<Body><CancelRx><Patient>'));
  check('CancelRx without the original message ID is refused', !script.buildCancelRx(RX()).ok);

  // ── responses ──
  const env = (body, rel = 'MSG1') => `<?xml version="1.0"?><Message xmlns="http://www.ncpdp.org/schema/SCRIPT"><Header><To Qualifier="C">6123456789001</To><From Qualifier="P">1234567</From><MessageID>R1</MessageID><RelatesToMessageID>${rel}</RelatesToMessageID><SentTime>2026-11-22T10:00:01Z</SentTime></Header><Body>${body}</Body></Message>`;
  const st = await script.parseResponse(env('<Status><Code>000</Code></Status>'));
  check('Status 000 = accepted', st.ok && st.type === 'Status' && st.code === '000' && st.relatesToMessageId === 'MSG1');
  const vf = await script.parseResponse(env('<Verify><VerifyStatus><Code>010</Code></VerifyStatus></Verify>'));
  check('Verify 010 = delivered', vf.ok && vf.type === 'Verify' && vf.code === '010');
  const er = await script.parseResponse(env('<Error><Code>900</Code><DescriptionCode>1000</DescriptionCode><Description>Unable to identify based on information submitted</Description></Error>'));
  check('Error 900 is a refusal with its description', !er.ok && er.type === 'Error' && er.code === '900' && er.descriptionCode === '1000' && /Unable to identify/.test(er.description));
  const pref = await script.parseResponse('<ns:Message xmlns:ns="http://www.ncpdp.org/schema/SCRIPT"><ns:Body><ns:Status><ns:Code>010</ns:Code></ns:Status></ns:Body></ns:Message>');
  check('namespace prefixes are tolerated', pref.ok && pref.code === '010');
  const junk = await script.parseResponse('<html>Bad gateway</html>');
  check('a non-SCRIPT answer is a failure, not a crash', !junk.ok && /not a SCRIPT message/.test(junk.description));
}

// ── a stub Surescripts endpoint ──
function stubServer() {
  const seen = [];
  let mode = 'status';
  const srv = http.createServer((req, res) => {
    let body = ''; req.on('data', (d) => { body += d; });
    req.on('end', () => {
      seen.push({ method: req.method, headers: req.headers, body });
      const rel = (/<MessageID>([^<]+)<\/MessageID>/.exec(body) || [])[1] || '';
      const answer = mode === 'error'
        ? '<Error><Code>900</Code><DescriptionCode>1000</DescriptionCode><Description>Pharmacy not found on the network</Description></Error>'
        : mode === 'unauth' ? null : '<Status><Code>000</Code></Status>';
      if (!answer) { res.writeHead(401); return res.end('unauthorised'); }
      res.writeHead(200, { 'Content-Type': 'application/xml' });
      res.end(`<?xml version="1.0"?><Message xmlns="http://www.ncpdp.org/schema/SCRIPT"><Header><MessageID>R-${seen.length}</MessageID><RelatesToMessageID>${rel}</RelatesToMessageID></Header><Body>${answer}</Body></Message>`);
    });
  });
  return new Promise((resolve) => srv.listen(0, '127.0.0.1', () => resolve({
    url: `http://127.0.0.1:${srv.address().port}/script`, seen, setMode: (m) => { mode = m; }, close: () => srv.close(),
  })));
}

async function serviceChecks(stub) {
  const svc = new SurescriptsService({ is_enabled: true, username: 'ss-user', password: 'ss-pass', base_url: stub.url, settings: {} });
  check('configured with endpoint + Basic credentials', svc.isConfigured());
  stub.setMode('status');
  const r = await svc.sendPrescription(RX());
  const last = stub.seen[stub.seen.length - 1];
  check('posts the SCRIPT XML', last && last.method === 'POST' && /<NewRx>/.test(last.body));
  check('...as application/xml', last && /^application\/xml/.test(last.headers['content-type']));
  check('...with HTTP Basic credentials', last && last.headers.authorization === 'Basic ' + Buffer.from('ss-user:ss-pass').toString('base64'));
  check('an accepted NewRx → success, status sent, vendorId = MessageID', r.success && r.status === 'sent' && r.vendorId && r.vendorId === r.messageId && last.body.includes(`<MessageID>${r.messageId}</MessageID>`));
  stub.setMode('error');
  const e = await svc.sendPrescription(RX());
  check('a network Error → failure carrying its description', !e.success && /Pharmacy not found/.test(e.error) && e.errors[0].code === '900');
  stub.setMode('unauth');
  const u = await svc.sendPrescription(RX());
  check('refused credentials (401) → failure', !u.success && /credentials/.test(u.error));
  stub.setMode('status');
  const before = stub.seen.length;
  const m = await svc.sendPrescription({ ...RX(), pharmacy: { ...RX().pharmacy, ncpdpId: '' } });
  check('missing data → nothing posted, list returned', !m.success && m.status === 'incomplete' && m.missing.length && stub.seen.length === before);
  const off = new SurescriptsService({ is_enabled: false, username: 'a', password: 'b', base_url: stub.url });
  check('a switched-off integration sends nothing', !(await off.sendPrescription(RX())).success && stub.seen.length === before);
  const ids = new SurescriptsService({ settings: { spi: 'DEF-SPI', npi: '1111111111', prescribers: { u1: { spi: 'U1-SPI', npi: '2222222222', dea: 'XY1234567' } } } });
  check('per-prescriber SPI/NPI/DEA, with the practice default as fallback',
    ids.prescriberIds('u1').spi === 'U1-SPI' && ids.prescriberIds('u1').dea === 'XY1234567' && ids.prescriberIds('other').spi === 'DEF-SPI');
}

async function routeChecks(stub) {
  process.env.PORT = process.env.TEST_PORT || '4891';
  process.env.NODE_ENV = 'development';
  process.env.AC_JWT_S = process.env.AC_JWT_S || crypto.randomBytes(48).toString('base64');
  process.env.AC_TK_S = process.env.AC_TK_S || process.env.AC_JWT_S;
  process.env.AC_PW_BREACH_CHECK = 'false';
  const BASE = `http://127.0.0.1:${process.env.PORT}`;
  const pool = require(path.join(BACKEND, 'db.js'));
  const bcrypt = require(path.join(BACKEND, '..', 'node_modules', 'bcryptjs'));
  const { provisionTenant } = require(path.join(BACKEND, 'services/tenantProvisioning.js'));
  require(path.join(BACKEND, 'server.js'));
  const call = async (method, url, token, body) => {
    const r = await fetch(BASE + url, { method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body) });
    const t = await r.text(); let b = null; try { b = JSON.parse(t); } catch { b = t; }
    return { status: r.status, body: b };
  };
  for (let i = 0; i < 40; i++) { try { await fetch(BASE + '/health'); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }

  const RUN = crypto.randomBytes(4).toString('hex');
  const t = await provisionTenant(pool, { name: `eRx ${RUN}` });
  const S = t.tenant.schema_name;
  const email = `erx_doc_${RUN}@example.com`;
  const { rows: [doc] } = await pool.query(`INSERT INTO public.users (id,email,first_name,last_name,role,status,password_hash,practice_id,phone,created_at)
    VALUES (gen_random_uuid(),$1,'Dana','Lee','doctor','active',$2,$3,'555-333-4444',NOW()) RETURNING id`,
  [email, await bcrypt.hash('A-Strong-Passphrase!23', 12), t.practiceId]);
  const token = (await call('POST', '/api/auth/login', null, { email, password: 'A-Strong-Passphrase!23' })).body.token;
  check('(prescriber signs in)', Boolean(token));
  const { rows: [pt] } = await pool.query(`INSERT INTO ${S}.patients (id, mrn, first_name, last_name, date_of_birth, gender, address, city, state, zip, phone)
    VALUES (gen_random_uuid(), $1, 'Ann', 'O''Brien', '1980-04-02', 'Female', '12 Elm St', 'Springfield', 'IL', '62701', '555-201-3344') RETURNING id`, [`MRN-${RUN}`]);
  const { rows: [ph] } = await pool.query(`INSERT INTO ${S}.pharmacies (ncpdp_id, pharmacy_name, address_line1, city, state, zip_code, phone)
    VALUES ($1, 'Main Street Pharmacy', '1 Main St', 'Springfield', 'IL', '62701', '555-111-2222') RETURNING id`, [String(1000000 + Math.floor(Math.random() * 8999999))]);
  const mkRx = async (extra = {}) => (await pool.query(`INSERT INTO ${S}.prescriptions
      (patient_id, provider_id, medication_name, drug_strength, drug_form, ndc_code, dosage, frequency, quantity, days_supply, refills, instructions, status, prescribed_date, diagnosis_code, controlled_substance_class)
      VALUES ($1,$2,'Amoxicillin','500 mg','capsule',$3,'500 mg','TID',21,7,0,'Take 1 capsule 3 times a day','Active','2026-11-22','J02.9',$4) RETURNING id`,
  [pt.id, doc.id, extra.ndc === undefined ? '00093310901' : extra.ndc, extra.controlled || null])).rows[0].id;

  // Surescripts OFF: Send eRx works again (it was a 501 for every practice) and says it was not transmitted.
  const rx0 = await mkRx();
  const off = await call('POST', `/api/prescriptions/${rx0}/send-erx`, token, { pharmacyId: ph.id });
  check(`Send eRx no longer answers 501 for a practice (got ${off.status})`, off.status === 200);
  check('...and without Surescripts says it was NOT transmitted', off.body && off.body.transmitted === false && /not switched on/.test(off.body.message));

  // Surescripts ON (inserted directly: the settings API rightly refuses a loopback base URL).
  await pool.query(`INSERT INTO ${S}.vendor_integration_settings (vendor_type, is_enabled, username, password, base_url, sandbox_mode, settings)
    VALUES ('surescripts', true, 'ss-user', 'ss-pass', $1, true, $2)`, [stub.url, JSON.stringify({
    spi: '6123456789001', npi: '1234567890', practice_phone: '555-333-4444',
    practice_address: { line1: '100 Clinic Rd', city: 'Springfield', state: 'IL', postalCode: '62702' },
  })]);

  const rxNoNdc = await mkRx({ ndc: null });
  const before = stub.seen.length;
  const miss = await call('POST', `/api/prescriptions/${rxNoNdc}/send-erx`, token, { pharmacyId: ph.id });
  check(`missing NDC → 422 naming it (got ${miss.status})`, miss.status === 422 && Array.isArray(miss.body.missing) && miss.body.missing.some((m) => /NDC/.test(m)));
  check('...nothing posted to the network and it is not marked sent',
    stub.seen.length === before && (await pool.query(`SELECT erx_status FROM ${S}.prescriptions WHERE id=$1`, [rxNoNdc])).rows[0].erx_status === 'draft');

  stub.setMode('error');
  const rxE = await mkRx();
  const err = await call('POST', `/api/prescriptions/${rxE}/send-erx`, token, { pharmacyId: ph.id });
  check(`a network Error → 422 with its description (got ${err.status})`, err.status === 422 && /Pharmacy not found/.test(err.body.error));
  check('...and it is not marked sent (still draft, error recorded)', await pool.query(`SELECT erx_status, erx_error_message FROM ${S}.prescriptions WHERE id=$1`, [rxE]).then((r) => r.rows[0].erx_status === 'draft' && /Pharmacy not found/.test(r.rows[0].erx_error_message)));

  stub.setMode('status');
  const rx1 = await mkRx();
  const ok = await call('POST', `/api/prescriptions/${rx1}/send-erx`, token, { pharmacyId: ph.id });
  const sent = stub.seen[stub.seen.length - 1];
  const row = (await pool.query(`SELECT erx_status, erx_message_id, vendor_prescription_id FROM ${S}.prescriptions WHERE id=$1`, [rx1])).rows[0];
  check(`an accepted NewRx → 200 transmitted (got ${ok.status})`, ok.status === 200 && ok.body.transmitted === true);
  check('the NewRx carried the chart patient, the pharmacy NCPDP ID and the prescriber NPI',
    /<NewRx>/.test(sent.body) && /<LastName>O&apos;Brien<\/LastName>/.test(sent.body) && sent.body.includes(`<NCPDPID>`) && /<NPI>1234567890<\/NPI>/.test(sent.body));
  check('stored: status sent, message ID = the NewRx MessageID', row.erx_status === 'sent' && row.vendor_prescription_id && row.erx_message_id === row.vendor_prescription_id
    && sent.body.includes(`<MessageID>${row.vendor_prescription_id}</MessageID>`));
  const log = await pool.query(`SELECT status FROM ${S}.vendor_transaction_log WHERE vendor_type='surescripts' AND internal_reference_id=$1`, [rx1]);
  check('the send is in the practice\'s vendor log', log.rowCount === 1 && log.rows[0].status === 'success');

  const cancel = await call('POST', `/api/prescriptions/${rx1}/cancel-erx`, token, { reason: 'Wrong strength', cancelledBy: doc.id });
  const cx = stub.seen[stub.seen.length - 1];
  check(`cancel → a CancelRx pointing at the NewRx (got ${cancel.status})`, cancel.status === 200 && /<CancelRx>/.test(cx.body) && cx.body.includes(`<RelatesToMessageID>${row.vendor_prescription_id}</RelatesToMessageID>`));
  check('...and reads cancel_requested until the pharmacy confirms', cancel.body.erxStatus === 'cancel_requested');

  const rxC = await mkRx({ controlled: 'CII' });
  const ctl = await call('POST', `/api/prescriptions/${rxC}/send-erx`, token, { pharmacyId: ph.id, prescriberDeaNumber: 'AB1234563' });
  check('a Schedule II prescription is refused until EPCS exists (422)', ctl.status === 422 && ctl.body.missing.some((m) => /EPCS/.test(m)));
}

(async () => {
  await unitChecks();
  const stub = await stubServer();
  await serviceChecks(stub);
  if (process.env.AC_DB_H || process.env.DATABASE_URL) await routeChecks(stub);
  else console.log('  (route checks skipped: no database configured)');
  stub.close();
  report();
})().catch(report);
