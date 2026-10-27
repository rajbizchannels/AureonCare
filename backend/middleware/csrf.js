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
const { getCsrfCookie, getSessionCookie, getPlatformCookie, getPlatformCsrfCookie } = require('../utils/authCookies');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Constant-time compare that tolerates unequal lengths. */
function safeEqual(a, b) {
  const ab = Buffer.from(String(a || ''), 'utf8');
  const bb = Buffer.from(String(b || ''), 'utf8');
  if (ab.length !== bb.length || ab.length === 0) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Endpoints that never act as the cookie's user.
 *
 * CSRF protects state-changing actions performed AS the authenticated user. These three
 * ignore the session entirely — they create a NEW account or a signup intent from data in
 * the request. A forged cross-site call achieves nothing against the victim: it cannot
 * touch their records, and anything it creates belongs to credentials the attacker already
 * had.
 *
 * Exempting them is not a convenience. Because the API is same-origin, the browser attaches
 * an existing session cookie to these public POSTs without being asked, so the check fired
 * for anyone who happened to be signed in — or merely carried a stale cookie — and
 * registering a new subscription returned 403 with nothing on screen explaining why.
 * Sending the token from the client (done) fixes the common case; this covers the rest,
 * where the session cookie outlives the readable CSRF cookie.
 *
 * Deliberately NOT exempt, though they are also reached without an account:
 *   POST /api/auth/login and the social-login/exchange routes. A forged login DOES act on
 *   the victim — it signs their browser into the ATTACKER'S account, so anything they
 *   record afterwards lands somewhere the attacker can read. In a clinical system that is
 *   a disclosure, not an inconvenience.
 *
 * Matched on the exact method and path, never a prefix, so a future route underneath one
 * of these cannot inherit the exemption by accident.
 */
const SESSION_INDEPENDENT = new Set([
  'POST /api/signup',
  'POST /api/invites/accept',
  'POST /api/team-access/join',
]);

/** True when this exact request is one of the session-independent endpoints. */
function isSessionIndependent(req) {
  // originalUrl carries the mount prefix and may carry a query string.
  const path = String(req.originalUrl || '').split('?')[0].replace(/\/+$/, '') || '/';
  return SESSION_INDEPENDENT.has(`${(req.method || '').toUpperCase()} ${path}`);
}

function verifyCsrf(req, res, next) {
  if (SAFE_METHODS.has((req.method || 'GET').toUpperCase())) return next();

  // Bearer-authenticated requests cannot be forged cross-site — no cookie involved.
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) return next();

  // The platform console authenticates with its own cookie pair, which must be checked
  // here too — otherwise an operator's cookie would be usable cross-site unprotected.
  const isPlatform = Boolean(getPlatformCookie(req));

  // Not cookie-authenticated either (e.g. an unauthenticated public endpoint) — nothing
  // for CSRF to protect here; the route's own auth decides.
  if (!isPlatform && !getSessionCookie(req)) return next();

  // A session cookie is present, but this endpoint does not act as that user. See
  // SESSION_INDEPENDENT above for why these three and not the login routes.
  if (!isPlatform && isSessionIndependent(req)) return next();

  const cookieToken = isPlatform ? getPlatformCsrfCookie(req) : getCsrfCookie(req);
  const headerToken = req.headers['x-csrf-token'] || req.headers['x-xsrf-token'];

  if (!cookieToken || !headerToken || !safeEqual(cookieToken, headerToken)) {
    return res.status(403).json({
      error: 'CSRF validation failed',
      message: 'Missing or invalid X-CSRF-Token header for a cookie-authenticated request.',
    });
  }
  next();
}

module.exports = { verifyCsrf, SESSION_INDEPENDENT };
