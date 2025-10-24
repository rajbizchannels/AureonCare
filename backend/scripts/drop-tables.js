require('dotenv').config();
const { Pool } = require('pg');

console.log('⚠️  WARNING: This script will DROP ALL TABLES in the database!');
console.log('⚠️  All data will be permanently deleted!\n');

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
});

async function dropAllTables() {
  let client;

  try {
    console.log('Connecting to database...');
    client = await pool.connect();
    console.log('✓ Connected\n');

    await client.query('BEGIN');

    console.log('Dropping all tables...\n');

    // Drop tables in reverse order of dependencies
    const tables = [
      'social_auth',
      'patient_portal_sessions',
      'medical_records',
      'fhir_resources',
      'telehealth_sessions',
      'claims',
      'appointments',
      'patients',
      'practices',
      'users'
    ];

    for (const table of tables) {
      try {
        await client.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
        console.log(`✓ Dropped table: ${table}`);
      } catch (err) {
        console.log(`  (Table ${table} did not exist or error: ${err.message})`);
      }
    }

    await client.query('COMMIT');
    console.log('\n✓✓✓ All tables dropped successfully! ✓✓✓\n');
    console.log('You can now run the migration scripts:');
    console.log('  node backend/scripts/migrate-enhanced.js');

  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('\n✗ Error dropping tables:', error.message);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

dropAllTables().catch(err => {
  console.error('\n✗✗✗ Fatal error ✗✗✗');
  console.error(err);
  process.exit(1);
});
