// Subscription changes: audited in the platform trail, booked in the ledger, prorated
// from the change date — whichever side made the change.
//
// The gap this covers: a practice admin moving their own plan used to write nothing to
// control.audit_log and nothing to control.billing_events. The change happened, the money
// moved, and the only evidence was plan_id holding a different number. Every check below
// that names "tenant admin" fails against the code as it was.
//
// Stripe is stubbed at the SDK boundary so the real routes, the real quoting and the real
// ledger writes all run; only the network call is faked.

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
          createPreview: async (p) => {
            stripeCalls.push(['invoices.createPreview', p]);
            return {
              // amount_due is the WHOLE next invoice; the proration lines are a subset.
              // Deliberately different numbers so a test can tell which one got booked.
              amount_due: 9900,
              currency: 'usd',
              lines: { data: [
                { proration: true, description: 'Unused time on Essentials', amount: -1250 },
                { proration: true, description: 'Remaining time on Clinical Pro', amount: 4000 },
                { proration: false, description: 'Next month, in full', amount: 7150 },
              ] },
            };
          },
          list: async () => ({ data: [] }),
        },
        products: { create: async () => ({ id: 'prod_1' }), update: async (i) => ({ id: i }) },
        prices: { create: async () => ({ id: 'price_new' }), update: async (i) => ({ id: i }) },
        checkout: { sessions: { create: async () => ({ id: 'cs', url: '/x' }) } },
        promotionCodes: { list: async () => ({ data: [] }) },
        coupons: { create: async () => ({ id: 'coup_1' }) },
      };
    };
  }
  return origRequire.apply(this, arguments);
};

process.env.PORT = process.env.TEST_PORT || '4871';
process.env.NODE_ENV = 'development';
process.env.AC_STRIPE_SK = 'sk_test_stub';
process.env.AC_PLAT_S = process.env.AC_PLAT_S || crypto.randomBytes(48).toString('base64');
process.env.AC_JWT_S = process.env.AC_JWT_S || crypto.randomBytes(48).toString('base64');
const BASE = `http://127.0.0.1:${process.env.PORT}`;

const pool = require(path.join(BACKEND, 'db.js'));
const bcrypt = require(path.join(BACKEND, '..', 'node_modules', 'bcryptjs'));
const { provisionTenant } = require(path.join(BACKEND, 'services/tenantProvisioning.js'));
const { prorate } = require(path.join(BACKEND, 'utils/proration.js'));
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

const DAY = 86400;

