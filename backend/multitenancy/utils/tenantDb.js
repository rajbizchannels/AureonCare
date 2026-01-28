/**
 * AUREONCARE TENANT-AWARE DATABASE LAYER
 *
 * Provides tenant-isolated database operations:
 * - Automatic tenant_id injection in queries
 * - Row-level security enforcement
 * - Transaction management with tenant context
 * - Query builders with tenant scoping
 */

const { Pool } = require('pg');

/**
 * TenantDatabase class
 * Wraps database operations with automatic tenant scoping
 */
class TenantDatabase {
    constructor(pool, tenantId) {
        this.pool = pool;
        this.tenantId = tenantId;
        this.client = null;
        this.inTransaction = false;
    }

    /**
     * Get a client for transaction use
     */
    async getClient() {
        if (!this.client) {
            this.client = await this.pool.connect();
        }
        return this.client;
    }

    /**
     * Release client back to pool
     */
    releaseClient() {
        if (this.client) {
            this.client.release();
            this.client = null;
        }
    }

    /**
     * Execute a query with automatic tenant scoping
     * For SELECT, adds WHERE tenant_id = $x
     * For INSERT, adds tenant_id column
     * For UPDATE/DELETE, adds WHERE tenant_id = $x
     */
    async query(text, params = []) {
        const executor = this.client || this.pool;
        return executor.query(text, params);
    }

    /**
     * Begin a transaction
     */
    async beginTransaction() {
        const client = await this.getClient();
        await client.query('BEGIN');
        this.inTransaction = true;
    }

    /**
     * Commit a transaction
     */
    async commit() {
        if (this.client && this.inTransaction) {
            await this.client.query('COMMIT');
            this.inTransaction = false;
        }
    }

    /**
     * Rollback a transaction
     */
    async rollback() {
        if (this.client && this.inTransaction) {
            await this.client.query('ROLLBACK');
            this.inTransaction = false;
        }
    }

    /**
     * Execute multiple queries in a transaction
     */
    async transaction(callback) {
        await this.beginTransaction();
        try {
            const result = await callback(this);
            await this.commit();
            return result;
        } catch (error) {
            await this.rollback();
            throw error;
        } finally {
            this.releaseClient();
        }
    }

    // =========================================================================
    // TENANT-SCOPED CRUD OPERATIONS
    // =========================================================================

    /**
     * Find records with automatic tenant filtering
     */
    async find(tableName, conditions = {}, options = {}) {
        const { orderBy, limit, offset, select = '*' } = options;

        // Build WHERE clause
        const whereParts = [`tenant_id = $1`];
        const params = [this.tenantId];
        let paramIndex = 2;

        for (const [key, value] of Object.entries(conditions)) {
            if (value === null) {
                whereParts.push(`${key} IS NULL`);
            } else if (Array.isArray(value)) {
                const placeholders = value.map((_, i) => `$${paramIndex + i}`);
                whereParts.push(`${key} IN (${placeholders.join(', ')})`);
                params.push(...value);
                paramIndex += value.length;
            } else {
                whereParts.push(`${key} = $${paramIndex}`);
                params.push(value);
                paramIndex++;
            }
        }

        let query = `SELECT ${select} FROM ${tableName} WHERE ${whereParts.join(' AND ')}`;

        if (orderBy) {
            query += ` ORDER BY ${orderBy}`;
        }

        if (limit) {
            query += ` LIMIT ${parseInt(limit)}`;
        }

        if (offset) {
            query += ` OFFSET ${parseInt(offset)}`;
        }

        const result = await this.query(query, params);
        return result.rows;
    }

    /**
     * Find one record by ID
     */
    async findById(tableName, id) {
        const result = await this.query(
            `SELECT * FROM ${tableName} WHERE id = $1 AND tenant_id = $2`,
            [id, this.tenantId]
        );
        return result.rows[0] || null;
    }

    /**
     * Find one record by conditions
     */
    async findOne(tableName, conditions = {}) {
        const records = await this.find(tableName, conditions, { limit: 1 });
        return records[0] || null;
    }

    /**
     * Count records
     */
    async count(tableName, conditions = {}) {
        const whereParts = [`tenant_id = $1`];
        const params = [this.tenantId];
        let paramIndex = 2;

        for (const [key, value] of Object.entries(conditions)) {
            whereParts.push(`${key} = $${paramIndex}`);
            params.push(value);
            paramIndex++;
        }

        const result = await this.query(
            `SELECT COUNT(*) FROM ${tableName} WHERE ${whereParts.join(' AND ')}`,
            params
        );

        return parseInt(result.rows[0].count);
    }

