/**
 * AUREONCARE MULTI-TENANT MANAGEMENT SERVICE
 *
 * Core service for:
 * - Tenant provisioning and lifecycle management
 * - Tenant configuration
 * - User management within tenants
 * - Feature and limit management
 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');

/**
 * Tenant Service Class
 */
class TenantService {
    constructor(pool, billingService, auditService) {
        this.pool = pool;
        this.billingService = billingService;
        this.auditService = auditService;
    }

    // =========================================================================
    // TENANT CRUD OPERATIONS
    // =========================================================================

    /**
     * Create a new tenant
     */
    async createTenant(tenantData, createdBy = null) {
        const {
            tenantCode,
            name,
            legalName,
            description,
            primaryEmail,
            primaryPhone,
            website,
            addressLine1,
            addressLine2,
            city,
            state,
            postalCode,
            country = 'USA',
            taxId,
            businessType,
            npiNumber,
            subdomain,
            customDomain,
            planCode = 'starter',
            billingCycle = 'monthly',
            branding = {},
            securitySettings = {},
            complianceSettings = {},
            features = {},
            defaultTimezone = 'America/New_York',
            defaultLanguage = 'en'
        } = tenantData;

        // Validate tenant code uniqueness
        const existingCode = await this.pool.query(
            'SELECT id FROM tenants WHERE tenant_code = $1',
            [tenantCode.toLowerCase()]
        );
        if (existingCode.rows.length > 0) {
            throw new Error('Tenant code already exists');
        }

        // Validate subdomain uniqueness
        if (subdomain) {
            const existingSubdomain = await this.pool.query(
                'SELECT id FROM tenants WHERE subdomain = $1',
                [subdomain.toLowerCase()]
            );
            if (existingSubdomain.rows.length > 0) {
                throw new Error('Subdomain already exists');
            }
        }

        // Get plan details
        const plan = await this.billingService.getPlan(planCode);
        if (!plan) {
            throw new Error(`Plan not found: ${planCode}`);
        }

        // Merge features with plan defaults
        const tenantFeatures = { ...plan.features, ...features };

        // Merge security settings with defaults
        const defaultSecuritySettings = {
            mfa_required: false,
            mfa_methods: ['totp', 'sms'],
            password_policy: {
                min_length: 8,
                require_uppercase: true,
                require_lowercase: true,
                require_numbers: true,
                require_special: true,
                max_age_days: 90,
                history_count: 5
            },
            session_timeout_minutes: 60,
            max_failed_attempts: 5,
            lockout_duration_minutes: 30,
            ip_whitelist: [],
            allowed_oauth_providers: ['google', 'microsoft']
        };
        const tenantSecuritySettings = { ...defaultSecuritySettings, ...securitySettings };

        // Merge compliance settings with defaults
        const defaultComplianceSettings = {
            hipaa_enabled: true,
            hipaa_baa_signed: false,
            data_retention_days: 2555,
            audit_retention_days: 2555,
            encryption_at_rest: true,
            encryption_in_transit: true,
            phi_access_logging: true,
            require_consent_forms: true
        };
        const tenantComplianceSettings = { ...defaultComplianceSettings, ...complianceSettings };

        // Create tenant
        const result = await this.pool.query(`
            INSERT INTO tenants (
                tenant_code, name, legal_name, description,
                primary_email, primary_phone, website,
                address_line1, address_line2, city, state, postal_code, country,
                tax_id, business_type, npi_number,
                subdomain, custom_domain,
                max_users, max_patients, max_providers, max_storage_gb,
                branding, security_settings, compliance_settings, features,
                default_timezone, default_language,
                status, created_by
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
                $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, 'provisioning', $29
            )
            RETURNING *
        `, [
            tenantCode.toLowerCase(),
            name,
            legalName,
            description,
            primaryEmail,
            primaryPhone,
            website,
            addressLine1,
            addressLine2,
            city,
            state,
            postalCode,
            country,
            taxId,
            businessType,
            npiNumber,
            subdomain?.toLowerCase(),
            customDomain?.toLowerCase(),
            plan.max_users,
            plan.max_patients,
            plan.max_providers,
            plan.max_storage_gb,
            JSON.stringify(branding),
            JSON.stringify(tenantSecuritySettings),
            JSON.stringify(tenantComplianceSettings),
            JSON.stringify(tenantFeatures),
            defaultTimezone,
            defaultLanguage,
            createdBy
        ]);

        const tenant = result.rows[0];

        // Create subscription
        await this.billingService.createSubscription(tenant.id, planCode, billingCycle, true);

        // Initialize default roles for the tenant
        await this.initializeTenantRoles(tenant.id);

        // Initialize default settings
        await this.initializeTenantSettings(tenant.id);

        // Initialize notification settings
        await this.initializeNotificationSettings(tenant.id);

        // Update status to active
        await this.pool.query(`
            UPDATE tenants SET status = 'active', activated_at = NOW() WHERE id = $1
        `, [tenant.id]);

        // Log audit event
        if (this.auditService) {
            await this.auditService.log({
                tenantId: tenant.id,
                userId: createdBy,
                action: 'create',
                resourceType: 'tenant',
                resourceId: tenant.id,
                description: `Tenant created: ${name}`,
                newValues: { tenantCode, name, planCode },
                severity: 'high',
                immediate: true
            });
        }

        return this.getTenant(tenant.id);
    }

