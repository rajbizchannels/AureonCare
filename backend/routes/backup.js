const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
// Provider SDKs and token refresh now live in the shared service, so the
// Google Drive and OneDrive paths cannot drift apart.
const cloudStorage = require('../services/cloudBackupStorage');

// The tables a full backup covers, and the ONLY tables a restore may touch.
//
// restoreBackup used to iterate whatever keys the uploaded file happened to contain and
// interpolate them straight into `TRUNCATE TABLE ${name} CASCADE`. A hand-edited backup
// file could therefore truncate any table the connection could reach — including global
// ones shared by every tenant — or inject SQL through the name itself. The upload is
// admin-only, but an admin restoring a corrupted or malicious file should not be able to
// destroy another practice's data.
const BACKUP_TABLES = [
  'users',
  'patients',
  'appointments',
  'appointment_types',
  'medical_records',
  'medications',
  'prescriptions',
  'lab_orders',
  'claims',
  'insurance_payers',
  'payments',
  'providers',
  'roles',
  'permissions',
  'user_roles',
  'role_permissions',
  'diagnosis_codes',
  'medical_codes',
  'notifications',
  'notification_preferences',
  'offerings',
  'offering_packages',
  'offering_categories',
  'offering_promotions',
  'campaigns',
  'pharmacies',
  'laboratories',
  'telehealth_sessions',
  'telehealth_settings',
  'vendor_integration_settings',
  'tasks',
  'waitlist',
];
const BACKUP_TABLE_SET = new Set(BACKUP_TABLES);

// Middleware to ensure only admins can access backup endpoints
router.use(authenticate, requireAdmin);

/**
 * Generate complete backup of all system data
 * GET /api/backup/generate
 */
/**
 * Build a full system backup.
 *
 * Called directly rather than over HTTP. This router is gated by
 * authenticate + requireAdmin, and a self-referential fetch cannot forward
 * the caller's Authorization header — so the cloud-upload routes used to get
 * a 401 back from /api/backup/generate and fail with the misleading
 * "Failed to generate backup data". Calling in-process also avoids a second
 * serverless invocation and does not depend on req.protocol, which is http
 * behind the Vercel proxy.
 */
async function generateBackup(db, generatedBy) {
  console.log('Generating complete system backup...');

  const backup = {
    timestamp: new Date().toISOString(),
    version: '1.0',
    data: {}
  };

  const tables = BACKUP_TABLES;

  // Backup each table
  for (const table of tables) {
    try {
      const result = await db.query(`SELECT * FROM ${table}`);
      backup.data[table] = result.rows;
      console.log(`Backed up ${table}: ${result.rows.length} rows`);
    } catch (error) {
      console.warn(`Warning: Could not backup table ${table}:`, error.message);
      // Continue with other tables even if one fails
      backup.data[table] = [];
    }
  }

  // Add metadata
  backup.metadata = {
    totalTables: tables.length,
    totalRecords: Object.values(backup.data).reduce((sum, table) => sum + table.length, 0),
    generatedBy,
    generatedAt: new Date().toISOString()
  };

  console.log('Backup generated successfully:', backup.metadata);
  return backup;
}

router.get('/generate', async (req, res) => {
  try {
    const backup = await generateBackup(req.db || pool, req.user?.id || req.headers['x-user-id']);
    res.json(backup);
  } catch (error) {
    console.error('Error generating backup:', error);
    res.status(500).json({ error: 'Failed to generate backup', details: error.message });
  }
});

/**
 * Upload a full system backup to a connected cloud provider.
 *
 * POST /api/backup/google-drive
 * POST /api/backup/onedrive
 * POST /api/backup/cloud   { provider }
 *
 * All three land here. The provider-specific routes are kept so existing
 * callers keep working; the generic one takes the provider in the body, which
 * is what the UI uses once the admin has picked from the two.
 */
async function handleCloudBackup(req, res, provider) {
  try {
    if (!cloudStorage.isSupported(provider)) {
      return res.status(400).json({ error: `Unknown backup provider: ${provider}` });
    }

    const backupData = await generateBackup(req.db || pool, req.user?.id || req.headers['x-user-id']);
    const fileName = `aureoncare-backup-${new Date().toISOString().split('T')[0]}.json`;
    const uploaded = await cloudStorage.uploadBackup(req.db || pool, provider, fileName, backupData);

    res.json({
      success: true,
      message: `Backup uploaded to ${uploaded.label} successfully`,
      provider,
      fileId: uploaded.fileId,
      fileName: uploaded.fileName,
      link: uploaded.link,
    });
  } catch (error) {
    console.error(`Error backing up to ${provider}:`, error);
    res.status(500).json({
      error: `Failed to backup to ${cloudStorage.providerLabel(provider)}`,
      details: error.message,
    });
  }
}

router.post('/google-drive', (req, res) => handleCloudBackup(req, res, 'google_drive'));
router.post('/onedrive',     (req, res) => handleCloudBackup(req, res, 'onedrive'));
router.post('/cloud',        (req, res) => handleCloudBackup(req, res, req.body?.provider));

