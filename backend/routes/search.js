const express = require('express');
const { authenticate } = require('../middleware/auth');
const { resolveViewPermissions } = require('../utils/searchAccess');
const router = express.Router();
router.use(authenticate);

/**
 * Universal search endpoint that searches across all modules
 * GET /api/search?q=query&limit=20
 */
router.get('/', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { q: query, limit = 20 } = req.query;

    if (!query || query.trim().length < 2) {
      return res.json([]);
    }

    const searchQuery = query.trim();
    const searchLimit = Math.min(parseInt(limit) || 20, 100);

    // Array to hold all search promises
    const searchPromises = [];

    // Helper function to safely execute search queries
    const safeSearch = async (searchFn, errorLabel) => {
      try {
        return await searchFn();
      } catch (error) {
        console.error(`${errorLabel} search error:`, error.message);
        return { rows: [] };
      }
    };

    // ── Access scoping ───────────────────────────────────────────────────────
    // A patient searches only their own chart. Everything below this point is
    // the staff index, which spans every patient in the practice.
    if (req.user.role === 'patient') {
      const own = await patientScopedSearch(pool, safeSearch, req.user.id, searchQuery, searchLimit);
      return res.json(decorate(own, searchLimit));
    }

    // Staff see only the modules their role is permitted to view. `null` means
    // the result type is open to every authenticated staff member.
    const canView = await resolveViewPermissions(pool, req.user.role);
    const pushIf = (permissionModule, queryFn, label) => {
      if (permissionModule === null || canView.has(permissionModule)) {
        searchPromises.push(safeSearch(queryFn, label));
      }
    };

    // Search Patients
    pushIf('patients',
        () => pool.query(`
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
            OR LOWER(COALESCE(mrn, '')) LIKE LOWER($1)
            OR LOWER(COALESCE(email, '')) LIKE LOWER($1)
            OR LOWER(COALESCE(phone, '')) LIKE LOWER($1)
          ORDER BY
            CASE
              WHEN LOWER(first_name || ' ' || last_name) = LOWER($2) THEN 1
              WHEN LOWER(first_name || ' ' || last_name) LIKE LOWER($2 || '%') THEN 2
              ELSE 3
            END
          LIMIT $3
        `, [`%${searchQuery}%`, searchQuery, searchLimit]),
        'Patients'
    );

    // Search Appointments
    pushIf('appointments',
        () => pool.query(`
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
          LEFT JOIN patients p ON a.patient_id::text = p.id::text
          LEFT JOIN providers pr ON a.provider_id::text = pr.id::text
          WHERE
            LOWER(COALESCE(p.first_name || ' ' || p.last_name, '')) LIKE LOWER($1)
            OR LOWER(COALESCE(pr.first_name || ' ' || pr.last_name, '')) LIKE LOWER($1)
            OR LOWER(COALESCE(a.reason, '')) LIKE LOWER($1)
            OR LOWER(COALESCE(a.appointment_type, '')) LIKE LOWER($1)
          ORDER BY a.start_time DESC
          LIMIT $2
        `, [`%${searchQuery}%`, searchLimit]),
        'Appointments'
    );

    // Search Providers (specialization not specialty, no npi)
    pushIf('patients',
        () => pool.query(`
          SELECT
            id,
            first_name,
            last_name,
            email,
            phone,
            specialization,
            license_number,
            'provider' as result_type,
            'providerManagement' as module
          FROM providers
          WHERE
            LOWER(first_name || ' ' || last_name) LIKE LOWER($1)
            OR LOWER(COALESCE(email, '')) LIKE LOWER($1)
            OR LOWER(COALESCE(specialization, '')) LIKE LOWER($1)
            OR LOWER(COALESCE(license_number, '')) LIKE LOWER($1)
          ORDER BY last_name, first_name
          LIMIT $2
        `, [`%${searchQuery}%`, searchLimit]),
        'Providers'
    );

    // Search Claims (amount not total_charge, service_date not date_of_service)
    pushIf('claims',
        () => pool.query(`
          SELECT
            c.id,
            c.claim_number,
            c.patient_id,
            c.status,
            c.amount,
            c.service_date,
            p.first_name as patient_first_name,
            p.last_name as patient_last_name,
            'claim' as result_type,
            'rcm' as module
          FROM claims c
          LEFT JOIN patients p ON c.patient_id::text = p.id::text
          WHERE
            LOWER(COALESCE(c.claim_number, '')) LIKE LOWER($1)
            OR LOWER(COALESCE(p.first_name || ' ' || p.last_name, '')) LIKE LOWER($1)
            OR LOWER(COALESCE(c.status, '')) LIKE LOWER($1)
          ORDER BY c.created_at DESC
          LIMIT $2
        `, [`%${searchQuery}%`, searchLimit]),
        'Claims'
    );

    // Search Payments
    pushIf('rcm',
        () => pool.query(`
          SELECT
            pay.id,
            pay.patient_id,
            pay.amount,
            pay.payment_method,
            p.first_name as patient_first_name,
            p.last_name as patient_last_name,
            'payment' as result_type,
            'rcm' as module
          FROM payments pay
          LEFT JOIN patients p ON pay.patient_id::text = p.id::text
          WHERE
            LOWER(COALESCE(p.first_name || ' ' || p.last_name, '')) LIKE LOWER($1)
            OR LOWER(COALESCE(pay.payment_method, '')) LIKE LOWER($1)
          ORDER BY pay.created_at DESC
          LIMIT $2
        `, [`%${searchQuery}%`, searchLimit]),
        'Payments'
    );

    // Search Prescriptions
    pushIf('ehr',
        () => pool.query(`
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
          LEFT JOIN patients p ON pr.patient_id::text = p.id::text
          LEFT JOIN providers prov ON pr.provider_id::text = prov.id::text
          WHERE
            LOWER(COALESCE(pr.medication_name, '')) LIKE LOWER($1)
            OR LOWER(COALESCE(p.first_name || ' ' || p.last_name, '')) LIKE LOWER($1)
            OR LOWER(COALESCE(prov.first_name || ' ' || prov.last_name, '')) LIKE LOWER($1)
          ORDER BY pr.created_at DESC
          LIMIT $2
        `, [`%${searchQuery}%`, searchLimit]),
        'Prescriptions'
    );

    // Search Lab Orders (order_number, order_type, status, collection_date)
    pushIf('ehr',
        () => pool.query(`
          SELECT
            lo.id,
            lo.patient_id,
            lo.provider_id,
            lo.order_number,
            lo.order_type,
            lo.status,
            lo.collection_date,
            'lab_order' as result_type,
            'ehr' as module
          FROM lab_orders lo
          WHERE
            LOWER(COALESCE(lo.order_number, '')) LIKE LOWER($1)
            OR LOWER(COALESCE(lo.order_type, '')) LIKE LOWER($1)
            OR LOWER(COALESCE(lo.status, '')) LIKE LOWER($1)
          ORDER BY lo.created_at DESC
          LIMIT $2
        `, [`%${searchQuery}%`, searchLimit]),
        'Lab Orders'
    );

    // Search Diagnosis (diagnosis_code, diagnosis_name, diagnosed_date)
    pushIf('ehr',
        () => pool.query(`
          SELECT
            d.id,
            d.patient_id,
            d.provider_id,
            d.diagnosis_code,
            d.diagnosis_name,
            d.description,
            d.diagnosed_date,
            p.first_name as patient_first_name,
            p.last_name as patient_last_name,
            prov.first_name as provider_first_name,
            prov.last_name as provider_last_name,
            'diagnosis' as result_type,
            'ehr' as module
          FROM diagnosis d
          LEFT JOIN patients p ON d.patient_id::text = p.id::text
          LEFT JOIN providers prov ON d.provider_id::text = prov.id::text
          WHERE
            LOWER(COALESCE(d.diagnosis_code, '')) LIKE LOWER($1)
            OR LOWER(COALESCE(d.diagnosis_name, '')) LIKE LOWER($1)
            OR LOWER(COALESCE(d.description, '')) LIKE LOWER($1)
            OR LOWER(COALESCE(p.first_name || ' ' || p.last_name, '')) LIKE LOWER($1)
          ORDER BY d.diagnosed_date DESC
          LIMIT $2
        `, [`%${searchQuery}%`, searchLimit]),
        'Diagnosis'
    );

    // Search Tasks (users.name not username)
    pushIf(null,
        () => pool.query(`
          SELECT
            t.id,
            t.title,
            t.description,
            t.status,
            t.priority,
            t.assigned_to,
            t.due_date,
            u.name as assigned_to_name,
            'task' as result_type,
            'dashboard' as module
          FROM tasks t
          LEFT JOIN users u ON t.assigned_to::text = u.id::text
          WHERE
            LOWER(COALESCE(t.title, '')) LIKE LOWER($1)
            OR LOWER(COALESCE(t.description, '')) LIKE LOWER($1)
            OR LOWER(COALESCE(u.name, '')) LIKE LOWER($1)
          ORDER BY t.created_at DESC
          LIMIT $2
        `, [`%${searchQuery}%`, searchLimit]),
        'Tasks'
    );

    // Search Healthcare Offerings (duration_minutes, no price, no specialization)
    pushIf('clinicalServices',
        () => pool.query(`
          SELECT
            o.id,
            o.name,
            o.description,
            o.duration_minutes,
            'offering' as result_type,
            'clinicalServices' as module
          FROM healthcare_offerings o
          WHERE
            LOWER(COALESCE(o.name, '')) LIKE LOWER($1)
            OR LOWER(COALESCE(o.description, '')) LIKE LOWER($1)
          ORDER BY o.name
          LIMIT $2
        `, [`%${searchQuery}%`, searchLimit]),
        'Healthcare Offerings'
    );

    // Search Campaigns
    pushIf('crm',
        () => pool.query(`
          SELECT
            c.id,
            c.name,
            c.email_content as description,
            c.status,
            c.scheduled_date as start_date,
            c.target_audience,
            'campaign' as result_type,
            'crm' as module
          FROM campaigns c
          WHERE
            LOWER(COALESCE(c.name, '')) LIKE LOWER($1)
            OR LOWER(COALESCE(c.email_content, '')) LIKE LOWER($1)
            OR LOWER(COALESCE(c.target_audience, '')) LIKE LOWER($1)
          ORDER BY c.created_at DESC
          LIMIT $2
        `, [`%${searchQuery}%`, searchLimit]),
        'Campaigns'
    );

    // Search Preapprovals (requested_service not service_type, created_at not request_date)
    pushIf('rcm',
        () => pool.query(`
          SELECT
            pa.id,
            pa.patient_id,
            pa.authorization_number,
            pa.status,
            pa.requested_service,
            pa.created_at as request_date,
            p.first_name as patient_first_name,
            p.last_name as patient_last_name,
            'preapproval' as result_type,
            'rcm' as module
          FROM preapprovals pa
          LEFT JOIN patients p ON pa.patient_id::text = p.id::text
          WHERE
            LOWER(COALESCE(pa.authorization_number, '')) LIKE LOWER($1)
            OR LOWER(COALESCE(pa.requested_service, '')) LIKE LOWER($1)
            OR LOWER(COALESCE(p.first_name || ' ' || p.last_name, '')) LIKE LOWER($1)
          ORDER BY pa.created_at DESC
          LIMIT $2
        `, [`%${searchQuery}%`, searchLimit]),
        'Preapprovals'
    );

    // Search Denials (denial_reason_code, denial_reason_description)
    pushIf('rcm',
        () => pool.query(`
          SELECT
            d.id,
            d.claim_id,
            d.denial_reason_code,
            d.denial_reason_description,
            d.status,
            d.denial_date,
            'denial' as result_type,
            'rcm' as module
          FROM denials d
          WHERE
            LOWER(COALESCE(d.denial_reason_code, '')) LIKE LOWER($1)
            OR LOWER(COALESCE(d.denial_reason_description, '')) LIKE LOWER($1)
            OR LOWER(COALESCE(d.status, '')) LIKE LOWER($1)
          ORDER BY d.denial_date DESC
          LIMIT $2
        `, [`%${searchQuery}%`, searchLimit]),
        'Denials'
    );

    // Search Billing Quotes
    pushIf('rcm',
        () => pool.query(`
          SELECT
            q.id,
            q.quote_number,
            q.patient_id,
            q.status,
            q.total_amount,
            q.issue_date,
            p.first_name as patient_first_name,
            p.last_name as patient_last_name,
            'billing_quote' as result_type,
            'billing' as module
          FROM billing_quotes q
          LEFT JOIN patients p ON q.patient_id::text = p.id::text
          WHERE
            LOWER(COALESCE(q.quote_number, '')) LIKE LOWER($1)
            OR LOWER(COALESCE(p.first_name || ' ' || p.last_name, '')) LIKE LOWER($1)
            OR LOWER(COALESCE(q.status, '')) LIKE LOWER($1)
            OR LOWER(COALESCE(q.notes, '')) LIKE LOWER($1)
          ORDER BY q.created_at DESC
          LIMIT $2
        `, [`%${searchQuery}%`, searchLimit]),
        'Billing Quotes'
    );

    // Search Billing Invoices
    pushIf('rcm',
        () => pool.query(`
          SELECT
            i.id,
            i.invoice_number,
            i.patient_id,
            i.status,
            i.total_amount,
            i.balance_due,
            i.due_date,
            p.first_name as patient_first_name,
            p.last_name as patient_last_name,
            'billing_invoice' as result_type,
            'billing' as module
          FROM billing_invoices i
          LEFT JOIN patients p ON i.patient_id::text = p.id::text
          WHERE
            LOWER(COALESCE(i.invoice_number, '')) LIKE LOWER($1)
            OR LOWER(COALESCE(p.first_name || ' ' || p.last_name, '')) LIKE LOWER($1)
            OR LOWER(COALESCE(i.status, '')) LIKE LOWER($1)
          ORDER BY i.created_at DESC
          LIMIT $2
        `, [`%${searchQuery}%`, searchLimit]),
        'Billing Invoices'
    );

    // Search Billing Coupons
    pushIf('rcm',
        () => pool.query(`
          SELECT
            c.id,
            c.code,
            c.name,
            c.description,
            c.discount_type,
            c.discount_value,
            c.is_active,
            'billing_coupon' as result_type,
            'billing' as module
          FROM billing_coupons c
          WHERE
            LOWER(COALESCE(c.code, '')) LIKE LOWER($1)
            OR LOWER(COALESCE(c.name, '')) LIKE LOWER($1)
            OR LOWER(COALESCE(c.description, '')) LIKE LOWER($1)
          ORDER BY c.created_at DESC
          LIMIT $2
        `, [`%${searchQuery}%`, searchLimit]),
        'Billing Coupons'
    );

    // Search Billing Payments
    pushIf('rcm',
        () => pool.query(`
          SELECT
            bp.id,
            bp.payment_number,
            bp.amount,
            bp.payment_method,
            bp.status,
            bp.payment_date,
            p.first_name as patient_first_name,
            p.last_name as patient_last_name,
            bi.invoice_number,
            'billing_payment' as result_type,
            'billing' as module
          FROM billing_payments bp
          LEFT JOIN patients p ON bp.patient_id::text = p.id::text
          LEFT JOIN billing_invoices bi ON bp.invoice_id::text = bi.id::text
          WHERE
            LOWER(COALESCE(bp.payment_number, '')) LIKE LOWER($1)
            OR LOWER(COALESCE(p.first_name || ' ' || p.last_name, '')) LIKE LOWER($1)
            OR LOWER(COALESCE(bp.payment_method, '')) LIKE LOWER($1)
            OR LOWER(COALESCE(bp.reference_number, '')) LIKE LOWER($1)
          ORDER BY bp.created_at DESC
          LIMIT $2
        `, [`%${searchQuery}%`, searchLimit]),
        'Billing Payments'
    );

    // Execute all searches in parallel
    const results = await Promise.all(searchPromises);

    // Combine all results
    const allResults = results.flatMap(result => result.rows || []);

    res.json(decorate(allResults, searchLimit));
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Failed to perform search', details: error.message });
  }
});

