// /api/sick-notes — issue, list, print, email and void sick notes (medical certificates).
//
//   GET  /?patientId=        a patient's notes, newest first
//   POST /                   issue one (clinicians only: doctors, nurses, or an admin who is a provider)
//   GET  /:id/document       the printable certificate { html }
//   POST /:id/email          email it to the patient's address on file
//   POST /:id/void           { reason } — the issuer or an admin; notes are never edited or deleted
//   GET  /requests           patients' open requests across the practice
//   POST /requests/:id/decline { reason } — clinicians; issuing with { requestId } answers one
//
// Permissions: Clinical Records → sick_notes (doctors all, nurses read/write, reception none
// by default — see utils/permissionRegistry.js).

const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireModuleAccess } = require('../middleware/modulePermissions');
const { auditPhiRead } = require('../middleware/phiAccessLog');
const SN = require('../services/sickNotes');
const { sendEmail, buildEmailHtml, escapeHtml } = require('../services/notificationService');

const router = express.Router();
router.use(authenticate);
router.use((req, res, next) => (req.user && req.user.role === 'patient' ? res.status(403).json({ error: 'Not available' }) : next()));
router.use(requireModuleAccess('clinical', 'sick_notes'));

const needDb = (req, res) => {
  if (!req.db) { res.status(409).json({ error: 'Your account is not linked to a practice.' }); return false; }
  return true;
};

async function practiceFor(pool, practiceId) {
  const { rows: [p] } = await pool.query('SELECT name, address, phone, email FROM public.practices WHERE id = $1', [practiceId]);
  return p || {};
}

// Who may sign a note: a clinician. An admin counts only if they are also a provider.
async function issuer(req) {
  const pool = req.app.locals.pool;
  const { rows: [u] } = await pool.query('SELECT id, first_name, last_name FROM public.users WHERE id = $1', [req.user.id]);
  const { rows: [prov] } = await pool.query('SELECT specialization, license_number FROM public.providers WHERE id = $1', [req.user.id]);
  const role = req.user.role;
  if (!(role === 'doctor' || role === 'nurse' || (role === 'admin' && prov))) return null;
  const name = `${role === 'doctor' ? 'Dr ' : ''}${u.first_name || ''} ${u.last_name || ''}`.replace(/\s+/g, ' ').trim();
  return { id: u.id, name, title: prov && prov.specialization ? prov.specialization : role === 'nurse' ? 'Nurse' : null,
    registration: prov && prov.license_number ? prov.license_number : null };
}

router.get('/', async (req, res) => {
  if (!needDb(req, res)) return;
  if (!req.query.patientId) return res.status(400).json({ error: 'patientId is required' });
  try {
    const { rows } = await req.db.query(
      'SELECT * FROM sick_notes WHERE patient_id::text = $1 ORDER BY created_at DESC LIMIT 200', [String(req.query.patientId)]);
    const requests = await req.db.query(
      'SELECT * FROM sick_note_requests WHERE patient_id::text = $1 ORDER BY created_at DESC LIMIT 50', [String(req.query.patientId)])
      .then((r) => r.rows.map(SN.requestToApi)).catch((e) => { if (e.code === '42P01') return []; throw e; });
    res.json({ notes: rows.map(SN.toApi), requests, canIssue: Boolean(await issuer(req)), adjustments: SN.ADJUSTMENTS, maxDays: SN.MAX_DAYS });
  } catch (err) {
    console.error('[sick-notes] list:', err.message);
    res.status(500).json({ error: 'Could not load sick notes' });
  }
});

// ── requests from patients ───────────────────────────────────────────────────────────
// Open requests across the practice, oldest first (the queue a clinician works through).
router.get('/requests', async (req, res) => {
  if (!needDb(req, res)) return;
  try {
    const { rows } = await req.db.query(
      `SELECT r.*, p.first_name, p.last_name, p.mrn FROM sick_note_requests r JOIN patients p ON p.id = r.patient_id
        WHERE r.status = 'pending' ORDER BY r.created_at ASC LIMIT 200`);
    res.json({ requests: rows.map(SN.requestToApi), canIssue: Boolean(await issuer(req)) });
  } catch (err) {
    if (err.code === '42P01') return res.json({ requests: [], canIssue: false });   // migration 099 not applied yet
    console.error('[sick-notes] requests:', err.message);
    res.status(500).json({ error: 'Could not load sick note requests' });
  }
});

