/**
 * AUREONCARE MULTI-TENANT MODULE
 *
 * Main entry point for the multi-tenancy system
 * Exports all services, middleware, and utilities
 */

// Middleware
const {
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
} = require('./middleware/tenantContext');

const {
    generateToken,
    generateRefreshToken,
    verifyToken,
    verifyRefreshToken,
    createAuthTokens,
    generateSessionId,
    hashSessionToken,
    revokeSession,
    revokeAllUserSessions,
    tenantAuthenticate,
    tenantAuthorize,
    requirePermission,
    requireMfa,
    requireTenantAdmin,
    optionalAuth,
    tenantRateLimit,
    validatePassword,
    hashPassword,
    comparePassword,
    JWT_EXPIRATION,
    JWT_REFRESH_EXPIRATION
} = require('./middleware/tenantAuth');

// Services
const {
    AuditService,
    createAuditService,
    auditMiddleware,
    AuditAction,
    AuditSeverity,
    SecurityEventType,
    ResourceType
} = require('./services/auditService');

const {
    BillingService,
    createBillingService,
    SubscriptionStatus,
    InvoiceStatus
} = require('./services/billingService');

const {
    TenantService,
    createTenantService
} = require('./services/tenantService');

// Utilities
const {
    TenantDatabase,
    TenantQueryBuilder,
    createTenantDb,
    createQueryBuilder,
    attachTenantDb,
    addTenantColumn,
    createRLSPolicies,
    setCurrentTenant
} = require('./utils/tenantDb');

// Routes
const tenantAdminRoutes = require('./routes/tenantAdmin');
const tenantRoutes = require('./routes/tenant');

/**
 * Initialize the multi-tenant system
 *
 * @param {Express} app - Express application
 * @param {Pool} pool - PostgreSQL connection pool
 * @returns {Object} Initialized services
 */
function initializeMultiTenancy(app, pool) {
    // Create services
    const auditService = createAuditService(pool);
    const billingService = createBillingService(pool);
    const tenantService = createTenantService(pool, billingService, auditService);

    // Attach services to app.locals for access in routes
    app.locals.auditService = auditService;
    app.locals.billingService = billingService;
    app.locals.tenantService = tenantService;

    // Apply global middleware
    app.use(requestContextMiddleware);

    // Mount routes
    // Central admin routes (no tenant context required)
    app.use('/api/tenant-admin', tenantAdminRoutes);

    // Tenant-specific routes (requires tenant context)
    app.use('/api/tenant',
        tenantContextMiddleware({ required: true }),
        tenantRoutes
    );

    console.log('Multi-tenancy system initialized');

    return {
        auditService,
        billingService,
        tenantService
    };
}

/**
 * Create tenant context middleware with custom options
 */
function createTenantMiddleware(options = {}) {
    return [
        requestContextMiddleware,
        tenantContextMiddleware(options),
        attachTenantDb
    ];
}

/**
 * Middleware stack for protected tenant routes
 */
function protectedTenantRoute(options = {}) {
    const { roles, permissions, features } = options;

    const middleware = [
        tenantContextMiddleware({ required: true }),
        tenantAuthenticate({ required: true }),
        enforceTenantIsolation,
        attachTenantDb
    ];

    if (roles && roles.length > 0) {
        middleware.push(tenantAuthorize(...roles));
    }

    if (permissions && permissions.length > 0) {
        middleware.push(requirePermission(...permissions));
    }

    if (features && features.length > 0) {
        middleware.push(requireTenantFeature(...features));
    }

    return middleware;
}

module.exports = {
    // Initialization
    initializeMultiTenancy,
    createTenantMiddleware,
    protectedTenantRoute,

    // Middleware
    TenantContext,
    tenantContextMiddleware,
    requireTenantFeature,
    checkTenantLimit,
    enforceTenantIsolation,
    clearTenantCache,
    requestContextMiddleware,

    // Authentication
    generateToken,
    generateRefreshToken,
    verifyToken,
    verifyRefreshToken,
    createAuthTokens,
    generateSessionId,
    hashSessionToken,
    revokeSession,
    revokeAllUserSessions,
    tenantAuthenticate,
    tenantAuthorize,
    requirePermission,
    requireMfa,
    requireTenantAdmin,
    optionalAuth,
    tenantRateLimit,
    validatePassword,
    hashPassword,
    comparePassword,

    // Tenant Resolution
    getTenantById,
    getTenantBySubdomain,
    getTenantByCode,
    getTenantByDomain,

    // Services
    AuditService,
    createAuditService,
    auditMiddleware,
    BillingService,
    createBillingService,
    TenantService,
    createTenantService,

    // Database Utilities
    TenantDatabase,
    TenantQueryBuilder,
    createTenantDb,
    createQueryBuilder,
    attachTenantDb,
    addTenantColumn,
    createRLSPolicies,
    setCurrentTenant,

    // Routes
    tenantAdminRoutes,
    tenantRoutes,

    // Constants
    AuditAction,
    AuditSeverity,
    SecurityEventType,
    ResourceType,
    SubscriptionStatus,
    InvoiceStatus,
    JWT_EXPIRATION,
    JWT_REFRESH_EXPIRATION
};
