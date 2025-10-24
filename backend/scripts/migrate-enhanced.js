require('dotenv').config();
const { Pool } = require('pg');

// Debug: Check if environment variables are loaded
console.log('Environment check:');
console.log('DB_HOST:', process.env.DB_HOST || 'localhost');
console.log('DB_PORT:', process.env.DB_PORT || 5432);
console.log('DB_NAME:', process.env.DB_NAME || 'medflow');
console.log('DB_USER:', process.env.DB_USER || 'medflow_user');
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '***SET***' : '***NOT SET***');
console.log('');

// Ensure password is a string
const dbPassword = process.env.DB_PASSWORD || '';

if (!dbPassword) {
  console.error('ERROR: DB_PASSWORD is not set in .env file!');
  console.error('Please set DB_PASSWORD in backend/.env');
  process.exit(1);
}

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'medflow',
  user: process.env.DB_USER || 'medflow_user',
  password: dbPassword.toString(),
});

async function runMigrations() {
  console.log('Starting enhanced database migrations...\n');

  let client;

  try {
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
        password_hash VARCHAR(255),
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        role VARCHAR(50) NOT NULL,
        phone VARCHAR(20),
        status VARCHAR(20) DEFAULT 'active',
        two_factor_enabled BOOLEAN DEFAULT false,
        two_factor_secret VARCHAR(255),
        avatar VARCHAR(10),
        specialty VARCHAR(100),
        license_number VARCHAR(50),
        preferences JSONB DEFAULT '{}',
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
        emergency_contact JSONB,
        insurance_info JSONB,
        status VARCHAR(20) DEFAULT 'active',
        portal_enabled BOOLEAN DEFAULT false,
        portal_password_hash VARCHAR(255),
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

    // Create claims table
    console.log('Creating claims table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS claims (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        practice_id UUID REFERENCES practices(id),
        patient_id UUID REFERENCES patients(id),
        claim_number VARCHAR(50) UNIQUE NOT NULL,
        payer VARCHAR(255),
        service_date DATE NOT NULL,
        amount DECIMAL(10, 2),
        status VARCHAR(20) DEFAULT 'pending',
        diagnosis_codes TEXT[],
        procedure_codes TEXT[],
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Claims table created');

    // Create notifications table
    console.log('Creating notifications table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        type VARCHAR(50) NOT NULL,
        message TEXT NOT NULL,
        read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Notifications table created');

    // Create tasks table
    console.log('Creating tasks table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        priority VARCHAR(20) DEFAULT 'medium',
        status VARCHAR(20) DEFAULT 'pending',
        due_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Tasks table created');

    // Create telehealth_sessions table
    console.log('Creating telehealth_sessions table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS telehealth_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        appointment_id UUID REFERENCES appointments(id),
        patient_id UUID REFERENCES patients(id),
        provider_id UUID REFERENCES users(id),
        session_status VARCHAR(20) DEFAULT 'scheduled',
        room_id VARCHAR(100) UNIQUE NOT NULL,
        meeting_url TEXT,
        start_time TIMESTAMP,
        end_time TIMESTAMP,
        duration_minutes INTEGER,
        recording_url TEXT,
        recording_enabled BOOLEAN DEFAULT false,
        participants JSONB DEFAULT '[]',
        session_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Telehealth sessions table created');

    // Create fhir_resources table
    console.log('Creating fhir_resources table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS fhir_resources (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        resource_type VARCHAR(50) NOT NULL,
        resource_id VARCHAR(100) NOT NULL,
        patient_id UUID REFERENCES patients(id),
        fhir_version VARCHAR(10) DEFAULT 'R4',
        resource_data JSONB NOT NULL,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(resource_type, resource_id)
      )
    `);
    console.log('✓ FHIR resources table created');

    // Create patient_portal_sessions table
    console.log('Creating patient_portal_sessions table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS patient_portal_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID REFERENCES patients(id),
        session_token VARCHAR(255) UNIQUE NOT NULL,
        ip_address VARCHAR(45),
        user_agent TEXT,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Patient portal sessions table created');

    // Create social_auth table
    console.log('Creating social_auth table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS social_auth (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        patient_id UUID REFERENCES patients(id),
        provider VARCHAR(20) NOT NULL,
        provider_user_id VARCHAR(255) NOT NULL,
        access_token TEXT,
        refresh_token TEXT,
        token_expires_at TIMESTAMP,
        profile_data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(provider, provider_user_id)
      )
    `);
    console.log('✓ Social auth table created');

    // Create medical_records table for patient case history
    console.log('Creating medical_records table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS medical_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID REFERENCES patients(id),
        provider_id UUID REFERENCES users(id),
        record_type VARCHAR(50) NOT NULL,
        record_date DATE NOT NULL,
        title VARCHAR(255),
        description TEXT,
        diagnosis TEXT,
        treatment TEXT,
        medications JSONB,
        attachments JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Medical records table created');

    // Create indexes
    console.log('Creating indexes...');
    await client.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_patients_mrn ON patients(mrn)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_patients_email ON patients(email)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_appointments_provider ON appointments(provider_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_appointments_start ON appointments(start_time)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_telehealth_appointment ON telehealth_sessions(appointment_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_telehealth_room ON telehealth_sessions(room_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_fhir_patient ON fhir_resources(patient_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_fhir_type ON fhir_resources(resource_type)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_portal_sessions_token ON patient_portal_sessions(session_token)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_portal_sessions_patient ON patient_portal_sessions(patient_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_social_auth_user ON social_auth(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_social_auth_patient ON social_auth(patient_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_medical_records_patient ON medical_records(patient_id)');
    console.log('✓ Indexes created');

    await client.query('COMMIT');
    console.log('\n✓✓✓ All enhanced migrations completed successfully! ✓✓✓\n');

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
