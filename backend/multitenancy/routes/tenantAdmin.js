/**
 * AUREONCARE TENANT ADMIN API ROUTES
 *
 * Central administration routes for managing tenants
 * These routes are for platform administrators, not tenant users
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

// =========================================================================
// MIDDLEWARE
// =========================================================================

/**
 * Authenticate tenant administrator
 */
async function authenticateTenantAdmin(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const token = authHeader.split(' ')[1];

        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (err) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        if (decoded.type !== 'tenant_admin') {
            return res.status(403).json({ error: 'Invalid token type' });
        }

        const pool = req.app.locals.pool;
        const result = await pool.query(
            'SELECT * FROM tenant_administrators WHERE id = $1 AND status = $2',
            [decoded.adminId, 'active']
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Administrator not found' });
        }

        req.admin = result.rows[0];
        next();
    } catch (error) {
        console.error('Auth error:', error);
        res.status(500).json({ error: 'Authentication failed' });
    }
}

/**
 * Require super admin role
 */
function requireSuperAdmin(req, res, next) {
    if (req.admin.role !== 'super_admin') {
        return res.status(403).json({ error: 'Super admin access required' });
    }
    next();
}

// =========================================================================
// ADMIN AUTHENTICATION
// =========================================================================

/**
 * Admin login
 */
