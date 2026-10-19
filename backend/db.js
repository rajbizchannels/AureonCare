const path = require('path');
// Load backend/.env first (that is the gitignored path, and the one `vercel env pull`
// should target), then fall back to a .env in the working directory. dotenv never
// overrides variables that are already set, so a real environment — Vercel, CI, an
// exported shell var — always wins over both files. Resolving from __dirname rather than
// cwd means the admin scripts work whichever directory they are invoked from, which
// matters on Windows where there is no `set -a && . ./.env` idiom.
require('dotenv').config({ path: path.join(__dirname, '.env') });
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
  // Log but do NOT exit — especially critical in Vercel serverless where
  // process.exit() kills the function instance before any response is sent,
  // causing Vercel to return an unformatted 500 instead of our JSON error.
  console.error('Unexpected error on idle database client', err.message);
});

/**
 * Turn a driver-level connection failure into something an operator can act on.
 *
 * pg's own messages name the mechanism, not the misconfiguration: "SASL:
 * SCRAM-SERVER-FIRST-MESSAGE: client password must be a string" means no password was
 * supplied to a server that requires one, which is not obvious from the text.
 *
 * @returns {string|null} guidance, or null if the error is not a known connection problem
 */
function explainConnectionError(err) {
  const msg = String((err && err.message) || '');
  const usingUri = Boolean(process.env.AC_PG_URI);

  if (/client password must be a string|SASL/i.test(msg)) {
    return usingUri
      ? 'The connection string in AC_PG_URI has no password. Copy the full URI from\n' +
        '  Supabase -> Settings -> Database -> Connection string (it includes the password).'
      : 'No database password was supplied, but the server requires one.\n' +
        '  Set AC_DB_W, or better, set AC_PG_URI to the full connection string.\n' +
        '  If you pulled the environment with `vercel env pull backend/.env`, check that the\n' +
        '  file actually contains AC_PG_URI or AC_DB_W — an empty value reads as unset.';
  }
  if (err && err.code === '28P01') {
    return 'The database rejected the password (28P01). Check AC_DB_W / AC_PG_URI.';
  }
  if (err && err.code === '3D000') {
    return `The database named in ${usingUri ? 'AC_PG_URI' : 'AC_DB_N'} does not exist.`;
  }
  if (/ECONNREFUSED/.test(msg)) {
    return `Nothing is listening at ${usingUri ? 'the host in AC_PG_URI' : `${process.env.AC_DB_H || 'localhost'}:${process.env.AC_DB_P || 5432}`}.\n` +
      '  A default of localhost usually means the environment was never loaded.';
  }
  if (/ENOTFOUND|EAI_AGAIN/.test(msg)) {
    return 'The database host could not be resolved. Check the host in AC_PG_URI / AC_DB_H.';
  }
  if (/does not support SSL/i.test(msg)) {
    return 'The server does not speak SSL, but AC_PG_URI forces it. Use AC_DB_* for a plain local server.';
  }
  if (/self.signed|certificate/i.test(msg)) {
    return 'TLS negotiation failed. Managed providers need SSL — prefer AC_PG_URI, which enables it.';
  }
  return null;
}

module.exports = pool;
module.exports.explainConnectionError = explainConnectionError;