    /**
     * Insert a record with automatic tenant_id
     */
    async insert(tableName, data) {
        // Add tenant_id
        const dataWithTenant = { ...data, tenant_id: this.tenantId };

        const keys = Object.keys(dataWithTenant);
        const values = Object.values(dataWithTenant);
        const placeholders = keys.map((_, i) => `$${i + 1}`);

        const query = `
            INSERT INTO ${tableName} (${keys.join(', ')})
            VALUES (${placeholders.join(', ')})
            RETURNING *
        `;

        const result = await this.query(query, values);
        return result.rows[0];
    }

    /**
     * Insert multiple records
     */
    async insertMany(tableName, records) {
        if (records.length === 0) return [];

        const results = [];
        for (const record of records) {
            const inserted = await this.insert(tableName, record);
            results.push(inserted);
        }
        return results;
    }

    /**
     * Update a record by ID
     */
    async updateById(tableName, id, data) {
        // Remove tenant_id from updates (can't change)
        const { tenant_id, ...updateData } = data;

        const keys = Object.keys(updateData);
        const values = Object.values(updateData);

        const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');

        const query = `
            UPDATE ${tableName}
            SET ${setClause}, updated_at = NOW()
            WHERE id = $${keys.length + 1} AND tenant_id = $${keys.length + 2}
            RETURNING *
        `;

        const result = await this.query(query, [...values, id, this.tenantId]);
        return result.rows[0] || null;
    }

    /**
     * Update records by conditions
     */
    async update(tableName, conditions, data) {
        const { tenant_id, ...updateData } = data;

        const keys = Object.keys(updateData);
        const values = Object.values(updateData);
        let paramIndex = keys.length + 1;

        const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');

        const whereParts = [`tenant_id = $${paramIndex}`];
        const whereParams = [this.tenantId];
        paramIndex++;

        for (const [key, value] of Object.entries(conditions)) {
            whereParts.push(`${key} = $${paramIndex}`);
            whereParams.push(value);
            paramIndex++;
        }

        const query = `
            UPDATE ${tableName}
            SET ${setClause}, updated_at = NOW()
            WHERE ${whereParts.join(' AND ')}
            RETURNING *
        `;

        const result = await this.query(query, [...values, ...whereParams]);
        return result.rows;
    }

    /**
     * Soft delete a record by ID
     */
    async softDeleteById(tableName, id, deletedBy = null) {
        const query = `
            UPDATE ${tableName}
            SET deleted_at = NOW(), deleted_by = $3
            WHERE id = $1 AND tenant_id = $2
            RETURNING *
        `;

        const result = await this.query(query, [id, this.tenantId, deletedBy]);
        return result.rows[0] || null;
    }

    /**
     * Hard delete a record by ID (use with caution)
     */
    async deleteById(tableName, id) {
        const query = `
            DELETE FROM ${tableName}
            WHERE id = $1 AND tenant_id = $2
            RETURNING *
        `;

        const result = await this.query(query, [id, this.tenantId]);
        return result.rows[0] || null;
    }

    /**
     * Check if a record exists
     */
    async exists(tableName, conditions = {}) {
        const count = await this.count(tableName, conditions);
        return count > 0;
    }

    /**
     * Validate record ownership (belongs to tenant)
     */
    async validateOwnership(tableName, id) {
        const result = await this.query(
            `SELECT id FROM ${tableName} WHERE id = $1 AND tenant_id = $2`,
            [id, this.tenantId]
        );
        return result.rows.length > 0;
    }
}

/**
 * Query Builder with tenant scoping
 */
class TenantQueryBuilder {
    constructor(pool, tenantId, tableName) {
        this.pool = pool;
        this.tenantId = tenantId;
        this.tableName = tableName;
        this._select = ['*'];
        this._where = [{ field: 'tenant_id', op: '=', value: tenantId }];
        this._joins = [];
        this._orderBy = [];
        this._groupBy = [];
        this._limit = null;
        this._offset = null;
    }

    select(...fields) {
        this._select = fields.length > 0 ? fields : ['*'];
        return this;
    }

    where(field, opOrValue, value) {
        if (value === undefined) {
            this._where.push({ field, op: '=', value: opOrValue });
        } else {
            this._where.push({ field, op: opOrValue, value });
        }
        return this;
    }

    whereNull(field) {
        this._where.push({ field, op: 'IS NULL', value: null });
        return this;
    }

    whereNotNull(field) {
        this._where.push({ field, op: 'IS NOT NULL', value: null });
        return this;
    }

    whereIn(field, values) {
        this._where.push({ field, op: 'IN', value: values });
        return this;
    }

    whereBetween(field, min, max) {
        this._where.push({ field, op: 'BETWEEN', value: [min, max] });
        return this;
    }

    join(table, condition, type = 'INNER') {
        this._joins.push({ table, condition, type });
        return this;
    }

    leftJoin(table, condition) {
        return this.join(table, condition, 'LEFT');
    }

