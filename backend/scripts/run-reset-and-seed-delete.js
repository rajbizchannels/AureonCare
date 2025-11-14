require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'medflow',
  user: process.env.DB_USER || 'medflow_user',
  password: process.env.DB_PASSWORD,
  // Explicitly set search_path to ensure tables are found
  options: '-c search_path=public',
});

async function resetAndSeedDatabase() {
  console.log('\n🔄 Starting database reset and seed process (using DELETE)...\n');

  let client;

  try {
    // Connect to database
    console.log('📡 Connecting to database...');
    client = await pool.connect();
    console.log('✓ Connected successfully\n');

    // Read SQL file
    console.log('📖 Reading SQL script...');
    const sqlPath = path.join(__dirname, 'reset-and-seed-delete.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log('✓ SQL script loaded\n');

    // Execute SQL
    console.log('🗑️  Deleting all data from tables...');
    console.log('📝 Inserting fresh test data...');
    console.log('');

    await client.query(sql);

    console.log('\n✅ Database reset and seed completed successfully!\n');

  } catch (error) {
    console.error('\n❌ Error during database reset:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// Run the script
resetAndSeedDatabase();
