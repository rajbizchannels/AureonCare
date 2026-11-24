// Self-serve free trial (no card), sample data, trial expiry, in-app subscribe, plan prices.
//
// Proves: the signup page lists trial plans with their currency; a trial request creates
// NOTHING until the emailed link is clicked; the link works once; the workspace starts
// 'trialing' with an end date and sample data in every kind; an admin can remove the sample
// data (and only it); after the end date the workspace is read-only with a clear message;
// subscribing in-app needs a Stripe price; plan prices come from the platform catalogue.

const path = require('path');
const crypto = require('crypto');

const BACKEND = path.join(__dirname, '..', '..');
process.env.PORT = process.env.TEST_PORT || '4885';
process.env.NODE_ENV = 'development';
process.env.AC_JWT_S = process.env.AC_JWT_S || crypto.randomBytes(48).toString('base64');
process.env.AC_TK_S = process.env.AC_TK_S || process.env.AC_JWT_S;
process.env.AC_PW_BREACH_CHECK = 'false';
process.env.FRONTEND_URL = 'https://app.example.test';
const BASE = `http://127.0.0.1:${process.env.PORT}`;

const outbox = [];
const notify = require(path.join(BACKEND, 'services/notificationService.js'));
notify.sendEmail = async (to, subject, html) => { outbox.push({ to, subject, html }); return { sent: true }; };

const pool = require(path.join(BACKEND, 'db.js'));
require(path.join(BACKEND, 'server.js'));

