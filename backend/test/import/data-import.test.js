// Data import — CSV and API (routes/dataImport.js, services/dataImport).
//
// Proves: the format and templates are published without sign-in; a CSV in the template's
// shape imports; errors name the row and field and NOTHING is written when any row is bad;
// a dry run writes nothing; re-running changes nothing new (patients by MRN, appointments by
// patient + start time); upsert updates and create_only does not; empty cells never erase;
// semicolon CSVs from European Excel work; appointments link to the patient and to a
// provider of THIS practice only; API keys import for their own practice only, cannot manage
// keys, and stop working when revoked; only admins import when signed in; the plan's
// patient limit holds.

const path = require('path');
const crypto = require('crypto');

const BACKEND = path.join(__dirname, '..', '..');
process.env.PORT = process.env.TEST_PORT || '4884';
process.env.NODE_ENV = 'development';
process.env.AC_JWT_S = process.env.AC_JWT_S || crypto.randomBytes(48).toString('base64');
process.env.AC_TK_S = process.env.AC_TK_S || process.env.AC_JWT_S;
process.env.AC_PW_BREACH_CHECK = 'false';
const BASE = `http://127.0.0.1:${process.env.PORT}`;

const pool = require(path.join(BACKEND, 'db.js'));
const bcrypt = require(path.join(BACKEND, '..', 'node_modules', 'bcryptjs'));
const { provisionTenant } = require(path.join(BACKEND, 'services/tenantProvisioning.js'));
const { parseCsv } = require(path.join(BACKEND, 'services/dataImport/csv.js'));
require(path.join(BACKEND, 'server.js'));

