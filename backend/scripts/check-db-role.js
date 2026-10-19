#!/usr/bin/env node
// SEC-05 Model D — CI/ops check: the app must not connect as a superuser.
//
// A superuser bypasses REVOKE, table/column grants and Row-Level Security, so every
// database-side control in this project is inert when the app connects as one. This
// check connects with the app's own AC_DB_* settings and fails if the role is a
// superuser, or if it can still perform DDL.
//
// Run: node backend/scripts/check-db-role.js
// Exit: 0 pass, 1 fail, 2 could not connect.

const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.AC_DB_H || 'localhost',
  port: process.env.AC_DB_P || 5432,
  database: process.env.AC_DB_N || 'aureoncare',
  user: process.env.AC_DB_U || 'postgres',
  password: process.env.AC_DB_W || 'AureonCare2024!',
});

(async () => {
  let failures = 0;
  try {
    const { rows } = await pool.query(
      'SELECT current_user AS role, usesuper FROM pg_user WHERE usename = current_user'
    );
    const role = rows[0]?.role;
    const isSuper = rows[0]?.usesuper === true;

    if (isSuper) {
      console.error(`FAIL: the app connects as "${role}", which is a SUPERUSER.`);
      console.error('      Superusers bypass REVOKE, grants and RLS — the tenant-isolation');
      console.error('      controls are inert. Run migration 073 and set AC_DB_U to the');
      console.error('      least-privilege role (aureoncare_app).');
      failures++;
    } else {
      console.log(`ok  connects as non-superuser role "${role}"`);
    }

    // DDL must be refused even if the role is not flagged superuser.
    try {
      await pool.query('CREATE TABLE _sec05_ddl_probe (id int)');
      await pool.query('DROP TABLE _sec05_ddl_probe').catch(() => {});
      console.error(`FAIL: role "${role}" can CREATE TABLE — it still holds DDL privileges.`);
      failures++;
    } catch (e) {
      console.log('ok  DDL is refused (CREATE TABLE denied)');
    }

    await pool.end();
    process.exit(failures ? 1 : 0);
  } catch (err) {
    console.error(`Could not verify database role: ${err.message}`);
    await pool.end().catch(() => {});
    process.exit(2);
  }
})();
