require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'medflow',
  user: process.env.DB_USER || 'medflow_user',
  password: process.env.DB_PASSWORD || '',
  options: '-c search_path=public',
});

async function runMigration(migrationFile) {
  console.log(`Running migration: ${migrationFile}\n`);

  let client;

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', migrationFile);
    const sql = await fs.readFile(migrationPath, 'utf8');

    console.log('Connecting to database...');
    client = await pool.connect();
    console.log('✓ Connected\n');

    console.log('Executing migration SQL...');
    await client.query(sql);
    console.log('✓ Migration executed successfully!\n');

  } catch (error) {
    console.error('\n✗ Migration failed:', error.message);
    console.error('\nFull error:', error);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// Get migration file from command line argument
const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('Usage: node run-single-migration.js <migration-file>');
  console.error('Example: node run-single-migration.js 032_add_insurance_payer_to_patients.sql');
  process.exit(1);
}

runMigration(migrationFile).catch(err => {
  console.error('\n✗✗✗ Fatal error ✗✗✗');
  console.error(err);
  process.exit(1);
});
