// Audit trail access: only practice administrators may read it (list, entry, statistics, CSV,
// and the compliance reports built on it); any signed-in user may record events, but always as
// themselves (SEC-55); entries cannot be deleted.

const path = require('path');
const crypto = require('crypto');

const BACKEND = path.join(__dirname, '..', '..');
process.env.PORT = process.env.TEST_PORT || '4901';
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
  const t = await provisionTenant(pool, { name: `Audit ${RUN}` });
  const T = t.tenant.schema_name; const who = {};
  for (const role of ['admin', 'doctor', 'nurse', 'receptionist', 'billing_manager']) {
    const email = `${role}_aud_${RUN}@example.com`;
    const { rows: [u] } = await pool.query(`INSERT INTO public.users (id,email,first_name,last_name,role,status,password_hash,practice_id,created_at)
      VALUES (gen_random_uuid(),$1,'Al',$2,$5,'active',$3,$4,NOW()) RETURNING id`, [email, role, await bcrypt.hash(PW, 12), t.practiceId, role]);
    await pool.query(`INSERT INTO public.memberships (user_id, practice_id, role, status) VALUES ($1,$2,$3,'active') ON CONFLICT DO NOTHING`, [u.id, t.practiceId, role]);
    who[role] = { id: u.id, email, token: obj((await api('POST', '/auth/login', null, { email, password: PW })).body).token };
  }
  // Recording: everyone may, as themselves.
  const rec = await api('POST', '/audit', who.doctor.token, { action_type: 'view', resource_type: 'patient', resource_name: 'Chart',
    user_id: who.admin.id, user_email: who.admin.email, user_role: 'admin' });
  check(`a doctor can record an event (got ${rec.status})`, rec.status === 201 || rec.status === 200);
  const { rows: [row] } = await pool.query(`SELECT user_id, user_role FROM ${T}.audit_logs WHERE resource_name = 'Chart' ORDER BY created_at DESC LIMIT 1`);
  check('...recorded as the doctor, not the admin the request claimed (SEC-55)', row && row.user_id === who.doctor.id && row.user_role === 'doctor');

  const reads = ['/audit', '/audit/stats/summary', '/audit/stats/top-users', '/audit/stats/top-resources', '/audit/export/csv',
    '/reports/compliance/audit-logs', '/reports/compliance/access-logs', '/reports/compliance/hipaa', '/reports/compliance/data-access-history'];
  for (const url of reads) {
    const a = await api('GET', url, who.admin.token);
    check(`admin can read ${url} (got ${a.status})`, a.status === 200);
  }
  for (const role of ['doctor', 'nurse', 'receptionist', 'billing_manager']) {
    const codes = [];
    for (const url of reads) codes.push((await api('GET', url, who[role].token)).status);
    check(`${role} is refused on all ${reads.length} audit reads (got ${[...new Set(codes)].join(',')})`, codes.every((c) => c === 403));
  }
  const list = await api('GET', '/audit', who.admin.token);
  const id = (obj(list.body).logs || obj(list.body).data || list.body || [])[0];
  const entryId = id && (id.id || id.log_id);
  if (entryId) {
    check('admin can open one entry', (await api('GET', `/audit/${entryId}`, who.admin.token)).status === 200);
    check('a doctor cannot', (await api('GET', `/audit/${entryId}`, who.doctor.token)).status === 403);
  }
  check('entries cannot be deleted (cleanup retired: 405)', (await api('DELETE', '/audit/cleanup?days=0', who.admin.token)).status === 405);
  check('...and non-admins are refused outright', (await api('DELETE', '/audit/cleanup', who.doctor.token)).status === 403);
  report();
})().catch((e) => report(e));
