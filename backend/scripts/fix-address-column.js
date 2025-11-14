require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Ensure password is a string
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

async function fixAddressColumn() {
  console.log('Fixing patients address column type...\n');

  let client;

  try {
    client = await pool.connect();
    console.log('✓ Database connected successfully\n');

    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '016_fix_patients_address_column.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('Running migration 016_fix_patients_address_column.sql...');
    await client.query('BEGIN');
    await client.query(migrationSQL);
    await client.query('COMMIT');

    console.log('✓ Migration completed successfully!\n');
    console.log('The patients.address column has been changed from JSONB to TEXT.');
    console.log('Existing JSON addresses have been converted to plain text strings.\n');

  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
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

fixAddressColumn().catch(err => {
  console.error('\n✗✗✗ Fatal error ✗✗✗');
  console.error(err);
  process.exit(1);
});