    /**
     * Initialize default roles for a new tenant
     */
    async initializeTenantRoles(tenantId) {
        // Get role templates
        const templates = await this.pool.query(
            'SELECT * FROM tenant_role_templates WHERE is_default = true'
        );

        for (const template of templates.rows) {
            await this.pool.query(`
                INSERT INTO tenant_roles (
                    tenant_id, code, name, description, permissions, is_system_role
                ) VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (tenant_id, code) DO NOTHING
            `, [
                tenantId,
                template.code,
                template.name,
                template.description,
                JSON.stringify(template.permissions),
                template.is_system_role
            ]);
        }
    }

    /**
     * Initialize default settings for a new tenant
     */
    async initializeTenantSettings(tenantId) {
        const defaultSettings = [
            { category: 'general', key: 'clinic_name', value: '', valueType: 'string' },
            { category: 'general', key: 'clinic_phone', value: '', valueType: 'string' },
            { category: 'general', key: 'clinic_email', value: '', valueType: 'string' },
            { category: 'general', key: 'clinic_address', value: {}, valueType: 'json' },
            { category: 'scheduling', key: 'default_appointment_duration', value: 30, valueType: 'number' },
            { category: 'scheduling', key: 'working_hours', value: { start: '09:00', end: '17:00' }, valueType: 'json' },
            { category: 'scheduling', key: 'working_days', value: [1, 2, 3, 4, 5], valueType: 'array' },
            { category: 'billing', key: 'tax_rate', value: 0, valueType: 'number' },
            { category: 'billing', key: 'payment_terms_days', value: 30, valueType: 'number' },
            { category: 'notifications', key: 'appointment_reminder_hours', value: 24, valueType: 'number' },
            { category: 'notifications', key: 'sms_enabled', value: false, valueType: 'boolean' },
            { category: 'privacy', key: 'patient_data_retention_days', value: 2555, valueType: 'number' }
        ];

        for (const setting of defaultSettings) {
            await this.pool.query(`
                INSERT INTO tenant_settings (tenant_id, category, key, value, value_type)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (tenant_id, category, key) DO NOTHING
            `, [tenantId, setting.category, setting.key, JSON.stringify(setting.value), setting.valueType]);
        }
    }

    /**
     * Initialize notification settings for a new tenant
     */
    async initializeNotificationSettings(tenantId) {
        await this.pool.query(`
            INSERT INTO tenant_notification_settings (tenant_id, email_enabled, in_app_enabled)
            VALUES ($1, true, true)
            ON CONFLICT DO NOTHING
        `, [tenantId]);
    }

    /**
     * Get tenant by ID
     */
    async getTenant(tenantId) {
        const result = await this.pool.query(`
            SELECT
                t.*,
                ts.status as subscription_status,
                ts.billing_cycle,
                ts.current_users,
                ts.current_patients,
                ts.current_providers,
                tsp.code as plan_code,
                tsp.name as plan_name,
                tsp.display_name as plan_display_name
            FROM tenants t
            LEFT JOIN tenant_subscriptions ts ON t.id = ts.tenant_id
            LEFT JOIN tenant_subscription_plans tsp ON ts.plan_id = tsp.id
            WHERE t.id = $1 AND t.deleted_at IS NULL
        `, [tenantId]);

        return result.rows[0] || null;
    }

