// Medical camps, checked adversarially.
//
// The ordinary CRUD is the least interesting part. What this suite is really for:
//
//   * the consent gate holds under every route that could reach a clinical station
//   * queue tokens stay unique when several desks register at once
//   * a referenced site / an unreconciled allocation / an in-flight attendee cannot be
//     wished away by a status change
//   * promotion is the ONLY path from a camp to the patients table, and it refuses to
//     invent a date of birth silently
//   * a camp cannot double-book a clinician the practice has already committed elsewhere
//   * THE SPONSOR REPORT CONTAINS NO PATIENT DATA — asserted by scanning the response for
//     every identifier the fixtures put in, not by reading the SQL
//   * one tenant cannot see another's camps

const path = require('path');
const crypto = require('crypto');

const BACKEND = path.join(__dirname, '..', '..');
const results = [];
const check = (name, cond) => results.push([name, !!cond]);

process.env.PORT = process.env.TEST_PORT || '4897';
process.env.NODE_ENV = 'development';
process.env.AC_COOKIE_INSECURE = 'true';
process.env.AC_RL_TEST_BYPASS = '1';
process.env.AC_JWT_S = process.env.AC_JWT_S || crypto.randomBytes(48).toString('base64');
const BASE = `http://127.0.0.1:${process.env.PORT}`;

const pool = require(path.join(BACKEND, 'db.js'));
const bcrypt = require(path.join(BACKEND, '..', 'node_modules', 'bcryptjs'));
const { provisionTenant } = require(path.join(BACKEND, 'services/tenantProvisioning.js'));
const campSvc = require(path.join(BACKEND, 'services/camps.js'));

const PLAN_ESSENTIALS = 1;
const PLAN_CLINICAL_PRO = 2;

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
const auth = (t) => ({ Authorization: `Bearer ${t}` });

/** Tenant-pinned SQL. The pin must be inside a transaction — db.js opens pooled
 *  connections with `-c search_path=public`, so a bare SET LOCAL outside one is a no-op. */
const tenantSql = (schema) => async (text, params) => {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query(`SET LOCAL search_path TO ${schema}, public, control`);
    const out = await c.query(text, params);
    await c.query('COMMIT');
    return out;
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally { c.release(); }
};

