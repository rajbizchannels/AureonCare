const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection
const pool = new Pool({
  host: process.env.AC_DB_H || 'localhost',
  port: process.env.AC_DB_P || 5432,
  database: process.env.AC_DB_N || 'aureoncare',
  user: process.env.AC_DB_U || 'postgres',
  password: process.env.AC_DB_W || 'AureonCare2024!',
});

async function runMigrations() {
  try {
    console.log('🔄 Running database migrations...\n');

    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort(); // Run in order

    for (const file of files) {
      console.log(`📄 Running migration: ${file}`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      try {
        await pool.query(sql);
        console.log(`✅ Successfully ran: ${file}\n`);
      } catch (error) {
        console.error(`❌ Error running ${file}:`, error.message);
        if (error.message.includes('already exists')) {
          console.log(`⚠️  Table/Index already exists, skipping...\n`);
        } else {
          throw error;
        }
      }
    }

    // Verify tables were created
    console.log('\n🔍 Verifying tables...');

    const tableCheck = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('appointment_types', 'appointment_waitlist')
      ORDER BY table_name
    `);

    console.log('\n✅ Created tables:');
    tableCheck.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });

    // Check appointment_types data
    const typesCount = await pool.query('SELECT COUNT(*) FROM appointment_types');
    console.log(`\n📊 Appointment types: ${typesCount.rows[0].count} records`);

    console.log('\n✨ Migrations completed successfully!');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

runMigrations()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
