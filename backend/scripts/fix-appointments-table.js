require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

console.log('='.repeat(60));
console.log('FIX APPOINTMENTS TABLE MIGRATION');
console.log('='.repeat(60));
console.log('');

// Database connection configuration
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'aureoncare',
    user: process.env.DB_USER || 'aureoncare_user',
    password: process.env.DB_PASSWORD,
    // Explicitly set search_path to ensure tables are found
    options: '-c search_path=public',
});

async function runMigration() {
    let client;

    try {
        console.log('Connecting to database...');
        client = await pool.connect();
        console.log('✓ Connected to database\n');

        // Check current state
        console.log('Checking current database state...');

        // Check if appointments table exists
        const appointmentsCheck = await client.query(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_name = 'appointments'
            ) as exists
        `);
        console.log(`  Appointments table exists: ${appointmentsCheck.rows[0].exists}`);

        // Check if providers table exists
        const providersCheck = await client.query(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_name = 'providers'
            ) as exists
        `);
        console.log(`  Providers table exists: ${providersCheck.rows[0].exists}`);

        // Check if users table exists
        const usersCheck = await client.query(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_name = 'users'
            ) as exists
        `);
        console.log(`  Users table exists: ${usersCheck.rows[0].exists}`);

        console.log('');
        console.log('Running migration 024_create_appointments_table.sql...');
        console.log('');

        // Read and execute the migration file
        const migrationPath = path.join(__dirname, '..', 'migrations', '024_create_appointments_table.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

        await client.query('BEGIN');
        await client.query(migrationSQL);
        await client.query('COMMIT');

        console.log('');
        console.log('✓ Migration completed successfully!');
        console.log('');

        // Verify the result
        console.log('Verifying migration...');

        const finalAppointmentsCheck = await client.query(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_name = 'appointments'
            ) as exists
        `);
        console.log(`  ✓ Appointments table exists: ${finalAppointmentsCheck.rows[0].exists}`);

        const finalProvidersCheck = await client.query(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_name = 'providers'
            ) as exists
        `);
        console.log(`  ✓ Providers table exists: ${finalProvidersCheck.rows[0].exists}`);

        // Count providers
        const providerCount = await client.query('SELECT COUNT(*) FROM providers');
        console.log(`  ✓ Providers in database: ${providerCount.rows[0].count}`);

        console.log('');
        console.log('='.repeat(60));
        console.log('✓✓✓ MIGRATION SUCCESSFUL ✓✓✓');
        console.log('='.repeat(60));

    } catch (error) {
        if (client) {
            await client.query('ROLLBACK');
        }
        console.error('');
        console.error('✗ Migration failed!');
        console.error('Error:', error.message);
        console.error('');
        console.error('Full error details:');
        console.error(error);
        process.exit(1);
    } finally {
        if (client) {
            client.release();
        }
        await pool.end();
    }
}

runMigration();
