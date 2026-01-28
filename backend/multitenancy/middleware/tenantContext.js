/**
 * AUREONCARE MULTI-TENANT CONTEXT MIDDLEWARE
 *
 * This middleware handles:
 * - Tenant resolution from request (subdomain, header, JWT)
 * - Tenant context injection into request object
 * - Tenant isolation enforcement
 * - Feature flag checking
 * - Rate limiting per tenant
 */

const crypto = require('crypto');

// Tenant context cache (in production, use Redis)
const tenantCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Tenant Context Class
 * Encapsulates all tenant-related information for a request
 */
class TenantContext {
    constructor(tenant) {
        this.id = tenant.id;
        this.code = tenant.tenant_code;
        this.name = tenant.name;
        this.status = tenant.status;
        this.isolationLevel = tenant.isolation_level;
        this.schemaName = tenant.schema_name || 'public';
        this.databaseName = tenant.database_name;

        // Limits
        this.maxUsers = tenant.max_users;
        this.maxPatients = tenant.max_patients;
        this.maxProviders = tenant.max_providers;
        this.maxStorageGb = tenant.max_storage_gb;

        // Features
        this.features = tenant.features || {};

        // Security Settings
        this.securitySettings = tenant.security_settings || {};

        // Compliance Settings
        this.complianceSettings = tenant.compliance_settings || {};

        // Branding
        this.branding = tenant.branding || {};

        // Localization
        this.timezone = tenant.default_timezone;
        this.language = tenant.default_language;
        this.dateFormat = tenant.date_format;
        this.currency = tenant.currency;
    }

    /**
     * Check if a feature is enabled for this tenant
     */
    hasFeature(featureName) {
        return this.features[featureName] === true;
    }

    /**
     * Check if tenant is within a resource limit
     */
    checkLimit(resourceType, currentCount) {
        const limitMap = {
            users: this.maxUsers,
            patients: this.maxPatients,
            providers: this.maxProviders,
            storage: this.maxStorageGb
        };

        const limit = limitMap[resourceType];
        if (limit === -1) return true; // Unlimited
        return currentCount < limit;
    }

    /**
     * Get security setting value
     */
    getSecuritySetting(key, defaultValue = null) {
        return this.securitySettings[key] ?? defaultValue;
    }

    /**
     * Get compliance setting value
     */
    getComplianceSetting(key, defaultValue = null) {
        return this.complianceSettings[key] ?? defaultValue;
    }

    /**
     * Get password policy for this tenant
     */
    getPasswordPolicy() {
        return this.securitySettings.password_policy || {
            min_length: 8,
            require_uppercase: true,
            require_lowercase: true,
            require_numbers: true,
            require_special: true,
            max_age_days: 90,
            history_count: 5
        };
    }

    /**
     * Check if MFA is required for this tenant
     */
    isMfaRequired() {
        return this.securitySettings.mfa_required === true;
    }

    /**
     * Check if IP is whitelisted (if whitelist is configured)
     */
    isIpAllowed(ipAddress) {
        const whitelist = this.securitySettings.ip_whitelist || [];
        if (whitelist.length === 0) return true; // No whitelist = all allowed
        return whitelist.includes(ipAddress);
    }

    /**
     * Serialize for logging (excludes sensitive data)
     */
    toSafeObject() {
        return {
            id: this.id,
            code: this.code,
            name: this.name,
            status: this.status,
            isolationLevel: this.isolationLevel
        };
    }
}

/**
 * Get tenant from database by ID
 */
async function getTenantById(pool, tenantId) {
    const cacheKey = `tenant:id:${tenantId}`;
    const cached = tenantCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }

    const result = await pool.query(
        `SELECT * FROM tenants
         WHERE id = $1
         AND deleted_at IS NULL`,
        [tenantId]
    );

    if (result.rows.length === 0) {
        return null;
    }

    const tenant = result.rows[0];
    tenantCache.set(cacheKey, { data: tenant, timestamp: Date.now() });

    return tenant;
}

/**
 * Get tenant from database by subdomain
 */
async function getTenantBySubdomain(pool, subdomain) {
    const cacheKey = `tenant:subdomain:${subdomain}`;
    const cached = tenantCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }

    const result = await pool.query(
        `SELECT * FROM tenants
         WHERE subdomain = $1
         AND deleted_at IS NULL`,
        [subdomain.toLowerCase()]
    );

    if (result.rows.length === 0) {
        return null;
    }

    const tenant = result.rows[0];
    tenantCache.set(cacheKey, { data: tenant, timestamp: Date.now() });

    // Also cache by ID for faster lookups
    tenantCache.set(`tenant:id:${tenant.id}`, { data: tenant, timestamp: Date.now() });

    return tenant;
}

