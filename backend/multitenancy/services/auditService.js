/**
 * AUREONCARE MULTI-TENANT AUDIT SERVICE
 *
 * Provides comprehensive audit logging for:
 * - All CRUD operations
 * - Security events
 * - PHI access tracking (HIPAA compliance)
 * - User activity
 * - System events
 */

const crypto = require('crypto');

/**
 * Audit action types
 */
const AuditAction = {
    CREATE: 'create',
    READ: 'read',
    UPDATE: 'update',
    DELETE: 'delete',
    LOGIN: 'login',
    LOGOUT: 'logout',
    EXPORT: 'export',
    IMPORT: 'import',
    APPROVE: 'approve',
    REJECT: 'reject',
    SUSPEND: 'suspend',
    ACTIVATE: 'activate',
    CONFIGURE: 'configure'
};

/**
 * Audit severity levels
 */
const AuditSeverity = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
};

/**
 * Security event types
 */
const SecurityEventType = {
    FAILED_LOGIN: 'failed_login',
    SUCCESSFUL_LOGIN: 'successful_login',
    PASSWORD_CHANGED: 'password_changed',
    PASSWORD_RESET: 'password_reset',
    MFA_ENABLED: 'mfa_enabled',
    MFA_DISABLED: 'mfa_disabled',
    SESSION_REVOKED: 'session_revoked',
    SUSPICIOUS_ACTIVITY: 'suspicious_activity',
    DATA_EXPORT: 'data_export',
    PERMISSION_CHANGE: 'permission_change',
    ROLE_CHANGE: 'role_change',
    ACCESS_DENIED: 'access_denied',
    IP_BLOCKED: 'ip_blocked',
    ACCOUNT_LOCKED: 'account_locked',
    ACCOUNT_UNLOCKED: 'account_unlocked',
    API_KEY_CREATED: 'api_key_created',
    API_KEY_REVOKED: 'api_key_revoked'
};

/**
 * Resource types that are tracked
 */
const ResourceType = {
    TENANT: 'tenant',
    USER: 'user',
    PATIENT: 'patient',
    PROVIDER: 'provider',
    APPOINTMENT: 'appointment',
    PRESCRIPTION: 'prescription',
    CLAIM: 'claim',
    PAYMENT: 'payment',
    MEDICAL_RECORD: 'medical_record',
    DIAGNOSIS: 'diagnosis',
    LAB_ORDER: 'lab_order',
    DOCUMENT: 'document',
    SETTING: 'setting',
    ROLE: 'role',
    PERMISSION: 'permission',
    API_KEY: 'api_key',
    SESSION: 'session'
};

/**
 * PHI (Protected Health Information) resource types
 */
const PHI_RESOURCES = [
    'patient',
    'medical_record',
    'prescription',
    'diagnosis',
    'lab_order'
];

/**
 * Main Audit Service Class
 */
class AuditService {
    constructor(pool) {
        this.pool = pool;
        this.batchQueue = [];
        this.batchSize = 100;
        this.flushInterval = 5000; // 5 seconds
        this.startBatchProcessor();
    }

    /**
     * Start background batch processor for audit logs
     */
    startBatchProcessor() {
        setInterval(() => this.flushBatch(), this.flushInterval);
    }

    /**
     * Flush batch to database
     */
    async flushBatch() {
        if (this.batchQueue.length === 0) return;

        const logsToInsert = this.batchQueue.splice(0, this.batchSize);

        try {
            // Build bulk insert query
            const values = [];
            const placeholders = [];
            let paramIndex = 1;

            for (const log of logsToInsert) {
                const params = [
                    log.tenantId,
                    log.userId,
                    log.userEmail,
                    log.userRole,
                    log.ipAddress,
                    log.userAgent,
                    log.action,
                    log.resourceType,
                    log.resourceId,
                    log.description,
                    JSON.stringify(log.oldValues),
                    JSON.stringify(log.newValues),
                    JSON.stringify(log.metadata),
                    log.severity,
                    log.isPhiAccess,
                    log.isSecurityEvent,
                    log.requestId,
                    log.sessionId,
                    log.endpoint,
                    log.httpMethod,
                    JSON.stringify(log.complianceFlags),
                    log.retentionUntil
                ];

                values.push(...params);
                const placeholderRow = params.map((_, i) => `$${paramIndex + i}`);
                placeholders.push(`(${placeholderRow.join(', ')})`);
                paramIndex += params.length;
            }

            await this.pool.query(`
                INSERT INTO tenant_audit_logs (
                    tenant_id, user_id, user_email, user_role, ip_address, user_agent,
                    action, resource_type, resource_id, description,
                    old_values, new_values, metadata, severity,
                    is_phi_access, is_security_event, request_id, session_id,
                    endpoint, http_method, compliance_flags, retention_until
                ) VALUES ${placeholders.join(', ')}
            `, values);

        } catch (error) {
            console.error('Failed to flush audit batch:', error);
            // Re-queue failed logs (with limit to prevent infinite growth)
            if (this.batchQueue.length < 10000) {
                this.batchQueue.unshift(...logsToInsert);
            }
        }
    }