const results = [];
const check = (n, c) => results.push([n, !!c]);
const call = async (method, url, auth, body, { csv = false } = {}) => {
  const headers = {};
  if (auth) headers.Authorization = `Bearer ${auth}`;
  if (body !== undefined) headers['Content-Type'] = csv ? 'text/csv' : 'application/json';
  const r = await fetch(BASE + url, { method, headers, body: body === undefined ? undefined : (csv ? body : JSON.stringify(body)) });
  const t = await r.text(); let b = null; try { b = JSON.parse(t); } catch { b = t; }
  return { status: r.status, body: b, headers: r.headers };
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
  const RUN = crypto.randomBytes(3).toString('hex');
  const PW = 'A-Strong-Passphrase!23';
  const A = await provisionTenant(pool, { name: `Import Clinic A ${RUN}` });
  const B = await provisionTenant(pool, { name: `Import Clinic B ${RUN}` });
  const mk = async (t, role, first) => {
    const email = `${role}_${first}_${RUN}@example.com`.toLowerCase();
    const { rows: [u] } = await pool.query(`INSERT INTO public.users (id,email,first_name,last_name,role,status,password_hash,practice_id,created_at)
      VALUES (gen_random_uuid(),$1,$2,'Test',$3,'active',$4,$5,NOW()) RETURNING id`, [email, first, role, await bcrypt.hash(PW, 12), t.practiceId]);
    if (role === 'doctor') {
      await pool.query('INSERT INTO public.providers (id, first_name, last_name, email) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING', [u.id, first, 'Test', email]);
    }
    const login = await call('POST', '/api/auth/login', null, { email, password: PW });
    return { id: u.id, email, token: login.body && login.body.token };
  };
  const adminA = await mk(A, 'admin', 'ada');
  const nurseA = await mk(A, 'nurse', 'nia');
  const docA = await mk(A, 'doctor', 'dora');
  const docB = await mk(B, 'doctor', 'bob');
  const adminB = await mk(B, 'admin', 'bea');
  const schemaA = (await pool.query('SELECT schema_name FROM control.tenants WHERE practice_id = $1', [A.practiceId])).rows[0].schema_name;
  const schemaB = (await pool.query('SELECT schema_name FROM control.tenants WHERE practice_id = $1', [B.practiceId])).rows[0].schema_name;
  const countA = async (table) => (await pool.query(`SELECT count(*)::int AS n FROM ${schemaA}.${table}`)).rows[0].n;

  // ── published format and templates ────────────────────────────────────────────────
  const fm = await call('GET', '/api/import/formats');
  check('the format is published without sign-in', fm.status === 200 && fm.body.kinds && fm.body.kinds.patients && fm.body.kinds.appointments);
  check('...naming required fields and types', fm.body.kinds.patients.fields.some((f) => f.name === 'mrn' && f.required) &&
    fm.body.kinds.appointments.fields.some((f) => f.name === 'start_time' && f.type === 'datetime'));
  const tp = await call('GET', '/api/import/templates/patients.csv');
  const tpRows = parseCsv(tp.body);
  check('the patients template is a CSV: header + example row', tp.status === 200 && /text\/csv/.test(tp.headers.get('content-type')) && tpRows.length === 2 && tpRows[0][0].replace('﻿', '') === 'mrn');
  check('an unknown template is 404', (await call('GET', '/api/import/templates/claims.csv')).status === 404);

  // ── who may import ───────────────────────────────────────────────────────────────
  const oneRow = [{ mrn: `M-${RUN}-1`, first_name: 'Maria', last_name: 'Lopez', date_of_birth: '1984-03-17' }];
  check('no sign-in, no key -> 401', (await call('POST', '/api/import/patients', null, { rows: oneRow })).status === 401);
  check('a nurse cannot import (403)', (await call('POST', '/api/import/patients', nurseA.token, { rows: oneRow })).status === 403);

  // ── CSV: errors, all or nothing ──────────────────────────────────────────────────
  const before = await countA('patients');
  const badCsv = [
    'mrn,first_name,last_name,date_of_birth,email,gender',
    `M-${RUN}-1,Maria,Lopez,1984-03-17,maria_${RUN}@example.com,female`,
    `M-${RUN}-2,,Kim,17/03/1984,not-an-email,robot`,
  ].join('\n');
  const bad = await call('POST', '/api/import/patients/csv', adminA.token, badCsv, { csv: true });
  const errs = (bad.body && bad.body.errors) || [];
  check(`a bad row -> 422 with errors (got ${bad.status})`, bad.status === 422 && bad.body.written === false);
  check('...each error names its row and field', ['first_name', 'date_of_birth', 'email', 'gender'].every((f) => errs.some((e) => e.row === 2 && e.field === f)));
  check('...and NOTHING was written, not even the good row', (await countA('patients')) === before);

  const goodCsv = [
    'MRN;First_Name;Last_Name;Date_of_Birth;Email;Phone;Allergies;Favourite_Colour',
    `M-${RUN}-1;Maria;López;1984-03-17;maria_${RUN}@example.com;+34 600 123 456;"Penicillin; latex"`,
    `M-${RUN}-2;Jun;Kim;1990-11-02;;;`,
    `M-${RUN}-3;"O'Brien, Sean";Test;2001-01-31;sean_${RUN}@example.com;;`,
  ].join('\r\n');
  const dry = await call('POST', `/api/import/patients/csv?dryRun=true`, adminA.token, goodCsv, { csv: true });
  check(`dry run reports what would happen (got ${dry.status} ${JSON.stringify(dry.body).slice(0, 100)})`, dry.status === 200 && dry.body.created === 3 && dry.body.written === false);
  check('...and writes nothing', (await countA('patients')) === before);
  check('...and lists columns it ignored', (dry.body.ignoredColumns || []).includes('favourite_colour'));

  const imp = await call('POST', '/api/import/patients/csv', adminA.token, goodCsv, { csv: true });
  check(`a semicolon CSV (European Excel) imports 3 patients (got ${imp.status} ${JSON.stringify(imp.body).slice(0, 120)})`, imp.status === 200 && imp.body.created === 3 && imp.body.written === true);
  const maria = (await pool.query(`SELECT * FROM ${schemaA}.patients WHERE mrn = $1`, [`M-${RUN}-1`])).rows[0];
  check('...quoted cells with the separator inside survive', maria && maria.allergies === 'Penicillin; latex' && maria.last_name === 'López');
  check('...no portal account is created', (await pool.query('SELECT 1 FROM public.users WHERE email = $1', [`maria_${RUN}@example.com`])).rowCount === 0);
  check('...it is in the audit log', (await pool.query(`SELECT 1 FROM ${schemaA}.audit_logs WHERE action_type = 'import' AND action_description LIKE 'Imported patients: 3 created%'`)).rowCount === 1);

  const again = await call('POST', '/api/import/patients/csv', adminA.token, goodCsv, { csv: true });
  check('re-running the same file creates nothing new', again.status === 200 && again.body.created === 0 && (await countA('patients')) === before + 3);

  // ── API (JSON): upsert vs create_only, empty cells never erase ──────────────────
  const up = await call('POST', '/api/import/patients', adminA.token, { rows: [{ mrn: `M-${RUN}-1`, first_name: 'Maria', last_name: 'López', date_of_birth: '1984-03-17', phone: '+34 611 000 000', allergies: '' }] });
  const m2 = (await pool.query(`SELECT phone, allergies FROM ${schemaA}.patients WHERE mrn = $1`, [`M-${RUN}-1`])).rows[0];
  check(`upsert updates a matched patient (got ${up.status})`, up.status === 200 && up.body.updated === 1 && m2.phone === '+34 611 000 000');
  check('...and an empty cell did not erase allergies', m2.allergies === 'Penicillin; latex');
  const co = await call('POST', '/api/import/patients', adminA.token, { mode: 'create_only', rows: [{ mrn: `M-${RUN}-1`, first_name: 'X', last_name: 'Y', date_of_birth: '1984-03-17' }] });
  check('create_only leaves a matched patient as it is', co.status === 200 && co.body.unchanged === 1 &&
    (await pool.query(`SELECT first_name FROM ${schemaA}.patients WHERE mrn = $1`, [`M-${RUN}-1`])).rows[0].first_name === 'Maria');
  const clash = await call('POST', '/api/import/patients', adminA.token, { rows: [{ mrn: `M-${RUN}-9`, first_name: 'A', last_name: 'B', date_of_birth: '1980-01-01', email: `maria_${RUN}@example.com` }] });
  check('an email already used by another patient is refused, by name', clash.status === 422 && clash.body.errors.some((e) => e.field === 'email' && /M-.*-1/.test(e.message)));
  const csvJson = await call('POST', '/api/import/patients', adminA.token, { dryRun: true, csv: `mrn,first_name,last_name,date_of_birth\nM-${RUN}-7,Ann,Lee,1970-05-05` });
  check('the JSON route also accepts { csv }', csvJson.status === 200 && csvJson.body.created === 1);

  // ── appointments ────────────────────────────────────────────────────────────────
  const apCsv = [
    'patient_mrn,start_time,duration_minutes,provider_email,appointment_type,reason,status,timezone',
    `M-${RUN}-1,2026-12-01T09:30,30,${docA.email},Follow-up,Diabetes review,scheduled,Europe/Madrid`,
    `M-${RUN}-2,2026-12-01 10:00,,,,,confirmed,`,
  ].join('\n');
  const badAp = await call('POST', '/api/import/appointments', adminA.token, { rows: [
    { patient_mrn: 'NOPE', start_time: '2026-12-01T09:30' },
    { patient_mrn: `M-${RUN}-1`, start_time: '2026-12-01T11:00', provider_email: docB.email },
    { patient_mrn: `M-${RUN}-1`, start_time: '2026-12-01T12:00', end_time: '2026-12-01T11:00' },
  ] });
  const ae = (badAp.body && badAp.body.errors) || [];
  check('an unknown patient MRN is refused', ae.some((e) => e.row === 1 && e.field === 'patient_mrn'));
  check("another practice's provider is refused", ae.some((e) => e.row === 2 && e.field === 'provider_email'));
  check('end before start is refused', ae.some((e) => e.row === 3 && e.field === 'end_time'));
  const apImp = await call('POST', '/api/import/appointments/csv', adminA.token, apCsv, { csv: true });
  check(`appointments import (got ${apImp.status} ${JSON.stringify(apImp.body).slice(0, 120)})`, apImp.status === 200 && apImp.body.created === 2);
  const ap1 = (await pool.query(`SELECT a.*, to_char(a.end_time,'HH24:MI') AS e FROM ${schemaA}.appointments a JOIN ${schemaA}.patients p ON p.id = a.patient_id WHERE p.mrn = $1`, [`M-${RUN}-1`])).rows[0];
  check('...linked to the patient and provider, end time from the duration', ap1 && ap1.provider_id === docA.id && ap1.e === '10:00' && ap1.timezone === 'Europe/Madrid' && ap1.booking_source === 'import');
  const ap2 = (await pool.query(`SELECT a.duration_minutes, a.status FROM ${schemaA}.appointments a JOIN ${schemaA}.patients p ON p.id = a.patient_id WHERE p.mrn = $1`, [`M-${RUN}-2`])).rows[0];
  check('...30 minutes when neither end nor duration is given; status kept', ap2 && ap2.duration_minutes === 30 && ap2.status === 'confirmed');
  const apAgain = await call('POST', '/api/import/appointments/csv', adminA.token, apCsv, { csv: true });
  check('re-running appointments creates no duplicates', apAgain.status === 200 && apAgain.body.created === 0 && (await countA('appointments')) === 2);

  // ── API keys ─────────────────────────────────────────────────────────────────────
  check('a nurse cannot create keys', (await call('POST', '/api/import/keys', nurseA.token, { name: 'x' })).status === 403);
  const k = await call('POST', '/api/import/keys', adminA.token, { name: 'Nightly sync' });
  const key = k.body && k.body.key;
  check(`an admin creates a key, shown once (got ${k.status})`, k.status === 201 && /^ack_[A-Za-z0-9]{12}_[A-Za-z0-9]{32}$/.test(key || ''));
  const stored = (await pool.query('SELECT key_hash, key_prefix FROM public.practice_api_keys WHERE id = $1', [k.body.id])).rows[0];
  check('...only its hash is stored', stored && stored.key_hash.length === 64 && !stored.key_hash.includes(key) && key.startsWith(stored.key_prefix));
  const listed = await call('GET', '/api/import/keys', adminA.token);
  check('...the list never shows the key', listed.status === 200 && listed.body.some((x) => x.id === k.body.id) && !JSON.stringify(listed.body).includes(key));
  check("practice B's admin does not see A's keys", !(await call('GET', '/api/import/keys', adminB.token)).body.some((x) => x.id === k.body.id));

  const viaKey = await call('POST', '/api/import/patients', key, { rows: [{ mrn: `K-${RUN}-1`, first_name: 'Key', last_name: 'Import', date_of_birth: '1999-09-09' }] });
  check(`the key imports into its own practice (got ${viaKey.status})`, viaKey.status === 200 && viaKey.body.created === 1 &&
    (await pool.query(`SELECT 1 FROM ${schemaA}.patients WHERE mrn = $1`, [`K-${RUN}-1`])).rowCount === 1 &&
    (await pool.query(`SELECT 1 FROM ${schemaB}.patients WHERE mrn = $1`, [`K-${RUN}-1`])).rowCount === 0);
  const viaHeader = await fetch(`${BASE}/api/import/patients`, { method: 'POST', headers: { 'X-API-Key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ dryRun: true, rows: [{ mrn: `K-${RUN}-2`, first_name: 'H', last_name: 'X', date_of_birth: '1999-09-09' }] }) });
  check('...also as X-API-Key', viaHeader.status === 200);
  check('...and records last use', (await pool.query('SELECT last_used_at FROM public.practice_api_keys WHERE id = $1', [k.body.id])).rows[0].last_used_at !== null);
  check('a key cannot manage keys', (await call('GET', '/api/import/keys', key)).status === 401);
  check('a key cannot read patients', (await call('GET', '/api/patients', key)).status === 401);
  check("B's admin cannot revoke A's key", (await call('DELETE', `/api/import/keys/${k.body.id}`, adminB.token)).status === 404);
  check('revoking works', (await call('DELETE', `/api/import/keys/${k.body.id}`, adminA.token)).status === 200);
  check('...and the key stops at once', (await call('POST', '/api/import/patients', key, { dryRun: true, rows: oneRow })).status === 401);
  check('a made-up key is refused', (await call('POST', '/api/import/patients', `ack_${'a'.repeat(12)}_${'b'.repeat(32)}`, { rows: oneRow })).status === 401);

  // ── limits ───────────────────────────────────────────────────────────────────────
  check('more than 5,000 rows is refused (413)', (await call('POST', '/api/import/patients', adminA.token, { rows: new Array(5001).fill(oneRow[0]) })).status === 413);
  check('an unknown kind is 404', (await call('POST', '/api/import/claims', adminA.token, { rows: oneRow })).status === 404);
  check('a future date of birth is refused', (await call('POST', '/api/import/patients', adminA.token, { rows: [{ mrn: 'F', first_name: 'F', last_name: 'F', date_of_birth: '2999-01-01' }] })).status === 422);

  report();
})().catch(report);
