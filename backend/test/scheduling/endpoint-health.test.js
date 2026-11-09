// Buttons whose endpoint answered 500.
//
// A button that posts to a route returning 500 does nothing, however good its spinner is.
// Two were found by exercising every create/save endpoint the app's screens call:
//
//   1. GET /api/appointment-types carried NO middleware, on the reasoning that the public
//      booking page needs it without a session. No middleware also means no req.db, so it
//      fell back to the application pool, whose search_path is pinned to `public` — and
//      migration 066 moved the tenant tables out of `public`. Every call returned 42P01
//      and the route answered 500 for EVERYONE, signed in or not, taking out the
//      appointment-type dropdown in the booking form and the whole Appointment Types
//      admin screen. Same shape as the /api/scheduling/slots bug fixed earlier.
//
//   2. POST /api/patients omitted `id` on the branch taken when the patient gets no portal
//      account, and patients.id has no column default. So adding a patient WITHOUT AN
//      EMAIL ADDRESS always failed — walk-ins, children, and anyone who simply has no
//      email. The other branch worked only because it reuses the new portal user's id.
//
// Both checks below fail against the code as it was.

const path = require('path');
const crypto = require('crypto');

const BACKEND = path.join(__dirname, '..', '..');
process.env.PORT = process.env.TEST_PORT || '4895';
process.env.NODE_ENV = 'development';
process.env.AC_JWT_S = process.env.AC_JWT_S || crypto.randomBytes(48).toString('base64');
process.env.AC_TK_S = process.env.AC_TK_S || crypto.randomBytes(48).toString('base64');
const BASE = `http://127.0.0.1:${process.env.PORT}`;

const pool = require(path.join(BACKEND, 'db.js'));
const bcrypt = require(path.join(BACKEND, '..', 'node_modules', 'bcryptjs'));
const { provisionTenant } = require(path.join(BACKEND, 'services/tenantProvisioning.js'));
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
  return { status: r.status, body: parsed };
};
const obj = (v) => v || {};

const report = (err) => {
  let failed = 0;
  for (const [n, c] of results) { console.log(`  ${c ? 'ok  ' : 'FAIL'} ${n}`); if (!c) failed += 1; }
  if (err) {
    console.log(`\n${results.length - failed}/${results.length} passed before the suite stopped early.`);
    console.error(`\nSTOPPED: ${err.message || err}`);
    if (err.code === '42P01') console.error('\nA table is missing. Run: npm run migrate && npm run migrate:tenants');
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

  const RUN = crypto.randomBytes(4).toString('hex');
  const PW = 'A-Strong-Passphrase!23';
  const hash = await bcrypt.hash(PW, 12);
  const t = await provisionTenant(pool, { name: `Health Clinic ${RUN}` });
  const schema = t.tenant.schema_name;

  const email = `adm_${RUN}@example.com`;
  const { rows: [me] } = await pool.query(
    `INSERT INTO public.users (id,email,first_name,last_name,role,status,password_hash,practice_id,created_at)
     VALUES (gen_random_uuid(),$1,'A','Health','admin','active',$2,$3,NOW()) RETURNING id`,
    [email, hash, t.practiceId]);
  const login = await api('POST', '/api/auth/login', { email, password: PW });
  const tok = login.body && login.body.token;
  check('an admin can sign in', Boolean(tok));

  // ── 1. appointment types ───────────────────────────────────────────────────────────
  const list = await api('GET', '/api/appointment-types', undefined, tok);
  check('GET /api/appointment-types answers a signed-in caller', list.status === 200);
  check('...with a list', Array.isArray(list.body));

  await pool.query(
    `INSERT INTO ${schema}.appointment_types (name, duration_minutes, is_active)
     VALUES ($1, 20, true)`, [`Follow-up ${RUN}`]);
  const withRows = await api('GET', '/api/appointment-types', undefined, tok);
  check('and returns the practice\'s own types',
    (withRows.body || []).some((a) => a.name === `Follow-up ${RUN}`));

  const one = (withRows.body || []).find((a) => a.name === `Follow-up ${RUN}`);
  check('a single appointment type can be read', one
    && (await api('GET', `/api/appointment-types/${one.id}`, undefined, tok)).status === 200);

  // An anonymous caller has no tenant, so there is nothing honest to return — but it must
  // say so rather than fail as a server error. A 500 reads as "the server is broken" when
  // the real answer is "this request has to say which practice it is for".
  const anon = await api('GET', '/api/appointment-types');
  check('an anonymous caller gets a 4xx that explains itself, not a 500',
    anon.status === 409 && typeof obj(anon.body).message === 'string');
  check('and the explanation names what is missing',
    obj(anon.body).message.toLowerCase().includes('practice'));

  // ── 2. adding a patient ────────────────────────────────────────────────────────────
  const walkIn = await api('POST', '/api/patients', {
    first_name: 'Walk', last_name: 'In', date_of_birth: '1948-03-11',
    gender: 'female', phone: '555-0100', mrn: `MRN-W-${RUN}`,
  }, tok);
  check('A PATIENT WITH NO EMAIL CAN BE ADDED', walkIn.status === 201);
  check('and is given an id', Boolean(obj(walkIn.body).id));
  check('and is actually stored',
    (await pool.query(`SELECT 1 FROM ${schema}.patients WHERE mrn = $1`, [`MRN-W-${RUN}`])).rowCount === 1);

  const withPortal = await api('POST', '/api/patients', {
    first_name: 'Portal', last_name: 'User', date_of_birth: '1990-06-02',
    mrn: `MRN-E-${RUN}`, email: `pt_${RUN}@example.com`,
  }, tok);
  check('a patient WITH an email can still be added', withPortal.status === 201);
  // That branch sets patients.id = users.id so the portal account and the chart are the
  // same identity; the fix must not have changed it.
  check('and keeps patients.id = users.id for the portal account',
    (await pool.query('SELECT 1 FROM public.users WHERE id = $1', [obj(withPortal.body).id])).rowCount === 1);
  check('the two patients got different ids',
    obj(walkIn.body).id !== obj(withPortal.body).id);

  // cleanup
  await pool.query('DELETE FROM public.users WHERE id = $1 OR email = $2',
    [me.id, `pt_${RUN}@example.com`]).catch(() => {});

  report();
})().catch(report);
