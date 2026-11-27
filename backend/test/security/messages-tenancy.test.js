// Secure messages and purchase orders per practice (migration 111).
//
// Proves: a practice that is not the default one starts a message thread about its own patient
// and replies on it; another practice never sees, opens or posts to that thread, and cannot add its
// patient as a recipient; the thread's rows live in the practice's own schema. A practice orders
// stock with lines, receives it, and the order (with its lines) stays invisible to another practice.

const path = require('path');
const crypto = require('crypto');

const BACKEND = path.join(__dirname, '..', '..');
process.env.PORT = process.env.TEST_PORT || '4890';
process.env.NODE_ENV = 'development';
process.env.AC_JWT_S = process.env.AC_JWT_S || crypto.randomBytes(48).toString('base64');
process.env.AC_TK_S = process.env.AC_TK_S || process.env.AC_JWT_S;
process.env.AC_PW_BREACH_CHECK = 'false';
process.env.FRONTEND_URL = 'https://app.example.test';
process.env.AC_MSG_KEY = process.env.AC_MSG_KEY || crypto.randomBytes(32).toString('base64');
const BASE = `http://127.0.0.1:${process.env.PORT}`;

const pool = require(path.join(BACKEND, 'db.js'));
const bcrypt = require(path.join(BACKEND, '..', 'node_modules', 'bcryptjs'));
const { provisionTenant } = require(path.join(BACKEND, 'services/tenantProvisioning.js'));
require(path.join(BACKEND, 'server.js'));

