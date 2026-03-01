require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.AC_DB_H || 'localhost',
  port: process.env.AC_DB_P || 5432,
  database: process.env.AC_DB_N || 'aureoncare',
  user: process.env.AC_DB_U || 'aureoncare_user',
  password: process.env.AC_DB_W,
  // Explicitly set search_path to ensure tables are found
  options: '-c search_path=public',
});

async function runMigration(filename) {
  const filepath = path.join(__dirname, 'migrations', filename);

  if (!fs.existsSync(filepath)) {
    console.error(`Migration file not found: ${filename}`);
    return false;
  }

  console.log(`\n▶ Running migration: ${filename}`);

  try {
    const sql = fs.readFileSync(filepath, 'utf8');
    await pool.query(sql);
    console.log(`✅ Success: ${filename}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed: ${filename}`);
    console.error(error.message);
    return false;
  }
}

async function main() {
  console.log('========================================');
  console.log('AureonCare Database Migrations');
  console.log('========================================\n');
  console.log(`📊 Database: ${process.env.AC_DB_N || 'aureoncare'}`);
  console.log(`👤 User: ${process.env.AC_DB_U || 'aureoncare_user'}`);
  console.log(`🖥️  Host: ${process.env.AC_DB_H || 'localhost'}:${process.env.AC_DB_P || 5432}\n`);

  try {
    // Test connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful\n');

    // Run the address column fix migration
    const success = await runMigration('016_fix_patients_address_column.sql');

    if (success) {
      console.log('\n========================================');
      console.log('✅ Migration completed successfully!');
      console.log('========================================\n');
    } else {
      console.log('\n========================================');
      console.log('❌ Migration failed');
      console.log('========================================\n');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
