// SEC-37: vendor integrations (Surescripts, Labcorp, Optum) are per practice.
//
// The vendor runtime was one process-wide singleton reading settings through the shared
// pool, where the table no longer exists — so it never initialised and every "send to
// vendor" path was dead — and had it been pointed at a tenant, one practice's credentials
// would have served every practice. These checks build two practices with different
// Labcorp credentials and prove each request only ever sees its own.

const path = require('path');
const crypto = require('crypto');

const BACKEND = path.join(__dirname, '..', '..');
process.env.PORT = process.env.TEST_PORT || '4883';
process.env.NODE_ENV = 'development';
process.env.AC_JWT_S = process.env.AC_JWT_S || crypto.randomBytes(48).toString('base64');
process.env.AC_TK_S = process.env.AC_TK_S || process.env.AC_JWT_S;
process.env.AC_PW_BREACH_CHECK = 'false';
const BASE = `http://127.0.0.1:${process.env.PORT}`;

const pool = require(path.join(BACKEND, 'db.js'));
const bcrypt = require(path.join(BACKEND, '..', 'node_modules', 'bcryptjs'));
const { provisionTenant } = require(path.join(BACKEND, 'services/tenantProvisioning.js'));
const { makeTenantDb } = require(path.join(BACKEND, 'db/requestTenantDb.js'));
const { vendorsFor, _clientCache } = require(path.join(BACKEND, 'services/vendorIntegrations'));
require(path.join(BACKEND, 'server.js'));

