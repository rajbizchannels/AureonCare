/**
 * Archive Scheduler Service
 *
 * Automatically executes archive rules based on their schedules
 * Checks every minute for rules that need to run
 */

const pool = require('../db');
const { archivePool } = require('../archiveDb');

// Track running jobs to prevent duplicate execution
const runningJobs = new Set();

/**
 * Execute an archive rule
 */
async function executeArchiveRule(rule) {
  const ruleId = rule.id;

  // Prevent duplicate execution
  if (runningJobs.has(ruleId)) {
    console.log(`Archive rule ${rule.rule_name} is already running, skipping...`);
    return;
  }

  runningJobs.add(ruleId);

  try {
    console.log(`\n[Archive Scheduler] Executing rule: ${rule.rule_name}`);

    // Update status to running
    await pool.query(
      'UPDATE archive_rules SET last_run_status = $1, last_run_at = $2 WHERE id = $3',
      ['running', new Date(), ruleId]
    );

    // Create archive name with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T');
    const archiveName = `${rule.rule_name}_${timestamp[0]}_${timestamp[1].substring(0, 8)}`;

    console.log(`[Archive Scheduler] Creating archive: ${archiveName}`);

    const recordCounts = {};
    const archivedTables = [];
    let totalRecords = 0;
    let totalSizeBytes = 0;

    // Get module definitions (simplified - in production, import from archive.js)
    const ARCHIVE_MODULES = {
      'patient_management': {
        tables: ['patients', 'patient_allergies', 'patient_portal_sessions', 'patient_pharmacies', 'patient_preferred_pharmacies']
      },
      'appointments': {
        tables: ['appointments', 'appointment_reminders', 'appointment_waitlist']
      },
      'medical_records': {
        tables: ['medical_records', 'diagnosis', 'prescriptions', 'prescription_history']
      },
      'claims_billing': {
        tables: ['claims', 'payments', 'payment_postings', 'denials', 'preapprovals']
      },
      'healthcare_offerings': {
        tables: ['healthcare_offerings', 'offering_packages', 'offering_pricing', 'offering_promotions', 'offering_reviews', 'package_offerings']
      },
      'lab_pharmacy': {
        tables: ['pharmacies', 'laboratories', 'medications', 'drug_interactions', 'medication_alternatives']
      },
      'fhir_resources': {
        tables: ['fhir_resources']
      },
      'notifications': {
        tables: ['notifications']
      },
      'tasks': {
        tables: ['tasks']
      },
      'telehealth': {
        tables: ['telehealth_sessions']
      },
      'audit_logs': {
        tables: ['audit_logs']
      },
      'lab_orders': {
        tables: ['lab_orders']
      },
      'intake_forms': {
        tables: ['patient_intake_forms']
      }
    };

    // Archive data from selected modules
    for (const moduleKey of rule.selected_modules) {
      const moduleConfig = ARCHIVE_MODULES[moduleKey];

      if (!moduleConfig) {
        console.warn(`[Archive Scheduler] Unknown module: ${moduleKey}`);
        continue;
      }

      for (const tableName of moduleConfig.tables) {
        try {
          // Build WHERE clause for retention rules
          let whereClause = '';
          let whereParams = [];

          if (rule.retention_days) {
            // Archive data older than retention_days
            whereClause = `WHERE created_at < NOW() - INTERVAL '${rule.retention_days} days'`;
          }

          // ALWAYS ensure table structure exists in archive database first
          const { ensureTableStructure } = require('../archiveDb');
          await ensureTableStructure(pool, tableName);

          // Get data from main database
          const selectQuery = `SELECT * FROM ${tableName} ${whereClause}`;
          const result = await pool.query(selectQuery, whereParams);
          const rows = result.rows;

          // Always add table to archived list, even if empty
          archivedTables.push(tableName);
          recordCounts[tableName] = rows.length;

          if (rows.length > 0) {
            // Calculate approximate size
            const rowSize = JSON.stringify(rows[0]).length;
            const tableSize = rowSize * rows.length;
            totalSizeBytes += tableSize;

            // Insert data into archive database
            const archiveClient = await archivePool.connect();
            try {
              for (const row of rows) {
                const columns = Object.keys(row);
                const values = Object.values(row);
                const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

                const insertQuery = `
                  INSERT INTO ${tableName} (${columns.join(', ')})
                  VALUES (${placeholders})
                  ON CONFLICT DO NOTHING
                `;

                await archiveClient.query(insertQuery, values);
              }
            } finally {
              archiveClient.release();
            }

            totalRecords += rows.length;
            console.log(`[Archive Scheduler] Archived ${tableName}: ${rows.length} rows (${tableSize} bytes)`);
          } else {
            console.log(`[Archive Scheduler] Table ${tableName} is empty (0 rows) - structure created`);
          }
        } catch (error) {
          console.error(`[Archive Scheduler] Error archiving ${tableName}:`, error.message);
          recordCounts[tableName] = 0;
        }
      }
    }

    // Store metadata in archive database
    console.log(`[Archive Scheduler] Storing metadata for ${archivedTables.length} tables...`);

    const metadataQuery = `
      INSERT INTO archive_metadata (
        archive_name, description, archived_tables, archived_modules,
        record_counts, archived_by, status, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, archive_name, archive_date
    `;

    const metadata = {
      timestamp: new Date().toISOString(),
      automated: true,
      rule_id: ruleId,
      rule_name: rule.rule_name,
      total_size_bytes: totalSizeBytes,
      total_records: totalRecords
    };

    const metadataResult = await archivePool.query(metadataQuery, [
      archiveName,
      `Automatic archive from rule: ${rule.rule_name}`,
      archivedTables,
      rule.selected_modules,
      recordCounts,
      null, // archived_by is null for automatic archives
      'active',
      metadata
    ]);

    console.log(`[Archive Scheduler] ✓ Metadata saved to archive database`);
    console.log(`[Archive Scheduler]   - Archive ID: ${metadataResult.rows[0].id}`);
    console.log(`[Archive Scheduler]   - Archive Name: ${metadataResult.rows[0].archive_name}`);
    console.log(`[Archive Scheduler]   - Archive Date: ${metadataResult.rows[0].archive_date}`);

    // Calculate next run time
    const nextRunAt = calculateNextRun(rule);

    // Update rule with success status
    const executionDetails = {
      archive_id: metadataResult.rows[0].id,
      archive_name: archiveName,
      total_records: totalRecords,
      tables_archived: archivedTables.length,
      tables_list: archivedTables,
      execution_time: new Date().toISOString(),
      status: 'success'
    };

    await pool.query(
      `UPDATE archive_rules
       SET last_run_status = $1,
           last_run_details = $2,
           next_run_at = $3
       WHERE id = $4`,
      ['success', executionDetails, nextRunAt, ruleId]
    );

    console.log(`[Archive Scheduler] ✓ Rule executed successfully: ${rule.rule_name}`);
    console.log(`[Archive Scheduler]   - Total records archived: ${totalRecords}`);
    console.log(`[Archive Scheduler]   - Total size: ${totalSizeBytes} bytes`);
    console.log(`[Archive Scheduler]   - Tables archived: ${archivedTables.join(', ')}`);
    console.log(`[Archive Scheduler]   - Next run scheduled: ${nextRunAt}`);

  } catch (error) {
    console.error(`[Archive Scheduler] ✗ Error executing rule ${rule.rule_name}:`, error);

    // Update rule with failed status
    const executionDetails = {
      error: error.message,
      stack: error.stack,
      execution_time: new Date().toISOString(),
      status: 'failed'
    };

    await pool.query(
      `UPDATE archive_rules
       SET last_run_status = $1,
           last_run_details = $2
       WHERE id = $3`,
      ['failed', executionDetails, ruleId]
    ).catch(err => console.error('[Archive Scheduler] Error updating failed status:', err));

  } finally {
    runningJobs.delete(ruleId);
  }
}

