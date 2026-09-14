// SEC-25: write PHI-read entries into the tenant's audit_logs table.
//
// Columns match the existing audit_logs schema so read entries sit alongside the write
// entries the frontend already records, and a single query answers "everything that
// touched this patient".
//
// Two deliberate choices:
//   * Best-effort — a failure to audit must never break a clinical read, but it is logged
//     loudly rather than swallowed, because silent audit loss is its own incident.
//   * Records the resource accessed, never the data returned. An audit trail that copies
//     the PHI it protects doubles the exposure instead of reducing it.

/**
 * @param {import('express').Request} req  request carrying req.user and req.db
 * @param {{resourceType: string, resourceId?: string|null, action?: string,
 *          patientId?: string|null, description?: string}} entry
 */
async function logPhiRead(req, entry) {
  const db = req.db || (req.app && req.app.locals && req.app.locals.pool);
  if (!db) return;

  const user = req.user || {};
  const {
    resourceType,
    resourceId = null,
    action = 'view',
    patientId = null,
    description = null,
  } = entry;

  // audit_logs.patient_id carries a foreign key to patients, so a stale or unknown id
  // would make the INSERT fail and the read would go UNLOGGED — the one outcome an audit
  // trail must never have. Attempt the linked write, then fall back to writing the record
  // without the link. resource_id (a plain varchar) always carries the id either way.
  const insert = (patientIdValue) =>
    db.query(
      `INSERT INTO audit_logs (
         user_id, user_email, user_name, user_role,
         ip_address, user_agent,
         action_type, resource_type, resource_name, resource_id,
         action_description, module, patient_id, status
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'success')`,
      [
        user.id || null,
        user.email || null,
        [user.firstName, user.lastName].filter(Boolean).join(' ') || null,
        user.role || null,
        req.ip || req.headers?.['x-forwarded-for'] || null,
        req.headers?.['user-agent'] || null,
        action,                       // 'view' | 'list'
        resourceType,
        resourceType,                 // resource_name is NOT NULL; the type is the best label here
        resourceId ? String(resourceId) : null,
        description,
        'PHI',
        // patient_id is a uuid column — only set it when the resource IS a patient.
        patientIdValue,
      ]
    );

  const linkedPatientId = patientId || (resourceType === 'patient' && resourceId ? String(resourceId) : null);
  try {
    try {
      await insert(linkedPatientId);
    } catch (fkErr) {
      if (linkedPatientId && fkErr.code === '23503') {
        // Foreign-key violation: keep the audit entry, drop only the link.
        await insert(null);
      } else {
        throw fkErr;
      }
    }
  } catch (err) {
    // Never rethrow: the response has already been sent and a clinical read must not fail
    // because auditing did. Logged so the gap is visible.
    console.error(`[phiAudit] FAILED to record ${entry.action || 'view'} of ${entry.resourceType}:`, err.message);
  }
}

module.exports = { logPhiRead };
