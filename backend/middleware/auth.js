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
    console.log('[DEBUG auth] authenticate called, header present:', !!authHeader);

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.slice(7);
    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
      console.log('[DEBUG auth] JWT verified, sub:', payload.sub, 'role:', payload.role);
    } catch (err) {
      const msg = err.name === 'TokenExpiredError'
        ? 'Token expired, please log in again'
        : 'Invalid token';
      console.log('[DEBUG auth] JWT verification failed:', err.name);
      return res.status(401).json({ error: msg });
    }

    // Confirm user is still active — catches deactivated accounts after token issue
    const pool = req.app.locals.pool;
    const result = await pool.query(
      'SELECT id, email, role, first_name, last_name FROM users WHERE id = $1 AND status = $2',
      [payload.sub, 'active']
    );

    if (result.rows.length === 0) {
      console.log('[DEBUG auth] User not found or inactive for sub:', payload.sub);
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
    console.log('[DEBUG auth] User authenticated:', user.id, 'role:', user.role);

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
      // authenticate has not run — perform independent JWT + DB verification
      const authHeader = req.headers['authorization'];
      console.log('[DEBUG requireAdmin] req.user absent — verifying Bearer token independently');

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const token = authHeader.slice(7);
      let payload;
      try {
        payload = jwt.verify(token, JWT_SECRET);
        console.log('[DEBUG requireAdmin] Token verified, sub:', payload.sub);
      } catch (err) {
        const msg = err.name === 'TokenExpiredError'
          ? 'Token expired, please log in again'
          : 'Invalid token';
        console.log('[DEBUG requireAdmin] Token verification failed:', err.name);
        return res.status(401).json({ error: msg });
      }

      // Fetch role from the DB — never rely on the JWT role claim for privilege decisions
      const pool = req.app.locals.pool;
      const result = await pool.query(
        'SELECT id, email, role FROM users WHERE id = $1 AND status = $2',
        [payload.sub, 'active']
      );
      if (result.rows.length === 0) {
        console.log('[DEBUG requireAdmin] User not found or inactive, sub:', payload.sub);
        return res.status(401).json({ error: 'User not found or inactive' });
      }

      const u = result.rows[0];
      req.user = { id: u.id, email: u.email, role: u.role };
      console.log('[DEBUG requireAdmin] DB role fetched:', u.role, 'for user:', u.id);
    } else {
      console.log('[DEBUG requireAdmin] req.user already set by authenticate, role:', req.user.role);
    }

    if (req.user.role !== 'admin') {
      console.log('[DEBUG requireAdmin] Access denied — role is:', req.user.role);
      return res.status(403).json({ error: 'Admin privileges required' });
    }

    console.log('[DEBUG requireAdmin] Admin access granted for user:', req.user.id);
    next();
  } catch (error) {
    console.error('requireAdmin error:', error);
    res.status(500).json({ error: 'Authorization check failed' });
  }
};

module.exports = { signToken, authenticate, authorize, optionalAuth, requireAdmin };