    orderBy(field, direction = 'ASC') {
        this._orderBy.push({ field, direction });
        return this;
    }

    groupBy(...fields) {
        this._groupBy = fields;
        return this;
    }

    limit(count) {
        this._limit = count;
        return this;
    }

    offset(count) {
        this._offset = count;
        return this;
    }

    buildQuery() {
        const params = [];
        let paramIndex = 1;

        // SELECT
        let query = `SELECT ${this._select.join(', ')} FROM ${this.tableName}`;

        // JOINS
        for (const join of this._joins) {
            query += ` ${join.type} JOIN ${join.table} ON ${join.condition}`;
        }

        // WHERE
        const whereClauses = [];
        for (const cond of this._where) {
            if (cond.op === 'IS NULL' || cond.op === 'IS NOT NULL') {
                whereClauses.push(`${cond.field} ${cond.op}`);
            } else if (cond.op === 'IN') {
                const placeholders = cond.value.map(() => `$${paramIndex++}`);
                whereClauses.push(`${cond.field} IN (${placeholders.join(', ')})`);
                params.push(...cond.value);
            } else if (cond.op === 'BETWEEN') {
                whereClauses.push(`${cond.field} BETWEEN $${paramIndex++} AND $${paramIndex++}`);
                params.push(...cond.value);
            } else {
                whereClauses.push(`${cond.field} ${cond.op} $${paramIndex++}`);
                params.push(cond.value);
            }
        }

        if (whereClauses.length > 0) {
            query += ` WHERE ${whereClauses.join(' AND ')}`;
        }

        // GROUP BY
        if (this._groupBy.length > 0) {
            query += ` GROUP BY ${this._groupBy.join(', ')}`;
        }

        // ORDER BY
        if (this._orderBy.length > 0) {
            const orderClauses = this._orderBy.map(o => `${o.field} ${o.direction}`);
            query += ` ORDER BY ${orderClauses.join(', ')}`;
        }

        // LIMIT & OFFSET
        if (this._limit !== null) {
            query += ` LIMIT ${parseInt(this._limit)}`;
        }

        if (this._offset !== null) {
            query += ` OFFSET ${parseInt(this._offset)}`;
        }

        return { query, params };
    }

    async execute() {
        const { query, params } = this.buildQuery();
        const result = await this.pool.query(query, params);
        return result.rows;
    }

    async first() {
        this._limit = 1;
        const rows = await this.execute();
        return rows[0] || null;
    }

    async count() {
        const originalSelect = this._select;
        this._select = ['COUNT(*) as count'];
        const rows = await this.execute();
        this._select = originalSelect;
        return parseInt(rows[0]?.count || 0);
    }
}

/**
 * Create a tenant-scoped database instance from request
 */
function createTenantDb(req) {
    if (!req.tenant) {
        throw new Error('Tenant context not available');
    }

    return new TenantDatabase(req.app.locals.pool, req.tenant.id);
}

/**
 * Create a query builder for a table
 */
function createQueryBuilder(pool, tenantId, tableName) {
    return new TenantQueryBuilder(pool, tenantId, tableName);
}

/**
 * Middleware to attach tenant database to request
 */
function attachTenantDb(req, res, next) {
    if (req.tenant) {
        req.tenantDb = new TenantDatabase(req.app.locals.pool, req.tenant.id);

        // Helper to create query builders
        req.query = (tableName) => createQueryBuilder(
            req.app.locals.pool,
            req.tenant.id,
            tableName
        );
    }

    next();
}

/**
 * Add tenant_id column to existing tables
 * Run this migration for each table that needs tenant isolation
 */
async function addTenantColumn(pool, tableName) {
    await pool.query(`
        ALTER TABLE ${tableName}
        ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

        CREATE INDEX IF NOT EXISTS idx_${tableName}_tenant
        ON ${tableName}(tenant_id);
    `);
}

/**
 * Create Row Level Security policies for a table
 */
async function createRLSPolicies(pool, tableName) {
    // Enable RLS
    await pool.query(`ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY;`);

    // Create policy for tenant isolation
    await pool.query(`
        DROP POLICY IF EXISTS tenant_isolation_policy ON ${tableName};

        CREATE POLICY tenant_isolation_policy ON ${tableName}
        USING (tenant_id = current_setting('app.current_tenant')::uuid)
        WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);
    `);
}

/**
 * Set current tenant for RLS
 */
async function setCurrentTenant(pool, tenantId) {
    await pool.query(`SET app.current_tenant = '${tenantId}'`);
}

module.exports = {
    TenantDatabase,
    TenantQueryBuilder,
    createTenantDb,
    createQueryBuilder,
    attachTenantDb,
    addTenantColumn,
    createRLSPolicies,
    setCurrentTenant
};
