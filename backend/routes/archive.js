const express = require('express');
const router = express.Router();
const pool = require('../db'); // Main database
const { archivePool, ensureTableStructure, getArchiveTables, getTableRecordCount } = require('../archiveDb');
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
 * Create new archive - moves data from main DB to archive DB
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

    const recordCounts = {};
    const archivedTables = [];
    let totalRecords = 0;
    let totalSizeBytes = 0;

    // Archive data from selected modules to archive database
    for (const moduleKey of selectedModules) {
      const moduleConfig = ARCHIVE_MODULES[moduleKey];

      for (const tableName of moduleConfig.tables) {
        try {
          console.log(`[Archive] Processing table: ${tableName}`);

          // Ensure table structure exists in archive database
          const tableReady = await ensureTableStructure(pool, tableName);

          if (!tableReady) {
            console.log(`[Archive] ⊘ Skipping ${tableName} - table not available`);
            continue;
          }

          // Copy data from main database to archive database
          const mainClient = await pool.connect();
          const archiveClient = await archivePool.connect();

          try {
            // Get data from main database
            const selectQuery = `SELECT * FROM ${tableName}`;
            console.log(`[Archive] Querying ${tableName} from main database...`);
            const result = await mainClient.query(selectQuery);
            const rows = result.rows;

            console.log(`[Archive] Found ${rows.length} rows in ${tableName}`);

            // Always add table to archived list, even if empty
            archivedTables.push(tableName);

            if (rows.length > 0) {
              // Calculate approximate size
              const rowSize = JSON.stringify(rows[0]).length;
              const tableSize = rowSize * rows.length;
              totalSizeBytes += tableSize;

              console.log(`[Archive] Inserting ${rows.length} rows into archive database...`);

              // Insert data into archive database
              let insertedCount = 0;
              let skippedCount = 0;
              let errorCount = 0;

              for (let i = 0; i < rows.length; i++) {
                const row = rows[i];

                // Log first 3 and last row for debugging
                if (i < 3 || i === rows.length - 1) {
                  console.log(`[Archive] Processing row ${i + 1}/${rows.length}...`);
                }

                try {
                  const columns = Object.keys(row);
                  const values = Object.values(row);
                  const placeholders = values.map((_, idx) => `$${idx + 1}`).join(', ');

                  const insertQuery = `
                    INSERT INTO ${tableName} (${columns.join(', ')})
                    VALUES (${placeholders})
                    ON CONFLICT DO NOTHING
                    RETURNING *
                  `;

                  const insertResult = await archiveClient.query(insertQuery, values);

                  if (insertResult.rows.length > 0) {
                    insertedCount++;
                    if (i < 3 || i === rows.length - 1) {
                      console.log(`[Archive] ✓ Row ${i + 1} INSERTED`);
                    }
                  } else {
                    skippedCount++;
                    if (i < 3 || i === rows.length - 1) {
                      console.log(`[Archive] ⊘ Row ${i + 1} SKIPPED (conflict)`);
                    }
                  }
                } catch (rowError) {
                  errorCount++;
                  console.error(`[Archive] ✗ Row ${i + 1} ERROR:`, rowError.message);
                  if (i < 2) {
                    console.error(`[Archive] Row data sample:`, JSON.stringify(row).substring(0, 200));
                  }
                }
              }

              console.log(`[Archive] Insert summary for ${tableName}:`);
              console.log(`[Archive]   - Inserted: ${insertedCount}`);
              console.log(`[Archive]   - Skipped: ${skippedCount}`);
              console.log(`[Archive]   - Errors: ${errorCount}`);
              console.log(`[Archive]   - Total processed: ${rows.length}`);

              recordCounts[tableName] = insertedCount;
              totalRecords += insertedCount;
              console.log(`[Archive] ✓ ${tableName}: ${insertedCount}/${rows.length} rows inserted (${tableSize} bytes)`);
            } else {
              recordCounts[tableName] = 0;
              console.log(`[Archive] Table ${tableName} is empty (0 rows) - structure created`);
            }
          } finally {
            mainClient.release();
            archiveClient.release();
          }
        } catch (error) {
          console.warn(`Warning: Could not archive table ${tableName}:`, error.message);
          recordCounts[tableName] = 0;
        }
      }
    }

    // Store metadata in archive database
    const metadataQuery = `
      INSERT INTO archive_metadata (
        archive_name, description, archived_tables, archived_modules,
        record_counts, archived_by, status, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, archive_name, description, archived_modules, archive_date, status
    `;

    const metadata = {
      timestamp: new Date().toISOString(),
      total_size_bytes: totalSizeBytes,
      total_records: totalRecords
    };

    const metadataResult = await archivePool.query(metadataQuery, [
      archiveName,
      description || null,
      archivedTables,
      selectedModules,
      recordCounts,
      req.user?.id || req.headers['x-user-id'],
      'active',
      metadata
    ]);

    console.log('[Archive] ✓ Archive created successfully!');
    console.log('[Archive]   - Archive ID:', metadataResult.rows[0].id);
    console.log('[Archive]   - Total records:', totalRecords);
    console.log('[Archive]   - Total size:', totalSizeBytes, 'bytes');
    console.log('[Archive]   - Tables:', archivedTables.length);

    res.json({
      success: true,
      message: 'Archive created successfully',
      archive: {
        ...metadataResult.rows[0],
        record_count: totalRecords,
        table_count: archivedTables.length,
        size_bytes: totalSizeBytes
      }
    });
  } catch (error) {
    console.error('Error creating archive:', error);
    res.status(500).json({ error: 'Failed to create archive', details: error.message });
  }
});

