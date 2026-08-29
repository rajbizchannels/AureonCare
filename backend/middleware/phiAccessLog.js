// SEC-25: audit-log coverage for PHI reads.
//
// The audit table recorded writes but not reads, so "who looked at this patient's chart"
// — the question an investigation actually asks, and the one HIPAA's audit-control
// expectation is aimed at — had no answer.
//
// This middleware records a read AFTER the response is sent, so auditing never adds
// latency to the request and a logging failure can never break a clinical read. It writes
// through req.db, so the entry lands in the caller's own tenant schema.
//
// Deliberately records the RESOURCE ACCESSED, not the data returned: the audit trail must
// not become a second copy of the PHI it is protecting.

const { logPhiRead } = require('../services/phiAudit');

/**
 * @param {string} resourceType e.g. 'patient', 'medical_record'
 * @param {(req) => string|null} [resourceIdFrom] defaults to req.params.id
 */
function auditPhiRead(resourceType, resourceIdFrom) {
  return function phiReadLogger(req, res, next) {
    // Only log a read that actually succeeded — a 403/404 is not a disclosure.
    res.on('finish', () => {
      if (res.statusCode < 200 || res.statusCode >= 300) return;
      const resourceId = resourceIdFrom
        ? resourceIdFrom(req)
        : (req.params && (req.params.id || req.params.patientId || req.params.recordId)) || null;

      // Fire-and-forget: the response has already been sent.
      logPhiRead(req, {
        resourceType,
        resourceId,
        // A collection read (no id) is still meaningful — it means "listed all patients".
        action: resourceId ? 'view' : 'list',
      }).catch(() => { /* logPhiRead already reports its own failures */ });
    });
    next();
  };
}

module.exports = { auditPhiRead };
