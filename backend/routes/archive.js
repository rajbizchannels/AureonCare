const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAdmin } = require('../middleware/auth');

// Middleware to ensure only admins can access archive endpoints
router.use(requireAdmin);

/**
 * Module definitions - logical groupings of tables for archiving
 */
const ARCHIVE_MODULES = {
  'patient_management': {
    name: 'Patient Management',
    description: 'Patient records, allergies, portal sessions, and pharmacy preferences',
    tables: ['patients', 'patient_allergies', 'patient_portal_sessions', 'patient_pharmacies', 'patient_preferred_pharmacies'],
    primaryKey: 'id'
  },
  'appointments': {
    name: 'Appointments',
    description: 'Appointment scheduling, reminders, and waitlist',
    tables: ['appointments', 'appointment_reminders', 'appointment_waitlist'],
    primaryKey: 'id'
  },
  'medical_records': {
    name: 'Medical Records',
    description: 'Medical records, diagnoses, prescriptions, and prescription history',
    tables: ['medical_records', 'diagnosis', 'prescriptions', 'prescription_history'],
    primaryKey: 'id'
  },
  'claims_billing': {
    name: 'Claims & Billing',
    description: 'Insurance claims, payments, payment postings, denials, and pre-approvals',
    tables: ['claims', 'payments', 'payment_postings', 'denials', 'preapprovals'],
    primaryKey: 'id'
  },
  'healthcare_offerings': {
    name: 'Healthcare Offerings',
    description: 'Healthcare services, packages, pricing, promotions, and reviews',
    tables: ['healthcare_offerings', 'offering_packages', 'offering_pricing', 'offering_promotions', 'offering_reviews', 'package_offerings'],
    primaryKey: 'id'
  },
  'lab_pharmacy': {
    name: 'Lab & Pharmacy',
    description: 'Pharmacies, laboratories, medications, drug interactions, and alternatives',
    tables: ['pharmacies', 'laboratories', 'medications', 'drug_interactions', 'medication_alternatives'],
    primaryKey: 'id'
  },
  'fhir_resources': {
    name: 'FHIR Resources',
    description: 'FHIR R4 resource data',
    tables: ['fhir_resources'],
    primaryKey: 'id'
  },
  'notifications': {
    name: 'Notifications',
    description: 'System notifications',
    tables: ['notifications'],
    primaryKey: 'id'
  },
  'tasks': {
    name: 'Tasks',
    description: 'Task management data',
    tables: ['tasks'],
    primaryKey: 'id'
  },
  'telehealth': {
    name: 'Telehealth',
    description: 'Telehealth session records',
    tables: ['telehealth_sessions'],
    primaryKey: 'id'
  },
  'audit_logs': {
    name: 'Audit Logs',
    description: 'System audit logs and form interaction tracking',
    tables: ['audit_logs'],
    primaryKey: 'id'
  },
  'lab_orders': {
    name: 'Lab Orders',
    description: 'Laboratory test orders',
    tables: ['lab_orders'],
    primaryKey: 'id'
  },
  'intake_forms': {
    name: 'Intake Forms',
    description: 'Patient intake form submissions',
    tables: ['patient_intake_forms'],
    primaryKey: 'id'
  }
};

/**
 * Get available archive modules
 * GET /api/archive/modules
 */
router.get('/modules', async (req, res) => {
  try {
    const modules = Object.entries(ARCHIVE_MODULES).map(([key, config]) => ({
      key,
      name: config.name,
      description: config.description,
      tableCount: config.tables.length,
      tables: config.tables
    }));

    res.json({ modules });
  } catch (error) {
    console.error('Error getting archive modules:', error);
    res.status(500).json({ error: 'Failed to get archive modules', details: error.message });
  }
});

/**
 * Create new archive with selected modules
 * POST /api/archive/create
 */
