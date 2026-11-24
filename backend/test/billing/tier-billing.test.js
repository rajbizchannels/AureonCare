// Tier billing (migration 108): providers and locations included per plan, extras bought per unit,
// caps per tier, hosted storage — enforced, billed through Stripe (stubbed), and kept in step.
//
// Proves: the provider and location limits are included + extra, never above the cap; adding a
// provider or location past the limit is refused with what to do; extras can be bought and
// removed (never below what is in use, never above the cap, never on a tier that sells none);
// for a Stripe-billed practice the Stripe quantities change first and a Stripe failure changes
// nothing; Stripe-side changes are recorded; a smaller plan is refused while it would not fit and
// extras carry over within its room; the platform pushes add-on prices tagged as add-ons; hosted
// storage is capped; staff and patients are unlimited.

const path = require('path');
const crypto = require('crypto');
const Module = require('module');

const BACKEND = path.join(__dirname, '..', '..');
const stripeCalls = [];
let failNextUpdate = false;
const subItems = { data: [{ id: 'si_base', price: { id: 'price_base', metadata: {} }, quantity: 1 }] };
const origRequire = Module.prototype.require;
Module.prototype.require = function (id) {
  if (id === 'stripe') {
    return function StripeStub() {
      return {
        subscriptions: {
          retrieve: async (i) => ({ id: i, customer: 'cus_t', status: 'active', items: subItems }),
          update: async (i, p) => {
            stripeCalls.push(['subscriptions.update', p]);
            if (failNextUpdate) { failNextUpdate = false; const e = new Error('Your card was declined.'); e.type = 'StripeCardError'; throw e; }
            return { id: i, ...p };
          },
        },
        products: { create: async (p) => { stripeCalls.push(['products.create', p]); return { id: 'prod_' + require('crypto').randomBytes(6).toString('hex') }; }, update: async (i) => ({ id: i }) },
        prices: {
          create: async (p) => { stripeCalls.push(['prices.create', p]); return { id: 'price_' + require('crypto').randomBytes(6).toString('hex') }; },
          update: async (i, p) => { stripeCalls.push(['prices.update', { id: i, ...p }]); return { id: i }; },
          retrieve: async (i) => ({ id: i, product: 'prod_prev' }),
        },
        invoices: { createPreview: async () => ({ amount_due: 0, currency: 'eur', lines: { data: [] } }) },
        checkout: { sessions: { create: async (p) => { stripeCalls.push(['checkout', p]); return { id: 'cs_1', url: 'https://stripe.example/cs_1' }; } } },
      };
    };
  }
  return origRequire.apply(this, arguments);
};

process.env.PORT = process.env.TEST_PORT || '4887';
process.env.NODE_ENV = 'development';
process.env.AC_STRIPE_SK = 'sk_test_stub';
process.env.AC_JWT_S = process.env.AC_JWT_S || crypto.randomBytes(48).toString('base64');
process.env.AC_TK_S = process.env.AC_TK_S || process.env.AC_JWT_S;
process.env.AC_PLAT_S = process.env.AC_PLAT_S || crypto.randomBytes(48).toString('base64');
process.env.AC_PW_BREACH_CHECK = 'false';
const BASE = `http://127.0.0.1:${process.env.PORT}`;

const pool = require(path.join(BACKEND, 'db.js'));
const bcrypt = require(path.join(BACKEND, '..', 'node_modules', 'bcryptjs'));
const { provisionTenant } = require(path.join(BACKEND, 'services/tenantProvisioning.js'));
const { invalidateEntitlements } = require(path.join(BACKEND, 'services/entitlements.js'));
require(path.join(BACKEND, 'server.js'));

