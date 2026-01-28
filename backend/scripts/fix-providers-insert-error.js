const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'aureoncare',
  user: process.env.DB_USER || 'aureoncare_user',
  password: process.env.DB_PASSWORD,
  // Explicitly set search_path to ensure tables are found
  options: '-c search_path=public',
});

async function fixProvidersInsertError() {
  console.log('=== Fixing Providers Insert Error ===\n');

  try {
    // Step 1: Check users table structure
    console.log('Step 1: Checking users table structure...');
    const usersColumns = await pool.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);

    console.log('Users table columns:');
    usersColumns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });

    // Check if first_name and last_name exist
    const hasFirstName = usersColumns.rows.some(c => c.column_name === 'first_name');
    const hasLastName = usersColumns.rows.some(c => c.column_name === 'last_name');

    if (!hasFirstName || !hasLastName) {
      console.log('\n⚠️  Missing first_name or last_name columns in users table');
      console.log('📋 Run migration: 012_add_first_last_name_to_users.sql\n');
    } else {
      console.log('✅ Users table has first_name and last_name columns\n');
    }

    // Step 2: Check providers table structure
    console.log('Step 2: Checking providers table structure...');
    const providersColumns = await pool.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'providers' AND column_name = 'id'
    `);

    if (providersColumns.rows.length > 0) {
      const idCol = providersColumns.rows[0];
      console.log(`Providers.id column:`);
      console.log(`  Type: ${idCol.data_type}`);
      console.log(`  Default: ${idCol.column_default || 'NONE - THIS IS THE PROBLEM!'}`);
      console.log(`  Nullable: ${idCol.is_nullable}`);

      const isUUID = idCol.data_type === 'uuid';
      const isInteger = idCol.data_type === 'integer';

      if (!idCol.column_default) {
        console.log('\n❌ PROBLEM: providers.id does not have a default value');
        console.log('📋 Run migration: 011_fix_providers_id_sequence.sql\n');
      } else if (isUUID && idCol.column_default.includes('uuid_generate')) {
        console.log('✅ Providers.id has correct UUID generation setup\n');
      } else if (isInteger && idCol.column_default.includes('nextval')) {
        console.log('✅ Providers.id has correct auto-increment setup\n');
      } else {
        console.log('\n⚠️  WARNING: Unexpected default value for id column');
        console.log('📋 Run migration: 011_fix_providers_id_sequence.sql\n');
      }
    }

    // Step 3: Check sequence status (only for integer ids)
    const idType = providersColumns.rows[0]?.data_type;
    if (idType === 'integer') {
      console.log('Step 3: Checking providers_id_seq sequence...');
      const sequenceCheck = await pool.query(`
        SELECT sequence_name, last_value
        FROM pg_sequences
        WHERE schemaname = 'public' AND sequencename = 'providers_id_seq'
      `);

      if (sequenceCheck.rows.length === 0) {
        console.log('❌ Sequence providers_id_seq does not exist');
        console.log('📋 Run migration: 011_fix_providers_id_sequence.sql\n');
      } else {
        console.log(`✅ Sequence exists`);
        console.log(`  Current sequence value: ${sequenceCheck.rows[0].last_value}\n`);
      }
    } else if (idType === 'uuid') {
      console.log('Step 3: Checking UUID extension...');
      const extensionCheck = await pool.query(`
        SELECT extname FROM pg_extension WHERE extname = 'uuid-ossp'
      `);

      if (extensionCheck.rows.length === 0) {
        console.log('❌ uuid-ossp extension not installed');
        console.log('📋 Run migration: 011_fix_providers_id_sequence.sql\n');
      } else {
        console.log('✅ uuid-ossp extension is installed\n');
      }
    }

    // Step 4: Test insert
    console.log('\nStep 4: Testing insert functionality...');
    console.log('Attempting to insert a test provider...');

    try {
      const testResult = await pool.query(`
        INSERT INTO providers (first_name, last_name, specialization, email, phone)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, first_name, last_name
      `, [
        'Test',
        'Provider',
        'General Practice',
        `test.provider.${Date.now()}@example.com`,
        '555-0000'
      ]);

      console.log('✅ Test insert successful!');
      console.log(`   Created provider with id: ${testResult.rows[0].id}`);

      // Clean up test record
      await pool.query('DELETE FROM providers WHERE id = $1', [testResult.rows[0].id]);
      console.log('✅ Test record cleaned up\n');
    } catch (insertError) {
      console.log('❌ Test insert FAILED:');
      console.log(`   Error: ${insertError.message}`);
      console.log('\n📋 Please run the migrations to fix this issue.\n');
    }

    // Summary
    console.log('\n=== Summary ===');
    console.log('To fix the error, run these migrations in order:');
    console.log('1. psql -d aureoncare -U aureoncare_user -f migrations/011_fix_providers_id_sequence.sql');
    console.log('2. psql -d aureoncare -U aureoncare_user -f migrations/012_add_first_last_name_to_users.sql');
    console.log('\nOn Windows:');
    console.log('1. Run the migrations from pgAdmin or command line');
    console.log('2. Restart your backend server\n');

  } catch (error) {
    console.error('Error during diagnosis:', error.message);
  } finally {
    await pool.end();
  }
}

fixProvidersInsertError();