    /**
     * Log an audit event
     */
    async log(options) {
        const {
            tenantId,
            userId,
            userEmail,
            userRole,
            ipAddress,
            userAgent,
            action,
            resourceType,
            resourceId,
            description,
            oldValues = null,
            newValues = null,
            metadata = {},
            severity = AuditSeverity.LOW,
            isSecurityEvent = false,
            requestId,
            sessionId,
            endpoint,
            httpMethod,
            complianceFlags = {},
            immediate = false  // If true, write immediately instead of batching
        } = options;

        // Determine if this is PHI access
        const isPhiAccess = PHI_RESOURCES.includes(resourceType);

        // Calculate retention date based on compliance settings
        const retentionDays = complianceFlags.hipaa_enabled ? 2555 : 365; // 7 years for HIPAA
        const retentionUntil = new Date();
        retentionUntil.setDate(retentionUntil.getDate() + retentionDays);

        const logEntry = {
            tenantId,
            userId,
            userEmail,
            userRole,
            ipAddress,
            userAgent,
            action,
            resourceType,
            resourceId,
            description,
            oldValues: this.sanitizeForLog(oldValues),
            newValues: this.sanitizeForLog(newValues),
            metadata,
            severity,
            isPhiAccess,
            isSecurityEvent,
            requestId,
            sessionId,
            endpoint,
            httpMethod,
            complianceFlags,
            retentionUntil: retentionUntil.toISOString().split('T')[0]
        };

        if (immediate) {
            await this.writeImmediately(logEntry);
        } else {
            this.batchQueue.push(logEntry);

            // Auto-flush if batch is full
            if (this.batchQueue.length >= this.batchSize) {
                this.flushBatch();
            }
        }

        return logEntry;
    }

    /**
     * Write a log entry immediately (for critical events)
     */
    async writeImmediately(logEntry) {
        await this.pool.query(`
            INSERT INTO tenant_audit_logs (
                tenant_id, user_id, user_email, user_role, ip_address, user_agent,
                action, resource_type, resource_id, description,
                old_values, new_values, metadata, severity,
                is_phi_access, is_security_event, request_id, session_id,
                endpoint, http_method, compliance_flags, retention_until
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
        `, [
            logEntry.tenantId,
            logEntry.userId,
            logEntry.userEmail,
            logEntry.userRole,
            logEntry.ipAddress,
            logEntry.userAgent,
            logEntry.action,
            logEntry.resourceType,
            logEntry.resourceId,
            logEntry.description,
            JSON.stringify(logEntry.oldValues),
            JSON.stringify(logEntry.newValues),
            JSON.stringify(logEntry.metadata),
            logEntry.severity,
            logEntry.isPhiAccess,
            logEntry.isSecurityEvent,
            logEntry.requestId,
            logEntry.sessionId,
            logEntry.endpoint,
            logEntry.httpMethod,
            JSON.stringify(logEntry.complianceFlags),
            logEntry.retentionUntil
        ]);
    }

    /**
     * Sanitize values for logging (remove sensitive data)
     */
    sanitizeForLog(data) {
        if (!data) return null;

        const sensitiveFields = [
            'password', 'password_hash', 'token', 'secret',
            'api_key', 'ssn', 'social_security', 'credit_card',
            'cvv', 'pin', 'access_token', 'refresh_token',
            'mfa_secret', 'recovery_codes'
        ];

        const sanitized = { ...data };

        for (const field of sensitiveFields) {
            if (sanitized[field]) {
                sanitized[field] = '[REDACTED]';
            }
        }

        return sanitized;
    }

