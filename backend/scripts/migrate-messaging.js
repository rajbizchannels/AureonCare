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
  console.log('Running Secure Messaging Migration');
  console.log('========================================\n');

  try {
    const migrationPath = path.join(__dirname, '..', 'migrations', '059_create_secure_messaging.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('Executing migration...\n');
    await pool.query(migrationSQL);

    console.log('✓ Migration completed successfully!\n');
    console.log('Created tables:');
    console.log('  - message_threads');
    console.log('  - message_thread_participants');
    console.log('  - messages');
    console.log('  - message_attachments');
    console.log('  - message_read_receipts');

    if (!process.env.AC_MSG_KEY) {
      console.log('\n⚠  AC_MSG_KEY is not set.');
      console.log('   Message bodies will be encrypted with a key derived from AC_TK_S.');
      console.log('   Set AC_MSG_KEY before going to production — rotating AC_TK_S');
      console.log('   would otherwise make every stored message unreadable:');
      console.log('     node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    }
    console.log('\n========================================');
  } catch (error) {
    console.error('❌ Migration failed:');
    console.error(error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
