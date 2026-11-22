// /api/eligibility — real-time insurance eligibility checks (X12 270/271 through the practice's
// clearinghouse connection).
//
//   POST /check            { patientId, payerId?, serviceDate?, serviceType?, appointmentId?, claimId? }
//                          → 200 { check } | 422 { error, missing[] } | 409 (no clearinghouse) | 404
//   GET  /?patientId=      the patient's checks, newest first
//   GET  /latest?patientId=&payerId=&serviceDate=   the check that applies to a visit or claim
//   GET  /service-types    the X12 service type codes offered
//
// Staff who book, see or bill patients may run them: admin, front desk, billing, clinicians.

const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { auditPhiRead } = require('../middleware/phiAccessLog');
const E = require('../services/eligibility');

const router = express.Router();
router.use(authenticate);
router.use(require('../middleware/planEnforcement').enforceActiveBilling);
const staff = authorize('admin', 'receptionist', 'billing_manager', 'doctor', 'provider', 'nurse', 'staff');
const dbOf = (req) => req.db || req.app.locals.pool;

router.get('/service-types', staff, (req, res) => {
  res.json(Object.entries(E.SERVICE_TYPES).map(([code, name]) => ({ code, name })));
});

router.post('/check', staff, async (req, res) => {
  try {
    const out = await E.runCheck(req, req.body || {});
    if (out.status !== 200) return res.status(out.status).json({ error: out.error, missing: out.missing });
    res.status(200).json({ check: out.check });
  } catch (err) {
    console.error('Eligibility check failed:', err);
    res.status(500).json({ error: 'The eligibility check could not be completed.' });
  }
});

router.get('/latest', staff, auditPhiRead('eligibility', (req) => req.query.patientId), async (req, res) => {
  try {
    if (!req.query.patientId) return res.status(400).json({ error: 'patientId is required.' });
    res.json({ check: await E.latestFor(dbOf(req), req.query.patientId, {
      payerId: req.query.payerId || null, serviceDate: req.query.serviceDate || null,
    }) });
  } catch (err) {
    console.error('Error reading eligibility:', err);
    res.status(500).json({ error: 'Could not read eligibility checks.' });
  }
});

router.get('/', staff, auditPhiRead('eligibility', (req) => req.query.patientId), async (req, res) => {
  try {
    if (!req.query.patientId) return res.status(400).json({ error: 'patientId is required.' });
    res.json(await E.history(dbOf(req), req.query.patientId));
  } catch (err) {
    console.error('Error reading eligibility history:', err);
    res.status(500).json({ error: 'Could not read eligibility checks.' });
  }
});

module.exports = router;
