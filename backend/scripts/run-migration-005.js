require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

console.log('Running migration 005: Add medical attributes to patients table\n');

const dbPassword = process.env.DB_PASSWORD || '';

if (!dbPassword) {
  console.error('ERROR: DB_PASSWORD is not set in .env file!');
  process.exit(1);
}

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'medflow',
  user: process.env.DB_USER || 'medflow_user',
  password: dbPassword.toString(),
  // Explicitly set search_path to ensure tables are found
  options: '-c search_path=public',
});

async function runMigration() {
  let client;

  try {
    console.log('Connecting to database...');
    client = await pool.connect();
    console.log('✓ Connected\n');

    // Read migration file
    const migrationPath = path.join(__dirname, '../migrations/005_create_prescriptions_diagnosis_tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('Running migration SQL...\n');
    await client.query(migrationSQL);

    console.log('\n✓✓✓ Migration 005 completed successfully! ✓✓✓\n');

  } catch (error) {
    console.error('\n✗ Error running migration:', error.message);
    console.error(error);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

runMigration().catch(err => {
  console.error('\n✗✗✗ Fatal error ✗✗✗');
  console.error(err);
  process.exit(1);
});