router.post('/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const pool = req.app.locals.pool;

        // Find admin
        const result = await pool.query(
            'SELECT * FROM tenant_administrators WHERE email = $1',
            [email.toLowerCase()]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const admin = result.rows[0];

        // Check if locked
        if (admin.locked_until && new Date(admin.locked_until) > new Date()) {
            return res.status(423).json({
                error: 'Account locked',
                lockedUntil: admin.locked_until
            });
        }

        // Verify password
        const validPassword = await bcrypt.compare(password, admin.password_hash);

        if (!validPassword) {
            // Increment failed attempts
            await pool.query(`
                UPDATE tenant_administrators
                SET failed_login_attempts = failed_login_attempts + 1,
                    locked_until = CASE
                        WHEN failed_login_attempts >= 4 THEN NOW() + INTERVAL '30 minutes'
                        ELSE NULL
                    END
                WHERE id = $1
            `, [admin.id]);

            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check MFA if enabled
        if (admin.mfa_enabled) {
            // Return MFA required response
            const mfaToken = jwt.sign(
                { adminId: admin.id, type: 'mfa_pending' },
                JWT_SECRET,
                { expiresIn: '5m' }
            );

            return res.json({
                mfaRequired: true,
                mfaToken,
                mfaMethods: ['totp']
            });
        }

        // Generate token
        const token = jwt.sign(
            {
                adminId: admin.id,
                email: admin.email,
                role: admin.role,
                type: 'tenant_admin'
            },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        // Update login info
        await pool.query(`
            UPDATE tenant_administrators
            SET last_login_at = NOW(), last_login_ip = $2, failed_login_attempts = 0
            WHERE id = $1
        `, [admin.id, req.ip]);

        res.json({
            token,
            admin: {
                id: admin.id,
                email: admin.email,
                firstName: admin.first_name,
                lastName: admin.last_name,
                role: admin.role
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

/**
 * Get current admin
 */
router.get('/auth/me', authenticateTenantAdmin, (req, res) => {
    res.json({
        id: req.admin.id,
        email: req.admin.email,
        firstName: req.admin.first_name,
        lastName: req.admin.last_name,
        role: req.admin.role
    });
});

// =========================================================================
// TENANT MANAGEMENT
// =========================================================================

/**
 * List all tenants
 */
router.get('/tenants', authenticateTenantAdmin, async (req, res) => {
    try {
        const { status, search, limit = 50, offset = 0 } = req.query;
        const tenantService = req.app.locals.tenantService;

        const result = await tenantService.getTenants({
            status,
            search,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json(result);
    } catch (error) {
        console.error('Get tenants error:', error);
        res.status(500).json({ error: 'Failed to get tenants' });
    }
});

/**
 * Get tenant by ID
 */
router.get('/tenants/:id', authenticateTenantAdmin, async (req, res) => {
    try {
        const tenantService = req.app.locals.tenantService;
        const tenant = await tenantService.getTenant(req.params.id);

        if (!tenant) {
            return res.status(404).json({ error: 'Tenant not found' });
        }

        res.json(tenant);
    } catch (error) {
        console.error('Get tenant error:', error);
        res.status(500).json({ error: 'Failed to get tenant' });
    }
});

/**
 * Create new tenant
 */
router.post('/tenants', authenticateTenantAdmin, async (req, res) => {
    try {
        const tenantService = req.app.locals.tenantService;
        const tenant = await tenantService.createTenant(req.body, req.admin.id);

        res.status(201).json(tenant);
    } catch (error) {
        console.error('Create tenant error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * Update tenant
 */
router.put('/tenants/:id', authenticateTenantAdmin, async (req, res) => {
    try {
        const tenantService = req.app.locals.tenantService;
        const tenant = await tenantService.updateTenant(
            req.params.id,
            req.body,
            req.admin.id
        );

        if (!tenant) {
            return res.status(404).json({ error: 'Tenant not found' });
        }

        res.json(tenant);
    } catch (error) {
        console.error('Update tenant error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * Suspend tenant
 */
router.post('/tenants/:id/suspend', authenticateTenantAdmin, async (req, res) => {
    try {
        const { reason } = req.body;
        const tenantService = req.app.locals.tenantService;

        await tenantService.suspendTenant(req.params.id, reason, req.admin.id);

        res.json({ message: 'Tenant suspended' });
    } catch (error) {
        console.error('Suspend tenant error:', error);
        res.status(500).json({ error: 'Failed to suspend tenant' });
    }
});

/**
 * Reactivate tenant
 */
router.post('/tenants/:id/reactivate', authenticateTenantAdmin, async (req, res) => {
    try {
        const tenantService = req.app.locals.tenantService;

        await tenantService.reactivateTenant(req.params.id, req.admin.id);

        res.json({ message: 'Tenant reactivated' });
    } catch (error) {
        console.error('Reactivate tenant error:', error);
        res.status(500).json({ error: 'Failed to reactivate tenant' });
    }
});

/**
 * Terminate tenant
 */
router.post('/tenants/:id/terminate', authenticateTenantAdmin, requireSuperAdmin, async (req, res) => {
    try {
        const { reason } = req.body;
        const tenantService = req.app.locals.tenantService;

        await tenantService.terminateTenant(req.params.id, reason, req.admin.id);

        res.json({ message: 'Tenant terminated' });
    } catch (error) {
        console.error('Terminate tenant error:', error);
        res.status(500).json({ error: 'Failed to terminate tenant' });
    }
});

/**
 * Get tenant statistics
 */
router.get('/tenants/:id/statistics', authenticateTenantAdmin, async (req, res) => {
    try {
        const tenantService = req.app.locals.tenantService;
        const stats = await tenantService.getStatistics(req.params.id);

        res.json(stats);
    } catch (error) {
        console.error('Get statistics error:', error);
        res.status(500).json({ error: 'Failed to get statistics' });
    }
});

/**
 * Get tenant users
 */
router.get('/tenants/:id/users', authenticateTenantAdmin, async (req, res) => {
    try {
        const { role, status, limit = 50, offset = 0 } = req.query;
        const tenantService = req.app.locals.tenantService;

        const users = await tenantService.getTenantUsers(req.params.id, {
            role,
            status,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json(users);
    } catch (error) {
        console.error('Get tenant users error:', error);
        res.status(500).json({ error: 'Failed to get users' });
    }
});

// =========================================================================
// SUBSCRIPTION MANAGEMENT
// =========================================================================

/**
 * Get subscription plans
 */
router.get('/plans', authenticateTenantAdmin, async (req, res) => {
    try {
        const billingService = req.app.locals.billingService;
        const plans = await billingService.getPlans(true);

        res.json(plans);
    } catch (error) {
        console.error('Get plans error:', error);
        res.status(500).json({ error: 'Failed to get plans' });
    }
});

/**
 * Create subscription plan
 */
router.post('/plans', authenticateTenantAdmin, requireSuperAdmin, async (req, res) => {
    try {
        const billingService = req.app.locals.billingService;
        const plan = await billingService.createPlan(req.body);

        res.status(201).json(plan);
    } catch (error) {
        console.error('Create plan error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * Get tenant subscription
 */
router.get('/tenants/:id/subscription', authenticateTenantAdmin, async (req, res) => {
    try {
        const billingService = req.app.locals.billingService;
        const subscription = await billingService.getSubscription(req.params.id);

        res.json(subscription);
    } catch (error) {
        console.error('Get subscription error:', error);
        res.status(500).json({ error: 'Failed to get subscription' });
    }
});

/**
 * Change tenant plan
 */
router.post('/tenants/:id/subscription/change-plan', authenticateTenantAdmin, async (req, res) => {
    try {
        const { planCode, immediate = true } = req.body;
        const billingService = req.app.locals.billingService;

        const subscription = await billingService.changePlan(req.params.id, planCode, immediate);

        res.json(subscription);
    } catch (error) {
        console.error('Change plan error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * Get tenant invoices
 */
router.get('/tenants/:id/invoices', authenticateTenantAdmin, async (req, res) => {
    try {
        const { status, limit = 20, offset = 0 } = req.query;
        const billingService = req.app.locals.billingService;

        const invoices = await billingService.getInvoices(req.params.id, {
            status,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json(invoices);
    } catch (error) {
        console.error('Get invoices error:', error);
        res.status(500).json({ error: 'Failed to get invoices' });
    }
});

/**
 * Generate invoice
 */
router.post('/tenants/:id/invoices', authenticateTenantAdmin, async (req, res) => {
    try {
        const billingService = req.app.locals.billingService;
        const invoice = await billingService.generateInvoice(req.params.id, req.body);

        res.status(201).json(invoice);
    } catch (error) {
        console.error('Generate invoice error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * Get tenant usage
 */
router.get('/tenants/:id/usage', authenticateTenantAdmin, async (req, res) => {
    try {
        const { startDate, endDate, groupBy = 'day' } = req.query;
        const billingService = req.app.locals.billingService;

        const usage = await billingService.getUsageHistory(req.params.id, {
            startDate,
            endDate,
            groupBy
        });

        res.json(usage);
    } catch (error) {
        console.error('Get usage error:', error);
        res.status(500).json({ error: 'Failed to get usage' });
    }
});

// =========================================================================
// AUDIT AND COMPLIANCE
// =========================================================================

/**
 * Get audit logs for a tenant
 */
router.get('/tenants/:id/audit-logs', authenticateTenantAdmin, async (req, res) => {
    try {
        const {
            userId, action, resourceType, startDate, endDate,
            severity, isPhiAccess, limit = 100, offset = 0
        } = req.query;

        const auditService = req.app.locals.auditService;

        const result = await auditService.queryLogs({
            tenantId: req.params.id,
            userId,
            action,
            resourceType,
            startDate,
            endDate,
            severity,
            isPhiAccess: isPhiAccess === 'true',
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json(result);
    } catch (error) {
        console.error('Get audit logs error:', error);
        res.status(500).json({ error: 'Failed to get audit logs' });
    }
});

/**
 * Get security events for a tenant
 */
router.get('/tenants/:id/security-events', authenticateTenantAdmin, async (req, res) => {
    try {
        const { eventType, severity, status, limit = 50, offset = 0 } = req.query;
        const pool = req.app.locals.pool;

        let query = `
            SELECT * FROM tenant_security_events
            WHERE tenant_id = $1
        `;
        const params = [req.params.id];

        if (eventType) {
            params.push(eventType);
            query += ` AND event_type = $${params.length}`;
        }

        if (severity) {
            params.push(severity);
            query += ` AND severity = $${params.length}`;
        }

        if (status) {
            params.push(status);
            query += ` AND status = $${params.length}`;
        }

        query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);

        res.json(result.rows);
    } catch (error) {
        console.error('Get security events error:', error);
        res.status(500).json({ error: 'Failed to get security events' });
    }
});

/**
 * Generate compliance report
 */
router.post('/tenants/:id/compliance-reports', authenticateTenantAdmin, async (req, res) => {
    try {
        const { reportType, periodStart, periodEnd } = req.body;
        const auditService = req.app.locals.auditService;

        const report = await auditService.generateComplianceReport(
            req.params.id,
            reportType,
            periodStart,
            periodEnd,
            req.admin.id
        );

        res.status(201).json(report);
    } catch (error) {
        console.error('Generate report error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * Get compliance reports
 */
router.get('/tenants/:id/compliance-reports', authenticateTenantAdmin, async (req, res) => {
    try {
        const { reportType, limit = 20, offset = 0 } = req.query;
        const pool = req.app.locals.pool;

        let query = `
            SELECT * FROM tenant_compliance_reports
            WHERE tenant_id = $1
        `;
        const params = [req.params.id];

        if (reportType) {
            params.push(reportType);
            query += ` AND report_type = $${params.length}`;
        }

        query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);

        res.json(result.rows);
    } catch (error) {
        console.error('Get reports error:', error);
        res.status(500).json({ error: 'Failed to get reports' });
    }
});

// =========================================================================
// PLATFORM STATISTICS
// =========================================================================

/**
 * Get platform-wide statistics
 */
router.get('/statistics', authenticateTenantAdmin, async (req, res) => {
    try {
        const pool = req.app.locals.pool;

        const [tenants, users, activeSubscriptions, revenue] = await Promise.all([
            pool.query(`
                SELECT
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE status = 'active') as active,
                    COUNT(*) FILTER (WHERE status = 'suspended') as suspended,
                    COUNT(*) FILTER (WHERE status = 'trial') as trial
                FROM tenants WHERE deleted_at IS NULL
            `),
            pool.query(`
                SELECT COUNT(DISTINCT user_id) as total FROM tenant_users
            `),
            pool.query(`
                SELECT
                    tsp.name as plan_name,
                    COUNT(*) as count
                FROM tenant_subscriptions ts
                JOIN tenant_subscription_plans tsp ON ts.plan_id = tsp.id
                WHERE ts.status IN ('active', 'trial')
                GROUP BY tsp.name
                ORDER BY count DESC
            `),
            pool.query(`
                SELECT
                    COALESCE(SUM(amount_paid), 0) as total_revenue,
                    COUNT(*) as total_invoices
                FROM tenant_invoices
                WHERE status = 'paid'
                AND paid_date >= DATE_TRUNC('month', CURRENT_DATE)
            `)
        ]);

        res.json({
            tenants: tenants.rows[0],
            totalUsers: parseInt(users.rows[0].total),
            subscriptionsByPlan: activeSubscriptions.rows,
            monthlyRevenue: parseFloat(revenue.rows[0].total_revenue),
            monthlyInvoices: parseInt(revenue.rows[0].total_invoices)
        });
    } catch (error) {
        console.error('Get statistics error:', error);
        res.status(500).json({ error: 'Failed to get statistics' });
    }
});

// =========================================================================
// ADMINISTRATOR MANAGEMENT
// =========================================================================

/**
 * List administrators (super admin only)
 */
router.get('/administrators', authenticateTenantAdmin, requireSuperAdmin, async (req, res) => {
    try {
        const pool = req.app.locals.pool;

        const result = await pool.query(`
            SELECT id, email, first_name, last_name, role, status,
                   last_login_at, created_at
            FROM tenant_administrators
            ORDER BY created_at DESC
        `);

        res.json(result.rows);
    } catch (error) {
        console.error('Get administrators error:', error);
        res.status(500).json({ error: 'Failed to get administrators' });
    }
});

/**
 * Create administrator (super admin only)
 */
router.post('/administrators', authenticateTenantAdmin, requireSuperAdmin, async (req, res) => {
    try {
        const { email, password, firstName, lastName, role = 'admin' } = req.body;
        const pool = req.app.locals.pool;

        // Hash password
        const passwordHash = await bcrypt.hash(password, 12);

        const result = await pool.query(`
            INSERT INTO tenant_administrators (email, password_hash, first_name, last_name, role, created_by)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, email, first_name, last_name, role, status, created_at
        `, [email.toLowerCase(), passwordHash, firstName, lastName, role, req.admin.id]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Email already exists' });
        }
        console.error('Create administrator error:', error);
        res.status(500).json({ error: 'Failed to create administrator' });
    }
});

module.exports = router;
