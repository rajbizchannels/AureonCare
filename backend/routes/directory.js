// Directory search (Phase 3).
//
//   POST /api/directory/search   { q, lat?, lng? } -> searchable practices only
//   GET  /sitemap-practices.xml  readable addresses of searchable profiles
//
// NO SEARCH LOGS, by design:
//   * the query travels in the POST body — never in the URL, which hosting and proxy logs
//     record — and nothing here logs it, even on error;
//   * a shared location is rounded (~1 km) and used for this one answer only;
//   * answers are `no-store`, so no cache keeps them.
// Public and session-independent (exempt from CSRF in middleware/csrf.js): it reads only
// what practices published, and never acts as whoever happens to be signed in.

const express = require('express');
const rateLimit = require('express-rate-limit');
const { storeFor } = require('../middleware/rateLimitStore');
const D = require('../services/directorySearch');
const { appBase } = require('../services/practiceProfile');

const router = express.Router();
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false,
  store: storeFor('directory-search'),
  message: { error: 'Too many searches. Please wait a few minutes and try again.' },
});

// Round to 2 decimals (~1 km) — enough for "near me", too coarse to identify a home.
const coarse = (v) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Math.round(Number(v) * 100) / 100 : null);

router.post('/search', limiter, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.set('X-Robots-Tag', 'noindex');
  const b = req.body || {};
  const q = String(b.q || '').slice(0, 200);
  let lat = coarse(b.lat); let lng = coarse(b.lng);
  if (lat == null || lng == null || Math.abs(lat) > 90 || Math.abs(lng) > 180) { lat = null; lng = null; }
  const limit = Math.min(Math.max(parseInt(b.limit, 10) || 20, 1), 50);
  const offset = Math.min(Math.max(parseInt(b.offset, 10) || 0, 0), 1000);
  try {
    res.json(await D.search(req.app.locals.pool, { q, lat, lng, limit, offset }));
  } catch (err) {
    // Deliberately without the query or location.
    console.error('[directory] search failed:', err.code || err.name);
    res.status(500).json({ error: 'Search is not available right now.' });
  }
});

const sitemap = express.Router();
sitemap.get('/sitemap-practices.xml', async (req, res) => {
  try {
    const base = appBase();
    const urls = await D.searchableUrls(req.app.locals.pool);
    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    res.set('Cache-Control', 'public, max-age=3600');
    res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${
      urls.map((u) => `  <url><loc>${esc(base + u)}</loc></url>`).join('\n')}\n</urlset>\n`);
  } catch (err) {
    res.status(503).end();
  }
});

// robots.txt: profile pages may be indexed (each page also carries its own robots rule);
// the API, short links and the search page itself are not.
sitemap.get('/robots.txt', (req, res) => {
  const base = appBase();
  res.set('Cache-Control', 'public, max-age=3600');
  res.type('text/plain').send(['User-agent: *', 'Disallow: /api/', 'Disallow: /s/', 'Disallow: /find',
    'Allow: /p/', base ? `Sitemap: ${base}/sitemap-practices.xml` : ''].filter(Boolean).join('\n') + '\n');
});

module.exports = { router, sitemap };