/**
 * Which cloud providers are connected.
 * GET /api/backup/cloud/providers -> { providers: [{ provider, label }] }
 *
 * The UI uses this to decide between uploading straight away and asking which
 * destination to use.
 */
router.get('/cloud/providers', async (req, res) => {
  try {
    res.json({ providers: await cloudStorage.getConfiguredProviders(req.db || pool) });
  } catch (error) {
    console.error('Error listing cloud providers:', error);
    res.status(500).json({ error: 'Failed to list cloud providers', details: error.message });
  }
});

/**
 * List backups held on a provider.
 * GET /api/backup/cloud/list?provider=google_drive
 */
router.get('/cloud/list', async (req, res) => {
  const { provider } = req.query;
  try {
    if (!cloudStorage.isSupported(provider)) {
      return res.status(400).json({ error: `Unknown backup provider: ${provider}` });
    }
    res.json({ provider, backups: await cloudStorage.listBackups(req.db || pool, provider) });
  } catch (error) {
    console.error(`Error listing backups on ${provider}:`, error);
    res.status(500).json({
      error: `Failed to list backups on ${cloudStorage.providerLabel(provider)}`,
      details: error.message,
    });
  }
});

/**
 * Restore directly from a backup held on a provider, so an admin does not have
 * to download the file and upload it back.
 * POST /api/backup/cloud/restore  { provider, fileId }
 */
router.post('/cloud/restore', async (req, res) => {
  const { provider, fileId } = req.body || {};
  try {
    if (!cloudStorage.isSupported(provider)) {
      return res.status(400).json({ error: `Unknown backup provider: ${provider}` });
    }
    if (!fileId) {
      return res.status(400).json({ error: 'fileId is required' });
    }

    const backup = await cloudStorage.downloadBackup(req.db || pool, provider, fileId);
    if (!backup || !backup.data) {
      return res.status(400).json({
        error: 'That file is not a full system backup. Accounts and inventory backups restore from their own screens.',
      });
    }

    const result = await restoreBackup(req.db || pool, backup, req.user?.id || req.headers['x-user-id']);
    res.json({ ...result, provider, restoredFrom: cloudStorage.providerLabel(provider) });
  } catch (error) {
    console.error('Error restoring from cloud backup:', error);
    res.status(500).json({ error: 'Failed to restore backup', details: error.message });
  }
});

/**
 * Restore data from backup
 * POST /api/backup/restore
 */
