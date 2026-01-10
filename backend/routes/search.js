const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

/**
 * Universal search endpoint that searches across all modules
 * GET /api/search?q=query&limit=20
 */
router.get('/', async (req, res) => {
  try {
    const { q: query, limit = 20 } = req.query;

    if (!query || query.trim().length < 2) {
      return res.json([]);
    }

    const searchQuery = query.trim();
    const searchLimit = Math.min(parseInt(limit) || 20, 100);

    // Perform searches in parallel across all tables
    const [
      patients,
      appointments,
      providers,
      claims,
      payments,
      prescriptions,
      labOrders,
      diagnoses,
      tasks,
      offerings,
      campaigns,
      preapprovals,
      denials
    ] = await Promise.all([
      // Search Patients
      pool.query(`
        SELECT
          id,
          first_name,
          last_name,
          mrn,
          email,
          phone,
          date_of_birth,
          'patient' as result_type,
          'ehr' as module
        FROM patients
        WHERE
          LOWER(first_name || ' ' || last_name) LIKE LOWER($1)
          OR LOWER(mrn) LIKE LOWER($1)
          OR LOWER(email) LIKE LOWER($1)
          OR LOWER(phone) LIKE LOWER($1)
        ORDER BY
          CASE
            WHEN LOWER(first_name || ' ' || last_name) = LOWER($2) THEN 1
            WHEN LOWER(first_name || ' ' || last_name) LIKE LOWER($2 || '%') THEN 2
            ELSE 3
          END
        LIMIT $3
      `, [`%${searchQuery}%`, searchQuery, searchLimit]),

      // Search Appointments
      pool.query(`
        SELECT
          a.id,
          a.patient_id,
          a.provider_id,
          a.start_time,
          a.end_time,
          a.status,
          a.appointment_type,
          a.reason,
          p.first_name as patient_first_name,
          p.last_name as patient_last_name,
          pr.first_name as provider_first_name,
          pr.last_name as provider_last_name,
          'appointment' as result_type,
          'practiceManagement' as module
        FROM appointments a
        LEFT JOIN patients p ON a.patient_id = p.id
        LEFT JOIN providers pr ON a.provider_id = pr.id
        WHERE
          LOWER(p.first_name || ' ' || p.last_name) LIKE LOWER($1)
          OR LOWER(pr.first_name || ' ' || pr.last_name) LIKE LOWER($1)
          OR LOWER(a.reason) LIKE LOWER($1)
          OR LOWER(a.appointment_type) LIKE LOWER($1)
        ORDER BY a.start_time DESC
        LIMIT $2
      `, [`%${searchQuery}%`, searchLimit]),

      // Search Providers
      pool.query(`
        SELECT
          id,
          first_name,
          last_name,
          email,
          phone,
          specialty,
          npi,
          'provider' as result_type,
          'providerManagement' as module
        FROM providers
        WHERE
          LOWER(first_name || ' ' || last_name) LIKE LOWER($1)
          OR LOWER(email) LIKE LOWER($1)
          OR LOWER(specialty) LIKE LOWER($1)
          OR LOWER(npi) LIKE LOWER($1)
        ORDER BY last_name, first_name
        LIMIT $2
      `, [`%${searchQuery}%`, searchLimit]),

      // Search Claims
      pool.query(`
        SELECT
          c.id,
          c.claim_number,
          c.patient_id,
          c.status,
          c.total_charge,
          c.date_of_service,
          p.first_name as patient_first_name,
          p.last_name as patient_last_name,
          'claim' as result_type,
          'rcm' as module
        FROM claims c
        LEFT JOIN patients p ON c.patient_id = p.id
        WHERE
          LOWER(c.claim_number) LIKE LOWER($1)
          OR LOWER(p.first_name || ' ' || p.last_name) LIKE LOWER($1)
          OR LOWER(c.status) LIKE LOWER($1)
        ORDER BY c.created_at DESC
        LIMIT $2
      `, [`%${searchQuery}%`, searchLimit]),

      // Search Payments
      pool.query(`
        SELECT
          pay.id,
          pay.payment_number,
          pay.patient_id,
          pay.amount,
          pay.payment_date,
          pay.payment_method,
          pay.status,
          p.first_name as patient_first_name,
          p.last_name as patient_last_name,
          'payment' as result_type,
          'rcm' as module
        FROM payments pay
        LEFT JOIN patients p ON pay.patient_id = p.id
        WHERE
          LOWER(pay.payment_number) LIKE LOWER($1)
          OR LOWER(p.first_name || ' ' || p.last_name) LIKE LOWER($1)
          OR LOWER(pay.payment_method) LIKE LOWER($1)
        ORDER BY pay.payment_date DESC
        LIMIT $2
      `, [`%${searchQuery}%`, searchLimit]),

      // Search Prescriptions
      pool.query(`
        SELECT
          pr.id,
          pr.patient_id,
          pr.provider_id,
          pr.medication_name,
          pr.dosage,
          pr.frequency,
          pr.status,
          p.first_name as patient_first_name,
          p.last_name as patient_last_name,
          prov.first_name as provider_first_name,
          prov.last_name as provider_last_name,
          'prescription' as result_type,
          'ehr' as module
        FROM prescriptions pr
        LEFT JOIN patients p ON pr.patient_id = p.id
        LEFT JOIN providers prov ON pr.provider_id = prov.id
        WHERE
          LOWER(pr.medication_name) LIKE LOWER($1)
          OR LOWER(p.first_name || ' ' || p.last_name) LIKE LOWER($1)
          OR LOWER(prov.first_name || ' ' || prov.last_name) LIKE LOWER($1)
        ORDER BY pr.created_at DESC
        LIMIT $2
      `, [`%${searchQuery}%`, searchLimit]),

      // Search Lab Orders
      pool.query(`
        SELECT
          lo.id,
          lo.patient_id,
          lo.provider_id,
          lo.test_name,
          lo.status,
          lo.order_date,
          p.first_name as patient_first_name,
          p.last_name as patient_last_name,
          prov.first_name as provider_first_name,
          prov.last_name as provider_last_name,
          'lab_order' as result_type,
          'ehr' as module
        FROM lab_orders lo
        LEFT JOIN patients p ON lo.patient_id = p.id
        LEFT JOIN providers prov ON lo.provider_id = prov.id
        WHERE
          LOWER(lo.test_name) LIKE LOWER($1)
          OR LOWER(p.first_name || ' ' || p.last_name) LIKE LOWER($1)
          OR LOWER(lo.status) LIKE LOWER($1)
        ORDER BY lo.order_date DESC
        LIMIT $2
      `, [`%${searchQuery}%`, searchLimit]),

      // Search Diagnoses
      pool.query(`
        SELECT
          d.id,
          d.patient_id,
          d.provider_id,
          d.icd_code,
          d.description,
          d.diagnosis_date,
          d.status,
          p.first_name as patient_first_name,
          p.last_name as patient_last_name,
          prov.first_name as provider_first_name,
          prov.last_name as provider_last_name,
          'diagnosis' as result_type,
          'ehr' as module
        FROM diagnoses d
        LEFT JOIN patients p ON d.patient_id = p.id
        LEFT JOIN providers prov ON d.provider_id = prov.id
        WHERE
          LOWER(d.icd_code) LIKE LOWER($1)
          OR LOWER(d.description) LIKE LOWER($1)
          OR LOWER(p.first_name || ' ' || p.last_name) LIKE LOWER($1)
        ORDER BY d.diagnosis_date DESC
        LIMIT $2
      `, [`%${searchQuery}%`, searchLimit]),

      // Search Tasks
      pool.query(`
        SELECT
          t.id,
          t.title,
          t.description,
          t.status,
          t.priority,
          t.assigned_to,
          t.due_date,
          u.username as assigned_to_name,
          'task' as result_type,
          'dashboard' as module
        FROM tasks t
        LEFT JOIN users u ON t.assigned_to = u.id
        WHERE
          LOWER(t.title) LIKE LOWER($1)
          OR LOWER(t.description) LIKE LOWER($1)
          OR LOWER(u.username) LIKE LOWER($1)
        ORDER BY t.created_at DESC
        LIMIT $2
      `, [`%${searchQuery}%`, searchLimit]),

      // Search Clinical Service Offerings
      pool.query(`
        SELECT
          o.id,
          o.name,
          o.description,
          o.price,
          o.duration,
          o.specialization,
          'offering' as result_type,
          'clinicalServices' as module
        FROM offerings o
        WHERE
          LOWER(o.name) LIKE LOWER($1)
          OR LOWER(o.description) LIKE LOWER($1)
          OR LOWER(o.specialization) LIKE LOWER($1)
        ORDER BY o.name
        LIMIT $2
      `, [`%${searchQuery}%`, searchLimit]),

      // Search Campaigns
      pool.query(`
        SELECT
          c.id,
          c.name,
          c.description,
          c.status,
          c.start_date,
          c.end_date,
          c.target_audience,
          'campaign' as result_type,
          'crm' as module
        FROM campaigns c
        WHERE
          LOWER(c.name) LIKE LOWER($1)
          OR LOWER(c.description) LIKE LOWER($1)
          OR LOWER(c.target_audience) LIKE LOWER($1)
        ORDER BY c.created_at DESC
        LIMIT $2
      `, [`%${searchQuery}%`, searchLimit]),

      // Search Preapprovals
      pool.query(`
        SELECT
          pa.id,
          pa.patient_id,
          pa.authorization_number,
          pa.status,
          pa.service_type,
          pa.request_date,
          p.first_name as patient_first_name,
          p.last_name as patient_last_name,
          'preapproval' as result_type,
          'rcm' as module
        FROM preapprovals pa
        LEFT JOIN patients p ON pa.patient_id = p.id
        WHERE
          LOWER(pa.authorization_number) LIKE LOWER($1)
          OR LOWER(pa.service_type) LIKE LOWER($1)
          OR LOWER(p.first_name || ' ' || p.last_name) LIKE LOWER($1)
        ORDER BY pa.request_date DESC
        LIMIT $2
      `, [`%${searchQuery}%`, searchLimit]),

      // Search Denials
      pool.query(`
        SELECT
          d.id,
          d.claim_id,
          d.denial_code,
          d.denial_reason,
          d.status,
          d.denial_date,
          'denial' as result_type,
          'rcm' as module
        FROM denials d
        WHERE
          LOWER(d.denial_code) LIKE LOWER($1)
          OR LOWER(d.denial_reason) LIKE LOWER($1)
          OR LOWER(d.status) LIKE LOWER($1)
        ORDER BY d.denial_date DESC
        LIMIT $2
      `, [`%${searchQuery}%`, searchLimit])
    ]);

    // Combine all results
    const allResults = [
      ...patients.rows,
      ...appointments.rows,
      ...providers.rows,
      ...claims.rows,
      ...payments.rows,
      ...prescriptions.rows,
      ...labOrders.rows,
      ...diagnoses.rows,
      ...tasks.rows,
      ...offerings.rows,
      ...campaigns.rows,
      ...preapprovals.rows,
      ...denials.rows
    ];

    // Sort by relevance and limit
    const sortedResults = allResults
      .slice(0, searchLimit)
      .map(result => ({
        ...result,
        // Add display name for easier rendering
        display_name: getDisplayName(result),
        display_subtitle: getDisplaySubtitle(result)
      }));

    res.json(sortedResults);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Failed to perform search' });
  }
});

