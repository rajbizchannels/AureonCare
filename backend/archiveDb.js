require('dotenv').config();
const { Pool } = require('pg');

/**
 * Archive Database Connection Pool
 *
 * This separate database is used to store archived data from the main database.
 * It provides long-term storage and allows browsing archived data without
 * affecting the main production database.
 *
 * Configuration:
 * - Uses ARCHIVE_DB_* environment variables
 * - Falls back to main DB with "_archive" suffix if not configured
 * - Same structure as main database
 */

const archivePool = new Pool({
  host: process.env.ARCHIVE_DB_HOST || process.env.DB_HOST || 'localhost',
  port: process.env.ARCHIVE_DB_PORT || process.env.DB_PORT || 5432,
  database: process.env.ARCHIVE_DB_NAME || (process.env.DB_NAME || 'medflow') + '_archive',
  user: process.env.ARCHIVE_DB_USER || process.env.DB_USER || 'postgres',
  password: process.env.ARCHIVE_DB_PASSWORD || process.env.DB_PASSWORD || 'MedFlow2024!',
  max: 10, // Smaller pool size for archive database
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  options: '-c search_path=public',
});

// Handle pool errors
archivePool.on('error', (err) => {
  console.error('Unexpected error on idle archive database client', err);
  // Don't exit process for archive DB errors - main DB should continue working
});

// Test connection and log status
archivePool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('⚠️  Archive database connection failed:', err.message);
    console.error('   Archive functionality will be limited.');
  } else {
    console.log('✓ Archive database connected:', archivePool.options.database);
  }
});

/**
 * Copy table structure from main database to archive database
 * @param {Pool} mainPool - Main database pool
 * @param {string} tableName - Name of table to copy structure
 */
async function ensureTableStructure(mainPool, tableName) {
  const client = await archivePool.connect();
  try {
    // Check if table exists in main database first
    const mainClient = await mainPool.connect();
    try {
      const mainCheckQuery = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = $1
        );
      `;
      const mainCheckResult = await mainClient.query(mainCheckQuery, [tableName]);

      if (!mainCheckResult.rows[0].exists) {
        console.log(`⚠️  Table ${tableName} does not exist in main database - skipping`);
        return false;
      }

      // Check if table exists in archive database
      const checkQuery = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = $1
        );
      `;
      const checkResult = await client.query(checkQuery, [tableName]);

      if (!checkResult.rows[0].exists) {
        // Get detailed column information including defaults and data types
        const columnsQuery = `
          SELECT
            column_name,
            CASE
              WHEN data_type = 'ARRAY' THEN udt_name || '[]'
              WHEN data_type = 'character varying' THEN 'VARCHAR(' || COALESCE(character_maximum_length::text, '255') || ')'
              WHEN data_type = 'character' THEN 'CHAR(' || character_maximum_length || ')'
              WHEN data_type = 'numeric' THEN 'NUMERIC' ||
                CASE WHEN numeric_precision IS NOT NULL
                THEN '(' || numeric_precision || ',' || numeric_scale || ')'
                ELSE '' END
              WHEN data_type = 'USER-DEFINED' THEN udt_name
              ELSE UPPER(data_type)
            END as full_type,
            is_nullable,
            column_default
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = $1
          ORDER BY ordinal_position;
        `;

        const columnsResult = await mainClient.query(columnsQuery, [tableName]);

        if (columnsResult.rows.length > 0) {
          // Build CREATE TABLE statement
          const columnDefs = columnsResult.rows.map(col => {
            let def = `${col.column_name} ${col.full_type}`;

            if (col.is_nullable === 'NO') {
              def += ' NOT NULL';
            }

            if (col.column_default) {
              def += ` DEFAULT ${col.column_default}`;
            }

            return def;
          }).join(',\n  ');

          const createStatement = `CREATE TABLE ${tableName} (\n  ${columnDefs}\n);`;

          console.log(`[Archive DB] Creating table ${tableName} in archive database...`);
          await client.query(createStatement);
          console.log(`[Archive DB] ✓ Created table ${tableName}`);
          return true;
        } else {
          console.log(`⚠️  No columns found for table ${tableName}`);
          return false;
        }
      } else {
        // Table exists, verify column compatibility
        console.log(`[Archive DB] Table ${tableName} already exists in archive database`);
        return true;
      }
    } finally {
      mainClient.release();
    }
  } catch (error) {
    console.error(`[Archive DB] Error ensuring table structure for ${tableName}:`, error.message);
    return false;
  } finally {
    client.release();
  }
}

/**
 * Get list of all tables in archive database
 */
async function getArchiveTables() {
  const query = `
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `;

  const result = await archivePool.query(query);
  return result.rows.map(row => row.table_name);
}

/**
 * Get record count for a table in archive database
 */
async function getTableRecordCount(tableName) {
  const query = `SELECT COUNT(*) as count FROM ${tableName}`;
  const result = await archivePool.query(query);
  return parseInt(result.rows[0].count);
}

module.exports = {
  archivePool,
  ensureTableStructure,
  getArchiveTables,
  getTableRecordCount
};
