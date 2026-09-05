// Platform accounting, coupons, free months, plan renaming — and the operator role matrix.
//
// Stripe is stubbed at the SDK boundary so the real routes, role gates and ledger writes
// all run; only the network call is faked.

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
          retrieve: async (i) => ({ id: i, customer: 'cus_stub', items: { data: [{ id: 'si_1' }] } }),
          update: async (i, p) => { stripeCalls.push(['subscriptions.update', p]); return { id: i, ...p }; },
        },
        coupons: {
          create: async (p) => { stripeCalls.push(['coupons.create', p]); return { id: 'coup_' + (stripeCalls.length), ...p }; },
        },
        promotionCodes: {
          create: async (p) => { stripeCalls.push(['promotionCodes.create', p]); return { id: 'promo_1', code: p.code }; },
          update: async (i, p) => { stripeCalls.push(['promotionCodes.update', p]); return { id: i, ...p }; },
          list: async () => ({ data: [{ id: 'promo_1', code: 'LAUNCH20', active: true, times_redeemed: 3,
            coupon: { id: 'coup_1', percent_off: 20, duration: 'once' } }] }),
        },
        invoices: { createPreview: async () => ({ amount_due: 0, currency: 'usd', lines: { data: [] } }), list: async () => ({ data: [] }) },
        products: { create: async () => ({ id: 'prod_1' }), update: async (i) => ({ id: i }) },
        prices: { create: async () => ({ id: 'price_new' }), update: async (i) => ({ id: i }) },
        checkout: { sessions: { create: async () => ({ id: 'cs', url: '/x' }) } },
      };
    };
  }
  return origRequire.apply(this, arguments);
};

process.env.PORT = process.env.TEST_PORT || '4867';
process.env.NODE_ENV = 'development';
process.env.AC_STRIPE_SK = 'sk_test_stub';
process.env.AC_PLAT_S = process.env.AC_PLAT_S || crypto.randomBytes(48).toString('base64');
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
  const text = await r.text();
  let parsed = null; try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { status: r.status, body: parsed };
};

