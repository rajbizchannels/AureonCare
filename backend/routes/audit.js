const express = require('express');
const router = express.Router();

// Get pool from app.locals (shared pool from server.js)
let pool;

// Cache for table existence check (expires after 5 minutes)
let tableExistsCache = {
  exists: null,
  timestamp: 0,
  ttl: 5 * 60 * 1000, // 5 minutes
};

/**
 * Middleware to check if audit_logs table exists
 * Uses caching to avoid excessive database queries
 */
const checkAuditTableExists = async (req, res, next) => {
  try {
    // Get pool from app.locals if not already set
    if (!pool) {
      pool = req.app.locals.pool;
    }

    const now = Date.now();

    // Check cache first
    if (tableExistsCache.exists !== null && (now - tableExistsCache.timestamp) < tableExistsCache.ttl) {
      if (!tableExistsCache.exists) {
        return res.status(503).json({
          error: 'Audit logs table not found',
          message: 'Please run migration 040_create_audit_logs_table.sql to create the audit_logs table',
          migration: 'backend/migrations/040_create_audit_logs_table.sql',
        });
      }
      // Table exists, continue
      return next();
    }

    // Cache miss or expired - check database
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename = 'audit_logs'
      );
    `);

    tableExistsCache.exists = tableCheck.rows[0].exists;
    tableExistsCache.timestamp = now;

    if (!tableExistsCache.exists) {
      return res.status(503).json({
        error: 'Audit logs table not found',
        message: 'Please run migration 040_create_audit_logs_table.sql to create the audit_logs table',
        migration: 'backend/migrations/040_create_audit_logs_table.sql',
      });
    }

    next();
  } catch (error) {
    console.error('Error checking audit table existence:', error);

    // Check if error is due to missing table
    if (error.message && error.message.includes('relation "audit_logs" does not exist')) {
      tableExistsCache.exists = false;
      tableExistsCache.timestamp = Date.now();

      return res.status(503).json({
        error: 'Audit logs table not found',
        message: 'Please run migration 040_create_audit_logs_table.sql to create the audit_logs table',
        migration: 'backend/migrations/040_create_audit_logs_table.sql',
      });
    }

    // Other errors - pass to error handler
    return res.status(500).json({
      error: 'Failed to check audit table',
      details: error.message,
    });
  }
};

/**
 * Create an audit log entry
 * POST /api/audit
 *
 * Body:
 * {
 *   action_type: string (required) - 'view', 'create', 'update', 'delete', 'submit', 'open', 'close'
 *   resource_type: string (required) - 'form', 'modal', 'view'
 *   resource_name: string (required) - Name of the component
 *   resource_id: string (optional) - ID of the specific instance
 *   action_description: string (optional)
 *   module: string (optional)
 *   old_values: object (optional)
 *   new_values: object (optional)
 *   changed_fields: array (optional)
 *   patient_id: uuid (optional)
 *   provider_id: uuid (optional)
 *   appointment_id: uuid (optional)
 *   claim_id: uuid (optional)
 *   status: string (optional) - defaults to 'success'
 *   error_message: string (optional)
 *   duration_ms: number (optional)
 *   metadata: object (optional)
 * }
 */
router.post('/', async (req, res) => {
  try {
    // Get pool from app.locals if not already set
    if (!pool) {
      pool = req.app.locals.pool;
    }

    const {
      // User information (from frontend)
      user_id: body_user_id,
      user_email: body_user_email,
      user_name: body_user_name,
      user_role: body_user_role,

      // Action information
      action_type,
      resource_type,
      resource_name,
      resource_id,
      action_description,
      module,
      old_values,
      new_values,
      changed_fields,

      // Related entities
      patient_id,
      provider_id,
      appointment_id,
      claim_id,

      // Status
      status = 'success',
      error_message,
      duration_ms,
      metadata = {},
    } = req.body;

    // Validation
    if (!action_type || !resource_type || !resource_name) {
      return res.status(400).json({
        error: 'Missing required fields: action_type, resource_type, resource_name',
      });
    }

    // Get user information - prefer body over session
    const user_id = body_user_id || req.user?.id || null;
    const user_email = body_user_email || req.user?.email || null;
    const user_name = body_user_name ||
      (req.user?.name) ||
      (req.user?.first_name && req.user?.last_name ? `${req.user.first_name} ${req.user.last_name}` : null);
    const user_role = body_user_role || req.user?.role || null;

    // Get request metadata
    const ip_address = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const user_agent = req.headers['user-agent'];
    const session_id = req.session?.id || req.headers['x-session-id'] || null;

    const query = `
      INSERT INTO audit_logs (
        user_id, user_email, user_name, user_role, session_id, ip_address, user_agent,
        action_type, resource_type, resource_name, resource_id, action_description, module,
        old_values, new_values, changed_fields, patient_id, provider_id, appointment_id, claim_id,
        status, error_message, duration_ms, metadata
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24
      ) RETURNING *
    `;

    const values = [
      user_id, user_email, user_name, user_role, session_id, ip_address, user_agent,
      action_type, resource_type, resource_name, resource_id, action_description, module,
      old_values ? JSON.stringify(old_values) : null,
      new_values ? JSON.stringify(new_values) : null,
      changed_fields || null,
      patient_id || null,
      provider_id || null,
      appointment_id || null,
      claim_id || null,
      status,
      error_message || null,
      duration_ms || null,
      JSON.stringify(metadata),
    ];

    const result = await pool.query(query, values);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating audit log:', error);
    res.status(500).json({ error: 'Failed to create audit log' });
  }
});

/**
 * Get audit logs with filtering and pagination
 * GET /api/audit
 *
 * Query params:
 * - user_id: Filter by user ID
 * - user_email: Filter by user email
 * - action_type: Filter by action type
 * - resource_type: Filter by resource type (form/modal/view)
 * - resource_name: Filter by specific resource name
 * - module: Filter by module
 * - patient_id: Filter by patient
 * - provider_id: Filter by provider
 * - status: Filter by status
 * - start_date: Filter by start date (ISO 8601)
 * - end_date: Filter by end date (ISO 8601)
 * - limit: Number of results (default 100, max 1000)
 * - offset: Offset for pagination
 * - sort: Sort field (default: created_at)
 * - order: Sort order (asc/desc, default: desc)
 */
router.get('/', checkAuditTableExists, async (req, res) => {
  try {
    const {
      user_id,
      user_email,
      action_type,
      resource_type,
      resource_name,
      module,
      patient_id,
      provider_id,
      status,
      start_date,
      end_date,
      limit = 100,
      offset = 0,
      sort = 'created_at',
      order = 'desc',
    } = req.query;

    // Build WHERE clause dynamically
    const conditions = [];
    const values = [];
    let paramCount = 1;

    if (user_id) {
      conditions.push(`user_id = $${paramCount++}`);
      values.push(user_id);
    }

    if (user_email) {
      conditions.push(`user_email ILIKE $${paramCount++}`);
      values.push(`%${user_email}%`);
    }

    if (action_type) {
      conditions.push(`action_type = $${paramCount++}`);
      values.push(action_type);
    }

    if (resource_type) {
      conditions.push(`resource_type = $${paramCount++}`);
      values.push(resource_type);
    }

    if (resource_name) {
      conditions.push(`resource_name ILIKE $${paramCount++}`);
      values.push(`%${resource_name}%`);
    }

    if (module) {
      conditions.push(`module = $${paramCount++}`);
      values.push(module);
    }

    if (patient_id) {
      conditions.push(`patient_id = $${paramCount++}`);
      values.push(patient_id);
    }

    if (provider_id) {
      conditions.push(`provider_id = $${paramCount++}`);
      values.push(provider_id);
    }

    if (status) {
      conditions.push(`status = $${paramCount++}`);
      values.push(status);
    }

    if (start_date) {
      conditions.push(`created_at >= $${paramCount++}`);
      values.push(start_date);
    }

    if (end_date) {
      conditions.push(`created_at <= $${paramCount++}`);
      values.push(end_date);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Validate and sanitize sort field
    const allowedSortFields = ['created_at', 'user_email', 'action_type', 'resource_name', 'module'];
    const sortField = allowedSortFields.includes(sort) ? sort : 'created_at';
    const sortOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // Limit pagination
    const safeLimit = Math.min(parseInt(limit) || 100, 1000);
    const safeOffset = parseInt(offset) || 0;

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM audit_logs ${whereClause}`;
    const countResult = await pool.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count);

    // Get paginated results
    const query = `
      SELECT * FROM audit_logs
      ${whereClause}
      ORDER BY ${sortField} ${sortOrder}
      LIMIT $${paramCount++} OFFSET $${paramCount++}
    `;

    values.push(safeLimit, safeOffset);

    const result = await pool.query(query, values);

    res.json({
      data: result.rows,
      pagination: {
        total,
        limit: safeLimit,
        offset: safeOffset,
        pages: Math.ceil(total / safeLimit),
        currentPage: Math.floor(safeOffset / safeLimit) + 1,
      },
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);

    // Check if error is due to missing table
    if (error.message && error.message.includes('relation "audit_logs" does not exist')) {
      return res.status(503).json({
        error: 'Audit logs table not found',
        message: 'Please run migration 040_create_audit_logs_table.sql to create the audit_logs table',
        migration: 'backend/migrations/040_create_audit_logs_table.sql',
      });
    }

    res.status(500).json({
      error: 'Failed to fetch audit logs',
      details: error.message,
    });
  }
});

