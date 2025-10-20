require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'medflow',
  user: process.env.DB_USER || 'medflow_user',
  password: process.env.DB_PASSWORD,
});

async function seedDatabase() {
  console.log('Starting database seeding...\n');
  
  const client = await pool.connect();
  
  try {
    // Create default practice
    console.log('Creating default practice...');
    const practiceResult = await client.query(`
      INSERT INTO practices (name, tax_id, phone, email, address, plan_tier)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT DO NOTHING
      RETURNING id
    `, [
      'Demo Medical Practice',
      '12-3456789',
      '+1-555-0100',
      'admin@demomedical.com',
      JSON.stringify({
        street: '123 Medical Center Drive',
        city: 'Healthcare City',
        state: 'CA',
        zipCode: '90210',
        country: 'USA'
      }),
      'professional'
    ]);
    
    const practiceId = practiceResult.rows[0]?.id;
    console.log('Practice created:', practiceId);
    
    // Create admin user
    console.log('Creating admin user...');
    const passwordHash = await bcrypt.hash('Admin123!', 10);
    await client.query(`
      INSERT INTO users (first_name, last_name, email, password_hash, role, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (email) DO NOTHING
    `, [
      'System',
      'Administrator',
      'admin@medflow.com',
      passwordHash,
      'admin',
      'active'
    ]);
    
    // Create demo physician
    console.log('Creating demo physician...');
    const physicianPassword = await bcrypt.hash('Doctor123!', 10);
    await client.query(`
      INSERT INTO users (first_name, last_name, email, password_hash, role, phone, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (email) DO NOTHING
    `, [
      'Sarah',
      'Chen',
      'dr.chen@medflow.com',
      physicianPassword,
      'physician',
      '+1-555-0101',
      'active'
    ]);
    
    // Create demo patient
    console.log('Creating demo patient...');
    await client.query(`
      INSERT INTO patients (practice_id, mrn, first_name, last_name, date_of_birth, gender, phone, email, address)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (mrn) DO NOTHING
    `, [
      practiceId,
      'MRN001234',
      'John',
      'Doe',
      '1980-05-15',
      'male',
      '+1-555-0102',
      'john.doe@example.com',
      JSON.stringify({
        street: '456 Patient Lane',
        city: 'Healthcare City',
        state: 'CA',
        zipCode: '90210',
        country: 'USA'
      })
    ]);
    
    console.log('\n✓ Database seeding completed successfully!');
    console.log('\nDefault Credentials:');
    console.log('-------------------');
    console.log('Admin: admin@medflow.com / Admin123!');
    console.log('Doctor: dr.chen@medflow.com / Doctor123!');
    console.log('-------------------\n');
    
  } catch (error) {
    console.error('Seeding failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seedDatabase().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});