/**
 * Diagnostic script for Patient Portal "Not Provided" issue
 * Checks patient table structure and data
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function diagnose() {
  try {
    console.log('='.repeat(80));
    console.log('PATIENT PORTAL DIAGNOSTIC REPORT');
    console.log('='.repeat(80));
    console.log('');

    // Check if patients table exists
    console.log('1. Checking if patients table exists...');
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'patients'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('  ❌ ERROR: patients table does not exist!');
      return;
    }
    console.log('  ✓ patients table exists');
    console.log('');

    // Check table structure
    console.log('2. Checking patients table structure...');
    const structureCheck = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'patients'
      ORDER BY ordinal_position;
    `);
    console.log('  Columns:');
    structureCheck.rows.forEach(col => {
      const nullable = col.is_nullable === 'YES' ? '(nullable)' : '(NOT NULL)';
      console.log(`    - ${col.column_name}: ${col.data_type} ${nullable}`);
    });
    console.log('');

    // Check for first_name and last_name columns
    const hasFirstName = structureCheck.rows.some(col => col.column_name === 'first_name');
    const hasLastName = structureCheck.rows.some(col => col.column_name === 'last_name');

    if (!hasFirstName || !hasLastName) {
      console.log('  ❌ ERROR: first_name or last_name column is missing!');
      if (!hasFirstName) console.log('    - Missing: first_name');
      if (!hasLastName) console.log('    - Missing: last_name');
      return;
    }
    console.log('  ✓ first_name and last_name columns exist');
    console.log('');

    // Count total patients
    console.log('3. Checking patient data...');
    const countResult = await pool.query('SELECT COUNT(*) FROM patients');
    const totalPatients = parseInt(countResult.rows[0].count);
    console.log(`  Total patients: ${totalPatients}`);

    if (totalPatients === 0) {
      console.log('  ⚠️  WARNING: No patients in database! Run seed script.');
      return;
    }
    console.log('');

    // Check for patients with missing names
    console.log('4. Checking for patients with missing names...');
    const missingNamesResult = await pool.query(`
      SELECT
        id,
        first_name,
        last_name,
        email,
        portal_enabled
      FROM patients
      WHERE first_name IS NULL OR first_name = '' OR last_name IS NULL OR last_name = ''
      LIMIT 10;
    `);

    if (missingNamesResult.rows.length > 0) {
      console.log(`  ❌ FOUND ${missingNamesResult.rows.length} patients with missing names:`);
      missingNamesResult.rows.forEach(patient => {
        console.log(`    Patient ID: ${patient.id}`);
        console.log(`      - first_name: ${patient.first_name || 'NULL/EMPTY'}`);
        console.log(`      - last_name: ${patient.last_name || 'NULL/EMPTY'}`);
        console.log(`      - email: ${patient.email || 'N/A'}`);
        console.log(`      - portal_enabled: ${patient.portal_enabled}`);
        console.log('');
      });
    } else {
      console.log('  ✓ All patients have first_name and last_name');
    }
    console.log('');

    // Check sample patient data
    console.log('5. Sample patient data:');
    const sampleResult = await pool.query(`
      SELECT id, first_name, last_name, email, portal_enabled
      FROM patients
      LIMIT 3;
    `);
    sampleResult.rows.forEach(patient => {
      console.log(`  Patient: ${patient.first_name} ${patient.last_name}`);
      console.log(`    - ID: ${patient.id}`);
      console.log(`    - Email: ${patient.email}`);
      console.log(`    - Portal Enabled: ${patient.portal_enabled}`);
      console.log('');
    });

    // Check for portal-enabled patients
    console.log('6. Checking portal-enabled patients...');
    const portalEnabledResult = await pool.query(`
      SELECT COUNT(*) FROM patients WHERE portal_enabled = true;
    `);
    const portalEnabled = parseInt(portalEnabledResult.rows[0].count);
    console.log(`  Portal-enabled patients: ${portalEnabled} of ${totalPatients}`);
    console.log('');

    // Recommendations
    console.log('='.repeat(80));
    console.log('RECOMMENDATIONS:');
    console.log('='.repeat(80));

    if (missingNamesResult.rows.length > 0) {
      console.log('❌ ACTION REQUIRED: Fix missing patient names');
      console.log('   Run: psql $DATABASE_URL -f backend/scripts/fix-patient-names.sql');
      console.log('   Or manually update patients with proper names.');
    } else if (totalPatients === 0) {
      console.log('⚠️  ACTION REQUIRED: Seed database with test data');
      console.log('   Run: npm run seed');
    } else {
      console.log('✓ Patient data looks good!');
      console.log('  If you still see "Not Provided", check:');
      console.log('  1. Browser console for errors');
      console.log('  2. Network tab to see API response');
      console.log('  3. That you\'re logged in with a valid patient account');
    }

    console.log('');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('Error running diagnostic:', error);
  } finally {
    await pool.end();
  }
}

diagnose();