/**
 * Get tenant from database by custom domain
 */
async function getTenantByDomain(pool, domain) {
    const cacheKey = `tenant:domain:${domain}`;
    const cached = tenantCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }

    const result = await pool.query(
        `SELECT * FROM tenants
         WHERE custom_domain = $1
         AND deleted_at IS NULL`,
        [domain.toLowerCase()]
    );

    if (result.rows.length === 0) {
        return null;
    }

    const tenant = result.rows[0];
    tenantCache.set(cacheKey, { data: tenant, timestamp: Date.now() });

    return tenant;
}

/**
 * Get tenant from database by tenant code
 */
async function getTenantByCode(pool, code) {
    const cacheKey = `tenant:code:${code}`;
    const cached = tenantCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }

    const result = await pool.query(
        `SELECT * FROM tenants
         WHERE tenant_code = $1
         AND deleted_at IS NULL`,
        [code.toLowerCase()]
    );

    if (result.rows.length === 0) {
        return null;
    }

    const tenant = result.rows[0];
    tenantCache.set(cacheKey, { data: tenant, timestamp: Date.now() });

    return tenant;
}

/**
 * Extract subdomain from hostname
 */
function extractSubdomain(hostname, baseDomain) {
    if (!hostname) return null;

    // Remove port if present
    const host = hostname.split(':')[0];

    // Check if it's an IP address or localhost
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host) || host === 'localhost') {
        return null;
    }

    // Extract subdomain
    const parts = host.split('.');
    const baseparts = baseDomain.split('.');

    if (parts.length > baseparts.length) {
        return parts.slice(0, parts.length - baseparts.length).join('.');
    }

    return null;
}

/**
 * Resolve tenant from request
 * Priority: 1. JWT token 2. X-Tenant-ID header 3. Subdomain 4. Custom domain
 */
async function resolveTenant(req, pool) {
    // 1. Check JWT token for tenant ID (set by authentication middleware)
    if (req.tenantIdFromToken) {
        return await getTenantById(pool, req.tenantIdFromToken);
    }

    // 2. Check X-Tenant-ID header (for API clients)
    const headerTenantId = req.headers['x-tenant-id'];
    if (headerTenantId) {
        return await getTenantById(pool, headerTenantId);
    }

    // 3. Check X-Tenant-Code header (alternative to ID)
    const headerTenantCode = req.headers['x-tenant-code'];
    if (headerTenantCode) {
        return await getTenantByCode(pool, headerTenantCode);
    }

    // 4. Extract from subdomain
    const baseDomain = process.env.BASE_DOMAIN || 'aureoncare.com';
    const subdomain = extractSubdomain(req.hostname, baseDomain);
    if (subdomain && subdomain !== 'www' && subdomain !== 'api') {
        return await getTenantBySubdomain(pool, subdomain);
    }

    // 5. Check custom domain
    const customDomain = req.hostname;
    if (customDomain && !customDomain.endsWith(baseDomain)) {
        return await getTenantByDomain(pool, customDomain);
    }

    return null;
}

/**
 * Main tenant context middleware
 * Resolves tenant and attaches context to request
 */
function tenantContextMiddleware(options = {}) {
    const {
        required = true,  // Whether tenant context is required
        allowedStatuses = ['active'],  // Allowed tenant statuses
        checkIpWhitelist = true  // Whether to enforce IP whitelist
    } = options;

    return async (req, res, next) => {
        try {
            const pool = req.app.locals.pool;

            // Skip tenant resolution for certain paths
            const skipPaths = [
                '/api/health',
                '/api/tenant-admin',  // Central admin routes
                '/api/public'
            ];

            if (skipPaths.some(path => req.path.startsWith(path))) {
                return next();
            }

            // Resolve tenant
            const tenant = await resolveTenant(req, pool);

            if (!tenant) {
                if (required) {
                    return res.status(400).json({
                        error: 'Tenant not found',
                        code: 'TENANT_NOT_FOUND',
                        message: 'Unable to identify tenant from request'
                    });
                }
                return next();
            }

            // Check tenant status
            if (!allowedStatuses.includes(tenant.status)) {
                return res.status(403).json({
                    error: 'Tenant not accessible',
                    code: 'TENANT_INACTIVE',
                    message: `Tenant is currently ${tenant.status}`
                });
            }

            // Create tenant context
            const context = new TenantContext(tenant);

            // Check IP whitelist if enabled
            if (checkIpWhitelist) {
                const clientIp = req.ip || req.connection.remoteAddress;
                if (!context.isIpAllowed(clientIp)) {
                    return res.status(403).json({
                        error: 'Access denied',
                        code: 'IP_NOT_WHITELISTED',
                        message: 'Your IP address is not authorized'
                    });
                }
            }

            // Attach context to request
            req.tenant = context;
            req.tenantId = context.id;

            // Set response headers
            res.setHeader('X-Tenant-ID', context.id);
            res.setHeader('X-Tenant-Code', context.code);

            next();
        } catch (error) {
            console.error('Tenant context middleware error:', error);
            return res.status(500).json({
                error: 'Internal server error',
                code: 'TENANT_RESOLUTION_ERROR',
                message: 'Failed to resolve tenant context'
            });
        }
    };
}

