/**
 * Archiving Diagnostic Script
 *
 * Tests the entire archiving flow step-by-step to identify where it's failing
 */

require('dotenv').config();
const { Pool } = require('pg');

// Main database connection
const mainPool = new Pool({
  host: process.env.AC_DB_H || 'localhost',
  port: process.env.AC_DB_P || 5432,
  database: process.env.AC_DB_N || 'medflow',
  user: process.env.AC_DB_U || 'postgres',
  password: process.env.AC_DB_W || 'MedFlow2024!',
});

// Archive database connection
const archivePool = new Pool({
  host: process.env.AC_ARCH_H || process.env.AC_DB_H || 'localhost',
  port: process.env.AC_ARCH_P || process.env.AC_DB_P || 5432,
  database: process.env.AC_ARCH_N || (process.env.AC_DB_N || 'medflow') + '_archive',
  user: process.env.AC_ARCH_U || process.env.AC_DB_U || 'postgres',
  password: process.env.AC_ARCH_W || process.env.AC_DB_W || 'MedFlow2024!',
});

async function diagnoseArchiving() {
  console.log('\n========================================');
  console.log('ARCHIVING DIAGNOSTIC REPORT');
  console.log('========================================\n');

  try {
    // Test 1: Database connections
    console.log('TEST 1: Database Connections');
    console.log('----------------------------');
    try {
      await mainPool.query('SELECT NOW()');
      console.log('✓ Main database connected:', mainPool.options.database);
    } catch (err) {
      console.error('✗ Main database connection FAILED:', err.message);
      return;
    }

    try {
      await archivePool.query('SELECT NOW()');
      console.log('✓ Archive database connected:', archivePool.options.database);
    } catch (err) {
      console.error('✗ Archive database connection FAILED:', err.message);
      return;
    }
    console.log('');

    // Test 2: Check for data in main database
    console.log('TEST 2: Main Database Data');
    console.log('----------------------------');
    const testTables = ['patients', 'appointments', 'claims', 'notifications', 'tasks'];

    for (const table of testTables) {
      try {
        const countResult = await mainPool.query(`SELECT COUNT(*) as count FROM ${table}`);
        const count = parseInt(countResult.rows[0].count);
        console.log(`${table.padEnd(20)} ${count} rows`);
      } catch (err) {
        console.log(`${table.padEnd(20)} ERROR: ${err.message}`);
      }
    }
    console.log('');

    // Test 3: Test single table archiving flow
    console.log('TEST 3: Single Table Archive Test (patients)');
    console.log('---------------------------------------------');

    const testTable = 'patients';

    // Check if table exists in main DB
    const mainTableCheck = await mainPool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = $1
      );
    `, [testTable]);

    if (!mainTableCheck.rows[0].exists) {
      console.log(`✗ Table ${testTable} does not exist in main database`);
      return;
    }
    console.log(`✓ Table ${testTable} exists in main database`);

    // Get row count
    const countResult = await mainPool.query(`SELECT COUNT(*) FROM ${testTable}`);
    const rowCount = parseInt(countResult.rows[0].count);
    console.log(`✓ Found ${rowCount} rows in ${testTable}`);

    if (rowCount === 0) {
      console.log('⚠️  No data to archive - table is empty');
      return;
    }

    // Get sample data
    const sampleResult = await mainPool.query(`SELECT * FROM ${testTable} LIMIT 1`);
    const sampleRow = sampleResult.rows[0];
    console.log(`✓ Sample row columns:`, Object.keys(sampleRow).join(', '));

    // Check if table exists in archive DB
    const archiveTableCheck = await archivePool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = $1
      );
    `, [testTable]);

    if (archiveTableCheck.rows[0].exists) {
      console.log(`✓ Table ${testTable} already exists in archive database`);

      // Get primary key
      const pkQuery = `
        SELECT string_agg(a.attname, ', ' ORDER BY array_position(conkey, a.attnum)) as pk_columns
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
        WHERE t.relname = $1 AND c.contype = 'p'
        GROUP BY c.conname;
      `;
      const pkResult = await archivePool.query(pkQuery, [testTable]);
      const pkColumns = pkResult.rows[0]?.pk_columns;
      console.log(`✓ Primary key: ${pkColumns || 'NONE'}`);
    } else {
      console.log(`⊘ Table ${testTable} does not exist in archive database`);
      console.log('  → Will be created on first archive');
    }

    // Test actual insert
    console.log('\nTEST 4: Test Data Insertion');
    console.log('----------------------------');

    const testRow = sampleRow;
    const columns = Object.keys(testRow);
    const values = Object.values(testRow);

    console.log(`Attempting to insert 1 test row...`);
    console.log(`Columns (${columns.length}):`, columns.join(', '));

    if (!archiveTableCheck.rows[0].exists) {
      console.log('⚠️  Cannot test insert - archive table does not exist yet');
      console.log('   Run an archive operation first to create the table');
    } else {
      try {
        // Get primary key for ON CONFLICT
        const pkQuery = `
          SELECT string_agg(a.attname, ', ' ORDER BY array_position(conkey, a.attnum)) as pk_columns
          FROM pg_constraint c
          JOIN pg_class t ON t.oid = c.conrelid
          JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
          WHERE t.relname = $1 AND c.contype = 'p'
          GROUP BY c.conname;
        `;
        const pkResult = await archivePool.query(pkQuery, [testTable]);
        const pkColumns = pkResult.rows[0]?.pk_columns;

        const placeholders = values.map((_, idx) => `$${idx + 1}`).join(', ');
        const onConflictClause = pkColumns
          ? `ON CONFLICT (${pkColumns}) DO NOTHING`
          : `ON CONFLICT DO NOTHING`;

        const insertQuery = `
          INSERT INTO ${testTable} (${columns.join(', ')})
          VALUES (${placeholders})
          ${onConflictClause}
          RETURNING *
        `;

        const insertResult = await archivePool.query(insertQuery, values);

        if (insertResult.rows.length > 0) {
          console.log('✓ Test row INSERTED successfully');
        } else {
          console.log('⊘ Test row SKIPPED (already exists - conflict)');
        }

        // Check final count in archive
        const archiveCountResult = await archivePool.query(`SELECT COUNT(*) FROM ${testTable}`);
        const archiveCount = parseInt(archiveCountResult.rows[0].count);
        console.log(`✓ Archive database now has ${archiveCount} rows in ${testTable}`);

      } catch (insertErr) {
        console.error('✗ INSERT FAILED:', insertErr.message);
        console.error('   Error code:', insertErr.code);
        if (insertErr.code === '42P01') {
          console.error('   → Table does not exist in archive database');
        } else if (insertErr.code === '23505') {
          console.error('   → Duplicate key violation');
        } else if (insertErr.code === '42703') {
          console.error('   → Column does not exist');
        }
      }
    }

    console.log('\n========================================');
    console.log('DIAGNOSTIC COMPLETE');
    console.log('========================================\n');

    console.log('Summary:');
    console.log('- If data exists in main DB but archive fails:');
    console.log('  1. Run: node backend/scripts/clean-archive-database.js');
    console.log('  2. Try creating an archive via UI');
    console.log('');
    console.log('- If no data in main DB:');
    console.log('  1. Check that main database has records');
    console.log('  2. Verify AC_DB_N in .env is correct');
    console.log('');

  } catch (error) {
    console.error('\n❌ DIAGNOSTIC ERROR:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await mainPool.end();
    await archivePool.end();
  }
}

// Run diagnostic
diagnoseArchiving();
