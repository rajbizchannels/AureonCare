require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'medflow',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
});

async function runMigrations() {
  console.log('\n========================================');
  console.log('Running Pre-Authorization Migrations');
  console.log('========================================\n');

  let client;

  try {
    console.log('Connecting to database...');
    client = await pool.connect();
    console.log('✓ Connected to database\n');

    // List of migrations to run in order
    const migrations = [
      '031_create_insurance_payers.sql',
      '032_add_insurance_payer_to_patients.sql',
      '035_create_preapprovals_table.sql'
    ];

    for (const migrationFile of migrations) {
      const migrationPath = path.join(__dirname, '../migrations', migrationFile);

      if (!fs.existsSync(migrationPath)) {
        console.log(`⚠️  Skipping ${migrationFile} (file not found)`);
        continue;
      }

      console.log(`Running: ${migrationFile}...`);
      const sql = fs.readFileSync(migrationPath, 'utf8');

      try {
        await client.query(sql);
        console.log(`✓ Successfully applied ${migrationFile}\n`);
      } catch (error) {
        // Check if error is because table already exists
        if (error.code === '42P07') {
          console.log(`⚠️  ${migrationFile} - Table already exists, skipping\n`);
        } else if (error.message.includes('already exists')) {
          console.log(`⚠️  ${migrationFile} - Already applied, skipping\n`);
        } else if (error.message.includes('duplicate key')) {
          console.log(`⚠️  ${migrationFile} - Duplicate data, skipping\n`);
        } else {
          console.error(`❌ Error in ${migrationFile}:`, error.message);
          // Continue with next migration
        }
      }
    }

    // Verify the preapprovals table exists
    console.log('Verifying preapprovals table...');
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'preapprovals'
    `);

    if (result.rows.length > 0) {
      console.log('✓ Preapprovals table exists\n');

      // Check table structure
      const columns = await client.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'preapprovals'
        ORDER BY ordinal_position
      `);

      console.log(`Table has ${columns.rows.length} columns`);
    } else {
      console.log('❌ Preapprovals table NOT found\n');
    }

    // Check if insurance_payers table exists
    const payersResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'insurance_payers'
    `);

    if (payersResult.rows.length > 0) {
      console.log('✓ Insurance_payers table exists\n');
    } else {
      console.log('❌ Insurance_payers table NOT found\n');
    }

    console.log('========================================');
    console.log('✓✓✓ Migration Process Completed! ✓✓✓');
    console.log('========================================\n');

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

runMigrations().catch(err => {
  console.error('\n❌ Fatal error:', err);
  process.exit(1);
});
