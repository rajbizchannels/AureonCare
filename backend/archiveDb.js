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
      // Get CREATE TABLE statement from main database
      const mainClient = await mainPool.connect();
      try {
        // Get table definition
        const createTableQuery = `
          SELECT
            'CREATE TABLE ' || quote_ident(table_name) || ' (' ||
            string_agg(
              quote_ident(column_name) || ' ' ||
              data_type ||
              CASE
                WHEN character_maximum_length IS NOT NULL
                THEN '(' || character_maximum_length || ')'
                ELSE ''
              END ||
              CASE
                WHEN is_nullable = 'NO' THEN ' NOT NULL'
                ELSE ''
              END,
              ', '
            ) || ');' as create_statement
          FROM information_schema.columns
          WHERE table_name = $1
          GROUP BY table_name;
        `;

        const result = await mainClient.query(createTableQuery, [tableName]);

        if (result.rows.length > 0) {
          // Create table in archive database
          await client.query(result.rows[0].create_statement);
          console.log(`Created table ${tableName} in archive database`);
        }
      } finally {
        mainClient.release();
      }
    }
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
