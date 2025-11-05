const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'medflow',
  user: process.env.DB_USER || 'medflow_user',
  password: process.env.DB_PASSWORD || 'MedFlow2024SecurePass!'
});

async function checkProvidersSchema() {
  try {
    console.log('=== Checking Providers Table Schema ===\n');

    // Check providers table structure
    const schemaQuery = await pool.query(`
      SELECT
        column_name,
        data_type,
        column_default,
        is_nullable,
        character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'providers'
      ORDER BY ordinal_position
    `);

    console.log('Providers table columns:');
    schemaQuery.rows.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
    });

    // Check constraints
    const constraintsQuery = await pool.query(`
      SELECT
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.table_name = 'providers'
      ORDER BY tc.constraint_type, tc.constraint_name
    `);

    console.log('\nProviders table constraints:');
    if (constraintsQuery.rows.length === 0) {
      console.log('  ❌ NO CONSTRAINTS FOUND!');
    } else {
      constraintsQuery.rows.forEach(constraint => {
        console.log(`  ${constraint.constraint_type}: ${constraint.constraint_name} on ${constraint.column_name}`);
      });
    }

    // Check sequences
    const sequenceQuery = await pool.query(`
      SELECT sequence_name
      FROM information_schema.sequences
      WHERE sequence_name LIKE '%providers%'
    `);

    console.log('\nProviders related sequences:');
    if (sequenceQuery.rows.length === 0) {
      console.log('  ❌ NO SEQUENCES FOUND!');
    } else {
      sequenceQuery.rows.forEach(seq => {
        console.log(`  ${seq.sequence_name}`);
      });
    }

    // Check current max id value
    const maxIdQuery = await pool.query(`
      SELECT MAX(id) as max_id, COUNT(*) as row_count
      FROM providers
    `);

    console.log('\nProviders table data:');
    console.log(`  Row count: ${maxIdQuery.rows[0].row_count}`);
    console.log(`  Max ID: ${maxIdQuery.rows[0].max_id || 'NULL'}`);

    console.log('\n=== Analysis ===');
    const hasPrimaryKey = constraintsQuery.rows.some(c => c.constraint_type === 'PRIMARY KEY');
    const hasSequence = sequenceQuery.rows.length > 0;

    if (!hasPrimaryKey) {
      console.log('❌ PROBLEM: providers.id does not have a PRIMARY KEY constraint');
    } else {
      console.log('✅ providers.id has PRIMARY KEY constraint');
    }

    if (!hasSequence) {
      console.log('❌ PROBLEM: No sequence found for providers.id (SERIAL not working)');
    } else {
      console.log('✅ Sequence exists for providers.id');
    }

    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

checkProvidersSchema();
