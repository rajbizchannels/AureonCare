const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.AC_TK_S;
const JWT_EXPIRY = '24h';
// SEC-11: pin the signing/verification algorithm. HS256 is symmetric; pinning it
// blocks algorithm-confusion attacks (e.g. a forged token declaring alg:"none" or
// asking the verifier to treat our secret as an RSA public key).
const JWT_ALGORITHMS = ['HS256'];

// SEC-10: fail fast at startup rather than warning. A missing or weak signing
// secret is a critical misconfiguration — booting with one would let anyone mint
// valid tokens. Require at least 32 bytes of entropy (256 bits).
const MIN_SECRET_BYTES = 32;
if (!JWT_SECRET || Buffer.byteLength(String(JWT_SECRET), 'utf8') < MIN_SECRET_BYTES) {
  throw new Error(
    `[auth] FATAL: AC_TK_S must be set to a strong secret of at least ${MIN_SECRET_BYTES} bytes ` +
    `(got ${JWT_SECRET ? Buffer.byteLength(String(JWT_SECRET), 'utf8') + ' bytes' : 'unset'}). ` +
    `Refusing to start with an insecure JWT signing secret.`
  );
}

/**
 * Issue a signed JWT for a user record.
 * Call this at login/social-login and include the result in the response.
 *
 * The "tv" claim carries the user's current token_version. authenticate re-checks
 * it against the DB, so bumping token_version (on password change/reset/logout)
 * invalidates every JWT minted before the bump. Defaults to 0 for freshly created
 * users whose row was returned without the column.
 */
const signToken = (user) =>
  jwt.sign(
    { sub: String(user.id), role: user.role, email: user.email, tv: user.token_version ?? 0 },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY, algorithm: JWT_ALGORITHMS[0] }
  );

/**
 * Verify a Bearer JWT and confirm the user is still active in the DB.
 * Sets req.user = { id, email, role, firstName, lastName }.
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.slice(7);
    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET, { algorithms: JWT_ALGORITHMS });
    } catch (err) {
      const msg = err.name === 'TokenExpiredError'
        ? 'Token expired, please log in again'
        : 'Invalid token';
      return res.status(401).json({ error: msg });
    }

    // Confirm user is still active — catches deactivated accounts after token issue
    const pool = req.app.locals.pool;
    const result = await pool.query(
      'SELECT id, email, role, first_name, last_name, token_version FROM users WHERE id = $1 AND status = $2',
      [payload.sub, 'active']
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    const user = result.rows[0];

    // SEC-09: reject tokens minted before the last revocation (password change/reset/logout).
    if ((user.token_version ?? 0) !== (payload.tv ?? 0)) {
      return res.status(401).json({ error: 'Session expired, please log in again' });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.first_name,
      lastName: user.last_name
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

/**
 * Middleware to check if user has one of the required roles.
 * Must be used after authenticate.
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const roles = allowedRoles.flat();
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Access denied',
        message: `Requires one of: ${roles.join(', ')}`
      });
    }

    next();
  };
};

/**
 * Optional authentication — attaches req.user if a valid Bearer token is present
 * but does not reject the request if missing or invalid.
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      try {
        const payload = jwt.verify(token, JWT_SECRET, { algorithms: JWT_ALGORITHMS });
        const pool = req.app.locals.pool;
        const result = await pool.query(
          'SELECT id, email, role, first_name, last_name, token_version FROM users WHERE id = $1 AND status = $2',
          [payload.sub, 'active']
        );
        // SEC-09: only attach the user when the token has not been revoked.
        if (result.rows.length > 0 && (result.rows[0].token_version ?? 0) === (payload.tv ?? 0)) {
          const user = result.rows[0];
          req.user = {
            id: user.id,
            email: user.email,
            role: user.role,
            firstName: user.first_name,
            lastName: user.last_name
          };
        }
      } catch (_) {
        // Invalid/expired token in optionalAuth — continue as unauthenticated
      }
    }
    next();
  } catch (error) {
    console.error('Optional auth error:', error);
    next();
  }
};

/**
 * Require admin role. Safe to use standalone or after authenticate.
 *
 * When authenticate has already run, req.user is already DB-verified — reuse it.
 * When called without authenticate (e.g. router.use(requireAdmin)), independently
 * verifies the Bearer JWT and fetches the role from the DB so the client can never
 * spoof privilege by sending a crafted x-user-role header or a manipulated JWT claim.
 */
const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      const authHeader = req.headers['authorization'];
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const token = authHeader.slice(7);
      let payload;
      try {
        payload = jwt.verify(token, JWT_SECRET, { algorithms: JWT_ALGORITHMS });
      } catch (err) {
        const msg = err.name === 'TokenExpiredError'
          ? 'Token expired, please log in again'
          : 'Invalid token';
        return res.status(401).json({ error: msg });
      }

      // Fetch role from the DB — never rely on the JWT role claim for privilege decisions
      const pool = req.app.locals.pool;
      const result = await pool.query(
        'SELECT id, email, role, token_version FROM users WHERE id = $1 AND status = $2',
        [payload.sub, 'active']
      );
      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'User not found or inactive' });
      }

      const u = result.rows[0];

      // SEC-09: reject revoked tokens on the standalone path too.
      if ((u.token_version ?? 0) !== (payload.tv ?? 0)) {
        return res.status(401).json({ error: 'Session expired, please log in again' });
      }

      req.user = { id: u.id, email: u.email, role: u.role };
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin privileges required' });
    }

    next();
  } catch (error) {
    console.error('requireAdmin error:', error);
    res.status(500).json({ error: 'Authorization check failed' });
  }
};

module.exports = { signToken, authenticate, authorize, optionalAuth, requireAdmin };
