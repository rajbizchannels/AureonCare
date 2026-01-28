/**
 * AUREONCARE MULTI-TENANT SERVER INTEGRATION
 *
 * This file provides instructions and utilities for integrating
 * the multi-tenant system with the existing Express server.
 */

const {
    initializeMultiTenancy,
    tenantContextMiddleware,
    tenantAuthenticate,
    auditMiddleware,
    tenantRateLimit,
    requestContextMiddleware
} = require('./index');

/**
 * Initialize multi-tenancy on an Express application
 *
 * @example
 * // In server.js:
 * const { setupMultiTenancy } = require('./multitenancy/serverIntegration');
 * setupMultiTenancy(app, pool);
 */
function setupMultiTenancy(app, pool) {
    // Initialize services and routes
    const services = initializeMultiTenancy(app, pool);

    // Return services for use elsewhere
    return services;
}

/**
 * Create middleware stack for tenant-protected routes
 * Use this to wrap existing routes that need tenant isolation
 */
function createTenantProtectedMiddleware(options = {}) {
    return [
        requestContextMiddleware,
        tenantContextMiddleware({ required: true }),
        tenantAuthenticate({ required: true }),
        tenantRateLimit({
            windowMs: 60000,
            maxRequests: options.rateLimit || 100
        })
    ];
}

/**
 * Example of how to modify existing routes for multi-tenant support
 *
 * BEFORE:
 * router.get('/', async (req, res) => {
 *     const result = await pool.query('SELECT * FROM patients');
 *     res.json(result.rows);
 * });
 *
 * AFTER:
 * router.get('/', async (req, res) => {
 *     const result = await pool.query(
 *         'SELECT * FROM patients WHERE tenant_id = $1',
 *         [req.tenant.id]
 *     );
 *     res.json(result.rows);
 * });
 *
 * Or using the tenant database utility:
 * const { createTenantDb } = require('../multitenancy/utils/tenantDb');
 *
 * router.get('/', async (req, res) => {
 *     const tenantDb = createTenantDb(req);
 *     const patients = await tenantDb.find('patients');
 *     res.json(patients);
 * });
 */

/**
 * Server integration instructions
 */
const INTEGRATION_GUIDE = `
================================================================================
AUREONCARE MULTI-TENANT INTEGRATION GUIDE
================================================================================

1. DATABASE SETUP
-----------------
Run the migration scripts in order:
   psql -d aureoncare -f backend/multitenancy/migrations/001_tenant_management_schema.sql
   psql -d aureoncare -f backend/multitenancy/migrations/002_add_tenant_columns.sql

2. SERVER.JS INTEGRATION
------------------------
Add the following to your server.js file:

// Import multi-tenancy module
const { setupMultiTenancy } = require('./multitenancy/serverIntegration');

// After creating pool and before routes
const { auditService, billingService, tenantService } = setupMultiTenancy(app, pool);

3. ROUTE MODIFICATION
---------------------
For each existing route file, add tenant filtering:

// Add to route imports
const { tenantContextMiddleware, tenantAuthenticate } = require('../multitenancy');

// Apply middleware to router
router.use(tenantContextMiddleware({ required: true }));
router.use(tenantAuthenticate({ required: true }));

// Modify queries to include tenant_id
// OLD: SELECT * FROM patients
// NEW: SELECT * FROM patients WHERE tenant_id = $1

4. FRONTEND INTEGRATION
-----------------------
Add TenantProvider to App.js:

import { TenantProvider } from './context/TenantContext';

function App() {
    return (
        <TenantProvider>
            {/* existing app content */}
        </TenantProvider>
    );
}

5. AUTHENTICATION UPDATE
------------------------
Update login to return tenant context in JWT:

// In auth routes, after successful login:
const token = generateToken({
    userId: user.id,
    email: user.email,
    tenantId: tenant.id,
    tenantCode: tenant.tenant_code,
    role: user.role
});

6. API HEADERS
--------------
Frontend should include tenant header:
- X-Tenant-ID: <tenant-id>
- Authorization: Bearer <token>

Or use subdomain-based tenant resolution.

================================================================================
`;