/**
 * Calculate next run time for a rule
 */
function calculateNextRun(rule) {
  const now = new Date();
  const nextRun = new Date();

  // Parse time (HH:MM:SS)
  if (rule.schedule_time) {
    const timeStr = typeof rule.schedule_time === 'string' ? rule.schedule_time : rule.schedule_time.toString();
    const [hours, minutes, seconds] = timeStr.split(':').map(Number);
    nextRun.setHours(hours, minutes, seconds || 0, 0);
  }

  switch (rule.schedule_type) {
    case 'daily':
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
      break;

    case 'weekly':
      const targetDay = rule.schedule_day_of_week || 0;
      let daysUntilTarget = targetDay - nextRun.getDay();
      if (daysUntilTarget < 0 || (daysUntilTarget === 0 && nextRun <= now)) {
        daysUntilTarget += 7;
      }
      nextRun.setDate(nextRun.getDate() + daysUntilTarget);
      break;

    case 'monthly':
      const targetDate = rule.schedule_day_of_month || 1;
      nextRun.setDate(targetDate);
      if (nextRun <= now) {
        nextRun.setMonth(nextRun.getMonth() + 1);
      }
      break;

    case 'custom':
      // For custom cron, set to next hour (simplified)
      nextRun.setHours(nextRun.getHours() + 1, 0, 0, 0);
      break;

    default:
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
  }

  return nextRun;
}

/**
 * Check and execute due archive rules
 */
async function checkAndExecuteRules() {
  try {
    const now = new Date();

    // Get all enabled rules that are due to run
    const query = `
      SELECT *
      FROM archive_rules
      WHERE enabled = true
        AND next_run_at IS NOT NULL
        AND next_run_at <= $1
        AND (last_run_status IS NULL OR last_run_status != 'running')
      ORDER BY next_run_at ASC
    `;

    const result = await pool.query(query, [now]);

    if (result.rows.length > 0) {
      console.log(`\n[Archive Scheduler] Found ${result.rows.length} rule(s) to execute`);

      for (const rule of result.rows) {
        await executeArchiveRule(rule);
      }
    }
  } catch (error) {
    console.error('[Archive Scheduler] Error checking rules:', error);
  }
}

/**
 * Start the archive scheduler
 */
function startScheduler() {
  console.log('\n[Archive Scheduler] Starting automatic archive scheduler...');
  console.log('[Archive Scheduler] Checking for due rules every minute\n');

  // Check immediately on startup
  checkAndExecuteRules();

  // Then check every minute
  const interval = setInterval(checkAndExecuteRules, 60000); // 60 seconds

  // Return function to stop scheduler (for graceful shutdown)
  return () => {
    console.log('\n[Archive Scheduler] Stopping scheduler...');
    clearInterval(interval);
  };
}

module.exports = {
  startScheduler,
  executeArchiveRule,
  checkAndExecuteRules
};
