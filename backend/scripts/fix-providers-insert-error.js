const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'medflow',
  user: process.env.DB_USER || 'medflow_user',
  password: process.env.DB_PASSWORD
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

    // Step 2: Check providers table structure and sequence
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

      if (!idCol.column_default || !idCol.column_default.includes('nextval')) {
        console.log('\n❌ PROBLEM: providers.id does not have auto-increment default');
        console.log('📋 Run migration: 011_fix_providers_id_sequence.sql\n');
      } else {
        console.log('✅ Providers.id has correct auto-increment setup\n');
      }
    }

    // Step 3: Check sequence status
    console.log('Step 3: Checking providers_id_seq sequence...');
    const sequenceCheck = await pool.query(`
      SELECT sequence_name, last_value
      FROM information_schema.sequences
      JOIN pg_sequences ON sequences.sequence_name = pg_sequences.sequencename
      WHERE sequence_name = 'providers_id_seq'
    `);

    if (sequenceCheck.rows.length === 0) {
      console.log('❌ Sequence providers_id_seq does not exist');
      console.log('📋 Run migration: 011_fix_providers_id_sequence.sql\n');
    } else {
      const maxId = await pool.query('SELECT MAX(id) as max_id FROM providers');
      const currentMax = maxId.rows[0].max_id || 0;
      const seqValue = parseInt(sequenceCheck.rows[0].last_value) || 0;

      console.log(`✅ Sequence exists`);
      console.log(`  Current sequence value: ${seqValue}`);
      console.log(`  Max id in table: ${currentMax}`);

      if (seqValue < currentMax) {
        console.log(`\n⚠️  WARNING: Sequence value (${seqValue}) is behind max id (${currentMax})`);
        console.log('📋 Run migration: 011_fix_providers_id_sequence.sql\n');
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
    console.log('1. psql -d medflow -U medflow_user -f migrations/011_fix_providers_id_sequence.sql');
    console.log('2. psql -d medflow -U medflow_user -f migrations/012_add_first_last_name_to_users.sql');
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