/**
 * List all archives from archive database
 * GET /api/archive/list
 */
router.get('/list', async (req, res) => {
  try {
    const { status } = req.query;

    console.log('[Archive API] GET /list - Status filter:', status || '(all)');

    let query;
    let queryParams = [];

    if (status && status.trim() !== '') {
      // Filter by specific status
      query = `
        SELECT
          id,
          archive_name,
          description,
          archived_modules,
          archived_tables,
          record_counts,
          archive_date,
          status,
          archived_by
        FROM archive_metadata
        WHERE status = $1
        ORDER BY archive_date DESC
      `;
      queryParams = [status];
    } else {
      // Get ALL archives regardless of status
      query = `
        SELECT
          id,
          archive_name,
          description,
          archived_modules,
          archived_tables,
          record_counts,
          archive_date,
          status,
          archived_by
        FROM archive_metadata
        ORDER BY archive_date DESC
      `;
      queryParams = [];
    }

    const result = await archivePool.query(query, queryParams);

    console.log(`[Archive API] Found ${result.rows.length} archives in archive database`);
    if (result.rows.length > 0) {
      console.log('[Archive API] Most recent archive:', {
        name: result.rows[0].archive_name,
        date: result.rows[0].archive_date,
        status: result.rows[0].status,
        modules: result.rows[0].archived_modules,
        tableCount: result.rows[0].archived_tables?.length || 0
      });
    }

    // Calculate total records and extract size for each archive
    const archives = result.rows.map(archive => {
      const recordCount = Object.values(archive.record_counts || {})
        .reduce((sum, count) => sum + count, 0);

      const sizeBytes = archive.metadata?.total_size_bytes || 0;

      return {
        ...archive,
        record_count: recordCount,
        size_bytes: sizeBytes,
        modules: archive.archived_modules
      };
    });

    console.log(`[Archive API] Returning ${archives.length} archives to client`);

    res.json({
      archives,
      count: archives.length
    });
  } catch (error) {
    console.error('[Archive API] ERROR listing archives:', error);
    console.error('[Archive API] Error details:', error.message);
    console.error('[Archive API] Stack:', error.stack);
    res.status(500).json({ error: 'Failed to list archives', details: error.message });
  }
});

