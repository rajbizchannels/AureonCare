#!/usr/bin/env node
/**
 * Diagnostic script to check audit logging setup
 */

const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'medflow',
  user: process.env.DB_USER || 'medflow_app',
  password: 'MedFlow2024!',
});

async function checkAuditSetup() {
  console.log('🔍 Checking Audit Logging Setup...\n');

  try {
    // 1. Check database connection
    console.log('1️⃣ Testing database connection...');
    await pool.query('SELECT NOW()');
    console.log('   ✅ Database connection successful\n');

    // 2. Check if audit_logs table exists
    console.log('2️⃣ Checking if audit_logs table exists...');
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM pg_tables
        WHERE schemaname = 'public' AND tablename = 'audit_logs'
      );
    `);

    if (tableCheck.rows[0].exists) {
      console.log('   ✅ audit_logs table exists\n');

      // 3. Check table structure
      console.log('3️⃣ Checking table structure...');
      const columns = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'audit_logs'
        ORDER BY ordinal_position;
      `);
      console.log(`   ✅ Table has ${columns.rows.length} columns`);
      console.log('   Columns:', columns.rows.map(r => r.column_name).join(', '));
      console.log('');

      // 4. Check for existing audit logs
      console.log('4️⃣ Checking for existing audit logs...');
      const count = await pool.query('SELECT COUNT(*) FROM audit_logs');
      console.log(`   📊 Found ${count.rows[0].count} audit log entries\n`);

      if (count.rows[0].count > 0) {
        // Show recent logs
        console.log('5️⃣ Recent audit logs (last 5):');
        const recent = await pool.query(`
          SELECT
            id,
            resource_name,
            action_type,
            module,
            created_at
          FROM audit_logs
          ORDER BY created_at DESC
          LIMIT 5
        `);
        console.table(recent.rows);
      } else {
        console.log('   ⚠️  No audit logs found yet. This is normal if:');
        console.log('      - The migration was just run');
        console.log('      - Users haven\'t interacted with any forms/modals/views yet');
        console.log('      - There might be an issue with the audit logging implementation\n');
      }

      // 5. Check permissions
      console.log('6️⃣ Checking audit permissions...');
      const perms = await pool.query(`
        SELECT * FROM permissions
        WHERE resource = 'audit' OR resource LIKE '%audit%'
      `);
      if (perms.rows.length > 0) {
        console.log('   ✅ Found audit permissions');
        console.table(perms.rows);
      } else {
        console.log('   ⚠️  No audit permissions found');
      }

    } else {
      console.log('   ❌ audit_logs table DOES NOT EXIST\n');
      console.log('   📝 You need to run the migration:');
      console.log('   Run this command:');
      console.log('   psql -U medflow_app -d medflow -f backend/migrations/040_create_audit_logs_table.sql\n');
    }

    console.log('\n✅ Diagnostic complete!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\nFull error:', error);
  } finally {
    await pool.end();
  }
}

checkAuditSetup();