async function restoreBackup(db, backup, restoredBy) {
  {
    console.log('Starting data restore...');

    const restoredTables = [];
    const errors = [];
    const skipped = [];

    // Which schema this request is pinned to. A table that resolves OUTSIDE it is shared
    // by every tenant, so restoring into it would overwrite other practices' data.
    const { rows: schemaRows } = await db.query('SELECT current_schema() AS schema');
    const tenantSchema = schemaRows[0].schema;

    // Restore each table
    for (const [tableName, rows] of Object.entries(backup.data)) {
      if (!Array.isArray(rows) || rows.length === 0) {
        console.log(`Skipping empty table: ${tableName}`);
        continue;
      }

      // The name is interpolated into DDL below, so it must come from our own list and
      // never from the uploaded file.
      if (!BACKUP_TABLE_SET.has(tableName)) {
        console.warn(`[backup] refusing to restore unknown table: ${tableName}`);
        skipped.push({ table: tableName, reason: 'not a known backup table' });
        continue;
      }

      try {
        const { rows: loc } = await db.query(
          `SELECT n.nspname AS schema
             FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE c.oid = to_regclass($1)`,
          [tableName]
        );
        const livesIn = loc[0] && loc[0].schema;
        if (!livesIn) {
          skipped.push({ table: tableName, reason: 'table not present in this workspace' });
          continue;
        }

        // TRUNCATE only within this tenant's own schema. `users` and the other identity
        // tables live in public and are shared across every practice — wiping them here
        // would delete every tenant's accounts. Those rows are still inserted, with
        // ON CONFLICT DO NOTHING, so a restore adds what is missing without destroying
        // anything that belongs to someone else.
        if (livesIn === tenantSchema) {
          await db.query(`TRUNCATE TABLE ${tableName} CASCADE`);
        } else {
          skipped.push({ table: tableName, reason: `shared table in "${livesIn}" — not cleared` });
        }

        // Insert backup data
        for (const row of rows) {
          const columns = Object.keys(row);
          const values = Object.values(row);
          const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

          const query = `
            INSERT INTO ${tableName} (${columns.map((c) => `"${c.replace(/"/g, '""')}"`).join(', ')})
            VALUES (${placeholders})
            ON CONFLICT DO NOTHING
          `;

          await db.query(query, values);
        }

        restoredTables.push(tableName);
        console.log(`Restored ${tableName}: ${rows.length} rows`);
      } catch (error) {
        console.error(`Error restoring table ${tableName}:`, error.message);
        errors.push({ table: tableName, error: error.message });
      }
    }

    const response = {
      success: true,
      message: 'Data restore completed',
      restoredTables,
      totalTables: restoredTables.length,
      skipped: skipped.length > 0 ? skipped : undefined,
      errors: errors.length > 0 ? errors : undefined,
      restoredAt: new Date().toISOString(),
      restoredBy
    };

    console.log('Restore completed:', response);
    return response;
  }
}

router.post('/restore', async (req, res) => {
  try {
    const { backup } = req.body;
    if (!backup || !backup.data) {
      return res.status(400).json({
        error: 'Invalid backup format. Backup data is required.'
      });
    }
    res.json(await restoreBackup(req.db || pool, backup, req.user?.id || req.headers['x-user-id']));
  } catch (error) {
    console.error('Error restoring backup:', error);
    res.status(500).json({
      error: 'Failed to restore backup',
      details: error.message
    });
  }
});

/**
 * Get backup configuration status
 * GET /api/backup/config
 */
router.get('/config', async (req, res) => {
  // Same handle the token is written with. backup_provider_settings is a per-tenant table
  // (migration 068), so reading it through the raw pool — whose search_path is the default
  // — would look at a different schema than the write did, and a freshly saved token would
  // read back as "not configured".
  const db = req.db || pool;
  try {
    // Configured = has a valid OAuth access token saved after sign-in
    let googleConfigured = false;
    let oneDriveConfigured = false;

    try {
      const result = await db.query(
        `SELECT provider_type,
                (settings->>'access_token' IS NOT NULL AND settings->>'access_token' != '') AS has_token
         FROM backup_provider_settings
         WHERE provider_type IN ('google_drive', 'onedrive')`
      );
      result.rows.forEach(row => {
        if (row.provider_type === 'google_drive') googleConfigured = row.has_token;
        if (row.provider_type === 'onedrive')     oneDriveConfigured = row.has_token;
      });
    } catch (_) {
      // Table may not exist yet — treat as not configured
    }

    const config = {
      googleDrive: { configured: googleConfigured },
      oneDrive:    { configured: oneDriveConfigured }
    };

    res.json(config);
  } catch (error) {
    console.error('Error getting backup config:', error);
    res.status(500).json({
      error: 'Failed to get backup configuration',
      details: error.message
    });
  }
});

/**
 * Update Google Drive credentials
 * POST /api/backup/config/google-drive
 */
router.post('/config/google-drive', async (req, res) => {
  try {
    const { credentials } = req.body;

    if (!credentials) {
      return res.status(400).json({
        error: 'Google Drive credentials are required'
      });
    }

    // Validate JSON format
    try {
      JSON.parse(credentials);
    } catch (e) {
      return res.status(400).json({
        error: 'Invalid JSON format for credentials'
      });
    }

    // Store in environment variable (runtime only)
    process.env.AC_GG_DRV = credentials;

    res.json({
      success: true,
      message: 'Google Drive credentials updated successfully'
    });
  } catch (error) {
    console.error('Error updating Google Drive config:', error);
    res.status(500).json({
      error: 'Failed to update Google Drive configuration',
      details: error.message
    });
  }
});

/**
 * Update OneDrive access token
 * POST /api/backup/config/onedrive
 *
 * This used to do `process.env.AC_OD_TK = accessToken`, which was wrong twice over.
 *
 * process.env is process-global, so in a multi-tenant system one practice's OneDrive
 * token was readable by every other tenant's request — a cross-tenant credential leak,
 * in a system holding PHI. It was also useless: nothing ever read AC_OD_TK, so a token
 * saved here never reached an upload. The value additionally vanished on the next cold
 * start and never existed on the other serverless instances.
 *
 * The token now goes where every other integration token goes — the per-tenant
 * backup_provider_settings row that cloudBackupStorage reads and refreshes — so it is
 * scoped to one practice, survives restarts, and actually gets used.
 */
router.post('/config/onedrive', async (req, res) => {
  const db = req.db || pool;
  try {
    const { accessToken, refreshToken } = req.body;

    if (!accessToken) {
      return res.status(400).json({
        error: 'OneDrive access token is required'
      });
    }

    // Merge rather than replace: the row may already hold a refresh token, and losing it
    // would mean the next expiry could not be recovered without re-authorising.
    const { rowCount } = await db.query(
      `UPDATE backup_provider_settings
          SET settings = COALESCE(settings, '{}'::jsonb)
                         || jsonb_strip_nulls(jsonb_build_object(
                              'access_token', $1::text,
                              'refresh_token', $2::text)),
              is_enabled = true,
              updated_at = CURRENT_TIMESTAMP
        WHERE provider_type = 'onedrive'`,
      [accessToken, refreshToken || null]
    );

    if (rowCount === 0) {
      await db.query(
        `INSERT INTO backup_provider_settings (provider_type, is_enabled, settings)
         VALUES ('onedrive', true,
                 jsonb_strip_nulls(jsonb_build_object(
                   'access_token', $1::text, 'refresh_token', $2::text)))`,
        [accessToken, refreshToken || null]
      );
    }

    res.json({
      success: true,
      message: 'OneDrive access token updated successfully'
    });
  } catch (error) {
    console.error('Error updating OneDrive config:', error);
    res.status(500).json({
      error: 'Failed to update OneDrive configuration',
      details: error.message
    });
  }
});

module.exports = router;