    /**
     * Log a security event
     */
    async logSecurityEvent(options) {
        const {
            tenantId,
            eventType,
            severity,
            userId,
            userEmail,
            ipAddress,
            geoLocation = null,
            description,
            details = {},
            autoResponseTaken = false,
            autoResponseDetails = null
        } = options;

        await this.pool.query(`
            INSERT INTO tenant_security_events (
                tenant_id, event_type, severity, user_id, user_email,
                ip_address, geo_location, description, details,
                auto_response_taken, auto_response_details
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
            tenantId,
            eventType,
            severity,
            userId,
            userEmail,
            ipAddress,
            JSON.stringify(geoLocation),
            description,
            JSON.stringify(details),
            autoResponseTaken,
            autoResponseDetails
        ]);

        // Also log to audit log with immediate write for security events
        await this.log({
            tenantId,
            userId,
            userEmail,
            ipAddress,
            action: AuditAction.CREATE,
            resourceType: 'security_event',
            description,
            metadata: { eventType, ...details },
            severity,
            isSecurityEvent: true,
            immediate: true
        });
    }

    /**
     * Log PHI access (HIPAA compliance)
     */
    async logPhiAccess(options) {
        const {
            tenantId,
            userId,
            userEmail,
            userRole,
            ipAddress,
            patientId,
            resourceType,
            resourceId,
            action,
            reason,
            requestId
        } = options;

        await this.log({
            tenantId,
            userId,
            userEmail,
            userRole,
            ipAddress,
            action,
            resourceType,
            resourceId,
            description: `PHI access: ${action} on ${resourceType}`,
            metadata: {
                patientId,
                accessReason: reason,
                hipaaLogged: true
            },
            severity: AuditSeverity.MEDIUM,
            requestId,
            complianceFlags: { hipaa_enabled: true },
            immediate: true  // PHI access should be logged immediately
        });
    }

    /**
     * Query audit logs
     */
    async queryLogs(options) {
        const {
            tenantId,
            userId,
            action,
            resourceType,
            resourceId,
            startDate,
            endDate,
            severity,
            isPhiAccess,
            isSecurityEvent,
            limit = 100,
            offset = 0,
            orderBy = 'created_at',
            orderDir = 'DESC'
        } = options;

        const conditions = [];
        const params = [];
        let paramIndex = 1;

        if (tenantId) {
            conditions.push(`tenant_id = $${paramIndex++}`);
            params.push(tenantId);
        }

        if (userId) {
            conditions.push(`user_id = $${paramIndex++}`);
            params.push(userId);
        }

        if (action) {
            conditions.push(`action = $${paramIndex++}`);
            params.push(action);
        }

        if (resourceType) {
            conditions.push(`resource_type = $${paramIndex++}`);
            params.push(resourceType);
        }

        if (resourceId) {
            conditions.push(`resource_id = $${paramIndex++}`);
            params.push(resourceId);
        }

        if (startDate) {
            conditions.push(`created_at >= $${paramIndex++}`);
            params.push(startDate);
        }

        if (endDate) {
            conditions.push(`created_at <= $${paramIndex++}`);
            params.push(endDate);
        }

        if (severity) {
            conditions.push(`severity = $${paramIndex++}`);
            params.push(severity);
        }

        if (isPhiAccess !== undefined) {
            conditions.push(`is_phi_access = $${paramIndex++}`);
            params.push(isPhiAccess);
        }

        if (isSecurityEvent !== undefined) {
            conditions.push(`is_security_event = $${paramIndex++}`);
            params.push(isSecurityEvent);
        }

        const whereClause = conditions.length > 0
            ? `WHERE ${conditions.join(' AND ')}`
            : '';

        // Count total
        const countResult = await this.pool.query(
            `SELECT COUNT(*) FROM tenant_audit_logs ${whereClause}`,
            params
        );
        const total = parseInt(countResult.rows[0].count);

        // Get logs
        const validOrderCols = ['created_at', 'action', 'resource_type', 'severity'];
        const orderCol = validOrderCols.includes(orderBy) ? orderBy : 'created_at';
        const orderDirection = orderDir.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        const result = await this.pool.query(
            `SELECT * FROM tenant_audit_logs
             ${whereClause}
             ORDER BY ${orderCol} ${orderDirection}
             LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            [...params, limit, offset]
        );

        return {
            logs: result.rows,
            total,
            limit,
            offset
        };
    }

