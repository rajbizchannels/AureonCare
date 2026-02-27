require('dotenv').config();
const { Pool } = require('pg');

// Supabase uses PostgreSQL with SSL.
// Prefer AC_PG_URI (Supabase connection string) over individual vars.
// For Vercel serverless, use Supabase's Transaction Pooler (port 6543).
const poolConfig = process.env.AC_PG_URI
  ? {
      connectionString: process.env.AC_PG_URI,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    }
  : {
      host: process.env.AC_DB_H || 'localhost',
      port: parseInt(process.env.AC_DB_P) || 5432,
      database: process.env.AC_DB_N || 'aureoncare',
      user: process.env.AC_DB_U || 'postgres',
      password: process.env.AC_DB_W,
      ssl: process.env.AC_DB_S === 'true' ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      options: '-c search_path=public',
    };

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('Unexpected error on idle database client', err);
  process.exit(-1);
});

module.exports = pool;
