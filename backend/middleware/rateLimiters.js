const rateLimit = require('express-rate-limit');

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// Strict limiter for authentication-sensitive endpoints (login, password
// reset, social login). Low ceiling per IP to blunt credential brute-force
// and password-reset abuse.
const authLimiter = rateLimit({
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