    /**
     * Generate compliance report
     */
    async generateComplianceReport(tenantId, reportType, periodStart, periodEnd, generatedBy) {
        let reportData = {};

        switch (reportType) {
            case 'hipaa_audit':
                reportData = await this.generateHipaaReport(tenantId, periodStart, periodEnd);
                break;
            case 'access_report':
                reportData = await this.generateAccessReport(tenantId, periodStart, periodEnd);
                break;
            case 'phi_disclosure':
                reportData = await this.generatePhiDisclosureReport(tenantId, periodStart, periodEnd);
                break;
            case 'security_summary':
                reportData = await this.generateSecuritySummary(tenantId, periodStart, periodEnd);
                break;
            default:
                throw new Error(`Unknown report type: ${reportType}`);
        }

        // Store the report
        const result = await this.pool.query(`
            INSERT INTO tenant_compliance_reports (
                tenant_id, report_type, report_name, period_start, period_end,
                status, report_data, generated_by, generated_at
            ) VALUES ($1, $2, $3, $4, $5, 'completed', $6, $7, NOW())
            RETURNING *
        `, [
            tenantId,
            reportType,
            `${reportType}_${periodStart}_${periodEnd}`,
            periodStart,
            periodEnd,
            JSON.stringify(reportData),
            generatedBy
        ]);

        return result.rows[0];
    }

    /**
     * Generate HIPAA audit report
     */
    async generateHipaaReport(tenantId, periodStart, periodEnd) {
        // PHI access summary
        const phiAccessResult = await this.pool.query(`
            SELECT
                user_email,
                user_role,
                resource_type,
                action,
                COUNT(*) as access_count
            FROM tenant_audit_logs
            WHERE tenant_id = $1
            AND is_phi_access = true
            AND created_at BETWEEN $2 AND $3
            GROUP BY user_email, user_role, resource_type, action
            ORDER BY access_count DESC
        `, [tenantId, periodStart, periodEnd]);

        // Security events
        const securityResult = await this.pool.query(`
            SELECT
                event_type,
                severity,
                COUNT(*) as event_count
            FROM tenant_security_events
            WHERE tenant_id = $1
            AND created_at BETWEEN $2 AND $3
            GROUP BY event_type, severity
            ORDER BY event_count DESC
        `, [tenantId, periodStart, periodEnd]);

        // User activity summary
        const userActivityResult = await this.pool.query(`
            SELECT
                user_email,
                COUNT(*) as total_actions,
                COUNT(*) FILTER (WHERE is_phi_access = true) as phi_accesses,
                COUNT(DISTINCT DATE(created_at)) as active_days
            FROM tenant_audit_logs
            WHERE tenant_id = $1
            AND created_at BETWEEN $2 AND $3
            GROUP BY user_email
            ORDER BY total_actions DESC
        `, [tenantId, periodStart, periodEnd]);

        return {
            periodStart,
            periodEnd,
            generatedAt: new Date().toISOString(),
            phiAccessSummary: phiAccessResult.rows,
            securityEventsSummary: securityResult.rows,
            userActivitySummary: userActivityResult.rows
        };
    }

    /**
     * Generate access report
     */
    async generateAccessReport(tenantId, periodStart, periodEnd) {
        const result = await this.pool.query(`
            SELECT
                DATE(created_at) as date,
                user_email,
                action,
                resource_type,
                COUNT(*) as count
            FROM tenant_audit_logs
            WHERE tenant_id = $1
            AND created_at BETWEEN $2 AND $3
            GROUP BY DATE(created_at), user_email, action, resource_type
            ORDER BY date DESC, count DESC
        `, [tenantId, periodStart, periodEnd]);

        return {
            periodStart,
            periodEnd,
            generatedAt: new Date().toISOString(),
            accessLogs: result.rows
        };
    }

