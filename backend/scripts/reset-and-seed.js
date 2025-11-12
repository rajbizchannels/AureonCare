#!/usr/bin/env node

/**
 * Database Reset and Seed Script
 *
 * This script:
 * 1. Runs database migrations to fix schema issues
 * 2. Deletes all existing data
 * 3. Seeds the database with test data in correct order
 *
 * Usage: node scripts/reset-and-seed.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database configuration
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'medflow',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
});

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(80));
  log(title, 'cyan');
  console.log('='.repeat(80) + '\n');
}

async function runSQLFile(filePath, description) {
  try {
    log(`\n📄 Running: ${description}`, 'yellow');
    log(`   File: ${path.basename(filePath)}`, 'blue');

    const sql = fs.readFileSync(filePath, 'utf8');

    // Split by semicolons and filter out empty statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && s !== 'BEGIN' && s !== 'COMMIT');

    log(`   Executing ${statements.length} statements...`, 'blue');

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.includes('SELECT') && statement.includes('VERIFICATION')) {
        // This is a verification query, show results
        const result = await pool.query(statement);
        if (result.rows && result.rows.length > 0) {
          console.table(result.rows);
        }
      } else {
        await pool.query(statement);
      }
    }

    log(`✅ ${description} completed successfully`, 'green');
    return true;
  } catch (error) {
    log(`❌ Error in ${description}:`, 'red');
    console.error(error.message);
    return false;
  }
}

async function runMigration(migrationFile) {
  try {
    const migrationPath = path.join(__dirname, '..', 'migrations', migrationFile);

    if (!fs.existsSync(migrationPath)) {
      log(`⚠️  Migration file not found: ${migrationFile}`, 'yellow');
      return true; // Skip if doesn't exist
    }

    const sql = fs.readFileSync(migrationPath, 'utf8');
    await pool.query(sql);
    log(`✅ Applied: ${migrationFile}`, 'green');
    return true;
  } catch (error) {
    log(`❌ Error applying ${migrationFile}:`, 'red');
    console.error(error.message);
    return false;
  }
}

async function main() {
  try {
    logSection('🚀 MEDFLOW DATABASE RESET AND SEED');

    // Test database connection
    log('Testing database connection...', 'yellow');
    const testResult = await pool.query('SELECT NOW()');
    log(`✅ Connected to database at ${testResult.rows[0].now}`, 'green');

    // Step 1: Run critical migrations
    logSection('📋 Step 1: Running Database Migrations');

    const criticalMigrations = [
      '009_fix_appointments_provider_fkey.sql',
    ];

    for (const migration of criticalMigrations) {
      await runMigration(migration);
    }

    // Step 2: Delete existing data
    logSection('🗑️  Step 2: Deleting Existing Data');

    const resetPath = path.join(__dirname, 'reset-database.sql');
    const resetSuccess = await runSQLFile(resetPath, 'Delete all existing data');

    if (!resetSuccess) {
      log('\n❌ Failed to reset database. Aborting.', 'red');
      process.exit(1);
    }

    // Step 3: Seed test data
    logSection('🌱 Step 3: Seeding Test Data');

    const seedPath = path.join(__dirname, 'seed-test-data.sql');
    const seedSuccess = await runSQLFile(seedPath, 'Insert test data');

    if (!seedSuccess) {
      log('\n❌ Failed to seed database. Please check errors above.', 'red');
      process.exit(1);
    }

    // Step 4: Verification
    logSection('✅ Step 4: Verification');

    // Check for foreign key violations
    const fkCheck = await pool.query(`
      SELECT
        CASE
          WHEN COUNT(*) = 0 THEN 'PASS'
          ELSE 'FAIL'
        END as result,
        COUNT(*) as invalid_references
      FROM appointments a
      LEFT JOIN providers pr ON a.provider_id = pr.id
      WHERE a.provider_id IS NOT NULL AND pr.id IS NULL
    `);

    if (fkCheck.rows[0].result === 'PASS') {
      log('✅ All foreign key constraints are valid', 'green');
    } else {
      log(`❌ Found ${fkCheck.rows[0].invalid_references} invalid provider references`, 'red');
    }

    // Display summary
    const summary = await pool.query(`
      SELECT 'users' as table_name, COUNT(*) as count FROM users
      UNION ALL SELECT 'patients', COUNT(*) FROM patients
      UNION ALL SELECT 'providers', COUNT(*) FROM providers
      UNION ALL SELECT 'appointments', COUNT(*) FROM appointments
      UNION ALL SELECT 'prescriptions', COUNT(*) FROM prescriptions
      UNION ALL SELECT 'tasks', COUNT(*) FROM tasks
      ORDER BY table_name
    `);

    log('\n📊 Database Summary:', 'cyan');
    console.table(summary.rows);

    // Display test credentials
    logSection('🔑 Test Credentials');

    log('Password for all accounts: password123\n', 'yellow');

    log('Admin:', 'bright');
    log('  Email: admin@medflow.com', 'white');

    log('\nDoctors:', 'bright');
    log('  Email: dr.smith@medflow.com (Family Medicine)', 'white');
    log('  Email: dr.johnson@medflow.com (Cardiology)', 'white');
    log('  Email: dr.williams@medflow.com (Pediatrics)', 'white');

    log('\nPatients:', 'bright');
    log('  Email: john.doe@example.com', 'white');
    log('  Email: jane.smith@example.com', 'white');
    log('  Email: bob.wilson@example.com', 'white');
    log('  Email: alice.brown@example.com', 'white');

    log('\nStaff:', 'bright');
    log('  Email: staff@medflow.com', 'white');

    logSection('🎉 SUCCESS - Database Reset and Seed Complete!');

  } catch (error) {
    log('\n❌ Fatal Error:', 'red');
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the script
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
