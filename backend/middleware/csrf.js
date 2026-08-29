// SEC-15: CSRF protection for cookie-authenticated requests (double-submit token).
//
// Once the session lives in a cookie the browser attaches it to cross-site requests
// automatically, so a malicious page could drive state-changing calls as the victim.
// Because the API and the SPA are on different origins the session cookie must be
// SameSite=None, which means SameSite contributes NOTHING here — this check is the
// protection, not a belt-and-braces extra.
//
// Double submit: the CSRF token is issued in a JS-readable cookie at login; the client
// echoes it in the X-CSRF-Token header. A cross-site attacker can cause the cookie to be
// sent but cannot read it (that is what the same-origin policy prevents), so it cannot
// populate the header.
//
// Requests authenticated with an Authorization: Bearer header are EXEMT by design: the
// browser never attaches that header automatically, so they are not forgeable this way.
// This keeps the existing token-based frontend working unchanged during the migration.

const crypto = require('crypto');
const { getCsrfCookie, getSessionCookie } = require('../utils/authCookies');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Constant-time compare that tolerates unequal lengths. */
function safeEqual(a, b) {
  const ab = Buffer.from(String(a || ''), 'utf8');
  const bb = Buffer.from(String(b || ''), 'utf8');
  if (ab.length !== bb.length || ab.length === 0) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function verifyCsrf(req, res, next) {
  if (SAFE_METHODS.has((req.method || 'GET').toUpperCase())) return next();

  // Bearer-authenticated requests cannot be forged cross-site — no cookie involved.
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) return next();

  // Not cookie-authenticated either (e.g. an unauthenticated public endpoint) — nothing
  // for CSRF to protect here; the route's own auth decides.
  if (!getSessionCookie(req)) return next();

  const cookieToken = getCsrfCookie(req);
  const headerToken = req.headers['x-csrf-token'] || req.headers['x-xsrf-token'];

  if (!cookieToken || !headerToken || !safeEqual(cookieToken, headerToken)) {
    return res.status(403).json({
      error: 'CSRF validation failed',
      message: 'Missing or invalid X-CSRF-Token header for a cookie-authenticated request.',
    });
  }
  next();
}

module.exports = { verifyCsrf };