/**
 * Get archive details including metadata
 * GET /api/archive/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const query = 'SELECT * FROM archive_metadata WHERE id = $1';
    const result = await archivePool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Archive not found' });
    }

    const archive = result.rows[0];
    const recordCount = Object.values(archive.record_counts || {})
      .reduce((sum, count) => sum + count, 0);

    res.json({
      archive: {
        ...archive,
        record_count: recordCount
      }
    });
  } catch (error) {
    console.error('Error getting archive:', error);
    res.status(500).json({ error: 'Failed to get archive', details: error.message });
  }
});

/**
 * Browse archived data - preview data without restoring
 * GET /api/archive/:id/browse
 */
router.get('/:id/browse', async (req, res) => {
  try {
    const { id } = req.params;
    const { table, limit = 100, offset = 0 } = req.query;

    // Get archive metadata
    const metadataQuery = 'SELECT * FROM archive_metadata WHERE id = $1';
    const metadataResult = await archivePool.query(metadataQuery, [id]);

    if (metadataResult.rows.length === 0) {
      return res.status(404).json({ error: 'Archive not found' });
    }

    const archive = metadataResult.rows[0];

    // If specific table requested, return its data
    if (table) {
      if (!archive.archived_tables.includes(table)) {
        return res.status(404).json({ error: `Table ${table} not found in this archive` });
      }

      const dataQuery = `
        SELECT * FROM ${table}
        ORDER BY 1
        LIMIT $1 OFFSET $2
      `;

      const countQuery = `SELECT COUNT(*) as count FROM ${table}`;

      const [dataResult, countResult] = await Promise.all([
        archivePool.query(dataQuery, [limit, offset]),
        archivePool.query(countQuery)
      ]);

      return res.json({
        table,
        data: dataResult.rows,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: parseInt(countResult.rows[0].count)
        }
      });
    }

    // Otherwise return summary of all tables
    const tableSummaries = [];

    for (const tableName of archive.archived_tables) {
      try {
        const count = await getTableRecordCount(tableName);
        const previewQuery = `SELECT * FROM ${tableName} LIMIT 5`;
        const preview = await archivePool.query(previewQuery);

        tableSummaries.push({
          table: tableName,
          recordCount: count,
          preview: preview.rows
        });
      } catch (error) {
        console.warn(`Could not get data for ${tableName}:`, error.message);
      }
    }

    res.json({
      archive: {
        id: archive.id,
        name: archive.archive_name,
        description: archive.description,
        date: archive.archive_date
      },
      tables: tableSummaries
    });
  } catch (error) {
    console.error('Error browsing archive:', error);
    res.status(500).json({ error: 'Failed to browse archive', details: error.message });
  }
});

/**
 * Restore archive data from archive DB to main DB with deduplication
 * POST /api/archive/:id/restore
 */
