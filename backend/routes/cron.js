// /api/internal/cron — scheduled jobs. Called by Vercel Cron (vercel.json "crons"), which sends
// `Authorization: Bearer <CRON_SECRET>` when the CRON_SECRET environment variable is set; any
// other scheduler (GitHub Actions, Supabase pg_cron, an uptime monitor) can send the same header.
// Without CRON_SECRET the jobs refuse to run, so nobody can trigger them from outside.
//
//   GET /reminders   appointment reminders and daily summaries (services/appointmentReminders.js)

const express = require('express');
const crypto = require('crypto');

const router = express.Router();

function cronAuth(req, res, next) {
  const secret = process.env.CRON_SECRET || process.env.AC_CRON_S || '';
  if (secret.length < 16) return res.status(503).json({ error: 'Scheduled jobs are not configured (set CRON_SECRET, 16+ characters).' });
  const given = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const a = Buffer.from(given); const b = Buffer.from(secret);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(401).json({ error: 'Unauthorized' });
  return next();
}

router.get('/reminders', cronAuth, async (req, res) => {
  const started = Date.now();
  try {
    const out = await require('../services/appointmentReminders').runReminders(req.app.locals.pool);
    console.log('[cron] reminders:', JSON.stringify(out), `${Date.now() - started} ms`);
    res.json({ ok: true, ...out, ms: Date.now() - started });
  } catch (e) {
    console.error('[cron] reminders failed:', e);
    res.status(500).json({ error: 'The reminder job failed.' });
  }
});

module.exports = router;
