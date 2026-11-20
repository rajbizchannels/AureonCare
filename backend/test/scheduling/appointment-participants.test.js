// Who a booking screen may offer, and the service on an appointment.
//
// Three reported faults, all of them server-side:
//
//   1. GET /api/providers returns ONLY the caller when their role is `doctor`, so a doctor
//      opening the appointment form saw one provider — themselves — and could not book a
//      colleague's clinic. (A patient of the same practice already received the full list
//      through the same route, so the restriction was not protecting anything from the
//      practice's own clinicians.) GET /api/providers/bookable is the narrow list a
//      booking screen needs.
//   2. GET /api/users is admin-only, which is where the dashboard and practice-calendar
//      forms got their provider list: for a doctor it returned 403 and the dropdown held
//      nothing at all.
//   3. The appointment form filtered services on available_online — a patient-portal flag
//      — so every in-clinic-only service was hidden from staff.
//
// Plus: an appointment's service could be set at booking and never changed, because
// PUT /api/appointments/:id did not touch offering_id.

const path = require('path');
const crypto = require('crypto');

const BACKEND = path.join(__dirname, '..', '..');
process.env.PORT = process.env.TEST_PORT || '4883';
process.env.NODE_ENV = 'development';
process.env.AC_JWT_S = process.env.AC_JWT_S || crypto.randomBytes(48).toString('base64');
const BASE = `http://127.0.0.1:${process.env.PORT}`;

const pool = require(path.join(BACKEND, 'db.js'));
const bcrypt = require(path.join(BACKEND, '..', 'node_modules', 'bcryptjs'));
const { provisionTenant } = require(path.join(BACKEND, 'services/tenantProvisioning.js'));
require(path.join(BACKEND, 'server.js'));

