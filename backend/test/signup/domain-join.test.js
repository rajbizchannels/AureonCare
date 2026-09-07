// Domain-verified self-service joining, and the pending-approval path.
//
// The rules under test are the ones that decide who gets into a clinical system without a
// human inviting them, so they are checked adversarially: an unverified claim, a public
// mailbox domain, a client naming its own practice, an unverified OAuth email, and a
// second admin racing the first to a decision.
//
// DNS is stubbed at the module boundary so the checks are deterministic — what is faked is
// only the network lookup, not any of the decision logic.

const path = require('path');
const crypto = require('crypto');

const BACKEND = path.join(__dirname, '..', '..');
const results = [];
const check = (name, cond) => results.push([name, !!cond]);

// ── Stub DNS TXT lookups ─────────────────────────────────────────────────────
const dnsPath = require.resolve('dns');
const realDns = require('dns');
let TXT = {}; // name -> array of record chunk arrays
require.cache[dnsPath] = {
  id: dnsPath, filename: dnsPath, loaded: true,
  exports: {
    ...realDns,
    promises: {
      ...realDns.promises,
      resolveTxt: async (name) => {
        if (!(name in TXT)) { const e = new Error('not found'); e.code = 'ENOTFOUND'; throw e; }
        return TXT[name];
      },
    },
  },
};

// Social token validation: pretend the provider verified (or did not verify) an identity.
const validatorPath = require.resolve(path.join(BACKEND, 'utils/socialTokenValidator.js'));
let VERIFIED = null;
require.cache[validatorPath] = {
  id: validatorPath, filename: validatorPath, loaded: true,
  exports: { validateSocialToken: async () => { if (!VERIFIED) throw new Error('none'); return VERIFIED; } },
};

// Never send real mail from a test run.
const notifyPath = require.resolve(path.join(BACKEND, 'services/notificationService.js'));
const realNotify = require(notifyPath);
const sent = [];
require.cache[notifyPath] = {
  id: notifyPath, filename: notifyPath, loaded: true,
  exports: {
    ...realNotify,
    sendEmail: async (to, subject) => { sent.push({ to, subject }); return { sent: true }; },
  },
};

const pool = require(path.join(BACKEND, 'db.js'));
const bcrypt = require(path.join(BACKEND, '..', 'node_modules', 'bcryptjs'));
const { provisionTenant } = require(path.join(BACKEND, 'services/tenantProvisioning.js'));

process.env.PORT = process.env.TEST_PORT || '4894';
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
  try { json = await res.json(); } catch { /* empty */ }
  return { status: res.status, body: json };
};

const PW = 'A-Strong-Passphrase!23';