const results = [];
const check = (n, c) => results.push([n, !!c]);
const call = async (method, url, token, body) => {
  const r = await fetch(BASE + url, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
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
  const plan = async (key, price, inc, max, extra, incL, maxL, extraL, gb) => (await pool.query(
    `INSERT INTO public.subscription_plans (name, display_name, price, currency, billing_cycle, is_active, max_users, max_patients, features,
       included_providers, max_providers, extra_provider_price, included_locations, max_locations, extra_location_price, storage_gb)
     VALUES ($1, $1, $2, 'eur', 'monthly', true, -1, -1, '{}', $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [`${key}_${RUN}`, price, inc, max, extra, incL, maxL, extraL, gb])).rows[0];
  // Placeholder Stripe ids are unique in the catalogue; free them from earlier runs.
  await pool.query(`UPDATE public.subscription_plans SET stripe_price_id = NULL, stripe_provider_price_id = NULL, stripe_location_price_id = NULL
     WHERE stripe_price_id IN ('price_base', 'price_ent') OR stripe_provider_price_id IN ('price_prov', 'price_eprov') OR stripe_location_price_id IN ('price_loc', 'price_eloc')`);
  const ess = await plan('ess', 49, 1, 1, null, 1, 1, null, 10);
  const pro = await plan('pro', 79, 3, 10, 25, 1, 3, 29, 50);
  const ent = await plan('ent', 119, 5, -1, 29, 3, -1, 19, 200);

  const T = await provisionTenant(pool, { name: `Tier ${RUN}`, planId: pro.id });
  const schema = (await pool.query('SELECT schema_name FROM control.tenants WHERE practice_id = $1', [T.practiceId])).rows[0].schema_name;
  const { rows: [adm] } = await pool.query(`INSERT INTO public.users (id,email,first_name,last_name,role,status,password_hash,practice_id,created_at)
    VALUES (gen_random_uuid(),$1,'Ada','Admin','admin','active',$2,$3,NOW()) RETURNING id`, [`adm_${RUN}@aureon-qa.net`, await bcrypt.hash(PW, 4), T.practiceId]);
  const token = (await call('POST', '/api/auth/login', null, { email: `adm_${RUN}@aureon-qa.net`, password: PW })).body.token;
  const addDoctor = (n) => call('POST', '/api/users', token, { firstName: 'Doc', lastName: `${n}`, email: `doc${n}_${RUN}@aureon-qa.net`, role: 'doctor', password: PW });
  const addLocation = (n) => call('POST', '/api/locations', token, { name: `Site ${n} ${RUN}`, locationType: 'clinic' });
  const usage = async () => (await call('GET', '/api/plans/usage', token)).body;

  // ── providers: included, then extra ───────────────────────────────────────────────
  for (let i = 1; i <= 3; i++) await addDoctor(i);
  const u0 = await usage();
  check(`Pro: 3 providers included, 3 in use (${JSON.stringify(u0.providers)})`, u0.providers.included === 3 && u0.providers.used === 3 && u0.providers.limit === 3 && u0.providers.price === 25);
  const fourth = await addDoctor(4);
  check(`a 4th provider is refused with what to do (got ${fourth.status})`, fourth.status === 402 && /Add an extra provider/.test(fourth.body.message || ''));
  const staff = await call('POST', '/api/users', token, { firstName: 'Rita', lastName: 'Desk', email: `desk_${RUN}@aureon-qa.net`, role: 'receptionist', password: PW });
  check('staff are unlimited (a receptionist is added at the provider limit)', staff.status === 201 || staff.status === 200);
  const buy = await call('PUT', '/api/plans/addons', token, { extraProviders: 2 });
  check(`buying 2 extra providers (not billed by Stripe: recorded) (got ${buy.status})`, buy.status === 200 && buy.body.providers.limit === 5 && buy.body.providers.extra === 2);
  check('...no Stripe call for a practice Stripe does not bill', !stripeCalls.some((c) => c[0] === 'subscriptions.update'));
  check('...and the 4th provider can now be added', [200, 201].includes((await addDoctor(4)).status));
  check('above the tier cap (3 + 8 > 10) is refused', (await call('PUT', '/api/plans/addons', token, { extraProviders: 8 })).status === 409);
  check('below what is in use (4 providers, limit would be 3) is refused', (await call('PUT', '/api/plans/addons', token, { extraProviders: 0 })).status === 409);

  // ── locations ─────────────────────────────────────────────────────────────────────
  // A new practice starts with its primary location, which is the included one.
  const startLoc = (await usage()).locations;
  const l2 = await addLocation(2);
  check(`Pro: 1 location included (the primary); another is refused (used ${startLoc.used}, got ${l2.status})`, startLoc.used === 1 && startLoc.limit === 1 && l2.status === 402 && /extra location/.test(l2.body.message || ''));
  check('buying 1 extra location', (await call('PUT', '/api/plans/addons', token, { extraLocations: 1 })).body.locations.limit === 2);
  check('...then the 2nd location is added', [200, 201].includes((await addLocation(2)).status));
  check('above the location cap (1 + 3 > 3) is refused', (await call('PUT', '/api/plans/addons', token, { extraLocations: 3 })).status === 409);

  // ── Stripe-billed practice ────────────────────────────────────────────────────────
  await pool.query("UPDATE public.subscription_plans SET stripe_price_id = 'price_base', stripe_provider_price_id = 'price_prov', stripe_location_price_id = 'price_loc' WHERE id = $1", [pro.id]);
  await pool.query("UPDATE control.subscriptions SET stripe_subscription_id = 'sub_' || $2, stripe_customer_id = 'cus_' || $2, status = 'active' WHERE practice_id = $1", [T.practiceId, RUN]);
  invalidateEntitlements(T.practiceId);
  stripeCalls.length = 0;
  const billed = await call('PUT', '/api/plans/addons', token, { extraProviders: 3 });
  const upd = stripeCalls.find((c) => c[0] === 'subscriptions.update');
  check(`a Stripe-billed practice: quantities set on the subscription, prorated (got ${billed.status})`,
    billed.status === 200 && upd && upd[1].proration_behavior === 'create_prorations'
    && upd[1].items.some((i) => i.price === 'price_prov' && i.quantity === 3) && upd[1].items.some((i) => i.price === 'price_loc' && i.quantity === 1));
  failNextUpdate = true;
  const declined = await call('PUT', '/api/plans/addons', token, { extraProviders: 4 });
  check(`a Stripe refusal changes nothing (got ${declined.status})`, declined.status >= 400 && (await usage()).providers.extra === 3);
  await require(path.join(BACKEND, 'services/planAddons.js')).syncFromStripe(pool, { id: `sub_${RUN}`, items: { data: [
    { id: 'si_base', price: { id: 'price_base', metadata: {} }, quantity: 1 },
    { id: 'si_p', price: { id: 'price_prov', metadata: { aureoncare_addon: 'provider' } }, quantity: 5 },
    { id: 'si_l', price: { id: 'price_loc', metadata: { aureoncare_addon: 'location' } }, quantity: 2 },
  ] } });
  const synced = await usage();
  check('quantities changed in Stripe are recorded (webhook)', synced.providers.extra === 5 && synced.locations.extra === 2);

  // ── changing plan ─────────────────────────────────────────────────────────────────
  const E = await provisionTenant(pool, { name: `Tier E ${RUN}`, planId: ess.id });
  await pool.query(`INSERT INTO public.users (id,email,first_name,last_name,role,status,password_hash,practice_id,created_at)
    VALUES (gen_random_uuid(),$1,'Eve','Admin','admin','active',$2,$3,NOW())`, [`eadm_${RUN}@aureon-qa.net`, await bcrypt.hash(PW, 4), E.practiceId]);
  const eTok = (await call('POST', '/api/auth/login', null, { email: `eadm_${RUN}@aureon-qa.net`, password: PW })).body.token;
  const eBuy = await call('PUT', '/api/plans/addons', eTok, { extraProviders: 1 });
  check(`Essentials sells no extra providers (got ${eBuy.status})`, eBuy.status === 409 && /larger plan/.test(eBuy.body.error || ''));
  const down = await call('PUT', '/api/plans/current', token, { plan_id: ess.id });
  check(`moving to Essentials (1 provider max) with 4 providers is refused (got ${down.status})`, down.status === 409 && /up to 1 provider/.test(down.body.error || ''));
  await pool.query("UPDATE public.subscription_plans SET stripe_price_id = 'price_ent', stripe_provider_price_id = 'price_eprov', stripe_location_price_id = 'price_eloc' WHERE id = $1", [ent.id]);
  stripeCalls.length = 0;
  const up = await call('PUT', '/api/plans/current', token, { plan_id: ent.id });
  const after = await usage();
  const swap = stripeCalls.filter((c) => c[0] === 'subscriptions.update').map((c) => c[1]);
  check(`moving to Enterprise (got ${up.status})`, up.status === 200 && after.plan.id === ent.id);
  check(`...extras carry over to its add-on prices (${JSON.stringify(after.providers)})`, after.providers.extra === 5 && after.providers.limit === 10
    && swap.some((p) => p.items.some((i) => i.price === 'price_eprov' && i.quantity === 5)));
  check('...and the base item, not an add-on, moved to the Enterprise price', swap.some((p) => p.items.some((i) => i.id === 'si_base' && i.price === 'price_ent')));

  // ── storage ───────────────────────────────────────────────────────────────────────
  const { storageRoom } = require(path.join(BACKEND, 'services/planAddons.js'));
  const { makeTenantDb } = require(path.join(BACKEND, 'db/requestTenantDb.js'));
  const db = makeTenantDb(pool, schema);
  check('storage within the plan is allowed', (await storageRoom(pool, db, T.practiceId, 1024)) === null);
  await pool.query('UPDATE public.subscription_plans SET storage_gb = 0 WHERE id = $1', [ent.id]);
  invalidateEntitlements(T.practiceId);
  check('storage beyond the plan is refused with the reason', /file storage/.test((await storageRoom(pool, db, T.practiceId, 1024)) || ''));
  const photo = await call('POST', '/api/practice-profile/photos', token, { kind: 'logo', data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' });
  check(`a profile photo upload over the storage limit is refused (got ${photo.status})`, photo.status === 402);
  db.release();

  // ── platform: add-on prices pushed to Stripe ─────────────────────────────────────
  stripeCalls.length = 0;
  const planPricing = require(path.join(BACKEND, 'services/planPricing.js'));
  await pool.query('UPDATE public.subscription_plans SET stripe_product_id = NULL, stripe_price_id = NULL, stripe_provider_price_id = NULL, stripe_location_price_id = NULL WHERE id = $1', [pro.id]);
  const pushed = await planPricing.pushPlanPrice(pool, pro.id);
  const addonPrices = stripeCalls.filter((c) => c[0] === 'prices.create' && c[1].metadata && c[1].metadata.aureoncare_addon);
  check('the platform pushes base, extra-provider and extra-location prices', pushed.plan.stripe_price_id && pushed.plan.stripe_provider_price_id && pushed.plan.stripe_location_price_id);
  check('...the add-ons tagged and priced per unit (EUR 25 / EUR 29)', addonPrices.some((c) => c[1].metadata.aureoncare_addon === 'provider' && c[1].unit_amount === 2500 && c[1].currency === 'eur')
    && addonPrices.some((c) => c[1].metadata.aureoncare_addon === 'location' && c[1].unit_amount === 2900));
  const essPushed = await planPricing.pushPlanPrice(pool, ess.id);
  check('a tier that sells no extras gets no add-on prices', essPushed.plan.stripe_price_id && !essPushed.plan.stripe_provider_price_id && !essPushed.plan.stripe_location_price_id);

  report();
})().catch(report);