const results = [];
const check = (n, c) => results.push([n, !!c]);
const call = async (method, url, token, body) => {
  const r = await fetch(BASE + url, { method, redirect: 'manual',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text(); let b = null; try { b = JSON.parse(t); } catch { b = t; }
  return { status: r.status, body: b, location: r.headers.get('location') };
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
  // A trial plan of our own, so the test does not depend on the catalogue's current state.
  const { rows: [plan] } = await pool.query(
    `INSERT INTO public.subscription_plans (name, display_name, price, currency, billing_cycle, trial_days, is_active, self_serve, max_users, max_providers, max_patients, features)
     VALUES ($1, 'Trial Pro', 79, 'eur', 'monthly', 14, true, false, -1, -1, -1, '{}') RETURNING id`, [`trial_pro_${RUN}`]);

  // A GBP variant of the same tier (migration 107): the EUR plan above stays the tier's default.
  const { rows: [gbp] } = await pool.query(
    `INSERT INTO public.subscription_plans (name, display_name, price, currency, billing_cycle, trial_days, is_active, self_serve, max_users, max_providers, max_patients, features, tier)
     VALUES ($1, 'Trial Pro', 69, 'gbp', 'monthly', 14, true, false, -1, -1, -1, '{}', $2) RETURNING id, is_tier_default`, [`trial_pro_gbp_${RUN}`, `trial_pro_${RUN}`]);
  check('a second currency variant is not the default', gbp.is_tier_default === false);
  const inTier = (list) => (Array.isArray(list) ? list.filter((p) => p.tier === `trial_pro_${RUN}`) : []);
  const gb = inTier((await call('GET', '/api/signup/plans?country=GB')).body);
  check('signup in the UK: the GBP variant, and only one plan for the tier', gb.length === 1 && gb[0].id === gbp.id && gb[0].currency === 'gbp');
  const es = inTier((await call('GET', '/api/signup/plans?country=es')).body);
  check('signup in Spain: the EUR variant', es.length === 1 && es[0].id === plan.id);
  const jp = inTier((await call('GET', '/api/signup/plans?country=JP')).body);
  check('signup where the tier has no variant in that currency: the default (EUR)', jp.length === 1 && jp[0].id === plan.id);
  const usd = inTier((await call('GET', '/api/signup/plans?currency=GBP')).body);
  check('?currency= works too', usd.length === 1 && usd[0].id === gbp.id);
  const { pickForCurrency } = require(path.join(BACKEND, 'services/planCatalog.js'));
  const picked = pickForCurrency([{ id: 1, tier: 't', currency: 'eur', is_tier_default: true, price: 79 }, { id: 2, tier: 't', currency: 'gbp', is_tier_default: false, price: 69 }], 'gbp', { keepIds: [1] });
  check("the plan a practice is already on wins over its currency's variant", picked.length === 1 && picked[0].id === 1);

  // ── the signup page ──────────────────────────────────────────────────────────────
  const plans = await call('GET', '/api/signup/plans');
  const listed = Array.isArray(plans.body) && plans.body.find((p) => p.id === plan.id);
  check('a trial plan is offered without a Stripe price', listed && listed.can_trial === true && listed.can_checkout === false);
  check('...with its currency', listed && listed.currency === 'eur' && Number(listed.price) === 79);

  // ── request: nothing created yet ─────────────────────────────────────────────────
  const email = `trial_${RUN}@example.com`;
  check('a weak password is refused', (await call('POST', '/api/signup/trial', null, { practiceName: 'X', email, password: 'short', planId: plan.id })).status === 400);
  outbox.length = 0;
  const req = await call('POST', '/api/signup/trial', null, { practiceName: `Trial Clinic ${RUN}`, email, password: PW, firstName: 'Tess', planId: plan.id, country: 'es' });
  check(`a trial request is accepted (got ${req.status})`, req.status === 202 && req.body.trialDays === 14);
  check('...nothing is created until the email is confirmed', (await pool.query('SELECT 1 FROM public.users WHERE email = $1', [email])).rowCount === 0);
  const mail = outbox.find((m) => m.to === email);
  const link = mail && (/href="([^"]+trial\/verify\?t=[^"]+)"/.exec(mail.html) || [])[1];
  check('...a confirmation link is emailed', Boolean(link));
  const intent = (await pool.query("SELECT * FROM control.signup_intents WHERE email = $1 AND kind = 'trial'", [email])).rows[0];
  check('...only a hash of the link token is stored', intent && /^[0-9a-f]{64}$/.test(intent.verify_token_hash) && !link.includes(intent.verify_token_hash));
  check('a made-up token creates nothing', /trial=expired/.test((await call('GET', '/api/signup/trial/verify?t=nope')).location || ''));

  // ── confirm → workspace ──────────────────────────────────────────────────────────
  const t0 = Date.now();
  const v = await call('GET', new URL(link).pathname + new URL(link).search);
  check(`confirming creates the workspace and sends the person to sign in (got ${v.status} ${v.location})`, v.status === 303 && /trial=ready/.test(v.location || ''));
  const sub = (await pool.query(
    `SELECT s.*, t.schema_name FROM control.subscriptions s JOIN control.tenants t ON t.id = s.tenant_id
       JOIN public.users u ON u.practice_id = s.practice_id WHERE u.email = $1`, [email])).rows[0];
  check("...on the plan, as 'trialing', ending in 14 days", sub && sub.plan_id === plan.id && sub.status === 'trialing' &&
    Math.abs(new Date(sub.trial_end) - (t0 + 14 * 86400000)) < 120000);
  check('the link works once', /trial=expired/.test((await call('GET', new URL(link).pathname + new URL(link).search)).location || ''));
  const login = await call('POST', '/api/auth/login', null, { email, password: PW });
  const token = login.body && login.body.token;
  check('the trial admin can sign in', login.status === 200 && Boolean(token));

  // ── sample data ──────────────────────────────────────────────────────────────────
  const S = sub.schema_name;
  const n = async (sql) => (await pool.query(sql.replace(/\$S/g, S))).rows[0].n;
  check('sample patients', (await n("SELECT count(*)::int AS n FROM $S.patients WHERE mrn LIKE 'SAMPLE-%'")) === 8);
  check('sample appointments, upcoming and past', (await n("SELECT count(*)::int AS n FROM $S.appointments WHERE notes = '[Sample data]' AND start_time > now()")) === 8
    && (await n("SELECT count(*)::int AS n FROM $S.appointments WHERE notes = '[Sample data]' AND start_time < now()")) === 2);
  check('sample services with prices', (await n("SELECT count(*)::int AS n FROM $S.healthcare_offerings o JOIN $S.offering_pricing p ON p.offering_id = o.id WHERE o.description LIKE '[Sample data]%'")) === 4);
  check('sample stock, suppliers and insurers', (await n("SELECT count(*)::int AS n FROM $S.inventory_items WHERE description LIKE '[Sample data]%'")) === 4
    && (await n("SELECT count(*)::int AS n FROM $S.inventory_suppliers WHERE notes = '[Sample data]'")) === 2
    && (await n("SELECT count(*)::int AS n FROM $S.insurance_payers WHERE notes = '[Sample data]'")) === 2);
  const st = await call('GET', '/api/import/sample-data', token);
  check('the admin sees that sample data is present', st.status === 200 && st.body.present === true && st.body.counts.patients === 8);

  // The practice's own records must survive removal.
  await call('POST', '/api/import/patients', token, { rows: [{ mrn: 'OWN-1', first_name: 'Own', last_name: 'Patient', date_of_birth: '1980-01-01' }] });
  await call('POST', '/api/import/services', token, { rows: [{ name: 'Own service', price: '10' }] });
  const rm = await call('DELETE', '/api/import/sample-data', token);
  check(`removing sample data (got ${rm.status} ${JSON.stringify(rm.body).slice(0, 120)})`, rm.status === 200 && rm.body.removed.patients === 8 && rm.body.removed.appointments === 10);
  check('...removes every sample record', (await call('GET', '/api/import/sample-data', token)).body.present === false);
  check("...and keeps the practice's own", (await n("SELECT count(*)::int AS n FROM $S.patients WHERE mrn = 'OWN-1'")) === 1
    && (await n("SELECT count(*)::int AS n FROM $S.healthcare_offerings WHERE name = 'Own service'")) === 1);

  // ── subscribing, and the end of the trial ────────────────────────────────────────
  const cur = await call('GET', '/api/plans/current', token);
  check('the Subscription page shows the trial', cur.status === 200 && cur.body.status === 'trialing' && cur.body.currency === 'eur');
  const co = await call('POST', '/api/plans/checkout', token, { plan_id: plan.id });
  check(`subscribing to a plan with no Stripe price is refused clearly (got ${co.status})`, [409, 503].includes(co.status));

  await pool.query("UPDATE control.subscriptions SET trial_end = now() - interval '1 day' WHERE tenant_id = $1", [sub.tenant_id]);
  require(path.join(BACKEND, 'services/entitlements.js')).invalidateEntitlements();
  const after = await call('POST', '/api/import/patients', token, { rows: [{ mrn: 'OWN-2', first_name: 'A', last_name: 'B', date_of_birth: '1980-01-01' }] });
  check(`after the trial ends the workspace is read-only (got ${after.status})`, after.status === 402 && /free trial has ended/.test(after.body.message || ''));
  check('...reading still works', (await call('GET', '/api/patients', token)).status === 200);
  check('...and the Subscription page says the trial ended', (await call('GET', '/api/plans/current', token)).body.status === 'trial_expired');

  // ── in the app: the clinic's currency ───────────────────────────────────────────────
  const inApp = async () => inTier((await call('GET', '/api/plans', token)).body);
  check('the trial practice was created in its plan\'s currency (EUR)',
    (await pool.query('SELECT currency FROM public.practices WHERE id = $1', [sub.practice_id])).rows[0].currency === 'EUR');
  check('in the app: the plan it is on', (await inApp()).map((p) => p.id).join() === String(plan.id));
  await pool.query("UPDATE public.practices SET currency = 'GBP' WHERE id = $1", [sub.practice_id]);
  await pool.query('UPDATE control.subscriptions SET plan_id = NULL WHERE practice_id = $1', [sub.practice_id]);
  check('a clinic set to GBP is shown the GBP variant', (await inApp()).map((p) => p.id).join() === String(gbp.id));
  await pool.query("UPDATE public.practices SET currency = 'JPY' WHERE id = $1", [sub.practice_id]);
  check('a clinic in a currency with no variant is shown the default', (await inApp()).map((p) => p.id).join() === String(plan.id));
  await pool.query('UPDATE control.subscriptions SET plan_id = $2 WHERE practice_id = $1', [sub.practice_id, plan.id]);

  // ── duplicates ───────────────────────────────────────────────────────────────────
  check('a second trial with the same email is refused', (await call('POST', '/api/signup/trial', null, { practiceName: 'Again', email, password: PW, planId: plan.id })).status === 409);
  check('a plan without trial days offers no trial', (await call('POST', '/api/signup/trial', null, { practiceName: 'Y', email: `y_${RUN}@example.com`, password: PW, planId: 999999 })).status === 400);

  report();
})().catch(report);