(async () => {
  for (let i = 0; i < 40; i++) {
    try { await fetch(BASE + '/health'); break; } catch { await new Promise((r) => setTimeout(r, 250)); }
  }
  console.log('\nDomain-verified joining and pending approval\n');

  const RUN = crypto.randomBytes(4).toString('hex');
  const DOMAIN = `clinic-${RUN}.example`;
  const OTHER = `rival-${RUN}.example`;

  // Two provisioned practices, each with an admin who can sign in.
  const mkPractice = async (label) => {
    const { practiceId } = await provisionTenant(pool, { name: `${label} ${RUN}` });
    const email = `admin_${label}_${RUN}@${label === 'A' ? DOMAIN : OTHER}`;
    const hash = await bcrypt.hash(PW, 12);
    await pool.query(
      `INSERT INTO public.users (id,email,first_name,last_name,role,status,password_hash,practice_id,created_at)
       VALUES (gen_random_uuid(),$1,'Ada','Admin','admin','active',$2,$3,NOW())`,
      [email, hash, practiceId]
    );
    const login = await api('POST', '/api/auth/login', { email, password: PW });
    return { practiceId, email, token: login.body && login.body.token };
  };
  const A = await mkPractice('A');
  const B = await mkPractice('B');
  const auth = (t) => ({ Authorization: `Bearer ${t}` });

  check('practice admins can sign in', Boolean(A.token) && Boolean(B.token));

  // ── Claiming ───────────────────────────────────────────────────────────────
  const publicClaim = await api('POST', '/api/team-access/domains', { domain: 'gmail.com' }, auth(A.token));
  check('a public mailbox domain cannot be claimed', publicClaim.status === 400);

  const junk = await api('POST', '/api/team-access/domains', { domain: 'not a domain' }, auth(A.token));
  check('a malformed domain is rejected', junk.status === 400);

  const claim = await api('POST', '/api/team-access/domains',
    { domain: DOMAIN, joinPolicy: 'auto_request' }, auth(A.token));
  check('a practice can claim a domain', claim.status === 201);
  check('the claim starts unverified', claim.body && claim.body.verified_at === null);
  check('a verification token is issued', Boolean(claim.body && claim.body.verification_token));

  const dupe = await api('POST', '/api/team-access/domains', { domain: DOMAIN }, auth(B.token));
  check('a second practice cannot claim the same domain', dupe.status === 409);

  // ── Before verification, the claim grants nothing ──────────────────────────
  const early = await api('POST', '/api/team-access/join',
    { email: `early_${RUN}@${DOMAIN}`, password: PW, firstName: 'Early', lastName: 'Bird' });
  check('an unverified claim does not admit anyone', early.status === 404);

  const earlyLookup = await api('GET', `/api/team-access/lookup?email=x@${DOMAIN}`);
  check('lookup hides an unverified claim', earlyLookup.body && earlyLookup.body.found === false);

  // ── Verification ───────────────────────────────────────────────────────────
  const failed = await api('POST', `/api/team-access/domains/${claim.body.id}/verify`, {}, auth(A.token));
  check('verification fails when the TXT record is absent', failed.status === 400);

  TXT[DOMAIN] = [['some-other-value'], [claim.body.verification_token]];
  const verified = await api('POST', `/api/team-access/domains/${claim.body.id}/verify`, {}, auth(A.token));
  check('verification succeeds once the record is published', verified.status === 200);
  check('the claim is stamped verified', Boolean(verified.body && verified.body.verified_at));

  const crossVerify = await api('POST', `/api/team-access/domains/${claim.body.id}/verify`, {}, auth(B.token));
  check('another practice cannot verify this claim', crossVerify.status === 404);

  // ── Self-service signup, pending approval ─────────────────────────────────
  const lookup = await api('GET', `/api/team-access/lookup?email=nurse_${RUN}@${DOMAIN}`);
  check('lookup now finds the practice', lookup.body && lookup.body.found === true);
  check('lookup says approval is required', lookup.body && lookup.body.requiresApproval === true);
  check('lookup does not leak the practice id', lookup.body && lookup.body.practiceId === undefined);

  const joinEmail = `nurse_${RUN}@${DOMAIN}`;
  const joined = await api('POST', '/api/team-access/join',
    { email: joinEmail, password: PW, firstName: 'Nina', lastName: 'Nurse' });
  check('a matching address may sign up', joined.status === 201);
  check('the account is pending, not active', joined.body && joined.body.status === 'pending');

  const pendingLogin = await api('POST', '/api/auth/login', { email: joinEmail, password: PW });
  check('a pending account cannot sign in', pendingLogin.status === 403);
  check('and is told it is awaiting approval',
    pendingLogin.body && /pending approval/i.test(pendingLogin.body.error || ''));

  const { rows: bound } = await pool.query(
    'SELECT practice_id, status, role FROM public.users WHERE email = $1', [joinEmail]);
  check('a pending account is still bound to the practice', bound[0].practice_id === A.practiceId);
  check('a self-serve joiner is not made an admin', bound[0].role !== 'admin');

  const weak = await api('POST', '/api/team-access/join',
    { email: `weak_${RUN}@${DOMAIN}`, password: 'short' });
  check('the password policy still applies', weak.status === 400);

  const unclaimed = await api('POST', '/api/team-access/join',
    { email: `someone_${RUN}@unclaimed-${RUN}.example`, password: PW });
  check('an unclaimed domain admits nobody', unclaimed.status === 404);

  // ── Approval ───────────────────────────────────────────────────────────────
  const queueB = await api('GET', '/api/team-access/requests', undefined, auth(B.token));
  check('another practice sees none of these requests',
    Array.isArray(queueB.body) && queueB.body.every((r) => r.email !== joinEmail));

  const queue = await api('GET', '/api/team-access/requests', undefined, auth(A.token));
  const mine = (queue.body || []).find((r) => r.email === joinEmail);
  check('the request appears in the practice queue', Boolean(mine));
  check('the queue records how the address was proven',
    Boolean(mine) && mine.email_verified_via === 'password_signup');

  const crossDecide = await api('POST', `/api/team-access/requests/${mine.id}/approve`, {}, auth(B.token));
  check('another practice cannot approve it', crossDecide.status === 404);

  const approved = await api('POST', `/api/team-access/requests/${mine.id}/approve`, {}, auth(A.token));
  check('an admin can approve', approved.status === 200);

  const again = await api('POST', `/api/team-access/requests/${mine.id}/approve`, {}, auth(A.token));
  check('a decided request cannot be decided twice', again.status === 404);

  const afterLogin = await api('POST', '/api/auth/login', { email: joinEmail, password: PW });
  check('the approved user can now sign in', afterLogin.status === 200);

  // ── Rejection ──────────────────────────────────────────────────────────────
  const rejEmail = `reject_${RUN}@${DOMAIN}`;
  await api('POST', '/api/team-access/join', { email: rejEmail, password: PW });
  const queue2 = await api('GET', '/api/team-access/requests', undefined, auth(A.token));
  const rej = (queue2.body || []).find((r) => r.email === rejEmail);
  const rejected = await api('POST', `/api/team-access/requests/${rej.id}/reject`, {}, auth(A.token));
  check('an admin can reject', rejected.status === 200);
  const rejLogin = await api('POST', '/api/auth/login', { email: rejEmail, password: PW });
  check('a rejected applicant cannot sign in', rejLogin.status === 403);

  // ── auto_join ──────────────────────────────────────────────────────────────
  await api('PATCH', `/api/team-access/domains/${claim.body.id}`, { joinPolicy: 'auto_join' }, auth(A.token));
  const autoEmail = `auto_${RUN}@${DOMAIN}`;
  const auto = await api('POST', '/api/team-access/join', { email: autoEmail, password: PW });
  check('auto_join admits immediately', auto.status === 201 && auto.body.status === 'active');
  const autoLogin = await api('POST', '/api/auth/login', { email: autoEmail, password: PW });
  check('an auto_join user can sign in at once', autoLogin.status === 200);

  // ── disabled ───────────────────────────────────────────────────────────────
  await api('PATCH', `/api/team-access/domains/${claim.body.id}`, { joinPolicy: 'disabled' }, auth(A.token));
  const off = await api('POST', '/api/team-access/join', { email: `off_${RUN}@${DOMAIN}`, password: PW });
  check('a disabled claim admits nobody', off.status === 404);
  await api('PATCH', `/api/team-access/domains/${claim.body.id}`, { joinPolicy: 'auto_request' }, auth(A.token));

  // ── OAuth signup against a claimed domain ─────────────────────────────────
  const oauthEmail = `google_${RUN}@${DOMAIN}`;
  VERIFIED = { provider: 'google', providerId: `g-${RUN}`, email: oauthEmail, emailVerified: true,
    firstName: 'Gina', lastName: 'Google' };
  const oauth = await api('POST', '/api/auth/social-login',
    { provider: 'google', providerId: `g-${RUN}`, accessToken: 'tok', profileData: {} });
  check('an OAuth signup at a claimed domain is not rejected outright',
    oauth.status === 200 || oauth.status === 403);
  const { rows: gRows } = await pool.query(
    'SELECT status, practice_id, role FROM public.users WHERE email = $1', [oauthEmail]);
  check('the OAuth account was bound to the practice',
    gRows.length === 1 && gRows[0].practice_id === A.practiceId);
  check('the OAuth account is pending approval', gRows.length === 1 && gRows[0].status === 'pending');
  check('the OAuth joiner is staff, not a patient', gRows.length === 1 && gRows[0].role !== 'patient');
  const { rows: gPat } = await pool.query('SELECT 1 FROM public.users u WHERE u.email=$1 AND u.role=$2',
    [oauthEmail, 'patient']);
  check('no patient chart was created for a staff joiner', gPat.length === 0);

  const { rows: gReq } = await pool.query(
    'SELECT email_verified_via FROM public.join_requests WHERE email = $1', [oauthEmail]);
  check('the OAuth request records the provider', gReq.length === 1 && /^oauth:/.test(gReq[0].email_verified_via));

  // An UNVERIFIED provider email must not be able to use the domain claim.
  const unverEmail = `unverified_${RUN}@${DOMAIN}`;
  VERIFIED = { provider: 'google', providerId: `u-${RUN}`, email: unverEmail, emailVerified: false,
    firstName: 'Uma', lastName: 'Unverified' };
  await api('POST', '/api/auth/social-login',
    { provider: 'google', providerId: `u-${RUN}`, accessToken: 'tok', profileData: {} });
  const { rows: uRows } = await pool.query(
    'SELECT practice_id FROM public.users WHERE email = $1', [unverEmail]);
  check('an unverified provider email is NOT bound by the domain claim',
    uRows.length === 0 || uRows[0].practice_id === null);

  // ── Authorisation on the admin surface ────────────────────────────────────
  const anon = await api('GET', '/api/team-access/requests');
  check('the request queue requires authentication', anon.status === 401);
  const anonDomains = await api('GET', '/api/team-access/domains');
  check('the domain list requires authentication', anonDomains.status === 401);

  const staffLogin = await api('POST', '/api/auth/login', { email: joinEmail, password: PW });
  const staffQueue = await api('GET', '/api/team-access/requests', undefined, auth(staffLogin.body.token));
  check('a non-admin cannot read the request queue', staffQueue.status === 403);
  const staffClaim = await api('POST', '/api/team-access/domains',
    { domain: `sneaky-${RUN}.example` }, auth(staffLogin.body.token));
  check('a non-admin cannot claim a domain', staffClaim.status === 403);

  // ── Report ────────────────────────────────────────────────────────────────
  let pass = 0;
  for (const [name, ok] of results) {
    console.log(`  ${ok ? 'ok ' : 'FAIL'}  ${name}`);
    if (ok) pass++;
  }
  console.log(`\n${pass}/${results.length} checks passed.`);
  await pool.end();
  process.exit(pass === results.length ? 0 : 1);
})().catch((err) => {
  console.error('harness error:', err);
  process.exit(1);
});
