/**
 * AUREONCARE MULTI-TENANT AUTHENTICATION MIDDLEWARE
 *
 * Handles:
 * - JWT token generation and validation with tenant context
 * - Role-based access control per tenant
 * - Permission-based authorization
 * - MFA enforcement
 * - Session management
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || '24h';
const JWT_REFRESH_EXPIRATION = process.env.JWT_REFRESH_EXPIRATION || '7d';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || JWT_SECRET + '-refresh';

/**
 * Generate JWT token with tenant context
 */
function generateToken(payload, expiresIn = JWT_EXPIRATION) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

/**
 * Generate refresh token
 */
function generateRefreshToken(payload) {
    return jwt.sign(payload, REFRESH_TOKEN_SECRET, { expiresIn: JWT_REFRESH_EXPIRATION });
}

/**
 * Verify JWT token
 */
function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
}

/**
 * Verify refresh token
 */
function verifyRefreshToken(token) {
    try {
        return jwt.verify(token, REFRESH_TOKEN_SECRET);
    } catch (error) {
        return null;
    }
}

/**
 * Generate session ID
 */
function generateSessionId() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash session token for storage
 */
function hashSessionToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Create tokens for authenticated user
 */
async function createAuthTokens(pool, user, tenant, deviceInfo = {}) {
    const sessionId = generateSessionId();
    const tokenPayload = {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        tenantCode: tenant.tenant_code,
        role: user.active_role || user.role,
        sessionId: sessionId
    };

    const accessToken = generateToken(tokenPayload);
    const refreshToken = generateRefreshToken({
        userId: user.id,
        tenantId: tenant.id,
        sessionId: sessionId,
        type: 'refresh'
    });

    // Store session in database
    await pool.query(
        `INSERT INTO tenant_sessions (
            tenant_id, user_id, session_token_hash, refresh_token_hash,
            device_type, device_name, browser, os,
            ip_address, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
            tenant.id,
            user.id,
            hashSessionToken(accessToken),
            hashSessionToken(refreshToken),
            deviceInfo.deviceType || 'unknown',
            deviceInfo.deviceName || 'unknown',
            deviceInfo.browser || 'unknown',
            deviceInfo.os || 'unknown',
            deviceInfo.ipAddress || null,
            new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        ]
    );

    return {
        accessToken,
        refreshToken,
        expiresIn: JWT_EXPIRATION,
        tokenType: 'Bearer',
        sessionId
    };
}

/**
 * Revoke a session
 */
async function revokeSession(pool, sessionId, reason = 'manual_logout') {
    await pool.query(
        `UPDATE tenant_sessions
         SET is_active = false, revoked_at = NOW(), revoked_reason = $2
         WHERE session_token_hash = $1 OR id::text = $1`,
        [sessionId, reason]
    );
}

/**
 * Revoke all sessions for a user
 */
async function revokeAllUserSessions(pool, userId, tenantId, reason = 'security_logout') {
    await pool.query(
        `UPDATE tenant_sessions
         SET is_active = false, revoked_at = NOW(), revoked_reason = $3
         WHERE user_id = $1 AND tenant_id = $2 AND is_active = true`,
        [userId, tenantId, reason]
    );
}

/**
 * Main tenant-aware authentication middleware
 */
function tenantAuthenticate(options = {}) {
    const { required = true } = options;

    return async (req, res, next) => {
        try {
            // Extract token from Authorization header
            const authHeader = req.headers.authorization;

            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                // Fall back to legacy header-based auth for migration period
                const legacyUserId = req.headers['x-user-id'];
                const legacyUserRole = req.headers['x-user-role'];

                if (legacyUserId && req.tenant) {
                    // Legacy auth - lookup user
                    const pool = req.app.locals.pool;
                    const userResult = await pool.query(
                        `SELECT u.*, tu.is_tenant_admin, tu.tenant_roles, tu.access_level
                         FROM users u
                         LEFT JOIN tenant_users tu ON tu.user_id = u.id AND tu.tenant_id = $2
                         WHERE u.id = $1`,
                        [legacyUserId, req.tenant.id]
                    );

                    if (userResult.rows.length > 0) {
                        req.user = userResult.rows[0];
                        req.user.role = legacyUserRole || req.user.role;
                        return next();
                    }
                }

                if (required) {
                    return res.status(401).json({
                        error: 'Authentication required',
                        code: 'NO_TOKEN'
                    });
                }
                return next();
            }

            const token = authHeader.split(' ')[1];
            const decoded = verifyToken(token);

            if (!decoded) {
                if (required) {
                    return res.status(401).json({
                        error: 'Invalid or expired token',
                        code: 'INVALID_TOKEN'
                    });
                }
                return next();
            }

            // Verify tenant matches
            if (req.tenant && decoded.tenantId !== req.tenant.id) {
                return res.status(403).json({
                    error: 'Token tenant mismatch',
                    code: 'TENANT_MISMATCH'
                });
            }

            // Set tenant ID from token if not already set
            if (!req.tenant) {
                req.tenantIdFromToken = decoded.tenantId;
            }

            // Lookup user with tenant-specific info
            const pool = req.app.locals.pool;
            const userResult = await pool.query(
                `SELECT u.*, tu.is_tenant_admin, tu.tenant_roles, tu.access_level, tu.status as tenant_user_status
                 FROM users u
                 LEFT JOIN tenant_users tu ON tu.user_id = u.id AND tu.tenant_id = $2
                 WHERE u.id = $1`,
                [decoded.userId, decoded.tenantId]
            );

            if (userResult.rows.length === 0) {
                return res.status(401).json({
                    error: 'User not found',
                    code: 'USER_NOT_FOUND'
                });
            }

            const user = userResult.rows[0];

            // Check user status
            if (user.status !== 'active') {
                return res.status(403).json({
                    error: 'User account is not active',
                    code: 'USER_INACTIVE',
                    status: user.status
                });
            }

            // Check tenant user status
            if (user.tenant_user_status && user.tenant_user_status !== 'active') {
                return res.status(403).json({
                    error: 'User access to this tenant is restricted',
                    code: 'TENANT_ACCESS_RESTRICTED'
                });
            }

            // Verify session is active
            const sessionResult = await pool.query(
                `SELECT * FROM tenant_sessions
                 WHERE user_id = $1 AND tenant_id = $2
                 AND session_token_hash = $3
                 AND is_active = true
                 AND expires_at > NOW()`,
                [decoded.userId, decoded.tenantId, hashSessionToken(token)]
            );

            if (sessionResult.rows.length === 0) {
                return res.status(401).json({
                    error: 'Session expired or revoked',
                    code: 'SESSION_INVALID'
                });
            }

            // Update session activity
            await pool.query(
                `UPDATE tenant_sessions
                 SET last_activity_at = NOW()
                 WHERE id = $1`,
                [sessionResult.rows[0].id]
            );

            // Attach user to request
            req.user = user;
            req.user.sessionId = decoded.sessionId;
            req.user.tokenPayload = decoded;

            next();
        } catch (error) {
            console.error('Authentication error:', error);
            return res.status(500).json({
                error: 'Authentication failed',
                code: 'AUTH_ERROR'
            });
        }
    };
}

/**
 * Role-based authorization middleware (tenant-aware)
 */
function tenantAuthorize(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Authentication required',
                code: 'NOT_AUTHENTICATED'
            });
        }

        // Tenant admins always have access
        if (req.user.is_tenant_admin) {
            return next();
        }

        // Check if user's role is in allowed roles
        const userRole = req.user.active_role || req.user.role;
        const tenantRoles = req.user.tenant_roles || [];

        // Combine base role with tenant-specific roles
        const allUserRoles = [userRole, ...tenantRoles];

        const hasRole = allowedRoles.some(role =>
            allUserRoles.includes(role) || role === '*'
        );

        if (!hasRole) {
            return res.status(403).json({
                error: 'Insufficient permissions',
                code: 'FORBIDDEN',
                requiredRoles: allowedRoles,
                userRole: userRole
            });
        }

        next();
    };
}

/**
 * Permission-based authorization middleware
 */
function requirePermission(...requiredPermissions) {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Authentication required',
                code: 'NOT_AUTHENTICATED'
            });
        }

        if (!req.tenant) {
            return res.status(400).json({
                error: 'Tenant context required',
                code: 'NO_TENANT_CONTEXT'
            });
        }

        // Tenant admins always have access
        if (req.user.is_tenant_admin) {
            return next();
        }

        try {
            const pool = req.app.locals.pool;
            const userRole = req.user.active_role || req.user.role;

            // Get user's permissions from tenant role
            const permissionResult = await pool.query(
                `SELECT tr.permissions
                 FROM tenant_roles tr
                 WHERE tr.tenant_id = $1
                 AND tr.code = $2
                 AND tr.is_active = true`,
                [req.tenant.id, userRole]
            );

            let userPermissions = [];
            if (permissionResult.rows.length > 0) {
                userPermissions = permissionResult.rows[0].permissions || [];
            }

            // Check if user has all required permissions
            const hasAllPermissions = requiredPermissions.every(perm =>
                userPermissions.includes(perm) || userPermissions.includes('*')
            );

            if (!hasAllPermissions) {
                return res.status(403).json({
                    error: 'Insufficient permissions',
                    code: 'PERMISSION_DENIED',
                    requiredPermissions: requiredPermissions
                });
            }

            req.userPermissions = userPermissions;
            next();
        } catch (error) {
            console.error('Permission check error:', error);
            return res.status(500).json({
                error: 'Permission check failed',
                code: 'PERMISSION_CHECK_ERROR'
            });
        }
    };
}

/**
 * MFA verification middleware
 */
function requireMfa(req, res, next) {
    if (!req.user) {
        return res.status(401).json({
            error: 'Authentication required',
            code: 'NOT_AUTHENTICATED'
        });
    }

    // Check if tenant requires MFA
    if (req.tenant && req.tenant.isMfaRequired()) {
        if (!req.user.mfa_verified) {
            return res.status(403).json({
                error: 'MFA verification required',
                code: 'MFA_REQUIRED'
            });
        }
    }

    next();
}

/**
 * Admin-only middleware (tenant admin or system admin)
 */
function requireTenantAdmin(req, res, next) {
    if (!req.user) {
        return res.status(401).json({
            error: 'Authentication required',
            code: 'NOT_AUTHENTICATED'
        });
    }

    if (!req.user.is_tenant_admin && req.user.role !== 'admin') {
        return res.status(403).json({
            error: 'Tenant admin access required',
            code: 'NOT_TENANT_ADMIN'
        });
    }

    next();
}

/**
 * Optional authentication - doesn't fail if no token
 */
function optionalAuth() {
    return tenantAuthenticate({ required: false });
}

/**
 * Rate limiting per tenant
 */
const tenantRateLimits = new Map();

function tenantRateLimit(options = {}) {
    const {
        windowMs = 60000,  // 1 minute
        maxRequests = 100,
        keyGenerator = (req) => `${req.tenant?.id || 'anonymous'}-${req.ip}`,
        message = 'Too many requests, please try again later'
    } = options;

    return (req, res, next) => {
        const key = keyGenerator(req);
        const now = Date.now();

        let record = tenantRateLimits.get(key);

        if (!record || now - record.windowStart > windowMs) {
            record = { windowStart: now, count: 0 };
        }

        record.count++;
        tenantRateLimits.set(key, record);

        if (record.count > maxRequests) {
            return res.status(429).json({
                error: 'Rate limit exceeded',
                code: 'RATE_LIMIT_EXCEEDED',
                message: message,
                retryAfter: Math.ceil((record.windowStart + windowMs - now) / 1000)
            });
        }

        // Set rate limit headers
        res.setHeader('X-RateLimit-Limit', maxRequests);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - record.count));
        res.setHeader('X-RateLimit-Reset', Math.ceil((record.windowStart + windowMs) / 1000));

        next();
    };
}

/**
 * Validate password against tenant policy
 */
function validatePassword(password, policy) {
    const errors = [];

    if (password.length < (policy.min_length || 8)) {
        errors.push(`Password must be at least ${policy.min_length || 8} characters`);
    }

    if (policy.require_uppercase && !/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }

    if (policy.require_lowercase && !/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    }

    if (policy.require_numbers && !/\d/.test(password)) {
        errors.push('Password must contain at least one number');
    }

    if (policy.require_special && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        errors.push('Password must contain at least one special character');
    }

    return {
        valid: errors.length === 0,
        errors: errors
    };
}

/**
 * Hash password
 */
async function hashPassword(password) {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
}

/**
 * Compare password with hash
 */
async function comparePassword(password, hash) {
    return bcrypt.compare(password, hash);
}

module.exports = {
    // Token management
    generateToken,
    generateRefreshToken,
    verifyToken,
    verifyRefreshToken,
    createAuthTokens,

    // Session management
    generateSessionId,
    hashSessionToken,
    revokeSession,
    revokeAllUserSessions,

    // Middleware
    tenantAuthenticate,
    tenantAuthorize,
    requirePermission,
    requireMfa,
    requireTenantAdmin,
    optionalAuth,
    tenantRateLimit,

    // Password utilities
    validatePassword,
    hashPassword,
    comparePassword,

    // Constants
    JWT_EXPIRATION,
    JWT_REFRESH_EXPIRATION
};