const results = [];
const check = (n, c) => results.push([n, !!c]);
const api = async (method, url, body, token) => {
  const r = await fetch(BASE + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  let parsed = null; try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { status: r.status, body: parsed };
};
/** Names from a provider listing, sorted, or the error so a failure says what came back. */
const names = (res) => (Array.isArray(res.body)
  ? res.body.map((p) => p.firstName || p.first_name).sort()
  : [`<${res.status}>`, res.body && (res.body.error || res.body)]);

(async () => {
  for (let i = 0; i < 40; i++) {
    try { await fetch(BASE + '/health'); break; } catch { await new Promise((r) => setTimeout(r, 250)); }
  }

  const RUN = crypto.randomBytes(4).toString('hex');
  const PASS = 'A-Strong-Passphrase!23';
  const hash = await bcrypt.hash(PASS, 12);

  const t = await provisionTenant(pool, { name: `Sched Clinic ${RUN}` });
  const other = await provisionTenant(pool, { name: `Other Clinic ${RUN}` });
  const schema = t.tenant.schema_name;

  const mk = async ({ role, first, practiceId = t.practiceId, status = 'active', asProvider = null }) => {
    const email = `${first}_${RUN}@example.com`.toLowerCase();
    const { rows } = await pool.query(
      `INSERT INTO public.users (id,email,first_name,last_name,role,status,password_hash,practice_id,created_at)
       VALUES (gen_random_uuid(),$1,$2,'Probe',$3,$4,$5,$6,NOW()) RETURNING id`,
      [email, first, role, status, hash, practiceId]);
    const id = rows[0].id;
    if (asProvider ?? role === 'doctor') {
      await pool.query(
        `INSERT INTO public.providers (id, first_name, last_name, specialization, email)
         VALUES ($1,$2,'Probe','General Practice',$3) ON CONFLICT (id) DO NOTHING`, [id, first, email]);
    }
    const l = await api('POST', '/api/auth/login', { email, password: PASS });
    return { id, email, token: l.body && l.body.token };
  };

  const docA = await mk({ role: 'doctor', first: 'Asha' });
  const docB = await mk({ role: 'doctor', first: 'Ben' });
  const admin = await mk({ role: 'admin', first: 'Amy' });
  const reception = await mk({ role: 'receptionist', first: 'Rita' });
  const gone = await mk({ role: 'doctor', first: 'Gita', status: 'inactive' });
  const foreign = await mk({ role: 'doctor', first: 'Fay', practiceId: other.practiceId });

  check('a doctor can sign in', Boolean(docA.token));
  check('an admin can sign in', Boolean(admin.token));

  // ── 1. the bug, stated as a check ──────────────────────────────────────────────────
  const mgmtAsDoctor = await api('GET', '/api/providers', undefined, docA.token);
  check('GET /api/providers still shows a doctor only themselves (unchanged on purpose)',
        JSON.stringify(names(mgmtAsDoctor)) === JSON.stringify(['Asha']));
  const usersAsDoctor = await api('GET', '/api/users', undefined, docA.token);
  check('GET /api/users is closed to a doctor, so it cannot be the provider list',
        usersAsDoctor.status === 403);

  // ── 2. the bookable list ───────────────────────────────────────────────────────────
  const bookableDoc = await api('GET', '/api/providers/bookable', undefined, docA.token);
  check('a doctor can list the practice\'s bookable providers', bookableDoc.status === 200);
  check('...and sees their colleagues, not just themselves',
        JSON.stringify(names(bookableDoc)) === JSON.stringify(['Asha', 'Ben']));
  check('an inactive provider is not bookable',
        Array.isArray(bookableDoc.body) && !bookableDoc.body.some((p) => p.id === gone.id));
  check('another practice\'s provider is not bookable',
        Array.isArray(bookableDoc.body) && !bookableDoc.body.some((p) => p.id === foreign.id));

  for (const [who, tok] of [['admin', admin.token], ['receptionist', reception.token]]) {
    const r = await api('GET', '/api/providers/bookable', undefined, tok);
    check(`a ${who} sees the same bookable list`,
          JSON.stringify(names(r)) === JSON.stringify(['Asha', 'Ben']));
  }

  check('the bookable list carries a name to show',
        Array.isArray(bookableDoc.body) && bookableDoc.body.every((p) => p.firstName && p.lastName));
  // Deliberately narrower than the management list: a doctor gains a colleague's name and
  // specialty, and nothing else.
  check('it does NOT leak colleagues\' contact or licence details',
        Array.isArray(bookableDoc.body)
        && bookableDoc.body.every((p) => p.email === undefined && p.phone === undefined
          && p.licenseNumber === undefined));
  check('/bookable is not routed into GET /:id as an id',
        bookableDoc.status === 200 && Array.isArray(bookableDoc.body));

  const unbound = await mk({ role: 'doctor', first: 'Una', practiceId: null });
  const unboundRes = await api('GET', '/api/providers/bookable', undefined, unbound.token);
  check('an account with no practice is told so rather than handed an empty list',
        unboundRes.status === 409);

  check('an unauthenticated caller gets nothing',
        (await api('GET', '/api/providers/bookable')).status === 401);

  // ── 3. services: the available_online filter hid in-clinic work ────────────────────
  await pool.query(
    `INSERT INTO ${schema}.healthcare_offerings (name, is_active, available_online, duration_minutes)
     VALUES ('Portal-bookable consult ${RUN}', true, true, 20),
            ('In-clinic only procedure ${RUN}', true, false, 45),
            ('Retired service ${RUN}', false, true, 30)`);

  const online = await api('GET', '/api/offerings?is_active=true&available_online=true', undefined, admin.token);
  const active = await api('GET', '/api/offerings?is_active=true', undefined, admin.token);
  const nameList = (r) => (Array.isArray(r.body) ? r.body.map((o) => o.name) : []);
  check('the old filter hid the in-clinic-only service',
        !nameList(online).includes(`In-clinic only procedure ${RUN}`));
  check('asking for active services returns it',
        nameList(active).includes(`In-clinic only procedure ${RUN}`));
  check('...alongside the portal-bookable one',
        nameList(active).includes(`Portal-bookable consult ${RUN}`));
  check('and still excludes an inactive service',
        !nameList(active).includes(`Retired service ${RUN}`));

  const offeringId = (active.body || []).find((o) => o.name === `In-clinic only procedure ${RUN}`)?.id;
  const otherOfferingId = (active.body || []).find((o) => o.name === `Portal-bookable consult ${RUN}`)?.id;
  check('the offerings carry ids to book against', Boolean(offeringId && otherOfferingId));

  // ── 4. the service on an appointment can be changed ────────────────────────────────
  const { rows: pat } = await pool.query(
    `INSERT INTO ${schema}.patients (id, first_name, last_name, status, mrn, date_of_birth)
     VALUES (gen_random_uuid(),'Pat','Probe','Active',$1,'1980-01-01') RETURNING id`, [`MRN-${RUN}`]);
  const patientId = pat[0].id;

  const created = await api('POST', '/api/appointments', {
    patient_id: patientId, provider_id: docA.id, appointment_type: 'Follow-up',
    start_time: '2026-12-01T09:00:00', end_time: '2026-12-01T09:20:00',
    duration_minutes: 20, reason: 'probe', status: 'scheduled', offering_id: offeringId,
  }, admin.token);
  check('an appointment can be booked with a service', created.status === 201 || created.status === 200);
  const apptId = created.body && created.body.id;
  check('the booked service was stored', created.body && String(created.body.offering_id) === String(offeringId));

  const base = {
    patient_id: patientId, provider_id: docB.id, appointment_type: 'Follow-up',
    start_time: '2026-12-02T09:00:00', end_time: '2026-12-02T09:20:00',
    duration_minutes: 20, reason: 'probe', status: 'scheduled',
  };

  const moved = await api('PUT', `/api/appointments/${apptId}`,
    { ...base, offering_id: otherOfferingId }, admin.token);
  check('the service can be changed', moved.status === 200
        && String(moved.body.offering_id) === String(otherOfferingId));
  check('and so can the provider', String(moved.body.provider_id) === String(docB.id));

  // Absent is not the same as null: a caller that does not mention the service must not
  // silently wipe it.
  const untouched = await api('PUT', `/api/appointments/${apptId}`,
    { ...base, start_time: '2026-12-03T09:00:00', end_time: '2026-12-03T09:20:00' }, admin.token);
  check('an update that omits the service leaves it alone',
        untouched.status === 200 && String(untouched.body.offering_id) === String(otherOfferingId));

  const cleared = await api('PUT', `/api/appointments/${apptId}`,
    { ...base, start_time: '2026-12-04T09:00:00', end_time: '2026-12-04T09:20:00', offering_id: null },
    admin.token);
  check('sending null clears the service', cleared.status === 200 && cleared.body.offering_id === null);

  // Cleanup: these rows live in `public` and would otherwise accumulate across runs.
  await pool.query('DELETE FROM public.providers WHERE id = ANY($1::uuid[])',
    [[docA.id, docB.id, gone.id, foreign.id, unbound.id]]);
  await pool.query('DELETE FROM public.users WHERE id = ANY($1::uuid[])',
    [[docA.id, docB.id, admin.id, reception.id, gone.id, foreign.id, unbound.id]]);

  let ok = 0;
  for (const [n, c] of results) { console.log(`  ${c ? 'ok  ' : 'FAIL'} ${n}`); if (c) ok++; }
  console.log(`\n${ok}/${results.length} checks passed.`);
  await pool.end();
  process.exit(ok === results.length ? 0 : 1);
})().catch((e) => {
  for (const [n, c] of results) console.log(`  ${c ? 'ok  ' : 'FAIL'} ${n}`);
  console.error('harness error:', e);
  process.exit(1);
});
