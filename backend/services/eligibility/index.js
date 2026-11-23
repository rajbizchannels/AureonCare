/**
 * Insurance eligibility checks: is this patient's coverage active for this date of service, and
 * what will they pay (copay, deductible, coinsurance)?
 *
 *   runCheck(req, { patientId, payerId?, serviceDate?, serviceType?, appointmentId?, claimId? })
 *     → { status: 200, check } | { status: 4xx/5xx, error, missing? }
 *   latestFor(db, patientId, { payerId?, serviceDate? })   the most recent check that applies
 *   history(db, patientId)
 *
 * The request goes to the practice's clearinghouse (the Optum connection under Settings →
 * Integrations) as an X12 270 in JSON; the 271 is summarised and stored in eligibility_checks.
 * Everything the payer needs (member ID, payer's electronic ID, date of birth, the practice's NPI)
 * is checked first and reported by name, so the desk knows exactly what to fix.
 */

const { buildRequest, parseResponse } = require('./medicalNetwork');
const { vendorsFor } = require('../vendorIntegrations');
const { usIdentifiersApplyFor } = require('../../utils/practiceRegion');

const SERVICE_TYPES = {
  '30': 'Health benefit plan coverage', '1': 'Medical care', '33': 'Chiropractic', '35': 'Dental care',
  '47': 'Hospital', '48': 'Hospital inpatient', '50': 'Hospital outpatient', '86': 'Emergency services',
  '88': 'Pharmacy', '98': 'Professional (physician) visit – office', 'AL': 'Vision (optometry)', 'MH': 'Mental health', 'UC': 'Urgent care',
};

const todayIso = () => new Date().toISOString().slice(0, 10);

async function loadContext(db, { patientId, payerId, practiceId }) {
  const { rows: [patient] } = await db.query(
    `SELECT id, first_name, last_name, date_of_birth, gender, insurance, insurance_id, insurance_payer_id, insurance_info
       FROM patients WHERE id::text = $1::text`, [patientId]);
  if (!patient) return { patient: null };
  const pid = payerId || patient.insurance_payer_id || null;
  const payer = pid
    ? (await db.query(
      `SELECT id, name, payer_id, electronic_payer_id, is_active FROM insurance_payers WHERE id::text = $1::text`, [pid])).rows[0] || null
    : null;
  const practice = practiceId
    ? (await db.query('SELECT name, npi FROM public.practices WHERE id::text = $1::text', [practiceId])).rows[0] || null
    : null;
  return { patient, payer, practice };
}