async function tellPatient(req, patientId, { subject, title, colour, intro, rows }) {
  try {
    const { rows: [pt] } = await req.db.query('SELECT first_name, email FROM patients WHERE id = $1', [patientId]);
    if (!pt || !pt.email) return;
    const practice = await practiceFor(req.app.locals.pool, req.user.practiceId);
    const html = buildEmailHtml(title, colour, `Hello ${escapeHtml(pt.first_name || '')},`, intro, rows, null, { practiceName: practice.name });
    await sendEmail(pt.email, subject, html);
  } catch (e) { console.warn('[sick-notes] could not email the patient:', e.message); }
}

router.post('/requests/:id/decline', async (req, res) => {
  if (!needDb(req, res)) return;
  const reason = String((req.body || {}).reason || '').trim().slice(0, 500);
  if (!reason) return res.status(400).json({ error: 'Give the patient a reason.' });
  try {
    if (!(await issuer(req))) return res.status(403).json({ error: 'Only a clinician can decline a sick note request.' });
    const { rows: [r] } = await req.db.query(
      `UPDATE sick_note_requests SET status = 'declined', decision_reason = $2, decided_by = $3, decided_at = now()
        WHERE id::text = $1 AND status = 'pending' RETURNING *`, [req.params.id, reason, req.user.id]);
    if (!r) return res.status(404).json({ error: 'That request is no longer waiting.' });
    await tellPatient(req, r.patient_id, {
      subject: 'About your sick note request', title: 'Your sick note request', colour: '#F59E0B',
      intro: 'Your clinician has reviewed your request and has not issued a sick note.',
      rows: [['Dates asked for', `${SN.longDate(r.start_date)} – ${SN.longDate(r.end_date)}`], ['Reason given', reason],
        ['What next', 'Contact your practice or book an appointment if you need to discuss it.']],
    });
    res.json({ request: SN.requestToApi(r) });
  } catch (err) {
    console.error('[sick-notes] decline:', err.message);
    res.status(500).json({ error: 'Could not decline the request' });
  }
});

