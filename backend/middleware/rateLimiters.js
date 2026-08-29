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

// Strict limiter for authentication-sensitive endpoints (login, password
// reset, social login). Low ceiling per IP to blunt credential brute-force
// and password-reset abuse.
const authLimiter = rateLimit({
  store: storeFor('auth'),
  windowMs: WINDOW_MS,
  max: 10,
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

module.exports = { authLimiter, apiLimiter };