const results = [];
const check = (n, c) => results.push([n, !!c]);
const call = async (method, url, token, body) => {
  const r = await fetch(BASE + url, { method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text(); let b = null; try { b = JSON.parse(t); } catch { b = t; }
  return { status: r.status, body: b, text: t };
};
const report = (err) => {
  let failed = 0;
  for (const [n, c] of results) { console.log(`  ${c ? 'ok  ' : 'FAIL'} ${n}`); if (!c) failed += 1; }
  if (err) { console.error(`\nSTOPPED: ${err.message || err}`); console.error(err); }
  else console.log(`\n${results.length - failed}/${results.length} checks passed.`);
  process.exit(err || failed ? 1 : 0);
};
// A request as the vendor runtime sees it: a tenant and that tenant's db handle.
const fakeReq = (schema) => ({ tenant: { schemaName: schema }, db: makeTenantDb(pool, schema) });

(async () => {
  for (let i = 0; i < 40; i++) { try { await fetch(BASE + '/health'); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  const RUN = crypto.randomBytes(4).toString('hex');
  const practice = async (label) => {
    const t = await provisionTenant(pool, { name: `${label} ${RUN}` });
    const mk = async (role) => {
      const email = `${role}_${label.toLowerCase()}_${RUN}@example.com`;
      const { rows: [u] } = await pool.query(`INSERT INTO public.users (id,email,first_name,last_name,role,status,password_hash,practice_id,created_at)
        VALUES (gen_random_uuid(),$1,'A',$2,$3,'active',$4,$5,NOW()) RETURNING id`,
        [email, label, role, await bcrypt.hash('A-Strong-Passphrase!23', 12), t.practiceId]);
      const r = await call('POST', '/api/auth/login', null, { email, password: 'A-Strong-Passphrase!23' });
      return { id: u.id, token: r.body.token };
    };
    return { schema: t.tenant.schema_name, admin: await mk('admin'), patient: await mk('patient') };
  };
  const A = await practice('Alpha'); const B = await practice('Beta');
  check('two practices, each with an admin', A.admin.token && B.admin.token);

  // Each practice stores DIFFERENT Labcorp credentials, through the real API, and enables it.
  for (const [P, id] of [[A, 'alpha-client-' + RUN], [B, 'beta-client-' + RUN]]) {
    const s = await call('POST', '/api/vendor-integration-settings/labcorp', P.admin.token,
      { client_id: id, client_secret: id + '-secret', sandbox_mode: true });
    const t = await call('PATCH', '/api/vendor-integration-settings/labcorp/toggle', P.admin.token, { is_enabled: true });
    check(`${P === A ? 'Alpha' : 'Beta'} saves and enables Labcorp (${s.status}/${t.status})`, s.status === 200 && t.status === 200);
  }

  // ── 1. each practice gets its own client ──────────────────────────────────────
  const va = await vendorsFor(fakeReq(A.schema));
  const vb = await vendorsFor(fakeReq(B.schema));
  check('Labcorp is enabled for Alpha', va.isVendorEnabled('labcorp'));
  check('Labcorp is enabled for Beta', vb.isVendorEnabled('labcorp'));
  const ca = va.getLabcorp(); const cb = vb.getLabcorp();
  check("ALPHA'S CLIENT CARRIES ALPHA'S CREDENTIALS", ca.clientId === 'alpha-client-' + RUN);
  check("BETA'S CLIENT CARRIES BETA'S CREDENTIALS", cb.clientId === 'beta-client-' + RUN);
  check('the two practices never share a client object', ca !== cb);
  check('vendors not configured for a practice are off', !va.isVendorEnabled('optum') && !va.isVendorEnabled('surescripts'));

  // ── 2. the client (and its OAuth token cache) is reused until the settings change ──
  const ca2 = (await vendorsFor(fakeReq(A.schema))).getLabcorp();
  check('an unchanged practice reuses its client across requests (keeps its token cache)', ca2 === ca);
  await call('POST', '/api/vendor-integration-settings/labcorp', A.admin.token, { client_id: 'alpha-rotated-' + RUN });
  const ca3 = (await vendorsFor(fakeReq(A.schema))).getLabcorp();
  check('a saved change is used on the very next request — no reload step', ca3.clientId === 'alpha-rotated-' + RUN && ca3 !== ca);
  check("...and Beta's client is untouched by Alpha's change", (await vendorsFor(fakeReq(B.schema))).getLabcorp() === cb);

  // ── 3. the switch means off ───────────────────────────────────────────────────
  await call('PATCH', '/api/vendor-integration-settings/labcorp/toggle', B.admin.token, { is_enabled: false });
  const vb2 = await vendorsFor(fakeReq(B.schema));
  check('A VENDOR SWITCHED OFF IS OFF, EVEN WITH CREDENTIALS STORED', !vb2.isVendorEnabled('labcorp'));
  let threw = false; try { vb2.getLabcorp(); } catch { threw = true; }
  check('...and asking for its client is refused', threw);
  check('the admin connection test can still reach a disabled vendor\'s client', Boolean(vb2.clientForTest('labcorp')));
  check("Alpha is unaffected by Beta switching off", (await vendorsFor(fakeReq(A.schema))).isVendorEnabled('labcorp'));

  // ── 4. no practice context, no vendors ─────────────────────────────────────────
  const none = await vendorsFor({});
  check('a request with no practice gets no vendor at all (never a guess)', !none.isVendorEnabled('labcorp'));
  check('...nor does the shared public schema', !(await vendorsFor({ tenant: { schemaName: 'public' }, db: pool })).isVendorEnabled('labcorp'));
  check('the client cache is keyed by practice', [..._clientCache.keys()].every((k) => k.startsWith('tenant_') && k.includes(':')));

  // ── 5. statuses over HTTP are per practice ────────────────────────────────────
  const sa = await call('GET', '/api/vendor-integration-settings/status/all', A.admin.token);
  const sb = await call('GET', '/api/vendor-integration-settings/status/all', B.admin.token);
  check('status endpoint: Labcorp on for Alpha, off for Beta',
    sa.body && sa.body.labcorp && sa.body.labcorp.enabled === true && sb.body && sb.body.labcorp && sb.body.labcorp.enabled === false);

  // ── 6. a real lab order goes through Alpha's Labcorp and is logged in Alpha ────
  const pid = crypto.randomUUID();
  await pool.query(`INSERT INTO ${A.schema}.patients (id, first_name, last_name, status, mrn, date_of_birth)
    VALUES ($1,'Lab','Patient','Active',$2,'1980-01-01')`, [pid, `MRN-${RUN}`]);
  await pool.query(`INSERT INTO public.providers (id, first_name, last_name, specialization, email)
    VALUES ($1,'A','Alpha','General',$2) ON CONFLICT (id) DO NOTHING`, [A.admin.id, `prov_${RUN}@example.com`]);
  const order = await call('POST', '/api/lab-orders', A.admin.token, {
    patient_id: pid, provider_id: A.admin.id, order_type: 'lab', priority: 'routine',
    test_codes: ['80053'], diagnosis_codes: ['Z00.00'], send_to_vendor: true,
  });
  check(`a lab order with send_to_vendor is created (got ${order.status})`, order.status === 201 || order.status === 200);
  const logA = await pool.query(`SELECT status FROM ${A.schema}.vendor_transaction_log WHERE vendor_type='labcorp' AND transaction_type='lab_order_submit'`);
  const logB = await pool.query(`SELECT 1 FROM ${B.schema}.vendor_transaction_log`);
  // The sandbox has no route to Labcorp, so the submit fails — what matters is that the
  // route reached Alpha's client and recorded the attempt in Alpha's own log.
  check('THE ORDER REACHED THE VENDOR STEP AND WAS LOGGED IN ALPHA\'S SCHEMA', logA.rowCount >= 1);
  check("...and nothing landed in Beta's log", logB.rowCount === 0);

  // ── 7. transaction history: per practice, staff only ──────────────────────────
  const REF = crypto.randomUUID();   // internal_reference_id is a uuid column
  await (await vendorsFor(fakeReq(A.schema))).logTransaction('labcorp', 'probe', { internalReferenceId: REF, status: 'completed' });
  const histA = await call('GET', `/api/vendor-integration-settings/transactions/${REF}`, A.admin.token);
  const histB = await call('GET', `/api/vendor-integration-settings/transactions/${REF}`, B.admin.token);
  const histP = await call('GET', `/api/vendor-integration-settings/transactions/${REF}`, A.patient.token);
  check('Alpha staff see Alpha\'s vendor transactions', Array.isArray(histA.body) && histA.body.length === 1);
  check("Beta staff cannot see Alpha's", Array.isArray(histB.body) && histB.body.length === 0);
  check('A PATIENT CANNOT READ VENDOR TRANSACTION PAYLOADS (403)', histP.status === 403);

  report();
})().catch(report);
