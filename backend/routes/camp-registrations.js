// Camp attendees: the registration desk, the consent gate, promotion to a patient record,
// and getting people into station queues.
//
// Registration is the only screen in the product with a hard throughput requirement —
// hundreds of walk-ins in a few hours — which is why a registration is NOT a patient. It
// needs a name, a contact number and an age; patients needs an MRN and an exact date of
// birth. Forcing one into the other would either stall the queue or fill the patient index
// with duplicates, so the two are separate and `promote` is the deliberate bridge.

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { enforceActiveBilling, enforceFeature } = require('../middleware/planEnforcement');
const camps = require('../services/camps');

router.use(authenticate);
router.use(enforceActiveBilling);
router.use(enforceFeature('camps'));

// Anyone working a camp desk can register attendees and move them through the pipeline.
const canWork = authorize('admin', 'receptionist', 'doctor', 'provider', 'nurse', 'staff');

const toCamelCase = (obj) => {
  if (!obj) return obj;
  const out = {};
  for (const key in obj) out[key.replace(/_([a-z])/g, (g) => g[1].toUpperCase())] = obj[key];
  return out;
};
const camelRows = (rows) => rows.map(toCamelCase);
const db_ = (req) => req.db || req.app.locals.pool;

async function withTx(db, fn) {
  await db.query('BEGIN');
  try {
    const out = await fn();
    await db.query('COMMIT');
    return out;
  } catch (err) {
    await db.query('ROLLBACK').catch(() => {});
    throw err;
  }
}

function fail(res, err, what) {
  if (err && err.status) {
    const body = { error: err.code || 'Error', message: err.message };
    if (err.candidates) body.candidates = err.candidates;
    return res.status(err.status).json(body);
  }
  console.error(`Error ${what}:`, err);
  return res.status(500).json({
    error: `Failed ${what}`, code: err && err.code, detail: (err && (err.detail || err.message)) || undefined,
  });
}

async function getRegistration(db, id) {
  const { rows } = await db.query('SELECT * FROM camp_registrations WHERE id = $1', [id]);
  if (!rows.length) throw camps.campError(404, 'RegistrationNotFound', 'Registration not found');
  return rows[0];
}

// ─── register ────────────────────────────────────────────────────────────────────────

// POST /api/camp-registrations
// { campId, fullName, phone, email, ageYears | dateOfBirth, gender, address, city,
//   consentGiven, consentFormSubmissionId, notes }
router.post('/', canWork, async (req, res) => {
  const {
    campId, fullName, phone, email, ageYears, dateOfBirth, gender,
    address, city, consentGiven, consentFormSubmissionId, notes,
  } = req.body || {};

  if (!campId) return res.status(400).json({ error: 'campId is required' });
  if (!fullName || !String(fullName).trim()) return res.status(400).json({ error: 'fullName is required' });
  if (ageYears == null && !dateOfBirth) {
    return res.status(400).json({
      error: 'AgeRequired',
      message: 'Record either an age or a date of birth — attendees often know one but not the other.',
    });
  }
  if (ageYears != null && (!Number.isInteger(Number(ageYears)) || Number(ageYears) < 0 || Number(ageYears) > 130)) {
    return res.status(400).json({ error: 'ageYears must be a whole number between 0 and 130' });
  }

  try {
    const db = db_(req);
    const out = await withTx(db, async () => {
      // The camp row is locked by allocateToken below; read status first so a closed camp
      // is refused before a token is burned.
      const camp = await camps.getCamp(db, campId);
      if (!['published', 'in_progress'].includes(camp.status)) {
        throw camps.campError(409, 'CampNotOpen',
          `"${camp.name}" is ${camp.status}. Attendees can be registered once it is published.`);
      }

      if (camp.capacity) {
        const { rows: cnt } = await db.query(
          "SELECT count(*)::int AS n FROM camp_registrations WHERE camp_id = $1 AND status <> 'cancelled'",
          [camp.id]
        );
        if (cnt[0].n >= camp.capacity) {
          throw camps.campError(409, 'CampFull',
            `"${camp.name}" has reached its capacity of ${camp.capacity}.`);
        }
      }

      const tokenNo = await camps.allocateToken(db, camp.id);

      const { rows } = await db.query(
        `INSERT INTO camp_registrations
           (camp_id, token_no, full_name, phone, email, age_years, date_of_birth, gender,
            address, city, consent_given_at, consent_form_submission_id, notes, registered_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         RETURNING *`,
        [camp.id, tokenNo, String(fullName).trim(), phone || null, email || null,
         ageYears ?? null, dateOfBirth || null, gender || null, address || null, city || null,
         consentGiven ? new Date() : null, consentFormSubmissionId || null,
         notes || null, req.user.id]
      );
      const registration = rows[0];

      // Put the attendee straight into the first station's queue, but only once the camp
      // is actually running — a pre-registration taken a week early should not appear on
      // today's board.
      let firstVisit = null;
      if (camp.status === 'in_progress') {
        const { rows: first } = await db.query(
          `SELECT * FROM camp_stations
            WHERE camp_id = $1 AND is_active
            ORDER BY step_order, name LIMIT 1`,
          [camp.id]
        );
        if (first.length && (!first[0].is_clinical || registration.consent_given_at)) {
          const { rows: v } = await db.query(
            `INSERT INTO camp_station_visits (registration_id, station_id)
             VALUES ($1,$2) RETURNING *`,
            [registration.id, first[0].id]
          );
          firstVisit = v[0];
        }
      }

      return { registration: toCamelCase(registration), firstVisit: toCamelCase(firstVisit) };
    });
    res.status(201).json(out);
  } catch (err) { fail(res, err, 'to register attendee'); }
});

