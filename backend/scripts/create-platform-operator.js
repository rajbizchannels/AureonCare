// SEC-05 Model D — Step S10: bootstrap a platform operator (super-admin).
//
// Credentials are NOT seeded in a migration. Create the first operator explicitly:
//   node backend/scripts/create-platform-operator.js <email> <password> ["Full Name"]
// Password must satisfy the shared policy (>= 12 chars, mixed classes). Idempotent on
// email: re-running updates the password/name.

const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const { BCRYPT_COST, validatePassword } = require('../utils/passwordPolicy');

(async () => {
  const [email, password, name] = process.argv.slice(2);
  if (!email || !password) {
    console.error('Usage: node scripts/create-platform-operator.js <email> <password> ["Full Name"]');
    process.exit(2);
  }
  const pw = validatePassword(password);
  if (!pw.valid) { console.error('Password rejected:', pw.message); process.exit(2); }

  const pool = new Pool({
    host: process.env.AC_DB_H || 'localhost',
    port: process.env.AC_DB_P || 5432,
    database: process.env.AC_DB_N || 'aureoncare',
    user: process.env.AC_DB_U || 'postgres',
    password: process.env.AC_DB_W || 'AureonCare2024!',
  });
  try {
    const hash = await bcrypt.hash(password, BCRYPT_COST);
    const { rows } = await pool.query(
      `INSERT INTO control.operators (email, password_hash, name, status)
       VALUES (LOWER($1), $2, $3, 'active')
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash,
         name = COALESCE(EXCLUDED.name, control.operators.name), updated_at = now()
       RETURNING id, email, name, created_at`,
      [email, hash, name || null]
    );
    console.log('Operator ready:', rows[0]);
    console.log('Remember to enroll MFA at POST /api/platform/mfa/enroll after logging in.');
    await pool.end();
  } catch (e) {
    console.error('Failed:', e.message);
    await pool.end().catch(() => {});
    process.exit(1);
  }
})();
