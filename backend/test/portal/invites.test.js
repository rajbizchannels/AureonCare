// Patient portal invitations (Phase 1): staff invite a patient on file; the patient opens
// a one-time link and sets a password or continues with Google, landing in the portal.

const path = require('path');
const crypto = require('crypto');

const BACKEND = path.join(__dirname, '..', '..');
process.env.PORT = process.env.TEST_PORT || '4875';
process.env.NODE_ENV = 'development';
process.env.AC_JWT_S = process.env.AC_JWT_S || crypto.randomBytes(48).toString('base64');
process.env.AC_TK_S = process.env.AC_TK_S || process.env.AC_JWT_S;
process.env.AC_PW_BREACH_CHECK = 'false';
process.env.AC_IDX_K = process.env.AC_IDX_K || crypto.randomBytes(32).toString('base64');
process.env.FRONTEND_URL = 'https://app.example.test';
const BASE = `http://127.0.0.1:${process.env.PORT}`;

// Capture outgoing mail on the real module, before the router destructures it.
const outbox = [];
let mailWorks = true;
const notify = require(path.join(BACKEND, 'services/notificationService.js'));
notify.sendEmail = async (to, subject, html) => {
  if (!mailWorks) return { sent: false, reason: 'smtp_not_configured' };
  outbox.push({ to, subject, html }); return { sent: true };
};
// Provider stubbed at the module boundary, as in the SEC-20 tests.
let IDENTITY = null;
const stub = (rel, exportsObj) => {
  const p = require.resolve(path.join(BACKEND, rel));
  require.cache[p] = { id: p, filename: p, loaded: true, exports: exportsObj };
};
stub('utils/oauthExchange.js', { exchangeAuthCode: async () => ({ accessToken: 'server-side-token', refreshToken: null }) });
stub('utils/socialTokenValidator.js', {
  validateSocialToken: async () => { if (!IDENTITY) throw new Error('no identity'); return IDENTITY; },
  isProviderIdMatch: () => true,
});

const pool = require(path.join(BACKEND, 'db.js'));
const bcrypt = require(path.join(BACKEND, '..', 'node_modules', 'bcryptjs'));
const { provisionTenant } = require(path.join(BACKEND, 'services/tenantProvisioning.js'));
require(path.join(BACKEND, 'server.js'));