/** Trim to the requested limit and attach the display strings the UI shows. */
function decorate(rows, searchLimit) {
  return rows.slice(0, searchLimit).map(result => ({
    ...result,
    display_name: getDisplayName(result),
    display_subtitle: getDisplaySubtitle(result)
  }));
}

/**
 * Search restricted to one patient's own chart.
 *
 * Patients hold view permissions on ehr/appointments/claims so they can read
 * *their own* data through the portal; running the staff index for them would
 * expose the whole practice. This path never widens beyond `patientId`, and
 * omits the staff-only result types (providers, campaigns, offerings, tasks,
 * billing documents) entirely.
 */
async function patientScopedSearch(pool, safeSearch, patientId, searchQuery, searchLimit) {
  const like = `%${searchQuery}%`;
  const promises = [];

  // Own demographics
  promises.push(safeSearch(() => pool.query(`
    SELECT id, first_name, last_name, mrn, email, phone, date_of_birth,
           'patient' as result_type, 'patientPortal' as module
    FROM patients
    WHERE id = $1
      AND (LOWER(first_name || ' ' || last_name) LIKE LOWER($2)
        OR LOWER(COALESCE(mrn, '')) LIKE LOWER($2)
        OR LOWER(COALESCE(email, '')) LIKE LOWER($2))
    LIMIT $3
  `, [patientId, like, searchLimit]), 'Patient self'));

  // Own appointments
  promises.push(safeSearch(() => pool.query(`
    SELECT a.id, a.start_time, a.end_time, a.status, a.appointment_type, a.reason,
           a.patient_id, p.first_name as patient_first_name, p.last_name as patient_last_name,
           'appointment' as result_type, 'patientPortal' as module
    FROM appointments a
    LEFT JOIN patients p ON a.patient_id = p.id
    WHERE a.patient_id = $1
      AND (LOWER(COALESCE(a.appointment_type, '')) LIKE LOWER($2)
        OR LOWER(COALESCE(a.reason, '')) LIKE LOWER($2)
        OR LOWER(COALESCE(a.status, '')) LIKE LOWER($2))
    ORDER BY a.start_time DESC
    LIMIT $3
  `, [patientId, like, searchLimit]), 'Patient appointments'));

  // Own prescriptions
  promises.push(safeSearch(() => pool.query(`
    SELECT pr.id, pr.medication_name, pr.dosage, pr.frequency, pr.status, pr.patient_id,
           'prescription' as result_type, 'patientPortal' as module
    FROM prescriptions pr
    WHERE pr.patient_id = $1
      AND (LOWER(COALESCE(pr.medication_name, '')) LIKE LOWER($2)
        OR LOWER(COALESCE(pr.dosage, '')) LIKE LOWER($2)
        OR LOWER(COALESCE(pr.status, '')) LIKE LOWER($2))
    ORDER BY pr.created_at DESC
    LIMIT $3
  `, [patientId, like, searchLimit]), 'Patient prescriptions'));

  // Own diagnoses
  promises.push(safeSearch(() => pool.query(`
    SELECT d.id, d.diagnosis_code, d.diagnosis_name, d.status, d.patient_id,
           'diagnosis' as result_type, 'patientPortal' as module
    FROM diagnosis d
    WHERE d.patient_id = $1
      AND (LOWER(COALESCE(d.diagnosis_name, '')) LIKE LOWER($2)
        OR LOWER(COALESCE(d.diagnosis_code, '')) LIKE LOWER($2))
    ORDER BY d.created_at DESC
    LIMIT $3
  `, [patientId, like, searchLimit]), 'Patient diagnoses'));

  // Own lab orders
  promises.push(safeSearch(() => pool.query(`
    SELECT lo.id, lo.order_number, lo.order_type, lo.status, lo.patient_id,
           'lab_order' as result_type, 'patientPortal' as module
    FROM lab_orders lo
    WHERE lo.patient_id = $1
      AND (LOWER(COALESCE(lo.order_number, '')) LIKE LOWER($2)
        OR LOWER(COALESCE(lo.order_type, '')) LIKE LOWER($2)
        OR LOWER(COALESCE(lo.status, '')) LIKE LOWER($2))
    ORDER BY lo.created_at DESC
    LIMIT $3
  `, [patientId, like, searchLimit]), 'Patient lab orders'));

  const results = await Promise.all(promises);
  return results.flatMap(result => result.rows || []);
}

