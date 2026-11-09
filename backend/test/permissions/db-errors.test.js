// A request the caller can fix should say so, not blame the server.
//
// Every write handler in the app ended its catch block with a 500 and a fixed message:
// "Failed to create patient", "Failed to create claim". So a missing required field, a
// duplicate MRN and a genuine server fault were indistinguishable — all three told the
// user the server had broken, when two of them were something they could correct in the
// form in front of them.
//
// And several routes passed err.detail straight to the client. For a unique or
// foreign-key violation Postgres puts the CONFLICTING ROW VALUES in there — an MRN, a
// name, an email. In a clinical system that is patient data leaving through an error
// message. 27 of the sites rewritten here were doing it.

const path = require('path');
const crypto = require('crypto');

const BACKEND = path.join(__dirname, '..', '..');
process.env.PORT = process.env.TEST_PORT || '4897';
process.env.NODE_ENV = 'development';
process.env.AC_JWT_S = process.env.AC_JWT_S || crypto.randomBytes(48).toString('base64');
process.env.AC_TK_S = process.env.AC_TK_S || crypto.randomBytes(48).toString('base64');
const BASE = `http://127.0.0.1:${process.env.PORT}`;

const pool = require(path.join(BACKEND, 'db.js'));
const bcrypt = require(path.join(BACKEND, '..', 'node_modules', 'bcryptjs'));
const { provisionTenant } = require(path.join(BACKEND, 'services/tenantProvisioning.js'));
const { describeDbError } = require(path.join(BACKEND, 'utils/dbErrors.js'));
require(path.join(BACKEND, 'server.js'));

