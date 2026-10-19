const express = require('express');
const { authenticate } = require('../middleware/auth');
const router = express.Router();
router.use(authenticate);

const getDateRange = (query) => {
  const { startDate, endDate, days } = query;
  if (startDate && endDate) return { startDate, endDate };
  const end = new Date();
  const d = parseInt(days) || 30;
  const start = new Date();
  start.setDate(start.getDate() - d);
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  };
};

// ─────────────────────────────────────────────
// OPERATIONAL REPORTS
// ─────────────────────────────────────────────

router.get('/operational/daily-appointments', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { startDate, endDate } = getDateRange(req.query);

    const summaryResult = await pool.query(`
      SELECT
        DATE(a.start_time) AS date,
        COUNT(*)::int AS total,
        COUNT(CASE WHEN LOWER(a.status) = 'completed' THEN 1 END)::int AS completed,
        COUNT(CASE WHEN LOWER(a.status) IN ('cancelled','canceled') THEN 1 END)::int AS cancelled,
        COUNT(CASE WHEN LOWER(a.status) = 'no-show' THEN 1 END)::int AS no_shows,
        COUNT(CASE WHEN LOWER(a.status) IN ('confirmed','scheduled') THEN 1 END)::int AS confirmed,
        COUNT(CASE WHEN LOWER(a.status) = 'pending' THEN 1 END)::int AS pending
      FROM appointments a
      WHERE DATE(a.start_time) BETWEEN $1 AND $2
      GROUP BY DATE(a.start_time)
      ORDER BY date DESC
    `, [startDate, endDate]);

    const detailResult = await pool.query(`
      SELECT
        a.id, a.start_time, a.end_time, a.status, a.appointment_type AS type, a.reason,
        CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
        p.id AS patient_id, p.phone AS patient_phone, p.email AS patient_email,
        CONCAT(pr.first_name, ' ', pr.last_name) AS provider_name,
        pr.specialization AS provider_specialization
      FROM appointments a
      LEFT JOIN patients p ON a.patient_id = p.id
      LEFT JOIN providers pr ON a.provider_id = pr.id
      WHERE DATE(a.start_time) BETWEEN $1 AND $2
      ORDER BY a.start_time DESC
      LIMIT 500
    `, [startDate, endDate]);

    res.json({ summary: summaryResult.rows, details: detailResult.rows });
  } catch (error) {
    console.error('Daily appointments report error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/operational/provider-utilization', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { startDate, endDate } = getDateRange(req.query);

    const summaryResult = await pool.query(`
      SELECT
        pr.id AS provider_id,
        CONCAT(pr.first_name, ' ', pr.last_name) AS provider_name,
        pr.specialization,
        COUNT(a.id)::int AS total_appointments,
        COUNT(CASE WHEN LOWER(a.status) = 'completed' THEN 1 END)::int AS completed,
        COUNT(CASE WHEN LOWER(a.status) IN ('cancelled','canceled') THEN 1 END)::int AS cancelled,
        COUNT(CASE WHEN LOWER(a.status) = 'no-show' THEN 1 END)::int AS no_shows,
        ROUND(
          COUNT(CASE WHEN LOWER(a.status) = 'completed' THEN 1 END)::numeric /
          NULLIF(COUNT(a.id), 0) * 100, 1
        ) AS utilization_rate
      FROM providers pr
      LEFT JOIN appointments a ON pr.id = a.provider_id
        AND DATE(a.start_time) BETWEEN $1 AND $2
      GROUP BY pr.id, pr.first_name, pr.last_name, pr.specialization
      ORDER BY total_appointments DESC
    `, [startDate, endDate]);

    const detailResult = await pool.query(`
      SELECT
        a.id, a.start_time, a.status, a.appointment_type AS type,
        CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
        CONCAT(pr.first_name, ' ', pr.last_name) AS provider_name,
        pr.specialization
      FROM appointments a
      LEFT JOIN patients p ON a.patient_id = p.id
      LEFT JOIN providers pr ON a.provider_id = pr.id
      WHERE DATE(a.start_time) BETWEEN $1 AND $2
      ORDER BY pr.last_name, a.start_time DESC
      LIMIT 500
    `, [startDate, endDate]);

    res.json({ summary: summaryResult.rows, details: detailResult.rows });
  } catch (error) {
    console.error('Provider utilization error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/operational/patient-visits', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { startDate, endDate } = getDateRange(req.query);

    const summaryResult = await pool.query(`
      SELECT
        CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
        p.id AS patient_id,
        p.date_of_birth,
        p.gender,
        COUNT(a.id)::int AS visit_count,
        MAX(a.start_time) AS last_visit,
        MIN(a.start_time) AS first_visit
      FROM patients p
      INNER JOIN appointments a ON p.id = a.patient_id
        AND DATE(a.start_time) BETWEEN $1 AND $2
        AND LOWER(a.status) = 'completed'
      GROUP BY p.id, p.first_name, p.last_name, p.date_of_birth, p.gender
      ORDER BY visit_count DESC
      LIMIT 200
    `, [startDate, endDate]);

    const detailResult = await pool.query(`
      SELECT
        a.id, a.start_time, a.status, a.appointment_type AS type, a.reason,
        CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
        p.id AS patient_id,
        CONCAT(pr.first_name, ' ', pr.last_name) AS provider_name,
        pr.specialization
      FROM appointments a
      LEFT JOIN patients p ON a.patient_id = p.id
      LEFT JOIN providers pr ON a.provider_id = pr.id
      WHERE DATE(a.start_time) BETWEEN $1 AND $2
        AND LOWER(a.status) = 'completed'
      ORDER BY a.start_time DESC
      LIMIT 500
    `, [startDate, endDate]);

    res.json({ summary: summaryResult.rows, details: detailResult.rows });
  } catch (error) {
    console.error('Patient visits error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/operational/no-shows', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { startDate, endDate } = getDateRange(req.query);

    const summaryResult = await pool.query(`
      SELECT
        DATE(a.start_time) AS date,
        COUNT(CASE WHEN LOWER(a.status) = 'no-show' THEN 1 END)::int AS no_shows,
        COUNT(*)::int AS total_appointments,
        ROUND(
          COUNT(CASE WHEN LOWER(a.status) = 'no-show' THEN 1 END)::numeric /
          NULLIF(COUNT(*), 0) * 100, 1
        ) AS no_show_rate
      FROM appointments a
      WHERE DATE(a.start_time) BETWEEN $1 AND $2
      GROUP BY DATE(a.start_time)
      ORDER BY date DESC
    `, [startDate, endDate]);

    const detailResult = await pool.query(`
      SELECT
        a.id, a.start_time, a.status, a.appointment_type AS type, a.reason,
        CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
        p.id AS patient_id, p.phone AS patient_phone, p.email AS patient_email,
        CONCAT(pr.first_name, ' ', pr.last_name) AS provider_name
      FROM appointments a
      LEFT JOIN patients p ON a.patient_id = p.id
      LEFT JOIN providers pr ON a.provider_id = pr.id
      WHERE DATE(a.start_time) BETWEEN $1 AND $2
        AND LOWER(a.status) IN ('no-show', 'cancelled', 'canceled')
      ORDER BY a.start_time DESC
      LIMIT 500
    `, [startDate, endDate]);

    res.json({ summary: summaryResult.rows, details: detailResult.rows });
  } catch (error) {
    console.error('No-show report error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/operational/wait-times', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { startDate, endDate } = getDateRange(req.query);

    const summaryResult = await pool.query(`
      SELECT
        CONCAT(pr.first_name, ' ', pr.last_name) AS provider_name,
        pr.specialization,
        COUNT(a.id)::int AS total_appointments,
        COALESCE(
          ROUND(AVG(
            GREATEST(0, EXTRACT(EPOCH FROM (a.updated_at - a.start_time)) / 60)
          )::numeric, 0), 0
        ) AS avg_wait_minutes
      FROM appointments a
      LEFT JOIN providers pr ON a.provider_id = pr.id
      WHERE DATE(a.start_time) BETWEEN $1 AND $2
        AND LOWER(a.status) = 'completed'
        AND a.updated_at > a.start_time
      GROUP BY pr.id, pr.first_name, pr.last_name, pr.specialization
      ORDER BY avg_wait_minutes DESC
    `, [startDate, endDate]);

    const detailResult = await pool.query(`
      SELECT
        a.id, a.start_time, a.updated_at, a.status, a.appointment_type AS type,
        CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
        CONCAT(pr.first_name, ' ', pr.last_name) AS provider_name,
        GREATEST(0, ROUND(EXTRACT(EPOCH FROM (a.updated_at - a.start_time)) / 60)::int) AS wait_minutes
      FROM appointments a
      LEFT JOIN patients p ON a.patient_id = p.id
      LEFT JOIN providers pr ON a.provider_id = pr.id
      WHERE DATE(a.start_time) BETWEEN $1 AND $2
        AND LOWER(a.status) = 'completed'
      ORDER BY a.start_time DESC
      LIMIT 500
    `, [startDate, endDate]);

    res.json({ summary: summaryResult.rows, details: detailResult.rows });
  } catch (error) {
    console.error('Wait time report error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────
// FINANCIAL REPORTS
// ─────────────────────────────────────────────

router.get('/financial/revenue', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { startDate, endDate } = getDateRange(req.query);

    const summaryResult = await pool.query(`
      SELECT
        DATE(c.service_date) AS date,
        COUNT(c.id)::int AS claim_count,
        COALESCE(SUM(c.amount), 0)::numeric AS total_billed,
        COALESCE(SUM(CASE WHEN LOWER(c.status) IN ('approved','paid') THEN c.amount ELSE 0 END), 0)::numeric AS approved_amount,
        COALESCE(SUM(CASE WHEN LOWER(c.status) = 'denied' THEN c.amount ELSE 0 END), 0)::numeric AS denied_amount,
        COALESCE(SUM(CASE WHEN LOWER(c.status) = 'pending' THEN c.amount ELSE 0 END), 0)::numeric AS pending_amount
      FROM claims c
      WHERE c.service_date BETWEEN $1 AND $2
      GROUP BY DATE(c.service_date)
      ORDER BY date DESC
    `, [startDate, endDate]);

    const detailResult = await pool.query(`
      SELECT
        c.id, c.claim_number, c.service_date, c.status, c.amount, c.payer,
        CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
        p.id AS patient_id
      FROM claims c
      LEFT JOIN patients p ON c.patient_id = p.id
      WHERE c.service_date BETWEEN $1 AND $2
      ORDER BY c.service_date DESC
      LIMIT 500
    `, [startDate, endDate]);

    res.json({ summary: summaryResult.rows, details: detailResult.rows });
  } catch (error) {
    console.error('Revenue report error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/financial/billing-summary', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { startDate, endDate } = getDateRange(req.query);

    const summaryResult = await pool.query(`
      SELECT
        c.status,
        COUNT(c.id)::int AS count,
        COALESCE(SUM(c.amount), 0)::numeric AS total_amount,
        COALESCE(AVG(c.amount), 0)::numeric AS avg_amount
      FROM claims c
      WHERE c.service_date BETWEEN $1 AND $2
      GROUP BY c.status
      ORDER BY total_amount DESC
    `, [startDate, endDate]);

    const payerSummary = await pool.query(`
      SELECT
        COALESCE(c.payer, 'Unknown') AS payer,
        COUNT(c.id)::int AS claim_count,
        COALESCE(SUM(c.amount), 0)::numeric AS total_billed,
        COALESCE(SUM(CASE WHEN LOWER(c.status) IN ('approved','paid') THEN c.amount ELSE 0 END), 0)::numeric AS paid_amount
      FROM claims c
      WHERE c.service_date BETWEEN $1 AND $2
      GROUP BY c.payer
      ORDER BY total_billed DESC
      LIMIT 20
    `, [startDate, endDate]);

    const detailResult = await pool.query(`
      SELECT
        c.id, c.claim_number, c.service_date, c.status, c.amount, c.payer,
        CONCAT(p.first_name, ' ', p.last_name) AS patient_name
      FROM claims c
      LEFT JOIN patients p ON c.patient_id = p.id
      WHERE c.service_date BETWEEN $1 AND $2
      ORDER BY c.service_date DESC
      LIMIT 500
    `, [startDate, endDate]);

    res.json({ summary: summaryResult.rows, payerSummary: payerSummary.rows, details: detailResult.rows });
  } catch (error) {
    console.error('Billing summary error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/financial/outstanding-payments', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { startDate, endDate } = getDateRange(req.query);

    const summaryResult = await pool.query(`
      SELECT
        COALESCE(c.payer, 'Self-Pay') AS payer,
        COUNT(c.id)::int AS claim_count,
        COALESCE(SUM(c.amount), 0)::numeric AS outstanding_amount,
        MIN(c.service_date) AS oldest_claim_date
      FROM claims c
      WHERE LOWER(c.status) IN ('pending','submitted','in-review','in_review')
        AND c.service_date BETWEEN $1 AND $2
      GROUP BY c.payer
      ORDER BY outstanding_amount DESC
    `, [startDate, endDate]);

    const agingResult = await pool.query(`
      SELECT
        CASE
          WHEN (CURRENT_DATE - c.service_date) <= 30 THEN '0-30 days'
          WHEN (CURRENT_DATE - c.service_date) <= 60 THEN '31-60 days'
          WHEN (CURRENT_DATE - c.service_date) <= 90 THEN '61-90 days'
          ELSE '90+ days'
        END AS aging_bucket,
        COUNT(c.id)::int AS claim_count,
        COALESCE(SUM(c.amount), 0)::numeric AS total_amount
      FROM claims c
      WHERE LOWER(c.status) IN ('pending','submitted','in-review','in_review')
      GROUP BY aging_bucket
      ORDER BY aging_bucket
    `);

    const detailResult = await pool.query(`
      SELECT
        c.id, c.claim_number, c.service_date, c.status, c.amount, c.payer,
        (CURRENT_DATE - c.service_date)::int AS days_outstanding,
        CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
        p.id AS patient_id, p.phone AS patient_phone
      FROM claims c
      LEFT JOIN patients p ON c.patient_id = p.id
      WHERE LOWER(c.status) IN ('pending','submitted','in-review','in_review')
        AND c.service_date BETWEEN $1 AND $2
      ORDER BY days_outstanding DESC
      LIMIT 500
    `, [startDate, endDate]);

    res.json({ summary: summaryResult.rows, aging: agingResult.rows, details: detailResult.rows });
  } catch (error) {
    console.error('Outstanding payments error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/financial/payment-collection', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { startDate, endDate } = getDateRange(req.query);

    const summaryResult = await pool.query(`
      SELECT
        DATE(p.payment_date) AS date,
        COUNT(p.id)::int AS payment_count,
        COALESCE(SUM(p.amount), 0)::numeric AS total_collected,
        COALESCE(AVG(p.amount), 0)::numeric AS avg_payment
      FROM payments p
      WHERE DATE(p.payment_date) BETWEEN $1 AND $2
        AND p.amount > 0
      GROUP BY DATE(p.payment_date)
      ORDER BY date DESC
    `, [startDate, endDate]);

    const methodResult = await pool.query(`
      SELECT
        COALESCE(p.payment_method, 'Unknown') AS payment_method,
        COUNT(p.id)::int AS count,
        COALESCE(SUM(p.amount), 0)::numeric AS total_amount
      FROM payments p
      WHERE DATE(p.payment_date) BETWEEN $1 AND $2
        AND p.amount > 0
      GROUP BY p.payment_method
      ORDER BY total_amount DESC
    `, [startDate, endDate]);

    const detailResult = await pool.query(`
      SELECT
        p.id, p.payment_date, p.amount, p.payment_method, p.payment_status AS status,
        CONCAT(pat.first_name, ' ', pat.last_name) AS patient_name,
        pat.id AS patient_id
      FROM payments p
      LEFT JOIN patients pat ON p.patient_id = pat.id
      WHERE DATE(p.payment_date) BETWEEN $1 AND $2
        AND p.amount > 0
      ORDER BY p.payment_date DESC
      LIMIT 500
    `, [startDate, endDate]);

    res.json({ summary: summaryResult.rows, byMethod: methodResult.rows, details: detailResult.rows });
  } catch (error) {
    console.error('Payment collection error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/financial/refunds', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { startDate, endDate } = getDateRange(req.query);

    const summaryResult = await pool.query(`
      SELECT
        DATE(p.payment_date) AS date,
        COUNT(p.id)::int AS refund_count,
        COALESCE(SUM(ABS(p.amount)), 0)::numeric AS total_refunded
      FROM payments p
      WHERE DATE(p.payment_date) BETWEEN $1 AND $2
        AND (LOWER(p.payment_status) = 'refunded' OR p.amount < 0)
      GROUP BY DATE(p.payment_date)
      ORDER BY date DESC
    `, [startDate, endDate]);

    const detailResult = await pool.query(`
      SELECT
        p.id, p.payment_date, p.amount, p.payment_method, p.payment_status AS status, p.notes,
        CONCAT(pat.first_name, ' ', pat.last_name) AS patient_name,
        pat.id AS patient_id
      FROM payments p
      LEFT JOIN patients pat ON p.patient_id = pat.id
      WHERE DATE(p.payment_date) BETWEEN $1 AND $2
        AND (LOWER(p.payment_status) = 'refunded' OR p.amount < 0)
      ORDER BY p.payment_date DESC
      LIMIT 500
    `, [startDate, endDate]);

    res.json({ summary: summaryResult.rows, details: detailResult.rows });
  } catch (error) {
    console.error('Refund report error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────
// INSURANCE & CLAIMS REPORTS
// ─────────────────────────────────────────────

router.get('/insurance/claim-status', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { startDate, endDate } = getDateRange(req.query);

    const summaryResult = await pool.query(`
      SELECT
        c.status,
        COUNT(c.id)::int AS count,
        COALESCE(SUM(c.amount), 0)::numeric AS total_amount,
        COALESCE(AVG(c.amount), 0)::numeric AS avg_amount,
        ROUND(COUNT(c.id)::numeric / NULLIF(SUM(COUNT(c.id)) OVER (), 0) * 100, 1) AS percentage
      FROM claims c
      WHERE c.service_date BETWEEN $1 AND $2
      GROUP BY c.status
      ORDER BY count DESC
    `, [startDate, endDate]);

    const detailResult = await pool.query(`
      SELECT
        c.id, c.claim_number, c.service_date, c.status, c.amount, c.payer,
        CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
        p.id AS patient_id,
        c.created_at, c.updated_at
      FROM claims c
      LEFT JOIN patients p ON c.patient_id = p.id
      WHERE c.service_date BETWEEN $1 AND $2
      ORDER BY c.service_date DESC
      LIMIT 500
    `, [startDate, endDate]);

    res.json({ summary: summaryResult.rows, details: detailResult.rows });
  } catch (error) {
    console.error('Claim status error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/insurance/claim-rejections', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { startDate, endDate } = getDateRange(req.query);

    const summaryResult = await pool.query(`
      SELECT
        COALESCE(c.payer, 'Unknown') AS payer,
        COUNT(c.id)::int AS rejected_count,
        COALESCE(SUM(c.amount), 0)::numeric AS rejected_amount
      FROM claims c
      WHERE c.service_date BETWEEN $1 AND $2
        AND LOWER(c.status) IN ('denied','rejected')
      GROUP BY c.payer
      ORDER BY rejected_count DESC
    `, [startDate, endDate]);

    const detailResult = await pool.query(`
      SELECT
        c.id, c.claim_number, c.service_date, c.status, c.amount, c.payer,
        CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
        p.id AS patient_id
      FROM claims c
      LEFT JOIN patients p ON c.patient_id = p.id
      WHERE c.service_date BETWEEN $1 AND $2
        AND LOWER(c.status) IN ('denied','rejected')
      ORDER BY c.service_date DESC
      LIMIT 500
    `, [startDate, endDate]);

    res.json({ summary: summaryResult.rows, details: detailResult.rows });
  } catch (error) {
    console.error('Claim rejections error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/insurance/denial-analysis', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { startDate, endDate } = getDateRange(req.query);

    const summaryResult = await pool.query(`
      SELECT
        COALESCE(d.denial_category, d.denial_reason_code, 'Unknown') AS denial_reason,
        COUNT(d.id)::int AS count,
        COALESCE(SUM(d.denial_amount), 0)::numeric AS denied_amount,
        ip.name AS payer
      FROM denials d
      LEFT JOIN insurance_payers ip ON d.insurance_payer_id = ip.id
      WHERE d.denial_date BETWEEN $1 AND $2
      GROUP BY COALESCE(d.denial_category, d.denial_reason_code, 'Unknown'), ip.name
      ORDER BY count DESC
      LIMIT 20
    `, [startDate, endDate]);

    const detailResult = await pool.query(`
      SELECT
        d.id, d.denial_number, d.denial_date AS created_at,
        COALESCE(d.denial_category, d.denial_reason_code, 'Unknown') AS denial_reason,
        d.denial_reason_description,
        d.denial_amount AS denied_amount,
        ip.name AS payer,
        d.status, d.appeal_status,
        CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
        p.id AS patient_id
      FROM denials d
      LEFT JOIN insurance_payers ip ON d.insurance_payer_id = ip.id
      LEFT JOIN patients p ON d.patient_id = p.id
      WHERE d.denial_date BETWEEN $1 AND $2
      ORDER BY d.denial_date DESC
      LIMIT 500
    `, [startDate, endDate]);

    res.json({ summary: summaryResult.rows, details: detailResult.rows });
  } catch (error) {
    console.error('Denial analysis error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/insurance/payer-performance', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { startDate, endDate } = getDateRange(req.query);

    const summaryResult = await pool.query(`
      SELECT
        COALESCE(c.payer, 'Unknown') AS payer,
        COUNT(c.id)::int AS total_claims,
        COUNT(CASE WHEN LOWER(c.status) IN ('approved','paid') THEN 1 END)::int AS approved,
        COUNT(CASE WHEN LOWER(c.status) IN ('denied','rejected') THEN 1 END)::int AS denied,
        COUNT(CASE WHEN LOWER(c.status) IN ('pending','submitted') THEN 1 END)::int AS pending,
        COALESCE(SUM(c.amount), 0)::numeric AS total_billed,
        COALESCE(SUM(CASE WHEN LOWER(c.status) IN ('approved','paid') THEN c.amount ELSE 0 END), 0)::numeric AS paid_amount,
        ROUND(
          COUNT(CASE WHEN LOWER(c.status) IN ('approved','paid') THEN 1 END)::numeric /
          NULLIF(COUNT(c.id), 0) * 100, 1
        ) AS approval_rate
      FROM claims c
      WHERE c.service_date BETWEEN $1 AND $2
      GROUP BY c.payer
      ORDER BY total_claims DESC
    `, [startDate, endDate]);

    const detailResult = await pool.query(`
      SELECT
        c.id, c.claim_number, c.service_date, c.status, c.amount,
        COALESCE(c.payer, 'Unknown') AS payer,
        CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
        p.id AS patient_id
      FROM claims c
      LEFT JOIN patients p ON c.patient_id = p.id
      WHERE c.service_date BETWEEN $1 AND $2
      ORDER BY c.payer, c.service_date DESC
      LIMIT 500
    `, [startDate, endDate]);

    res.json({ summary: summaryResult.rows, details: detailResult.rows });
  } catch (error) {
    console.error('Payer performance error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────
// PATIENT REPORTS
// ─────────────────────────────────────────────

router.get('/patient/demographics', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request

    const genderResult = await pool.query(`
      SELECT COALESCE(gender, 'Unknown') AS gender, COUNT(id)::int AS count
      FROM patients GROUP BY gender ORDER BY count DESC
    `);

    const ageResult = await pool.query(`
      SELECT
        CASE
          WHEN EXTRACT(YEAR FROM AGE(date_of_birth)) < 18 THEN '0-17'
          WHEN EXTRACT(YEAR FROM AGE(date_of_birth)) < 30 THEN '18-29'
          WHEN EXTRACT(YEAR FROM AGE(date_of_birth)) < 45 THEN '30-44'
          WHEN EXTRACT(YEAR FROM AGE(date_of_birth)) < 60 THEN '45-59'
          WHEN EXTRACT(YEAR FROM AGE(date_of_birth)) < 75 THEN '60-74'
          ELSE '75+'
        END AS age_group,
        COUNT(id)::int AS count
      FROM patients WHERE date_of_birth IS NOT NULL
      GROUP BY age_group ORDER BY age_group
    `);

    const stateResult = await pool.query(`
      SELECT COALESCE(state, 'Unknown') AS state, COUNT(id)::int AS count
      FROM patients GROUP BY state ORDER BY count DESC LIMIT 20
    `);

    const detailResult = await pool.query(`
      SELECT
        p.id, p.first_name, p.last_name, p.date_of_birth, p.gender,
        p.phone, p.email, p.city, p.state, p.zip,
        p.insurance, p.created_at,
        EXTRACT(YEAR FROM AGE(p.date_of_birth))::int AS age
      FROM patients p
      ORDER BY p.created_at DESC
      LIMIT 500
    `);

    res.json({
      byGender: genderResult.rows,
      byAge: ageResult.rows,
      byState: stateResult.rows,
      details: detailResult.rows
    });
  } catch (error) {
    console.error('Patient demographics error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/patient/visit-history', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { startDate, endDate } = getDateRange(req.query);

    const summaryResult = await pool.query(`
      SELECT
        CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
        p.id AS patient_id,
        COUNT(a.id)::int AS total_visits,
        COUNT(CASE WHEN LOWER(a.status) = 'completed' THEN 1 END)::int AS completed_visits,
        MAX(a.start_time) AS last_visit
      FROM patients p
      INNER JOIN appointments a ON p.id = a.patient_id
        AND DATE(a.start_time) BETWEEN $1 AND $2
      GROUP BY p.id, p.first_name, p.last_name
      ORDER BY total_visits DESC
      LIMIT 200
    `, [startDate, endDate]);

    const detailResult = await pool.query(`
      SELECT
        a.id, a.start_time, a.status, a.appointment_type AS type, a.reason,
        CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
        p.id AS patient_id,
        CONCAT(pr.first_name, ' ', pr.last_name) AS provider_name,
        pr.specialization
      FROM appointments a
      LEFT JOIN patients p ON a.patient_id = p.id
      LEFT JOIN providers pr ON a.provider_id = pr.id
      WHERE DATE(a.start_time) BETWEEN $1 AND $2
      ORDER BY a.start_time DESC
      LIMIT 500
    `, [startDate, endDate]);

    res.json({ summary: summaryResult.rows, details: detailResult.rows });
  } catch (error) {
    console.error('Patient visit history error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/patient/retention', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { startDate, endDate } = getDateRange(req.query);

    const summaryResult = await pool.query(`
      SELECT
        DATE_TRUNC('month', a.start_time)::date AS month,
        COUNT(DISTINCT a.patient_id)::int AS unique_patients,
        COUNT(a.id)::int AS total_appointments
      FROM appointments a
      WHERE DATE(a.start_time) BETWEEN $1 AND $2
        AND LOWER(a.status) = 'completed'
      GROUP BY DATE_TRUNC('month', a.start_time)
      ORDER BY month
    `, [startDate, endDate]);

    const retentionResult = await pool.query(`
      SELECT
        p.id AS patient_id,
        CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
        MIN(a.start_time) AS first_appointment,
        MAX(a.start_time) AS last_appointment,
        COUNT(a.id)::int AS total_appointments,
        CASE
          WHEN MAX(a.start_time) >= NOW() - INTERVAL '90 days' THEN 'Active'
          WHEN MAX(a.start_time) >= NOW() - INTERVAL '180 days' THEN 'At Risk'
          ELSE 'Lapsed'
        END AS retention_status
      FROM patients p
      LEFT JOIN appointments a ON p.id = a.patient_id
        AND LOWER(a.status) = 'completed'
      GROUP BY p.id, p.first_name, p.last_name
      HAVING COUNT(a.id) > 0
      ORDER BY last_appointment DESC NULLS LAST
      LIMIT 200
    `);

    res.json({ summary: summaryResult.rows, retention: retentionResult.rows });
  } catch (error) {
    console.error('Patient retention error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/patient/satisfaction', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { startDate, endDate } = getDateRange(req.query);

    const summaryResult = await pool.query(`
      SELECT
        CONCAT(pr.first_name, ' ', pr.last_name) AS provider_name,
        pr.specialization,
        COUNT(a.id)::int AS total_appointments,
        COUNT(CASE WHEN LOWER(a.status) = 'completed' THEN 1 END)::int AS completed,
        ROUND(
          COUNT(CASE WHEN LOWER(a.status) = 'completed' THEN 1 END)::numeric /
          NULLIF(COUNT(a.id), 0) * 100, 1
        ) AS completion_rate,
        COUNT(CASE WHEN LOWER(a.status) = 'no-show' THEN 1 END)::int AS no_shows,
        COUNT(CASE WHEN LOWER(a.status) IN ('cancelled','canceled') THEN 1 END)::int AS cancellations
      FROM appointments a
      LEFT JOIN providers pr ON a.provider_id = pr.id
      WHERE DATE(a.start_time) BETWEEN $1 AND $2
      GROUP BY pr.id, pr.first_name, pr.last_name, pr.specialization
      ORDER BY completion_rate DESC
    `, [startDate, endDate]);

    const detailResult = await pool.query(`
      SELECT
        a.id, a.start_time, a.status, a.appointment_type AS type,
        CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
        p.id AS patient_id,
        CONCAT(pr.first_name, ' ', pr.last_name) AS provider_name
      FROM appointments a
      LEFT JOIN patients p ON a.patient_id = p.id
      LEFT JOIN providers pr ON a.provider_id = pr.id
      WHERE DATE(a.start_time) BETWEEN $1 AND $2
      ORDER BY a.start_time DESC
      LIMIT 500
    `, [startDate, endDate]);

    res.json({ summary: summaryResult.rows, details: detailResult.rows });
  } catch (error) {
    console.error('Patient satisfaction error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────
// PROVIDER REPORTS
// ─────────────────────────────────────────────

router.get('/provider/productivity', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { startDate, endDate } = getDateRange(req.query);

    const summaryResult = await pool.query(`
      SELECT
        pr.id AS provider_id,
        CONCAT(pr.first_name, ' ', pr.last_name) AS provider_name,
        pr.specialization,
        COUNT(a.id)::int AS total_appointments,
        COUNT(CASE WHEN LOWER(a.status) = 'completed' THEN 1 END)::int AS completed,
        COUNT(CASE WHEN LOWER(a.status) = 'no-show' THEN 1 END)::int AS no_shows,
        COUNT(CASE WHEN LOWER(a.status) IN ('cancelled','canceled') THEN 1 END)::int AS cancelled,
        ROUND(
          COUNT(CASE WHEN LOWER(a.status) = 'completed' THEN 1 END)::numeric /
          NULLIF(COUNT(a.id), 0) * 100, 1
        ) AS completion_rate
      FROM providers pr
      LEFT JOIN appointments a ON pr.id = a.provider_id
        AND DATE(a.start_time) BETWEEN $1 AND $2
      GROUP BY pr.id, pr.first_name, pr.last_name, pr.specialization
      ORDER BY completed DESC
    `, [startDate, endDate]);

    const detailResult = await pool.query(`
      SELECT
        a.id, a.start_time, a.status, a.appointment_type AS type,
        CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
        CONCAT(pr.first_name, ' ', pr.last_name) AS provider_name,
        pr.specialization
      FROM appointments a
      LEFT JOIN patients p ON a.patient_id = p.id
      LEFT JOIN providers pr ON a.provider_id = pr.id
      WHERE DATE(a.start_time) BETWEEN $1 AND $2
      ORDER BY pr.last_name, a.start_time DESC
      LIMIT 500
    `, [startDate, endDate]);

    res.json({ summary: summaryResult.rows, details: detailResult.rows });
  } catch (error) {
    console.error('Provider productivity error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/provider/appointment-volume', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { startDate, endDate } = getDateRange(req.query);

    const byProvider = await pool.query(`
      SELECT
        pr.id AS provider_id,
        CONCAT(pr.first_name, ' ', pr.last_name) AS provider_name,
        pr.specialization,
        COUNT(a.id)::int AS total_appointments,
        COUNT(CASE WHEN LOWER(a.appointment_type) LIKE '%telehealth%' THEN 1 END)::int AS telehealth_count,
        COUNT(CASE WHEN LOWER(a.appointment_type) NOT LIKE '%telehealth%' THEN 1 END)::int AS in_person_count
      FROM providers pr
      LEFT JOIN appointments a ON pr.id = a.provider_id
        AND DATE(a.start_time) BETWEEN $1 AND $2
      GROUP BY pr.id, pr.first_name, pr.last_name, pr.specialization
      ORDER BY total_appointments DESC
    `, [startDate, endDate]);

    const summaryResult = await pool.query(`
      SELECT
        DATE_TRUNC('week', a.start_time)::date AS week,
        CONCAT(pr.first_name, ' ', pr.last_name) AS provider_name,
        COUNT(a.id)::int AS appointment_count
      FROM appointments a
      LEFT JOIN providers pr ON a.provider_id = pr.id
      WHERE DATE(a.start_time) BETWEEN $1 AND $2
      GROUP BY DATE_TRUNC('week', a.start_time), pr.id, pr.first_name, pr.last_name
      ORDER BY week DESC, appointment_count DESC
    `, [startDate, endDate]);

    res.json({ summary: summaryResult.rows, byProvider: byProvider.rows });
  } catch (error) {
    console.error('Appointment volume by provider error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/provider/revenue', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { startDate, endDate } = getDateRange(req.query);

    // Claims don't have provider_id; join via appointments
    const summaryResult = await pool.query(`
      SELECT
        CONCAT(pr.first_name, ' ', pr.last_name) AS provider_name,
        pr.specialization,
        COUNT(c.id)::int AS claim_count,
        COALESCE(SUM(c.amount), 0)::numeric AS total_billed,
        COALESCE(SUM(CASE WHEN LOWER(c.status) IN ('approved','paid') THEN c.amount ELSE 0 END), 0)::numeric AS collected,
        COALESCE(SUM(CASE WHEN LOWER(c.status) = 'denied' THEN c.amount ELSE 0 END), 0)::numeric AS denied,
        ROUND(
          COALESCE(SUM(CASE WHEN LOWER(c.status) IN ('approved','paid') THEN c.amount ELSE 0 END), 0) /
          NULLIF(SUM(c.amount), 0) * 100, 1
        ) AS collection_rate
      FROM providers pr
      LEFT JOIN appointments a ON pr.id = a.provider_id
        AND DATE(a.start_time) BETWEEN $1 AND $2
      LEFT JOIN claims c ON c.patient_id = a.patient_id
        AND c.service_date BETWEEN $1 AND $2
        AND DATE(a.start_time) = c.service_date
      GROUP BY pr.id, pr.first_name, pr.last_name, pr.specialization
      ORDER BY total_billed DESC
    `, [startDate, endDate]);

    const detailResult = await pool.query(`
      SELECT
        c.id, c.claim_number, c.service_date, c.status, c.amount, c.payer,
        CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
        CONCAT(pr.first_name, ' ', pr.last_name) AS provider_name,
        pr.specialization
      FROM claims c
      LEFT JOIN patients p ON c.patient_id = p.id
      LEFT JOIN appointments a ON a.patient_id = c.patient_id
        AND DATE(a.start_time) = c.service_date
      LEFT JOIN providers pr ON a.provider_id = pr.id
      WHERE c.service_date BETWEEN $1 AND $2
      ORDER BY c.service_date DESC
      LIMIT 500
    `, [startDate, endDate]);

    res.json({ summary: summaryResult.rows, details: detailResult.rows });
  } catch (error) {
    console.error('Revenue by provider error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/provider/telehealth-usage', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { startDate, endDate } = getDateRange(req.query);

    const summaryResult = await pool.query(`
      SELECT
        CONCAT(pr.first_name, ' ', pr.last_name) AS provider_name,
        pr.specialization,
        COUNT(ts.id)::int AS session_count,
        COALESCE(SUM(ts.duration_minutes), 0)::numeric AS total_duration_minutes,
        COALESCE(AVG(ts.duration_minutes), 0)::numeric AS avg_duration_minutes
      FROM telehealth_sessions ts
      LEFT JOIN providers pr ON ts.provider_id = pr.id
      WHERE DATE(COALESCE(ts.start_time, ts.created_at)) BETWEEN $1 AND $2
      GROUP BY pr.id, pr.first_name, pr.last_name, pr.specialization
      ORDER BY session_count DESC
    `, [startDate, endDate]);

    const detailResult = await pool.query(`
      SELECT
        ts.id, COALESCE(ts.start_time, ts.created_at) AS created_at,
        ts.session_status AS status, ts.duration_minutes AS duration, ts.provider_type AS platform,
        CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
        p.id AS patient_id,
        CONCAT(pr.first_name, ' ', pr.last_name) AS provider_name
      FROM telehealth_sessions ts
      LEFT JOIN patients p ON ts.patient_id = p.id
      LEFT JOIN providers pr ON ts.provider_id = pr.id
      WHERE DATE(COALESCE(ts.start_time, ts.created_at)) BETWEEN $1 AND $2
      ORDER BY ts.created_at DESC
      LIMIT 500
    `, [startDate, endDate]);

    res.json({ summary: summaryResult.rows, details: detailResult.rows });
  } catch (error) {
    console.error('Telehealth usage error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────
// COMPLIANCE REPORTS
// ─────────────────────────────────────────────

router.get('/compliance/audit-logs', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { startDate, endDate } = getDateRange(req.query);

    const summaryResult = await pool.query(`
      SELECT
        action_type AS action,
        COUNT(*)::int AS count,
        COUNT(DISTINCT user_id)::int AS unique_users
      FROM audit_logs
      WHERE created_at::date BETWEEN $1 AND $2
      GROUP BY action_type
      ORDER BY count DESC
    `, [startDate, endDate]);

    const detailResult = await pool.query(`
      SELECT
        al.id, al.created_at, al.action_type AS action, al.resource_type,
        al.resource_id, al.user_id, al.ip_address, al.action_description AS details,
        al.user_name, al.user_role, al.module, al.status
      FROM audit_logs al
      WHERE al.created_at::date BETWEEN $1 AND $2
      ORDER BY al.created_at DESC
      LIMIT 500
    `, [startDate, endDate]);

    res.json({ summary: summaryResult.rows, details: detailResult.rows });
  } catch (error) {
    console.error('Audit logs error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/compliance/access-logs', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { startDate, endDate } = getDateRange(req.query);

    const summaryResult = await pool.query(`
      SELECT
        COALESCE(al.user_name, 'Unknown') AS user_name,
        COALESCE(al.user_role, 'Unknown') AS user_role,
        COUNT(al.id)::int AS access_count,
        COUNT(DISTINCT al.resource_type)::int AS resources_accessed,
        MAX(al.created_at) AS last_access
      FROM audit_logs al
      WHERE al.created_at::date BETWEEN $1 AND $2
      GROUP BY al.user_id, al.user_name, al.user_role
      ORDER BY access_count DESC
      LIMIT 50
    `, [startDate, endDate]);

    const detailResult = await pool.query(`
      SELECT
        al.id, al.created_at, al.action_type AS action, al.resource_type,
        al.resource_id, al.ip_address, al.user_name, al.user_role, al.module
      FROM audit_logs al
      WHERE al.created_at::date BETWEEN $1 AND $2
        AND LOWER(al.action_type) IN ('view','read','access','login','viewed','read')
      ORDER BY al.created_at DESC
      LIMIT 500
    `, [startDate, endDate]);

    res.json({ summary: summaryResult.rows, details: detailResult.rows });
  } catch (error) {
    console.error('Access logs error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/compliance/hipaa', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { startDate, endDate } = getDateRange(req.query);

    const phiResult = await pool.query(`
      SELECT
        resource_type,
        COUNT(*)::int AS total_access,
        COUNT(DISTINCT user_id)::int AS unique_users,
        COUNT(DISTINCT resource_id)::int AS unique_records
      FROM audit_logs
      WHERE created_at::date BETWEEN $1 AND $2
        AND resource_type IN ('patients','medical_records','prescriptions','lab_orders','diagnoses')
      GROUP BY resource_type
      ORDER BY total_access DESC
    `, [startDate, endDate]);

    const phiDetails = await pool.query(`
      SELECT
        al.created_at, al.action_type AS action, al.resource_type,
        al.resource_id, al.ip_address, al.user_name, al.user_role
      FROM audit_logs al
      WHERE al.created_at::date BETWEEN $1 AND $2
        AND al.resource_type IN ('patients','medical_records','prescriptions','lab_orders','diagnoses')
      ORDER BY al.created_at DESC
      LIMIT 200
    `, [startDate, endDate]);

    const userStats = await pool.query(`
      SELECT role, COUNT(*)::int AS count FROM users GROUP BY role ORDER BY count DESC
    `);

    res.json({
      phiAccess: phiResult.rows,
      phiAccessDetails: phiDetails.rows,
      userStats: userStats.rows,
      reportGenerated: new Date().toISOString()
    });
  } catch (error) {
    console.error('HIPAA compliance error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/compliance/data-access-history', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { startDate, endDate } = getDateRange(req.query);

    const summaryResult = await pool.query(`
      SELECT
        al.resource_type,
        al.action_type AS action,
        COUNT(*)::int AS count,
        COUNT(DISTINCT al.user_id)::int AS unique_users,
        MAX(al.created_at) AS last_access
      FROM audit_logs al
      WHERE al.created_at::date BETWEEN $1 AND $2
      GROUP BY al.resource_type, al.action_type
      ORDER BY count DESC
    `, [startDate, endDate]);

    const detailResult = await pool.query(`
      SELECT
        al.id, al.created_at, al.action_type AS action, al.resource_type,
        al.resource_id, al.ip_address, al.action_description AS details,
        al.user_name, al.user_role
      FROM audit_logs al
      WHERE al.created_at::date BETWEEN $1 AND $2
      ORDER BY al.created_at DESC
      LIMIT 500
    `, [startDate, endDate]);

    res.json({ summary: summaryResult.rows, details: detailResult.rows });
  } catch (error) {
    console.error('Data access history error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────
// CUSTOM REPORT
// ─────────────────────────────────────────────

router.post('/custom', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { dataSource, fields, filters, sortBy, sortOrder, limit = 200 } = req.body;

    const allowedTables = {
      appointments: {
        alias: 'a', table: 'appointments',
        fields: ['id', 'start_time', 'end_time', 'status', 'appointment_type', 'reason'],
        joins: [
          'LEFT JOIN patients p ON a.patient_id = p.id',
          'LEFT JOIN providers pr ON a.provider_id = pr.id'
        ],
        extra_fields: {
          patient_name: "CONCAT(p.first_name, ' ', p.last_name)",
          provider_name: "CONCAT(pr.first_name, ' ', pr.last_name)",
          specialization: 'pr.specialization'
        },
        date_field: 'start_time'
      },
      claims: {
        alias: 'c', table: 'claims',
        fields: ['id', 'claim_number', 'service_date', 'status', 'amount', 'payer'],
        joins: ['LEFT JOIN patients p ON c.patient_id = p.id'],
        extra_fields: { patient_name: "CONCAT(p.first_name, ' ', p.last_name)" },
        date_field: 'service_date'
      },
      payments: {
        alias: 'pm', table: 'payments',
        fields: ['id', 'payment_date', 'amount', 'payment_method', 'payment_status', 'notes'],
        joins: ['LEFT JOIN patients p ON pm.patient_id = p.id'],
        extra_fields: { patient_name: "CONCAT(p.first_name, ' ', p.last_name)" },
        date_field: 'payment_date'
      },
      patients: {
        alias: 'p', table: 'patients',
        fields: ['id', 'first_name', 'last_name', 'date_of_birth', 'gender', 'phone', 'email', 'insurance', 'state', 'city'],
        joins: [],
        extra_fields: {},
        date_field: 'created_at'
      }
    };

    const tableConfig = allowedTables[dataSource];
    if (!tableConfig) return res.status(400).json({ error: 'Invalid data source' });

    const { alias, table, fields: allowedFields, joins, extra_fields, date_field } = tableConfig;

    const selectedFields = (fields || allowedFields).filter(f =>
      allowedFields.includes(f) || extra_fields[f]
    );

    const selectClauses = selectedFields.map(f =>
      extra_fields[f] ? `${extra_fields[f]} AS ${f}` : `${alias}.${f}`
    );

    const whereClauses = [];
    const params = [];
    let paramIdx = 1;

    if (filters) {
      if (filters.startDate) {
        whereClauses.push(`DATE(${alias}.${date_field}) >= $${paramIdx++}`);
        params.push(filters.startDate);
      }
      if (filters.endDate) {
        whereClauses.push(`DATE(${alias}.${date_field}) <= $${paramIdx++}`);
        params.push(filters.endDate);
      }
      if (filters.status && allowedFields.includes('status')) {
        whereClauses.push(`LOWER(${alias}.status) = LOWER($${paramIdx++})`);
        params.push(filters.status);
      }
    }

    let orderByClause = `ORDER BY ${alias}.${date_field} DESC`;
    if (sortBy && (allowedFields.includes(sortBy) || extra_fields[sortBy])) {
      const dir = sortOrder === 'asc' ? 'ASC' : 'DESC';
      orderByClause = `ORDER BY ${sortBy} ${dir}`;
    }

    const query = `
      SELECT ${selectClauses.join(', ')}
      FROM ${table} ${alias}
      ${joins.join('\n')}
      ${whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : ''}
      ${orderByClause}
      LIMIT $${paramIdx}
    `;
    params.push(Math.min(parseInt(limit) || 200, 1000));

    const result = await pool.query(query, params);
    res.json({ data: result.rows, fields: selectedFields });
  } catch (error) {
    console.error('Custom report error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
