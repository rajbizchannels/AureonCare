// End-to-end checks for self-serve signup, staff invites, and tenant binding.
//
// Stripe is stubbed at the module boundary (require.cache) rather than mocked inside the
// route, so the real signup route, the real webhook handler and the real provisioning
// service all run. What is faked is only the network call to Stripe.
//
// Needs a Postgres with the full migration chain applied. See run.sh.

const path = require('path');
const assert = require('assert');
const crypto = require('crypto');

const BACKEND = path.join(__dirname, '..', '..');
let pass = 0;
const results = [];
function check(name, cond) {
  results.push([name, !!cond]);
  if (cond) pass++;
}

// ── Stub Stripe before anything requires it ──────────────────────────────────
const billingPath = require.resolve(path.join(BACKEND, 'services/platformBilling.js'));
const created = [];
require.cache[billingPath] = {
  id: billingPath, filename: billingPath, loaded: true,
  exports: {
    isConfigured: () => true,
    async createSubscriptionCheckout(opts) {
      if (opts.promoCode && opts.promoCode !== 'GOOD10') {
        const e = new Error('That promotion code is not valid.'); e.statusCode = 400; throw e;
      }
      const session = {
        id: 'cs_test_' + crypto.randomBytes(8).toString('hex'),
        url: 'https://checkout.stripe.test/pay',
        client_reference_id: opts.clientReferenceId,
        customer: 'cus_test_' + crypto.randomBytes(4).toString('hex'),
        subscription: 'sub_test_' + crypto.randomBytes(4).toString('hex'),
      };
      created.push(session);
      return session;
    },
    async describePromotionCode(code) {
      return code === 'GOOD10' ? { code: 'GOOD10', percentOff: 10 } : null;
    },
    findPromotionCode: async () => null,
    retrieveCheckoutSession: async () => null,
  },
};

// Social token validation: pretend the provider verified this identity.
const validatorPath = require.resolve(path.join(BACKEND, 'utils/socialTokenValidator.js'));
let VERIFIED = null;
require.cache[validatorPath] = {
  id: validatorPath, filename: validatorPath, loaded: true,
  exports: {
    validateSocialToken: async () => {
      if (!VERIFIED) throw new Error('no identity configured');
      return VERIFIED;
    },
  },
};

const pool = require(path.join(BACKEND, 'db.js'));
const { provisionTenant } = require(path.join(BACKEND, 'services/tenantProvisioning.js'));

process.env.PORT = process.env.TEST_PORT || '4733';
process.env.NODE_ENV = 'development';
process.env.AC_COOKIE_INSECURE = 'true';
process.env.AC_JWT_S = process.env.AC_JWT_S || crypto.randomBytes(48).toString('base64');
const BASE = `http://127.0.0.1:${process.env.PORT}`;

require(path.join(BACKEND, 'server.js'));

const api = async (method, url, body, headers = {}) => {
  const res = await fetch(BASE + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* empty body */ }
  return { status: res.status, body: json };
};

/** Post a webhook event with a valid signature, as Stripe would. */
async function postWebhook(secret, event) {
  const raw = JSON.stringify(event);
  const t = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac('sha256', secret).update(`${t}.${raw}`, 'utf8').digest('hex');
  const res = await fetch(BASE + '/api/stripe-webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Stripe-Signature': `t=${t},v1=${sig}` },
    body: raw,
  });
  return res.status;
}

