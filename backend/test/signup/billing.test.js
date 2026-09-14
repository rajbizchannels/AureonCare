// Platform billing: operator plan changes reaching Stripe, and the revenue ledger.

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
        invoices: {
          createPreview: async (p) => { stripeCalls.push(['createPreview', p]); return { amount_due: 3300, currency: 'usd', lines: { data: [] } }; },
          list: async () => ({ data: [{ id: 'in_1', number: 'INV-1', status: 'paid', amount_due: 4900, amount_paid: 4900, currency: 'usd', created: 1, period_end: 2, hosted_invoice_url: 'https://x', invoice_pdf: 'https://y' }] }),
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

process.env.PORT = process.env.TEST_PORT || '4823';
process.env.NODE_ENV = 'development';
process.env.AC_STRIPE_SK = 'sk_test_stub';
process.env.AC_STRIPE_WHS = 'whsec_test_billing';
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
  return { status: r.status, body: await r.json().catch(() => null) };
};
async function webhook(event) {
  const raw = JSON.stringify(event);
  const t = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac('sha256', 'whsec_test_billing').update(`${t}.${raw}`).digest('hex');
  const r = await fetch(BASE + '/api/stripe-webhook', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Stripe-Signature': `t=${t},v1=${sig}` }, body: raw,
  });
  return r.status;
}

