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
// Platform (super-admin) console. A SEPARATE cookie from the tenant session so the two
// planes never share credentials: holding one grants nothing on the other.
const PLATFORM_COOKIE = 'ac_platform';
const PLATFORM_CSRF_COOKIE = 'ac_platform_csrf';

// Cookie mode:
//   default            SameSite=Lax + Secure — correct when the SPA and API share an
//                      origin (vercel.json routes /api/* to the backend). Lax also gives
//                      real CSRF protection on top of the double-submit token.
//   AC_COOKIE_CROSS_SITE=true
//                      SameSite=None + Secure — required only when REACT_APP_SVC_URL puts
//                      the API on a different origin. SameSite then protects nothing, so
//                      the double-submit token carries the whole CSRF defence, and
//                      browsers blocking third-party cookies may reject the cookie
//                      entirely (which is why the Bearer fallback survives in that mode).
//   AC_COOKIE_INSECURE=true
//                      drops Secure for local http development.
const INSECURE = String(process.env.AC_COOKIE_INSECURE || '').toLowerCase() === 'true';
const CROSS_SITE = String(process.env.AC_COOKIE_CROSS_SITE || '').toLowerCase() === 'true';

const baseOptions = (maxAgeMs) => ({
  secure: !INSECURE,
  // SameSite=None requires Secure, so it cannot be combined with insecure local mode.
  sameSite: CROSS_SITE && !INSECURE ? 'none' : 'lax',
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

/** The platform operator JWT from its cookie, or null. */
function getPlatformCookie(req) {
  return parseCookies(req)[PLATFORM_COOKIE] || null;
}

/** The platform CSRF token from its cookie, or null. */
function getPlatformCsrfCookie(req) {
  return parseCookies(req)[PLATFORM_CSRF_COOKIE] || null;
}

/**
 * Issue the operator session cookie (HttpOnly) plus its CSRF cookie, so the console never
 * has to keep the token in JS-readable storage. Scoped to /api/platform, so it is not
 * even sent on tenant requests.
 * @returns {string} the CSRF token to echo in X-CSRF-Token
 */
function issuePlatformCookies(res, token, { maxAgeMs = 8 * 60 * 60 * 1000 } = {}) {
  const csrfToken = crypto.randomBytes(32).toString('hex');
  const opts = baseOptions(maxAgeMs);
  // The session cookie is scoped to /api/platform so it is never even sent on tenant
  // requests. The CSRF cookie CANNOT share that path: the console page is served from
  // /platform, and document.cookie only exposes cookies whose path matches the current
  // URL — so a /api/platform-scoped cookie is invisible to the very script that has to
  // echo it, and every console POST fails its own CSRF check. It holds no secret (it is
  // deliberately JS-readable, and is only ever compared against the header on the same
  // request), so a site-wide path costs nothing.
  res.cookie(PLATFORM_COOKIE, token, { ...opts, path: '/api/platform', httpOnly: true });
  res.cookie(PLATFORM_CSRF_COOKIE, csrfToken, { ...opts, path: '/', httpOnly: false });
  return csrfToken;
}

function clearPlatformCookies(res) {
  const opts = baseOptions(0);
  // Paths must match the ones used to set them, or the cookies survive the logout.
  res.clearCookie(PLATFORM_COOKIE, { ...opts, path: '/api/platform', httpOnly: true });
  res.clearCookie(PLATFORM_CSRF_COOKIE, { ...opts, path: '/', httpOnly: false });
}

module.exports = {
  SESSION_COOKIE, CSRF_COOKIE, PLATFORM_COOKIE, PLATFORM_CSRF_COOKIE,
  parseCookies, getSessionCookie, getCsrfCookie,
  getPlatformCookie, getPlatformCsrfCookie,
  issueAuthCookies, clearAuthCookies,
  issuePlatformCookies, clearPlatformCookies,
};
