// /api/booking-requests — appointment requests from guests on the public booking page.
//
// A guest's booking is held as a PENDING appointment attached to no chart (it keeps the
// slot). Staff decide who it is for — never the email the guest typed:
//   GET  /               open requests, with a "possible existing patient" hint
//   POST /:id/confirm    { patientId } for an existing chart, or { asNewPatient: true }
//   POST /:id/decline    frees the slot
// The guest is emailed the outcome at the address they gave.

const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { enforcePatientQuota } = require('../middleware/planEnforcement');
const { findOrCreateChartForInvite } = require('./portalInvites');
const { sendEmail, buildEmailHtml, escapeHtml } = require('../services/notificationService');

const router = express.Router();
router.use(authenticate, authorize('admin', 'receptionist', 'doctor', 'nurse', 'staff'));

const fmt = (d) => new Date(d).toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

async function loadRequest(db, id) {
  const { rows: [a] } = await db.query(
    `SELECT a.*, pr.first_name AS provider_first, pr.last_name AS provider_last
       FROM appointments a LEFT JOIN providers pr ON pr.id = a.provider_id
      WHERE a.id::text = $1 AND a.patient_id IS NULL AND a.status = 'pending' AND a.booking_source = 'public_request'`, [id]);
  return a || null;
}
const guestOf = (a) => (a.custom_form_data && a.custom_form_data.guest) || {};

async function tellGuest(a, confirmed, practiceName) {
  const g = guestOf(a);
  if (!g.email) return;
  const dr = a.provider_first ? `Dr. ${a.provider_first} ${a.provider_last}` : 'your provider';
  const html = buildEmailHtml(
    confirmed ? 'Your appointment is confirmed' : 'Your appointment request',
    confirmed ? '#08B39C' : '#F59E0B',
    `Hello ${escapeHtml(g.firstName || 'there')},`,
    confirmed
      ? `Your appointment with ${escapeHtml(dr)} is confirmed.`
      : `We could not confirm your requested appointment with ${escapeHtml(dr)}. Please contact the practice or choose another time.`,
    [['When', fmt(a.start_time)], ['Appointment', a.appointment_type || '—']],
    null, { practiceName });
  try { await sendEmail(g.email, confirmed ? 'Your appointment is confirmed' : 'About your appointment request', html); }
  catch (e) { console.warn('[booking-requests] could not email the guest:', e.message); }
}

router.get('/', async (req, res) => {
  try {
    const { rows } = await req.db.query(
      `SELECT a.id, a.start_time, a.end_time, a.appointment_type, a.reason, a.created_at, a.custom_form_data,
              pr.first_name AS provider_first, pr.last_name AS provider_last
         FROM appointments a LEFT JOIN providers pr ON pr.id = a.provider_id
        WHERE a.patient_id IS NULL AND a.status = 'pending' AND a.booking_source = 'public_request'
        ORDER BY a.start_time ASC LIMIT 200`);
    const out = [];
    for (const r of rows) {
      const g = guestOf(r);
      // A HINT for staff, not a decision: the chart with the same email, if any.
      const { rows: [match] } = g.email ? await req.db.query(
        `SELECT id, first_name, last_name, date_of_birth, mrn FROM patients WHERE LOWER(email) = LOWER($1) LIMIT 1`, [g.email]) : { rows: [] };
      out.push({
        id: r.id, startTime: r.start_time, endTime: r.end_time, appointmentType: r.appointment_type, reason: r.reason,
        requestedAt: r.created_at, provider: r.provider_first ? `Dr. ${r.provider_first} ${r.provider_last}` : null,
        guest: { firstName: g.firstName, lastName: g.lastName, email: g.email, phone: g.phone, dob: g.dob },
        possibleMatch: match ? { id: match.id, name: `${match.first_name} ${match.last_name}`, dob: match.date_of_birth, mrn: match.mrn } : null,
      });
    }
    res.json(out);
  } catch (err) {
    console.error('[booking-requests] list:', err.message);
    res.status(500).json({ error: 'Could not load booking requests' });
  }
});

router.post('/:id/confirm', async (req, res) => {
  const db = req.db;
  const { patientId, asNewPatient } = req.body || {};
  try {
    const a = await loadRequest(db, req.params.id);
    if (!a) return res.status(404).json({ error: 'That request is no longer waiting.' });
    let pid = null;
    if (patientId) {
      const { rows } = await db.query('SELECT id FROM patients WHERE id::text = $1', [patientId]);
      if (!rows.length) return res.status(404).json({ error: 'Patient not found' });
      pid = rows[0].id;
    } else if (asNewPatient) {
      const g = guestOf(a);
      const { rows: clash } = await db.query('SELECT 1 FROM patients WHERE LOWER(email) = LOWER($1)', [g.email || '']);
      if (clash.length) {
        return res.status(409).json({ error: 'A patient with this email is already on file. Confirm the request for that patient, or decline it.' });
      }
      if (!g.dob) return res.status(400).json({ error: 'The guest gave no date of birth. Add the patient from the Patients screen, then confirm the request for them.' });
      const found = await findOrCreateChartForInvite(db, { email: g.email, firstName: g.firstName, lastName: g.lastName, dateOfBirth: String(g.dob).slice(0, 10) },
        () => new Promise((resolve) => {
          const answered = () => resolve(false);
          res.once('finish', answered);
          Promise.resolve(enforcePatientQuota(req, res, () => { res.off('finish', answered); resolve(true); }))
            .catch(() => { res.off('finish', answered); resolve(!res.headersSent); });
        }), { practiceId: req.user.practiceId });
      if (found.handled) return;
      if (found.error) return res.status(found.status).json({ error: found.error });
      pid = found.patientId;
      if (g.phone) await db.query('UPDATE patients SET phone = COALESCE(phone, $2) WHERE id = $1', [pid, g.phone]);
    } else {
      return res.status(400).json({ error: 'Choose an existing patient or confirm as a new patient.' });
    }
    const { rows: [done] } = await db.query(
      `UPDATE appointments SET patient_id = $2, status = 'scheduled', updated_at = NOW()
        WHERE id = $1 AND patient_id IS NULL AND status = 'pending' RETURNING id`, [a.id, pid]);
    if (!done) return res.status(409).json({ error: 'Someone else has already handled this request.' });
    const { rows: [pr] } = await req.app.locals.pool.query('SELECT name FROM public.practices WHERE id = $1', [req.user.practiceId]);
    await tellGuest(a, true, pr && pr.name);
    res.json({ confirmed: true, appointmentId: a.id, patientId: pid });
  } catch (err) {
    console.error('[booking-requests] confirm:', err.message);
    res.status(500).json({ error: 'Could not confirm the request' });
  }
});

router.post('/:id/decline', async (req, res) => {
  try {
    const a = await loadRequest(req.db, req.params.id);
    if (!a) return res.status(404).json({ error: 'That request is no longer waiting.' });
    await req.db.query(`UPDATE appointments SET status = 'cancelled', updated_at = NOW() WHERE id = $1`, [a.id]);
    const { rows: [pr] } = await req.app.locals.pool.query('SELECT name FROM public.practices WHERE id = $1', [req.user.practiceId]);
    await tellGuest(a, false, pr && pr.name);
    res.json({ declined: true });
  } catch (err) {
    console.error('[booking-requests] decline:', err.message);
    res.status(500).json({ error: 'Could not decline the request' });
  }
});

module.exports = router;
