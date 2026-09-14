// SEC-05 Model D — Step S10: platform (super-admin) authentication.
//
// Operators are a SEPARATE principal type from tenant staff (control.operators, not
// public.users) with their OWN signing secret (AC_PLAT_S). There is no path from a
// tenant `users` JWT to an operator token — different table, different secret, and an
// explicit `kind:"operator"` claim re-checked against the DB. Operators have NO standing
// access to tenant PHI; that requires a break-glass session (see routes/platform.js).

const jwt = require('jsonwebtoken');
const { getPlatformCookie } = require('../utils/authCookies');

const PLAT_SECRET = process.env.AC_PLAT_S;
const PLAT_EXPIRY = '8h';
const ALGS = ['HS256'];

// Lazy, not fail-fast: an unconfigured console must not stop the whole app from booting.
// Platform routes return 503 until AC_PLAT_S is set (≥ 32 bytes).
function requireSecret() {
  if (!PLAT_SECRET || Buffer.byteLength(String(PLAT_SECRET), 'utf8') < 32) {
    const e = new Error('Platform console not configured: set AC_PLAT_S to a strong secret (>= 32 bytes).');
    e.statusCode = 503;
    throw e;
  }
  return PLAT_SECRET;
}

const signPlatformToken = (operator) =>
  jwt.sign(
    { sub: String(operator.id), kind: 'operator', tv: operator.token_version ?? 0 },
    requireSecret(),
    { expiresIn: PLAT_EXPIRY, algorithm: ALGS[0] }
  );

/**
 * Gate for /api/platform/*. Verifies an operator JWT and confirms the operator is still
 * active with a matching token_version. Sets req.operator = { id, email, name }.
 */
const requirePlatformAdmin = async (req, res, next) => {
  try {
    const secret = requireSecret();
    // The console signs in with an HttpOnly cookie so it never stores the token in
    // JS-readable storage; scripted clients keep using the Authorization header. The
    // header wins so a stale cookie cannot shadow an explicit token.
    const authHeader = req.headers['authorization'];
    const token = (authHeader && authHeader.startsWith('Bearer '))
      ? authHeader.slice(7)
      : getPlatformCookie(req);
    if (!token) {
      return res.status(401).json({ error: 'Platform authentication required' });
    }
    let payload;
    try {
      payload = jwt.verify(token, secret, { algorithms: ALGS });
    } catch (err) {
      return res.status(401).json({ error: err.name === 'TokenExpiredError' ? 'Session expired' : 'Invalid token' });
    }
    if (payload.kind !== 'operator') {
      return res.status(401).json({ error: 'Not a platform token' });
    }

    const pool = req.app.locals.pool;
    const { rows } = await pool.query(
      "SELECT id, email, name, role, token_version FROM control.operators WHERE id = $1 AND status = 'active'",
      [payload.sub]
    );
    if (rows.length === 0) return res.status(401).json({ error: 'Operator not found or disabled' });
    if ((rows[0].token_version ?? 0) !== (payload.tv ?? 0)) {
      return res.status(401).json({ error: 'Session expired, please sign in again' });
    }

    req.operator = {
      id: rows[0].id, email: rows[0].email, name: rows[0].name,
      // Default to the most privileged role only for a row that predates migration 078;
      // the column is NOT NULL with a default, so in practice this is always set.
      role: rows[0].role || 'owner',
    };
    next();
  } catch (error) {
    if (error.statusCode === 503) return res.status(503).json({ error: error.message });
    console.error('Platform auth error:', error);
    res.status(500).json({ error: 'Authorization failed' });
  }
};

/**
 * Role gate for platform routes. Roles are cumulative in capability but checked as a set,
 * so a route names exactly the roles it accepts.
 *
 *   readonly  read reports; change nothing
 *   billing   + plans, coupons, subscriptions, adjustments, free months
 *   support   + tenant lifecycle and break-glass over PHI
 *   owner     + manage operators
 *
 * Deliberately separate from requirePlatformAdmin: authentication says who you are,
 * this says what that principal may do. Applied per route rather than router-wide,
 * because the console mixes read and write endpoints under one prefix.
 */
const ROLE_GRANTS = {
  owner: ['owner', 'billing', 'support', 'readonly'],
  billing: ['billing', 'readonly'],
  support: ['support', 'readonly'],
  readonly: ['readonly'],
};

const requireOperatorRole = (...allowed) => (req, res, next) => {
  if (!req.operator) return res.status(401).json({ error: 'Platform authentication required' });
  const held = ROLE_GRANTS[req.operator.role] || [];
  if (!allowed.some((a) => held.includes(a))) {
    return res.status(403).json({
      error: `This action requires one of: ${allowed.join(', ')}. Your role is ${req.operator.role}.`,
    });
  }
  next();
};

module.exports = {
  signPlatformToken, requirePlatformAdmin, requireSecret, requireOperatorRole, ROLE_GRANTS,
};
