const express = require('express');
const router = express.Router();

/**
 * Helper: parse date range from query params
 */
const getDateRange = (query) => {
  const { startDate, endDate, days } = query;
  if (startDate && endDate) {
    return { startDate, endDate };
  }
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

// Daily Appointment Report
router.get('/operational/daily-appointments', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { startDate, endDate } = getDateRange(req.query);

    const summaryResult = await pool.query(`
      SELECT
        DATE(a.start_time) AS date,
        COUNT(*)::int AS total,
        COUNT(CASE WHEN a.status = 'Completed' THEN 1 END)::int AS completed,
        COUNT(CASE WHEN a.status IN ('Cancelled','No-Show','no-show') THEN 1 END)::int AS cancelled,
        COUNT(CASE WHEN a.status IN ('No-Show','no-show') THEN 1 END)::int AS no_shows,
        COUNT(CASE WHEN a.status = 'Confirmed' THEN 1 END)::int AS confirmed,
        COUNT(CASE WHEN a.status = 'Pending' THEN 1 END)::int AS pending
      FROM appointments a
      WHERE DATE(a.start_time) BETWEEN $1 AND $2
      GROUP BY DATE(a.start_time)
      ORDER BY date DESC
    `, [startDate, endDate]);

    const detailResult = await pool.query(`
      SELECT
        a.id, a.start_time, a.end_time, a.status, a.type, a.reason,
        CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
        p.id AS patient_id, p.phone AS patient_phone, p.email AS patient_email,
        CONCAT(pr.first_name, ' ', pr.last_name) AS provider_name,
        pr.specialization AS provider_specialization
      FROM appointments a
      LEFT JOIN patients p ON a.patient_id::text = p.id::text
      LEFT JOIN providers pr ON a.provider_id::text = pr.id::text
      WHERE DATE(a.start_time) BETWEEN $1 AND $2
      ORDER BY a.start_time DESC
      LIMIT 500
    `, [startDate, endDate]);

    res.json({ summary: summaryResult.rows, details: detailResult.rows });
  } catch (error) {
    console.error('Daily appointments report error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Provider Utilization Report
router.get('/operational/provider-utilization', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { startDate, endDate } = getDateRange(req.query);

    const summaryResult = await pool.query(`
      SELECT
        pr.id AS provider_id,
        CONCAT(pr.first_name, ' ', pr.last_name) AS provider_name,
        pr.specialization,
        COUNT(a.id)::int AS total_appointments,
        COUNT(CASE WHEN a.status = 'Completed' THEN 1 END)::int AS completed,
        COUNT(CASE WHEN a.status IN ('Cancelled','No-Show','no-show') THEN 1 END)::int AS cancelled,
        ROUND(
          COUNT(CASE WHEN a.status = 'Completed' THEN 1 END)::numeric /
          NULLIF(COUNT(a.id), 0) * 100, 1
        ) AS utilization_rate
      FROM providers pr
      LEFT JOIN appointments a ON pr.id::text = a.provider_id::text
        AND DATE(a.start_time) BETWEEN $1 AND $2
      GROUP BY pr.id, pr.first_name, pr.last_name, pr.specialization
      ORDER BY total_appointments DESC
    `, [startDate, endDate]);

    const detailResult = await pool.query(`
      SELECT
        a.id, a.start_time, a.status, a.type,
        CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
        CONCAT(pr.first_name, ' ', pr.last_name) AS provider_name,
        pr.specialization
      FROM appointments a
      LEFT JOIN patients p ON a.patient_id::text = p.id::text
      LEFT JOIN providers pr ON a.provider_id::text = pr.id::text
      WHERE DATE(a.start_time) BETWEEN $1 AND $2
      ORDER BY pr.last_name, a.start_time DESC
      LIMIT 500
    `, [startDate, endDate]);

    res.json({ summary: summaryResult.rows, details: detailResult.rows });
  } catch (error) {
    console.error('Provider utilization report error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Patient Visit Report
router.get('/operational/patient-visits', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
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
      LEFT JOIN appointments a ON p.id::text = a.patient_id::text
        AND DATE(a.start_time) BETWEEN $1 AND $2
        AND a.status = 'Completed'
      GROUP BY p.id, p.first_name, p.last_name, p.date_of_birth, p.gender
      HAVING COUNT(a.id) > 0
      ORDER BY visit_count DESC
      LIMIT 200
    `, [startDate, endDate]);

    const detailResult = await pool.query(`
      SELECT
        a.id, a.start_time, a.status, a.type, a.reason,
        CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
        p.id AS patient_id,
        CONCAT(pr.first_name, ' ', pr.last_name) AS provider_name,
        pr.specialization
      FROM appointments a
      LEFT JOIN patients p ON a.patient_id::text = p.id::text
      LEFT JOIN providers pr ON a.provider_id::text = pr.id::text
      WHERE DATE(a.start_time) BETWEEN $1 AND $2
        AND a.status = 'Completed'
      ORDER BY a.start_time DESC
      LIMIT 500
    `, [startDate, endDate]);

    res.json({ summary: summaryResult.rows, details: detailResult.rows });
  } catch (error) {
    console.error('Patient visits report error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// No-Show Report
router.get('/operational/no-shows', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { startDate, endDate } = getDateRange(req.query);

    const summaryResult = await pool.query(`
      SELECT
        DATE(a.start_time) AS date,
        COUNT(CASE WHEN a.status IN ('No-Show','no-show') THEN 1 END)::int AS no_shows,
        COUNT(*)::int AS total_appointments,
        ROUND(
          COUNT(CASE WHEN a.status IN ('No-Show','no-show') THEN 1 END)::numeric /
          NULLIF(COUNT(*), 0) * 100, 1
        ) AS no_show_rate
      FROM appointments a
      WHERE DATE(a.start_time) BETWEEN $1 AND $2
      GROUP BY DATE(a.start_time)
      ORDER BY date DESC
    `, [startDate, endDate]);

    const detailResult = await pool.query(`
      SELECT
        a.id, a.start_time, a.status, a.type, a.reason,
        CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
        p.id AS patient_id, p.phone AS patient_phone, p.email AS patient_email,
        CONCAT(pr.first_name, ' ', pr.last_name) AS provider_name
      FROM appointments a
      LEFT JOIN patients p ON a.patient_id::text = p.id::text
      LEFT JOIN providers pr ON a.provider_id::text = pr.id::text
      WHERE DATE(a.start_time) BETWEEN $1 AND $2
        AND a.status IN ('No-Show','no-show','Cancelled')
      ORDER BY a.start_time DESC
      LIMIT 500
    `, [startDate, endDate]);

    res.json({ summary: summaryResult.rows, details: detailResult.rows });
  } catch (error) {
    console.error('No-show report error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Wait Time Report
router.get('/operational/wait-times', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { startDate, endDate } = getDateRange(req.query);

    // Calculate wait time as difference between start_time and actual check-in (using metadata if available)
    const summaryResult = await pool.query(`
      SELECT
        CONCAT(pr.first_name, ' ', pr.last_name) AS provider_name,
        pr.specialization,
        COUNT(a.id)::int AS total_appointments,
        COALESCE(
          ROUND(AVG(
            EXTRACT(EPOCH FROM (a.updated_at - a.start_time)) / 60
          )::numeric, 0), 0
        ) AS avg_wait_minutes
      FROM appointments a
      LEFT JOIN providers pr ON a.provider_id::text = pr.id::text
      WHERE DATE(a.start_time) BETWEEN $1 AND $2
        AND a.status = 'Completed'
      GROUP BY pr.id, pr.first_name, pr.last_name, pr.specialization
      ORDER BY avg_wait_minutes DESC
    `, [startDate, endDate]);

    const detailResult = await pool.query(`
      SELECT
        a.id, a.start_time, a.updated_at, a.status, a.type,
        CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
        CONCAT(pr.first_name, ' ', pr.last_name) AS provider_name,
        COALESCE(
          ROUND(EXTRACT(EPOCH FROM (a.updated_at - a.start_time)) / 60)::int, 0
        ) AS wait_minutes
      FROM appointments a
      LEFT JOIN patients p ON a.patient_id::text = p.id::text
      LEFT JOIN providers pr ON a.provider_id::text = pr.id::text
      WHERE DATE(a.start_time) BETWEEN $1 AND $2
        AND a.status = 'Completed'
      ORDER BY a.start_time DESC
      LIMIT 500
    `, [startDate, endDate]);

    res.json({ summary: summaryResult.rows, details: detailResult.rows });
  } catch (error) {
    console.error('Wait time report error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// ─────────────────────────────────────────────
// FINANCIAL REPORTS
// ─────────────────────────────────────────────

// Revenue Report
router.get('/financial/revenue', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { startDate, endDate } = getDateRange(req.query);

    const summaryResult = await pool.query(`
      SELECT
        DATE(c.service_date) AS date,
        COUNT(c.id)::int AS claim_count,
        COALESCE(SUM(c.amount), 0)::numeric AS total_billed,
        COALESCE(SUM(CASE WHEN c.status IN ('Approved','Paid') THEN c.amount ELSE 0 END), 0)::numeric AS approved_amount,
        COALESCE(SUM(CASE WHEN c.status = 'Denied' THEN c.amount ELSE 0 END), 0)::numeric AS denied_amount,
        COALESCE(SUM(CASE WHEN c.status = 'Pending' THEN c.amount ELSE 0 END), 0)::numeric AS pending_amount
      FROM claims c
      WHERE c.service_date BETWEEN $1 AND $2
      GROUP BY DATE(c.service_date)
      ORDER BY date DESC
    `, [startDate, endDate]);

    const detailResult = await pool.query(`
      SELECT
        c.id, c.claim_number, c.service_date, c.status, c.amount,
        c.payer, c.diagnosis_codes, c.procedure_codes,
        CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
        p.id AS patient_id,
        CONCAT(pr.first_name, ' ', pr.last_name) AS provider_name
      FROM claims c
      LEFT JOIN patients p ON c.patient_id::text = p.id::text
      LEFT JOIN providers pr ON c.provider_id::text = pr.id::text
      WHERE c.service_date BETWEEN $1 AND $2
      ORDER BY c.service_date DESC
      LIMIT 500
    `, [startDate, endDate]);

    res.json({ summary: summaryResult.rows, details: detailResult.rows });
  } catch (error) {
    console.error('Revenue report error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Billing Summary Report
router.get('/financial/billing-summary', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
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
        COALESCE(SUM(CASE WHEN c.status IN ('Approved','Paid') THEN c.amount ELSE 0 END), 0)::numeric AS paid_amount
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
      LEFT JOIN patients p ON c.patient_id::text = p.id::text
      WHERE c.service_date BETWEEN $1 AND $2
      ORDER BY c.service_date DESC
      LIMIT 500
    `, [startDate, endDate]);

    res.json({ summary: summaryResult.rows, payerSummary: payerSummary.rows, details: detailResult.rows });
  } catch (error) {
    console.error('Billing summary report error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Outstanding Payments Report
router.get('/financial/outstanding-payments', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { startDate, endDate } = getDateRange(req.query);

    const summaryResult = await pool.query(`
      SELECT
        COALESCE(c.payer, 'Self-Pay') AS payer,
        COUNT(c.id)::int AS claim_count,
        COALESCE(SUM(c.amount), 0)::numeric AS outstanding_amount,
        MIN(c.service_date) AS oldest_claim_date
      FROM claims c
      WHERE c.status IN ('Pending','Submitted','In-Review')
        AND c.service_date BETWEEN $1 AND $2
      GROUP BY c.payer
      ORDER BY outstanding_amount DESC
    `, [startDate, endDate]);

    const agingResult = await pool.query(`
      SELECT
        CASE
          WHEN (CURRENT_DATE - c.service_date::date) <= 30 THEN '0-30 days'
          WHEN (CURRENT_DATE - c.service_date::date) <= 60 THEN '31-60 days'
          WHEN (CURRENT_DATE - c.service_date::date) <= 90 THEN '61-90 days'
          ELSE '90+ days'
        END AS aging_bucket,
        COUNT(c.id)::int AS claim_count,
        COALESCE(SUM(c.amount), 0)::numeric AS total_amount
      FROM claims c
      WHERE c.status IN ('Pending','Submitted','In-Review')
      GROUP BY aging_bucket
      ORDER BY aging_bucket
    `);

    const detailResult = await pool.query(`
      SELECT
        c.id, c.claim_number, c.service_date, c.status, c.amount, c.payer,
        (CURRENT_DATE - c.service_date::date)::int AS days_outstanding,
        CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
        p.id AS patient_id, p.phone AS patient_phone
      FROM claims c
      LEFT JOIN patients p ON c.patient_id::text = p.id::text
      WHERE c.status IN ('Pending','Submitted','In-Review')
        AND c.service_date BETWEEN $1 AND $2
      ORDER BY days_outstanding DESC
      LIMIT 500
    `, [startDate, endDate]);

    res.json({ summary: summaryResult.rows, aging: agingResult.rows, details: detailResult.rows });
  } catch (error) {
    console.error('Outstanding payments report error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Payment Collection Report
router.get('/financial/payment-collection', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { startDate, endDate } = getDateRange(req.query);

    const summaryResult = await pool.query(`
      SELECT
        DATE(p.payment_date) AS date,
        COUNT(p.id)::int AS payment_count,
        COALESCE(SUM(p.amount), 0)::numeric AS total_collected,
        COALESCE(AVG(p.amount), 0)::numeric AS avg_payment
      FROM payments p
      WHERE p.payment_date BETWEEN $1 AND $2
      GROUP BY DATE(p.payment_date)
      ORDER BY date DESC
    `, [startDate, endDate]);

    const methodResult = await pool.query(`
      SELECT
        COALESCE(p.payment_method, 'Unknown') AS payment_method,
        COUNT(p.id)::int AS count,
        COALESCE(SUM(p.amount), 0)::numeric AS total_amount
      FROM payments p
      WHERE p.payment_date BETWEEN $1 AND $2
      GROUP BY p.payment_method
      ORDER BY total_amount DESC
    `, [startDate, endDate]);

    const detailResult = await pool.query(`
      SELECT
        p.id, p.payment_date, p.amount, p.payment_method, p.status,
        CONCAT(pat.first_name, ' ', pat.last_name) AS patient_name,
        pat.id AS patient_id
      FROM payments p
      LEFT JOIN patients pat ON p.patient_id::text = pat.id::text
      WHERE p.payment_date BETWEEN $1 AND $2
      ORDER BY p.payment_date DESC
      LIMIT 500
    `, [startDate, endDate]);

    res.json({ summary: summaryResult.rows, byMethod: methodResult.rows, details: detailResult.rows });
  } catch (error) {
    console.error('Payment collection report error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Refund Report
router.get('/financial/refunds', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { startDate, endDate } = getDateRange(req.query);

    const summaryResult = await pool.query(`
      SELECT
        DATE(p.payment_date) AS date,
        COUNT(p.id)::int AS refund_count,
        COALESCE(SUM(ABS(p.amount)), 0)::numeric AS total_refunded
      FROM payments p
      WHERE p.payment_date BETWEEN $1 AND $2
        AND (p.status = 'Refunded' OR p.amount < 0)
      GROUP BY DATE(p.payment_date)
      ORDER BY date DESC
    `, [startDate, endDate]);

    const detailResult = await pool.query(`
      SELECT
        p.id, p.payment_date, p.amount, p.payment_method, p.status, p.notes,
        CONCAT(pat.first_name, ' ', pat.last_name) AS patient_name,
        pat.id AS patient_id
      FROM payments p
      LEFT JOIN patients pat ON p.patient_id::text = pat.id::text
      WHERE p.payment_date BETWEEN $1 AND $2
        AND (p.status = 'Refunded' OR p.amount < 0)
      ORDER BY p.payment_date DESC
      LIMIT 500
    `, [startDate, endDate]);

    res.json({ summary: summaryResult.rows, details: detailResult.rows });
  } catch (error) {
    console.error('Refund report error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// ─────────────────────────────────────────────
// INSURANCE & CLAIMS REPORTS
// ─────────────────────────────────────────────

// Claim Status Report
router.get('/insurance/claim-status', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
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
        c.diagnosis_codes, c.procedure_codes,
        CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
        p.id AS patient_id,
        CONCAT(pr.first_name, ' ', pr.last_name) AS provider_name,
        c.created_at, c.updated_at
      FROM claims c
      LEFT JOIN patients p ON c.patient_id::text = p.id::text
      LEFT JOIN providers pr ON c.provider_id::text = pr.id::text
      WHERE c.service_date BETWEEN $1 AND $2
      ORDER BY c.service_date DESC
      LIMIT 500
    `, [startDate, endDate]);

    res.json({ summary: summaryResult.rows, details: detailResult.rows });
  } catch (error) {
    console.error('Claim status report error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Claim Rejection Report
router.get('/insurance/claim-rejections', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { startDate, endDate } = getDateRange(req.query);

    const summaryResult = await pool.query(`
      SELECT
        COALESCE(c.payer, 'Unknown') AS payer,
        COUNT(c.id)::int AS rejected_count,
        COALESCE(SUM(c.amount), 0)::numeric AS rejected_amount
      FROM claims c
      WHERE c.service_date BETWEEN $1 AND $2
        AND c.status IN ('Denied','Rejected')
      GROUP BY c.payer
      ORDER BY rejected_count DESC
    `, [startDate, endDate]);

    const detailResult = await pool.query(`
      SELECT
        c.id, c.claim_number, c.service_date, c.status, c.amount, c.payer,
        c.denial_reason,
        CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
        p.id AS patient_id
      FROM claims c
      LEFT JOIN patients p ON c.patient_id::text = p.id::text
      WHERE c.service_date BETWEEN $1 AND $2
        AND c.status IN ('Denied','Rejected')
      ORDER BY c.service_date DESC
      LIMIT 500
    `, [startDate, endDate]);

    res.json({ summary: summaryResult.rows, details: detailResult.rows });
  } catch (error) {
    console.error('Claim rejection report error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Denial Analysis Report
router.get('/insurance/denial-analysis', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { startDate, endDate } = getDateRange(req.query);

    // Try denials table first, fall back to claims
    let summaryResult, detailResult;
    try {
      summaryResult = await pool.query(`
        SELECT
          COALESCE(d.denial_reason, 'Unknown') AS denial_reason,
          COUNT(d.id)::int AS count,
          COALESCE(SUM(d.denied_amount), 0)::numeric AS denied_amount,
          COALESCE(d.payer, 'Unknown') AS payer
        FROM denials d
        WHERE d.created_at::date BETWEEN $1 AND $2
        GROUP BY d.denial_reason, d.payer
        ORDER BY count DESC
        LIMIT 20
      `, [startDate, endDate]);

      detailResult = await pool.query(`
        SELECT
          d.id, d.denial_number, d.created_at, d.denial_reason,
          d.denied_amount, d.payer, d.status,
          CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
          p.id AS patient_id
        FROM denials d
        LEFT JOIN claims c ON d.claim_id::text = c.id::text
        LEFT JOIN patients p ON c.patient_id::text = p.id::text
        WHERE d.created_at::date BETWEEN $1 AND $2
        ORDER BY d.created_at DESC
        LIMIT 500
      `, [startDate, endDate]);
    } catch (e) {
      // Fallback to claims table
      summaryResult = await pool.query(`
        SELECT
          COALESCE(c.denial_reason, 'Unspecified') AS denial_reason,
          COUNT(c.id)::int AS count,
          COALESCE(SUM(c.amount), 0)::numeric AS denied_amount,
          COALESCE(c.payer, 'Unknown') AS payer
        FROM claims c
        WHERE c.service_date BETWEEN $1 AND $2
          AND c.status IN ('Denied','Rejected')
        GROUP BY c.denial_reason, c.payer
        ORDER BY count DESC
        LIMIT 20
      `, [startDate, endDate]);

      detailResult = await pool.query(`
        SELECT
          c.id, c.claim_number, c.service_date AS created_at,
          COALESCE(c.denial_reason, 'Unspecified') AS denial_reason,
          c.amount AS denied_amount, c.payer, c.status,
          CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
          p.id AS patient_id
        FROM claims c
        LEFT JOIN patients p ON c.patient_id::text = p.id::text
        WHERE c.service_date BETWEEN $1 AND $2
          AND c.status IN ('Denied','Rejected')
        ORDER BY c.service_date DESC
        LIMIT 500
      `, [startDate, endDate]);
    }

    res.json({ summary: summaryResult.rows, details: detailResult.rows });
  } catch (error) {
    console.error('Denial analysis report error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Payer Performance Report
router.get('/insurance/payer-performance', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { startDate, endDate } = getDateRange(req.query);

    const summaryResult = await pool.query(`
      SELECT
        COALESCE(c.payer, 'Unknown') AS payer,
        COUNT(c.id)::int AS total_claims,
        COUNT(CASE WHEN c.status IN ('Approved','Paid') THEN 1 END)::int AS approved,
        COUNT(CASE WHEN c.status IN ('Denied','Rejected') THEN 1 END)::int AS denied,
        COUNT(CASE WHEN c.status IN ('Pending','Submitted') THEN 1 END)::int AS pending,
        COALESCE(SUM(c.amount), 0)::numeric AS total_billed,
        COALESCE(SUM(CASE WHEN c.status IN ('Approved','Paid') THEN c.amount ELSE 0 END), 0)::numeric AS paid_amount,
        ROUND(
          COUNT(CASE WHEN c.status IN ('Approved','Paid') THEN 1 END)::numeric /
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
      LEFT JOIN patients p ON c.patient_id::text = p.id::text
      WHERE c.service_date BETWEEN $1 AND $2
      ORDER BY c.payer, c.service_date DESC
      LIMIT 500
    `, [startDate, endDate]);

    res.json({ summary: summaryResult.rows, details: detailResult.rows });
  } catch (error) {
    console.error('Payer performance report error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// ─────────────────────────────────────────────
// PATIENT REPORTS
// ─────────────────────────────────────────────

// Patient Demographics Report
router.get('/patient/demographics', async (req, res) => {
  try {
    const pool = req.app.locals.pool;

    const genderResult = await pool.query(`
      SELECT
        COALESCE(gender, 'Unknown') AS gender,
        COUNT(id)::int AS count
      FROM patients
      GROUP BY gender
      ORDER BY count DESC
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
      FROM patients
      WHERE date_of_birth IS NOT NULL
      GROUP BY age_group
      ORDER BY age_group
    `);

    const stateResult = await pool.query(`
      SELECT
        COALESCE(state, 'Unknown') AS state,
        COUNT(id)::int AS count
      FROM patients
      GROUP BY state
      ORDER BY count DESC
      LIMIT 20
    `);

    const detailResult = await pool.query(`
      SELECT
        p.id, p.first_name, p.last_name, p.date_of_birth, p.gender,
        p.phone, p.email, p.address, p.city, p.state, p.zip,
        p.insurance_provider, p.created_at,
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
    console.error('Patient demographics report error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Patient Visit History
router.get('/patient/visit-history', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { startDate, endDate } = getDateRange(req.query);

    const summaryResult = await pool.query(`
      SELECT
        CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
        p.id AS patient_id,
        COUNT(a.id)::int AS total_visits,
        COUNT(CASE WHEN a.status = 'Completed' THEN 1 END)::int AS completed_visits,
        MAX(a.start_time) AS last_visit,
        COALESCE(SUM(c.amount), 0)::numeric AS total_billed
      FROM patients p
      LEFT JOIN appointments a ON p.id::text = a.patient_id::text
        AND DATE(a.start_time) BETWEEN $1 AND $2
      LEFT JOIN claims c ON p.id::text = c.patient_id::text
        AND c.service_date BETWEEN $1 AND $2
      GROUP BY p.id, p.first_name, p.last_name
      HAVING COUNT(a.id) > 0
      ORDER BY total_visits DESC
      LIMIT 200
    `, [startDate, endDate]);

    const detailResult = await pool.query(`
      SELECT
        a.id, a.start_time, a.status, a.type, a.reason,
        CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
        p.id AS patient_id,
        CONCAT(pr.first_name, ' ', pr.last_name) AS provider_name,
        pr.specialization
      FROM appointments a
      LEFT JOIN patients p ON a.patient_id::text = p.id::text
      LEFT JOIN providers pr ON a.provider_id::text = pr.id::text
      WHERE DATE(a.start_time) BETWEEN $1 AND $2
      ORDER BY a.start_time DESC
      LIMIT 500
    `, [startDate, endDate]);

    res.json({ summary: summaryResult.rows, details: detailResult.rows });
  } catch (error) {
    console.error('Patient visit history report error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Patient Retention Report
router.get('/patient/retention', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { startDate, endDate } = getDateRange(req.query);

    const summaryResult = await pool.query(`
      SELECT
        DATE_TRUNC('month', a.start_time)::date AS month,
        COUNT(DISTINCT a.patient_id)::int AS unique_patients,
        COUNT(a.id)::int AS total_appointments
      FROM appointments a
      WHERE DATE(a.start_time) BETWEEN $1 AND $2
        AND a.status = 'Completed'
      GROUP BY DATE_TRUNC('month', a.start_time)
      ORDER BY month DESC
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
      LEFT JOIN appointments a ON p.id::text = a.patient_id::text
        AND a.status = 'Completed'
      GROUP BY p.id, p.first_name, p.last_name
      ORDER BY last_appointment DESC NULLS LAST
      LIMIT 200
    `);

    res.json({ summary: summaryResult.rows, retention: retentionResult.rows });
  } catch (error) {
    console.error('Patient retention report error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Patient Satisfaction Report (based on appointment ratings if available)
router.get('/patient/satisfaction', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { startDate, endDate } = getDateRange(req.query);

    // Use appointment completion as proxy for satisfaction
    const summaryResult = await pool.query(`
      SELECT
        CONCAT(pr.first_name, ' ', pr.last_name) AS provider_name,
        pr.specialization,
        COUNT(a.id)::int AS total_appointments,
        COUNT(CASE WHEN a.status = 'Completed' THEN 1 END)::int AS completed,
        ROUND(
          COUNT(CASE WHEN a.status = 'Completed' THEN 1 END)::numeric /
          NULLIF(COUNT(a.id), 0) * 100, 1
        ) AS completion_rate,
        COUNT(CASE WHEN a.status IN ('No-Show','no-show') THEN 1 END)::int AS no_shows,
        COUNT(CASE WHEN a.status = 'Cancelled' THEN 1 END)::int AS cancellations
      FROM appointments a
      LEFT JOIN providers pr ON a.provider_id::text = pr.id::text
      WHERE DATE(a.start_time) BETWEEN $1 AND $2
      GROUP BY pr.id, pr.first_name, pr.last_name, pr.specialization
      ORDER BY completion_rate DESC
    `, [startDate, endDate]);

    const detailResult = await pool.query(`
      SELECT
        a.id, a.start_time, a.status, a.type,
        CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
        p.id AS patient_id,
        CONCAT(pr.first_name, ' ', pr.last_name) AS provider_name
      FROM appointments a
      LEFT JOIN patients p ON a.patient_id::text = p.id::text
      LEFT JOIN providers pr ON a.provider_id::text = pr.id::text
      WHERE DATE(a.start_time) BETWEEN $1 AND $2
      ORDER BY a.start_time DESC
      LIMIT 500
    `, [startDate, endDate]);

    res.json({ summary: summaryResult.rows, details: detailResult.rows });
  } catch (error) {
    console.error('Patient satisfaction report error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// ─────────────────────────────────────────────
// PROVIDER REPORTS
// ─────────────────────────────────────────────

// Doctor Productivity Report
router.get('/provider/productivity', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { startDate, endDate } = getDateRange(req.query);

    const summaryResult = await pool.query(`
      SELECT
        pr.id AS provider_id,
        CONCAT(pr.first_name, ' ', pr.last_name) AS provider_name,
        pr.specialization,
        COUNT(a.id)::int AS total_appointments,
        COUNT(CASE WHEN a.status = 'Completed' THEN 1 END)::int AS completed,
        COUNT(CASE WHEN a.status IN ('No-Show','no-show') THEN 1 END)::int AS no_shows,
        COUNT(CASE WHEN a.status = 'Cancelled' THEN 1 END)::int AS cancelled,
        ROUND(
          COUNT(CASE WHEN a.status = 'Completed' THEN 1 END)::numeric /
          NULLIF(COUNT(a.id), 0) * 100, 1
        ) AS completion_rate,
        COALESCE(SUM(c.amount), 0)::numeric AS total_revenue
      FROM providers pr
      LEFT JOIN appointments a ON pr.id::text = a.provider_id::text
        AND DATE(a.start_time) BETWEEN $1 AND $2
      LEFT JOIN claims c ON pr.id::text = c.provider_id::text
        AND c.service_date BETWEEN $1 AND $2
      GROUP BY pr.id, pr.first_name, pr.last_name, pr.specialization
      ORDER BY completed DESC
    `, [startDate, endDate]);

    const detailResult = await pool.query(`
      SELECT
        a.id, a.start_time, a.status, a.type,
        CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
        CONCAT(pr.first_name, ' ', pr.last_name) AS provider_name,
        pr.specialization
      FROM appointments a
      LEFT JOIN patients p ON a.patient_id::text = p.id::text
      LEFT JOIN providers pr ON a.provider_id::text = pr.id::text
      WHERE DATE(a.start_time) BETWEEN $1 AND $2
      ORDER BY pr.last_name, a.start_time DESC
      LIMIT 500
    `, [startDate, endDate]);

    res.json({ summary: summaryResult.rows, details: detailResult.rows });
  } catch (error) {
    console.error('Doctor productivity report error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Appointment Volume by Provider
router.get('/provider/appointment-volume', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { startDate, endDate } = getDateRange(req.query);

    const summaryResult = await pool.query(`
      SELECT
        CONCAT(pr.first_name, ' ', pr.last_name) AS provider_name,
        pr.specialization,
        DATE_TRUNC('week', a.start_time)::date AS week,
        COUNT(a.id)::int AS appointment_count
      FROM appointments a
      LEFT JOIN providers pr ON a.provider_id::text = pr.id::text
      WHERE DATE(a.start_time) BETWEEN $1 AND $2
      GROUP BY pr.id, pr.first_name, pr.last_name, pr.specialization, DATE_TRUNC('week', a.start_time)
      ORDER BY week DESC, appointment_count DESC
    `, [startDate, endDate]);

    const byProvider = await pool.query(`
      SELECT
        pr.id AS provider_id,
        CONCAT(pr.first_name, ' ', pr.last_name) AS provider_name,
        pr.specialization,
        COUNT(a.id)::int AS total_appointments,
        COUNT(CASE WHEN a.type = 'Telehealth' THEN 1 END)::int AS telehealth_count,
        COUNT(CASE WHEN a.type != 'Telehealth' OR a.type IS NULL THEN 1 END)::int AS in_person_count
      FROM providers pr
      LEFT JOIN appointments a ON pr.id::text = a.provider_id::text
        AND DATE(a.start_time) BETWEEN $1 AND $2
      GROUP BY pr.id, pr.first_name, pr.last_name, pr.specialization
      ORDER BY total_appointments DESC
    `, [startDate, endDate]);

    res.json({ summary: summaryResult.rows, byProvider: byProvider.rows });
  } catch (error) {
    console.error('Appointment volume report error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Revenue by Provider
router.get('/provider/revenue', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { startDate, endDate } = getDateRange(req.query);

    const summaryResult = await pool.query(`
      SELECT
        pr.id AS provider_id,
        CONCAT(pr.first_name, ' ', pr.last_name) AS provider_name,
        pr.specialization,
        COUNT(c.id)::int AS claim_count,
        COALESCE(SUM(c.amount), 0)::numeric AS total_billed,
        COALESCE(SUM(CASE WHEN c.status IN ('Approved','Paid') THEN c.amount ELSE 0 END), 0)::numeric AS collected,
        COALESCE(SUM(CASE WHEN c.status = 'Denied' THEN c.amount ELSE 0 END), 0)::numeric AS denied,
        ROUND(
          COALESCE(SUM(CASE WHEN c.status IN ('Approved','Paid') THEN c.amount ELSE 0 END), 0) /
          NULLIF(SUM(c.amount), 0) * 100, 1
        ) AS collection_rate
      FROM providers pr
      LEFT JOIN claims c ON pr.id::text = c.provider_id::text
        AND c.service_date BETWEEN $1 AND $2
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
      LEFT JOIN patients p ON c.patient_id::text = p.id::text
      LEFT JOIN providers pr ON c.provider_id::text = pr.id::text
      WHERE c.service_date BETWEEN $1 AND $2
      ORDER BY pr.last_name, c.service_date DESC
      LIMIT 500
    `, [startDate, endDate]);

    res.json({ summary: summaryResult.rows, details: detailResult.rows });
  } catch (error) {
    console.error('Revenue by provider report error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Telehealth Usage Report
router.get('/provider/telehealth-usage', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { startDate, endDate } = getDateRange(req.query);

    let summaryResult, detailResult;
    try {
      summaryResult = await pool.query(`
        SELECT
          CONCAT(pr.first_name, ' ', pr.last_name) AS provider_name,
          pr.specialization,
          COUNT(ts.id)::int AS session_count,
          COALESCE(SUM(ts.duration), 0)::numeric AS total_duration_minutes,
          COALESCE(AVG(ts.duration), 0)::numeric AS avg_duration_minutes
        FROM telehealth_sessions ts
        LEFT JOIN providers pr ON ts.provider_id::text = pr.id::text
        WHERE DATE(ts.created_at) BETWEEN $1 AND $2
        GROUP BY pr.id, pr.first_name, pr.last_name, pr.specialization
        ORDER BY session_count DESC
      `, [startDate, endDate]);

      detailResult = await pool.query(`
        SELECT
          ts.id, ts.created_at, ts.status, ts.duration, ts.platform,
          CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
          p.id AS patient_id,
          CONCAT(pr.first_name, ' ', pr.last_name) AS provider_name
        FROM telehealth_sessions ts
        LEFT JOIN patients p ON ts.patient_id::text = p.id::text
        LEFT JOIN providers pr ON ts.provider_id::text = pr.id::text
        WHERE DATE(ts.created_at) BETWEEN $1 AND $2
        ORDER BY ts.created_at DESC
        LIMIT 500
      `, [startDate, endDate]);
    } catch (e) {
      // Fallback to appointments with telehealth type
      summaryResult = await pool.query(`
        SELECT
          CONCAT(pr.first_name, ' ', pr.last_name) AS provider_name,
          pr.specialization,
          COUNT(a.id)::int AS session_count,
          0 AS total_duration_minutes,
          0 AS avg_duration_minutes
        FROM appointments a
        LEFT JOIN providers pr ON a.provider_id::text = pr.id::text
        WHERE DATE(a.start_time) BETWEEN $1 AND $2
          AND LOWER(a.type) LIKE '%telehealth%'
        GROUP BY pr.id, pr.first_name, pr.last_name, pr.specialization
        ORDER BY session_count DESC
      `, [startDate, endDate]);

      detailResult = await pool.query(`
        SELECT
          a.id, a.start_time AS created_at, a.status,
          NULL AS duration, a.type AS platform,
          CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
          p.id AS patient_id,
          CONCAT(pr.first_name, ' ', pr.last_name) AS provider_name
        FROM appointments a
        LEFT JOIN patients p ON a.patient_id::text = p.id::text
        LEFT JOIN providers pr ON a.provider_id::text = pr.id::text
        WHERE DATE(a.start_time) BETWEEN $1 AND $2
          AND LOWER(a.type) LIKE '%telehealth%'
        ORDER BY a.start_time DESC
        LIMIT 500
      `, [startDate, endDate]);
    }

    res.json({ summary: summaryResult.rows, details: detailResult.rows });
  } catch (error) {
    console.error('Telehealth usage report error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// ─────────────────────────────────────────────
// COMPLIANCE REPORTS
// ─────────────────────────────────────────────

// Audit Logs Report
router.get('/compliance/audit-logs', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { startDate, endDate } = getDateRange(req.query);

    // Check if audit_logs table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'audit_logs'
      )
    `);

    if (!tableCheck.rows[0].exists) {
      return res.json({ summary: [], details: [], message: 'Audit logs table not found' });
    }

    const summaryResult = await pool.query(`
      SELECT
        action,
        COUNT(*)::int AS count,
        COUNT(DISTINCT user_id)::int AS unique_users
      FROM audit_logs
      WHERE created_at::date BETWEEN $1 AND $2
      GROUP BY action
      ORDER BY count DESC
    `, [startDate, endDate]);

    const detailResult = await pool.query(`
      SELECT
        al.id, al.created_at, al.action, al.resource_type,
        al.resource_id, al.user_id, al.ip_address, al.details,
        CONCAT(u.first_name, ' ', u.last_name) AS user_name,
        u.role AS user_role
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id::text = u.id::text
      WHERE al.created_at::date BETWEEN $1 AND $2
      ORDER BY al.created_at DESC
      LIMIT 500
    `, [startDate, endDate]);

    res.json({ summary: summaryResult.rows, details: detailResult.rows });
  } catch (error) {
    console.error('Audit logs report error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Access Logs Report
router.get('/compliance/access-logs', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { startDate, endDate } = getDateRange(req.query);

    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'audit_logs'
      )
    `);

    if (!tableCheck.rows[0].exists) {
      return res.json({ summary: [], details: [], message: 'Audit logs table not found' });
    }

    const summaryResult = await pool.query(`
      SELECT
        CONCAT(u.first_name, ' ', u.last_name) AS user_name,
        u.role AS user_role,
        COUNT(al.id)::int AS access_count,
        COUNT(DISTINCT al.resource_type)::int AS resources_accessed,
        MAX(al.created_at) AS last_access
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id::text = u.id::text
      WHERE al.created_at::date BETWEEN $1 AND $2
      GROUP BY u.id, u.first_name, u.last_name, u.role
      ORDER BY access_count DESC
      LIMIT 50
    `, [startDate, endDate]);

    const detailResult = await pool.query(`
      SELECT
        al.id, al.created_at, al.action, al.resource_type,
        al.resource_id, al.ip_address,
        CONCAT(u.first_name, ' ', u.last_name) AS user_name,
        u.role AS user_role
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id::text = u.id::text
      WHERE al.created_at::date BETWEEN $1 AND $2
        AND al.action IN ('view','read','access','login')
      ORDER BY al.created_at DESC
      LIMIT 500
    `, [startDate, endDate]);

    res.json({ summary: summaryResult.rows, details: detailResult.rows });
  } catch (error) {
    console.error('Access logs report error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// HIPAA Compliance Report
router.get('/compliance/hipaa', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { startDate, endDate } = getDateRange(req.query);

    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'audit_logs'
      )
    `);

    let auditData = [], phiAccessData = [];

    if (tableCheck.rows[0].exists) {
      const auditResult = await pool.query(`
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

      auditData = auditResult.rows;

      const phiResult = await pool.query(`
        SELECT
          al.created_at, al.action, al.resource_type, al.resource_id,
          al.ip_address,
          CONCAT(u.first_name, ' ', u.last_name) AS user_name,
          u.role AS user_role
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id::text = u.id::text
        WHERE al.created_at::date BETWEEN $1 AND $2
          AND al.resource_type IN ('patients','medical_records','prescriptions','lab_orders','diagnoses')
        ORDER BY al.created_at DESC
        LIMIT 200
      `, [startDate, endDate]);

      phiAccessData = phiResult.rows;
    }

    // Get user count and role breakdown
    const userStats = await pool.query(`
      SELECT role, COUNT(*)::int AS count FROM users GROUP BY role ORDER BY count DESC
    `);

    res.json({
      phiAccess: auditData,
      phiAccessDetails: phiAccessData,
      userStats: userStats.rows,
      reportGenerated: new Date().toISOString()
    });
  } catch (error) {
    console.error('HIPAA compliance report error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Data Access History Report
router.get('/compliance/data-access-history', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { startDate, endDate } = getDateRange(req.query);

    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'audit_logs'
      )
    `);

    if (!tableCheck.rows[0].exists) {
      return res.json({ summary: [], details: [], message: 'Audit logs table not found' });
    }

    const summaryResult = await pool.query(`
      SELECT
        al.resource_type,
        al.action,
        COUNT(*)::int AS count,
        COUNT(DISTINCT al.user_id)::int AS unique_users,
        MAX(al.created_at) AS last_access
      FROM audit_logs al
      WHERE al.created_at::date BETWEEN $1 AND $2
      GROUP BY al.resource_type, al.action
      ORDER BY count DESC
    `, [startDate, endDate]);

    const detailResult = await pool.query(`
      SELECT
        al.id, al.created_at, al.action, al.resource_type,
        al.resource_id, al.ip_address, al.details,
        CONCAT(u.first_name, ' ', u.last_name) AS user_name,
        u.role AS user_role
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id::text = u.id::text
      WHERE al.created_at::date BETWEEN $1 AND $2
      ORDER BY al.created_at DESC
      LIMIT 500
    `, [startDate, endDate]);

    res.json({ summary: summaryResult.rows, details: detailResult.rows });
  } catch (error) {
    console.error('Data access history report error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// ─────────────────────────────────────────────
// CUSTOM REPORT
// ─────────────────────────────────────────────

router.post('/custom', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { dataSource, fields, filters, groupBy, sortBy, sortOrder, limit = 200 } = req.body;

    // Whitelist allowed tables and fields to prevent SQL injection
    const allowedTables = {
      appointments: {
        alias: 'a',
        table: 'appointments',
        fields: ['id', 'start_time', 'end_time', 'status', 'type', 'reason'],
        joins: [
          'LEFT JOIN patients p ON a.patient_id::text = p.id::text',
          'LEFT JOIN providers pr ON a.provider_id::text = pr.id::text'
        ],
        extra_fields: {
          patient_name: "CONCAT(p.first_name, ' ', p.last_name)",
          provider_name: "CONCAT(pr.first_name, ' ', pr.last_name)",
          specialization: 'pr.specialization'
        }
      },
      claims: {
        alias: 'c',
        table: 'claims',
        fields: ['id', 'claim_number', 'service_date', 'status', 'amount', 'payer', 'denial_reason'],
        joins: [
          'LEFT JOIN patients p ON c.patient_id::text = p.id::text',
          'LEFT JOIN providers pr ON c.provider_id::text = pr.id::text'
        ],
        extra_fields: {
          patient_name: "CONCAT(p.first_name, ' ', p.last_name)",
          provider_name: "CONCAT(pr.first_name, ' ', pr.last_name)"
        }
      },
      payments: {
        alias: 'pm',
        table: 'payments',
        fields: ['id', 'payment_date', 'amount', 'payment_method', 'status', 'notes'],
        joins: [
          'LEFT JOIN patients p ON pm.patient_id::text = p.id::text'
        ],
        extra_fields: {
          patient_name: "CONCAT(p.first_name, ' ', p.last_name)"
        }
      },
      patients: {
        alias: 'p',
        table: 'patients',
        fields: ['id', 'first_name', 'last_name', 'date_of_birth', 'gender', 'phone', 'email', 'insurance_provider', 'state', 'city'],
        joins: [],
        extra_fields: {}
      }
    };

    const tableConfig = allowedTables[dataSource];
    if (!tableConfig) {
      return res.status(400).json({ error: 'Invalid data source' });
    }

    const { alias, table, fields: allowedFields, joins, extra_fields } = tableConfig;

    // Build SELECT clause
    const selectedFields = (fields || allowedFields).filter(f =>
      allowedFields.includes(f) || extra_fields[f]
    );

    const selectClauses = selectedFields.map(f => {
      if (extra_fields[f]) return `${extra_fields[f]} AS ${f}`;
      return `${alias}.${f}`;
    });

    // Build WHERE clause from filters
    const whereClauses = [];
    const params = [];
    let paramIdx = 1;

    if (filters) {
      if (filters.startDate) {
        whereClauses.push(`DATE(${alias}.${allowedFields[1]}) >= $${paramIdx++}`);
        params.push(filters.startDate);
      }
      if (filters.endDate) {
        whereClauses.push(`DATE(${alias}.${allowedFields[1]}) <= $${paramIdx++}`);
        params.push(filters.endDate);
      }
      if (filters.status) {
        whereClauses.push(`${alias}.status = $${paramIdx++}`);
        params.push(filters.status);
      }
    }

    // Build GROUP BY
    let groupByClause = '';
    if (groupBy && selectedFields.includes(groupBy) && allowedFields.includes(groupBy)) {
      groupByClause = `GROUP BY ${alias}.${groupBy}`;
    }

    // Build ORDER BY
    let orderByClause = 'ORDER BY 1 DESC';
    if (sortBy && (selectedFields.includes(sortBy) || extra_fields[sortBy])) {
      const dir = sortOrder === 'asc' ? 'ASC' : 'DESC';
      orderByClause = `ORDER BY ${sortBy} ${dir}`;
    }

    const query = `
      SELECT ${selectClauses.join(', ')}
      FROM ${table} ${alias}
      ${joins.join('\n')}
      ${whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : ''}
      ${groupByClause}
      ${orderByClause}
      LIMIT $${paramIdx}
    `;
    params.push(Math.min(parseInt(limit) || 200, 1000));

    const result = await pool.query(query, params);
    res.json({ data: result.rows, fields: selectedFields });
  } catch (error) {
    console.error('Custom report error:', error);
    res.status(500).json({ error: 'Failed to generate custom report' });
  }
});

module.exports = router;
