require('dotenv').config();
const { Pool } = require('pg');

console.log('Testing database connection...\n');
console.log('Configuration:');
console.log('Host:', process.env.DB_HOST || 'localhost');
console.log('Port:', process.env.DB_PORT || 5432);
console.log('Database:', process.env.DB_NAME || 'medflow');
console.log('User:', process.env.DB_USER || 'medflow_user');
console.log('Password:', process.env.DB_PASSWORD ? 'SET (length: ' + process.env.DB_PASSWORD.length + ')' : 'NOT SET');
console.log('');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'medflow',
  user: process.env.DB_USER || 'medflow_user',
  password: process.env.DB_PASSWORD,
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
    console.error('3. Test manual connection: psql -U medflow_user -d medflow');
    process.exit(1);
  }
}

testConnection();