const results = [];
const check = (n, c) => results.push([n, !!c]);
const api = async (method, url, body, token) => {
  const r = await fetch(BASE + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  let parsed = null; try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { status: r.status, body: parsed, raw: text };
};
const obj = (v) => v || {};

const report = (err) => {
  let failed = 0;
  for (const [n, c] of results) { console.log(`  ${c ? 'ok  ' : 'FAIL'} ${n}`); if (!c) failed += 1; }
  if (err) {
    console.log(`\n${results.length - failed}/${results.length} passed before the suite stopped early.`);
    console.error(`\nSTOPPED: ${err.message || err}`);
    console.error(err);
  } else {
    console.log(`\n${results.length - failed}/${results.length} checks passed.`);
  }
  process.exit(err || failed ? 1 : 0);
};

(async () => {
  for (let i = 0; i < 40; i++) {
    try { await fetch(BASE + '/health'); break; } catch { await new Promise((r) => setTimeout(r, 250)); }
  }

  // ── the mapper on its own ──────────────────────────────────────────────────────────
  const notNull = describeDbError(
    { code: '23502', column: 'service_date', table: 'claims' }, 'Failed to create claim');
  check('a missing required field is a 400', notNull && notNull.status === 400);
  check('and the message names the field', notNull.message === undefined
    && notNull.body.message.includes('service date'));
  check('and the field is given separately so a form can highlight it',
    notNull.body.field === 'service_date');

  const dupe = describeDbError(
    { code: '23505', column: 'mrn', constraint: 'patients_mrn_key',
      detail: 'Key (mrn)=(MRN-00123) already exists.' }, 'Failed to create patient');
  // 409, not 400: the request is well formed, it conflicts with what is stored, and the
  // caller's fix is different.
  check('a duplicate is a 409', dupe && dupe.status === 409);
  check('THE CONFLICTING VALUE IS NOT SENT', !JSON.stringify(dupe.body).includes('MRN-00123'));
  check('nor is the raw detail string', !JSON.stringify(dupe.body).includes('already exists.'));
  check('the constraint name is kept, which is safe and useful',
    dupe.body.constraint === 'patients_mrn_key');

  const fk = describeDbError({ code: '23503', column: 'patient_id' }, 'Failed to create appointment');
  check('an unresolved reference is a 400', fk && fk.status === 400);
  check('and says which reference', fk.body.message.includes('patient'));

  const tooLong = describeDbError({ code: '22001', column: 'code' }, 'Failed to save');
  check('a value too long for its column is a 400', tooLong && tooLong.status === 400);
  const badUuid = describeDbError({ code: '22P02' }, 'Failed to fetch account');
  check('a malformed value is a 400', badUuid && badUuid.status === 400);

  // Anything else is still a server fault and must keep its 500 — the mapper returning
  // null is what lets each route keep its own wording for that case.
  check('a genuine server fault is NOT mapped', describeDbError({ code: '42P01' }, 'x') === null);
  check('an error with no code is NOT mapped', describeDbError(new Error('boom'), 'x') === null);
  check('a missing error is NOT mapped', describeDbError(null, 'x') === null);

  // ── through the real routes ────────────────────────────────────────────────────────
  const RUN = crypto.randomBytes(4).toString('hex');
  const PW = 'A-Strong-Passphrase!23';
  const hash = await bcrypt.hash(PW, 12);
  const t = await provisionTenant(pool, { name: `Errors Clinic ${RUN}` });
  const schema = t.tenant.schema_name;
  const email = `adm_${RUN}@example.com`;
  const { rows: [me] } = await pool.query(
    `INSERT INTO public.users (id,email,first_name,last_name,role,status,password_hash,practice_id,created_at)
     VALUES (gen_random_uuid(),$1,'A','E','admin','active',$2,$3,NOW()) RETURNING id`,
    [email, hash, t.practiceId]);
  const tok = (await api('POST', '/api/auth/login', { email, password: PW })).body.token;
  check('an admin can sign in', Boolean(tok));

  // A form submitted without a required field. This is the case the user reported: it used
  // to be a 500 and read as "the server is broken".
  const incomplete = await api('POST', '/api/claims',
    { patient_id: null, total_amount: 100, status: 'draft' }, tok);
  check('an incomplete claim is a 400, not a 500', incomplete.status === 400);
  check('and names what is missing', typeof obj(incomplete.body).message === 'string'
    && obj(incomplete.body).message.length > 0);

  const badDenial = await api('POST', '/api/denials', { reason_code: 'X', status: 'open' }, tok);
  check('an incomplete denial is a 400, not a 500', badDenial.status === 400);

  const badLab = await api('POST', '/api/laboratories', { contact_email: 'x@y.z' }, tok);
  check('an incomplete laboratory is a 400, not a 500', badLab.status === 400);

  // A duplicate, with a value that must not come back.
  const MRN = `MRN-DUP-${RUN}`;
  const first = await api('POST', '/api/patients',
    { first_name: 'Dup', last_name: 'Patient', date_of_birth: '1980-01-01', mrn: MRN }, tok);
  check('the first patient is created', first.status === 201);
  const second = await api('POST', '/api/patients',
    { first_name: 'Dup', last_name: 'Patient', date_of_birth: '1980-01-01', mrn: MRN }, tok);
  check('a duplicate patient is a 4xx, not a 500', second.status >= 400 && second.status < 500);
  check('AND THE DUPLICATE MRN IS NOT ECHOED BACK', !second.raw.includes(MRN));

  // A reference that does not resolve.
  const orphan = await api('POST', '/api/appointments', {
    patient_id: '00000000-0000-0000-0000-000000000000',
    provider_id: null, appointment_type: 'Follow-up',
    start_time: '2027-02-01T09:00:00', end_time: '2027-02-01T09:20:00',
    duration_minutes: 20, reason: 'x', status: 'scheduled',
  }, tok);
  check('an appointment for a patient that does not exist is a 4xx',
    orphan.status >= 400 && orphan.status < 500);

  // A genuine server fault must still be a 500 — the point of mapping only known codes.
  await pool.query(`ALTER TABLE ${schema}.tasks RENAME TO tasks_hidden_${RUN}`);
  const broken = await api('POST', '/api/tasks', { title: 'x', status: 'pending' }, tok);
  check('a real server fault is STILL a 500', broken.status === 500);
  await pool.query(`ALTER TABLE ${schema}.tasks_hidden_${RUN} RENAME TO tasks`);

  // No response anywhere should carry a raw Postgres detail string.
  const bodies = [incomplete, badDenial, badLab, second, orphan].map((r) => r.raw).join('\n');
  // `Key (col)=(value)` is the shape of a Postgres detail line and the only reliable
  // marker for one. Matching on "already exists" instead caught this suite's own wording
  // ("a record with those details already exists") — a check that fails on the correct
  // output is worse than no check, because the next person deletes it.
  check('no response carries a Postgres detail line', !/Key \([^)]*\)=\(/.test(bodies));
  // NOT asserting that nothing the caller sent comes back: /api/appointments answers an
  // unresolvable patient with "Patient ID <the id you sent> does not exist", and echoing a
  // caller's own input tells them nothing they did not already have. The exposure that
  // matters is a value the caller did NOT supply, which is what a raw detail line can
  // carry for a composite or multi-column constraint — so the marker above is the check,
  // and dropping err.detail from responses is defence against that rather than a fix for a
  // proven leak.
  check('a 4xx still explains itself', [incomplete, badDenial, badLab, second]
    .every((r) => typeof obj(r.body).message === 'string' && obj(r.body).message.length > 10));

  await pool.query('DELETE FROM public.users WHERE id = $1', [me.id]).catch(() => {});
  report();
})().catch(report);