// GET /api/camp-registrations?campId=&status=&q=&promoted=
router.get('/', async (req, res) => {
  const { campId, status, q, promoted } = req.query;
  if (!campId) return res.status(400).json({ error: 'campId is required' });
  try {
    const params = [campId];
    const where = ['r.camp_id = $1'];
    if (status) { params.push(status); where.push(`r.status = $${params.length}`); }
    if (promoted === 'true')  where.push('r.patient_id IS NOT NULL');
    if (promoted === 'false') where.push('r.patient_id IS NULL');
    if (q) {
      params.push(`%${q}%`);
      // Token numbers are what staff actually call out, so a bare number searches them.
      where.push(`(r.full_name ILIKE $${params.length} OR r.phone ILIKE $${params.length}`
        + (/^\d+$/.test(q) ? ` OR r.token_no = ${Number(q)}` : '') + ')');
    }
    const { rows } = await db_(req).query(
      `SELECT r.*, p.mrn
         FROM camp_registrations r
         LEFT JOIN patients p ON p.id = r.patient_id
        WHERE ${where.join(' AND ')}
        ORDER BY r.token_no DESC
        LIMIT 500`,
      params
    );
    res.json(camelRows(rows));
  } catch (err) { fail(res, err, 'to fetch registrations'); }
});

router.get('/:id', async (req, res) => {
  try {
    const db = db_(req);
    const { rows } = await db.query(
      `SELECT r.*, p.mrn, c.name AS camp_name, c.status AS camp_status
         FROM camp_registrations r
         LEFT JOIN patients p ON p.id = r.patient_id
         JOIN camps c ON c.id = r.camp_id
        WHERE r.id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'RegistrationNotFound' });
    const { rows: visits } = await db.query(
      `SELECT v.*, st.name AS station_name, st.step_order, st.is_clinical
         FROM camp_station_visits v JOIN camp_stations st ON st.id = v.station_id
        WHERE v.registration_id = $1
        ORDER BY st.step_order, st.name`,
      [req.params.id]
    );
    res.json({ ...toCamelCase(rows[0]), visits: camelRows(visits) });
  } catch (err) { fail(res, err, 'to fetch registration'); }
});

router.put('/:id', canWork, async (req, res) => {
  const { fullName, phone, email, ageYears, dateOfBirth, gender, address, city, notes } = req.body || {};
  try {
    const { rows } = await db_(req).query(
      `UPDATE camp_registrations SET
         full_name = COALESCE($1, full_name), phone = COALESCE($2, phone),
         email = COALESCE($3, email), age_years = COALESCE($4, age_years),
         date_of_birth = COALESCE($5, date_of_birth), gender = COALESCE($6, gender),
         address = COALESCE($7, address), city = COALESCE($8, city),
         notes = COALESCE($9, notes), updated_at = CURRENT_TIMESTAMP
       WHERE id = $10 RETURNING *`,
      [fullName ? String(fullName).trim() : null, phone ?? null, email ?? null,
       ageYears ?? null, dateOfBirth || null, gender ?? null, address ?? null,
       city ?? null, notes ?? null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'RegistrationNotFound' });
    res.json(toCamelCase(rows[0]));
  } catch (err) { fail(res, err, 'to update registration'); }
});

// POST /api/camp-registrations/:id/consent { consentFormSubmissionId }
router.post('/:id/consent', canWork, async (req, res) => {
  const { consentFormSubmissionId } = req.body || {};
  try {
    const { rows } = await db_(req).query(
      `UPDATE camp_registrations
          SET consent_given_at = COALESCE(consent_given_at, CURRENT_TIMESTAMP),
              consent_form_submission_id = COALESCE($1, consent_form_submission_id),
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $2 RETURNING *`,
      [consentFormSubmissionId || null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'RegistrationNotFound' });
    res.json(toCamelCase(rows[0]));
  } catch (err) { fail(res, err, 'to record consent'); }
});

router.post('/:id/status', canWork, async (req, res) => {
  const { status } = req.body || {};
  const STATUSES = ['registered', 'in_progress', 'completed', 'left_early', 'cancelled'];
  if (!STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${STATUSES.join(', ')}` });
  }
  try {
    const { rows } = await db_(req).query(
      `UPDATE camp_registrations SET status = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2 RETURNING *`,
      [status, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'RegistrationNotFound' });
    res.json(toCamelCase(rows[0]));
  } catch (err) { fail(res, err, 'to update registration status'); }
});

