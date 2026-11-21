const rateLimit = require('express-rate-limit');
const { storeFor, redisConfigured } = require('./rateLimitStore');

// SEC-21: with the default MemoryStore each serverless instance counts separately, so the
// effective ceiling is (limit x instances). storeFor() returns a Redis-backed store when
// AC_RD_H / AC_RD_URL is configured, making the counters global; otherwise it returns
// undefined and behaviour is unchanged.
if (!redisConfigured()) {
  console.warn(
    '[rate-limit] No Redis configured (AC_RD_H / AC_RD_URL) — limits are PER INSTANCE. ' +
    'On a multi-instance deployment the effective limit is the configured value times the ' +
    'number of instances.'
  );
}

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Test-only bypass.
 *
 * The MFA/session suite makes far more than ten calls under /api/auth in a few seconds —
 * enrolment, verification, and a dozen deliberate sign-in attempts — so the limiter blocks
 * it and the run reports failures that have nothing to do with the behaviour under test.
 *
 * Gated on TWO conditions, not one: an explicit opt-in variable AND a non-production
 * NODE_ENV. One stray environment variable in production therefore cannot switch off
 * brute-force protection; it would take two, one of which breaks much else besides.
 */
const testBypass = () =>
  process.env.AC_RL_TEST_BYPASS === '1' && process.env.NODE_ENV !== 'production';

// Strict limiter for authentication-sensitive endpoints (login, password
// reset, social login). Low ceiling per IP to blunt credential brute-force
// and password-reset abuse.
// Mounted on all of /api/auth, but it counts ONLY the requests that try a credential.
// It used to count every /api/auth request — including /me on each page load, the
// practice-switcher's /memberships and /session/end — so ordinary use by an office behind
// one IP used up the allowance and the next real sign-in was refused with "Too many
// attempts". Per-ACCOUNT protection is the lockout after 4 wrong passwords
// (services/loginLockout.js); this is the per-IP backstop against spraying many accounts.
const CREDENTIAL_PATHS = /^\/(login|forgot-password|reset-password|social-login|link-social-account|change-password|mfa\/(verify|disable)|oauth\/[a-z]+\/exchange|mobile\/oauth\/[a-z]+\/(start|callback)|mobile\/oauth\/redeem)\/?$/;
const authLimiter = rateLimit({
  store: storeFor('auth'),
  windowMs: WINDOW_MS,
  max: 30,
  skip: (req) => testBypass() || !CREDENTIAL_PATHS.test(req.path),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.log(`[DEBUG rate-limit] AUTH block: ip=${req.ip} path=${req.originalUrl}`);
    res.status(429).json({ error: 'Too many attempts. Please try again in 15 minutes.' });
  },
});

// Global limiter for the entire API surface — a DoS/abuse backstop on every
// endpoint. Deliberately generous so normal multi-user office traffic (shared
// NAT IP, chatty SPA) is never throttled; only abusive volumes trip it.
const apiLimiter = rateLimit({
  store: storeFor('api'),
  windowMs: WINDOW_MS,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.log(`[DEBUG rate-limit] API block: ip=${req.ip} path=${req.originalUrl}`);
    res.status(429).json({ error: 'Too many requests. Please slow down and try again shortly.' });
  },
});

module.exports = { authLimiter, apiLimiter, CREDENTIAL_PATHS };
