/**
 * AUREONCARE TENANT API ROUTES
 *
 * Routes for tenant-specific operations accessed by tenant users
 * These routes require tenant context
 */

const express = require('express');
const router = express.Router();

const { tenantAuthenticate, tenantAuthorize, requireTenantAdmin, requirePermission } = require('../middleware/tenantAuth');
const { enforceTenantIsolation, requireTenantFeature } = require('../middleware/tenantContext');

// Apply tenant authentication to all routes
router.use(tenantAuthenticate());
router.use(enforceTenantIsolation);

// =========================================================================
// TENANT INFO
// =========================================================================

/**
 * Get current tenant info
 */
router.get('/info', async (req, res) => {
    try {
        res.json({
            id: req.tenant.id,
            code: req.tenant.code,
            name: req.tenant.name,
            status: req.tenant.status,
            features: req.tenant.features,
            branding: req.tenant.branding,
            timezone: req.tenant.timezone,
            language: req.tenant.language,
            dateFormat: req.tenant.dateFormat,
            currency: req.tenant.currency
        });
    } catch (error) {
        console.error('Get tenant info error:', error);
        res.status(500).json({ error: 'Failed to get tenant info' });
    }
});

/**
 * Get tenant branding
 */
router.get('/branding', async (req, res) => {
    res.json(req.tenant.branding);
});

/**
 * Update tenant branding (tenant admin only)
 */
router.put('/branding', requireTenantAdmin, async (req, res) => {
    try {
        const tenantService = req.app.locals.tenantService;

        const tenant = await tenantService.updateTenant(
            req.tenant.id,
            { branding: req.body },
            req.user.id
        );

        res.json(tenant.branding);
    } catch (error) {
        console.error('Update branding error:', error);
        res.status(500).json({ error: 'Failed to update branding' });
    }
});

// =========================================================================
// SETTINGS
// =========================================================================

/**
 * Get all settings
 */
router.get('/settings', requireTenantAdmin, async (req, res) => {
    try {
        const { category } = req.query;
        const tenantService = req.app.locals.tenantService;

        const settings = await tenantService.getSettings(req.tenant.id, category);

        res.json(settings);
    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({ error: 'Failed to get settings' });
    }
});

/**
 * Update settings
 */