/**
 * Helper function to get display name for a search result
 */
function getDisplayName(result) {
  switch (result.result_type) {
    case 'patient':
      return `${result.first_name || ''} ${result.last_name || ''}`.trim();
    case 'appointment':
      return `${result.patient_first_name || ''} ${result.patient_last_name || ''}`.trim();
    case 'provider':
      return `${result.first_name || ''} ${result.last_name || ''}`.trim();
    case 'claim':
      return `Claim #${result.claim_number}`;
    case 'payment':
      return `Payment #${result.payment_number}`;
    case 'prescription':
      return result.medication_name;
    case 'lab_order':
      return result.test_name;
    case 'diagnosis':
      return result.description || result.icd_code;
    case 'task':
      return result.title;
    case 'offering':
      return result.name;
    case 'campaign':
      return result.name;
    case 'preapproval':
      return `Authorization #${result.authorization_number}`;
    case 'denial':
      return `Denial - ${result.denial_reason}`;
    default:
      return 'Unknown';
  }
}

/**
 * Helper function to get display subtitle for a search result
 */
function getDisplaySubtitle(result) {
  switch (result.result_type) {
    case 'patient':
      return `MRN: ${result.mrn || 'N/A'}`;
    case 'appointment':
      const appointmentDate = result.start_time ? new Date(result.start_time).toLocaleString() : 'N/A';
      return `${appointmentDate} - ${result.status || 'N/A'}`;
    case 'provider':
      return result.specialty || result.email || '';
    case 'claim':
      return `Patient: ${result.patient_first_name || ''} ${result.patient_last_name || ''} - ${result.status}`;
    case 'payment':
      return `Patient: ${result.patient_first_name || ''} ${result.patient_last_name || ''} - $${result.amount}`;
    case 'prescription':
      return `Patient: ${result.patient_first_name || ''} ${result.patient_last_name || ''} - ${result.dosage || ''}`;
    case 'lab_order':
      return `Patient: ${result.patient_first_name || ''} ${result.patient_last_name || ''} - ${result.status}`;
    case 'diagnosis':
      return `Patient: ${result.patient_first_name || ''} ${result.patient_last_name || ''} - ${result.icd_code}`;
    case 'task':
      return `${result.priority || ''} - ${result.status || ''}`;
    case 'offering':
      return `$${result.price || 'N/A'} - ${result.duration || ''} mins`;
    case 'campaign':
      return result.status || '';
    case 'preapproval':
      return `Patient: ${result.patient_first_name || ''} ${result.patient_last_name || ''} - ${result.status}`;
    case 'denial':
      return `Code: ${result.denial_code} - ${result.status}`;
    default:
      return '';
  }
}

module.exports = router;