/**
 * Helper function to get display name for a search result
 */
function getDisplayName(result) {
  switch (result.result_type) {
    case 'patient':
      return `${result.first_name || ''} ${result.last_name || ''}`.trim() || 'Unknown Patient';
    case 'appointment':
      return `${result.patient_first_name || ''} ${result.patient_last_name || ''}`.trim() || 'Unknown Patient';
    case 'provider':
      return `Dr. ${result.first_name || ''} ${result.last_name || ''}`.trim() || 'Unknown Provider';
    case 'claim':
      return `Claim #${result.claim_number || 'N/A'}`;
    case 'payment':
      return `Payment - $${result.amount || 'N/A'}`;
    case 'prescription':
      return result.medication_name || 'Unknown Medication';
    case 'lab_order':
      return `Lab Order #${result.order_number || result.order_type || 'N/A'}`;
    case 'diagnosis':
      return result.diagnosis_name || result.description || result.diagnosis_code || 'Diagnosis';
    case 'task':
      return result.title || 'Task';
    case 'offering':
      return result.name || 'Service Offering';
    case 'campaign':
      return result.name || 'Campaign';
    case 'preapproval':
      return `Authorization #${result.authorization_number || 'N/A'}`;
    case 'denial':
      return `Denial - ${result.denial_reason_description || result.denial_reason_code || 'N/A'}`;
    case 'billing_quote':
      return `Quote #${result.quote_number || 'N/A'}`;
    case 'billing_invoice':
      return `Invoice #${result.invoice_number || 'N/A'}`;
    case 'billing_coupon':
      return result.name || result.code || 'Coupon';
    case 'billing_payment':
      return `Payment #${result.payment_number || 'N/A'}`;
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
      return result.specialization || result.email || '';
    case 'claim':
      return `Patient: ${result.patient_first_name || ''} ${result.patient_last_name || ''} - ${result.status || 'N/A'}`;
    case 'payment':
      return `Patient: ${result.patient_first_name || ''} ${result.patient_last_name || ''}`;
    case 'prescription':
      return `Patient: ${result.patient_first_name || ''} ${result.patient_last_name || ''} - ${result.dosage || ''}`;
    case 'lab_order':
      return `${result.order_type || ''} - ${result.status || 'Pending'}`;
    case 'diagnosis':
      return `Patient: ${result.patient_first_name || ''} ${result.patient_last_name || ''} - Code: ${result.diagnosis_code || ''}`;
    case 'task':
      return `${result.priority || ''} ${result.priority ? '-' : ''} ${result.status || ''}`.trim();
    case 'offering':
      return result.duration_minutes ? `${result.duration_minutes} minutes` : '';
    case 'campaign':
      return result.status || '';
    case 'preapproval':
      return `Patient: ${result.patient_first_name || ''} ${result.patient_last_name || ''} - ${result.status || 'N/A'}`;
    case 'denial':
      return `Code: ${result.denial_reason_code || 'N/A'} - ${result.status || 'N/A'}`;
    case 'billing_quote':
      return `Patient: ${result.patient_first_name || ''} ${result.patient_last_name || ''} - $${result.total_amount || '0'} - ${result.status || 'N/A'}`;
    case 'billing_invoice':
      return `Patient: ${result.patient_first_name || ''} ${result.patient_last_name || ''} - Due: $${result.balance_due || '0'} - ${result.status || 'N/A'}`;
    case 'billing_coupon':
      return `${result.discount_type === 'percentage' ? result.discount_value + '%' : '$' + result.discount_value} off - ${result.is_active ? 'Active' : 'Inactive'}`;
    case 'billing_payment':
      return `Patient: ${result.patient_first_name || ''} ${result.patient_last_name || ''} - $${result.amount || '0'} - ${result.payment_method || 'N/A'}`;
    default:
      return '';
  }
}

module.exports = router;
