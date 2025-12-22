const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'medflow',
  user: process.env.DB_USER || 'medflow_user',
  password: process.env.DB_PASSWORD || 'medflow_password'
});

async function fixLabOrdersSchema() {
  try {
    console.log('Fixing lab_orders table schema...');

    // Enable UUID extension if not already enabled
    await pool.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
    console.log('✓ UUID extension enabled');

    // Create diagnoses table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS diagnoses (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL,
        provider_id INTEGER,
        diagnosis_name VARCHAR(255),
        diagnosis_code VARCHAR(50),
        description TEXT,
        severity VARCHAR(50),
        status VARCHAR(50) DEFAULT 'Active',
        diagnosed_date DATE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ Diagnoses table checked/created');

    // Add laboratory_id column if it doesn't exist
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'lab_orders' AND column_name = 'laboratory_id'
        ) THEN
          ALTER TABLE lab_orders ADD COLUMN laboratory_id INTEGER REFERENCES laboratories(id);
          RAISE NOTICE 'Added laboratory_id column to lab_orders';
        ELSE
          RAISE NOTICE 'laboratory_id column already exists';
        END IF;
      END $$;
    `);

    // Check if diagnoses table exists
    const diagnosesTableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'diagnoses'
      );
    `);

    // Add linked_diagnosis_id column if it doesn't exist
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'lab_orders' AND column_name = 'linked_diagnosis_id'
        ) THEN
          ${diagnosesTableExists.rows[0].exists
            ? "ALTER TABLE lab_orders ADD COLUMN linked_diagnosis_id INTEGER REFERENCES diagnoses(id) ON DELETE SET NULL;"
            : "ALTER TABLE lab_orders ADD COLUMN linked_diagnosis_id INTEGER;"}
          RAISE NOTICE 'Added linked_diagnosis_id column to lab_orders';
        ELSE
          RAISE NOTICE 'linked_diagnosis_id column already exists';
        END IF;
      END $$;
    `);

    // Add order_type column if it doesn't exist
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'lab_orders' AND column_name = 'order_type'
        ) THEN
          ALTER TABLE lab_orders ADD COLUMN order_type VARCHAR(50) DEFAULT 'lab_test';
          RAISE NOTICE 'Added order_type column to lab_orders';
        ELSE
          RAISE NOTICE 'order_type column already exists';
        END IF;
      END $$;
    `);

    // Add clinical_notes column if it doesn't exist
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'lab_orders' AND column_name = 'clinical_notes'
        ) THEN
          ALTER TABLE lab_orders ADD COLUMN clinical_notes TEXT;
          RAISE NOTICE 'Added clinical_notes column to lab_orders';
        ELSE
          RAISE NOTICE 'clinical_notes column already exists';
        END IF;
      END $$;
    `);

    // Add specimen_type column if it doesn't exist
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'lab_orders' AND column_name = 'specimen_type'
        ) THEN
          ALTER TABLE lab_orders ADD COLUMN specimen_type VARCHAR(100);
          RAISE NOTICE 'Added specimen_type column to lab_orders';
        ELSE
          RAISE NOTICE 'specimen_type column already exists';
        END IF;
      END $$;
    `);

    // Add collection_date column if it doesn't exist
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'lab_orders' AND column_name = 'collection_date'
        ) THEN
          ALTER TABLE lab_orders ADD COLUMN collection_date TIMESTAMP;
          RAISE NOTICE 'Added collection_date column to lab_orders';
        ELSE
          RAISE NOTICE 'collection_date column already exists';
        END IF;
      END $$;
    `);

    // Add order_status column if it doesn't exist
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'lab_orders' AND column_name = 'order_status'
        ) THEN
          ALTER TABLE lab_orders ADD COLUMN order_status VARCHAR(50) DEFAULT 'one-time';
          RAISE NOTICE 'Added order_status column to lab_orders';
        ELSE
          RAISE NOTICE 'order_status column already exists';
        END IF;
      END $$;
    `);

    // Add order_status_date column if it doesn't exist
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'lab_orders' AND column_name = 'order_status_date'
        ) THEN
          ALTER TABLE lab_orders ADD COLUMN order_status_date DATE;
          RAISE NOTICE 'Added order_status_date column to lab_orders';
        ELSE
          RAISE NOTICE 'order_status_date column already exists';
        END IF;
      END $$;
    `);

    // Add frequency column if it doesn't exist
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'lab_orders' AND column_name = 'frequency'
        ) THEN
          ALTER TABLE lab_orders ADD COLUMN frequency VARCHAR(50);
          RAISE NOTICE 'Added frequency column to lab_orders';
        ELSE
          RAISE NOTICE 'frequency column already exists';
        END IF;
      END $$;
    `);

    // Add collection_class column if it doesn't exist
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'lab_orders' AND column_name = 'collection_class'
        ) THEN
          ALTER TABLE lab_orders ADD COLUMN collection_class VARCHAR(50) DEFAULT 'clinic-collect';
          RAISE NOTICE 'Added collection_class column to lab_orders';
        ELSE
          RAISE NOTICE 'collection_class column already exists';
        END IF;
      END $$;
    `);

    // Add result_recipients column if it doesn't exist
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'lab_orders' AND column_name = 'result_recipients'
        ) THEN
          ALTER TABLE lab_orders ADD COLUMN result_recipients JSONB DEFAULT '[]'::jsonb;
          RAISE NOTICE 'Added result_recipients column to lab_orders';
        ELSE
          RAISE NOTICE 'result_recipients column already exists';
        END IF;
      END $$;
    `);

    console.log('✓ Lab orders table schema updated successfully!');
    console.log('\nPlease restart your backend server for changes to take effect.');
  } catch (error) {
    console.error('Error fixing lab_orders schema:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

fixLabOrdersSchema()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
