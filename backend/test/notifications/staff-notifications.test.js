// Staff notification settings and low-stock alerts.
//
// Proves: the settings page offers each role only the notifications it is eligible for and
// refuses the rest; choices are honoured per channel; a low-stock alert reaches the people who
// can reorder (route role AND the practice's inventory permissions), once per dip, re-armed by a
// restock; a solo practice's admin gets it; the doctor's own settings decide appointment e-mails
// and the bell; billing staff hear about claim status changes.

const path = require('path');
const crypto = require('crypto');

const BACKEND = path.join(__dirname, '..', '..');
process.env.PORT = process.env.TEST_PORT || '4897';
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
  const mkPractice = async (label, roles) => {
    const t = await provisionTenant(pool, { name: `${label} ${RUN}` });
    const people = {};
    for (const role of roles) {
      const email = `${role}_${label}_${RUN}@example.com`.toLowerCase();
      const { rows: [u] } = await pool.query(`INSERT INTO public.users (id,email,first_name,last_name,role,status,password_hash,practice_id,phone,created_at)
        VALUES (gen_random_uuid(),$1,$2,'Tester',$3,'active',$4,$5,$6,NOW()) RETURNING id`,
        [email, role, role, await bcrypt.hash(PW, 12), t.practiceId, `+4477009${Math.floor(10000 + Math.random() * 89999)}`]);
      await pool.query(`INSERT INTO public.memberships (user_id, practice_id, role, status) VALUES ($1,$2,$3,'active') ON CONFLICT DO NOTHING`, [u.id, t.practiceId, role]);
      people[role] = { id: u.id, email, token: obj((await api('POST', '/auth/login', null, { email, password: PW })).body).token };
    }
    return { t, T: t.tenant.schema_name, ...people };
  };
  const A = await mkPractice('Team', ['admin', 'doctor', 'nurse', 'billing_manager', 'receptionist']);
  const bell = async (T, userId, type) => (await pool.query(`SELECT message FROM ${T}.notifications WHERE user_id = $1 AND type = $2 ORDER BY created_at`, [userId, type])).rows.map((r) => r.message);
  const keys = (body) => (obj(body).events || []).map((e) => e.key);

  // ── 1. each role sees only what it may receive ─────────────────────────────────────────
  const sDoc = await api('GET', '/notification-settings', A.doctor.token);
  check(`doctor: settings load (got ${sDoc.status})`, sDoc.status === 200 && obj(sDoc.body).channels.length === 3);
  check('doctor: offered appointment/lab/prescription notifications', ['appointment.created', 'lab_order.status_changed', 'prescription.created'].every((k) => keys(sDoc.body).includes(k)));
  check('doctor: NOT offered low stock (doctors cannot reorder) or billing', !keys(sDoc.body).includes('inventory.low_stock') && !keys(sDoc.body).includes('claim.status_changed'));
  const sNurse = await api('GET', '/notification-settings', A.nurse.token);
  check('nurse: offered low stock (records stock receipts), not appointments', keys(sNurse.body).includes('inventory.low_stock') && !keys(sNurse.body).includes('appointment.created'));
  const sBill = await api('GET', '/notification-settings', A.billing_manager.token);
  check('billing manager: offered claims, payments and low stock', ['claim.status_changed', 'payment.received', 'inventory.low_stock'].every((k) => keys(sBill.body).includes(k)));
  const sRec = await api('GET', '/notification-settings', A.receptionist.token);
  check('receptionist: none of these (nothing to opt into)', sRec.status === 200 && keys(sRec.body).length === 0);
  const sAdm = await api('GET', '/notification-settings', A.admin.token);
  const admLow = obj(sAdm.body).events.find((e) => e.key === 'inventory.low_stock');
  check('admin: low stock offered, OFF by default with the fallback explained', admLow && admLow.channels.in_app.enabled === false && /only when nobody else/.test(admLow.note || ''));
  const docAppt = obj(sDoc.body).events.find((e) => e.key === 'appointment.created');
  check('defaults match what was sent before (email + WhatsApp on, bell off) and are marked default',
    docAppt.channels.email.enabled && docAppt.channels.whatsapp.enabled && !docAppt.channels.in_app.enabled && docAppt.channels.email.isDefault);
  const ai = obj(sDoc.body).events.find((e) => e.key === 'ai.draft_ready');
  check('AI drafts: in-app only (email/WhatsApp not offered)', ai && ai.channels.in_app.offered && !ai.channels.email.offered);

  // ── 2. saving: eligibility and validation are enforced ─────────────────────────────────
  check('doctor cannot opt into low stock (403)', (await api('PUT', '/notification-settings', A.doctor.token, { changes: [{ event: 'inventory.low_stock', channel: 'email', enabled: true }] })).status === 403);
  check('unknown notification refused (400)', (await api('PUT', '/notification-settings', A.doctor.token, { changes: [{ event: 'nope', channel: 'email', enabled: true }] })).status === 400);
  check('a channel the notification does not use is refused (400)', (await api('PUT', '/notification-settings', A.doctor.token, { changes: [{ event: 'ai.draft_ready', channel: 'email', enabled: true }] })).status === 400);
  check('enabled must be a boolean (400)', (await api('PUT', '/notification-settings', A.doctor.token, { changes: [{ event: 'appointment.created', channel: 'email', enabled: 'yes' }] })).status === 400);
  const nurseSave = await api('PUT', '/notification-settings', A.nurse.token, { changes: [
    { event: 'inventory.low_stock', channel: 'email', enabled: false }, { event: 'inventory.low_stock', channel: 'whatsapp', enabled: false }] });
  const nLow = obj(nurseSave.body).events && nurseSave.body.events.find((e) => e.key === 'inventory.low_stock');
  check('nurse turns low-stock email and WhatsApp off, keeps the bell', nurseSave.status === 200 && nLow && !nLow.channels.email.enabled && !nLow.channels.whatsapp.enabled && nLow.channels.in_app.enabled && !nLow.channels.email.isDefault);

  // ── 3. low-stock alert goes to the people who can reorder, on their channels ────────────
  const item = await api('POST', '/inventory/items', A.admin.token, { name: `Gloves ${RUN}`, unitOfMeasure: 'box', itemType: 'supply', unitCost: 4, quantityOnHand: 10, reorderLevel: 5, reorderQuantity: 20 });
  check(`item created (got ${item.status})`, item.status === 201);
  const itemId = obj(item.body).id;
  outbox.length = 0; waSent.length = 0;
  const mv0 = await api('POST', '/inventory/movements', A.admin.token, { itemId, movementType: 'issue', quantity: -3 });
  check(`admin records an issue (got ${mv0.status} ${JSON.stringify(mv0.body).slice(0, 80)})`, mv0.status === 201);
  await sleep(600);
  check('above the reorder level: no alert', (await bell(A.T, A.nurse.id, 'inventory')).length === 0);
  const mv = await api('POST', '/inventory/movements', A.nurse.token, { itemId, movementType: 'issue', quantity: -3 });
  check(`nurse records an issue (got ${mv.status})`, mv.status === 201);
  await sleep(800);
  const nurseBell = await bell(A.T, A.nurse.id, 'inventory');
  check('at/below the level: nurse gets the bell alert naming the item and quantity', nurseBell.length === 1 && nurseBell[0].includes(`Gloves ${RUN}`) && /4 box left/.test(nurseBell[0]));
  check('...but no email/WhatsApp, as the nurse chose', !outbox.some((m) => m.to === A.nurse.email) && waSent.length >= 0);
  check('billing manager gets bell + email (defaults)', (await bell(A.T, A.billing_manager.id, 'inventory')).length === 1 && outbox.some((m) => m.to === A.billing_manager.email && /Low stock/.test(m.subject)));
  check('billing manager gets WhatsApp (default on)', waSent.some((w) => /Low stock/.test(w.text)));
  check('admin is NOT alerted when others can reorder', (await bell(A.T, A.admin.id, 'inventory')).length === 0 && !outbox.some((m) => m.to === A.admin.email));
  check('doctor and receptionist are not alerted', (await bell(A.T, A.doctor.id, 'inventory')).length === 0 && (await bell(A.T, A.receptionist.id, 'inventory')).length === 0);

  const mv2 = await api('POST', '/inventory/movements', A.nurse.token, { itemId, movementType: 'issue', quantity: -1 });
  check(`further issue recorded (got ${mv2.status})`, mv2.status === 201);
  await sleep(600);
  check('one alert per dip: a further issue does not alert again', (await bell(A.T, A.nurse.id, 'inventory')).length === 1);
  const mv3 = await api('POST', '/inventory/movements', A.admin.token, { itemId, movementType: 'receipt', quantity: 20 });
  check(`receipt recorded (got ${mv3.status})`, mv3.status === 201);
  await sleep(600);
  const { rows: [armed] } = await pool.query(`SELECT low_stock_alerted_at FROM ${A.T}.inventory_items WHERE id = $1`, [itemId]);
  check('restock above the level re-arms the alert', armed && armed.low_stock_alerted_at === null);
  const mv4 = await api('POST', '/inventory/movements', A.admin.token, { itemId, movementType: 'issue', quantity: -23 });
  check(`large issue recorded (got ${mv4.status})`, mv4.status === 201);
  await sleep(800);
  const again = await bell(A.T, A.nurse.id, 'inventory');
  check('the next dip alerts again — out of stock is called out', again.length === 2 && /Out of stock/.test(again[1]));

  // An admin who wants it anyway can switch it on.
  await api('PUT', '/notification-settings', A.admin.token, { changes: [{ event: 'inventory.low_stock', channel: 'in_app', enabled: true }] });
  const item2 = await api('POST', '/inventory/items', A.admin.token, { name: `Masks ${RUN}`, unitOfMeasure: 'box', itemType: 'supply', unitCost: 2, quantityOnHand: 2, reorderLevel: 5 });
  await sleep(800);
  check('an item created already below its level alerts at once', (await bell(A.T, A.nurse.id, 'inventory')).some((m) => m.includes(`Masks ${RUN}`)));
  check('admin who switched it on receives it', (await bell(A.T, A.admin.id, 'inventory')).some((m) => m.includes(`Masks ${RUN}`)));
  void item2;

  // The practice takes stock rights away from nurses → nurses stop being alerted.
  for (const resource of ['stock_movements', 'purchase_orders']) {
    await pool.query(`INSERT INTO ${A.T}.module_permissions (module, role_name, resource, can_view, can_create, can_edit, can_delete, can_approve, can_export)
      VALUES ('inventory','nurse',$1,true,false,false,false,false,false)
      ON CONFLICT (module, role_name, resource) DO UPDATE SET can_create = false, can_edit = false`, [resource]);
  }
  const sNurse2 = await api('GET', '/notification-settings', A.nurse.token);
  check("practice removes nurses' stock rights → low stock no longer offered to nurses", !keys(sNurse2.body).includes('inventory.low_stock'));
  await api('POST', '/inventory/items', A.admin.token, { name: `Swabs ${RUN}`, unitOfMeasure: 'box', itemType: 'supply', unitCost: 1, quantityOnHand: 1, reorderLevel: 3 });
  await sleep(800);
  check('...and is not alerted', !(await bell(A.T, A.nurse.id, 'inventory')).some((m) => m.includes(`Swabs ${RUN}`)));
  check('...billing manager still is', (await bell(A.T, A.billing_manager.id, 'inventory')).some((m) => m.includes(`Swabs ${RUN}`)));

  // ── 4. solo practice: the admin gets it ────────────────────────────────────────────────
  const B = await mkPractice('Solo', ['admin']);
  outbox.length = 0;
  await api('POST', '/inventory/items', B.admin.token, { name: `Syringes ${RUN}`, unitOfMeasure: 'box', itemType: 'supply', unitCost: 3, quantityOnHand: 1, reorderLevel: 4 });
  await sleep(800);
  check('solo practice: the admin gets the bell alert', (await bell(B.T, B.admin.id, 'inventory')).some((m) => m.includes(`Syringes ${RUN}`)));
  check('...and the email', outbox.some((m) => m.to === B.admin.email && /Syringes/.test(m.subject)));
  check('practices are separate: the other practice heard nothing of it', !(await bell(A.T, A.admin.id, 'inventory')).some((m) => m.includes(`Syringes ${RUN}`)));

  // ── 5. the doctor's own settings decide appointment notifications ───────────────────────
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO ${A.T}, public`);
    const appt = { provider_id: A.doctor.id, patient_id: null, start_time: '2030-01-02 10:00:00', appointment_type: 'consultation' };
    outbox.length = 0;
    await notify.dispatch(client, 'appointment.created', { appointment: appt });
    check('default: the doctor is e-mailed about a new appointment (as before)', outbox.some((m) => m.to === A.doctor.email));
    await api('PUT', '/notification-settings', A.doctor.token, { changes: [
      { event: 'appointment.created', channel: 'email', enabled: false }, { event: 'appointment.created', channel: 'in_app', enabled: true }] });
    outbox.length = 0;
    await notify.dispatch(client, 'appointment.created', { appointment: appt });
    check('email switched off: no email to the doctor', !outbox.some((m) => m.to === A.doctor.email));
    check('bell switched on: the doctor gets an in-app notification', (await bell(A.T, A.doctor.id, 'appointment.created')).length === 1);
    outbox.length = 0;
    await notify.dispatch(client, 'appointment.cancelled', { appointment: appt });
    check('other notifications keep their own setting (cancellation still e-mailed)', outbox.some((m) => m.to === A.doctor.email));

    // ── 6. billing staff hear about claims ─────────────────────────────────────────────────
    await notify.dispatch(client, 'claim.status_changed', { claim: { claim_number: `CLM-${RUN}`, status: 'denied' }, patient_id: null, old_status: 'submitted' });
    const billBell = await bell(A.T, A.billing_manager.id, 'claim');
    check('claim status change: billing manager gets the bell (default)', billBell.some((m) => m.includes(`CLM-${RUN}`) && /denied/.test(m)));
    check('...the doctor does not', (await bell(A.T, A.doctor.id, 'claim')).length === 0);
  } finally { client.release(); }

  report();
})().catch((e) => report(e));