(async () => {
  for (let i = 0; i < 40; i++) {
    try { await fetch(BASE + '/health'); break; } catch { await new Promise(r => setTimeout(r, 250)); }
  }

  await pool.query(`UPDATE public.subscription_plans SET stripe_price_id = 'price_' || id`);
  const { rows: plans } = await pool.query(
    'SELECT id, name, price, billing_cycle FROM public.subscription_plans WHERE is_active = true ORDER BY price ASC NULLS FIRST, id');
  const planA = plans[0], planB = plans[1];

  const t = await provisionTenant(pool, { name: 'Billing Clinic ' + crypto.randomBytes(3).toString('hex'), planId: planA.id });
  // Unique per run: control.subscriptions enforces one tenant per Stripe customer.
  const CUS = 'cus_' + crypto.randomBytes(6).toString('hex');
  await pool.query(
    `UPDATE control.subscriptions SET stripe_subscription_id='sub_b', stripe_customer_id=$2, status='active'
      WHERE tenant_id=$1`, [t.tenant.id, CUS]);

  const opEmail = `op_${crypto.randomBytes(4).toString('hex')}@example.com`;
  await pool.query(
    `INSERT INTO control.operators (email, password_hash, name, status)
     VALUES ($1,$2,'Op','active')`, [opEmail, await bcrypt.hash('A-Strong-Passphrase!23', 12)]);
  const login = await api('POST', '/api/platform/login', { email: opEmail, password: 'A-Strong-Passphrase!23' });
  const tok = login.body && login.body.token;
  check('operator signed in', !!tok);

  // ── operator plan change reaches Stripe, prorated ──
  const prev = await api('GET', `/api/platform/tenants/${t.tenant.id}/subscription/preview/${planB.id}`, undefined, tok);
  check('operator can preview the proration', prev.status === 200 && prev.body.prorated === true && prev.body.amountDue === 33);

  const before = stripeCalls.filter(c => c[0] === 'subscriptions.update').length;
  const changed = await api('PUT', `/api/platform/tenants/${t.tenant.id}/subscription`, { planId: planB.id }, tok);
  check('operator plan change succeeds', changed.status === 200);
  check('response reports it was prorated', changed.body && changed.body.prorated === true);
  const upd = stripeCalls.filter(c => c[0] === 'subscriptions.update');
  check('Stripe subscription was updated', upd.length === before + 1);
  check('it used create_prorations', upd.at(-1)[1].proration_behavior === 'create_prorations');
  check('the new price was applied', upd.at(-1)[1].items[0].price === 'price_' + planB.id);
  const { rows: sub } = await pool.query('SELECT plan_id FROM control.subscriptions WHERE tenant_id=$1', [t.tenant.id]);
  check('control.subscriptions updated', sub[0].plan_id === planB.id);

  // pushToStripe:false records without billing — for reconciling a manual Stripe change
  const n2 = stripeCalls.filter(c => c[0] === 'subscriptions.update').length;
  const recorded = await api('PUT', `/api/platform/tenants/${t.tenant.id}/subscription`,
    { planId: planA.id, pushToStripe: false }, tok);
  check('pushToStripe:false does not call Stripe',
        recorded.status === 200 && recorded.body.prorated === false &&
        stripeCalls.filter(c => c[0] === 'subscriptions.update').length === n2);

  // ── ledger ──
  // Stripe object ids are the ledger's idempotency key, so they must be unique per run —
  // otherwise a second run's inserts are (correctly) skipped as duplicates of the first.
  const RUN = crypto.randomBytes(4).toString('hex');
  // Baseline before this run's events, so the assertions below measure THIS run rather
  // than the whole database — these suites are routinely re-run against the same Postgres.
  const baseline = (await api('GET', '/api/platform/billing/summary', undefined, tok)).body;
  const baseCollected = baseline.collectedByMonth.reduce((a, m) => a + m.amount, 0);
  const baseFailed = baseline.failedPayments90d.count;

  const inv = (id, paid, amount) => ({
    id: 'evt_' + id, type: paid ? 'invoice.paid' : 'invoice.payment_failed',
    data: { object: { id, customer: CUS, currency: 'usd', amount_paid: amount, amount_due: amount,
                      number: 'INV-' + id, created: Math.floor(Date.now() / 1000), attempt_count: 1,
                      status_transitions: { paid_at: Math.floor(Date.now() / 1000) } } },
  });
  check('paid invoice accepted', (await webhook(inv(`in_100_${RUN}`, true, 4900))) === 200);
  await new Promise(r => setTimeout(r, 600));
  check('duplicate delivery accepted', (await webhook(inv(`in_100_${RUN}`, true, 4900))) === 200);
  await new Promise(r => setTimeout(r, 600));
  const { rows: dupCheck } = await pool.query(
    "SELECT count(*)::int c FROM control.billing_events WHERE stripe_object_id=$1", [`in_100_${RUN}`]);
  check('a retried webhook does not double-count revenue', dupCheck[0].c === 1);

  check('failed payment accepted', (await webhook(inv(`in_101_${RUN}`, false, 2900))) === 200);
  await new Promise(r => setTimeout(r, 600));

  const refund = { id: 'evt_r', type: 'charge.refunded',
    data: { object: { id: `ch_${RUN}`, customer: CUS, currency: 'usd', amount_refunded: 1000, created: Math.floor(Date.now() / 1000) } } };
  check('refund accepted', (await webhook(refund)) === 200);
  await new Promise(r => setTimeout(r, 600));

  const summary = await api('GET', '/api/platform/billing/summary', undefined, tok);
  check('summary returns MRR', summary.status === 200 && typeof summary.body.mrr === 'number');
  check('summary counts active subscriptions', (summary.body.byStatus.active || 0) >= 1);
  check('summary reports the failed payment',
        summary.body.failedPayments90d.count - baseFailed === 1);
  const collected = summary.body.collectedByMonth.reduce((a, m) => a + m.amount, 0);
  check('collected nets the refund off the payment',
        Math.abs((collected - baseCollected) - 39) < 0.01);

  const perTenant = await api('GET', '/api/platform/billing/tenants', undefined, tok);
  const mine = perTenant.body.find(r => r.tenant_id === t.tenant.id);
  check('per-tenant totals show what was collected', mine && Math.abs(mine.collected - 49) < 0.01);
  check('per-tenant totals show refunds separately', mine && Math.abs(mine.refunded - 10) < 0.01);
  check('per-tenant net is collected minus refunds', mine && Math.abs(mine.net - 39) < 0.01);
  check('collected excludes zero-amount ledger rows',
        summary.body.collectedByMonth.every((m) => m.amount !== 0 && m.currency));

  const events = await api('GET', `/api/platform/billing/events?tenantId=${t.tenant.id}`, undefined, tok);
  check('the ledger lists this tenant\'s events', events.status === 200 && events.body.length >= 3);

  const invoices = await api('GET', `/api/platform/tenants/${t.tenant.id}/invoices`, undefined, tok);
  check('invoices come from Stripe', invoices.status === 200 && invoices.body.linked === true &&
        invoices.body.invoices[0].number === 'INV-1');

  // ── the ledger is append-only ──
  let mutated = false;
  try { await pool.query("UPDATE control.billing_events SET amount_minor = 999999"); mutated = true; } catch (_) {}
  check('the ledger cannot be rewritten', mutated === false);
  let deleted = false;
  try { await pool.query('DELETE FROM control.billing_events'); deleted = true; } catch (_) {}
  check('the ledger cannot be deleted from', deleted === false);

  // ── billing is operator-only ──
  check('billing summary requires an operator',
        (await api('GET', '/api/platform/billing/summary')).status === 401);

  let ok = 0;
  for (const [n, c] of results) { console.log(`  ${c ? 'ok  ' : 'FAIL'} ${n}`); if (c) ok++; }
  console.log(`\n${ok}/${results.length} checks passed.`);
  await pool.end();
  process.exit(ok === results.length ? 0 : 1);
})().catch(e => { console.error('harness error:', e); process.exit(1); });
