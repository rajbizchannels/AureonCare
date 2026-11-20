// Finding which practice a patient belongs to, when they sign in socially.
//
// THE BUG. `patients` lives in a per-tenant schema, so a social login has to work out
// which schema holds the person before it can read them. The search ended in
// allActiveTenants, which was capped at 100 and ordered OLDEST FIRST. On a deployment with
// more than a hundred practices, a patient at the 101st was never probed: every candidate
// missed, and the handler then read `.email` off the undefined patient — a TypeError,
// answered as a 500. So social sign-in was broken for everyone at a newer practice, in a
// way that looked like a server fault rather than a routing miss.
//
// WHY IT WENT UNNOTICED. The suite that covers portal social login creates a fresh tenant
// and signs in as a patient there. That passes on a database with few practices and fails
// on one with more than a hundred — so it looked like flaky test data rather than a real
// defect. The checks below construct the condition instead of depending on it, so they
// mean the same thing on any database.

const path = require('path');
const crypto = require('crypto');

const BACKEND = path.join(__dirname, '..', '..');
process.env.PORT = process.env.TEST_PORT || '4899';
process.env.NODE_ENV = 'development';
process.env.AC_JWT_S = process.env.AC_JWT_S || crypto.randomBytes(48).toString('base64');
process.env.AC_TK_S = process.env.AC_TK_S || crypto.randomBytes(48).toString('base64');

// Pretend the provider verified this identity, the way flow.test.js does.
const validatorPath = require.resolve(path.join(BACKEND, 'utils/socialTokenValidator.js'));
let VERIFIED = null;
require.cache[validatorPath] = {
  id: validatorPath, filename: validatorPath, loaded: true,
  exports: { validateSocialToken: async () => {
    if (!VERIFIED) throw new Error('no identity configured');
    return VERIFIED;
  } },
};

const pool = require(path.join(BACKEND, 'db.js'));
const { provisionTenant } = require(path.join(BACKEND, 'services/tenantProvisioning.js'));
const routing = require(path.join(BACKEND, 'services/portalRouting.js'));
require(path.join(BACKEND, 'server.js'));

