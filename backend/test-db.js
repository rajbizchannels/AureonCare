require('dotenv').config();
const { Pool } = require('pg');

console.log('Testing database connection...\n');
console.log('Configuration:');
console.log('Host:', process.env.AC_DB_H || 'localhost');
console.log('Port:', process.env.AC_DB_P || 5432);
console.log('Database:', process.env.AC_DB_N || 'aureoncare');
console.log('User:', process.env.AC_DB_U || 'aureoncare_user');
console.log('Password:', process.env.AC_DB_W ? 'SET (length: ' + process.env.AC_DB_W.length + ')' : 'NOT SET');
console.log('');

const pool = new Pool({
  host: process.env.AC_DB_H || 'localhost',
  port: parseInt(process.env.AC_DB_P || '5432'),
  database: process.env.AC_DB_N || 'aureoncare',
  user: process.env.AC_DB_U || 'aureoncare_user',
  password: process.env.AC_DB_W,
  // Explicitly set search_path to ensure tables are found
  options: '-c search_path=public',
});

async function testConnection() {
  try {
    const client = await pool.connect();
    console.log('✓ Connection successful!');
    
    const result = await client.query('SELECT NOW()');
    console.log('✓ Query successful!');
    console.log('Server time:', result.rows[0].now);
    
    client.release();
    await pool.end();
    
    console.log('\n✓✓✓ Database is working correctly! ✓✓✓\n');
  } catch (error) {
    console.error('✗ Connection failed:', error.message);
    console.error('\nTroubleshooting steps:');
    console.error('1. Check PostgreSQL is running: net start postgresql-x64-15');
    console.error('2. Verify password in .env matches database');
    console.error('3. Test manual connection: psql -U aureoncare_user -d aureoncare');
    process.exit(1);
  }
}

testConnection();