async function runCheck(req, opts) {
  const db = req.db || req.app.locals.pool;
  const practiceId = (req.tenant && req.tenant.practiceId) || (req.user && req.user.practiceId) || null;
  if (!opts || !opts.patientId) return { status: 400, error: 'patientId is required.' };
  const serviceDate = /^\d{4}-\d{2}-\d{2}$/.test(String(opts.serviceDate || '')) ? opts.serviceDate : todayIso();
  const serviceType = SERVICE_TYPES[String(opts.serviceType || '30')] ? String(opts.serviceType || '30') : '30';

  if (!(await usIdentifiersApplyFor(db, practiceId))) {
    return { status: 422, error: 'Insurance eligibility checks (X12 270/271) are for US payers; they are not available for this practice.' };
  }
  const { patient, payer, practice } = await loadContext(db, { patientId: opts.patientId, payerId: opts.payerId, practiceId });
  if (!patient) return { status: 404, error: 'Patient not found.' };
  if (opts.payerId && !payer) return { status: 404, error: 'Insurance payer not found.' };
  if (payer && payer.is_active === false) return { status: 422, error: `${payer.name} is marked inactive in Insurance Payers.` };

  const info = patient.insurance_info || {};
  const memberId = patient.insurance_id || info.member_id || info.memberId || null;
  const { body, missing } = buildRequest({
    payerId: payer && (payer.electronic_payer_id || payer.payer_id),
    provider: { name: practice && practice.name, npi: practice && practice.npi },
    subscriber: { memberId, firstName: patient.first_name, lastName: patient.last_name, dateOfBirth: patient.date_of_birth, gender: patient.gender },
    serviceDate, serviceType,
  });
  if (!payer) missing.unshift("the patient's insurance payer (set it on the patient's insurance details)");
  if (missing.length) {
    return { status: 422, error: 'Eligibility cannot be checked yet — some details are missing.', missing: [...new Set(missing)] };
  }

  const vendors = await vendorsFor(req);
  if (!vendors.isVendorEnabled('optum')) {
    return { status: 409, error: 'Eligibility checks need your clearinghouse connection. An admin can switch it on under Settings → Integrations → Optum.' };
  }
  const result = await vendors.getOptum().checkEligibility(body);
  let parsed;
  if (!result.success) {
    parsed = { status: 'error', coverage: {}, message: `The clearinghouse could not be reached: ${result.error || 'unknown error'}` };
  } else {
    parsed = parseResponse(result.data, { serviceType });
  }

  const { rows: [check] } = await db.query(
    `INSERT INTO eligibility_checks (patient_id, appointment_id, claim_id, payer_id, payer_name, member_id, service_date,
                                     service_type, status, coverage, message, vendor_reference, checked_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
    [patient.id, opts.appointmentId || null, opts.claimId || null, payer.id, payer.name, memberId, serviceDate, serviceType,
     parsed.status, JSON.stringify(parsed.coverage || {}), parsed.message, parsed.controlNumber || body.controlNumber, req.user && req.user.id]);

  try {
    await vendors.logTransaction('optum', 'eligibility_check', {
      request: { controlNumber: body.controlNumber, payer: body.tradingPartnerServiceId, serviceDate, serviceType },
      response: { status: parsed.status }, status: result.success ? 'success' : 'failed',
      error: result.success ? null : result.error, internalReferenceId: check.id, patientId: patient.id,
    });
  } catch { /* the transaction log is best-effort */ }

  return { status: 200, check: present(check) };
}

const present = (row) => row && ({
  id: row.id, patientId: row.patient_id, appointmentId: row.appointment_id, claimId: row.claim_id,
  payerId: row.payer_id, payerName: row.payer_name, memberId: row.member_id,
  serviceDate: row.service_date instanceof Date ? row.service_date.toISOString().slice(0, 10) : String(row.service_date).slice(0, 10),
  serviceType: row.service_type, serviceTypeName: SERVICE_TYPES[row.service_type] || row.service_type,
  status: row.status, coverage: row.coverage || {}, message: row.message, checkedAt: row.checked_at, checkedBy: row.checked_by,
});

/** The latest check for this patient (and payer), within `maxAgeDays` of the service date. */
async function latestFor(db, patientId, { payerId = null, serviceDate = null, maxAgeDays = 30 } = {}) {
  try {
    const params = [patientId];
    let sql = 'SELECT * FROM eligibility_checks WHERE patient_id::text = $1::text';
    if (payerId) { params.push(payerId); sql += ` AND payer_id::text = $${params.length}::text`; }
    if (serviceDate) {
      params.push(serviceDate, maxAgeDays);
      sql += ` AND abs(service_date - $${params.length - 1}::date) <= $${params.length}`;
    }
    const { rows } = await db.query(`${sql} ORDER BY checked_at DESC LIMIT 1`, params);
    return present(rows[0]) || null;
  } catch (err) {
    if (err.code === '42P01') return null; // migration 100 not run yet
    throw err;
  }
}

async function history(db, patientId, limit = 20) {
  const { rows } = await db.query(
    'SELECT * FROM eligibility_checks WHERE patient_id::text = $1::text ORDER BY checked_at DESC LIMIT $2', [patientId, limit]);
  return rows.map(present);
}

module.exports = { runCheck, latestFor, history, SERVICE_TYPES, usIdentifiersApplyFor };