/**
 * Middleware to require specific tenant features
 */
function requireTenantFeature(...features) {
    return (req, res, next) => {
        if (!req.tenant) {
            return res.status(400).json({
                error: 'Tenant context required',
                code: 'NO_TENANT_CONTEXT'
            });
        }

        for (const feature of features) {
            if (!req.tenant.hasFeature(feature)) {
                return res.status(403).json({
                    error: 'Feature not available',
                    code: 'FEATURE_NOT_ENABLED',
                    message: `The '${feature}' feature is not enabled for your plan`,
                    feature: feature
                });
            }
        }

        next();
    };
}

/**
 * Middleware to check tenant resource limits
 */
function checkTenantLimit(resourceType, getCurrentCount) {
    return async (req, res, next) => {
        if (!req.tenant) {
            return res.status(400).json({
                error: 'Tenant context required',
                code: 'NO_TENANT_CONTEXT'
            });
        }

        try {
            const currentCount = await getCurrentCount(req);

            if (!req.tenant.checkLimit(resourceType, currentCount)) {
                return res.status(403).json({
                    error: 'Limit exceeded',
                    code: 'TENANT_LIMIT_EXCEEDED',
                    message: `You have reached the maximum number of ${resourceType} for your plan`,
                    resourceType: resourceType,
                    currentCount: currentCount
                });
            }

            next();
        } catch (error) {
            console.error('Check tenant limit error:', error);
            next(error);
        }
    };
}

/**
 * Middleware to enforce tenant data isolation
 * Ensures queries only access data belonging to the tenant
 */
function enforceTenantIsolation(req, res, next) {
    if (!req.tenant) {
        return res.status(400).json({
            error: 'Tenant context required',
            code: 'NO_TENANT_CONTEXT'
        });
    }

    // Add tenant filter helper to request
    req.tenantFilter = {
        // Get SQL WHERE clause for tenant filtering
        getWhereClause: (tableAlias = null) => {
            const prefix = tableAlias ? `${tableAlias}.` : '';
            return `${prefix}tenant_id = '${req.tenant.id}'`;
        },

        // Get tenant ID for inserts
        getTenantId: () => req.tenant.id,

        // Validate that a record belongs to the tenant
        validateOwnership: async (pool, tableName, recordId) => {
            const result = await pool.query(
                `SELECT id FROM ${tableName} WHERE id = $1 AND tenant_id = $2`,
                [recordId, req.tenant.id]
            );
            return result.rows.length > 0;
        }
    };

    next();
}

/**
 * Clear tenant cache (for admin operations)
 */
function clearTenantCache(tenantId = null) {
    if (tenantId) {
        // Clear specific tenant
        for (const [key] of tenantCache) {
            if (key.includes(tenantId)) {
                tenantCache.delete(key);
            }
        }
    } else {
        // Clear all
        tenantCache.clear();
    }
}

/**
 * Generate unique request ID for tracing
 */
function generateRequestId() {
    return `req_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * Request context middleware
 * Adds request ID and timing
 */
function requestContextMiddleware(req, res, next) {
    req.requestId = req.headers['x-request-id'] || generateRequestId();
    req.requestStartTime = Date.now();

    res.setHeader('X-Request-ID', req.requestId);

    // Log request completion
    res.on('finish', () => {
        const duration = Date.now() - req.requestStartTime;
        if (process.env.NODE_ENV !== 'test') {
            console.log(JSON.stringify({
                type: 'request',
                requestId: req.requestId,
                method: req.method,
                path: req.path,
                tenantId: req.tenantId,
                userId: req.user?.id,
                statusCode: res.statusCode,
                durationMs: duration,
                timestamp: new Date().toISOString()
            }));
        }
    });

    next();
}

module.exports = {
    TenantContext,
    tenantContextMiddleware,
    requireTenantFeature,
    checkTenantLimit,
    enforceTenantIsolation,
    clearTenantCache,
    requestContextMiddleware,
    getTenantById,
    getTenantBySubdomain,
    getTenantByCode,
    getTenantByDomain
};