router.post('/create', async (req, res) => {
  try {
    const { archiveName, description, selectedModules } = req.body;

    if (!archiveName || !selectedModules || !Array.isArray(selectedModules) || selectedModules.length === 0) {
      return res.status(400).json({
        error: 'Archive name and at least one selected module are required'
      });
    }

    // Validate selected modules
    const invalidModules = selectedModules.filter(m => !ARCHIVE_MODULES[m]);
    if (invalidModules.length > 0) {
      return res.status(400).json({
        error: `Invalid modules: ${invalidModules.join(', ')}`
      });
    }

    console.log(`Creating archive "${archiveName}" with modules:`, selectedModules);

    const archiveData = {};
    const metadata = {
      recordCounts: {},
      timestamp: new Date().toISOString()
    };
    let totalRecords = 0;

    // Archive data from selected modules
    for (const moduleKey of selectedModules) {
      const moduleConfig = ARCHIVE_MODULES[moduleKey];
      archiveData[moduleKey] = {};

      for (const table of moduleConfig.tables) {
        try {
          const result = await pool.query(`SELECT * FROM ${table}`);
          archiveData[moduleKey][table] = result.rows;
          metadata.recordCounts[table] = result.rows.length;
          totalRecords += result.rows.length;
          console.log(`Archived ${table}: ${result.rows.length} rows`);
        } catch (error) {
          console.warn(`Warning: Could not archive table ${table}:`, error.message);
          archiveData[moduleKey][table] = [];
          metadata.recordCounts[table] = 0;
        }
      }
    }

    // Calculate size
    const archiveJson = JSON.stringify(archiveData);
    const sizeBytes = Buffer.byteLength(archiveJson, 'utf8');

    // Store archive in database
    const insertQuery = `
      INSERT INTO archives (archive_name, description, modules, archive_data, metadata, created_by, size_bytes, record_count)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, archive_name, description, modules, created_at, size_bytes, record_count
    `;

    const result = await pool.query(insertQuery, [
      archiveName,
      description || null,
      selectedModules,
      archiveData,
      metadata,
      req.user?.id || req.headers['x-user-id'],
      sizeBytes,
      totalRecords
    ]);

    console.log('Archive created successfully:', result.rows[0]);
    res.json({
      success: true,
      message: 'Archive created successfully',
      archive: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating archive:', error);
    res.status(500).json({ error: 'Failed to create archive', details: error.message });
  }
});

/**
 * List all archives
 * GET /api/archive/list
 */
router.get('/list', async (req, res) => {
  try {
    const { status = 'active' } = req.query;

    const query = `
      SELECT
        id,
        archive_name,
        description,
        modules,
        metadata,
        created_at,
        size_bytes,
        record_count,
        status,
        created_by
      FROM archives
      WHERE status = $1
      ORDER BY created_at DESC
    `;

    const result = await pool.query(query, [status]);

    res.json({
      archives: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error listing archives:', error);
    res.status(500).json({ error: 'Failed to list archives', details: error.message });
  }
});

/**
 * Get archive details including data
 * GET /api/archive/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const query = 'SELECT * FROM archives WHERE id = $1';
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Archive not found' });
    }

    res.json({ archive: result.rows[0] });
  } catch (error) {
    console.error('Error getting archive:', error);
    res.status(500).json({ error: 'Failed to get archive', details: error.message });
  }
});

/**
 * Restore archive data with deduplication (ADD mode, not REPLACE)
 * POST /api/archive/:id/restore
 */
router.post('/:id/restore', async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`Restoring archive: ${id}`);

    // Get archive data
    const archiveQuery = 'SELECT * FROM archives WHERE id = $1';
    const archiveResult = await pool.query(archiveQuery, [id]);

    if (archiveResult.rows.length === 0) {
      return res.status(404).json({ error: 'Archive not found' });
    }

    const archive = archiveResult.rows[0];
    const archiveData = archive.archive_data;

    const restoredTables = [];
    const skippedRecords = {};
    const addedRecords = {};
    const errors = [];

    // Restore each module
    for (const [moduleKey, moduleData] of Object.entries(archiveData)) {
      const moduleConfig = ARCHIVE_MODULES[moduleKey];

      if (!moduleConfig) {
        console.warn(`Warning: Unknown module ${moduleKey}, skipping`);
        continue;
      }

      // Restore each table in the module
      for (const [tableName, rows] of Object.entries(moduleData)) {
        if (!Array.isArray(rows) || rows.length === 0) {
          console.log(`Skipping empty table: ${tableName}`);
          continue;
        }

        try {
          let added = 0;
          let skipped = 0;

          // Get table schema to identify primary key and unique constraints
          const schemaQuery = `
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = $1
            ORDER BY ordinal_position
          `;
          const schemaResult = await pool.query(schemaQuery, [tableName]);
          const columns = schemaResult.rows.map(r => r.column_name);

          // Insert each row with ON CONFLICT DO NOTHING for deduplication
          for (const row of rows) {
            try {
              // Filter row to only include columns that exist in the table
              const validColumns = columns.filter(col => row.hasOwnProperty(col));
              const values = validColumns.map(col => row[col]);
              const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

              const query = `
                INSERT INTO ${tableName} (${validColumns.join(', ')})
                VALUES (${placeholders})
                ON CONFLICT DO NOTHING
                RETURNING *
              `;

              const insertResult = await pool.query(query, values);

              if (insertResult.rows.length > 0) {
                added++;
              } else {
                skipped++; // Record already exists (duplicate)
              }
            } catch (rowError) {
              console.warn(`Warning: Could not insert row in ${tableName}:`, rowError.message);
              skipped++;
            }
          }

          restoredTables.push(tableName);
          addedRecords[tableName] = added;
          skippedRecords[tableName] = skipped;
          console.log(`Restored ${tableName}: ${added} added, ${skipped} skipped (duplicates)`);
        } catch (error) {
          console.error(`Error restoring table ${tableName}:`, error.message);
          errors.push({ table: tableName, error: error.message });
        }
      }
    }

    // Update archive status
    await pool.query(
      'UPDATE archives SET status = $1 WHERE id = $2',
      ['restored', id]
    );

    const response = {
      success: true,
      message: 'Archive restored successfully',
      restoredTables,
      totalTables: restoredTables.length,
      addedRecords,
      skippedRecords,
      totalAdded: Object.values(addedRecords).reduce((sum, count) => sum + count, 0),
      totalSkipped: Object.values(skippedRecords).reduce((sum, count) => sum + count, 0),
      errors: errors.length > 0 ? errors : undefined,
      restoredAt: new Date().toISOString(),
      restoredBy: req.user?.id || req.headers['x-user-id']
    };

    console.log('Restore completed:', response);
    res.json(response);
  } catch (error) {
    console.error('Error restoring archive:', error);
    res.status(500).json({
      error: 'Failed to restore archive',
      details: error.message
    });
  }
});

/**
 * Delete archive
 * DELETE /api/archive/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const query = 'DELETE FROM archives WHERE id = $1 RETURNING id, archive_name';
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Archive not found' });
    }

    res.json({
      success: true,
      message: 'Archive deleted successfully',
      archive: result.rows[0]
    });
  } catch (error) {
    console.error('Error deleting archive:', error);
    res.status(500).json({ error: 'Failed to delete archive', details: error.message });
  }
});

/**
 * Get archive statistics
 * GET /api/archive/stats
 */
router.get('/stats/summary', async (req, res) => {
  try {
    const statsQuery = `
      SELECT
        COUNT(*) as total_archives,
        SUM(record_count) as total_records,
        SUM(size_bytes) as total_size_bytes,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_archives,
        COUNT(CASE WHEN status = 'restored' THEN 1 END) as restored_archives
      FROM archives
    `;

    const result = await pool.query(statsQuery);

    res.json({
      stats: result.rows[0]
    });
  } catch (error) {
    console.error('Error getting archive stats:', error);
    res.status(500).json({ error: 'Failed to get archive statistics', details: error.message });
  }
});

module.exports = router;
