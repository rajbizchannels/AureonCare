require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.AC_DB_H || 'localhost',
  port: process.env.AC_DB_P || 5432,
  database: process.env.AC_DB_N || 'aureoncare',
  user: process.env.AC_DB_U || 'postgres',
  password: process.env.AC_DB_W || 'AureonCare2024!',
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