const results = [];
const check = (n, c) => results.push([n, !!c]);
const call = async (method, url, token, body) => {
  const r = await fetch(BASE + url, { method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
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
  for (let i = 0; i < 40; i++) { try { await fetch(BASE + '/health'); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  const RUN = crypto.randomBytes(3).toString('hex');
  const PW = 'A-Strong-Passphrase!23';
  const mkPractice = async (label) => {
    const t = await provisionTenant(pool, { name: `${label} ${RUN}` });
    const staff = {};
    for (const role of ['admin', 'doctor']) {
      const email = `${role}_${label.toLowerCase()}_${RUN}@example.com`;
      const { rows: [u] } = await pool.query(`INSERT INTO public.users (id,email,first_name,last_name,role,status,password_hash,practice_id,created_at)
        VALUES (gen_random_uuid(),$1,'Sam',$2,$3,'active',$4,$5,NOW()) RETURNING id`, [email, label, role, await bcrypt.hash(PW, 12), t.practiceId]);
      staff[role] = { id: u.id, token: (await call('POST', '/api/auth/login', null, { email, password: PW })).body.token };
    }
    const patient = crypto.randomUUID();
    await pool.query(`INSERT INTO ${t.tenant.schema_name}.patients (id, first_name, last_name, mrn, date_of_birth) VALUES ($1,'Pat',$2,$3,'1980-01-01')`,
      [patient, label, `MRN-${label}-${RUN}`]);
    return { ...t, schema: t.tenant.schema_name, ...staff, patient };
  };
  const A = await mkPractice('Alpha');
  const B = await mkPractice('Beta');

  // ── secure messages ─────────────────────────────────────────────────────────────
  const th = await call('POST', '/api/messages/threads', A.admin.token, { subject: 'Lab results', body: 'Please review.', patientId: A.patient,
    participants: [{ kind: 'user', id: A.doctor.id }] });
  check(`a (non-default) practice starts a thread about its patient (got ${th.status} ${JSON.stringify(th.body).slice(0, 100)})`, th.status === 201);
  const threadId = th.body && (th.body.id || (th.body.thread && th.body.thread.id));
  check("...stored in the practice's own schema", (await pool.query(`SELECT count(*)::int n FROM ${A.schema}.message_threads WHERE id = $1`, [threadId])).rows[0].n === 1
    && (await pool.query('SELECT to_regclass($1) AS r', ['public.message_threads'])).rows[0].r === null);
  const reply = await call('POST', `/api/messages/threads/${threadId}/messages`, A.doctor.token, { body: 'Reviewed — all normal.' });
  check(`a colleague replies (got ${reply.status})`, reply.status === 201);
  check('...and the thread counts both messages', (await pool.query(`SELECT message_count FROM ${A.schema}.message_threads WHERE id = $1`, [threadId])).rows[0].message_count === 2);
  const listA = await call('GET', '/api/messages/threads', A.doctor.token);
  const threadsA = Array.isArray(listA.body) ? listA.body : (listA.body && listA.body.threads) || [];
  check('the colleague sees the thread', threadsA.some((x) => x.id === threadId));
  const listB = await call('GET', '/api/messages/threads', B.admin.token);
  const threadsB = Array.isArray(listB.body) ? listB.body : (listB.body && listB.body.threads) || [];
  check(`another practice does not see it (got ${listB.status})`, listB.status === 200 && !threadsB.some((x) => x.id === threadId));
  check('...cannot open it', (await call('GET', `/api/messages/threads/${threadId}`, B.admin.token)).status >= 403);
  check('...cannot post to it', (await call('POST', `/api/messages/threads/${threadId}/messages`, B.admin.token, { body: 'hello' })).status >= 403
    && (await pool.query(`SELECT message_count FROM ${A.schema}.message_threads WHERE id = $1`, [threadId])).rows[0].message_count === 2);
  const cross = await call('POST', '/api/messages/threads', B.admin.token, { subject: 'x', body: 'y', participants: [{ kind: 'patient', id: A.patient }] });
  check(`...and cannot message the other practice's patient (got ${cross.status})`, cross.status === 400);
  check('unread counts work per practice', (await call('GET', '/api/messages/unread-count', A.doctor.token)).status === 200
    && (await call('GET', '/api/messages/unread-count', B.admin.token)).status === 200);

  // ── purchase orders ─────────────────────────────────────────────────────────────
  const sup = await call('POST', '/api/inventory/suppliers', A.admin.token, { name: `Supplies ${RUN}` });
  const item = await call('POST', '/api/inventory/items', A.admin.token, { name: 'Gauze', unitOfMeasure: 'box', itemType: 'consumable', unitCost: 2.5 });
  const supId = sup.body && (sup.body.id || (sup.body.supplier && sup.body.supplier.id));
  const itemId = item.body && (item.body.id || (item.body.item && item.body.item.id));
  check(`a supplier and an item are set up (got ${sup.status}/${item.status})`, Boolean(supId && itemId));
  const po = await call('POST', '/api/inventory/orders', A.admin.token, { supplierId: supId, lines: [{ itemId, quantityOrdered: 10, unitCost: 2.5 }] });
  const poId = po.body && (po.body.id || (po.body.order && po.body.order.id));
  check(`a (non-default) practice orders stock with lines (got ${po.status} ${JSON.stringify(po.body).slice(0, 100)})`, po.status === 201 && poId);
  const lines = (await pool.query(`SELECT * FROM ${A.schema}.inventory_purchase_order_lines WHERE po_id = $1`, [poId])).rows;
  check("...the lines are in the practice's own schema", lines.length === 1 && Number(lines[0].line_total) === 25);
  for (const st of ['submitted', 'approved']) await call('PUT', `/api/inventory/orders/${poId}`, A.admin.token, { status: st });
  const rec = await call('POST', `/api/inventory/orders/${poId}/receive`, A.admin.token, {});
  check(`...and it receives the order (got ${rec.status})`, rec.status === 200
    && Number((await pool.query(`SELECT quantity_received FROM ${A.schema}.inventory_purchase_order_lines WHERE po_id = $1`, [poId])).rows[0].quantity_received) === 10);
  check('another practice cannot open the order', (await call('GET', `/api/inventory/orders/${poId}`, B.admin.token)).status === 404);
  check('...nor receive it', (await call('POST', `/api/inventory/orders/${poId}/receive`, B.admin.token, {})).status === 404);

  report();
})().catch(report);