// ─── promotion to a patient record ───────────────────────────────────────────────────

// GET /api/camp-registrations/:id/match — who this attendee might already be.
router.get('/:id/match', canWork, async (req, res) => {
  try {
    const db = db_(req);
    const reg = await getRegistration(db, req.params.id);
    const candidates = await camps.matchCandidates(db, reg);
    res.json({ registrationId: reg.id, candidates: camelRows(candidates) });
  } catch (err) { fail(res, err, 'to match registration'); }
});

// POST /api/camp-registrations/:id/promote
// { patientId } to link an existing record, or { dateOfBirth } / { estimateDobFromAge }
// to create one.
router.post('/:id/promote', canWork, async (req, res) => {
  const { patientId, dateOfBirth, estimateDobFromAge } = req.body || {};
  try {
    const db = db_(req);
    const out = await withTx(db, () => camps.promoteRegistration(db, req.params.id, {
      patientId: patientId || null,
      dateOfBirth: dateOfBirth || null,
      estimateDobFromAge: Boolean(estimateDobFromAge),
      actorId: req.user.id,
      practiceId: req.tenant && req.tenant.practiceId,
    }));
    res.json({
      patient: toCamelCase(out.patient),
      created: out.created,
      linked: out.linked,
      alreadyPromoted: Boolean(out.alreadyPromoted),
      dateOfBirthEstimated: Boolean(out.dateOfBirthEstimated),
    });
  } catch (err) { fail(res, err, 'to promote registration'); }
});

// ─── queueing ────────────────────────────────────────────────────────────────────────

// POST /api/camp-registrations/:id/queue { stationId }
router.post('/:id/queue', canWork, async (req, res) => {
  const { stationId } = req.body || {};
  if (!stationId) return res.status(400).json({ error: 'stationId is required' });
  try {
    const db = db_(req);
    const out = await withTx(db, async () => {
      const reg = await getRegistration(db, req.params.id);
      const { rows: st } = await db.query(
        'SELECT * FROM camp_stations WHERE id = $1 AND camp_id = $2', [stationId, reg.camp_id]
      );
      if (!st.length) {
        throw camps.campError(404, 'StationNotFound', 'That station does not belong to this camp.');
      }
      if (!st[0].is_active) {
        throw camps.campError(409, 'StationInactive', `Station "${st[0].name}" is not active.`);
      }

      // The consent gate. A clinical station cannot be entered — not even queued for —
      // until consent is on record.
      await camps.assertConsent(db, reg, st[0]);

      const { rows } = await db.query(
        `INSERT INTO camp_station_visits (registration_id, station_id)
         VALUES ($1,$2)
         ON CONFLICT (registration_id, station_id) DO UPDATE
           SET status = CASE WHEN camp_station_visits.status = 'completed'
                             THEN camp_station_visits.status ELSE 'queued' END,
               updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [reg.id, stationId]
      );
      return toCamelCase(rows[0]);
    });
    res.status(201).json(out);
  } catch (err) { fail(res, err, 'to queue attendee'); }
});

module.exports = router;
