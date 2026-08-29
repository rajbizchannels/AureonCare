// SEC-15: session tokens in HttpOnly cookies instead of sessionStorage.
//
// A token in sessionStorage is readable by any script on the page, so a single XSS is a
// full account takeover. An HttpOnly cookie is not reachable from JavaScript, which
// removes that class of theft.
//
// Cookies are sent automatically by the browser, which reintroduces CSRF. The frontend
// and API are on DIFFERENT origins here (REACT_APP_SVC_URL points at a separate host),
// so the session cookie must be SameSite=None to be sent at all — and SameSite therefore
// provides no CSRF protection whatsoever. A double-submit token is mandatory, not
// optional: see middleware/csrf.js.
//
// Reading is done by parsing the Cookie header directly rather than adding cookie-parser,
// to avoid a new runtime dependency for two cookies. res.cookie() is built into Express.

const crypto = require('crypto');

const SESSION_COOKIE = 'ac_session';
const CSRF_COOKIE = 'ac_csrf';

// SameSite=None requires Secure, which requires HTTPS. Local development over plain
// http therefore cannot use it; AC_COOKIE_INSECURE=true switches to Lax without Secure.
const INSECURE = String(process.env.AC_COOKIE_INSECURE || '').toLowerCase() === 'true';

const baseOptions = (maxAgeMs) => ({
  secure: !INSECURE,
  sameSite: INSECURE ? 'lax' : 'none',
  path: '/',
  maxAge: maxAgeMs,
});

/** Parse the Cookie header into an object. */
function parseCookies(req) {
  const header = req.headers?.cookie;
  if (!header) return {};
  const out = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

/** The session JWT from the cookie, or null. */
function getSessionCookie(req) {
  return parseCookies(req)[SESSION_COOKIE] || null;
}

/** The CSRF token from the cookie, or null. */
function getCsrfCookie(req) {
  return parseCookies(req)[CSRF_COOKIE] || null;
}

/**
 * Issue the session cookie (HttpOnly) plus the CSRF cookie (readable by JS, by design —
 * the client must echo it in a header for the double-submit check).
 * @returns {string} the CSRF token, so callers can also return it in the response body
 */
function issueAuthCookies(res, token, { maxAgeMs = 24 * 60 * 60 * 1000 } = {}) {
  const csrfToken = crypto.randomBytes(32).toString('hex');
  res.cookie(SESSION_COOKIE, token, { ...baseOptions(maxAgeMs), httpOnly: true });
  res.cookie(CSRF_COOKIE, csrfToken, { ...baseOptions(maxAgeMs), httpOnly: false });
  return csrfToken;
}

/** Clear both cookies (logout). */
function clearAuthCookies(res) {
  const opts = { ...baseOptions(0), httpOnly: true };
  res.clearCookie(SESSION_COOKIE, opts);
  res.clearCookie(CSRF_COOKIE, { ...baseOptions(0), httpOnly: false });
}

module.exports = {
  SESSION_COOKIE, CSRF_COOKIE,
  parseCookies, getSessionCookie, getCsrfCookie,
  issueAuthCookies, clearAuthCookies,
};
