// /api/notification-settings — each staff member chooses which notifications they receive, per
// channel (in the app, email, WhatsApp). Only notifications their role is eligible for are shown
// or accepted; eligibility is in services/staffNotifications.js (by role, or for stock alerts by
// the practice's inventory permissions).
//
//   GET /   { channels, events: [{ key, group, label, note, channels: { in_app|email|whatsapp:
//             { offered, enabled, isDefault, available } } }] }
//   PUT /   { changes: [{ event, channel, enabled }] } → the updated settings

const express = require('express');
const { authenticate } = require('../middleware/auth');
const SN = require('../services/staffNotifications');

const router = express.Router();
router.use(authenticate);
router.use((req, res, next) => (req.user && req.user.role === 'patient'
  ? res.status(403).json({ error: 'Patients manage notifications in the patient portal.' })
  : next()));

async function me(req) {
  const db = req.db || req.app.locals.pool;
  const { rows } = await db.query('SELECT id, email, phone FROM public.users WHERE id = $1', [req.user.id]);
  return { id: req.user.id, role: req.user.role, practiceId: (req.tenant && req.tenant.practiceId) || req.user.practiceId || null,
    email: rows[0] && rows[0].email, phone: rows[0] && rows[0].phone };
}

router.get('/', async (req, res) => {
  try {
    res.json(await SN.settingsFor(req.db || req.app.locals.pool, await me(req)));
  } catch (err) {
    console.error('Error loading notification settings:', err);
    res.status(500).json({ error: 'Could not load your notification settings.' });
  }
});

router.put('/', async (req, res) => {
  try {
    res.json(await SN.saveSettings(req.db || req.app.locals.pool, await me(req), req.body && req.body.changes));
  } catch (err) {
    if (err instanceof SN.SettingsError) return res.status(err.status).json({ error: err.message });
    console.error('Error saving notification settings:', err);
    res.status(500).json({ error: 'Could not save your notification settings.' });
  }
});

module.exports = router;