const results = [];
const check = (n, c) => results.push([n, !!c]);
const call = async (method, url, { token, body, cookie } = {}) => {
  const r = await fetch(BASE + url, { method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text(); let b = null; try { b = JSON.parse(t); } catch { b = t; }
  return { status: r.status, body: b, text: t, setCookie: r.headers.getSetCookie ? r.headers.getSetCookie() : [] };
};
const linkIn = (mail) => { const m = /https:\/\/app\.example\.test\/portal\/activate\?token=([A-Za-z0-9_-]+)/.exec(mail.html); return m && m[1]; };
const report = (err) => {
  let failed = 0;
  for (const [n, c] of results) { console.log(`  ${c ? 'ok  ' : 'FAIL'} ${n}`); if (!c) failed += 1; }
  if (err) { console.error(`\nSTOPPED: ${err.message || err}`); console.error(err); }
  else console.log(`\n${results.length - failed}/${results.length} checks passed.`);
  process.exit(err || failed ? 1 : 0);
};

(async () => {
  for (let i = 0; i < 40; i++) { try { await fetch(BASE + '/health'); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  const RUN = crypto.randomBytes(4).toString('hex');
  const PW = 'A-Strong-Passphrase!23';
  const practice = async (label) => {
    const t = await provisionTenant(pool, { name: `${label} Clinic ${RUN}` });
    const mk = async (role) => {
      const email = `${role}_${label}_${RUN}@example.com`.toLowerCase();
      await pool.query(`INSERT INTO public.users (id,email,first_name,last_name,role,status,password_hash,practice_id,created_at)
        VALUES (gen_random_uuid(),$1,'S',$2,$3,'active',$4,$5,NOW())`, [email, label, role, await bcrypt.hash(PW, 12), t.practiceId]);
      return (await call('POST', '/api/auth/login', { body: { email, password: PW } })).body.token;
    };
    return { t, schema: t.tenant.schema_name, staff: await mk('receptionist'), patientUser: await mk('patient') };
  };
  const A = await practice('Alpha'); const B = await practice('Beta');
  const addPatient = async (P, email, extra = '') => {
    const id = crypto.randomUUID();
    await pool.query(`INSERT INTO ${P.schema}.patients (id, first_name, last_name, status, mrn, date_of_birth, email)
      VALUES ($1,'Rosa${extra}','Parks','Active',$2,'1970-02-04',$3)`, [id, `MRN-${crypto.randomBytes(3).toString('hex')}`, email]);
    return id;
  };

  // ── staff send an invite ───────────────────────────────────────────────────────
  const rosaEmail = `rosa_${RUN}@example.com`;
  const rosa = await addPatient(A, rosaEmail);
  const sent = await call('POST', '/api/portal-invites', { token: A.staff, body: { patientId: rosa } });
  check(`staff can invite a patient (got ${sent.status})`, sent.status === 201 && sent.body.emailed === true);
  check('the response does NOT contain the link when it was emailed', !sent.body.inviteUrl && !/activate\?token=/.test(sent.text));
  const mail = outbox.find((m) => m.to === rosaEmail);
  const token = mail && linkIn(mail);
  check('the patient receives an email with a one-time link', Boolean(token));
  check('the link is not stored — only its hash',
    (await pool.query(`SELECT 1 FROM ${A.schema}.portal_invites WHERE token_hash = $1`, [token])).rowCount === 0);
  check('the shared control plane holds no patient identifier for it',
    !Object.keys((await pool.query('SELECT * FROM control.portal_invite_route LIMIT 1')).rows[0] || {}).some((k) => /patient|email|name/.test(k)));

  // A patient account cannot even obtain a staff session any more (the staff login refuses
  // it), so the request arrives unauthenticated: 401. Either way, no invite is sent.
  check('a patient cannot send invites (401/403)',
    [401, 403].includes((await call('POST', '/api/portal-invites', { token: A.patientUser, body: { patientId: rosa } })).status));
  check("another practice's staff cannot invite this patient (404)",
    (await call('POST', '/api/portal-invites', { token: B.staff, body: { patientId: rosa } })).status === 404);
  const noEmail = await addPatient(A, null, 'NoEmail');
  const ne = await call('POST', '/api/portal-invites', { token: A.staff, body: { patientId: noEmail } });
  check('a patient with no email address gets a clear 400', ne.status === 400 && /email/i.test(ne.body.error));

  const st1 = await call('GET', `/api/portal-invites/patient/${rosa}`, { token: A.staff });
  check('staff see the invite as pending', st1.body.invite && st1.body.invite.status === 'pending' && st1.body.portalEnabled === false);

  // ── the patient opens the link ───────────────────────────────────────────────────
  const look = await call('GET', `/api/portal-invites/lookup/${token}`);
  check('opening the link greets the patient and names the practice',
    look.status === 200 && look.body.firstName === 'Rosa' && /Alpha Clinic/.test(look.body.practiceName));
  check('...showing only a masked address and no other details',
    look.body.email !== rosaEmail && /\*/.test(look.body.email) && !('lastName' in look.body) && !/1970/.test(look.text));
  check('an unknown token says nothing specific (404)', (await call('GET', '/api/portal-invites/lookup/not-a-real-token')).status === 404);

  check('a weak password is refused (400)',
    (await call('POST', '/api/portal-invites/accept', { body: { token, password: 'short' } })).status === 400);
  const acc = await call('POST', '/api/portal-invites/accept', { body: { token, password: PW } });
  check(`ACCEPTING WITH A PASSWORD ENABLES THE PORTAL (got ${acc.status})`, acc.status === 200 && acc.body.patient && acc.body.patient.id === rosa);
  check('...and never returns the password hash', !/portal_password_hash/.test(acc.text));
  const cookie = acc.setCookie.find((c) => c.startsWith('ac_portal='));
  check('...and signs the patient straight in (HttpOnly portal cookie)', cookie && /HttpOnly/i.test(cookie));
  const jar = cookie ? cookie.split(';')[0] : '';
  check('the new session works on the portal', (await call('GET', `/api/patient-portal/${rosa}/profile`, { cookie: jar })).status === 200);

  check('THE LINK WORKS ONCE (second use 410)', (await call('POST', '/api/portal-invites/accept', { body: { token, password: PW } })).status === 410);
  check('...and no longer opens', (await call('GET', `/api/portal-invites/lookup/${token}`)).status === 404);
  const login = await call('POST', '/api/patient-portal/login', { body: { email: rosaEmail, password: PW } });
  check('the patient can sign in later with that password', login.status === 200);
  const st2 = await call('GET', `/api/portal-invites/patient/${rosa}`, { token: A.staff });
  check('staff now see "accepted" and portal enabled', st2.body.invite.status === 'accepted' && st2.body.portalEnabled === true);

  // ── re-send, withdraw, expiry ────────────────────────────────────────────────────
  const ana = await addPatient(A, `ana_${RUN}@example.com`, 'Ana');
  await call('POST', '/api/portal-invites', { token: A.staff, body: { patientId: ana } });
  const first = linkIn(outbox.filter((m) => m.to === `ana_${RUN}@example.com`).pop());
  await call('POST', '/api/portal-invites', { token: A.staff, body: { patientId: ana } });
  const second = linkIn(outbox.filter((m) => m.to === `ana_${RUN}@example.com`).pop());
  check('re-sending replaces the link: the old one stops working', first !== second
    && (await call('GET', `/api/portal-invites/lookup/${first}`)).status === 404
    && (await call('GET', `/api/portal-invites/lookup/${second}`)).status === 200);
  await call('DELETE', `/api/portal-invites/patient/${ana}`, { token: A.staff });
  check('withdrawing the invite kills the link', (await call('GET', `/api/portal-invites/lookup/${second}`)).status === 404);

  const old = await addPatient(A, `old_${RUN}@example.com`, 'Old');
  await call('POST', '/api/portal-invites', { token: A.staff, body: { patientId: old } });
  const oldTok = linkIn(outbox.filter((m) => m.to === `old_${RUN}@example.com`).pop());
  await pool.query(`UPDATE ${A.schema}.portal_invites SET expires_at = now() - interval '1 minute' WHERE patient_id = $1`, [old]);
  await pool.query(`UPDATE control.portal_invite_route SET expires_at = now() - interval '1 minute' WHERE token_hash = encode(sha256($1::bytea),'hex')`, [oldTok]);
  check('an expired link is refused', (await call('POST', '/api/portal-invites/accept', { body: { token: oldTok, password: PW } })).status === 410);

  // ── email not working: staff get the link to pass on another way ─────────────────
  mailWorks = false;
  const noMail = await addPatient(A, `nomail_${RUN}@example.com`, 'NoMail');
  const nm = await call('POST', '/api/portal-invites', { token: A.staff, body: { patientId: noMail } });
  check('when email cannot be sent, staff are told and given the link', nm.status === 201 && nm.body.emailed === false && /portal\/activate\?token=/.test(nm.body.inviteUrl || ''));
  mailWorks = true;

  // ── continue with Google ─────────────────────────────────────────────────────────
  const leeEmail = `lee_${RUN}@example.com`;
  const lee = await addPatient(A, leeEmail, 'Lee');
  await call('POST', '/api/portal-invites', { token: A.staff, body: { patientId: lee } });
  const leeTok = linkIn(outbox.filter((m) => m.to === leeEmail).pop());
  IDENTITY = { email: `lee.personal_${RUN}@gmail.example`, emailVerified: true, providerId: `g-lee-${RUN}` };
  const g = await call('POST', '/api/portal-invites/accept/oauth/google', { body: { token: leeTok, code: 'one-time-code', redirectUri: 'postmessage' } });
  check(`ACCEPTING WITH GOOGLE ENABLES THE PORTAL AND SIGNS IN (got ${g.status})`, g.status === 200 && g.setCookie.some((c) => c.startsWith('ac_portal=')));
  check('...binds a user account to the right practice',
    (await pool.query('SELECT practice_id FROM public.users WHERE id = $1', [lee])).rows[0]?.practice_id === A.t.practiceId);
  check('...and links the Google identity to this patient',
    (await pool.query('SELECT 1 FROM public.social_auth WHERE provider = $1 AND provider_user_id = $2 AND patient_id = $3', ['google', `g-lee-${RUN}`, lee])).rowCount === 1);
  const gLogin = await call('POST', '/api/patient-portal/oauth/google/exchange', { body: { code: 'again', redirectUri: 'postmessage' } });
  check(`the patient can sign in with Google afterwards (got ${gLogin.status})`, gLogin.status === 200 && gLogin.body.patient && gLogin.body.patient.id === lee);

  // A Google account already linked to someone else stays theirs.
  const mo = await addPatient(A, `mo_${RUN}@example.com`, 'Mo');
  await call('POST', '/api/portal-invites', { token: A.staff, body: { patientId: mo } });
  const moTok = linkIn(outbox.filter((m) => m.to === `mo_${RUN}@example.com`).pop());
  const taken = await call('POST', '/api/portal-invites/accept/oauth/google', { body: { token: moTok, code: 'c', redirectUri: 'postmessage' } });
  check('a Google account linked to another patient is refused (409), and the link stays usable',
    taken.status === 409 && (await call('GET', `/api/portal-invites/lookup/${moTok}`)).status === 200);

  // ── patients added by staff get no unusable random password any more ─────────────
  const created = await call('POST', '/api/patients', { token: A.staff, body: {
    first_name: 'New', last_name: 'Patient', date_of_birth: '1990-01-01', email: `newpt_${RUN}@example.com`, mrn: `MRN-N-${RUN}` } });
  if (created.status === 201) {
    const { rows: [u] } = await pool.query('SELECT password_hash FROM public.users WHERE email = $1', [`newpt_${RUN}@example.com`]);
    check('a patient added by staff gets no hidden random password', u && u.password_hash === null);
  } else {
    check(`a patient can be added by staff (got ${created.status})`, false);
  }

  report();
})().catch(report);
