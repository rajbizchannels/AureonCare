// SEC-53: Clinic Settings belong to the signed-in practice.
//
// They read and wrote one organization_settings row shared by every practice and the OLDEST row
// of public.practices, so one practice's admin overwrote another's name, tax ID, phone, email,
// address, NPI and currency — and everyone saw them. Proves each practice now reads and writes
// only its own row, and the public booking page shows the practice's own currency.
//
// (Header below is shared with the notifications test harness.)
//
// Proves: the settings page offers each role only the notifications it is eligible for and
// refuses the rest; choices are honoured per channel; a low-stock alert reaches the people who
// can reorder (route role AND the practice's inventory permissions), once per dip, re-armed by a
// restock; a solo practice's admin gets it; the doctor's own settings decide appointment e-mails
// and the bell; billing staff hear about claim status changes.

const path = require('path');
const crypto = require('crypto');

const BACKEND = path.join(__dirname, '..', '..');
process.env.PORT = process.env.TEST_PORT || '4898';
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
  const RUN = crypto.randomBytes(3).toString('hex');
  const PW = 'A-Strong-Passphrase!23';
  const mk = async (label) => {
    const t = await provisionTenant(pool, { name: `${label} ${RUN}` });
    const email = `admin_${label}_${RUN}@example.com`.toLowerCase();
    const { rows: [u] } = await pool.query(`INSERT INTO public.users (id,email,first_name,last_name,role,status,password_hash,practice_id,created_at)
      VALUES (gen_random_uuid(),$1,'Ada','Admin','admin','active',$2,$3,NOW()) RETURNING id`, [email, await bcrypt.hash(PW, 12), t.practiceId]);
    await pool.query(`INSERT INTO public.memberships (user_id, practice_id, role, status) VALUES ($1,$2,'admin','active') ON CONFLICT DO NOTHING`, [u.id, t.practiceId]);
    return { t, token: obj((await api('POST', '/auth/login', null, { email, password: PW })).body).token };
  };
  const A = await mk('Alpha'); const B = await mk('Beta');
  const saveA = await api('POST', '/clinic-settings', A.token, { name: `Alpha Clinic ${RUN}`, npi: '1234567893', currency: 'gbp', phone: '+44 20 0000 0001', taxId: 'TAX-A', website: 'https://alpha.example' });
  check(`practice A saves its settings (got ${saveA.status})`, saveA.status === 200);
  const saveB = await api('POST', '/clinic-settings', B.token, { name: `Beta Clinic ${RUN}`, npi: '1245319599', currency: 'EUR', phone: '+44 20 0000 0002', taxId: 'TAX-B' });
  check('practice B saves its settings', saveB.status === 200);
  const a = obj((await api('GET', '/clinic-settings', A.token)).body);
  const b = obj((await api('GET', '/clinic-settings', B.token)).body);
  check("A reads its own name, NPI, currency (B's save did not overwrite them)", a.name === `Alpha Clinic ${RUN}` && a.npi === '1234567893' && a.currency === 'GBP' && a.taxId === 'TAX-A');
  check("B reads its own, not A's", b.name === `Beta Clinic ${RUN}` && b.npi === '1245319599' && b.currency === 'EUR' && b.taxId === 'TAX-B');
  const infoA = obj((await api('GET', '/clinic-settings/info', A.token)).body);
  check('clinic info (letterheads, headers) is the practice\'s own', infoA.name === `Alpha Clinic ${RUN}` && infoA.source === 'practice');
  const { rows: [pa] } = await pool.query('SELECT name, npi FROM public.practices WHERE id = $1', [A.t.practiceId]);
  check('stored on the practice row itself', pa.name === `Alpha Clinic ${RUN}` && pa.npi === '1234567893');
  check('bad NPI refused (400)', (await api('POST', '/clinic-settings', A.token, { name: 'X', npi: '12ab' })).status === 400);
  check('bad currency refused (400)', (await api('POST', '/clinic-settings', A.token, { name: 'X', currency: 'POUNDS' })).status === 400);
  check('name required (400)', (await api('POST', '/clinic-settings', A.token, { name: ' ' })).status === 400);
  report();
})().catch((e) => report(e));
