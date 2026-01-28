require('dotenv').config();
const { Pool } = require('pg');

// Debug: Check if environment variables are loaded
console.log('Environment check:');
console.log('DB_HOST:', process.env.DB_HOST || 'localhost');
console.log('DB_PORT:', process.env.DB_PORT || 5432);
console.log('DB_NAME:', process.env.DB_NAME || 'aureoncare');
console.log('DB_USER:', process.env.DB_USER || 'aureoncare_user');
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? 'AureonCare2024SecurePass!' : '***NOT SET***');
console.log('');

// Ensure password is a string
const dbPassword = process.env.DB_PASSWORD || '';

if (!dbPassword) {
  console.error('ERROR: DB_PASSWORD is not set in .env file!');
  console.error('Please set DB_PASSWORD in D:\\AureonCare\\backend\\.env');
  process.exit(1);
}

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'aureoncare',
  user: process.env.DB_USER || 'aureoncare_user',
  password: dbPassword.toString(), // Ensure it's a string
  // Explicitly set search_path to ensure tables are found
  options: '-c search_path=public',
});

async function runMigrations() {
  console.log('Starting database migrations...\n');
  
  let client;
  
  try {
    // Test connection first
    console.log('Testing database connection...');
    client = await pool.connect();
    console.log('✓ Database connected successfully\n');
    
    await client.query('BEGIN');
    
    // Create users table
    console.log('Creating users table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        role VARCHAR(50) NOT NULL,
        phone VARCHAR(20),
        status VARCHAR(20) DEFAULT 'active',
        two_factor_enabled BOOLEAN DEFAULT false,
        two_factor_secret VARCHAR(255),
        last_login TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Users table created');
    
    // Create practices table
    console.log('Creating practices table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS practices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        tax_id VARCHAR(20),
        phone VARCHAR(20),
        email VARCHAR(255),
        address JSONB,
        plan_tier VARCHAR(20) DEFAULT 'professional',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Practices table created');
    
    // Create patients table
    console.log('Creating patients table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS patients (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        practice_id UUID REFERENCES practices(id),
        mrn VARCHAR(50) UNIQUE NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        date_of_birth DATE NOT NULL,
        gender VARCHAR(20),
        phone VARCHAR(20),
        email VARCHAR(255),
        address JSONB,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Patients table created');
    
    // Create appointments table
    console.log('Creating appointments table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS appointments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        practice_id UUID REFERENCES practices(id),
        patient_id UUID REFERENCES patients(id),
        provider_id UUID REFERENCES users(id),
        appointment_type VARCHAR(50),
        status VARCHAR(20) DEFAULT 'scheduled',
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP NOT NULL,
        duration_minutes INTEGER,
        reason TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Appointments table created');
    
    // Create indexes
    console.log('Creating indexes...');
    await client.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_patients_mrn ON patients(mrn)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_appointments_start ON appointments(start_time)');
    console.log('✓ Indexes created');
    
    await client.query('COMMIT');
    console.log('\n✓✓✓ All migrations completed successfully! ✓✓✓\n');
    
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('\n✗ Migration failed:', error.message);
    console.error('\nFull error:', error);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

runMigrations().catch(err => {
  console.error('\n✗✗✗ Fatal error ✗✗✗');
  console.error(err);
  process.exit(1);
});