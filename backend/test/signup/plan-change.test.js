// Tenant-facing plan changes: the practice's own subscription, prorated, admin-only.
//
// Stripe is stubbed at the SDK boundary so the real routes, the real proration wiring and
// the real entitlement update all run; only the network call is faked.

const path = require('path');
const crypto = require('crypto');
const Module = require('module');

const BACKEND = path.join(__dirname, '..', '..');
const stripeCalls = [];
const origRequire = Module.prototype.require;
Module.prototype.require = function (id) {
  if (id === 'stripe') {
    return function StripeStub() {
      return {
        subscriptions: {
          retrieve: async (id2) => ({ id: id2, customer: 'cus_1', items: { data: [{ id: 'si_1' }] } }),
          update: async (id2, params) => { stripeCalls.push(['subscriptions.update', params]); return { id: id2, ...params }; },
        },
        invoices: {
          createPreview: async (params) => {
            stripeCalls.push(['invoices.createPreview', params]);
            return {
              amount_due: 4200, currency: 'usd',
              lines: { data: [
                { proration: true, description: 'Unused time on Essentials', amount: -1500 },
                { proration: true, description: 'Remaining time on Clinical Pro', amount: 5700 },
                { proration: false, description: 'not a proration line', amount: 999 },
              ] },
            };
          },
        },
        products: { create: async () => ({ id: 'prod_1' }), update: async (i) => ({ id: i }) },
        prices: { create: async () => ({ id: 'price_new' }), update: async (i) => ({ id: i }) },
        checkout: { sessions: { create: async () => ({ id: 'cs', url: '/x' }) } },
        promotionCodes: { list: async () => ({ data: [] }) },
      };
    };
  }
  return origRequire.apply(this, arguments);
};

process.env.PORT = process.env.TEST_PORT || '4812';
process.env.NODE_ENV = 'development';
process.env.AC_STRIPE_SK = 'sk_test_stub';
process.env.AC_JWT_S = process.env.AC_JWT_S || crypto.randomBytes(48).toString('base64');
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
  return { status: r.status, body: await r.json().catch(() => null) };
};

(async () => {
  for (let i = 0; i < 40; i++) {
    try { await fetch(BASE + '/health'); break; } catch { await new Promise(r => setTimeout(r, 250)); }
  }

  // Two plans with Stripe prices.
  await pool.query(`UPDATE public.subscription_plans SET stripe_price_id = 'price_' || id, self_serve = true`);
  const { rows: plans } = await pool.query(
    'SELECT id, name FROM public.subscription_plans WHERE is_active = true ORDER BY price ASC NULLS FIRST, id');
  const planA = plans[0], planB = plans[1];

  // A practice with its own subscription, billed through Stripe.
  const t = await provisionTenant(pool, { name: 'Plan Test Clinic ' + crypto.randomBytes(3).toString('hex'), planId: planA.id });
  await pool.query(
    `UPDATE control.subscriptions SET stripe_subscription_id = 'sub_1', stripe_customer_id = 'cus_1'
      WHERE practice_id = $1`, [t.practiceId]);

  const hash = await bcrypt.hash('A-Strong-Passphrase!23', 12);
  const mk = async (role) => {
    const email = `${role}_${crypto.randomBytes(4).toString('hex')}@example.com`;
    await pool.query(
      `INSERT INTO public.users (id,email,first_name,last_name,role,status,password_hash,practice_id,created_at)
       VALUES (gen_random_uuid(),$1,'T','U',$2,'active',$3,$4,NOW())`, [email, role, hash, t.practiceId]);
    const l = await api('POST', '/api/auth/login', { email, password: 'A-Strong-Passphrase!23' });
    return l.body && l.body.token;
  };
  const adminTok = await mk('admin');
  const staffTok = await mk('staff');

  // ── current subscription comes from the control plane, not the shared legacy row ──
  const cur = await api('GET', '/api/plans/current', undefined, adminTok);
  check('current plan is read from the control plane', cur.status === 200 && cur.body.source === 'control_plane');
  check('current plan is the practice\'s own', cur.body.plan_id === planA.id);
  check('current plan reports Stripe billing is linked', cur.body.billing_linked === true);

  // ── proration preview ──
  const prev = await api('GET', `/api/plans/preview/${planB.id}`, undefined, adminTok);
  check('preview is prorated', prev.status === 200 && prev.body.prorated === true);
  check('preview amount comes from Stripe', prev.body.amountDue === 42);
  check('preview lists only proration lines', Array.isArray(prev.body.lines) && prev.body.lines.length === 2);
  const previewCall = stripeCalls.find(c => c[0] === 'invoices.createPreview');
  check('preview asked Stripe with create_prorations',
        previewCall && previewCall[1].subscription_details.proration_behavior === 'create_prorations');

  // ── non-admins cannot see or change billing ──
  check('staff cannot preview a change', (await api('GET', `/api/plans/preview/${planB.id}`, undefined, staffTok)).status === 403);
  check('staff cannot change the plan', (await api('PUT', '/api/plans/current', { plan_id: planB.id }, staffTok)).status === 403);
  const stillA = await pool.query('SELECT plan_id FROM control.subscriptions WHERE practice_id=$1', [t.practiceId]);
  check('the rejected attempt changed nothing', stillA.rows[0].plan_id === planA.id);

  // ── the change itself ──
  const before = stripeCalls.filter(c => c[0] === 'subscriptions.update').length;
  const changed = await api('PUT', '/api/plans/current', { plan_id: planB.id, prorationDate: prev.body.prorationDate }, adminTok);
  check('admin can change the plan', changed.status === 200);
  check('response says it was prorated', changed.body && changed.body.prorated === true);
  const upd = stripeCalls.filter(c => c[0] === 'subscriptions.update');
  check('Stripe subscription was updated', upd.length === before + 1);
  check('the update used create_prorations', upd.at(-1)[1].proration_behavior === 'create_prorations');
  check('the quoted proration_date was honoured', upd.at(-1)[1].proration_date === prev.body.prorationDate);
  check('the new price was applied', upd.at(-1)[1].items[0].price === 'price_' + planB.id);

  const { rows: after } = await pool.query(
    'SELECT plan_id, plan_name FROM control.subscriptions WHERE practice_id=$1', [t.practiceId]);
  check('control.subscriptions reflects the new plan', after[0].plan_id === planB.id);
  check('plan_name snapshot updated too', after[0].plan_name === planB.name);

  // ── another practice is untouched (the legacy shared-row bug) ──
  const other = await provisionTenant(pool, { name: 'Other Clinic ' + crypto.randomBytes(3).toString('hex'), planId: planA.id });
  const { rows: otherSub } = await pool.query(
    'SELECT plan_id FROM control.subscriptions WHERE practice_id=$1', [other.practiceId]);
  check('a different practice keeps its own plan', otherSub[0].plan_id === planA.id);

  check('changing to the same plan is refused',
        (await api('PUT', '/api/plans/current', { plan_id: planB.id }, adminTok)).status === 400);

  let ok = 0;
  for (const [n, c] of results) { console.log(`  ${c ? 'ok  ' : 'FAIL'} ${n}`); if (c) ok++; }
  console.log(`\n${ok}/${results.length} checks passed.`);
  await pool.end();
  process.exit(ok === results.length ? 0 : 1);
})().catch(e => { console.error('harness error:', e); process.exit(1); });
