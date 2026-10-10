// Camp reporting — two audiences, two endpoints, deliberately not one endpoint with a flag.
//
// The internal report is ordinary PHI: staff see attendees, tokens and outcomes.
//
// The SPONSOR report is the part to be careful about. A sponsor funds the camp and wants
// to know what it achieved; they must never receive patient data. That is implemented as a
// separate route with its own allowlisted projection, because a filter applied to the
// clinical report can be forgotten in a later edit and an allowlist cannot: a column that
// is not named here cannot leave. Small buckets are also suppressed — in a camp of 80
// people, "1 attendee screened positive for X" plus local knowledge can identify someone.

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { enforceActiveBilling, enforceFeature } = require('../middleware/planEnforcement');
const camps = require('../services/camps');
const { logPhiRead } = require('../services/phiAudit');

router.use(authenticate);
router.use(enforceActiveBilling);
router.use(enforceFeature('camps'));

const toCamelCase = (obj) => {
  if (!obj) return obj;
  const out = {};
  for (const key in obj) out[key.replace(/_([a-z])/g, (g) => g[1].toUpperCase())] = obj[key];
  return out;
};
const camelRows = (rows) => rows.map(toCamelCase);
const db_ = (req) => req.db || req.app.locals.pool;

/** Buckets smaller than this are rolled into "other" in anything a sponsor receives. */
const MIN_BUCKET = 5;

const AGE_BANDS = `CASE
    WHEN COALESCE(r.age_years,
                  date_part('year', age(r.date_of_birth))::int) < 5  THEN '0-4'
    WHEN COALESCE(r.age_years,
                  date_part('year', age(r.date_of_birth))::int) < 13 THEN '5-12'
    WHEN COALESCE(r.age_years,
                  date_part('year', age(r.date_of_birth))::int) < 20 THEN '13-19'
    WHEN COALESCE(r.age_years,
                  date_part('year', age(r.date_of_birth))::int) < 40 THEN '20-39'
    WHEN COALESCE(r.age_years,
                  date_part('year', age(r.date_of_birth))::int) < 60 THEN '40-59'
    ELSE '60+'
  END`;

// ─── internal report ─────────────────────────────────────────────────────────────────

// GET /api/camp-reports/:campId — for the people running the camp.
router.get('/:campId', async (req, res) => {
  try {
    const db = db_(req);
    const camp = await camps.getCamp(db, req.params.campId);

    const [totals, byStation, byOutcome, referrals, cost] = await Promise.all([
      db.query(
        `SELECT count(*)::int AS registrations,
                count(*) FILTER (WHERE patient_id IS NOT NULL)::int AS promoted,
                count(*) FILTER (WHERE consent_given_at IS NOT NULL)::int AS consented,
                count(*) FILTER (WHERE status = 'completed')::int AS completed,
                count(*) FILTER (WHERE status = 'left_early')::int AS left_early
           FROM camp_registrations WHERE camp_id = $1`,
        [camp.id]
      ),
      db.query(
        `SELECT st.name AS station, st.step_order,
                count(v.id)::int AS visits,
                count(v.id) FILTER (WHERE v.status = 'completed')::int AS completed,
                ROUND(AVG(EXTRACT(EPOCH FROM (v.started_at - v.queued_at)))::numeric, 0) AS avg_wait_seconds,
                ROUND(AVG(EXTRACT(EPOCH FROM (v.completed_at - v.started_at)))::numeric, 0) AS avg_service_seconds
           FROM camp_stations st
           LEFT JOIN camp_station_visits v ON v.station_id = st.id
          WHERE st.camp_id = $1
          GROUP BY st.id, st.name, st.step_order
          ORDER BY st.step_order, st.name`,
        [camp.id]
      ),
      db.query(
        `SELECT COALESCE(v.outcome, 'unrecorded') AS outcome, count(*)::int AS n
           FROM camp_station_visits v
           JOIN camp_stations st ON st.id = v.station_id
          WHERE st.camp_id = $1 AND v.status = 'completed'
          GROUP BY 1 ORDER BY 2 DESC`,
        [camp.id]
      ),
      // Referral conversion: the camp attendee who later books at the clinic. This is the
      // commercial case for running camps at all, so it is a first-class figure rather
      // than a footnote.
      db.query(
        `SELECT count(DISTINCT r.id)::int AS referred_attendees,
                count(DISTINCT a.id)::int AS follow_up_appointments
           FROM camp_registrations r
           LEFT JOIN appointments a
                  ON a.patient_id = r.patient_id
                 AND (a.camp_id IS NULL OR a.camp_id <> r.camp_id)
                 AND a.start_time > $2
          WHERE r.camp_id = $1 AND r.patient_id IS NOT NULL`,
        [camp.id, camp.starts_at]
      ),
      camps.costSummary(db, camp.id),
    ]);

    await logPhiRead(req, {
      resourceType: 'camp_report', resourceId: camp.id, action: 'view',
      description: `Internal report for camp "${camp.name}"`,
    });

    res.json({
      camp: toCamelCase(camp),
      totals: toCamelCase(totals.rows[0]),
      stations: camelRows(byStation.rows),
      outcomes: camelRows(byOutcome.rows),
      referrals: toCamelCase(referrals.rows[0]),
      cost: toCamelCase(cost),
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.code, message: err.message });
    console.error('Error building camp report:', err);
    res.status(500).json({ error: 'Failed to build camp report', detail: err.message });
  }
});