(async () => {
  // Give the server a moment to bind.
  for (let i = 0; i < 40; i++) {
    try { await fetch(BASE + '/health'); break; } catch { await new Promise((r) => setTimeout(r, 250)); }
  }

  console.log('\nSelf-serve signup, invites and tenant binding\n');

  // A self-serve plan mapped to a Stripe price.
  await pool.query(
    `INSERT INTO public.subscription_plans (name, display_name, price, billing_cycle, is_active, self_serve, stripe_price_id, trial_days)
     VALUES ('test-pro','Test Pro',49,'monthly',true,true,'price_test_pro',0)
     ON CONFLICT DO NOTHING`
  );
  // Look the plan up by NAME and (re)assert its price id: sibling suites rewrite
  // stripe_price_id across all plans, and these tests share a database.
  await pool.query(
    "UPDATE public.subscription_plans SET stripe_price_id='price_test_pro', self_serve=true, is_active=true WHERE name='test-pro'"
  );
  const { rows: planRows } = await pool.query(
    "SELECT id FROM public.subscription_plans WHERE name = 'test-pro'"
  );
  const planId = planRows[0].id;

  // ── 1. Signup ──────────────────────────────────────────────────────────────
  const email = `owner_${crypto.randomBytes(4).toString('hex')}@example.com`;
  const signup = await api('POST', '/api/signup', {
    practiceName: 'Northside Clinic', email, password: 'A-Strong-Passphrase!23',
    firstName: 'Ada', lastName: 'Lovelace', planId, country: 'US', timezone: 'America/New_York',
  });
  check('signup returns a checkout URL', signup.status === 201 && !!signup.body.checkoutUrl);
  const intentId = signup.body.intentId;

  const weak = await api('POST', '/api/signup', {
    practiceName: 'X', email: `w_${email}`, password: 'short', planId,
  });
  check('signup rejects a weak password', weak.status === 400);

  const dupIntent = await api('POST', '/api/signup', {
    practiceName: 'Northside Again', email, password: 'A-Strong-Passphrase!23', planId,
  });
  check('re-signup supersedes the pending intent', dupIntent.status === 201);

  const badPromo = await api('POST', '/api/signup', {
    practiceName: 'Y', email: `p_${email}`, password: 'A-Strong-Passphrase!23', planId, promoCode: 'NOPE',
  });
  check('invalid coupon is rejected with a message', badPromo.status === 400);

  const goodPromo = await api('GET', '/api/signup/promo/GOOD10');
  check('valid coupon previews its discount', goodPromo.status === 200 && goodPromo.body.percentOff === 10);

  const preStatus = await api('GET', `/api/signup/${intentId}/status`);
  check('status is pending before payment', preStatus.body && preStatus.body.ready === false);

  const beforeUser = await pool.query('SELECT 1 FROM public.users WHERE LOWER(email)=$1', [email]);
  check('no user exists before payment', beforeUser.rows.length === 0);

  // ── 2. Webhook provisions the tenant ───────────────────────────────────────
  const secret = 'whsec_test_' + crypto.randomBytes(8).toString('hex');
  process.env.AC_STRIPE_WHS = secret;
  const latest = created[created.length - 1]; // the superseding intent's session
  const session = { ...latest, client_reference_id: dupIntent.body.intentId };

  const whStatus = await postWebhook(secret, {
    id: 'evt_1', type: 'checkout.session.completed', data: { object: session },
  });
  check('webhook accepted with a valid signature', whStatus === 200);

  // The handler runs after the response; poll for completion.
  let intent = null;
  for (let i = 0; i < 40; i++) {
    const { rows } = await pool.query('SELECT * FROM control.signup_intents WHERE id=$1', [dupIntent.body.intentId]);
    intent = rows[0];
    if (intent && intent.status !== 'pending' && intent.status !== 'provisioning') break;
    await new Promise((r) => setTimeout(r, 250));
  }
  check('signup marked completed', intent && intent.status === 'completed');
  check('signup linked to a tenant', intent && !!intent.tenant_id);

  const { rows: tRows } = await pool.query('SELECT * FROM control.tenants WHERE id=$1', [intent.tenant_id]);
  const tenant = tRows[0];
  check('tenant row created', !!tenant);

  const { rows: schemaTables } = await pool.query(
    'SELECT count(*)::int c FROM information_schema.tables WHERE table_schema=$1', [tenant.schema_name]
  );
  check('tenant schema provisioned with tables', schemaTables[0].c > 50);

  const { rows: subRows } = await pool.query('SELECT * FROM control.subscriptions WHERE tenant_id=$1', [tenant.id]);
  check('subscription row created (no fail-open)', subRows.length === 1);
  check('subscription carries the Stripe customer', !!subRows[0] && !!subRows[0].stripe_customer_id);
  check('subscription carries the chosen plan', !!subRows[0] && subRows[0].plan_id === planId);

  const { rows: adminRows } = await pool.query(
    'SELECT id, role, practice_id, password_hash FROM public.users WHERE LOWER(email)=$1', [email]
  );
  check('admin user created', adminRows.length === 1);
  check('admin bound to the practice', adminRows[0] && adminRows[0].practice_id === tenant.practice_id);
  check('admin has role admin', adminRows[0] && adminRows[0].role === 'admin');

  const login = await api('POST', '/api/auth/login', { email, password: 'A-Strong-Passphrase!23' });
  check('the new owner can sign in', login.status === 200 && !!login.body.token);

  // Replay: Stripe retries deliveries.
  await postWebhook(secret, { id: 'evt_1', type: 'checkout.session.completed', data: { object: session } });
  await new Promise((r) => setTimeout(r, 800));
  const { rows: dupTenants } = await pool.query(
    'SELECT count(*)::int c FROM control.tenants WHERE practice_id=$1', [tenant.practice_id]
  );
  check('replayed webhook does not provision twice', dupTenants[0].c === 1);

  // ── 3. Staff invites ───────────────────────────────────────────────────────
  const authHdr = { Authorization: `Bearer ${login.body.token}` };
  const inviteeEmail = `nurse_${crypto.randomBytes(4).toString('hex')}@example.com`;
  const inv = await api('POST', '/api/invites', { email: inviteeEmail, role: 'staff' }, authHdr);
  check('admin can create an invite', inv.status === 201 && !!inv.body.inviteUrl);
  const token = new URL(inv.body.inviteUrl).searchParams.get('token');

  const lookup = await api('GET', `/api/invites/lookup/${token}`);
  check('invite lookup shows the practice', lookup.status === 200 && lookup.body.practiceName === 'Northside Again');

  const accepted = await api('POST', '/api/invites/accept', {
    token, password: 'Another-Strong-Pass!45', firstName: 'Grace', lastName: 'Hopper',
  });
  check('invite accepted with a password', accepted.status === 201);

  const { rows: nurse } = await pool.query(
    'SELECT practice_id, role FROM public.users WHERE LOWER(email)=$1', [inviteeEmail]
  );
  check('invited staff bound to the practice', nurse[0] && nurse[0].practice_id === tenant.practice_id);

  const reuse = await api('POST', '/api/invites/accept', { token, password: 'Yet-Another-Pass!678' });
  check('invite cannot be redeemed twice', reuse.status === 404 || reuse.status === 409);

  // ── 4. OAuth signup binds via invite ───────────────────────────────────────
  const oauthEmail = `dr_${crypto.randomBytes(4).toString('hex')}@example.com`;
  const inv2 = await api('POST', '/api/invites', { email: oauthEmail, role: 'doctor' }, authHdr);
  const token2 = new URL(inv2.body.inviteUrl).searchParams.get('token');

  VERIFIED = { email: oauthEmail, emailVerified: true, providerId: 'goog-' + crypto.randomBytes(4).toString('hex'),
               firstName: 'Alan', lastName: 'Turing' };
  const social = await api('POST', '/api/auth/social-login', {
    provider: 'google', accessToken: 'fake', inviteToken: token2,
  });
  check('OAuth signup with an invite succeeds', social.status === 200 || social.status === 201);
  const { rows: drRows } = await pool.query(
    'SELECT practice_id, role FROM public.users WHERE LOWER(email)=$1', [oauthEmail]
  );
  check('OAuth user is BOUND to the practice', drRows[0] && drRows[0].practice_id === tenant.practice_id);
  check('OAuth user took the invited role', drRows[0] && drRows[0].role === 'doctor');

  // The security property: an invite must not bind a DIFFERENT verified identity.
  const inv3 = await api('POST', '/api/invites', { email: `intended_${crypto.randomBytes(3).toString('hex')}@example.com` }, authHdr);
  const token3 = new URL(inv3.body.inviteUrl).searchParams.get('token');
  const attackerEmail = `attacker_${crypto.randomBytes(4).toString('hex')}@example.com`;
  VERIFIED = { email: attackerEmail, emailVerified: true, providerId: 'goog-' + crypto.randomBytes(4).toString('hex'),
               firstName: 'Mal', lastName: 'Ory' };
  await api('POST', '/api/auth/social-login', { provider: 'google', accessToken: 'fake', inviteToken: token3 });
  const { rows: attacker } = await pool.query(
    'SELECT practice_id FROM public.users WHERE LOWER(email)=$1', [attackerEmail]
  );
  check("someone else's invite does not bind an unrelated account",
        attacker.length === 0 || attacker[0].practice_id === null);

  // An unverified email must not redeem an invite either.
  const inv4 = await api('POST', '/api/invites', { email: `unver_${crypto.randomBytes(3).toString('hex')}@example.com` }, authHdr);
  const token4 = new URL(inv4.body.inviteUrl).searchParams.get('token');
  const unverEmail = JSON.parse(JSON.stringify(inv4.body.email));
  VERIFIED = { email: unverEmail, emailVerified: false, providerId: 'goog-' + crypto.randomBytes(4).toString('hex') };
  await api('POST', '/api/auth/social-login', { provider: 'google', accessToken: 'fake', inviteToken: token4 });
  const { rows: unver } = await pool.query(
    'SELECT practice_id FROM public.users WHERE LOWER(email)=$1', [unverEmail]
  );
  check('an unverified provider email cannot redeem an invite',
        unver.length === 0 || unver[0].practice_id === null);

  // ── 5. Portal social login finds the right tenant ──────────────────────────
  const other = await provisionTenant(pool, { name: 'Southside Clinic ' + crypto.randomBytes(3).toString('hex') });
  const patientId = crypto.randomUUID();
  const patientEmail = `pt_${crypto.randomBytes(4).toString('hex')}@example.com`;
  // patients.id = users.id in this schema, and social_auth.user_id FKs to users.
  await pool.query(
    `INSERT INTO public.users (id, email, first_name, last_name, role, status, created_at)
     VALUES ($1, $2, 'Rosalind', 'Franklin', 'patient', 'active', NOW())`,
    [patientId, patientEmail]
  );
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query(`SET LOCAL search_path TO ${other.tenant.schema_name}, public, control`);
    await c.query(
      `INSERT INTO patients (id, first_name, last_name, mrn, date_of_birth, email, status, portal_enabled)
       VALUES ($1,'Rosalind','Franklin',$2,'1970-01-01',$3,'active',true)`,
      [patientId, 'MRN-T' + crypto.randomBytes(3).toString('hex'), patientEmail]
    );
    await c.query('COMMIT');
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { c.release(); }
  const provId = 'goog-pt-' + crypto.randomBytes(4).toString('hex');
  await pool.query(
    `INSERT INTO public.social_auth (user_id, patient_id, provider, provider_user_id)
     VALUES ($1,$1,'google',$2)`, [patientId, provId]
  );

  VERIFIED = { email: patientEmail, emailVerified: true, providerId: provId };
  const portal = await api('POST', '/api/patient-portal/login', { provider: 'google', accessToken: 'fake' });
  check('portal social login succeeds for a non-default tenant', portal.status === 200);
  const { rows: routed } = await pool.query(
    `SELECT control.resolve_portal_session(encode(digest($1,'sha256'),'hex')) AS tid`,
    [portal.body && portal.body.sessionToken ? portal.body.sessionToken : '']
  ).catch(() => ({ rows: [{}] }));
  check('portal session routed to the patient\'s OWN tenant',
        routed[0] && routed[0].tid === other.tenant.id);

  // ── Report ────────────────────────────────────────────────────────────────
  for (const [name, ok] of results) console.log(`  ${ok ? 'ok ' : 'FAIL'} ${name}`);
  console.log(`\n${pass}/${results.length} checks passed.`);
  await pool.end();
  process.exit(pass === results.length ? 0 : 1);
})().catch((err) => {
  console.error('\nTest harness error:', err);
  process.exit(1);
});
