require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'medflow',
  user: process.env.DB_USER || 'medflow_user',
  password: process.env.DB_PASSWORD,
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
  console.log('MedFlow Database Migrations');
  console.log('========================================\n');
  console.log(`📊 Database: ${process.env.DB_NAME || 'medflow'}`);
  console.log(`👤 User: ${process.env.DB_USER || 'medflow_user'}`);
  console.log(`🖥️  Host: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}\n`);

  try {
    // Test connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful\n');

    // Run the payments migration
    const success = await runMigration('004_create_payments_table.sql');

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
