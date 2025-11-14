require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

console.log('='.repeat(60));
console.log('APPOINTMENTS & PROVIDERS TABLE MIGRATIONS');
console.log('='.repeat(60));
console.log('');

// Database connection configuration
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'medflow',
    user: process.env.DB_USER || 'medflow_user',
    password: process.env.DB_PASSWORD,
    // Explicitly set search_path to ensure tables are found
    options: '-c search_path=public',
});

async function runMigrations() {
    let client;

    try {
        console.log('Connecting to database...');
        client = await pool.connect();
        console.log('✓ Connected to database\n');

        // Check current state
        console.log('Checking current database state...');

        // Check if users table exists
        const usersCheck = await client.query(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_name = 'users'
            ) as exists
        `);

        if (!usersCheck.rows[0].exists) {
            console.error('✗ Users table does not exist!');
            console.error('Please run the basic database setup first.');
            process.exit(1);
        }
        console.log('  ✓ Users table exists');

        // Check if patients table exists
        const patientsCheck = await client.query(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_name = 'patients'
            ) as exists
        `);
        console.log(`  Patients table exists: ${patientsCheck.rows[0].exists}`);

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

        console.log('');

        // Determine which migration to run
        if (!providersCheck.rows[0].exists && !appointmentsCheck.rows[0].exists) {
            console.log('Running fresh installation (Migration 024)...');
            console.log('This will create providers and appointments tables');
            console.log('');

            const migration024Path = path.join(__dirname, '..', 'migrations', '024_create_appointments_table.sql');
            const migration024SQL = fs.readFileSync(migration024Path, 'utf8');

            await client.query('BEGIN');
            await client.query(migration024SQL);
            await client.query('COMMIT');

            console.log('✓ Migration 024 completed successfully!');
        } else {
            console.log('Running schema update (Migration 025)...');
            console.log('This will merge providers.id with users.id');
            console.log('');

            const migration025Path = path.join(__dirname, '..', 'migrations', '025_merge_providers_id_with_user_id.sql');
            const migration025SQL = fs.readFileSync(migration025Path, 'utf8');

            await client.query('BEGIN');
            await client.query(migration025SQL);
            await client.query('COMMIT');

            console.log('✓ Migration 025 completed successfully!');
        }

        console.log('');

        // Verify the result
        console.log('Verifying migration results...');

        const finalProvidersCheck = await client.query(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_name = 'providers'
            ) as exists
        `);
        console.log(`  ✓ Providers table exists: ${finalProvidersCheck.rows[0].exists}`);

        const finalAppointmentsCheck = await client.query(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_name = 'appointments'
            ) as exists
        `);
        console.log(`  ✓ Appointments table exists: ${finalAppointmentsCheck.rows[0].exists}`);

        // Verify providers.id references users.id
        const providerIdCheck = await client.query(`
            SELECT
                tc.constraint_name,
                kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
            WHERE tc.table_name = 'providers'
                AND tc.constraint_type = 'FOREIGN KEY'
                AND kcu.column_name = 'id'
        `);

        if (providerIdCheck.rows.length > 0) {
            const fk = providerIdCheck.rows[0];
            console.log(`  ✓ providers.id references ${fk.foreign_table_name}.${fk.foreign_column_name}`);
        }

        // Count providers
        const providerCount = await client.query('SELECT COUNT(*) FROM providers');
        console.log(`  ✓ Providers in database: ${providerCount.rows[0].count}`);

        // Count appointments
        const appointmentCount = await client.query('SELECT COUNT(*) FROM appointments');
        console.log(`  ✓ Appointments in database: ${appointmentCount.rows[0].count}`);

        console.log('');
        console.log('='.repeat(60));
        console.log('✓✓✓ ALL MIGRATIONS SUCCESSFUL ✓✓✓');
        console.log('='.repeat(60));
        console.log('');
        console.log('Schema Summary:');
        console.log('  • providers.id now directly references users.id');
        console.log('  • appointments.provider_id references providers.id');
        console.log('  • This matches the pattern used in patients table');
        console.log('');

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

runMigrations();
