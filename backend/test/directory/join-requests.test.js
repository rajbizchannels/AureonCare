// "Work here? Ask to join" from a practice's public profile page.
//
// Proves: the link and form only exist where the profile is public; the request does
// nothing until the email link is clicked; only the token's hash is stored and it is
// single-use; answers never reveal whether someone already works there; admins are told
// and see it in Team access; approving sends a normal staff INVITATION (no access before
// it is accepted, and it carries the role asked for); rejecting sends none.

const path = require('path');
const crypto = require('crypto');

const BACKEND = path.join(__dirname, '..', '..');
process.env.PORT = process.env.TEST_PORT || '4883';
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
const { expandLink, firstLinkIn } = require(path.join(__dirname, '..', 'helpers', 'links.js'));
const bcrypt = require(path.join(BACKEND, '..', 'node_modules', 'bcryptjs'));
const { provisionTenant } = require(path.join(BACKEND, 'services/tenantProvisioning.js'));
require(path.join(BACKEND, 'server.js'));

const results = [];
const check = (n, c) => results.push([n, !!c]);
const obj = (v) => v || {};
const call = async (method, url, token, body) => {
  const r = await fetch(BASE + url, { method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text(); let b = null; try { b = JSON.parse(t); } catch { b = t; }
  return { status: r.status, body: b };
};
const form = async (url, fields, extraHeaders = {}) => {
  const r = await fetch(BASE + url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...extraHeaders },
    body: new URLSearchParams(fields).toString() });
  return { status: r.status, html: await r.text(), csp: r.headers.get('content-security-policy') || '' };
};
const get = async (url) => { const r = await fetch(BASE + url, { redirect: 'manual' }); return { status: r.status, html: await r.text(), referrer: r.headers.get('referrer-policy') || '' }; };
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
  const t = await provisionTenant(pool, { name: `Join Clinic ${RUN}` });
  const mk = async (role, first) => {
    const email = `${role}_${first}_${RUN}@example.com`.toLowerCase();
    const { rows: [u] } = await pool.query(`INSERT INTO public.users (id,email,first_name,last_name,role,status,password_hash,practice_id,created_at)
      VALUES (gen_random_uuid(),$1,$2,'Test',$3,'active',$4,$5,NOW()) RETURNING id`, [email, first, role, await bcrypt.hash(PW, 12), t.practiceId]);
    return { id: u.id, email, token: (await call('POST', '/api/auth/login', null, { email, password: PW })).body.token };
  };
  const admin = await mk('admin', 'ada');
  const nurse = await mk('nurse', 'nia');
  const slug = `join-${RUN}`;
  const base = `/p/${slug}`;

  check('OFF profile: the join form is not found', (await get(`${base}/join`)).status === 404);
  await call('PUT', '/api/practice-profile', admin.token, { slug, display_name: 'Join Family Clinic', visibility: 'searchable', use_random_link: false });
  const page = await get(base);
  check(`the public page links to "Ask to join" (got ${page.status})`, page.status === 200 && page.html.includes(`href="${base}/join"`));
  const f = await get(`${base}/join`);
  check('the form opens', f.status === 200 && /name="email"/.test(f.html) && /<select id="rl" name="role">/.test(f.html));
  check('...and offers no admin role', !/value="admin"/.test(f.html));

  // ── request ──────────────────────────────────────────────────────────────────────
  const email = `newdoc_${RUN}@example.com`;
  outbox.length = 0;
  const bad = await form(`${base}/join`, { firstName: '', lastName: 'Lee', email: 'nope', role: 'doctor' });
  check('missing name / bad email -> 400 with the form again', bad.status === 400 && /valid email/.test(bad.html));
  const r1 = await form(`${base}/join`, { firstName: 'Maya', lastName: 'Lee', email: email.toUpperCase(), role: 'admin' });
  check(`a request is accepted (got ${r1.status})`, r1.status === 200 && /Check your email/.test(r1.html));
  check('...the page allows posting only to itself', /form-action 'self'/.test(r1.csp));
  // A real browser posting the form sends "Origin: null" when the page's referrer policy is
  // no-referrer — that must not be refused as a cross-origin call (it was a 500 in production).
  const viaBrowser = await form(`${base}/join`, { firstName: 'Ori', lastName: 'Null', email: `orinull_${RUN}@example.com`, role: 'nurse' }, { Origin: 'null' });
  check(`a browser form post with "Origin: null" is accepted (got ${viaBrowser.status})`, viaBrowser.status === 200 && /Check your email/.test(viaBrowser.html));
  const fromApp = await form(`${base}/join`, { firstName: 'Ori', lastName: 'Same', email: `orisame_${RUN}@example.com`, role: 'nurse' }, { Origin: BASE });
  check(`a same-origin form post is accepted (got ${fromApp.status})`, fromApp.status === 200);
  check('the form page sends its origin with the post', /same-origin/.test(f.referrer || ''));
  const row = (await pool.query(`SELECT * FROM public.join_requests WHERE practice_id = $1 AND email = $2`, [t.practiceId, email])).rows;
  check('...one row, UNVERIFIED, from the profile, no account', row.length === 1 && row[0].status === 'unverified' && row[0].source === 'profile' && row[0].user_id === null);
  check('...asking for "admin" falls back to staff', row[0] && row[0].requested_role === 'staff');
  check('...only a hash of the link token is stored', row[0] && /^[0-9a-f]{64}$/.test(row[0].verify_token_hash));
  check('admins are NOT told yet', !outbox.some((m) => m.to === admin.email));
  check('Team access does not list it yet', !((await call('GET', '/api/team-access/requests', admin.token)).body || []).some?.((r) => r.email === email));
  const mail1 = outbox.find((m) => m.to === email);
  check('the requester is emailed a confirmation link', Boolean(mail1) && /Confirm/.test(mail1.subject));

  // Asking again replaces the link; the first link no longer works.
  outbox.length = 0;
  await form(`${base}/join`, { firstName: 'Maya', lastName: 'Lee', email, role: 'doctor' });
  const mail2 = outbox.find((m) => m.to === email);
  check('asking again keeps ONE row (now doctor)', (await pool.query(`SELECT requested_role FROM public.join_requests WHERE practice_id = $1 AND email = $2`, [t.practiceId, email])).rows.map((x) => x.requested_role).join() === 'doctor');
  const oldUrl = await expandLink(firstLinkIn(mail1.html), BASE);
  const newUrl = await expandLink(firstLinkIn(mail2.html), BASE);
  const pathOf = (u) => { const x = new URL(u); return x.pathname + x.search; };
  check('the link goes to the verify page', /\/p\/.+\/join\/verify\?t=/.test(newUrl || ''));
  check('the OLD link no longer works (410)', (await get(pathOf(oldUrl))).status === 410);
  check('a made-up token does nothing (410)', (await get(`${base}/join/verify?t=nope`)).status === 410);

  // ── confirm the email ────────────────────────────────────────────────────────────
  outbox.length = 0;
  const v = await get(pathOf(newUrl));
  check(`clicking the link sends the request (got ${v.status})`, v.status === 200 && /Request sent/.test(v.html));
  check('...admins are emailed', outbox.some((m) => m.to === admin.email && /Request to join/.test(m.subject)));
  check('...but not the nurse', !outbox.some((m) => m.to === nurse.email));
  check('...the link is single-use (410)', (await get(pathOf(newUrl))).status === 410);
  const lst = await call('GET', '/api/team-access/requests', admin.token);
  const req = (lst.body.requests || lst.body || []).find((r) => r.email === email);
  check(`Team access lists it, from the profile page (got ${lst.status})`, Boolean(req) && req.source === 'profile' && /Maya/.test(`${req.first_name || req.firstName || ''}`));
  check('a nurse cannot see Team access requests', (await call('GET', '/api/team-access/requests', nurse.token)).status === 403);
  check('NO ACCOUNT EXISTS for the requester yet', (await pool.query('SELECT 1 FROM public.users WHERE LOWER(email) = $1', [email])).rowCount === 0);

  // Same answer for someone already working here, and for a repeat of a pending request.
  outbox.length = 0;
  const m1 = await form(`${base}/join`, { firstName: 'Nia', lastName: 'Test', email: nurse.email, role: 'nurse' });
  const m2 = await form(`${base}/join`, { firstName: 'Maya', lastName: 'Lee', email, role: 'doctor' });
  check('an existing member gets the SAME answer, and nothing is sent', m1.status === 200 && /Check your email/.test(m1.html) && m2.status === 200 && outbox.length === 0);
  check('...and no row is made for them', (await pool.query(`SELECT 1 FROM public.join_requests WHERE LOWER(email) = $1`, [nurse.email])).rowCount === 0);

  // ── approve -> invitation ────────────────────────────────────────────────────────
  outbox.length = 0;
  const ap = await call('POST', `/api/team-access/requests/${req.id}/approve`, admin.token, {});
  check(`approving sends a staff invitation (got ${ap.status} ${JSON.stringify(ap.body).slice(0, 120)})`, ap.status === 200 && obj(ap.body).invite);
  const inviteMail = outbox.find((m) => m.to === email);
  check('...emailed to the requester', Boolean(inviteMail));
  const inv = (await pool.query(`SELECT * FROM public.staff_invites WHERE LOWER(email) = $1 ORDER BY created_at DESC LIMIT 1`, [email])).rows[0];
  check('...for this practice, with the role asked for', inv && inv.practice_id === t.practiceId && inv.role === 'doctor');
  check('STILL NO ACCOUNT until the invitation is accepted', (await pool.query('SELECT 1 FROM public.users WHERE LOWER(email) = $1', [email])).rowCount === 0);
  check('the request is approved', (await pool.query('SELECT status FROM public.join_requests WHERE id = $1', [req.id])).rows[0].status === 'approved');

  // ── reject ───────────────────────────────────────────────────────────────────────
  const email2 = `nope_${RUN}@example.com`;
  outbox.length = 0;
  await form(`${base}/join`, { firstName: 'No', lastName: 'Body', email: email2, role: 'staff' });
  await get(pathOf(await expandLink(firstLinkIn(outbox.find((m) => m.to === email2).html), BASE)));
  const id2 = (await pool.query('SELECT id FROM public.join_requests WHERE email = $1', [email2])).rows[0].id;
  outbox.length = 0;
  const rj = await call('POST', `/api/team-access/requests/${id2}/reject`, admin.token, {});
  check(`rejecting (got ${rj.status})`, rj.status === 200 && (await pool.query('SELECT status FROM public.join_requests WHERE id = $1', [id2])).rows[0].status === 'rejected');
  check('...sends no invitation', (await pool.query('SELECT 1 FROM public.staff_invites WHERE LOWER(email) = $1', [email2])).rowCount === 0);

  report();
})().catch(report);
