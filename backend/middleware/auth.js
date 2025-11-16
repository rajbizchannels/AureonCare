/**
 * Authentication and Authorization Middleware
 *
 * This middleware extracts user information from request headers
 * and provides role-based access control for API endpoints.
 */

/**
 * Middleware to authenticate requests using user information from headers
 * Expects x-user-id and x-user-role headers from the client
 *
 * In production, this should be replaced with JWT token authentication
 */
const authenticate = async (req, res, next) => {
  try {
    // Extract user info from headers
    const userId = req.headers['x-user-id'];
    const userRole = req.headers['x-user-role'];

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User ID not provided in request headers'
      });
    }

    // Verify user exists in database
    const pool = req.app.locals.pool;
    const result = await pool.query(
      'SELECT * FROM users WHERE id::text = $1::text AND status = $2',
      [userId, 'active']
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'Invalid user',
        message: 'User not found or not active'
      });
    }

    const user = result.rows[0];

    // Attach user info to request object
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
    res.status(500).json({
      error: 'Authentication failed',
      message: 'Internal server error during authentication'
    });
  }
};

/**
 * Middleware to check if user has required role(s)
 * @param {Array|String} allowedRoles - Single role or array of allowed roles
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User must be authenticated to access this resource'
      });
    }

    // Flatten the array in case roles are passed as nested arrays
    const roles = allowedRoles.flat();

    // Check if user's role is in the allowed roles
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Access denied',
        message: `This resource requires one of the following roles: ${roles.join(', ')}`,
        userRole: req.user.role
      });
    }

    next();
  };
};

/**
 * Optional authentication - attaches user if headers present but doesn't require it
 */
const optionalAuth = async (req, res, next) => {
  try {
    const userId = req.headers['x-user-id'];

    if (userId) {
      const pool = req.app.locals.pool;
      const result = await pool.query(
        'SELECT * FROM users WHERE id::text = $1::text AND status = $2',
        [userId, 'active']
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
    }

    next();
  } catch (error) {
    console.error('Optional auth error:', error);
    // Don't fail the request, just continue without user
    next();
  }
};

module.exports = {
  authenticate,
  authorize,
  optionalAuth
};