router.post('/:id/restore', async (req, res) => {
  try {
    const { id } = req.params;
    const { tables } = req.body; // Optional: restore specific tables only

    console.log(`Restoring archive: ${id}`);

    // Get archive metadata
    const metadataQuery = 'SELECT * FROM archive_metadata WHERE id = $1';
    const metadataResult = await archivePool.query(metadataQuery, [id]);

    if (metadataResult.rows.length === 0) {
      return res.status(404).json({ error: 'Archive not found' });
    }

    const archive = metadataResult.rows[0];
    const tablesToRestore = tables || archive.archived_tables;

    const restoredTables = [];
    const skippedRecords = {};
    const addedRecords = {};
    const errors = [];

    // Restore each table
    for (const tableName of tablesToRestore) {
      if (!archive.archived_tables.includes(tableName)) {
        console.warn(`Table ${tableName} not in archive, skipping`);
        continue;
      }

      try {
        let added = 0;
        let skipped = 0;

        // Get data from archive database
        const archiveClient = await archivePool.connect();
        const mainClient = await pool.connect();

        try {
          const selectQuery = `SELECT * FROM ${tableName}`;
          const result = await archiveClient.query(selectQuery);
          const rows = result.rows;

          // Get table schema to identify columns
          const schemaQuery = `
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = $1
            ORDER BY ordinal_position
          `;
          const schemaResult = await mainClient.query(schemaQuery, [tableName]);
          const columns = schemaResult.rows.map(r => r.column_name);

          // Insert each row with deduplication
          for (const row of rows) {
            try {
              const validColumns = columns.filter(col => row.hasOwnProperty(col));
              const values = validColumns.map(col => row[col]);
              const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

              const insertQuery = `
                INSERT INTO ${tableName} (${validColumns.join(', ')})
                VALUES (${placeholders})
                ON CONFLICT DO NOTHING
                RETURNING *
              `;

              const insertResult = await mainClient.query(insertQuery, values);

              if (insertResult.rows.length > 0) {
                added++;
              } else {
                skipped++;
              }
            } catch (rowError) {
              console.warn(`Warning: Could not insert row in ${tableName}:`, rowError.message);
              skipped++;
            }
          }

          restoredTables.push(tableName);
          addedRecords[tableName] = added;
          skippedRecords[tableName] = skipped;
          console.log(`Restored ${tableName}: ${added} added, ${skipped} skipped`);
        } finally {
          archiveClient.release();
          mainClient.release();
        }
      } catch (error) {
        console.error(`Error restoring table ${tableName}:`, error.message);
        errors.push({ table: tableName, error: error.message });
      }
    }

    // Update archive status
    await archivePool.query(
      'UPDATE archive_metadata SET status = $1 WHERE id = $2',
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
 * Delete archive from archive database
 * DELETE /api/archive/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { deleteData = false } = req.query;

    // Get archive metadata
    const metadataQuery = 'SELECT * FROM archive_metadata WHERE id = $1';
    const metadataResult = await archivePool.query(metadataQuery, [id]);

    if (metadataResult.rows.length === 0) {
      return res.status(404).json({ error: 'Archive not found' });
    }

    const archive = metadataResult.rows[0];

    // If deleteData is true, also remove archived data from tables
    if (deleteData === 'true') {
      for (const tableName of archive.archived_tables) {
        try {
          await archivePool.query(`TRUNCATE TABLE ${tableName} CASCADE`);
          console.log(`Cleared data from ${tableName} in archive database`);
        } catch (error) {
          console.warn(`Could not clear ${tableName}:`, error.message);
        }
      }
    }

    // Delete metadata
    const deleteQuery = 'DELETE FROM archive_metadata WHERE id = $1 RETURNING id, archive_name';
    const deleteResult = await archivePool.query(deleteQuery, [id]);

    res.json({
      success: true,
      message: 'Archive deleted successfully',
      archive: deleteResult.rows[0],
      dataDeleted: deleteData === 'true'
    });
  } catch (error) {
    console.error('Error deleting archive:', error);
    res.status(500).json({ error: 'Failed to delete archive', details: error.message });
  }
});

/**
 * Get archive statistics
 * GET /api/archive/stats/summary
 */
router.get('/stats/summary', async (req, res) => {
  try {
    const statsQuery = `
      SELECT
        COUNT(*) as total_archives,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_archives,
        COUNT(CASE WHEN status = 'restored' THEN 1 END) as restored_archives
      FROM archive_metadata
    `;

    const result = await archivePool.query(statsQuery);
    const stats = result.rows[0];

    // Calculate total records and size across all archives
    const recordQuery = 'SELECT record_counts, metadata FROM archive_metadata';
    const recordResult = await archivePool.query(recordQuery);

    let totalRecords = 0;
    let totalSizeBytes = 0;

    recordResult.rows.forEach(row => {
      if (row.record_counts) {
        totalRecords += Object.values(row.record_counts).reduce((sum, count) => sum + count, 0);
      }
      if (row.metadata && row.metadata.total_size_bytes) {
        totalSizeBytes += row.metadata.total_size_bytes;
      }
    });

    res.json({
      stats: {
        ...stats,
        total_records: totalRecords,
        total_size_bytes: totalSizeBytes
      }
    });
  } catch (error) {
    console.error('Error getting archive stats:', error);
    res.status(500).json({ error: 'Failed to get archive statistics', details: error.message });
  }
});

module.exports = router;