    /**
     * Generate PHI disclosure report
     */
    async generatePhiDisclosureReport(tenantId, periodStart, periodEnd) {
        const result = await this.pool.query(`
            SELECT
                tal.created_at,
                tal.user_email,
                tal.user_role,
                tal.action,
                tal.resource_type,
                tal.resource_id,
                tal.ip_address,
                tal.metadata->>'patientId' as patient_id,
                tal.metadata->>'accessReason' as access_reason
            FROM tenant_audit_logs tal
            WHERE tal.tenant_id = $1
            AND tal.is_phi_access = true
            AND tal.created_at BETWEEN $2 AND $3
            ORDER BY tal.created_at DESC
        `, [tenantId, periodStart, periodEnd]);

        return {
            periodStart,
            periodEnd,
            generatedAt: new Date().toISOString(),
            totalDisclosures: result.rows.length,
            disclosures: result.rows
        };
    }

    /**
     * Generate security summary
     */
    async generateSecuritySummary(tenantId, periodStart, periodEnd) {
        // Failed logins
        const failedLoginsResult = await this.pool.query(`
            SELECT COUNT(*) as count
            FROM tenant_security_events
            WHERE tenant_id = $1
            AND event_type = 'failed_login'
            AND created_at BETWEEN $2 AND $3
        `, [tenantId, periodStart, periodEnd]);

        // Successful logins
        const successfulLoginsResult = await this.pool.query(`
            SELECT COUNT(*) as count
            FROM tenant_security_events
            WHERE tenant_id = $1
            AND event_type = 'successful_login'
            AND created_at BETWEEN $2 AND $3
        `, [tenantId, periodStart, periodEnd]);

        // Critical events
        const criticalEventsResult = await this.pool.query(`
            SELECT *
            FROM tenant_security_events
            WHERE tenant_id = $1
            AND severity IN ('high', 'critical')
            AND created_at BETWEEN $2 AND $3
            ORDER BY created_at DESC
            LIMIT 100
        `, [tenantId, periodStart, periodEnd]);

        return {
            periodStart,
            periodEnd,
            generatedAt: new Date().toISOString(),
            failedLogins: parseInt(failedLoginsResult.rows[0].count),
            successfulLogins: parseInt(successfulLoginsResult.rows[0].count),
            criticalEvents: criticalEventsResult.rows
        };
    }
}

/**
 * Audit middleware - automatically logs API requests
 */
function auditMiddleware(auditService) {
    return async (req, res, next) => {
        // Store original end function
        const originalEnd = res.end;

        // Capture response
        res.end = function(chunk, encoding) {
            res.end = originalEnd;
            res.end(chunk, encoding);

            // Log the request/response
            if (req.tenant && req.user) {
                // Determine action from HTTP method
                const actionMap = {
                    'GET': AuditAction.READ,
                    'POST': AuditAction.CREATE,
                    'PUT': AuditAction.UPDATE,
                    'PATCH': AuditAction.UPDATE,
                    'DELETE': AuditAction.DELETE
                };

                const action = actionMap[req.method] || AuditAction.READ;

                // Determine resource type from path
                const pathParts = req.path.split('/').filter(Boolean);
                const resourceType = pathParts[1] || 'unknown'; // /api/patients -> patients

                auditService.log({
                    tenantId: req.tenant.id,
                    userId: req.user.id,
                    userEmail: req.user.email,
                    userRole: req.user.role,
                    ipAddress: req.ip,
                    userAgent: req.headers['user-agent'],
                    action,
                    resourceType,
                    resourceId: req.params.id,
                    description: `${req.method} ${req.path}`,
                    metadata: {
                        statusCode: res.statusCode,
                        queryParams: req.query
                    },
                    severity: res.statusCode >= 400 ? AuditSeverity.MEDIUM : AuditSeverity.LOW,
                    requestId: req.requestId,
                    sessionId: req.user.sessionId,
                    endpoint: req.path,
                    httpMethod: req.method,
                    complianceFlags: req.tenant.complianceSettings
                });
            }
        };

        next();
    };
}

/**
 * Create audit service instance
 */
function createAuditService(pool) {
    return new AuditService(pool);
}

module.exports = {
    AuditService,
    createAuditService,
    auditMiddleware,
    AuditAction,
    AuditSeverity,
    SecurityEventType,
    ResourceType
};