/**
 * Print integration guide
 */
function printIntegrationGuide() {
    console.log(INTEGRATION_GUIDE);
}

/**
 * Run database migrations
 */
async function runMigrations(pool) {
    const fs = require('fs');
    const path = require('path');

    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();

    console.log('Running multi-tenant migrations...');

    for (const file of files) {
        console.log(`  Running ${file}...`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

        try {
            await pool.query(sql);
            console.log(`  ✓ ${file} completed`);
        } catch (error) {
            console.error(`  ✗ ${file} failed:`, error.message);
            throw error;
        }
    }

    console.log('Migrations completed successfully!');
}

/**
 * Health check for multi-tenant setup
 */
async function checkMultiTenantHealth(pool) {
    const checks = [];

    // Check tenants table exists
    try {
        await pool.query('SELECT COUNT(*) FROM tenants');
        checks.push({ name: 'tenants_table', status: 'ok' });
    } catch (e) {
        checks.push({ name: 'tenants_table', status: 'error', message: e.message });
    }

    // Check tenant_subscriptions table exists
    try {
        await pool.query('SELECT COUNT(*) FROM tenant_subscriptions');
        checks.push({ name: 'subscriptions_table', status: 'ok' });
    } catch (e) {
        checks.push({ name: 'subscriptions_table', status: 'error', message: e.message });
    }

    // Check tenant_audit_logs table exists
    try {
        await pool.query('SELECT COUNT(*) FROM tenant_audit_logs');
        checks.push({ name: 'audit_logs_table', status: 'ok' });
    } catch (e) {
        checks.push({ name: 'audit_logs_table', status: 'error', message: e.message });
    }

    // Check default tenant exists
    try {
        const result = await pool.query(
            "SELECT * FROM tenants WHERE tenant_code = 'default'"
        );
        if (result.rows.length > 0) {
            checks.push({ name: 'default_tenant', status: 'ok' });
        } else {
            checks.push({ name: 'default_tenant', status: 'warning', message: 'No default tenant found' });
        }
    } catch (e) {
        checks.push({ name: 'default_tenant', status: 'error', message: e.message });
    }

    // Check patients table has tenant_id
    try {
        await pool.query('SELECT tenant_id FROM patients LIMIT 1');
        checks.push({ name: 'patients_tenant_column', status: 'ok' });
    } catch (e) {
        checks.push({ name: 'patients_tenant_column', status: 'error', message: 'tenant_id column missing' });
    }

    return {
        healthy: checks.every(c => c.status === 'ok'),
        checks
    };
}

/**
 * Create a new tenant programmatically
 */
async function createTenantProgrammatically(pool, tenantData, adminEmail, adminPassword) {
    const bcrypt = require('bcryptjs');
    const { createTenantService } = require('./services/tenantService');
    const { createBillingService } = require('./services/billingService');
    const { createAuditService } = require('./services/auditService');

    const auditService = createAuditService(pool);
    const billingService = createBillingService(pool);
    const tenantService = createTenantService(pool, billingService, auditService);

    // Create tenant
    const tenant = await tenantService.createTenant(tenantData);

    // Create initial admin user
    const passwordHash = await bcrypt.hash(adminPassword, 12);

    const userResult = await pool.query(`
        INSERT INTO users (email, password_hash, first_name, last_name, role, status)
        VALUES ($1, $2, $3, $4, 'admin', 'active')
        RETURNING *
    `, [adminEmail, passwordHash, tenantData.adminFirstName || 'Admin', tenantData.adminLastName || 'User']);

    const user = userResult.rows[0];

    // Add user to tenant as admin
    await tenantService.addUserToTenant(tenant.id, user.id, {
        isTenantAdmin: true,
        tenantRoles: ['admin']
    });

    return { tenant, user };
}

module.exports = {
    setupMultiTenancy,
    createTenantProtectedMiddleware,
    printIntegrationGuide,
    runMigrations,
    checkMultiTenantHealth,
    createTenantProgrammatically,
    INTEGRATION_GUIDE
};
