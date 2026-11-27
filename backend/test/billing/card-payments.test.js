// Billing per practice (migration 110) and card payments through Stripe Connect.
//
// Proves: invoices, payments and their numbers live in each practice's own schema — a practice
// that is not the default one invoices its own patients, and never sees another's invoices; a
// practice connects its OWN Stripe account (Standard, onboarding link), and only once Stripe has
// enabled charges can it make a pay link; the link is a Checkout Session created ON the
// practice's account (direct charge), for the balance, naming only the invoice number, with the
// optional platform fee; a new link expires the old one; the Connect webhook (own secret) records
// the payment once, marks the invoice paid, and ignores an event from an account that is not the
// practice's; the patient portal lists the patient's own invoices and starts a payment, for its
// own invoices only.

const path = require('path');
const crypto = require('crypto');
const Module = require('module');

const BACKEND = path.join(__dirname, '..', '..');
process.env.PORT = process.env.TEST_PORT || '4889';
process.env.NODE_ENV = 'development';
process.env.AC_JWT_S = process.env.AC_JWT_S || crypto.randomBytes(48).toString('base64');
process.env.AC_TK_S = process.env.AC_TK_S || process.env.AC_JWT_S;
process.env.AC_PW_BREACH_CHECK = 'false';
process.env.FRONTEND_URL = 'https://app.example.test';
process.env.AC_STRIPE_SK = 'sk_test_connect_stub';
process.env.AC_STRIPE_CONNECT_WHS = 'whsec_connect_test';
process.env.AC_CONNECT_FEE_BPS = '100';
const BASE = `http://127.0.0.1:${process.env.PORT}`;

const calls = [];
const accounts = {};
const origRequire = Module.prototype.require;
Module.prototype.require = function (id) {
  if (id === 'stripe') {
    return function StripeStub() {
      return {
        accounts: {
          create: async (p) => { const id = 'acct_' + crypto.randomBytes(5).toString('hex'); accounts[id] = { id, charges_enabled: false, payouts_enabled: false, details_submitted: false }; calls.push(['accounts.create', p]); return accounts[id]; },
          retrieve: async (id) => { calls.push(['accounts.retrieve', id]); return accounts[id]; },
        },
        accountLinks: { create: async (p) => { calls.push(['accountLinks.create', p]); return { url: `https://connect.stripe.example/setup/${p.account}` }; } },
        checkout: {
          sessions: {
            create: async (p, o) => { const id = 'cs_' + crypto.randomBytes(6).toString('hex'); calls.push(['checkout.create', p, o]); return { id, url: `https://checkout.stripe.example/${id}` }; },
            expire: async (id, p, o) => { calls.push(['checkout.expire', id, o]); return { id, status: 'expired' }; },
          },
        },
      };
    };
  }
  return origRequire.apply(this, arguments);
};

const pool = require(path.join(BACKEND, 'db.js'));
const bcrypt = require(path.join(BACKEND, '..', 'node_modules', 'bcryptjs'));
const { provisionTenant } = require(path.join(BACKEND, 'services/tenantProvisioning.js'));
require(path.join(BACKEND, 'server.js'));

