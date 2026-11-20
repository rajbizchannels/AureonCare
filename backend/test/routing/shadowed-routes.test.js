// Routes that were unreachable because an earlier `/:id` route caught them.
//
// accounts.js declared GET /:id before GET /receivables, /payables, /reconciliations,
// /statements and /backup; intake-forms.js declared GET /:id before /flows and /consents.
// Express matches in declaration order, so each literal path was handled as "fetch the
// record whose id is 'receivables'", failed to parse as a UUID, and answered 500 — the
// Receivables, Payables, Reconciliation, Statements, intake flow and consent screens
// never loaded. /:id is now constrained to UUIDs. Fails against the code before the fix.

const path = require('path');
const crypto = require('crypto');

const BACKEND = path.join(__dirname, '..', '..');
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

const results = [];
const check = (n, c) => results.push([n, !!c]);
const api = async (method, url, token) => {
  const r = await fetch(BASE + url, { method, headers: { Authorization: 'Bearer ' + token } });
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
  for (let i = 0; i < 40; i++) { try { await fetch(BASE + '/health'); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  const RUN = crypto.randomBytes(4).toString('hex');
  const t = await provisionTenant(pool, { name: `Routes Clinic ${RUN}` });
  const schema = t.tenant.schema_name;
  const email = `rt_${RUN}@example.com`;
  await pool.query(`INSERT INTO public.users (id,email,first_name,last_name,role,status,password_hash,practice_id,created_at)
    VALUES (gen_random_uuid(),$1,'Ada','Routes','admin','active',$2,$3,NOW())`,
    [email, await bcrypt.hash('A-Strong-Passphrase!23', 12), t.practiceId]);
  const login = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'A-Strong-Passphrase!23' }) }).then((r) => r.json());
  const tok = login.token;
  check('an admin can sign in', Boolean(tok));

  // ── the routes that were unreachable ───────────────────────────────────────────
  for (const p of ['/api/accounts/receivables', '/api/accounts/payables', '/api/accounts/reconciliations',
                   '/api/accounts/statements', '/api/accounts/backup',
                   '/api/intake-forms/flows', '/api/intake-forms/consents']) {
    const r = await api('GET', p, tok);
    check(`GET ${p} reaches its own handler (got ${r.status}${r.status >= 400 ? ' ' + JSON.stringify(r.body).slice(0, 80) : ''})`,
      r.status === 200);
    check(`...and answers with a list or object, not an account/intake record`,
      r.status !== 200 || Array.isArray(r.body) || (r.body && typeof r.body === 'object' && !('account_number' in r.body) && !('form_type' in r.body)));
  }

  // ── every other parameter-free GET in the two routers ──────────────────────────
  // The AR-aging report had the same wrong column as receivables/statements and was
  // reachable all along, so check the neighbours as well.
  for (const p of ['/api/accounts', '/api/accounts/journal/entries', '/api/accounts/reports/trial-balance',
                   '/api/accounts/reports/income-statement', '/api/accounts/reports/balance-sheet',
                   '/api/accounts/reports/ar-aging', '/api/accounts/reports/ap-aging',
                   '/api/accounts/reports/dashboard', '/api/accounts/rbac/permissions', '/api/intake-forms']) {
    const r = await api('GET', p, tok);
    check(`GET ${p} answers (got ${r.status}${r.status >= 400 ? ' ' + JSON.stringify(r.body).slice(0, 80) : ''})`, r.status === 200);
  }

  // ── the /:id routes still work ──────────────────────────────────────────────────
  const { rows: [acct] } = await pool.query(
    `INSERT INTO ${schema}.accounts (account_number, account_name, account_type, normal_balance)
     VALUES ($1, 'Test cash', 'asset', 'debit') RETURNING id`, [`T-${RUN.toUpperCase()}`]);
  const one = await api('GET', `/api/accounts/${acct.id}`, tok);
  check('GET /api/accounts/<uuid> still returns that account',
    one.status === 200 && JSON.stringify(one.body).includes(`T-${RUN.toUpperCase()}`));
  check('GET /api/accounts/<uuid>/transactions still answers',
    (await api('GET', `/api/accounts/${acct.id}/transactions`, tok)).status === 200);
  check('an unknown uuid is a 404',
    (await api('GET', `/api/accounts/${crypto.randomUUID()}`, tok)).status === 404);
  const junk = await api('GET', '/api/accounts/not-an-id', tok);
  check(`a non-uuid id is not a 500 any more (got ${junk.status})`, junk.status === 404);

  const pid = crypto.randomUUID();
  await pool.query(`INSERT INTO ${schema}.patients (id, first_name, last_name, status, mrn, date_of_birth)
    VALUES ($1,'In','Take','Active',$2,'1990-01-01')`, [pid, `MRN-${RUN}`]);
  const { rows: [form] } = await pool.query(
    `INSERT INTO ${schema}.patient_intake_forms (patient_id, form_type, form_name) VALUES ($1,'general',$2) RETURNING id`,
    [pid, `Intake ${RUN}`]);
  const f = await api('GET', `/api/intake-forms/${form.id}`, tok);
  check('GET /api/intake-forms/<uuid> still returns that form', f.status === 200 && JSON.stringify(f.body).includes(`Intake ${RUN}`));
  check('a non-uuid intake id is a 404, not a 500', (await api('GET', '/api/intake-forms/not-an-id', tok)).status === 404);

  report();
})().catch(report);
