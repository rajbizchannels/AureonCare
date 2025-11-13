#!/usr/bin/env node

/**
 * Run Scheduling System Migration (017)
 *
 * This script runs migration 017 which creates the scheduling tables:
 * - doctor_availability
 * - doctor_time_off
 * - appointment_type_config
 * - provider_booking_config
 * - appointment_reminders
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Try to load dotenv if available
try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch (e) {
  console.log('Note: dotenv not available, using environment variables directly');
}

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'medflow',
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

async function runMigration() {
  try {
    console.log('🚀 Running Scheduling System Migration (017)...\n');

    // Test database connection
    console.log('Testing database connection...');
    await pool.query('SELECT NOW()');
    console.log('✅ Connected to database\n');

    // Read migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '017_create_scheduling_system.sql');
    console.log(`📄 Reading migration file: ${migrationPath}`);

    if (!fs.existsSync(migrationPath)) {
      throw new Error('Migration file not found!');
    }

    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Execute migration
    console.log('🔧 Executing migration...');
    await pool.query(sql);

    console.log('\n✅ Migration completed successfully!');

    // Verify tables were created
    console.log('\n📊 Verifying tables...');
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN (
        'doctor_availability',
        'doctor_time_off',
        'appointment_type_config',
        'provider_booking_config',
        'appointment_reminders'
      )
      ORDER BY table_name
    `);

    console.log('Tables created:');
    result.rows.forEach(row => {
      console.log(`  ✓ ${row.table_name}`);
    });

    if (result.rows.length === 5) {
      console.log('\n✅ All scheduling tables created successfully!');
    } else {
      console.log(`\n⚠️  Expected 5 tables, found ${result.rows.length}`);
    }

  } catch (error) {
    console.error('\n❌ Error running migration:');
    console.error(error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