/**
 * Get audit log by ID
 * GET /api/audit/:id
 */
router.get('/:id', checkAuditTableExists, async (req, res) => {
  try {
    const { id } = req.params;

    const query = 'SELECT * FROM audit_logs WHERE id = $1';
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Audit log not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching audit log:', error);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

/**
 * Get audit statistics
 * GET /api/audit/stats/summary
 *
 * Returns aggregated statistics for dashboards
 */
router.get('/stats/summary', checkAuditTableExists, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    const conditions = [];
    const values = [];
    let paramCount = 1;

    if (start_date) {
      conditions.push(`created_at >= $${paramCount++}`);
      values.push(start_date);
    }

    if (end_date) {
      conditions.push(`created_at <= $${paramCount++}`);
      values.push(end_date);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT
        COUNT(*) as total_actions,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(*) FILTER (WHERE action_type = 'view') as views,
        COUNT(*) FILTER (WHERE action_type = 'create') as creates,
        COUNT(*) FILTER (WHERE action_type = 'update') as updates,
        COUNT(*) FILTER (WHERE action_type = 'delete') as deletes,
        COUNT(*) FILTER (WHERE resource_type = 'form') as form_actions,
        COUNT(*) FILTER (WHERE resource_type = 'modal') as modal_actions,
        COUNT(*) FILTER (WHERE resource_type = 'view') as view_actions,
        COUNT(*) FILTER (WHERE status = 'error') as errors,
        AVG(duration_ms) as avg_duration_ms
      FROM audit_logs
      ${whereClause}
    `;

    const result = await pool.query(query, values);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching audit statistics:', error);

    // Check if error is due to missing table
    if (error.message && error.message.includes('relation "audit_logs" does not exist')) {
      return res.status(503).json({
        error: 'Audit logs table not found',
        message: 'Please run migration 040_create_audit_logs_table.sql to create the audit_logs table',
        migration: 'backend/migrations/040_create_audit_logs_table.sql',
      });
    }

    res.status(500).json({
      error: 'Failed to fetch statistics',
      details: error.message,
    });
  }
});

/**
 * Get most active users
 * GET /api/audit/stats/top-users
 */
router.get('/stats/top-users', checkAuditTableExists, async (req, res) => {
  try {
    const { limit = 10, start_date, end_date } = req.query;

    const conditions = [];
    const values = [];
    let paramCount = 1;

    if (start_date) {
      conditions.push(`created_at >= $${paramCount++}`);
      values.push(start_date);
    }

    if (end_date) {
      conditions.push(`created_at <= $${paramCount++}`);
      values.push(end_date);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT
        user_email,
        user_name,
        user_role,
        COUNT(*) as action_count,
        MAX(created_at) as last_activity
      FROM audit_logs
      ${whereClause}
      GROUP BY user_email, user_name, user_role
      ORDER BY action_count DESC
      LIMIT $${paramCount++}
    `;

    values.push(parseInt(limit) || 10);

    const result = await pool.query(query, values);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching top users:', error);
    res.status(500).json({ error: 'Failed to fetch top users' });
  }
});

/**
 * Get most accessed resources
 * GET /api/audit/stats/top-resources
 */
router.get('/stats/top-resources', checkAuditTableExists, async (req, res) => {
  try {
    const { limit = 10, start_date, end_date } = req.query;

    const conditions = [];
    const values = [];
    let paramCount = 1;

    if (start_date) {
      conditions.push(`created_at >= $${paramCount++}`);
      values.push(start_date);
    }

    if (end_date) {
      conditions.push(`created_at <= $${paramCount++}`);
      values.push(end_date);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT
        resource_type,
        resource_name,
        module,
        COUNT(*) as access_count,
        COUNT(DISTINCT user_id) as unique_users,
        MAX(created_at) as last_accessed
      FROM audit_logs
      ${whereClause}
      GROUP BY resource_type, resource_name, module
      ORDER BY access_count DESC
      LIMIT $${paramCount++}
    `;

    values.push(parseInt(limit) || 10);

    const result = await pool.query(query, values);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching top resources:', error);
    res.status(500).json({ error: 'Failed to fetch top resources' });
  }
});

/**
 * Delete old audit logs (retention policy)
 * DELETE /api/audit/cleanup
 *
 * Query params:
 * - days: Number of days to retain (default: 90)
 */
router.delete('/cleanup', async (req, res) => {
  try {
    const { days = 90 } = req.query;

    const query = `
      DELETE FROM audit_logs
      WHERE created_at < NOW() - INTERVAL '${parseInt(days)} days'
      RETURNING id
    `;

    const result = await pool.query(query);

    res.json({
      message: `Deleted ${result.rowCount} audit log entries older than ${days} days`,
      deleted_count: result.rowCount,
    });
  } catch (error) {
    console.error('Error cleaning up audit logs:', error);
    res.status(500).json({ error: 'Failed to cleanup audit logs' });
  }
});

/**
 * Export audit logs to CSV
 * GET /api/audit/export/csv
 *
 * Uses same query params as GET /api/audit
 */
router.get('/export/csv', async (req, res) => {
  try {
    const {
      user_id,
      user_email,
      action_type,
      resource_type,
      resource_name,
      module,
      patient_id,
      provider_id,
      status,
      start_date,
      end_date,
    } = req.query;

    // Build WHERE clause (same as GET endpoint)
    const conditions = [];
    const values = [];
    let paramCount = 1;

    if (user_id) {
      conditions.push(`user_id = $${paramCount++}`);
      values.push(user_id);
    }

    if (user_email) {
      conditions.push(`user_email ILIKE $${paramCount++}`);
      values.push(`%${user_email}%`);
    }

    if (action_type) {
      conditions.push(`action_type = $${paramCount++}`);
      values.push(action_type);
    }

    if (resource_type) {
      conditions.push(`resource_type = $${paramCount++}`);
      values.push(resource_type);
    }

    if (resource_name) {
      conditions.push(`resource_name ILIKE $${paramCount++}`);
      values.push(`%${resource_name}%`);
    }

    if (module) {
      conditions.push(`module = $${paramCount++}`);
      values.push(module);
    }

    if (patient_id) {
      conditions.push(`patient_id = $${paramCount++}`);
      values.push(patient_id);
    }

    if (provider_id) {
      conditions.push(`provider_id = $${paramCount++}`);
      values.push(provider_id);
    }

    if (status) {
      conditions.push(`status = $${paramCount++}`);
      values.push(status);
    }

    if (start_date) {
      conditions.push(`created_at >= $${paramCount++}`);
      values.push(start_date);
    }

    if (end_date) {
      conditions.push(`created_at <= $${paramCount++}`);
      values.push(end_date);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT
        id, user_email, user_name, user_role, action_type, resource_type,
        resource_name, resource_id, action_description, module, status,
        error_message, created_at
      FROM audit_logs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT 10000
    `;

    const result = await pool.query(query, values);

    // Build CSV
    const headers = ['ID', 'User Email', 'User Name', 'Role', 'Action', 'Resource Type',
      'Resource Name', 'Resource ID', 'Description', 'Module', 'Status', 'Error', 'Created At'];

    let csv = headers.join(',') + '\n';

    result.rows.forEach(row => {
      const values = [
        row.id,
        row.user_email || '',
        row.user_name || '',
        row.user_role || '',
        row.action_type,
        row.resource_type,
        row.resource_name,
        row.resource_id || '',
        (row.action_description || '').replace(/"/g, '""'),
        row.module || '',
        row.status,
        (row.error_message || '').replace(/"/g, '""'),
        row.created_at,
      ];

      csv += values.map(v => `"${v}"`).join(',') + '\n';
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=audit-logs-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting audit logs:', error);
    res.status(500).json({ error: 'Failed to export audit logs' });
  }
});

module.exports = router;
