/**
 * Clean Archive Database Script
 *
 * Drops all tables from the archive database and recreates the archive_metadata table
 * This allows the archiving system to recreate tables with proper structure
 */

require('dotenv').config();
const { Pool } = require('pg');

// Archive database connection
const archivePool = new Pool({
  host: process.env.ARCHIVE_DB_HOST || process.env.DB_HOST || 'localhost',
  port: process.env.ARCHIVE_DB_PORT || process.env.DB_PORT || 5432,
  database: process.env.ARCHIVE_DB_NAME || (process.env.DB_NAME || 'aureoncare') + '_archive',
  user: process.env.ARCHIVE_DB_USER || process.env.DB_USER || 'postgres',
  password: process.env.ARCHIVE_DB_PASSWORD || process.env.DB_PASSWORD || 'MedFlow2024!',
});

async function cleanArchiveDatabase() {
  try {
    console.log('\n========================================');
    console.log('Archive Database Cleanup');
    console.log('========================================\n');
    console.log(`Database: ${archivePool.options.database}`);
    console.log(`Host: ${archivePool.options.host}:${archivePool.options.port}\n`);

    // Test connection
    await archivePool.query('SELECT NOW()');
    console.log('✓ Connected to archive database\n');

    // Enable extensions first
    console.log('Enabling required extensions...');
    await archivePool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    await archivePool.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');
    console.log('✓ Extensions enabled\n');

    // Get all tables in the archive database
    console.log('Finding all tables in archive database...');
    const tablesQuery = `
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `;
    const result = await archivePool.query(tablesQuery);
    const tables = result.rows.map(row => row.tablename);

    console.log(`Found ${tables.length} tables:\n`);
    tables.forEach(table => console.log(`  - ${table}`));
    console.log('');

    if (tables.length === 0) {
      console.log('No tables to drop. Database is already clean.\n');
    } else {
      // Drop all tables
      console.log('Dropping all tables...\n');
      for (const table of tables) {
        try {
          await archivePool.query(`DROP TABLE IF EXISTS ${table} CASCADE;`);
          console.log(`  ✓ Dropped table: ${table}`);
        } catch (error) {
          console.error(`  ✗ Error dropping ${table}:`, error.message);
        }
      }
      console.log('');
    }

    // Recreate archive_metadata table
    console.log('Creating archive_metadata table...');
    const createMetadataTable = `
      CREATE TABLE IF NOT EXISTS archive_metadata (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        archive_name VARCHAR(255) NOT NULL,
        description TEXT,
        archived_tables TEXT[],
        archived_modules TEXT[],
        record_counts JSONB,
        archive_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(50) DEFAULT 'active',
        archived_by UUID,
        metadata JSONB
      );
    `;
    await archivePool.query(createMetadataTable);
    console.log('✓ Created archive_metadata table\n');

    // Create indexes on archive_metadata
    console.log('Creating indexes...');
    await archivePool.query(`
      CREATE INDEX IF NOT EXISTS idx_archive_metadata_date
      ON archive_metadata(archive_date DESC);
    `);
    await archivePool.query(`
      CREATE INDEX IF NOT EXISTS idx_archive_metadata_status
      ON archive_metadata(status);
    `);
    console.log('✓ Created indexes\n');

    console.log('========================================');
    console.log('Archive Database Cleanup Complete!');
    console.log('========================================\n');
    console.log('Next steps:');
    console.log('1. Restart the backend server');
    console.log('2. Create a new archive via UI or API');
    console.log('3. Tables will be recreated with proper structure\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await archivePool.end();
  }
}

// Run cleanup
cleanArchiveDatabase();