router.post('/', async (req, res) => {
  if (!needDb(req, res)) return;
  try {
    const who = await issuer(req);
    if (!who) return res.status(403).json({ error: 'Only a clinician (doctor or nurse) can issue a sick note.' });
    const v = SN.validate(req.body);
    if (v.error) return res.status(400).json({ error: v.error });
    const n = v.value;
    const { rows: [patient] } = await req.db.query('SELECT id FROM patients WHERE id::text = $1', [n.patientId]);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    // Issued in answer to a patient's request: it must be this patient's, and still open.
    const requestId = (req.body || {}).requestId ? String(req.body.requestId) : null;
    if (requestId) {
      const { rows: [open] } = await req.db.query(
        `SELECT id FROM sick_note_requests WHERE id::text = $1 AND patient_id = $2 AND status = 'pending'`, [requestId, patient.id]);
      if (!open) return res.status(409).json({ error: 'That request is no longer waiting (or is for another patient).' });
    }
    let row;
    for (let i = 0; i < 3 && !row; i++) {   // a reference clash is astronomically rare; retry anyway
      try {
        ({ rows: [row] } = await req.db.query(
          `INSERT INTO sick_notes (reference, patient_id, purpose, fitness, assessed_on, start_date, end_date, condition_text,
              adjustments, comments, follow_up, issued_by, issuer_name, issuer_title, issuer_registration)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
          [SN.newReference(), patient.id, n.purpose, n.fitness, n.assessedOn, n.startDate, n.endDate, n.conditionText,
            n.adjustments, n.comments, n.followUp, who.id, who.name, who.title, who.registration]));
      } catch (e) { if (e.code !== '23505') throw e; }
    }
    console.log(`[sick-notes] ${row.reference} issued by ${who.id} for patient ${patient.id}`);
    if (requestId) {
      await req.db.query(
        `UPDATE sick_note_requests SET status = 'issued', sick_note_id = $2, decided_by = $3, decided_at = now()
          WHERE id::text = $1 AND status = 'pending'`, [requestId, row.id, who.id]);
      await tellPatient(req, patient.id, {
        subject: `Your sick note is ready (${row.reference})`, title: 'Your sick note is ready', colour: '#08B39C',
        intro: 'Your clinician has issued the sick note you asked for. You can view and print it in your patient portal or the AureonCare app.',
        rows: [['Reference', row.reference], ['Covers', `${SN.longDate(row.start_date)} – ${SN.longDate(row.end_date)}`]],
      });
    }
    res.status(201).json({ note: SN.toApi(row), requestId: requestId || undefined });
  } catch (err) {
    console.error('[sick-notes] issue:', err.message);
    res.status(500).json({ error: 'Could not issue the sick note' });
  }
});

async function load(req, id) {
  const { rows: [note] } = await req.db.query('SELECT * FROM sick_notes WHERE id::text = $1', [id]);
  if (!note) return null;
  const { rows: [patient] } = await req.db.query(
    'SELECT id, first_name, last_name, date_of_birth, mrn, email FROM patients WHERE id = $1', [note.patient_id]);
  return { note, patient };
}

router.get('/:id/document', auditPhiRead('sick_note'), async (req, res) => {
  if (!needDb(req, res)) return;
  try {
    const x = await load(req, req.params.id);
    if (!x) return res.status(404).json({ error: 'Sick note not found' });
    const practice = await practiceFor(req.app.locals.pool, req.user.practiceId);
    res.set('Cache-Control', 'no-store');
    res.json({ html: SN.renderDocument(x.note, x.patient, practice), reference: x.note.reference });
  } catch (err) {
    console.error('[sick-notes] document:', err.message);
    res.status(500).json({ error: 'Could not prepare the document' });
  }
});

router.post('/:id/email', async (req, res) => {
  if (!needDb(req, res)) return;
  try {
    const x = await load(req, req.params.id);
    if (!x) return res.status(404).json({ error: 'Sick note not found' });
    if (x.note.status !== 'issued') return res.status(409).json({ error: 'A voided note cannot be sent.' });
    if (!x.patient || !x.patient.email) return res.status(400).json({ error: 'The patient has no email address on file.' });
    const practice = await practiceFor(req.app.locals.pool, req.user.practiceId);
    const n = SN.toApi(x.note);
    const rows = [
      ['Reference', n.reference],
      ['Advice', `The patient ${SN.adviceText(n)}`],
      ['From', SN.longDate(n.startDate)], ['To', `${SN.longDate(n.endDate)} (${n.days} day${n.days === 1 ? '' : 's'})`],
      ...(n.conditionText ? [['Condition', n.conditionText]] : []),
      ...(n.adjustments.length ? [['Adjustments', n.adjustments.map((a) => SN.ADJUSTMENTS[a]).join(', ')]] : []),
      ...(n.comments ? [['Comments', n.comments]] : []),
      ['Issued by', [n.issuerName, n.issuerTitle].filter(Boolean).join(', ')],
    ];
    const html = buildEmailHtml('Your sick note', '#08B39C', `Hello ${escapeHtml(x.patient.first_name || '')},`,
      'Here is the sick note issued to you. You can also view and print it in your patient portal.',
      rows, `<p style="font-size:13px;color:#64748B">To check it is genuine, an employer or school can contact the practice and quote reference ${escapeHtml(n.reference)}.</p>`,
      { practiceName: practice.name });
    const sent = await sendEmail(x.patient.email, `Your sick note (${n.reference})`, html);
    if (sent && sent.sent === false) return res.status(502).json({ error: 'The email could not be sent. Print the note instead.' });
    await req.db.query('UPDATE sick_notes SET emailed_at = now() WHERE id = $1', [x.note.id]);
    res.json({ emailed: true, to: x.patient.email });
  } catch (err) {
    console.error('[sick-notes] email:', err.message);
    res.status(500).json({ error: 'Could not email the sick note' });
  }
});

router.post('/:id/void', async (req, res) => {
  if (!needDb(req, res)) return;
  const reason = String((req.body || {}).reason || '').trim().slice(0, 500);
  if (!reason) return res.status(400).json({ error: 'Give a reason for voiding the note.' });
  try {
    const { rows: [note] } = await req.db.query('SELECT id, issued_by, status FROM sick_notes WHERE id::text = $1', [req.params.id]);
    if (!note) return res.status(404).json({ error: 'Sick note not found' });
    if (note.issued_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only the clinician who issued it, or an administrator, can void a note.' });
    }
    const { rows: [row] } = await req.db.query(
      `UPDATE sick_notes SET status = 'voided', void_reason = $2, voided_by = $3, voided_at = now()
        WHERE id = $1 AND status = 'issued' RETURNING *`, [note.id, reason, req.user.id]);
    if (!row) return res.status(409).json({ error: 'This note is already void.' });
    console.log(`[sick-notes] ${row.reference} voided by ${req.user.id}`);
    res.json({ note: SN.toApi(row) });
  } catch (err) {
    console.error('[sick-notes] void:', err.message);
    res.status(500).json({ error: 'Could not void the note' });
  }
});

module.exports = router;