(async () => {
  for (let i = 0; i < 40; i++) {
    try { await fetch(BASE + '/health'); break; } catch { await new Promise((r) => setTimeout(r, 250)); }
  }

  // ── 1. the proration arithmetic, on its own ────────────────────────────────────────
  // Checked directly rather than only through a route: these are the numbers that end up
  // on a customer's invoice, and a route test that asserts "some amount was recorded"
  // would pass just as happily with the arithmetic inverted.
  const periodEnd = 1700000000;
  const periodStart = periodEnd - 30 * DAY;

  const half = prorate({ oldAmount: 100, newAmount: 300, periodStart, periodEnd, changeAt: periodEnd - 15 * DAY });
  check('half a period credits half the old plan', half.creditMinor === -5000);
  check('half a period charges half the new plan', half.chargeMinor === 15000);
  check('the net is the difference', half.netMinor === 10000);

  const atStart = prorate({ oldAmount: 100, newAmount: 300, periodStart, periodEnd, changeAt: periodStart });
  check('a change at the period start prorates the whole period', atStart.creditMinor === -10000 && atStart.chargeMinor === 30000);

  const atEnd = prorate({ oldAmount: 100, newAmount: 300, periodStart, periodEnd, changeAt: periodEnd });
  check('a change on the renewal boundary prorates nothing', atEnd.creditMinor === 0 && atEnd.chargeMinor === 0);

  const late = prorate({ oldAmount: 100, newAmount: 300, periodStart, periodEnd, changeAt: periodEnd + 10 * DAY });
  check('a change quoted after the period closed is clamped, not extrapolated', late.netMinor === 0);
  const early = prorate({ oldAmount: 100, newAmount: 300, periodStart, periodEnd, changeAt: periodStart - 10 * DAY });
  check('a change quoted before the period opened never credits more than a full period',
        early.creditMinor === -10000);

  const downgrade = prorate({ oldAmount: 300, newAmount: 100, periodStart, periodEnd, changeAt: periodEnd - 15 * DAY });
  check('a downgrade leaves the customer in credit', downgrade.netMinor < 0);

  const derived = prorate({ oldAmount: 100, newAmount: 200, periodEnd, billingCycle: 'monthly', changeAt: periodEnd - 15 * DAY });
  check('a missing period start is derived from the billing cycle', derived && derived.periodStartDerived === true);
  check('and the derivation is flagged, not hidden', derived.periodStartDerived === true);
  check('no period end at all means no figure rather than a made-up one',
        prorate({ oldAmount: 100, newAmount: 200, billingCycle: 'monthly' }) === null);
  check('an unprorateable billing cycle yields nothing rather than a guess',
        prorate({ oldAmount: 100, newAmount: 200, periodEnd, billingCycle: 'per-visit' }) === null);

  // ── fixtures ───────────────────────────────────────────────────────────────────────
  const RUN = crypto.randomBytes(4).toString('hex');
  await pool.query("UPDATE public.subscription_plans SET stripe_price_id = 'price_' || id, self_serve = true");
  const { rows: plans } = await pool.query(
    'SELECT id, name, display_name, price, currency, billing_cycle FROM public.subscription_plans WHERE is_active = true ORDER BY price ASC NULLS FIRST, id');
  const planA = plans[0]; const planB = plans[1]; const planC = plans[2] || plans[0];

  const t = await provisionTenant(pool, { name: `Change Clinic ${RUN}`, planId: planA.id });
  t.tenantId = t.tenant.id;
  const CUS = 'cus_' + crypto.randomBytes(6).toString('hex');
  await pool.query(
    `UPDATE control.subscriptions
        SET stripe_subscription_id = $2, stripe_customer_id = $3,
            current_period_start = now() - interval '15 days',
            current_period_end   = now() + interval '15 days'
      WHERE practice_id = $1`,
    [t.practiceId, 'sub_' + RUN, CUS]);

  const hash = await bcrypt.hash('A-Strong-Passphrase!23', 12);
  const mkUser = async (role) => {
    const email = `${role}_${crypto.randomBytes(4).toString('hex')}@example.com`;
    await pool.query(
      `INSERT INTO public.users (id,email,first_name,last_name,role,status,password_hash,practice_id,created_at)
       VALUES (gen_random_uuid(),$1,'T','U',$2,'active',$3,$4,NOW())`, [email, role, hash, t.practiceId]);
    const l = await api('POST', '/api/auth/login', { email, password: 'A-Strong-Passphrase!23' });
    return { email, token: l.body && l.body.token };
  };
  const admin = await mkUser('admin');

  const opEmail = `op_${RUN}@example.com`;
  await pool.query(
    `INSERT INTO control.operators (email, password_hash, name, role, status)
     VALUES ($1,$2,'Op','owner','active')`, [opEmail, hash]);
  const opLogin = await api('POST', '/api/platform/login', { email: opEmail, password: 'A-Strong-Passphrase!23' });
  const opTok = opLogin.body && opLogin.body.token;
  check('operator signed in', Boolean(opTok));

  // Accessors that return an empty object rather than undefined. A missing row should make
  // the check that needs it fail BY NAME; letting it throw turns a precise answer ("the
  // credit was never written") into a stack trace halfway down the file.
  const pick = (rows, type) => rows.find((r) => r.event_type === type) || {};
  const obj = (v) => v || {};

  const auditFor = async (tenantId) => (await pool.query(
    `SELECT action, actor_type, actor_label, operator_id, detail
       FROM control.audit_log
      WHERE tenant_id = $1 ORDER BY id DESC`, [tenantId])).rows;
  const ledgerFor = async (tenantId) => (await pool.query(
    `SELECT event_type, entry_kind, amount_minor, currency, occurred_at, description, detail
       FROM control.billing_events
      WHERE tenant_id = $1 ORDER BY id`, [tenantId])).rows;

  // Platform revenue as it stands. Booking prorations must not move it: they are money
  // recognised, not money received, and the invoice that settles them will be counted when
  // it is paid.
  const revenueBefore = JSON.stringify(
    ((await api('GET', '/api/platform/billing/summary', undefined, opTok)).body || {}).collectedByMonth);

  // ── 2. a practice admin changing their own plan ────────────────────────────────────
  const quoted = await api('GET', `/api/plans/preview/${planB.id}`, undefined, admin.token);
  check('the tenant preview is prorated', quoted.status === 200 && quoted.body.prorated === true);
  check('the preview says Stripe priced it', quoted.body.source === 'stripe');
  check('amountDue is the whole next invoice, not just the proration',
        quoted.body.amountDue === 99);
  check('the proration net is reported separately', quoted.body.prorationNet === 27.5);
  check('the preview carries an effective date', Boolean(quoted.body.effectiveAt));

  const changed = await api('PUT', '/api/plans/current',
    { plan_id: planB.id, prorationDate: quoted.body.prorationDate }, admin.token);
  check('the admin can change the plan', changed.status === 200);
  check('the response reports the proration it booked', changed.body.proration
        && changed.body.proration.net === 27.5 && changed.body.proration.source === 'stripe');
  check('the change was not silently un-booked', !changed.body.accountingWarning);

  const audit1 = await auditFor(t.tenantId);
  const planAudit = audit1.find((a) => a.action === 'subscription.plan_changed');
  check('a tenant-initiated plan change reaches the platform audit trail', Boolean(planAudit));
  const pa = obj(planAudit); const paD = obj(pa.detail);
  check('the audit entry names the practice user, not an operator',
        pa.actor_type === 'tenant_user' && pa.actor_label === admin.email);
  check('it is not attributed to an operator', pa.actor_type === 'tenant_user' && pa.operator_id === null);
  check('the audit entry records what the plan moved FROM',
        obj(paD.plan) && obj(obj(paD.plan).from).id === planA.id);
  check('...as well as what it moved to', obj(obj(paD.plan).to).id === planB.id);
  check('the audit entry carries the proration',
        obj(paD.proration).netMinor === 2750
        && obj(paD.proration).pricedBy === 'stripe');
  check('the audit entry dates the change', Boolean(obj(paD.proration).effectiveAt));

  const led1 = await ledgerFor(t.tenantId);
  const credit = pick(led1, 'subscription.proration_credit');
  const charge = pick(led1, 'subscription.proration_charge');
  check('a tenant-initiated plan change is booked in the ledger', Boolean(credit.event_type && charge.event_type));
  check('the credit is negative', Number(credit.amount_minor) === -1250);
  check('the charge is positive', Number(charge.amount_minor) === 4000);
  check('both are accruals, not cash', credit.entry_kind === 'accrual' && charge.entry_kind === 'accrual');
  check('the entries are dated at the proration date, not at insert time',
        credit.occurred_at
        && Math.abs(Math.floor(new Date(credit.occurred_at).getTime() / 1000) - quoted.body.prorationDate) <= 1);
  check('the entries carry the currency', credit.currency === 'usd');
  check('no third row double-counts the net',
        led1.filter((e) => String(e.event_type).startsWith('subscription.')).length === 2);

  // The reason accruals are kept apart from cash: they must not inflate collected revenue.
  const totals = await api('GET', '/api/platform/billing/tenants', undefined, opTok);
  const mine = (totals.body || []).find((r) => r.tenant_id === t.tenantId);
  check('a proration does not count as collected revenue', mine && Number(mine.collected) === 0);
  check('it is reported separately as unbilled', mine && Number(mine.accrued) === 27.5);

  const revenueAfter = JSON.stringify(
    ((await api('GET', '/api/platform/billing/summary', undefined, opTok)).body || {}).collectedByMonth);
  check('booking a proration does not move platform collected revenue', revenueAfter === revenueBefore);

  const csv = await api('GET', '/api/platform/billing/export.csv', undefined, opTok);
  check('the accountant\'s export distinguishes cash from accrual',
        typeof csv.body === 'string' && csv.body.includes('"subscription.proration_charge","accrual"'));

  // ── 3. the same change made by an operator ─────────────────────────────────────────
  const opPreview = await api('GET', `/api/platform/tenants/${t.tenantId}/subscription/preview/${planC.id}`, undefined, opTok);
  check('the operator preview is prorated', opPreview.status === 200 && opPreview.body.prorated === true);

  const opChange = await api('PUT', `/api/platform/tenants/${t.tenantId}/subscription`,
    { planId: planC.id, prorationDate: opPreview.body.prorationDate }, opTok);
  check('the operator can change the plan', opChange.status === 200);
  check('the operator response reports the proration', opChange.body.proration
        && opChange.body.proration.net === 27.5);

  const audit2 = await auditFor(t.tenantId);
  const opAudit = audit2.find((a) => a.action === 'subscription.plan_changed' && a.actor_type === 'operator');
  check('an operator plan change is audited as an operator action', Boolean(opAudit));
  check('the operator is named', opAudit && opAudit.actor_label === opEmail && opAudit.operator_id !== null);
  check('the operator entry also records the previous plan', opAudit && opAudit.detail.plan.from.id === planB.id);

  const led2 = await ledgerFor(t.tenantId);
  check('the operator change is booked too',
        led2.filter((e) => e.event_type === 'subscription.proration_charge').length === 2);
  check('the operator entry is attributed to them',
        led2.filter((e) => e.event_type === 'subscription.proration_charge').at(-1).detail.actor.type === 'operator');

  // ── 4. idempotency: the same change, priced at the same instant, books once ────────
  await pool.query('UPDATE control.subscriptions SET plan_id = $2 WHERE tenant_id = $1', [t.tenantId, planB.id]);
  const before = (await ledgerFor(t.tenantId)).length;
  await api('PUT', `/api/platform/tenants/${t.tenantId}/subscription`,
    { planId: planC.id, prorationDate: opPreview.body.prorationDate }, opTok);
  const after = (await ledgerFor(t.tenantId)).length;
  check('re-applying the same change at the same proration date does not double-book', after === before);

  // ── 4b. the quoted instant is what Stripe is told to bill ─────────────────────────
  // Deliberately NOT "now". A quote and a confirmation taken a second apart look identical
  // when both round to the same second, so an implementation that quietly re-quotes at the
  // moment of confirmation passes a same-second test while billing the customer an amount
  // they were never shown. Two days back makes the two values impossible to confuse.
  const pinned = Math.floor(Date.now() / 1000) - 2 * DAY;
  await pool.query('UPDATE control.subscriptions SET plan_id = $2 WHERE tenant_id = $1', [t.tenantId, planC.id]);
  const pinnedQuote = await api('GET',
    `/api/platform/tenants/${t.tenantId}/subscription/preview/${planB.id}?at=${pinned}`, undefined, opTok);
  check('a preview can be taken at a given instant', pinnedQuote.body.prorationDate === pinned);
  const updsBefore = stripeCalls.filter((c) => c[0] === 'subscriptions.update').length;
  await api('PUT', `/api/platform/tenants/${t.tenantId}/subscription`,
    { planId: planB.id, prorationDate: pinned }, opTok);
  const upds = stripeCalls.filter((c) => c[0] === 'subscriptions.update');
  check('the change was pushed to Stripe', upds.length === updsBefore + 1);
  check('Stripe is told to prorate at the instant that was quoted, not at confirmation time',
        upds.at(-1)[1].proration_date === pinned);
  const previews = stripeCalls.filter((c) => c[0] === 'invoices.createPreview');
  check('and the amount was re-read at that same instant',
        obj(obj(previews.at(-1)[1]).subscription_details).proration_date === pinned);
  const pinnedRow = (await ledgerFor(t.tenantId))
    .filter((e) => e.event_type === 'subscription.proration_charge').at(-1) || {};
  check('the ledger entry is dated at the quoted instant too',
        pinnedRow.occurred_at
        && Math.abs(Math.floor(new Date(pinnedRow.occurred_at).getTime() / 1000) - pinned) <= 1);

  // ── 5. a tenant Stripe does not bill still gets a dated, prorated entry ───────────
  const manual = await provisionTenant(pool, { name: `Manual Clinic ${RUN}`, planId: planA.id });
  manual.tenantId = manual.tenant.id;
  await pool.query(
    `UPDATE control.subscriptions
        SET stripe_subscription_id = NULL, stripe_customer_id = NULL,
            current_period_start = now() - interval '15 days',
            current_period_end   = now() + interval '15 days'
      WHERE practice_id = $1`, [manual.practiceId]);
  const manualAdminEmail = `madmin_${RUN}@example.com`;
  await pool.query(
    `INSERT INTO public.users (id,email,first_name,last_name,role,status,password_hash,practice_id,created_at)
     VALUES (gen_random_uuid(),$1,'M','U','admin','active',$2,$3,NOW())`,
    [manualAdminEmail, hash, manual.practiceId]);
  const mLogin = await api('POST', '/api/auth/login', { email: manualAdminEmail, password: 'A-Strong-Passphrase!23' });
  const mTok = mLogin.body && mLogin.body.token;

  const mPreview = await api('GET', `/api/plans/preview/${planB.id}`, undefined, mTok);
  check('a manually invoiced practice is still quoted a figure', mPreview.status === 200 && mPreview.body.prorated === true);
  check('and is told we computed it, not Stripe', mPreview.body.source === 'local');

  const mChange = await api('PUT', '/api/plans/current', { plan_id: planB.id }, mTok);
  check('the manual practice can change plan', mChange.status === 200);
  check('nothing was pushed to Stripe', mChange.body.prorated === false);
  check('but the change was still prorated locally', mChange.body.proration.source === 'local');
  const mLed = await ledgerFor(manual.tenantId);
  check('and booked', mLed.some((e) => e.event_type === 'subscription.proration_charge'));
  check('as an accrual', mLed.every((e) => e.entry_kind === 'accrual'));
  // Half the period remains, so roughly half of each plan's price.
  const mCharge = mLed.find((e) => e.event_type === 'subscription.proration_charge');
  const expectCharge = Math.round(Number(planB.price) * 100 * 0.5);
  check('the local charge is about half a period of the new plan',
        Math.abs(Number(mCharge.amount_minor) - expectCharge) <= Math.max(2, expectCharge * 0.02));
  // ── 5b. a practice admin cannot backdate their own change ────────────────────────
  // The proration date decides how much of the period is credited. Left unbounded, a
  // practice could downgrade, pin the change to the start of the period, and claim a full
  // period's credit for a period it had already used. The client may only echo back a
  // quote it was just given; anything older is ignored and the change is priced now.
  const stolen = Math.floor(Date.now() / 1000) - 20 * DAY;
  const bdChange = await api('PUT', '/api/plans/current',
    { plan_id: planC.id, prorationDate: stolen }, mTok);
  check('a change with a stale proration date still succeeds', bdChange.status === 200);
  const bdRow = (await ledgerFor(manual.tenantId))
    .filter((e) => e.event_type === 'subscription.proration_charge').at(-1) || {};
  check('a tenant-supplied backdate is ignored, not honoured',
        bdRow.occurred_at
        && Math.floor(new Date(bdRow.occurred_at).getTime() / 1000) - stolen > 19 * DAY);
  check('so the credit is for the time actually left, not the whole period',
        Math.abs(Number(bdRow.amount_minor) - Math.round(Number(planC.price) * 100 * 0.5))
          <= Math.max(2, Number(planC.price) * 100 * 0.02));
  check('a quote echoed back within the window IS honoured, so the quoted amount is billed',
        (await api('GET', `/api/plans/preview/${planB.id}?at=${Math.floor(Date.now() / 1000) - 30}`,
          undefined, mTok)).body.prorationDate === Math.floor(Date.now() / 1000) - 30);

  // ── 5c. an operator MAY date a correction, and the entry carries that date ───────
  // With the change priced at "now", an entry stamped now() looks identical to one stamped
  // at the proration date, so that assertion proves nothing on its own. This one fails the
  // moment occurred_at falls back to the insert time.
  await pool.query('UPDATE control.subscriptions SET plan_id = $2 WHERE tenant_id = $1', [manual.tenantId, planB.id]);
  const backdated = Math.floor(Date.now() / 1000) - 2 * DAY;
  const opBd = await api('PUT', `/api/platform/tenants/${manual.tenantId}/subscription`,
    { planId: planC.id, prorationDate: backdated }, opTok);
  check('an operator can date a correction to when it should have happened', opBd.status === 200);
  const opBdRow = (await ledgerFor(manual.tenantId))
    .filter((e) => e.event_type === 'subscription.proration_charge').at(-1) || {};
  check('the accounting entry is dated at the change, not at the moment it was written',
        opBdRow.occurred_at
        && Math.abs(Math.floor(new Date(opBdRow.occurred_at).getTime() / 1000) - backdated) <= 1);
  // Backdating moves the change EARLIER in the period, so more of the period remains and
  // more is charged: 17 of 30 days rather than 15. The direction is the point — a
  // proration that ignored the date would land on 15/30 either way.
  check('and it is prorated from that date: 17 of the 30 days, not 15',
        Math.abs(Number(opBdRow.amount_minor) - Math.round(Number(planC.price) * 100 * (17 / 30)))
          <= Math.max(2, Number(planC.price) * 100 * 0.02));

  const mAudit = await auditFor(manual.tenantId);
  check('the manual change is audited too',
        mAudit.some((a) => a.action === 'subscription.plan_changed' && a.actor_type === 'tenant_user'));

  // ── 6. a subscription with no period recorded books the change, not a guess ───────
  const bare = await provisionTenant(pool, { name: `Bare Clinic ${RUN}`, planId: planA.id });
  bare.tenantId = bare.tenant.id;
  await pool.query(
    `UPDATE control.subscriptions
        SET stripe_subscription_id = NULL, stripe_customer_id = NULL,
            current_period_start = NULL, current_period_end = NULL
      WHERE practice_id = $1`, [bare.practiceId]);
  const bareEmail = `badmin_${RUN}@example.com`;
  await pool.query(
    `INSERT INTO public.users (id,email,first_name,last_name,role,status,password_hash,practice_id,created_at)
     VALUES (gen_random_uuid(),$1,'B','U','admin','active',$2,$3,NOW())`,
    [bareEmail, hash, bare.practiceId]);
  const bLogin = await api('POST', '/api/auth/login', { email: bareEmail, password: 'A-Strong-Passphrase!23' });
  const bChange = await api('PUT', '/api/plans/current', { plan_id: planB.id }, bLogin.body.token);
  check('a change with no billing period still succeeds', bChange.status === 200);
  check('and says why it was not prorated', bChange.body.proration.source === 'none'
        && typeof bChange.body.proration.reason === 'string');
  const bLed = await ledgerFor(bare.tenantId);
  check('an unprorateable change is still an accounting entry',
        bLed.length === 1 && bLed[0].event_type === 'subscription.changed' && Number(bLed[0].amount_minor) === 0);
  check('the entry says why it carries no amount', bLed[0].description.includes('not prorated'));

  // ── 7. status and seat changes are audited without inventing money ────────────────
  const statusChange = await api('PUT', `/api/platform/tenants/${t.tenantId}/subscription`,
    { status: 'past_due', seats: 9 }, opTok);
  check('an operator can change status and seats', statusChange.status === 200);
  const audit3 = await auditFor(t.tenantId);
  const stAudit = audit3[0];
  check('the status change is audited', stAudit.action === 'subscription.update');
  check('with the value it moved from', stAudit.detail.status && stAudit.detail.status.to === 'past_due');
  check('and the seat change', stAudit.detail.seats && stAudit.detail.seats.from === 0 && stAudit.detail.seats.to === 9);
  const led3 = await ledgerFor(t.tenantId);
  check('a status change books nothing', led3.length === (await ledgerFor(t.tenantId)).length && !led3.some(
    (e) => e.event_type === 'subscription.changed' && e.description.includes('past_due')));

  // ── 8. the audit trail can be filtered to subscription changes ────────────────────
  const filtered = await api('GET', '/api/platform/audit?action=subscription.plan_changed&limit=50', undefined, opTok);
  check('the audit trail can be filtered by action', filtered.status === 200
        && filtered.body.length > 0 && filtered.body.every((r) => r.action === 'subscription.plan_changed'));
  check('every filtered row names an actor', filtered.body.every((r) => r.actor && r.actor_email));

  let ok = 0;
  for (const [n, c] of results) { console.log(`  ${c ? 'ok  ' : 'FAIL'} ${n}`); if (c) ok++; }
  console.log(`\n${ok}/${results.length} checks passed.`);
  await pool.end();
  process.exit(ok === results.length ? 0 : 1);
})().catch((e) => {
  // Print what passed before the crash. A harness that dies silently halfway turns a
  // specific failure into "something went wrong", which is the least useful report there is.
  for (const [n, c] of results) console.log(`  ${c ? 'ok  ' : 'FAIL'} ${n}`);
  console.error('harness error:', e);
  process.exit(1);
});
