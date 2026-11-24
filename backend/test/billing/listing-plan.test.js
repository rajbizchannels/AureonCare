// The free Listing plan (migration 109, middleware/listingGate.js).
//
// Proves: signup offers it (free, no trial); it is created only after the email link, active with
// no end date and no sample data; the practice reaches its public page, booking requests, booking
// setup and its appointments (read only), and nothing else (402 with what to do); it cannot switch
// to a paid plan for free; it starts ONE free trial, after which everything opens; a practice whose
// trial ended can drop back to Listing for free but cannot start another trial.

const path = require('path');
const crypto = require('crypto');

const BACKEND = path.join(__dirname, '..', '..');
process.env.PORT = process.env.TEST_PORT || '4888';
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
const { invalidateEntitlements } = require(path.join(BACKEND, 'services/entitlements.js'));
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
  const { rows: [listingPlan] } = await pool.query("SELECT id FROM public.subscription_plans WHERE name = 'listing'");
  const { rows: [paid] } = await pool.query(
    `INSERT INTO public.subscription_plans (name, display_name, price, currency, billing_cycle, trial_days, is_active, self_serve, max_users, max_providers, max_patients, features)
     VALUES ($1, 'Paid Pro', 79, 'eur', 'monthly', 14, true, false, -1, -1, -1, '{"ehr": true}') RETURNING id`, [`paid_${RUN}`]);

  // ── signup ──────────────────────────────────────────────────────────────────────
  const plans = (await call('GET', '/api/signup/plans')).body;
  const listed = Array.isArray(plans) && plans.find((p) => p.id === listingPlan.id);
  check('signup offers the free Listing plan', listed && listed.can_list === true && Number(listed.price) === 0 && listed.can_trial === false);
  const email = `listing_${RUN}@aureon-qa.net`;
  const req = await call('POST', '/api/signup/trial', null, { practiceName: `Listing ${RUN}`, email, password: PW, firstName: 'Lee', planId: listingPlan.id });
  check(`a listing request is accepted (got ${req.status})`, req.status === 202 && req.body.listing === true);
  check('...nothing is created until the email is confirmed', (await pool.query('SELECT 1 FROM public.users WHERE email = $1', [email])).rowCount === 0);
  const mail = outbox.find((m) => m.to === email);
  check('...the email says listing, not trial', mail && /list your practice/i.test(mail.subject));
  const link = mail && (/href="([^"]+trial\/verify\?t=[^"]+)"/.exec(mail.html) || [])[1];
  const v = await call('GET', new URL(link).pathname + new URL(link).search);
  check(`confirming creates the listing (got ${v.status} ${v.location})`, v.status === 303 && /listing=ready/.test(v.location || ''));
  const sub = (await pool.query(
    `SELECT s.*, t.schema_name FROM control.subscriptions s JOIN control.tenants t ON t.id = s.tenant_id
       JOIN public.users u ON u.practice_id = s.practice_id WHERE u.email = $1`, [email])).rows[0];
  check('...on Listing, active, with no end date', sub && sub.plan_id === listingPlan.id && sub.status === 'active' && !sub.trial_end && !sub.current_period_end);
  check('...and no sample data', (await pool.query(`SELECT count(*)::int AS n FROM ${sub.schema_name}.patients`)).rows[0].n === 0);
  const token = (await call('POST', '/api/auth/login', null, { email, password: PW })).body.token;
  check('the practice signs in', Boolean(token));

  // ── what the plan reaches ───────────────────────────────────────────────────────
  for (const [m, url] of [['GET', '/api/practice-profile'], ['GET', '/api/booking-requests'], ['GET', '/api/appointments'],
    ['GET', '/api/plans/current'], ['GET', '/api/locations'], ['GET', '/api/notification-settings'], ['GET', '/api/appointment-types']]) {
    const r = await call(m, url, token);
    check(`allowed: ${m} ${url} (got ${r.status})`, r.status !== 402);
  }
  for (const [m, url, body] of [['GET', '/api/patients'], ['POST', '/api/appointments', {}], ['GET', '/api/inventory/items'], ['GET', '/api/claims'],
    ['GET', '/api/import/sample-data'], ['POST', '/api/users', { email: `x_${RUN}@aureon-qa.net`, role: 'receptionist' }], ['GET', '/api/reports/financial']]) {
    const r = await call(m, url, token, body);
    check(`refused with what to do: ${m} ${url} (got ${r.status})`, r.status === 402 && r.body && r.body.error === 'ListingPlan' && /free trial/.test(r.body.message || ''));
  }

  // ── moving up ───────────────────────────────────────────────────────────────────
  const free = await call('PUT', '/api/plans/current', token, { plan_id: paid.id });
  check(`no free switch from Listing to a paid plan (got ${free.status})`, free.status === 402);
  const trial = await call('POST', '/api/plans/start-trial', token, { plan_id: paid.id });
  check(`Listing starts a free trial (got ${trial.status})`, trial.status === 200 && trial.body.status === 'trialing');
  check('...then the rest of AureonCare opens', (await call('GET', '/api/patients', token)).status === 200);
  check('a second trial is refused (no longer on Listing)', (await call('POST', '/api/plans/start-trial', token, { plan_id: paid.id })).status === 409);

  // ── back down after the trial ───────────────────────────────────────────────────
  await pool.query("UPDATE control.subscriptions SET trial_end = now() - interval '1 day' WHERE tenant_id = $1", [sub.tenant_id]);
  invalidateEntitlements(sub.practice_id);
  const back = await call('PUT', '/api/plans/current', token, { plan_id: listingPlan.id });
  const after = (await pool.query('SELECT plan_id, status, trial_end FROM control.subscriptions WHERE tenant_id = $1', [sub.tenant_id])).rows[0];
  check(`a practice whose trial ended can drop back to Listing for free (got ${back.status})`, back.status === 200 && after.plan_id === listingPlan.id && after.status === 'active');
  check('...the listing works again, and the trial is remembered', (await call('GET', '/api/booking-requests', token)).status === 200 && after.trial_end !== null);
  check('...so it cannot start another free trial', (await call('POST', '/api/plans/start-trial', token, { plan_id: paid.id })).status === 409);

  report();
})().catch(report);