(async () => {
  for (let i = 0; i < 40; i++) {
    try { await fetch(BASE + '/health'); break; } catch { await new Promise((r) => setTimeout(r, 250)); }
  }
  console.log('\nMedical camps\n');

  const RUN = crypto.randomBytes(4).toString('hex');
  const DOMAIN = `camps-${RUN}.example`;

  const mkPractice = async (label, planId) => {
    const { practiceId, tenant } = await provisionTenant(pool, {
      name: `Camps ${label} ${RUN}`, planId, country: 'GB', timezone: 'Europe/London',
    });
    const mkUser = async (role, tag) => {
      const email = `${tag}_${label}_${RUN}@${DOMAIN}`;
      const hash = await bcrypt.hash(PW, 12);
      const { rows } = await pool.query(
        `INSERT INTO public.users (id,email,first_name,last_name,role,status,password_hash,practice_id,created_at)
         VALUES (gen_random_uuid(),$1,$2,'Person',$3,'active',$4,$5,NOW()) RETURNING id`,
        [email, tag, role, hash, practiceId]
      );
      const login = await api('POST', '/api/auth/login', { email, password: PW });
      return { id: rows[0].id, email, token: login.body && login.body.token };
    };
    return {
      practiceId, schema: tenant.schema_name, sql: tenantSql(tenant.schema_name),
      admin: await mkUser('admin', 'admin'),
      doctor: await mkUser('doctor', 'doc'),
      patientUser: null,
      mkUser,
    };
  };

  const A = await mkPractice('A', PLAN_CLINICAL_PRO);
  const B = await mkPractice('B', PLAN_CLINICAL_PRO);
  const E = await mkPractice('E', PLAN_ESSENTIALS);
  check('practice admins can sign in', Boolean(A.admin.token && B.admin.token && E.admin.token));

  // ── plan gating ────────────────────────────────────────────────────────────
  const gated = await api('GET', '/api/camps', undefined, auth(E.admin.token));
  check('camps are blocked on the essentials plan', gated.status === 402 || gated.status === 403);
  check('the block says an upgrade is needed',
    gated.body && (gated.body.upgrade_required === true || /plan/i.test(gated.body.message || '')));

  const allowed = await api('GET', '/api/camps', undefined, auth(A.admin.token));
  check('camps are available on clinical_pro', allowed.status === 200);

  // ── create ─────────────────────────────────────────────────────────────────
  const primary = await api('GET', '/api/locations/primary', undefined, auth(A.admin.token));
  check('practice A has a primary site to work from', primary.status === 200);

  const venue = await api('POST', '/api/locations', {
    name: 'Riverside Community Hall', locationType: 'camp', city: 'Leeds', country: 'GB',
  }, auth(A.admin.token));
  check('a camp venue can be added as a site', venue.status === 201);

  // Window: tomorrow 09:00 → 17:00, so "today" stays bookable and the camp day does not.
  const day = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10);
  const startsAt = `${day}T09:00:00`;
  const endsAt = `${day}T17:00:00`;

  const badWindow = await api('POST', '/api/camps', {
    name: 'Backwards', startsAt: endsAt, endsAt: startsAt,
  }, auth(A.admin.token));
  check('a camp cannot end before it starts', badWindow.status === 400);

  const badFunding = await api('POST', '/api/camps', {
    name: 'Odd money', startsAt, endsAt, fundingSource: 'crowdfunding',
  }, auth(A.admin.token));
  check('an unknown funding source is rejected with 400', badFunding.status === 400);

  const camp = await api('POST', '/api/camps', {
    name: `Riverside Health Camp ${RUN}`,
    description: 'Free screening drive',
    startsAt, endsAt, timezone: 'Europe/London',
    sponsorName: 'Riverside Trust', fundingSource: 'sponsored',
    isFree: true, budget: 2500, currency: 'GBP', capacity: 40,
  }, auth(A.admin.token));
  check('an admin can create a camp', camp.status === 201);
  check('a new camp starts as a draft', camp.body && camp.body.status === 'draft');
  check('a new camp is free by default here', camp.body && camp.body.isFree === true);
  const CAMP = camp.body.id;

  // ── publish readiness — every blocker at once, not one at a time ───────────
  const notReady = await api('POST', `/api/camps/${CAMP}/status`, { status: 'published' }, auth(A.admin.token));
  check('an empty camp cannot be published', notReady.status === 409);
  check('the refusal is NotReady', notReady.body && notReady.body.error === 'NotReady');
  {
    const codes = (notReady.body.blockers || []).map((b) => b.code).sort();
    check('it names every blocker at once, not just the first',
      JSON.stringify(codes) === JSON.stringify(['NoLocation', 'NoServices', 'NoStaff', 'NoStations']));
  }

  const readiness = await api('GET', `/api/camps/${CAMP}/readiness?to=published`, undefined, auth(A.admin.token));
  check('readiness can be previewed before pressing the button',
    readiness.status === 200 && readiness.body.ready === false && readiness.body.blockers.length === 4);

  const illegal = await api('POST', `/api/camps/${CAMP}/status`, { status: 'closed' }, auth(A.admin.token));
  check('a draft cannot jump straight to closed', illegal.status === 409);
  check('the refusal is IllegalTransition and lists what IS allowed',
    illegal.body && illegal.body.error === 'IllegalTransition'
    && Array.isArray(illegal.body.allowed) && illegal.body.allowed.includes('published'));

  // Satisfy each blocker.
  await api('PUT', `/api/camps/${CAMP}`, { locationId: venue.body.id }, auth(A.admin.token));

  const offering = await A.sql(
    `INSERT INTO healthcare_offerings (name, description, duration_minutes)
     VALUES ('General Screening', 'Camp screening', 15) RETURNING id`
  );
  const OFFERING = offering.rows[0].id;

  const paidSvc = await api('POST', `/api/camps/${CAMP}/services`,
    { offeringId: OFFERING, price: 25 }, auth(A.admin.token));
  check('a free camp refuses a priced service', paidSvc.status === 409);
  check('and names the rule', paidSvc.body && paidSvc.body.error === 'CampIsFree');

  const svc = await api('POST', `/api/camps/${CAMP}/services`,
    { offeringId: OFFERING }, auth(A.admin.token));
  check('a free service can be added', svc.status === 201 && svc.body.isFree === true);

  const dupeSvc = await api('POST', `/api/camps/${CAMP}/services`,
    { offeringId: OFFERING }, auth(A.admin.token));
  check('the same offering cannot be added twice', dupeSvc.status === 409);

  const outsider = await api('POST', `/api/camps/${CAMP}/staff`,
    { userId: B.doctor.id, campRole: 'clinician' }, auth(A.admin.token));
  check("a user from another practice cannot be rostered", outsider.status === 404);

  const badRole = await api('POST', `/api/camps/${CAMP}/staff`,
    { userId: A.doctor.id, campRole: 'wizard' }, auth(A.admin.token));
  check('an unknown camp role is rejected', badRole.status === 400);

  const roster = await api('POST', `/api/camps/${CAMP}/staff`,
    { userId: A.doctor.id, campRole: 'clinician' }, auth(A.admin.token));
  check('a practice clinician can be rostered', roster.status === 201);

  const dupeRoster = await api('POST', `/api/camps/${CAMP}/staff`,
    { userId: A.doctor.id }, auth(A.admin.token));
  check('the same person cannot be rostered twice', dupeRoster.status === 409);

  const reg = await api('POST', `/api/camps/${CAMP}/stations`,
    { name: 'Registration', stepOrder: 1, isClinical: false }, auth(A.admin.token));
  const vitals = await api('POST', `/api/camps/${CAMP}/stations`,
    { name: 'Vitals', stepOrder: 2, isClinical: true }, auth(A.admin.token));
  const consult = await api('POST', `/api/camps/${CAMP}/stations`,
    { name: 'Consult', stepOrder: 3, isClinical: true, offeringId: OFFERING }, auth(A.admin.token));
  check('stations can be defined',
    reg.status === 201 && vitals.status === 201 && consult.status === 201);
  check('a non-clinical station can be marked as such', reg.body.isClinical === false);

  const published = await api('POST', `/api/camps/${CAMP}/status`, { status: 'published' }, auth(A.admin.token));
  check('a complete camp can be published', published.status === 200 && published.body.status === 'published');
  check('publishing is stamped', Boolean(published.body.publishedAt));

  // ── staffing conflicts ─────────────────────────────────────────────────────
  // A clinic appointment during the camp window, at the primary site.
  const clash = await A.sql(
    `INSERT INTO appointments (id, practice_id, provider_id, start_time, end_time, status)
     VALUES (gen_random_uuid(), $1, $2, $3::timestamp, $3::timestamp + interval '30 minutes', 'scheduled')
     RETURNING id`,
    [A.practiceId, A.doctor.id, `${day}T10:00:00`]
  );

  const nurse = await A.mkUser('nurse', 'nurse');
  const clashAppt = await A.sql(
    `INSERT INTO appointments (id, practice_id, provider_id, start_time, end_time, status)
     VALUES (gen_random_uuid(), $1, $2, $3::timestamp, $3::timestamp + interval '30 minutes', 'scheduled')
     RETURNING id`,
    [A.practiceId, nurse.id, `${day}T11:00:00`]
  );
  check('fixture appointments created', Boolean(clash.rows[0].id && clashAppt.rows[0].id));

  const conflicts = await api('GET', `/api/camps/${CAMP}/staff/conflicts?userId=${nurse.id}`,
    undefined, auth(A.admin.token));
  check('clinic work during the camp window is reported as a conflict',
    conflicts.status === 200 && conflicts.body.count === 1);

  const blockedRoster = await api('POST', `/api/camps/${CAMP}/staff`,
    { userId: nurse.id, campRole: 'nurse' }, auth(A.admin.token));
  check('rostering over a clinic appointment is refused by default', blockedRoster.status === 409);
  check('the refusal is StaffingConflict and lists the clashes',
    blockedRoster.body && blockedRoster.body.error === 'StaffingConflict'
    && (blockedRoster.body.conflicts || []).length === 1);

  const forcedRoster = await api('POST', `/api/camps/${CAMP}/staff`,
    { userId: nurse.id, campRole: 'nurse', force: true }, auth(A.admin.token));
  check('force rosters anyway and reports what was overridden',
    forcedRoster.status === 201 && forcedRoster.body.conflictsOverridden === 1);

  // An appointment AT the camp's own venue is not a conflict — the clinician is there.
  const atVenue = await A.mkUser('doctor', 'doc2');
  await A.sql(
    `INSERT INTO appointments (id, practice_id, provider_id, start_time, end_time, status, location_id)
     VALUES (gen_random_uuid(), $1, $2, $3::timestamp, $3::timestamp + interval '30 minutes', 'scheduled', $4)`,
    [A.practiceId, atVenue.id, `${day}T12:00:00`, venue.body.id]
  );
  const noConflict = await api('GET', `/api/camps/${CAMP}/staff/conflicts?userId=${atVenue.id}`,
    undefined, auth(A.admin.token));
  check("an appointment at the camp's own venue is not a conflict",
    noConflict.status === 200 && noConflict.body.count === 0);

  // ── scheduling knows about the camp ────────────────────────────────────────
  await A.sql(
    `INSERT INTO doctor_availability (id, provider_id, day_of_week, start_time, end_time, is_available)
     VALUES (gen_random_uuid(), $1, $2, '09:00', '17:00', true)`,
    [A.doctor.id, new Date(`${day}T12:00:00`).getDay()]
  );
  const slots = await api('GET', `/api/scheduling/slots/${A.doctor.id}?date=${day}`,
    undefined, auth(A.admin.token));
  check('a camp-rostered provider offers no clinic slots on the camp day',
    slots.status === 200 && Array.isArray(slots.body) && slots.body.length === 0);

  const dates = await api('GET',
    `/api/scheduling/available-dates/${A.doctor.id}?startDate=${day}&endDate=${day}`,
    undefined, auth(A.admin.token));
  check('and the camp day is not offered as an available date',
    dates.status === 200 && !dates.body.includes(day));

  // ── registration ───────────────────────────────────────────────────────────
  const earlyReg = await api('POST', '/api/camp-registrations', {
    campId: CAMP, fullName: 'Pre Registrant', phone: '07700900001', ageYears: 44,
  }, auth(A.admin.token));
  check('a published camp accepts pre-registration', earlyReg.status === 201);
  check('pre-registration is NOT queued onto the board',
    earlyReg.body && earlyReg.body.firstVisit === null);

  const noAge = await api('POST', '/api/camp-registrations', {
    campId: CAMP, fullName: 'No Age',
  }, auth(A.admin.token));
  check('a registration needs an age or a date of birth', noAge.status === 400);
  check('and says which', noAge.body && noAge.body.error === 'AgeRequired');

  const toDraft = await api('POST', `/api/camps/${CAMP}/status`, { status: 'draft' }, auth(A.admin.token));
  check('a camp with registrations cannot be returned to draft', toDraft.status === 409);
  check('the refusal counts them',
    toDraft.body && (toDraft.body.blockers || []).some((b) => b.code === 'HasRegistrations'));

  const running = await api('POST', `/api/camps/${CAMP}/status`, { status: 'in_progress' }, auth(A.admin.token));
  check('a published camp can open its doors', running.status === 200 && running.body.status === 'in_progress');

  const walkIn = await api('POST', '/api/camp-registrations', {
    campId: CAMP, fullName: 'Walk In One', phone: '07700900002', ageYears: 31,
    gender: 'female', consentGiven: true,
  }, auth(A.admin.token));
  check('a walk-in registers with just a name, phone and age', walkIn.status === 201);
  check('a walk-in with consent is queued at the first station',
    walkIn.body.firstVisit && walkIn.body.firstVisit.stationId === reg.body.id);
  check('tokens start at 1 and count up',
    earlyReg.body.registration.tokenNo === 1 && walkIn.body.registration.tokenNo === 2);

  // Tokens under concurrency — the thing that breaks if the camps row is not locked.
  const burst = await Promise.all(
    Array.from({ length: 12 }, (_, i) => api('POST', '/api/camp-registrations', {
      campId: CAMP, fullName: `Burst ${i}`, phone: `0770099${String(1000 + i)}`, ageYears: 20 + i,
      consentGiven: true,
    }, auth(A.admin.token)))
  );
  check('12 concurrent registrations all succeed', burst.every((r) => r.status === 201));
  {
    const tokens = burst.map((r) => r.body.registration.tokenNo);
    check('every concurrently issued token is unique', new Set(tokens).size === tokens.length);
  }

  // ── the consent gate ───────────────────────────────────────────────────────
  const noConsent = await api('POST', '/api/camp-registrations', {
    campId: CAMP, fullName: 'No Consent', phone: '07700900500', ageYears: 50,
  }, auth(A.admin.token));
  check('an attendee can be registered before consent is taken', noConsent.status === 201);
  const NC = noConsent.body.registration.id;
  // The first station is Registration, which is non-clinical — it is where consent gets
  // taken — so an unconsented attendee belongs in exactly that queue and nowhere further.
  check('without consent they are queued at the non-clinical first station',
    noConsent.body.firstVisit && noConsent.body.firstVisit.stationId === reg.body.id);

  const queueClinical = await api('POST', `/api/camp-registrations/${NC}/queue`,
    { stationId: vitals.body.id }, auth(A.admin.token));
  check('a clinical station cannot be queued without consent', queueClinical.status === 409);
  check('the refusal is ConsentRequired',
    queueClinical.body && queueClinical.body.error === 'ConsentRequired');

  const queueNonClinical = await api('POST', `/api/camp-registrations/${NC}/queue`,
    { stationId: reg.body.id }, auth(A.admin.token));
  check('a NON-clinical station is reachable without consent', queueNonClinical.status === 201);

  const startWithoutConsent = await api('POST', `/api/camps/visits/${queueNonClinical.body.id}/start`,
    {}, auth(A.admin.token));
  check('and can be started', startWithoutConsent.status === 200);

  // Sneak past the queue gate by inserting the visit directly, then try to START it —
  // the gate has to hold at the station too, not only at the queue.
  const smuggled = await A.sql(
    `INSERT INTO camp_station_visits (registration_id, station_id) VALUES ($1,$2) RETURNING id`,
    [NC, vitals.body.id]
  );
  const startSmuggled = await api('POST', `/api/camps/visits/${smuggled.rows[0].id}/start`,
    {}, auth(A.admin.token));
  check('starting a clinical station still refuses an unconsented attendee',
    startSmuggled.status === 409 && startSmuggled.body.error === 'ConsentRequired');

  const consented = await api('POST', `/api/camp-registrations/${NC}/consent`, {}, auth(A.admin.token));
  check('consent can be recorded', consented.status === 200 && Boolean(consented.body.consentGivenAt));

  const startAfterConsent = await api('POST', `/api/camps/visits/${smuggled.rows[0].id}/start`,
    {}, auth(A.admin.token));
  check('after consent the clinical station starts', startAfterConsent.status === 200);

  const completed = await api('POST', `/api/camps/visits/${smuggled.rows[0].id}/complete`,
    { outcome: 'referred' }, auth(A.admin.token));
  check('a visit can be completed with an outcome',
    completed.status === 200 && completed.body.outcome === 'referred');

  const badOutcome = await api('POST', `/api/camps/visits/${smuggled.rows[0].id}/complete`,
    { outcome: 'vibes' }, auth(A.admin.token));
  check('an unknown outcome is rejected', badOutcome.status === 400);

  const board = await api('GET', `/api/camps/${CAMP}/board`, undefined, auth(A.admin.token));
  check('the station board reports queue depth per station',
    board.status === 200 && board.body.length === 3
    && board.body.some((s) => s.name === 'Registration' && s.queued + s.inProgress + s.completed > 0));

  // ── promotion ──────────────────────────────────────────────────────────────
  const WI = walkIn.body.registration.id;

  const needDob = await api('POST', `/api/camp-registrations/${WI}/promote`, {}, auth(A.admin.token));
  check('promotion will not invent a date of birth', needDob.status === 400);
  check('the refusal is DateOfBirthRequired and explains the alternative',
    needDob.body && needDob.body.error === 'DateOfBirthRequired'
    && /estimateDobFromAge/.test(needDob.body.message || ''));

  const estimated = await api('POST', `/api/camp-registrations/${WI}/promote`,
    { estimateDobFromAge: true }, auth(A.admin.token));
  check('an estimated date of birth is allowed when asked for explicitly', estimated.status === 200);
  check('and the estimate is reported back, not hidden',
    estimated.body && estimated.body.created === true && estimated.body.dateOfBirthEstimated === true);
  check('the promoted patient has an MRN in the existing series',
    estimated.body.patient && /^MRN-\d+$/.test(estimated.body.patient.mrn));

  const again = await api('POST', `/api/camp-registrations/${WI}/promote`,
    { estimateDobFromAge: true }, auth(A.admin.token));
  check('promoting twice does not create a second patient',
    again.status === 200 && again.body.alreadyPromoted === true);
  {
    const { rows } = await A.sql('SELECT count(*)::int AS n FROM patients WHERE phone = $1', ['07700900002']);
    check('and there is exactly one patient for that attendee', rows[0].n === 1);
  }

  // Matching: the same phone number on a second registration should surface the patient.
  const twin = await api('POST', '/api/camp-registrations', {
    campId: CAMP, fullName: 'Walk In One', phone: '07700900002', ageYears: 31, consentGiven: true,
  }, auth(A.admin.token));
  const match = await api('GET', `/api/camp-registrations/${twin.body.registration.id}/match`,
    undefined, auth(A.admin.token));
  check('an existing patient is offered as a match', match.status === 200 && match.body.candidates.length >= 1);
  check('a phone match ranks first', match.body.candidates[0].matchedOn === 'phone');

  const linked = await api('POST', `/api/camp-registrations/${twin.body.registration.id}/promote`,
    { patientId: match.body.candidates[0].id }, auth(A.admin.token));
  check('a duplicate can be linked instead of created',
    linked.status === 200 && linked.body.linked === true && linked.body.created === false);
  {
    const { rows } = await A.sql('SELECT count(*)::int AS n FROM patients WHERE phone = $1', ['07700900002']);
    check('linking creates no new patient record', rows[0].n === 1);
  }

  // ── capacity ───────────────────────────────────────────────────────────────
  await A.sql('UPDATE camps SET capacity = (SELECT count(*) FROM camp_registrations WHERE camp_id = $1) WHERE id = $1', [CAMP]);
  const full = await api('POST', '/api/camp-registrations', {
    campId: CAMP, fullName: 'One Too Many', phone: '07700900999', ageYears: 60,
  }, auth(A.admin.token));
  check('capacity is enforced', full.status === 409 && full.body.error === 'CampFull');
  await A.sql('UPDATE camps SET capacity = 500 WHERE id = $1', [CAMP]);

  // ── supplies ───────────────────────────────────────────────────────────────
  const item = await A.sql(
    `INSERT INTO inventory_items
       (item_number, name, unit_of_measure, item_type, unit_cost, quantity_on_hand,
        quantity_reserved, quantity_on_order, reorder_level, reorder_quantity,
        is_lot_tracked, is_expiry_tracked, requires_refrigeration, status, created_at, updated_at)
     VALUES ('CAMP-KIT-1','Test Strips','box','supply',10.00,100,0,0,10,20,false,false,false,'active',NOW(),NOW())
     RETURNING id`
  );
  const ITEM = item.rows[0].id;

  const tooMuch = await api('POST', `/api/camps/${CAMP}/allocations`,
    { itemId: ITEM, qtyIssued: 500 }, auth(A.admin.token));
  check('more stock than exists cannot be issued', tooMuch.status === 400);
  check('the refusal is InsufficientStock and quotes the balance',
    tooMuch.body && tooMuch.body.error === 'InsufficientStock' && /100/.test(tooMuch.body.message));

  const issued = await api('POST', `/api/camps/${CAMP}/allocations`,
    { itemId: ITEM, qtyIssued: 30 }, auth(A.admin.token));
  check('stock can be issued to a camp', issued.status === 201);
  check('the issue is recorded as a camp-referenced movement',
    issued.body.movement && issued.body.movement.referenceType === 'camp'
    && Number(issued.body.movement.quantity) === -30);
  {
    const { rows } = await A.sql('SELECT quantity_on_hand FROM inventory_items WHERE id = $1', [ITEM]);
    check('and the store balance drops', Number(rows[0].quantity_on_hand) === 70);
  }

  const closeEarly = await api('POST', `/api/camps/${CAMP}/status`, { status: 'closed' }, auth(A.admin.token));
  check('a camp cannot close with stock unaccounted for', closeEarly.status === 409);
  check('the refusal names the item',
    closeEarly.body && (closeEarly.body.blockers || []).some(
      (b) => b.code === 'UnreconciledStock' && /Test Strips/.test(b.message)));

  const wrongMaths = await api('POST', `/api/camps/allocations/${issued.body.allocation.id}/reconcile`,
    { qtyConsumed: 10, qtyReturned: 5 }, auth(A.admin.token));
  check('a reconciliation that does not balance is refused', wrongMaths.status === 400);
  check('the refusal is DoesNotBalance',
    wrongMaths.body && wrongMaths.body.error === 'DoesNotBalance');

  const reconciled = await api('POST', `/api/camps/allocations/${issued.body.allocation.id}/reconcile`,
    { qtyConsumed: 18, qtyReturned: 12 }, auth(A.admin.token));
  check('a balanced reconciliation is accepted', reconciled.status === 200);
  check('and is stamped', Boolean(reconciled.body.reconciledAt));
  {
    const { rows } = await A.sql('SELECT quantity_on_hand FROM inventory_items WHERE id = $1', [ITEM]);
    check('the unused balance goes back into the store', Number(rows[0].quantity_on_hand) === 82);
  }

  const cost = await api('GET', `/api/camps/${CAMP}/cost`, undefined, auth(A.admin.token));
  check('the camp cost is its budget against stock actually consumed',
    cost.status === 200 && Number(cost.body.consumedCost) === 180 && Number(cost.body.budget) === 2500);

  // ── closing ────────────────────────────────────────────────────────────────
  const stillRunning = await api('POST', `/api/camps/${CAMP}/status`, { status: 'closed' }, auth(A.admin.token));
  check('a camp cannot close while attendees are mid-pipeline', stillRunning.status === 409);
  check('the refusal counts them',
    stillRunning.body && (stillRunning.body.blockers || []).some((b) => b.code === 'AttendeesInProgress'));

  await A.sql("UPDATE camp_registrations SET status = 'completed' WHERE camp_id = $1 AND status = 'in_progress'", [CAMP]);

  // A diagnosis stamped with the camp, so the sponsor report has a condition to count.
  const patientId = estimated.body.patient.id;
  await A.sql(
    `INSERT INTO diagnosis (id, patient_id, provider_id, diagnosis_name, diagnosis_code, camp_id, diagnosed_date)
     VALUES (gen_random_uuid(), $1, $2, 'Hypertension', 'I10', $3, CURRENT_DATE)`,
    [patientId, A.doctor.id, CAMP]
  );

  const closed = await api('POST', `/api/camps/${CAMP}/status`, { status: 'closed' }, auth(A.admin.token));
  check('a reconciled camp with nobody mid-pipeline can close', closed.status === 200);
  check('closing is stamped', Boolean(closed.body.closedAt));

  const editClosed = await api('PUT', `/api/camps/${CAMP}`, { name: 'Renamed' }, auth(A.admin.token));
  check('a closed camp is frozen against edits', editClosed.status === 409);
  check('the refusal is CampFrozen', editClosed.body && editClosed.body.error === 'CampFrozen');

  const reopen = await api('POST', `/api/camps/${CAMP}/status`, { status: 'in_progress' }, auth(A.admin.token));
  check('a closed camp cannot be reopened', reopen.status === 409);

  // ── reports ────────────────────────────────────────────────────────────────
  const report = await api('GET', `/api/camp-reports/${CAMP}`, undefined, auth(A.admin.token));
  check('the internal report builds', report.status === 200);
  check('it counts registrations and promotions',
    report.body.totals && report.body.totals.registrations > 0 && report.body.totals.promoted >= 1);
  check('it reports per-station throughput', (report.body.stations || []).length === 3);
  check('it reports referral conversion', report.body.referrals !== undefined);

  const sponsorAsDoctor = await api('GET', `/api/camp-reports/${CAMP}/sponsor`, undefined, auth(A.doctor.token));
  check('a non-admin cannot pull the sponsor report', sponsorAsDoctor.status === 403);

  const sponsor = await api('GET', `/api/camp-reports/${CAMP}/sponsor`, undefined, auth(A.admin.token));
  check('an admin can pull the sponsor report', sponsor.status === 200);
  check('it carries aggregates', sponsor.body && sponsor.body.attendance.attendees > 0);
  check('it declares what it is', sponsor.body.disclosure && sponsor.body.disclosure.aggregatesOnly === true);

  // THE assertion. Scan the serialised response for every identifier the fixtures created.
  // Reading the SQL proves what today's code selects; scanning the body proves what the
  // sponsor actually receives.
  {
    const blob = JSON.stringify(sponsor.body);
    const forbidden = [
      ['attendee name', 'Walk In One'],
      ['attendee name', 'Burst 0'],
      ['phone number', '07700900002'],
      ['phone number', '07700900001'],
      ['MRN', estimated.body.patient.mrn],
      ['patient id', patientId],
      ['registration id', WI],
      ['token number field', '"tokenNo"'],
      ['date of birth field', 'dateOfBirth'],
      ['free-text notes field', '"notes"'],
    ];
    const leaked = forbidden.filter(([, needle]) => blob.includes(needle));
    check('THE SPONSOR REPORT LEAKS NO PATIENT DATA',
      leaked.length === 0 || (() => { console.log('     leaked:', leaked); return false; })());
  }
  {
    // Small-cell suppression: a single Hypertension case must not be reported as one case.
    const conditions = sponsor.body.conditionsScreened || [];
    const named = conditions.find((c) => c.condition === 'Hypertension');
    check('a single-case condition is suppressed, not published', !named);
    check('it is rolled into a combined bucket instead',
      conditions.some((c) => /small groups combined/.test(c.condition)));
  }

  // ── tenant isolation ───────────────────────────────────────────────────────
  const crossList = await api('GET', '/api/camps', undefined, auth(B.admin.token));
  check('practice B sees none of A\'s camps',
    crossList.status === 200 && crossList.body.length === 0);
  const crossGet = await api('GET', `/api/camps/${CAMP}`, undefined, auth(B.admin.token));
  check("practice B cannot fetch A's camp", crossGet.status === 404);
  const crossSponsor = await api('GET', `/api/camp-reports/${CAMP}/sponsor`, undefined, auth(B.admin.token));
  check("practice B cannot pull A's sponsor report", crossSponsor.status === 404);
  const crossReg = await api('GET', `/api/camp-registrations?campId=${CAMP}`, undefined, auth(B.admin.token));
  check("practice B sees none of A's registrations",
    crossReg.status === 200 && crossReg.body.length === 0);

  // ── deletion rules ─────────────────────────────────────────────────────────
  const delClosed = await api('DELETE', `/api/camps/${CAMP}`, undefined, auth(A.admin.token));
  check('a closed camp cannot be deleted', delClosed.status === 409 && delClosed.body.error === 'CampNotDraft');

  const scratch = await api('POST', '/api/camps',
    { name: 'Scratch', startsAt, endsAt }, auth(A.admin.token));
  const delDraft = await api('DELETE', `/api/camps/${scratch.body.id}`, undefined, auth(A.admin.token));
  check('an untouched draft camp can be deleted', delDraft.status === 200);

  const delAsDoctor = await api('DELETE', `/api/camps/${CAMP}`, undefined, auth(A.doctor.token));
  check('a non-admin cannot delete a camp', delAsDoctor.status === 403);

  // A venue with camps on it cannot be deleted out from under them.
  const delVenue = await api('DELETE', `/api/locations/${venue.body.id}`, undefined, auth(A.admin.token));
  check('a site with camps attached cannot be deleted', delVenue.status === 409);
  check('and the refusal names camps',
    delVenue.body && (delVenue.body.references || []).some((r) => r.label === 'medical camps'));

  // ── outreach reuses the campaign engine ────────────────────────────────────
  const campaign = await api('POST', '/api/campaigns', {
    name: 'Riverside invite', subject: 'Free screening this Saturday',
    emailContent: 'Come along', campId: CAMP,
  }, auth(A.admin.token));
  check('a campaign can belong to a camp', campaign.status === 201 && campaign.body.campId === CAMP);
  const campaignList = await api('GET', `/api/campaigns?campId=${CAMP}`, undefined, auth(A.admin.token));
  check('and campaigns can be listed by camp',
    campaignList.status === 200 && campaignList.body.length === 1);

  // ── service-layer invariants ───────────────────────────────────────────────
  {
    const db = { query: A.sql };
    const camp = await campSvc.getCamp(db, CAMP);
    check('getCamp reads the camp', camp.id === CAMP);
    check('closed allows only archived',
      JSON.stringify(campSvc.ALLOWED_TRANSITIONS[camp.status]) === JSON.stringify(['archived']));
    check('archived is terminal', campSvc.ALLOWED_TRANSITIONS.archived.length === 0);

    const n = campSvc.splitName('Aisha Fatima Khan');
    check('a multi-part name splits on the last space',
      n.firstName === 'Aisha Fatima' && n.lastName === 'Khan');
    const one = campSvc.splitName('Madonna');
    check('a single-word name still satisfies NOT NULL last_name',
      one.firstName === 'Madonna' && one.lastName === '-');
  }

  // Database-level: the token uniqueness constraint, and the age-or-dob rule.
  {
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      await c.query(`SET LOCAL search_path TO ${A.schema}, public, control`);
      let err = null;
      try {
        await c.query(
          "INSERT INTO camp_registrations (camp_id, token_no, full_name, age_years) VALUES ($1, 1, 'Dupe Token', 30)",
          [CAMP]
        );
      } catch (e) { err = e.code; }
      check('the database refuses a duplicate token in one camp (23505)', err === '23505');

      await c.query('ROLLBACK');
      await c.query('BEGIN');
      await c.query(`SET LOCAL search_path TO ${A.schema}, public, control`);
      err = null;
      try {
        await c.query(
          "INSERT INTO camp_registrations (camp_id, token_no, full_name) VALUES ($1, 9999, 'No Age At All')",
          [CAMP]
        );
      } catch (e) { err = e.code; }
      check('the database requires an age or a date of birth (23514)', err === '23514');
    } finally {
      await c.query('ROLLBACK').catch(() => {});
      c.release();
    }
  }

  // ── Report ─────────────────────────────────────────────────────────────────
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