    /**
     * Get all tenants (for admin)
     */
    async getTenants(options = {}) {
        const { status, search, limit = 50, offset = 0 } = options;

        let query = `
            SELECT
                t.*,
                ts.status as subscription_status,
                tsp.name as plan_name,
                ts.current_users,
                ts.current_patients
            FROM tenants t
            LEFT JOIN tenant_subscriptions ts ON t.id = ts.tenant_id
            LEFT JOIN tenant_subscription_plans tsp ON ts.plan_id = tsp.id
            WHERE t.deleted_at IS NULL
        `;
        const params = [];

        if (status) {
            params.push(status);
            query += ` AND t.status = $${params.length}`;
        }

        if (search) {
            params.push(`%${search}%`);
            query += ` AND (t.name ILIKE $${params.length} OR t.tenant_code ILIKE $${params.length} OR t.primary_email ILIKE $${params.length})`;
        }

        // Count total
        const countResult = await this.pool.query(
            query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) FROM'),
            params
        );

        query += ` ORDER BY t.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await this.pool.query(query, params);

        return {
            tenants: result.rows,
            total: parseInt(countResult.rows[0].count),
            limit,
            offset
        };
    }

    /**
     * Update tenant
     */
    async updateTenant(tenantId, updates, updatedBy = null) {
        const allowedFields = [
            'name', 'legal_name', 'description', 'primary_email', 'primary_phone',
            'website', 'address_line1', 'address_line2', 'city', 'state',
            'postal_code', 'country', 'tax_id', 'business_type', 'npi_number',
            'custom_domain', 'branding', 'security_settings', 'compliance_settings',
            'default_timezone', 'default_language', 'supported_languages',
            'date_format', 'time_format', 'currency', 'metadata'
        ];

        const setClauses = [];
        const values = [];
        let paramIndex = 1;

        for (const [key, value] of Object.entries(updates)) {
            const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
            if (allowedFields.includes(snakeKey)) {
                setClauses.push(`${snakeKey} = $${paramIndex}`);
                values.push(typeof value === 'object' ? JSON.stringify(value) : value);
                paramIndex++;
            }
        }

        if (setClauses.length === 0) {
            throw new Error('No valid fields to update');
        }

        setClauses.push(`updated_at = NOW()`);
        setClauses.push(`updated_by = $${paramIndex}`);
        values.push(updatedBy);
        paramIndex++;

        values.push(tenantId);

        const result = await this.pool.query(`
            UPDATE tenants
            SET ${setClauses.join(', ')}
            WHERE id = $${paramIndex} AND deleted_at IS NULL
            RETURNING *
        `, values);

        return result.rows[0];
    }

    /**
     * Suspend tenant
     */
    async suspendTenant(tenantId, reason, suspendedBy = null) {
        await this.pool.query(`
            UPDATE tenants
            SET status = 'suspended', suspended_at = NOW(), updated_by = $2,
                metadata = jsonb_set(COALESCE(metadata, '{}'), '{suspension_reason}', $3)
            WHERE id = $1
        `, [tenantId, suspendedBy, JSON.stringify(reason)]);

        // Log security event
        if (this.auditService) {
            await this.auditService.logSecurityEvent({
                tenantId,
                eventType: 'tenant_suspended',
                severity: 'high',
                description: `Tenant suspended: ${reason}`,
                details: { reason, suspendedBy }
            });
        }
    }

    /**
     * Reactivate tenant
     */
    async reactivateTenant(tenantId, reactivatedBy = null) {
        await this.pool.query(`
            UPDATE tenants
            SET status = 'active', suspended_at = NULL, updated_by = $2
            WHERE id = $1
        `, [tenantId, reactivatedBy]);
    }

    /**
     * Terminate tenant (soft delete)
     */
    async terminateTenant(tenantId, reason, terminatedBy = null) {
        await this.pool.query(`
            UPDATE tenants
            SET status = 'terminated', terminated_at = NOW(), deleted_at = NOW(),
                deleted_by = $2,
                metadata = jsonb_set(COALESCE(metadata, '{}'), '{termination_reason}', $3)
            WHERE id = $1
        `, [tenantId, terminatedBy, JSON.stringify(reason)]);

        // Cancel subscription
        await this.billingService.cancelSubscription(tenantId, reason, true);
    }

    // =========================================================================
    // TENANT USER MANAGEMENT
    // =========================================================================

    /**
     * Add user to tenant
     */
    async addUserToTenant(tenantId, userId, options = {}) {
        const {
            isTenantAdmin = false,
            tenantRoles = [],
            accessLevel = 'standard',
            invitedBy = null
        } = options;

        const result = await this.pool.query(`
            INSERT INTO tenant_users (
                tenant_id, user_id, is_tenant_admin, tenant_roles,
                access_level, invited_by
            ) VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (tenant_id, user_id) DO UPDATE SET
                is_tenant_admin = EXCLUDED.is_tenant_admin,
                tenant_roles = EXCLUDED.tenant_roles,
                access_level = EXCLUDED.access_level,
                updated_at = NOW()
            RETURNING *
        `, [tenantId, userId, isTenantAdmin, JSON.stringify(tenantRoles), accessLevel, invitedBy]);

        return result.rows[0];
    }

    /**
     * Remove user from tenant
     */
    async removeUserFromTenant(tenantId, userId) {
        await this.pool.query(`
            DELETE FROM tenant_users WHERE tenant_id = $1 AND user_id = $2
        `, [tenantId, userId]);
    }

    /**
     * Get tenant users
     */
    async getTenantUsers(tenantId, options = {}) {
        const { role, status, limit = 50, offset = 0 } = options;

        let query = `
            SELECT
                u.id, u.email, u.first_name, u.last_name, u.role, u.status,
                u.last_login_at, u.created_at,
                tu.is_tenant_admin, tu.tenant_roles, tu.access_level, tu.last_access_at
            FROM users u
            JOIN tenant_users tu ON u.id = tu.user_id
            WHERE tu.tenant_id = $1
        `;
        const params = [tenantId];

        if (role) {
            params.push(role);
            query += ` AND (u.role = $${params.length} OR tu.tenant_roles ? $${params.length})`;
        }

        if (status) {
            params.push(status);
            query += ` AND tu.status = $${params.length}`;
        }

        query += ` ORDER BY u.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await this.pool.query(query, params);
        return result.rows;
    }

    /**
     * Update tenant user settings
     */
    async updateTenantUser(tenantId, userId, updates) {
        const { isTenantAdmin, tenantRoles, accessLevel, status, ipRestrictions } = updates;

        const result = await this.pool.query(`
            UPDATE tenant_users
            SET
                is_tenant_admin = COALESCE($3, is_tenant_admin),
                tenant_roles = COALESCE($4, tenant_roles),
                access_level = COALESCE($5, access_level),
                status = COALESCE($6, status),
                ip_restrictions = COALESCE($7, ip_restrictions),
                updated_at = NOW()
            WHERE tenant_id = $1 AND user_id = $2
            RETURNING *
        `, [
            tenantId,
            userId,
            isTenantAdmin,
            tenantRoles ? JSON.stringify(tenantRoles) : null,
            accessLevel,
            status,
            ipRestrictions ? JSON.stringify(ipRestrictions) : null
        ]);

        return result.rows[0];
    }

    // =========================================================================
    // TENANT SETTINGS
    // =========================================================================

    /**
     * Get all settings for a tenant
     */
    async getSettings(tenantId, category = null) {
        let query = `
            SELECT * FROM tenant_settings
            WHERE tenant_id = $1
        `;
        const params = [tenantId];

        if (category) {
            params.push(category);
            query += ` AND category = $${params.length}`;
        }

        query += ` ORDER BY category, key`;

        const result = await this.pool.query(query, params);

        // Convert to nested object
        const settings = {};
        for (const row of result.rows) {
            if (!settings[row.category]) {
                settings[row.category] = {};
            }
            settings[row.category][row.key] = row.value;
        }

        return settings;
    }

    /**
     * Get a specific setting
     */
    async getSetting(tenantId, category, key) {
        const result = await this.pool.query(`
            SELECT value FROM tenant_settings
            WHERE tenant_id = $1 AND category = $2 AND key = $3
        `, [tenantId, category, key]);

        return result.rows[0]?.value || null;
    }

    /**
     * Update a setting
     */
    async updateSetting(tenantId, category, key, value, updatedBy = null) {
        const result = await this.pool.query(`
            INSERT INTO tenant_settings (tenant_id, category, key, value, updated_by)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (tenant_id, category, key) DO UPDATE SET
                value = EXCLUDED.value,
                updated_at = NOW(),
                updated_by = EXCLUDED.updated_by
            RETURNING *
        `, [tenantId, category, key, JSON.stringify(value), updatedBy]);

        return result.rows[0];
    }

    /**
     * Update multiple settings at once
     */
    async updateSettings(tenantId, settings, updatedBy = null) {
        const results = [];

        for (const [category, categorySettings] of Object.entries(settings)) {
            for (const [key, value] of Object.entries(categorySettings)) {
                const result = await this.updateSetting(tenantId, category, key, value, updatedBy);
                results.push(result);
            }
        }

        return results;
    }

    // =========================================================================
    // TENANT ROLES
    // =========================================================================

    /**
     * Get roles for a tenant
     */
    async getRoles(tenantId) {
        const result = await this.pool.query(`
            SELECT * FROM tenant_roles
            WHERE tenant_id = $1 AND is_active = true
            ORDER BY hierarchy_level, name
        `, [tenantId]);

        return result.rows;
    }

    /**
     * Create a custom role
     */
    async createRole(tenantId, roleData, createdBy = null) {
        const { code, name, description, permissions, parentRoleId } = roleData;

        const result = await this.pool.query(`
            INSERT INTO tenant_roles (
                tenant_id, code, name, description, permissions, parent_role_id, is_custom, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, true, $7)
            RETURNING *
        `, [tenantId, code, name, description, JSON.stringify(permissions), parentRoleId, createdBy]);

        return result.rows[0];
    }

    /**
     * Update a role
     */
    async updateRole(tenantId, roleId, updates) {
        const { name, description, permissions, isActive } = updates;

        // Check if system role
        const roleResult = await this.pool.query(
            'SELECT is_system_role FROM tenant_roles WHERE id = $1 AND tenant_id = $2',
            [roleId, tenantId]
        );

        if (roleResult.rows[0]?.is_system_role) {
            // Only allow permission updates for system roles
            if (name || description) {
                throw new Error('Cannot modify system role name or description');
            }
        }

        const result = await this.pool.query(`
            UPDATE tenant_roles
            SET
                name = COALESCE($3, name),
                description = COALESCE($4, description),
                permissions = COALESCE($5, permissions),
                is_active = COALESCE($6, is_active),
                updated_at = NOW()
            WHERE id = $1 AND tenant_id = $2
            RETURNING *
        `, [roleId, tenantId, name, description, permissions ? JSON.stringify(permissions) : null, isActive]);

        return result.rows[0];
    }

    /**
     * Delete a custom role
     */
    async deleteRole(tenantId, roleId) {
        // Check if system role
        const roleResult = await this.pool.query(
            'SELECT is_system_role FROM tenant_roles WHERE id = $1 AND tenant_id = $2',
            [roleId, tenantId]
        );

        if (roleResult.rows[0]?.is_system_role) {
            throw new Error('Cannot delete system role');
        }

        await this.pool.query(
            'DELETE FROM tenant_roles WHERE id = $1 AND tenant_id = $2',
            [roleId, tenantId]
        );
    }

    // =========================================================================
    // TENANT STATISTICS
    // =========================================================================

    /**
     * Get tenant statistics
     */
    async getStatistics(tenantId) {
        const [users, patients, appointments, claims] = await Promise.all([
            this.pool.query(
                `SELECT COUNT(*) FROM tenant_users WHERE tenant_id = $1 AND status = 'active'`,
                [tenantId]
            ),
            this.pool.query(
                `SELECT COUNT(*) FROM patients WHERE tenant_id = $1`,
                [tenantId]
            ),
            this.pool.query(
                `SELECT COUNT(*) FROM appointments WHERE tenant_id = $1 AND start_time >= CURRENT_DATE`,
                [tenantId]
            ),
            this.pool.query(
                `SELECT COUNT(*) FROM claims WHERE tenant_id = $1 AND status = 'pending'`,
                [tenantId]
            )
        ]);

        return {
            activeUsers: parseInt(users.rows[0].count),
            totalPatients: parseInt(patients.rows[0].count),
            upcomingAppointments: parseInt(appointments.rows[0].count),
            pendingClaims: parseInt(claims.rows[0].count)
        };
    }
}

/**
 * Create tenant service instance
 */
function createTenantService(pool, billingService, auditService) {
    return new TenantService(pool, billingService, auditService);
}

module.exports = {
    TenantService,
    createTenantService
};