router.put('/settings', requireTenantAdmin, async (req, res) => {
    try {
        const tenantService = req.app.locals.tenantService;

        await tenantService.updateSettings(req.tenant.id, req.body, req.user.id);

        const settings = await tenantService.getSettings(req.tenant.id);

        res.json(settings);
    } catch (error) {
        console.error('Update settings error:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

/**
 * Get security settings
 */
router.get('/settings/security', requireTenantAdmin, async (req, res) => {
    try {
        const tenantService = req.app.locals.tenantService;
        const tenant = await tenantService.getTenant(req.tenant.id);

        // Mask sensitive data
        const securitySettings = { ...tenant.security_settings };
        delete securitySettings.ip_whitelist; // Don't expose in regular API

        res.json(securitySettings);
    } catch (error) {
        console.error('Get security settings error:', error);
        res.status(500).json({ error: 'Failed to get security settings' });
    }
});

/**
 * Update security settings
 */
router.put('/settings/security', requireTenantAdmin, async (req, res) => {
    try {
        const tenantService = req.app.locals.tenantService;

        const tenant = await tenantService.updateTenant(
            req.tenant.id,
            { securitySettings: req.body },
            req.user.id
        );

        res.json(tenant.security_settings);
    } catch (error) {
        console.error('Update security settings error:', error);
        res.status(500).json({ error: 'Failed to update security settings' });
    }
});

// =========================================================================
// USERS
// =========================================================================

/**
 * Get tenant users
 */
router.get('/users', requireTenantAdmin, async (req, res) => {
    try {
        const { role, status, limit = 50, offset = 0 } = req.query;
        const tenantService = req.app.locals.tenantService;

        const users = await tenantService.getTenantUsers(req.tenant.id, {
            role,
            status,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json(users);
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to get users' });
    }
});

/**
 * Add user to tenant
 */
router.post('/users', requireTenantAdmin, async (req, res) => {
    try {
        const { userId, isTenantAdmin, tenantRoles, accessLevel } = req.body;
        const tenantService = req.app.locals.tenantService;

        // Check user limit
        if (!req.tenant.checkLimit('users', await getTenantUserCount(req))) {
            return res.status(403).json({
                error: 'User limit reached',
                code: 'TENANT_LIMIT_EXCEEDED'
            });
        }

        const tenantUser = await tenantService.addUserToTenant(
            req.tenant.id,
            userId,
            {
                isTenantAdmin,
                tenantRoles,
                accessLevel,
                invitedBy: req.user.id
            }
        );

        res.status(201).json(tenantUser);
    } catch (error) {
        console.error('Add user error:', error);
        res.status(500).json({ error: 'Failed to add user' });
    }
});

/**
 * Update user in tenant
 */
router.put('/users/:userId', requireTenantAdmin, async (req, res) => {
    try {
        const tenantService = req.app.locals.tenantService;

        const tenantUser = await tenantService.updateTenantUser(
            req.tenant.id,
            req.params.userId,
            req.body
        );

        if (!tenantUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(tenantUser);
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

/**
 * Remove user from tenant
 */
router.delete('/users/:userId', requireTenantAdmin, async (req, res) => {
    try {
        const tenantService = req.app.locals.tenantService;

        await tenantService.removeUserFromTenant(req.tenant.id, req.params.userId);

        res.json({ message: 'User removed' });
    } catch (error) {
        console.error('Remove user error:', error);
        res.status(500).json({ error: 'Failed to remove user' });
    }
});

// Helper function to get user count
async function getTenantUserCount(req) {
    const pool = req.app.locals.pool;
    const result = await pool.query(
        `SELECT COUNT(*) FROM tenant_users WHERE tenant_id = $1 AND status = 'active'`,
        [req.tenant.id]
    );
    return parseInt(result.rows[0].count);
}

// =========================================================================
// ROLES
// =========================================================================

/**
 * Get tenant roles
 */
router.get('/roles', async (req, res) => {
    try {
        const tenantService = req.app.locals.tenantService;
        const roles = await tenantService.getRoles(req.tenant.id);

        res.json(roles);
    } catch (error) {
        console.error('Get roles error:', error);
        res.status(500).json({ error: 'Failed to get roles' });
    }
});

/**
 * Create custom role
 */
router.post('/roles', requireTenantAdmin, async (req, res) => {
    try {
        const tenantService = req.app.locals.tenantService;

        const role = await tenantService.createRole(
            req.tenant.id,
            req.body,
            req.user.id
        );

        res.status(201).json(role);
    } catch (error) {
        console.error('Create role error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * Update role
 */
router.put('/roles/:roleId', requireTenantAdmin, async (req, res) => {
    try {
        const tenantService = req.app.locals.tenantService;

        const role = await tenantService.updateRole(
            req.tenant.id,
            req.params.roleId,
            req.body
        );

        res.json(role);
    } catch (error) {
        console.error('Update role error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * Delete custom role
 */
router.delete('/roles/:roleId', requireTenantAdmin, async (req, res) => {
    try {
        const tenantService = req.app.locals.tenantService;

        await tenantService.deleteRole(req.tenant.id, req.params.roleId);

        res.json({ message: 'Role deleted' });
    } catch (error) {
        console.error('Delete role error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * Get available permissions
 */
router.get('/permissions', async (req, res) => {
    try {
        const pool = req.app.locals.pool;

        const result = await pool.query(`
            SELECT * FROM tenant_permission_definitions
            ORDER BY module, resource, action
        `);

        // Group by module
        const permissions = {};
        for (const perm of result.rows) {
            if (!permissions[perm.module]) {
                permissions[perm.module] = [];
            }
            permissions[perm.module].push(perm);
        }

        res.json(permissions);
    } catch (error) {
        console.error('Get permissions error:', error);
        res.status(500).json({ error: 'Failed to get permissions' });
    }
});

// =========================================================================
// SUBSCRIPTION & BILLING
// =========================================================================

/**
 * Get current subscription
 */
router.get('/subscription', requireTenantAdmin, async (req, res) => {
    try {
        const billingService = req.app.locals.billingService;
        const subscription = await billingService.getSubscription(req.tenant.id);

        res.json(subscription);
    } catch (error) {
        console.error('Get subscription error:', error);
        res.status(500).json({ error: 'Failed to get subscription' });
    }
});

/**
 * Get available plans
 */
router.get('/plans', async (req, res) => {
    try {
        const billingService = req.app.locals.billingService;
        const plans = await billingService.getPlans();

        res.json(plans);
    } catch (error) {
        console.error('Get plans error:', error);
        res.status(500).json({ error: 'Failed to get plans' });
    }
});

/**
 * Request plan change
 */
router.post('/subscription/change-plan', requireTenantAdmin, async (req, res) => {
    try {
        const { planCode } = req.body;
        const billingService = req.app.locals.billingService;

        const subscription = await billingService.changePlan(req.tenant.id, planCode);

        res.json(subscription);
    } catch (error) {
        console.error('Change plan error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * Get invoices
 */
router.get('/invoices', requireTenantAdmin, async (req, res) => {
    try {
        const { status, limit = 20, offset = 0 } = req.query;
        const billingService = req.app.locals.billingService;

        const invoices = await billingService.getInvoices(req.tenant.id, {
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
 * Get usage
 */
router.get('/usage', requireTenantAdmin, async (req, res) => {
    try {
        const { startDate, endDate, groupBy = 'day' } = req.query;
        const billingService = req.app.locals.billingService;

        const usage = await billingService.getUsageHistory(req.tenant.id, {
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

/**
 * Get payment methods
 */
router.get('/payment-methods', requireTenantAdmin, async (req, res) => {
    try {
        const billingService = req.app.locals.billingService;
        const methods = await billingService.getPaymentMethods(req.tenant.id);

        res.json(methods);
    } catch (error) {
        console.error('Get payment methods error:', error);
        res.status(500).json({ error: 'Failed to get payment methods' });
    }
});

/**
 * Add payment method
 */
router.post('/payment-methods', requireTenantAdmin, async (req, res) => {
    try {
        const billingService = req.app.locals.billingService;
        const method = await billingService.addPaymentMethod(req.tenant.id, req.body);

        res.status(201).json(method);
    } catch (error) {
        console.error('Add payment method error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * Delete payment method
 */
router.delete('/payment-methods/:methodId', requireTenantAdmin, async (req, res) => {
    try {
        const billingService = req.app.locals.billingService;
        await billingService.deletePaymentMethod(req.tenant.id, req.params.methodId);

        res.json({ message: 'Payment method deleted' });
    } catch (error) {
        console.error('Delete payment method error:', error);
        res.status(500).json({ error: 'Failed to delete payment method' });
    }
});

// =========================================================================
// AUDIT & COMPLIANCE
// =========================================================================

/**
 * Get audit logs
 */
router.get('/audit-logs', requireTenantAdmin, requirePermission('admin.audit.view'), async (req, res) => {
    try {
        const {
            userId, action, resourceType, startDate, endDate,
            severity, limit = 100, offset = 0
        } = req.query;

        const auditService = req.app.locals.auditService;

        const result = await auditService.queryLogs({
            tenantId: req.tenant.id,
            userId,
            action,
            resourceType,
            startDate,
            endDate,
            severity,
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
 * Get compliance reports
 */
router.get('/compliance-reports', requireTenantAdmin, async (req, res) => {
    try {
        const { reportType, limit = 20, offset = 0 } = req.query;
        const pool = req.app.locals.pool;

        let query = `
            SELECT id, report_type, report_name, period_start, period_end,
                   status, generated_at, file_size_bytes
            FROM tenant_compliance_reports
            WHERE tenant_id = $1
        `;
        const params = [req.tenant.id];

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

/**
 * Generate compliance report
 */
router.post('/compliance-reports', requireTenantAdmin, async (req, res) => {
    try {
        const { reportType, periodStart, periodEnd } = req.body;
        const auditService = req.app.locals.auditService;

        const report = await auditService.generateComplianceReport(
            req.tenant.id,
            reportType,
            periodStart,
            periodEnd,
            req.user.id
        );

        res.status(201).json(report);
    } catch (error) {
        console.error('Generate report error:', error);
        res.status(400).json({ error: error.message });
    }
});

// =========================================================================
// API KEYS
// =========================================================================

/**
 * Get API keys
 */
router.get('/api-keys', requireTenantAdmin, requireTenantFeature('api_access'), async (req, res) => {
    try {
        const pool = req.app.locals.pool;

        const result = await pool.query(`
            SELECT id, name, key_prefix, scopes, rate_limit_per_minute,
                   is_active, last_used_at, usage_count, created_at, expires_at
            FROM tenant_api_keys
            WHERE tenant_id = $1 AND revoked_at IS NULL
            ORDER BY created_at DESC
        `, [req.tenant.id]);

        res.json(result.rows);
    } catch (error) {
        console.error('Get API keys error:', error);
        res.status(500).json({ error: 'Failed to get API keys' });
    }
});

/**
 * Create API key
 */
router.post('/api-keys', requireTenantAdmin, requireTenantFeature('api_access'), async (req, res) => {
    try {
        const { name, scopes, rateLimitPerMinute = 60, expiresInDays } = req.body;
        const pool = req.app.locals.pool;
        const crypto = require('crypto');

        // Generate API key
        const apiKey = `ak_${crypto.randomBytes(32).toString('hex')}`;
        const keyPrefix = apiKey.substring(0, 10);
        const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

        const expiresAt = expiresInDays
            ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
            : null;

        const result = await pool.query(`
            INSERT INTO tenant_api_keys (
                tenant_id, name, key_prefix, key_hash, scopes,
                rate_limit_per_minute, expires_at, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id, name, key_prefix, scopes, rate_limit_per_minute,
                      is_active, created_at, expires_at
        `, [
            req.tenant.id,
            name,
            keyPrefix,
            keyHash,
            JSON.stringify(scopes || []),
            rateLimitPerMinute,
            expiresAt,
            req.user.id
        ]);

        // Return the full key only on creation
        res.status(201).json({
            ...result.rows[0],
            apiKey // Only returned once
        });
    } catch (error) {
        console.error('Create API key error:', error);
        res.status(500).json({ error: 'Failed to create API key' });
    }
});

/**
 * Revoke API key
 */
router.post('/api-keys/:keyId/revoke', requireTenantAdmin, async (req, res) => {
    try {
        const { reason } = req.body;
        const pool = req.app.locals.pool;

        await pool.query(`
            UPDATE tenant_api_keys
            SET revoked_at = NOW(), revoked_by = $3, revocation_reason = $4, is_active = false
            WHERE id = $1 AND tenant_id = $2
        `, [req.params.keyId, req.tenant.id, req.user.id, reason]);

        res.json({ message: 'API key revoked' });
    } catch (error) {
        console.error('Revoke API key error:', error);
        res.status(500).json({ error: 'Failed to revoke API key' });
    }
});

// =========================================================================
// INTEGRATIONS
// =========================================================================

/**
 * Get integrations
 */
router.get('/integrations', requireTenantAdmin, async (req, res) => {
    try {
        const pool = req.app.locals.pool;

        const result = await pool.query(`
            SELECT id, integration_type, provider_name, status,
                   last_sync_at, created_at
            FROM tenant_integrations
            WHERE tenant_id = $1
            ORDER BY created_at DESC
        `, [req.tenant.id]);

        res.json(result.rows);
    } catch (error) {
        console.error('Get integrations error:', error);
        res.status(500).json({ error: 'Failed to get integrations' });
    }
});

// =========================================================================
// STATISTICS
// =========================================================================

/**
 * Get tenant statistics
 */
router.get('/statistics', async (req, res) => {
    try {
        const tenantService = req.app.locals.tenantService;
        const stats = await tenantService.getStatistics(req.tenant.id);

        res.json(stats);
    } catch (error) {
        console.error('Get statistics error:', error);
        res.status(500).json({ error: 'Failed to get statistics' });
    }
});

/**
 * Get dashboard data
 */
router.get('/dashboard', async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const billingService = req.app.locals.billingService;

        const [stats, subscription, recentActivity] = await Promise.all([
            // Basic stats
            pool.query(`
                SELECT
                    (SELECT COUNT(*) FROM patients WHERE tenant_id = $1) as total_patients,
                    (SELECT COUNT(*) FROM appointments WHERE tenant_id = $1 AND start_time >= CURRENT_DATE) as upcoming_appointments,
                    (SELECT COUNT(*) FROM claims WHERE tenant_id = $1 AND status = 'pending') as pending_claims,
                    (SELECT COUNT(*) FROM tenant_users WHERE tenant_id = $1 AND status = 'active') as active_users
            `, [req.tenant.id]),
            // Subscription
            billingService.getSubscription(req.tenant.id),
            // Recent activity
            pool.query(`
                SELECT * FROM tenant_audit_logs
                WHERE tenant_id = $1
                ORDER BY created_at DESC
                LIMIT 10
            `, [req.tenant.id])
        ]);

        res.json({
            statistics: stats.rows[0],
            subscription: {
                planName: subscription?.plan_display_name,
                status: subscription?.status,
                currentUsers: subscription?.current_users,
                maxUsers: subscription?.plan_max_users,
                currentPatients: subscription?.current_patients,
                maxPatients: subscription?.plan_max_patients
            },
            recentActivity: recentActivity.rows
        });
    } catch (error) {
        console.error('Get dashboard error:', error);
        res.status(500).json({ error: 'Failed to get dashboard data' });
    }
});

module.exports = router;
