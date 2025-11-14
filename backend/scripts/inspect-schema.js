require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'medflow',
  user: process.env.DB_USER || 'medflow_user',
  password: 'MedFlow2024SecurePass!',
});

async function inspectSchema() {
  console.log('\n🔍 Inspecting database schema...\n');

  let client;

  try {
    client = await pool.connect();
    console.log('✓ Connected to database\n');

    // Get all table names
    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    console.log('📋 Tables found:');
    console.log('==================');

    for (const row of tablesResult.rows) {
      const tableName = row.table_name;
      console.log(`\n${tableName}:`);

      // Get columns for this table
      const columnsResult = await client.query(`
        SELECT
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);

      columnsResult.rows.forEach(col => {
        const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
        const def = col.column_default ? ` DEFAULT ${col.column_default}` : '';
        console.log(`  - ${col.column_name}: ${col.data_type} ${nullable}${def}`);
      });
    }

    console.log('\n✓ Schema inspection complete\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\nFull error:', error);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

inspectSchema();
