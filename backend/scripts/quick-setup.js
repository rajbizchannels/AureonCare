/**
 * Quick Database Setup Script
 * Run this with: node backend/scripts/quick-setup.js
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function setupDatabase() {
  console.log('===========================================');
  console.log('AureonCare Quick Database Setup');
  console.log('===========================================\n');

  // Check AC_PG_URI
  if (!process.env.AC_PG_URI) {
    console.error('❌ ERROR: AC_PG_URI not set in .env file');
    console.error('\nPlease create backend/.env with:');
    console.error('AC_PG_URI=postgresql://username:password@localhost:5432/aureoncare\n');
    process.exit(1);
  }

  console.log('✓ AC_PG_URI found:', process.env.AC_PG_URI.replace(/:[^:@]+@/, ':****@'));

  const pool = new Pool({
    connectionString: process.env.AC_PG_URI,
    // Explicitly set search_path to ensure tables are found
    options: '-c search_path=public',
  });

  try {
    // Test connection
    console.log('\n1. Testing database connection...');
    await pool.query('SELECT NOW()');
    console.log('✓ Database connection successful');

    // Check current database
    const dbResult = await pool.query('SELECT current_database()');
    console.log(`✓ Connected to database: ${dbResult.rows[0].current_database}`);

    // Check existing tables
    console.log('\n2. Checking existing tables...');
    const tablesResult = await pool.query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);

    if (tablesResult.rows.length === 0) {
      console.log('⚠️  No tables found - database is empty');
      console.log('\n3. Creating tables from schema.sql...');

      // Read and execute schema.sql
      const schemaPath = path.join(__dirname, '../schema.sql');
      if (!fs.existsSync(schemaPath)) {
        console.error('❌ schema.sql not found at:', schemaPath);
        process.exit(1);
      }

      const schema = fs.readFileSync(schemaPath, 'utf8');
      await pool.query(schema);
      console.log('✓ Schema applied successfully');

      // Verify tables created
      const newTablesResult = await pool.query(`
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY tablename
      `);
      console.log(`✓ Created ${newTablesResult.rows.length} tables:`);
      newTablesResult.rows.forEach(row => {
        console.log(`  - ${row.tablename}`);
      });

    } else {
      console.log(`✓ Found ${tablesResult.rows.length} existing tables:`);
      tablesResult.rows.forEach(row => {
        console.log(`  - ${row.tablename}`);
      });
    }

    // Check for required tables
    console.log('\n4. Verifying required tables...');
    const requiredTables = [
      'users', 'patients', 'providers', 'appointments',
      'claims', 'payments', 'tasks', 'notifications',
      'prescriptions', 'diagnosis', 'medical_records'
    ];

    const existingTables = tablesResult.rows.map(r => r.tablename);
    const missingTables = requiredTables.filter(t => !existingTables.includes(t));

    if (missingTables.length > 0) {
      console.log('❌ Missing tables:', missingTables.join(', '));
      console.log('\nRe-applying schema...');
      const schemaPath = path.join(__dirname, '../schema.sql');
      const schema = fs.readFileSync(schemaPath, 'utf8');
      await pool.query(schema);
      console.log('✓ Schema re-applied');
    } else {
      console.log('✓ All required tables exist');
    }

    // Count records
    console.log('\n5. Checking data...');
    const counts = await Promise.all([
      pool.query('SELECT COUNT(*) FROM users'),
      pool.query('SELECT COUNT(*) FROM patients'),
      pool.query('SELECT COUNT(*) FROM appointments')
    ]);

    console.log(`  Users: ${counts[0].rows[0].count}`);
    console.log(`  Patients: ${counts[1].rows[0].count}`);
    console.log(`  Appointments: ${counts[2].rows[0].count}`);

    if (counts[0].rows[0].count === '0') {
      console.log('\n⚠️  No data found. You may want to run seed script.');
      console.log('   psql $AC_PG_URI -f backend/scripts/seed-test-data.sql');
    }

    console.log('\n===========================================');
    console.log('✅ Database setup complete!');
    console.log('===========================================');
    console.log('\nYou can now start the backend server:');
    console.log('  cd backend && npm start\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setupDatabase();