const BASE = `http://127.0.0.1:${process.env.PORT}`;
const api = async (method, url, body) => {
  const r = await fetch(BASE + url, {
    method, headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  let parsed = null; try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { status: r.status, body: parsed };
};

const results = [];
const check = (n, c) => results.push([n, !!c]);
const report = (err) => {
  let failed = 0;
  for (const [n, c] of results) { console.log(`  ${c ? 'ok  ' : 'FAIL'} ${n}`); if (!c) failed += 1; }
  if (err) {
    console.log(`\n${results.length - failed}/${results.length} passed before the suite stopped early.`);
    console.error(`\nSTOPPED: ${err.message || err}`);
    console.error(err);
  } else {
    console.log(`\n${results.length - failed}/${results.length} checks passed.`);
  }
  process.exit(err || failed ? 1 : 0);
};

(async () => {
  const RUN = crypto.randomBytes(4).toString('hex');

  const { rows: [{ n: activeCount }] } = await pool.query(
    "SELECT count(*)::int AS n FROM control.tenants WHERE status='active' AND schema_name IS NOT NULL");

  // ── the cap itself ─────────────────────────────────────────────────────────────────
  const capped = await routing.allActiveTenants(pool, 2);
  check('a caller that asks for a sample gets one', capped.length === Math.min(2, activeCount));

  const all = await routing.allActiveTenants(pool, null);
  check('a caller that asks for ALL active tenants gets all of them', all.length === activeCount);
  // The property that matters: the answer must not depend on how many practices exist.
  check('...which is more than the old fixed cap when there are more than 100',
    activeCount <= 100 || all.length > 100);

  // ── a brand-new tenant is reachable ────────────────────────────────────────────────
  // Newest, so it sorts last under "oldest first" — exactly the row the cap used to drop.
  const fresh = await provisionTenant(pool, { name: `Routing Clinic ${RUN}` });
  const freshId = fresh.tenant.id;

  const order = await routing.searchOrderForPatient(pool, `nobody_${RUN}@example.com`);
  check('THE NEWEST PRACTICE IS IN THE SEARCH ORDER',
    order.some((t) => t.tenantId === freshId));
  check('the search order has no duplicates',
    new Set(order.map((t) => t.tenantId)).size === order.length);

  // ── the direct lookup, which skips the search entirely ─────────────────────────────
  const userId = crypto.randomUUID();
  await pool.query(
    `INSERT INTO public.users (id,email,first_name,last_name,role,status,practice_id,created_at)
     VALUES ($1,$2,'Rosalind','Franklin','patient','active',$3,NOW())`,
    [userId, `rt_${RUN}@example.com`, fresh.practiceId]);

  const direct = await routing.tenantForUser(pool, userId);
  check('a patient whose user row knows its practice is resolved directly',
    direct && direct.tenantId === freshId);
  check('and that answer comes FIRST, before any searching',
    (await routing.searchOrderForPatient(pool, null, userId))[0].tenantId === freshId);

  check('an unknown user resolves to nothing rather than guessing',
    (await routing.tenantForUser(pool, crypto.randomUUID())) === null);
  check('a missing user id is handled', (await routing.tenantForUser(pool, null)) === null);

  // A patient with no practice_id on their user row — the case the direct lookup cannot
  // answer, and the reason the exhaustive search still has to be exhaustive.
  const orphanId = crypto.randomUUID();
  await pool.query(
    `INSERT INTO public.users (id,email,first_name,last_name,role,status,created_at)
     VALUES ($1,$2,'No','Practice','patient','active',NOW())`,
    [orphanId, `orph_${RUN}@example.com`]);
  check('a user with no practice falls through to the search, not to an error',
    (await routing.tenantForUser(pool, orphanId)) === null);
  const orphanOrder = await routing.searchOrderForPatient(pool, `orph_${RUN}@example.com`, orphanId);
  check('and the search still reaches the newest practice for them',
    orphanOrder.some((t) => t.tenantId === freshId));

  // ── a social link that no tenant can place ─────────────────────────────────────────
  // This used to be a 500. The handler fell through with `patient` still undefined and
  // read `.email` off it — a TypeError. A login that cannot be placed is a 404: the
  // difference is what tells an administrator whether to look at the account or at the
  // server.
  for (let i = 0; i < 40; i++) {
    try { await fetch(BASE + '/health'); break; } catch { await new Promise((r) => setTimeout(r, 250)); }
  }
  const ghostId = crypto.randomUUID();
  const ghostProv = `goog-ghost-${RUN}`;
  await pool.query(
    `INSERT INTO public.users (id,email,first_name,last_name,role,status,created_at)
     VALUES ($1,$2,'Ghost','Patient','patient','active',NOW())`,
    [ghostId, `ghost_${RUN}@example.com`]);
  // A link, but no portal-enabled patient row in any schema.
  await pool.query(
    `INSERT INTO public.social_auth (user_id, patient_id, provider, provider_user_id)
     VALUES ($1,$1,'google',$2)`, [ghostId, ghostProv]);

  VERIFIED = { email: `ghost_${RUN}@example.com`, emailVerified: true, providerId: ghostProv };
  const unplaceable = await api('POST', '/api/patient-portal/login', { provider: 'google', accessToken: 'fake' });
  check('AN UNPLACEABLE SOCIAL LOGIN IS A 404, NOT A 500', unplaceable.status === 404);
  check('and says what is wrong rather than leaking a stack',
    typeof (unplaceable.body || {}).error === 'string'
    && !JSON.stringify(unplaceable.body).includes('TypeError'));

  await pool.query('DELETE FROM public.social_auth WHERE user_id = $1', [ghostId]);
  await pool.query('DELETE FROM public.users WHERE id = ANY($1::uuid[])', [[userId, orphanId, ghostId]]);
  report();
})().catch(report);
