// SEC-05 Model D — Step S10: platform (super-admin) authentication.
//
// Operators are a SEPARATE principal type from tenant staff (control.operators, not
// public.users) with their OWN signing secret (AC_PLAT_S). There is no path from a
// tenant `users` JWT to an operator token — different table, different secret, and an
// explicit `kind:"operator"` claim re-checked against the DB. Operators have NO standing
// access to tenant PHI; that requires a break-glass session (see routes/platform.js).

const jwt = require('jsonwebtoken');

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
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Platform authentication required' });
    }
    let payload;
    try {
      payload = jwt.verify(authHeader.slice(7), secret, { algorithms: ALGS });
    } catch (err) {
      return res.status(401).json({ error: err.name === 'TokenExpiredError' ? 'Session expired' : 'Invalid token' });
    }
    if (payload.kind !== 'operator') {
      return res.status(401).json({ error: 'Not a platform token' });
    }

    const pool = req.app.locals.pool;
    const { rows } = await pool.query(
      "SELECT id, email, name, token_version FROM control.operators WHERE id = $1 AND status = 'active'",
      [payload.sub]
    );
    if (rows.length === 0) return res.status(401).json({ error: 'Operator not found or disabled' });
    if ((rows[0].token_version ?? 0) !== (payload.tv ?? 0)) {
      return res.status(401).json({ error: 'Session expired, please sign in again' });
    }

    req.operator = { id: rows[0].id, email: rows[0].email, name: rows[0].name };
    next();
  } catch (error) {
    if (error.statusCode === 503) return res.status(503).json({ error: error.message });
    console.error('Platform auth error:', error);
    res.status(500).json({ error: 'Authorization failed' });
  }
};

module.exports = { signPlatformToken, requirePlatformAdmin, requireSecret };
