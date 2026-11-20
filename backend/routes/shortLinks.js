// GET /s/<code> — open a short link (services/shortLinks.js).
//
// Public by necessity: it is what a recipient clicks. Rate-limited per IP so codes cannot
// be enumerated, never cached (a link can expire), and the redirect sends no Referer.
// An unknown or expired code gets a plain page, not a redirect — it never reveals whether
// a code ever existed.

const express = require('express');
const rateLimit = require('express-rate-limit');
const { storeFor } = require('../middleware/rateLimitStore');
const { resolve, purgeExpired, CODE_RE } = require('../services/shortLinks');

const router = express.Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  store: storeFor('short-link'),
  handler: (req, res) => res.status(429).type('html').send(page('Too many attempts', 'Please wait a few minutes and try the link again.')),
});

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function page(title, text) {
  const app = (process.env.FRONTEND_URL || '').split(',')[0].trim().replace(/\/+$/, '');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${esc(title)} · AureonCare</title></head>
<body style="margin:0;background:#0F172A;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#E2E8F0;display:flex;min-height:100vh;align-items:center;justify-content:center">
<div style="max-width:420px;margin:24px;padding:28px;background:#1E293B;border-radius:14px;border-top:4px solid #08B39C">
<div style="font-size:22px;font-weight:700"><span style="color:#F9BD00">Aureon</span><span style="color:#08B39C">Care</span></div>
<h1 style="font-size:18px;margin:18px 0 8px">${esc(title)}</h1>
<p style="margin:0 0 18px;line-height:1.5;color:#94A3B8">${esc(text)}</p>
${app ? `<a href="${esc(app)}" style="color:#5EEAD4">Go to AureonCare</a>` : ''}
</div></body></html>`;
}

// The QR code for a short link (used by emails, and anyone who wants a printable code).
// It draws the short URL itself and never resolves the code, so it reveals nothing about
// where the link leads or whether it still works — no enumeration oracle — and opening
// it does not count as a use. A well-formed code is all it needs.
const qrLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false,
  store: storeFor('short-link-qr'),
});
router.get('/:code/qr.png', qrLimiter, async (req, res) => {
  const { shortBase } = require('../services/shortLinks');
  const base = shortBase();
  if (!CODE_RE.test(req.params.code) || !base) return res.status(404).end();
  try {
    const png = await require('qrcode').toBuffer(`${base}/s/${req.params.code}`, {
      type: 'png', width: 264, margin: 2, errorCorrectionLevel: 'M',
      color: { dark: '#0F172AFF', light: '#FFFFFFFF' },
    });
    res.set('Cache-Control', 'private, max-age=86400');
    res.set('Referrer-Policy', 'no-referrer');
    res.set('X-Robots-Tag', 'noindex');
    res.type('png').send(png);
  } catch (e) {
    console.error('[short-links] qr failed:', e.message);
    res.status(500).end();
  }
});

router.get('/:code', limiter, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.set('Referrer-Policy', 'no-referrer');
  res.set('X-Robots-Tag', 'noindex');
  try {
    const target = CODE_RE.test(req.params.code) ? await resolve(req.params.code) : null;
    if (Math.random() < 0.02) purgeExpired();
    if (!target) {
      return res.status(404).type('html').send(page('This link is no longer valid',
        'It may have expired or been replaced by a newer one. Ask whoever sent it for a new link.'));
    }
    return res.redirect(302, target);
  } catch (e) {
    console.error('[short-links] resolve failed:', e.message);
    return res.status(503).type('html').send(page('Link temporarily unavailable', 'Please try again in a moment.'));
  }
});

// ── Staff: short links for what they share from the app ──────────────────────────────
//
// Only two destinations, both checked against the caller's own practice, so this can never
// be used to mint a trusted-looking aureoncare link to an arbitrary site:
//   { kind: 'booking', slug }          -> <app>/book/<slug>, a slug this practice owns
//   { kind: 'meeting', appointmentId } -> that appointment's meeting link (in this practice)
const api = express.Router();
const { authenticate } = require('../middleware/auth');
const { shorten } = require('../services/shortLinks');
const { resolveBookingSlug, tenantIdFor, isValidSlug } = require('../services/bookingRouting');

api.post('/', authenticate, async (req, res) => {
  if (!req.user || req.user.role === 'patient') return res.status(403).json({ error: 'Staff only' });
  if (!req.db) return res.status(409).json({ error: 'Your account is not linked to a practice.' });
  const { kind, slug, appointmentId } = req.body || {};
  try {
    const base = (process.env.FRONTEND_URL || '').split(',')[0].trim().replace(/\/+$/, '');
    if (kind === 'booking') {
      if (!isValidSlug(slug)) return res.status(400).json({ error: 'A valid booking link name is required' });
      const pool = req.app.locals.pool;
      const [route, mine] = await Promise.all([resolveBookingSlug(pool, slug), tenantIdFor(pool, req)]);
      if (!route || !mine || String(route.tenantId) !== String(mine)) {
        return res.status(404).json({ error: 'That booking link is not set up for your practice.' });
      }
      return res.json({ url: await shorten(`${base}/book/${slug}`, { kind: 'booking' }) });
    }
    if (kind === 'meeting') {
      const { rows: [a] } = await req.db.query('SELECT meeting_url, start_time FROM appointments WHERE id::text = $1::text', [appointmentId]);
      if (!a || !a.meeting_url) return res.status(404).json({ error: 'That appointment has no meeting link.' });
      const start = a.start_time ? new Date(a.start_time) : null;
      const expiresAt = start && !Number.isNaN(start.getTime()) ? new Date(start.getTime() + 24 * 3600 * 1000) : null;
      return res.json({ url: await shorten(a.meeting_url, { expiresAt, kind: 'telehealth' }) });
    }
    return res.status(400).json({ error: "kind must be 'booking' or 'meeting'" });
  } catch (e) {
    console.error('[short-links] create failed:', e.message);
    return res.status(500).json({ error: 'Could not create the short link' });
  }
});

module.exports = router;
module.exports.api = api;
