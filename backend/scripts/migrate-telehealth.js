require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'medflow',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'MedFlow2024!',
});

async function runMigration() {
  console.log('========================================');
  console.log('Running Telehealth Integrations Migration');
  console.log('========================================\n');

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', 'add_telehealth_integrations.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('Executing migration...\n');
    await pool.query(migrationSQL);

    console.log('✓ Migration completed successfully!\n');
    console.log('Created tables:');
    console.log('  - telehealth_provider_settings');
    console.log('  - notification_preferences');
    console.log('\nUpdated tables:');
    console.log('  - telehealth_sessions (added provider_type column)');
    console.log('\n========================================');

  } catch (error) {
    console.error('❌ Migration failed:');
    console.error(error.message);
    console.error('\nFull error:');
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
