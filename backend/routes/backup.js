const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAdmin } = require('../middleware/auth');
const { google } = require('googleapis');
const { Client } = require('@microsoft/microsoft-graph-client');

// Middleware to ensure only admins can access backup endpoints
router.use(requireAdmin);

/**
 * Generate complete backup of all system data
 * GET /api/backup/generate
 */
router.get('/generate', async (req, res) => {
  try {
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
      generatedBy: req.user?.id || req.headers['x-user-id'],
      generatedAt: new Date().toISOString()
    };

    console.log('Backup generated successfully:', backup.metadata);
    res.json(backup);
  } catch (error) {
    console.error('Error generating backup:', error);
    res.status(500).json({ error: 'Failed to generate backup', details: error.message });
  }
});

/**
 * Backup to Google Drive
 * POST /api/backup/google-drive
 */
router.post('/google-drive', async (req, res) => {
  try {
    console.log('Starting Google Drive backup...');

    // Load OAuth access token saved by the Google Drive OAuth flow
    const settingsResult = await pool.query(
      `SELECT settings FROM backup_provider_settings WHERE provider_type = 'google_drive'`
    );
    const settings = settingsResult.rows[0]?.settings || {};
    const accessToken = typeof settings === 'string' ? JSON.parse(settings).access_token : settings.access_token;

    if (!accessToken) {
      return res.status(400).json({
        error: 'Google Drive not connected. Please sign in with your Google account first.'
      });
    }

    // Generate backup data
    const backupResponse = await fetch(`${req.protocol}://${req.get('host')}/api/backup/generate`, {
      headers: {
        'x-user-id': req.headers['x-user-id'],
        'x-user-role': req.headers['x-user-role']
      }
    });

    if (!backupResponse.ok) {
      throw new Error('Failed to generate backup data');
    }

    const backupData = await backupResponse.json();

    // Use the stored OAuth access token
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // Create file metadata
    const fileMetadata = {
      name: `aureoncare-backup-${new Date().toISOString().split('T')[0]}.json`,
      mimeType: 'application/json'
    };

    // Upload to Google Drive
    const media = {
      mimeType: 'application/json',
      body: JSON.stringify(backupData, null, 2)
    };

    const file = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, name, webViewLink'
    });

    console.log('Backup uploaded to Google Drive:', file.data);
    res.json({
      success: true,
      message: 'Backup uploaded to Google Drive successfully',
      fileId: file.data.id,
      fileName: file.data.name,
      link: file.data.webViewLink
    });
  } catch (error) {
    console.error('Error backing up to Google Drive:', error);
    res.status(500).json({
      error: 'Failed to backup to Google Drive',
      details: error.message
    });
  }
});

/**
 * Backup to OneDrive
 * POST /api/backup/onedrive
 */
router.post('/onedrive', async (req, res) => {
  try {
    console.log('Starting OneDrive backup...');

    // Load OAuth access token saved by the OneDrive OAuth flow
    const settingsResult = await pool.query(
      `SELECT settings FROM backup_provider_settings WHERE provider_type = 'onedrive'`
    );
    const settings = settingsResult.rows[0]?.settings || {};
    const oneDriveToken = typeof settings === 'string' ? JSON.parse(settings).access_token : settings.access_token;

    if (!oneDriveToken) {
      return res.status(400).json({
        error: 'OneDrive not connected. Please sign in with your Microsoft account first.'
      });
    }

    // Generate backup data
    const backupResponse = await fetch(`${req.protocol}://${req.get('host')}/api/backup/generate`, {
      headers: {
        'x-user-id': req.headers['x-user-id'],
        'x-user-role': req.headers['x-user-role']
      }
    });

    if (!backupResponse.ok) {
      throw new Error('Failed to generate backup data');
    }

    const backupData = await backupResponse.json();

    // Initialize Microsoft Graph client using the stored OAuth token
    const client = Client.init({
      authProvider: (done) => {
        done(null, oneDriveToken);
      }
    });

    // Upload to OneDrive
    const fileName = `aureoncare-backup-${new Date().toISOString().split('T')[0]}.json`;
    const uploadedFile = await client
      .api('/me/drive/root/children')
      .post({
        name: fileName,
        file: {},
        '@microsoft.graph.conflictBehavior': 'replace'
      });

    // Upload content
    await client
      .api(`/me/drive/items/${uploadedFile.id}/content`)
      .put(JSON.stringify(backupData, null, 2));

    console.log('Backup uploaded to OneDrive:', uploadedFile);
    res.json({
      success: true,
      message: 'Backup uploaded to OneDrive successfully',
      fileId: uploadedFile.id,
      fileName: uploadedFile.name,
      link: uploadedFile.webUrl
    });
  } catch (error) {
    console.error('Error backing up to OneDrive:', error);
    res.status(500).json({
      error: 'Failed to backup to OneDrive',
      details: error.message
    });
  }
});

/**
 * Restore data from backup
 * POST /api/backup/restore
 */
router.post('/restore', async (req, res) => {
  try {
    console.log('Starting data restore...');
    const { backup } = req.body;

    if (!backup || !backup.data) {
      return res.status(400).json({
        error: 'Invalid backup format. Backup data is required.'
      });
    }

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
      restoredBy: req.headers['x-user-id']
    };

    console.log('Restore completed:', response);
    res.json(response);
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
