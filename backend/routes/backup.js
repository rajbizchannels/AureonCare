const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
// Provider SDKs and token refresh now live in the shared service, so the
// Google Drive and OneDrive paths cannot drift apart.
const cloudStorage = require('../services/cloudBackupStorage');

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
async function generateBackup(generatedBy) {
  console.log('Generating complete system backup...');

  const backup = {
    timestamp: new Date().toISOString(),
    version: '1.0',
    data: {}
  };

  // Define all tables to backup
  const tables = [
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
      'waitlist'
    ];

  // Backup each table
  for (const table of tables) {
    try {
      const result = await pool.query(`SELECT * FROM ${table}`);
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
    const backup = await generateBackup(req.user?.id || req.headers['x-user-id']);
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

    const backupData = await generateBackup(req.user?.id || req.headers['x-user-id']);
    const fileName = `aureoncare-backup-${new Date().toISOString().split('T')[0]}.json`;
    const uploaded = await cloudStorage.uploadBackup(pool, provider, fileName, backupData);

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
    res.json({ providers: await cloudStorage.getConfiguredProviders(pool) });
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
    res.json({ provider, backups: await cloudStorage.listBackups(pool, provider) });
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

    const backup = await cloudStorage.downloadBackup(pool, provider, fileId);
    if (!backup || !backup.data) {
      return res.status(400).json({
        error: 'That file is not a full system backup. Accounts and inventory backups restore from their own screens.',
      });
    }

    const result = await restoreBackup(backup, req.user?.id || req.headers['x-user-id']);
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
async function restoreBackup(backup, restoredBy) {
  {
    console.log('Starting data restore...');

    const restoredTables = [];
    const errors = [];

    // Restore each table
    for (const [tableName, rows] of Object.entries(backup.data)) {
      if (!Array.isArray(rows) || rows.length === 0) {
        console.log(`Skipping empty table: ${tableName}`);
        continue;
      }

      try {
        // Clear existing data (optional - can be made configurable)
        await pool.query(`TRUNCATE TABLE ${tableName} CASCADE`);

        // Insert backup data
        for (const row of rows) {
          const columns = Object.keys(row);
          const values = Object.values(row);
          const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

          const query = `
            INSERT INTO ${tableName} (${columns.join(', ')})
            VALUES (${placeholders})
            ON CONFLICT DO NOTHING
          `;

          await pool.query(query, values);
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
    res.json(await restoreBackup(backup, req.user?.id || req.headers['x-user-id']));
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
  try {
    // Configured = has a valid OAuth access token saved after sign-in
    let googleConfigured = false;
    let oneDriveConfigured = false;

    try {
      const result = await pool.query(
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
 */
router.post('/config/onedrive', async (req, res) => {
  try {
    const { accessToken } = req.body;

    if (!accessToken) {
      return res.status(400).json({
        error: 'OneDrive access token is required'
      });
    }

    // Store in environment variable (runtime only)
    process.env.AC_OD_TK = accessToken;

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
