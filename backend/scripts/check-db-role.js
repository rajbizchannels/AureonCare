#!/usr/bin/env node
// SEC-05 Model D — CI/ops check: the app must not connect as a superuser.
//
// A superuser bypasses REVOKE, table/column grants and Row-Level Security, so every
// database-side control in this project is inert when the app connects as one. This
// check fails if the role is a superuser, or if it can still perform DDL.
//
// It uses the app's OWN pool (backend/db.js), so it checks exactly the connection the
// app makes: AC_PG_URI when set (which takes precedence over every AC_DB_* variable),
// otherwise AC_DB_*, with backend/.env loaded the same way. It used to build its own pool
// from AC_DB_* only, with a hard-coded fallback password — so on a deployment configured
// through AC_PG_URI it checked some other connection (often localhost) and said nothing
// about the real one.
//
// Run: node backend/scripts/check-db-role.js
// Exit: 0 pass, 1 fail, 2 could not connect.

const path = require('path');
const pool = require(path.join(__dirname, '..', 'db.js'));

// Which connection is being checked — host and user only, never the password.
const describe = () => {
  if (process.env.AC_PG_URI) {
    try {
      const u = new URL(process.env.AC_PG_URI);
      return `AC_PG_URI -> ${decodeURIComponent(u.username)}@${u.hostname}:${u.port || 5432}${u.pathname}`;
    } catch { return 'AC_PG_URI (unparseable)'; }
  }
  return `AC_DB_* -> ${process.env.AC_DB_U || 'postgres'}@${process.env.AC_DB_H || 'localhost'}:${process.env.AC_DB_P || 5432}/${process.env.AC_DB_N || 'aureoncare'}`;
};

(async () => {
  let failures = 0;
  console.log(`checking ${describe()}`);
  try {
    const { rows } = await pool.query(
      'SELECT current_user AS role, usesuper FROM pg_user WHERE usename = current_user'
    );
    const role = rows[0]?.role;
    const isSuper = rows[0]?.usesuper === true;

    if (isSuper) {
      console.error(`FAIL: the app connects as "${role}", which is a SUPERUSER.`);
      console.error('      Superusers bypass REVOKE, grants and RLS — the tenant-isolation');
      console.error('      controls are inert. Run migration 073, give aureoncare_app a password,');
      console.error('      and connect as it (the user in AC_PG_URI, or AC_DB_U).');
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
