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
  // Explicitly set search_path to ensure tables are found
  options: '-c search_path=public',
});

async function fixAppointmentsConstraint() {
  const client = await pool.connect();

  try {
    console.log('🔍 Checking appointments provider_id constraint...\n');

    // Check current constraint
    const constraintCheck = await client.query(`
      SELECT
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = 'appointments'
        AND kcu.column_name = 'provider_id'
    `);

    if (constraintCheck.rows.length > 0) {
      const constraint = constraintCheck.rows[0];
      console.log('📋 Current constraint:', constraint.constraint_name);
      console.log('   References:', constraint.foreign_table_name);

      if (constraint.foreign_table_name === 'users') {
        console.log('⚠️  Constraint references USERS table - needs to be fixed!\n');

        console.log('🔧 Applying fix...');

        // Read and execute migration
        const migrationPath = path.join(__dirname, '../migrations/009_fix_appointments_provider_fkey.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

        await client.query('BEGIN');
        await client.query(migrationSQL);
        await client.query('COMMIT');

        console.log('✅ Constraint fixed! Now references PROVIDERS table.\n');
      } else if (constraint.foreign_table_name === 'providers') {
        console.log('✅ Constraint already references PROVIDERS table correctly.\n');
      }
    } else {
      console.log('⚠️  No provider_id constraint found. Creating one...\n');

      const migrationPath = path.join(__dirname, '../migrations/009_fix_appointments_provider_fkey.sql');
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

      await client.query('BEGIN');
      await client.query(migrationSQL);
      await client.query('COMMIT');

      console.log('✅ Constraint created successfully!\n');
    }

    // Verify final state
    const finalCheck = await client.query(`
      SELECT
        tc.constraint_name,
        ccu.table_name AS foreign_table_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = 'appointments'
        AND tc.constraint_name LIKE '%provider%'
    `);

    console.log('📊 Final constraint state:');
    finalCheck.rows.forEach(row => {
      console.log(`   ${row.constraint_name} -> ${row.foreign_table_name}`);
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error fixing constraint:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

fixAppointmentsConstraint()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });
