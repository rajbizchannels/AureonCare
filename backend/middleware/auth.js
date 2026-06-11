const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.AC_TK_S;
const JWT_EXPIRY = '24h';

if (!JWT_SECRET) {
  console.warn('[auth] WARNING: AC_TK_S env var is not set — JWT signing will fail');
}

/**
 * Issue a signed JWT for a user record.
 * Call this at login/social-login and include the result in the response.
 */
const signToken = (user) =>
  jwt.sign(
    { sub: String(user.id), role: user.role, email: user.email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
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
      payload = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      const msg = err.name === 'TokenExpiredError'
        ? 'Token expired, please log in again'
        : 'Invalid token';
      return res.status(401).json({ error: msg });
    }

    // Confirm user is still active — catches deactivated accounts after token issue
    const pool = req.app.locals.pool;
    const result = await pool.query(
      'SELECT id, email, role, first_name, last_name FROM users WHERE id = $1 AND status = $2',
      [payload.sub, 'active']
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    const user = result.rows[0];
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.first_name,
      lastName: user.last_name
    };

    console.log(`[DEBUG auth-gate] authenticated: ${req.method} ${req.originalUrl} user:${user.id} role:${user.role}`);
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
        const payload = jwt.verify(token, JWT_SECRET);
        const pool = req.app.locals.pool;
        const result = await pool.query(
          'SELECT id, email, role, first_name, last_name FROM users WHERE id = $1 AND status = $2',
          [payload.sub, 'active']
        );
        if (result.rows.length > 0) {
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
        payload = jwt.verify(token, JWT_SECRET);
      } catch (err) {
        const msg = err.name === 'TokenExpiredError'
          ? 'Token expired, please log in again'
          : 'Invalid token';
        return res.status(401).json({ error: msg });
      }

      // Fetch role from the DB — never rely on the JWT role claim for privilege decisions
      const pool = req.app.locals.pool;
      const result = await pool.query(
        'SELECT id, email, role FROM users WHERE id = $1 AND status = $2',
        [payload.sub, 'active']
      );
      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'User not found or inactive' });
      }

      const u = result.rows[0];
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