const results = [];
const check = (n, c) => results.push([n, !!c]);
const call = async (method, url, token, body, headers = {}) => {
  const r = await fetch(BASE + url, { method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...headers },
    body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) });
  const t = await r.text(); let b = null; try { b = JSON.parse(t); } catch { b = t; }
  return { status: r.status, body: b };
};
const hook = (event, secret = 'whsec_connect_test') => {
  const raw = JSON.stringify(event);
  const t = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex');
  return call('POST', '/api/stripe-connect-webhook', null, raw, { 'Stripe-Signature': `t=${t},v1=${sig}` });
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
  const mkPractice = async (label) => {
    const t = await provisionTenant(pool, { name: `${label} ${RUN}` });
    await pool.query("UPDATE public.practices SET currency = 'eur', country = 'IE' WHERE id::text = $1", [t.practiceId]);
    const email = `admin_${label.toLowerCase()}_${RUN}@example.com`;
    const { rows: [u] } = await pool.query(`INSERT INTO public.users (id,email,first_name,last_name,role,status,password_hash,practice_id,created_at)
      VALUES (gen_random_uuid(),$1,'Ada','Admin','admin','active',$2,$3,NOW()) RETURNING id`, [email, await bcrypt.hash(PW, 12), t.practiceId]);
    const token = (await call('POST', '/api/auth/login', null, { email, password: PW })).body.token;
    const patient = crypto.randomUUID();
    await pool.query(`INSERT INTO ${t.tenant.schema_name}.patients (id, first_name, last_name, mrn, date_of_birth, email) VALUES ($1,'Pat',$2,$3,'1980-01-01',$4)`,
      [patient, label, `MRN-${label}-${RUN}`, `pat_${label.toLowerCase()}_${RUN}@example.com`]);
    return { ...t, schema: t.tenant.schema_name, adminId: u.id, token, patient };
  };
  const A = await mkPractice('Alpha');
  const B = await mkPractice('Beta');

  // ── billing lives in each practice ──────────────────────────────────────────────
  const invA = await call('POST', '/api/billing/invoices', A.token, { patientId: A.patient, status: 'draft', subtotal: 120, totalAmount: 120, items: [{ description: 'Consultation', quantity: 1, unitPrice: 120, total: 120 }] });
  check(`a (non-default) practice invoices its own patient (got ${invA.status} ${JSON.stringify(invA.body).slice(0, 80)})`, invA.status === 201 && invA.body.patientName === 'Pat Alpha');
  const invB = await call('POST', '/api/billing/invoices', B.token, { patientId: B.patient, status: 'sent', subtotal: 80, totalAmount: 80 });
  check('...and so does another practice', invB.status === 201);
  check('...each in its own schema, numbered from 1 in each', /-000001$/.test(invA.body.invoiceNumber) && /-000001$/.test(invB.body.invoiceNumber)
    && (await pool.query(`SELECT count(*)::int n FROM ${A.schema}.billing_invoices`)).rows[0].n === 1);
  const listA = (await call('GET', '/api/billing/invoices', A.token)).body;
  check("a practice lists only its own invoices", Array.isArray(listA) && listA.length === 1 && listA[0].id === invA.body.id);
  check("...and cannot open another's", (await call('GET', `/api/billing/invoices/${invB.body.id}`, A.token)).status === 404);
  check('...nor invoice a patient of another practice', (await call('POST', '/api/billing/invoices', A.token, { patientId: B.patient, totalAmount: 5 })).status >= 400);
  const payB = await call('POST', '/api/billing/payments', B.token, { invoiceId: invB.body.id, patientId: B.patient, amount: 30, paymentMethod: 'cash' });
  check(`a recorded payment updates the invoice (got ${payB.status})`, payB.status === 201
    && (await pool.query(`SELECT status, balance_due FROM ${B.schema}.billing_invoices WHERE id = $1`, [invB.body.id])).rows[0].status === 'partially_paid');
  check('...and is not visible to the other practice', (await call('GET', '/api/billing/payments', A.token)).body.length === 0);

  // ── connecting Stripe ───────────────────────────────────────────────────────────
  const st0 = (await call('GET', '/api/card-payments', A.token)).body;
  check('card payments start off, not connected', st0.connected === false && st0.ready === false && st0.platformConfigured === true);
  const early = await call('POST', `/api/billing/invoices/${invA.body.id}/pay-link`, A.token);
  check(`no pay link before Stripe is connected (got ${early.status})`, early.status === 409 && early.body.code === 'not_connected');
  const con = await call('POST', '/api/card-payments/connect', A.token);
  const created = calls.find((c) => c[0] === 'accounts.create');
  check(`connect makes a Standard account for the practice and returns Stripe's onboarding page (got ${con.status})`,
    con.status === 200 && /connect\.stripe\.example/.test(con.body.url) && created && created[1].type === 'standard'
    && created[1].metadata.practice_id === String(A.practiceId) && created[1].country === 'IE');
  const link = calls.find((c) => c[0] === 'accountLinks.create');
  check('...returning to the Card payments screen', link && link[1].type === 'account_onboarding' && /card_payments=1/.test(link[1].return_url));
  await call('POST', '/api/card-payments/connect', A.token);
  check('connecting again re-uses the same account', calls.filter((c) => c[0] === 'accounts.create').length === 1);
  const acct = con.body.accountId;
  check('a non-admin cannot change it', (await call('POST', '/api/card-payments/connect', null)).status === 401);
  const notReady = await call('POST', `/api/billing/invoices/${invA.body.id}/pay-link`, A.token);
  check('no pay link until Stripe enables charges', notReady.status === 409 && notReady.body.code === 'not_ready');
  accounts[acct].charges_enabled = true; accounts[acct].payouts_enabled = true; accounts[acct].details_submitted = true;
  const upd = await hook({ id: 'evt_1', type: 'account.updated', account: acct, data: { object: accounts[acct] } });
  check(`account.updated (Connect webhook) records that the practice can take payments (got ${upd.status})`, upd.status === 200
    && (await call('GET', '/api/card-payments', A.token)).body.ready === true);
  check('a webhook with a wrong signature is refused', (await hook({ type: 'account.updated', account: acct, data: { object: {} } }, 'whsec_wrong')).status === 400);

  // ── pay links ───────────────────────────────────────────────────────────────────
  check('a draft invoice cannot be paid yet', (await call('POST', `/api/billing/invoices/${invA.body.id}/pay-link`, A.token)).status === 409);
  await pool.query(`UPDATE ${A.schema}.billing_invoices SET status = 'sent' WHERE id = $1`, [invA.body.id]);
  const pl = await call('POST', `/api/billing/invoices/${invA.body.id}/pay-link`, A.token);
  const cs = calls.filter((c) => c[0] === 'checkout.create').pop();
  check(`a pay link is made (got ${pl.status})`, pl.status === 200 && /checkout\.stripe\.example/.test(pl.body.url) && pl.body.amount === 120 && pl.body.currency === 'eur');
  check("...as a DIRECT charge on the practice's own account", cs && cs[2] && cs[2].stripeAccount === acct && cs[1].mode === 'payment');
  check('...for the balance, naming only the invoice number', cs[1].line_items[0].price_data.unit_amount === 12000
    && cs[1].line_items[0].price_data.product_data.name === `Invoice ${invA.body.invoiceNumber}` && !/Consultation/.test(JSON.stringify(cs[1])));
  check('...with the platform fee (1%) and the invoice in its metadata', cs[1].payment_intent_data.application_fee_amount === 120
    && cs[1].metadata.invoice_id === invA.body.id && cs[1].metadata.practice_id === String(A.practiceId));
  const firstSession = (await pool.query(`SELECT pay_link_session_id FROM ${A.schema}.billing_invoices WHERE id = $1`, [invA.body.id])).rows[0].pay_link_session_id;
  await call('POST', `/api/billing/invoices/${invA.body.id}/pay-link`, A.token);
  check('a new link expires the previous one (no paying twice)', calls.some((c) => c[0] === 'checkout.expire' && c[1] === firstSession && c[2].stripeAccount === acct));
  const session = (await pool.query(`SELECT pay_link_session_id FROM ${A.schema}.billing_invoices WHERE id = $1`, [invA.body.id])).rows[0].pay_link_session_id;
  check('the other practice cannot make a link for this invoice', (await call('POST', `/api/billing/invoices/${invA.body.id}/pay-link`, B.token)).status >= 404);

  // ── the payment arrives ─────────────────────────────────────────────────────────
  const paid = (account, id = session) => ({ id: 'evt_' + crypto.randomBytes(4).toString('hex'), type: 'checkout.session.completed', account,
    data: { object: { id, object: 'checkout.session', payment_status: 'paid', amount_total: 12000, currency: 'eur', payment_intent: 'pi_123',
      metadata: { aureoncare_kind: 'invoice', practice_id: String(A.practiceId), invoice_id: invA.body.id } } } });
  const forged = await hook(paid('acct_someone_else', 'cs_forged'));
  check("an event from an account that is not the practice's is ignored", forged.status === 200 && forged.body.recorded === false
    && (await pool.query(`SELECT count(*)::int n FROM ${A.schema}.billing_payments`)).rows[0].n === 0);
  const ok = await hook(paid(acct));
  const inv = (await pool.query(`SELECT * FROM ${A.schema}.billing_invoices WHERE id = $1`, [invA.body.id])).rows[0];
  check(`the payment is recorded on the invoice (got ${ok.status} ${JSON.stringify(ok.body)})`, ok.body.recorded === true
    && inv.status === 'paid' && Number(inv.amount_paid) === 120 && Number(inv.balance_due) === 0 && inv.pay_link_url === null);
  const pay = (await pool.query(`SELECT * FROM ${A.schema}.billing_payments WHERE invoice_id = $1`, [invA.body.id])).rows[0];
  check('...as a card payment carrying the Stripe ids', pay && pay.payment_method === 'credit_card' && pay.stripe_payment_intent_id === 'pi_123' && pay.stripe_checkout_session_id === session);
  const again = await hook(paid(acct));
  check('...once, however often Stripe sends it', again.body.recorded === false
    && (await pool.query(`SELECT count(*)::int n FROM ${A.schema}.billing_payments`)).rows[0].n === 1);
  check('a paid invoice gets no new link', (await call('POST', `/api/billing/invoices/${invA.body.id}/pay-link`, A.token)).status === 409);

  // ── patient portal ──────────────────────────────────────────────────────────────
  const inv2 = await call('POST', '/api/billing/invoices', A.token, { patientId: A.patient, status: 'sent', totalAmount: 45.5 });
  await call('POST', '/api/billing/invoices', A.token, { patientId: A.patient, status: 'draft', totalAmount: 9 });
  const other = crypto.randomUUID();
  await pool.query(`INSERT INTO ${A.schema}.patients (id, first_name, last_name, mrn, date_of_birth) VALUES ($1,'Oth','Er',$2,'1970-01-01')`, [other, `MRN-O-${RUN}`]);
  const invOther = await call('POST', '/api/billing/invoices', A.token, { patientId: other, status: 'sent', totalAmount: 10 });
  const raw = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  await pool.query(`INSERT INTO ${A.schema}.patient_portal_sessions (patient_id, session_token, expires_at) VALUES ($1, $2, now() + interval '1 hour')`, [A.patient, hash]);
  await pool.query('SELECT control.register_portal_session($1, $2, now() + interval \'1 hour\')', [hash, A.tenant.id]);
  const mine = await call('GET', `/api/patient-portal/${A.patient}/invoices`, raw);
  check(`the portal lists the patient's own sent invoices and offers card payment (got ${mine.status})`, mine.status === 200 && mine.body.cardPayments === true
    && mine.body.invoices.length === 2 && mine.body.invoices.every((i) => i.status !== 'draft') && mine.body.invoices.some((i) => i.id === inv2.body.id));
  const portalPay = await call('POST', `/api/patient-portal/${A.patient}/invoices/${inv2.body.id}/pay`, raw);
  const pcs = calls.filter((c) => c[0] === 'checkout.create').pop();
  check(`...and the patient pays from the portal (got ${portalPay.status})`, portalPay.status === 200 && /checkout\.stripe\.example/.test(portalPay.body.url)
    && pcs[1].line_items[0].price_data.unit_amount === 4550 && pcs[1].customer_email === `pat_alpha_${RUN}@example.com` && /from=portal/.test(pcs[1].success_url));
  check("...but not another patient's invoice", (await call('POST', `/api/patient-portal/${A.patient}/invoices/${invOther.body.id}/pay`, raw)).status === 404);

  // ── disconnecting ───────────────────────────────────────────────────────────────
  const off = await call('DELETE', '/api/card-payments', A.token);
  check('disconnecting stops new pay links', off.status === 200 && off.body.connected === false
    && (await call('POST', `/api/billing/invoices/${inv2.body.id}/pay-link`, A.token)).status === 409);
  check("...and the portal stops offering card payment", (await call('GET', `/api/patient-portal/${A.patient}/invoices`, raw)).body.cardPayments === false);

  report();
})().catch(report);