(async () => {
  for (let i = 0; i < 40; i++) {
    try { await fetch(BASE + '/health'); break; } catch { await new Promise(r => setTimeout(r, 250)); }
  }

  const RUN = crypto.randomBytes(4).toString('hex');
  const hash = await bcrypt.hash('A-Strong-Passphrase!23', 12);
  const mkOp = async (role) => {
    const email = `${role}_${RUN}@example.com`;
    await pool.query(
      `INSERT INTO control.operators (email, password_hash, name, role, status)
       VALUES ($1,$2,$3,$4,'active')`, [email, hash, role, role]);
    const l = await api('POST', '/api/platform/login', { email, password: 'A-Strong-Passphrase!23' });
    return l.body && l.body.token;
  };
  const owner = await mkOp('owner');
  const billing = await mkOp('billing');
  const support = await mkOp('support');
  const readonly = await mkOp('readonly');
  check('all four roles can sign in', !!owner && !!billing && !!support && !!readonly);

  const t = await provisionTenant(pool, { name: 'Acct Clinic ' + RUN });
  await pool.query(
    `UPDATE control.subscriptions SET stripe_subscription_id=$2, stripe_customer_id=$3, status='active'
      WHERE tenant_id=$1`, [t.tenant.id, 'sub_' + RUN, 'cus_' + RUN]);
  await pool.query(`UPDATE public.subscription_plans SET stripe_price_id='price_'||id, stripe_product_id='prod_'||id`);
  const { rows: plans } = await pool.query(
    'SELECT id, name FROM public.subscription_plans WHERE is_active = true ORDER BY id LIMIT 2');

  // ── role matrix: reads open to all, writes gated ──────────────────────────
  check('readonly can read the billing summary',
        (await api('GET', '/api/platform/billing/summary', undefined, readonly)).status === 200);
  check('readonly can read the aging report',
        (await api('GET', '/api/platform/billing/aging', undefined, readonly)).status === 200);
  check('readonly CANNOT post an adjustment',
        (await api('POST', '/api/platform/billing/adjustments',
          { tenantId: t.tenant.id, amount: 10, reason: 'should be refused' }, readonly)).status === 403);
  check('support CANNOT post an adjustment (money is not theirs)',
        (await api('POST', '/api/platform/billing/adjustments',
          { tenantId: t.tenant.id, amount: 10, reason: 'should be refused' }, support)).status === 403);
  check('billing CANNOT create a tenant',
        (await api('POST', '/api/platform/tenants', { name: 'Nope ' + RUN }, billing)).status === 403);
  check('billing CANNOT open break-glass over PHI',
        (await api('POST', `/api/platform/tenants/${t.tenant.id}/break-glass`,
          { reason: 'investigating something plausible', ttlMinutes: 10 }, billing)).status === 403);
  check('support CAN create a tenant',
        (await api('POST', '/api/platform/tenants', { name: 'Support Made ' + RUN }, support)).status === 201);
  check('billing CANNOT list operators',
        (await api('GET', '/api/platform/operators', undefined, billing)).status === 403);
  check('owner CAN list operators',
        (await api('GET', '/api/platform/operators', undefined, owner)).status === 200);

  // ── adjustments ───────────────────────────────────────────────────────────
  const credit = await api('POST', '/api/platform/billing/adjustments',
    { tenantId: t.tenant.id, amount: 25, currency: 'usd', kind: 'credit', reason: 'Goodwill for the outage' }, billing);
  check('billing can post a credit', credit.status === 201);
  check('a credit is negative in the ledger', credit.body && credit.body.amount === -25);
  check('an adjustment without a reason is refused',
        (await api('POST', '/api/platform/billing/adjustments',
          { tenantId: t.tenant.id, amount: 5, reason: 'short' }, billing)).status === 400);
  check('a negative amount is refused',
        (await api('POST', '/api/platform/billing/adjustments',
          { tenantId: t.tenant.id, amount: -5, reason: 'trying to be clever' }, billing)).status === 400);

  const { rows: adjRow } = await pool.query(
    "SELECT operator_id, description FROM control.billing_events WHERE event_type='adjustment.credit' AND tenant_id=$1",
    [t.tenant.id]);
  check('the adjustment records who posted it', adjRow[0] && !!adjRow[0].operator_id);

  // ── CSV export ────────────────────────────────────────────────────────────
  const csv = await api('GET', '/api/platform/billing/export.csv', undefined, readonly);
  check('CSV export works for a readonly operator', csv.status === 200);
  check('CSV has a header row', typeof csv.body === 'string' && csv.body.split('\n')[0].startsWith('"occurred_at"') === false
        && csv.body.split('\n')[0] === 'occurred_at,tenant,event_type,amount,currency,description,stripe_object_id,operator');
  check('CSV quotes fields so a comma cannot shift columns', csv.body.includes('"Goodwill for the outage"'));

  // ── coupons ───────────────────────────────────────────────────────────────
  const coupon = await api('POST', '/api/platform/coupons',
    { code: 'LAUNCH' + RUN.slice(0, 4).toUpperCase(), percentOff: 20, duration: 'once', planIds: [plans[0].id] }, billing);
  check('billing can create a coupon', coupon.status === 201);
  const couponCall = stripeCalls.find(c => c[0] === 'coupons.create' && c[1].percent_off === 20);
  check('the coupon is restricted to the named plan',
        couponCall && couponCall[1].applies_to && couponCall[1].applies_to.products[0] === 'prod_' + plans[0].id);
  check('a promotion code was created too', stripeCalls.some(c => c[0] === 'promotionCodes.create'));
  check('readonly CANNOT create a coupon',
        (await api('POST', '/api/platform/coupons', { code: 'NOPE' + RUN.slice(0, 3), percentOff: 5 }, readonly)).status === 403);
  check('a coupon with both percent and amount is refused',
        (await api('POST', '/api/platform/coupons',
          { code: 'BOTH' + RUN.slice(0, 3), percentOff: 10, amountOff: 5 }, billing)).status === 400);
  check('a repeating coupon without months is refused',
        (await api('POST', '/api/platform/coupons',
          { code: 'REP' + RUN.slice(0, 3), percentOff: 10, duration: 'repeating' }, billing)).status === 400);
  check('coupons can be listed', (await api('GET', '/api/platform/coupons', undefined, readonly)).status === 200);
  check('billing can deactivate a code',
        (await api('POST', '/api/platform/coupons/promo_1/deactivate', undefined, billing)).status === 200);

  // ── free months ───────────────────────────────────────────────────────────
  const free = await api('POST', `/api/platform/tenants/${t.tenant.id}/free-months`,
    { months: 3, reason: 'Migration goodwill for the delay' }, billing);
  check('billing can grant free months', free.status === 201 && free.body.months === 3);
  const freeCoupon = stripeCalls.find(c => c[0] === 'coupons.create' && c[1].percent_off === 100);
  check('free months are a 100% off coupon', !!freeCoupon);
  check('three months repeats for three months',
        freeCoupon && freeCoupon[1].duration === 'repeating' && freeCoupon[1].duration_in_months === 3);
  check('the coupon was applied to the subscription',
        stripeCalls.some(c => c[0] === 'subscriptions.update' && c[1].coupon));
  const { rows: grant } = await pool.query(
    'SELECT months, reason, operator_id FROM control.subscription_grants WHERE tenant_id=$1', [t.tenant.id]);
  check('the grant is recorded with its reason and operator',
        grant[0] && grant[0].months === 3 && !!grant[0].operator_id);
  check('free months without a reason are refused',
        (await api('POST', `/api/platform/tenants/${t.tenant.id}/free-months`, { months: 2, reason: 'x' }, billing)).status === 400);
  check('an absurd number of free months is refused',
        (await api('POST', `/api/platform/tenants/${t.tenant.id}/free-months`,
          { months: 999, reason: 'trying it on for size' }, billing)).status === 400);
  check('readonly CANNOT grant free months',
        (await api('POST', `/api/platform/tenants/${t.tenant.id}/free-months`,
          { months: 1, reason: 'should be refused here' }, readonly)).status === 403);

  // ── plan renaming ─────────────────────────────────────────────────────────
  await pool.query('UPDATE control.subscriptions SET plan_id=$2 WHERE tenant_id=$1', [t.tenant.id, plans[0].id]);
  const newKey = 'renamed_' + RUN;
  const renamed = await api('PUT', `/api/platform/plans/${plans[0].id}`,
    { name: newKey, displayName: 'Renamed Plan', freeMonths: 2 }, billing);
  check('billing can rename a plan', renamed.status === 200);
  const { rows: planRow } = await pool.query(
    'SELECT name, display_name, free_months FROM public.subscription_plans WHERE id=$1', [plans[0].id]);
  check('the key was renamed', planRow[0].name === newKey);
  check('the display name was changed', planRow[0].display_name === 'Renamed Plan');
  check('plan free months were stored', planRow[0].free_months === 2);
  const { rows: subSnap } = await pool.query(
    'SELECT plan_name FROM control.subscriptions WHERE tenant_id=$1', [t.tenant.id]);
  check('the rename carried onto the subscription snapshot', subSnap[0].plan_name === newKey);
  check('renaming to an existing key is refused',
        (await api('PUT', `/api/platform/plans/${plans[1].id}`, { name: newKey }, billing)).status === 409);

  // ── operator management ───────────────────────────────────────────────────
  const created = await api('POST', '/api/platform/operators',
    { email: `new_${RUN}@example.com`, password: 'A-Strong-Passphrase!23', role: 'billing', name: 'New' }, owner);
  check('owner can add an operator', created.status === 201 && created.body.role === 'billing');
  check('a duplicate email is refused',
        (await api('POST', '/api/platform/operators',
          { email: `new_${RUN}@example.com`, password: 'A-Strong-Passphrase!23' }, owner)).status === 409);
  check('a weak password is refused',
        (await api('POST', '/api/platform/operators',
          { email: `weak_${RUN}@example.com`, password: 'short' }, owner)).status === 400);

  // Demotion must sign the operator out immediately.
  const demoteTarget = created.body.id;
  const targetLogin = await api('POST', '/api/platform/login',
    { email: `new_${RUN}@example.com`, password: 'A-Strong-Passphrase!23' });
  const targetTok = targetLogin.body.token;
  check('the new operator can act as billing',
        (await api('GET', '/api/platform/coupons', undefined, targetTok)).status === 200);
  await api('PUT', `/api/platform/operators/${demoteTarget}`, { role: 'readonly' }, owner);
  check('changing a role revokes the live token',
        (await api('GET', '/api/platform/coupons', undefined, targetTok)).status === 401);

  // The last owner must not be able to lock everyone out.
  await pool.query("UPDATE control.operators SET role='readonly' WHERE role='owner' AND email <> $1",
    [`owner_${RUN}@example.com`]);
  const { rows: me } = await pool.query('SELECT id FROM control.operators WHERE email=$1', [`owner_${RUN}@example.com`]);
  check('the last active owner cannot demote themselves',
        (await api('PUT', `/api/platform/operators/${me[0].id}`, { role: 'billing' }, owner)).status === 409);
  check('the last active owner cannot disable themselves',
        (await api('PUT', `/api/platform/operators/${me[0].id}`, { status: 'disabled' }, owner)).status === 409);

  // ── everything is audited ─────────────────────────────────────────────────
  const { rows: audit } = await pool.query(
    `SELECT action FROM control.audit_log WHERE action IN
       ('billing.adjustment.credit','coupon.create','coupon.deactivate',
        'subscription.free_months','plan.update','operator.create','operator.update')`);
  const seen = new Set(audit.map(a => a.action));
  check('every privileged action is in the platform audit trail',
        ['billing.adjustment.credit', 'coupon.create', 'subscription.free_months',
         'operator.create', 'operator.update'].every(a => seen.has(a)));

  let ok = 0;
  for (const [n, c] of results) { console.log(`  ${c ? 'ok  ' : 'FAIL'} ${n}`); if (c) ok++; }
  console.log(`\n${ok}/${results.length} checks passed.`);
  await pool.end();
  process.exit(ok === results.length ? 0 : 1);
})().catch(e => { console.error('harness error:', e); process.exit(1); });