// ─── sponsor report ──────────────────────────────────────────────────────────────────

// GET /api/camp-reports/:campId/sponsor
//
// Admin-only, aggregate-only, and audited. Every figure below is a count. There is no
// code path here that selects a name, a phone number, a date of birth, a token, a free-text
// note or a patient id — and that is the point: the projection is the control.
router.get('/:campId/sponsor', authorize('admin'), async (req, res) => {
  try {
    const db = db_(req);
    const camp = await camps.getCamp(db, req.params.campId);

    const attendance = await db.query(
      `SELECT count(*)::int AS attendees,
              count(*) FILTER (WHERE status = 'completed')::int AS completed_pipeline
         FROM camp_registrations r
        WHERE camp_id = $1 AND status <> 'cancelled'`,
      [camp.id]
    );

    const byAge = await db.query(
      `SELECT ${AGE_BANDS} AS band, count(*)::int AS n
         FROM camp_registrations r
        WHERE r.camp_id = $1 AND r.status <> 'cancelled'
        GROUP BY 1 ORDER BY 1`,
      [camp.id]
    );

    const byGender = await db.query(
      `SELECT COALESCE(NULLIF(TRIM(r.gender), ''), 'not recorded') AS gender, count(*)::int AS n
         FROM camp_registrations r
        WHERE r.camp_id = $1 AND r.status <> 'cancelled'
        GROUP BY 1 ORDER BY 2 DESC`,
      [camp.id]
    );

    const services = await db.query(
      `SELECT COALESCE(o.name, s.label) AS service, count(v.id)::int AS delivered
         FROM camp_services s
         LEFT JOIN healthcare_offerings o ON o.id = s.offering_id
         LEFT JOIN camp_stations st ON st.camp_id = s.camp_id AND st.offering_id = s.offering_id
         LEFT JOIN camp_station_visits v ON v.station_id = st.id AND v.status = 'completed'
        WHERE s.camp_id = $1
        GROUP BY 1 ORDER BY 2 DESC`,
      [camp.id]
    );

    // Conditions screened. diagnosis_name is clinical vocabulary, not patient data, but the
    // COUNT is what can re-identify in a small cohort — hence suppression below.
    const conditions = await db.query(
      `SELECT d.diagnosis_name AS condition, count(DISTINCT d.patient_id)::int AS n
         FROM diagnosis d
        WHERE d.camp_id = $1
        GROUP BY 1 ORDER BY 2 DESC`,
      [camp.id]
    );

    const referrals = await db.query(
      `SELECT count(*)::int AS referrals_made
         FROM camp_station_visits v
         JOIN camp_stations st ON st.id = v.station_id
        WHERE st.camp_id = $1 AND v.outcome IN ('referred', 'follow_up')`,
      [camp.id]
    );

    /** Roll buckets below MIN_BUCKET into a single "other" row. */
    const suppress = (rows, labelKey) => {
      const kept = [];
      let other = 0;
      for (const row of rows) {
        if (row.n >= MIN_BUCKET) kept.push({ [labelKey]: row[labelKey], count: row.n });
        else other += row.n;
      }
      if (other > 0) kept.push({ [labelKey]: 'other (small groups combined)', count: other });
      return kept;
    };

    await logPhiRead(req, {
      resourceType: 'camp_sponsor_report', resourceId: camp.id, action: 'export',
      description: `Sponsor report exported for camp "${camp.name}" (aggregates only)`,
    });

    res.json({
      camp: {
        name: camp.name,
        startsAt: camp.starts_at,
        endsAt: camp.ends_at,
        sponsorName: camp.sponsor_name,
        fundingSource: camp.funding_source,
      },
      attendance: {
        attendees: attendance.rows[0].attendees,
        completedPipeline: attendance.rows[0].completed_pipeline,
      },
      ageBands: suppress(byAge.rows.map((r) => ({ band: r.band, n: r.n })), 'band'),
      gender: suppress(byGender.rows.map((r) => ({ gender: r.gender, n: r.n })), 'gender'),
      servicesDelivered: services.rows.map((r) => ({ service: r.service, delivered: r.delivered })),
      conditionsScreened: suppress(
        conditions.rows.map((r) => ({ condition: r.condition, n: r.n })), 'condition'
      ),
      referralsMade: referrals.rows[0].referrals_made,
      disclosure: {
        aggregatesOnly: true,
        minimumBucketSize: MIN_BUCKET,
        note: 'Counts only. No attendee identifiers, contact details, dates of birth or clinical notes are included. Groups smaller than the minimum bucket size are combined.',
      },
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.code, message: err.message });
    console.error('Error building sponsor report:', err);
    res.status(500).json({ error: 'Failed to build sponsor report', detail: err.message });
  }
});

module.exports = router;
