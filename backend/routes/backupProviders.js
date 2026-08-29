const express = require('express');
const { authenticate } = require('../middleware/auth');
const router = express.Router();
router.use(authenticate);
router.use(require('../middleware/planEnforcement').enforceActiveBilling); // SEC-05 S11: read-only when subscription past_due/canceled

/**
 * Backup Provider Settings API
 * Manages configuration for Google Drive, OneDrive backup integrations
 */

// Get all backup provider settings
router.get('/', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request

    // Check if table exists, if not create it
    try {
      const result = await pool.query(`
        SELECT * FROM backup_provider_settings
        ORDER BY provider_type
      `);
      res.json(result.rows);
    } catch (tableError) {
      if (tableError.code === '42P01') {
        // Table doesn't exist, create it
        // SEC-05: table/column creation moved to migrations (see migrations/tenant/001 and 072).

        // Return empty array for now
        res.json([]);
      } else {
        throw tableError;
      }
    }
  } catch (error) {
    console.error('Error fetching backup provider settings:', error);
    res.status(500).json({ error: 'Failed to fetch backup provider settings' });
  }
});

// Get single provider settings
router.get('/:providerType', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { providerType } = req.params;

    const result = await pool.query(
      'SELECT * FROM backup_provider_settings WHERE provider_type = $1',
      [providerType]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Provider settings not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching provider settings:', error);
    res.status(500).json({ error: 'Failed to fetch provider settings' });
  }
});

// Create or update provider settings
router.post('/:providerType', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { providerType } = req.params;
    const {
      is_enabled,
      client_id,
      client_secret,
      settings
    } = req.body;

    // Check if provider settings already exist
    const existing = await pool.query(
      'SELECT id FROM backup_provider_settings WHERE provider_type = $1',
      [providerType]
    );

    let result;
    if (existing.rows.length > 0) {
      // Update existing
      result = await pool.query(`
        UPDATE backup_provider_settings
        SET
          is_enabled = COALESCE($1, is_enabled),
          client_id = COALESCE($2, client_id),
          client_secret = COALESCE($3, client_secret),
          settings = COALESCE($4, settings),
          updated_at = CURRENT_TIMESTAMP
        WHERE provider_type = $5
        RETURNING *
      `, [is_enabled, client_id, client_secret,
          JSON.stringify(settings), providerType]);
    } else {
      // Insert new
      result = await pool.query(`
        INSERT INTO backup_provider_settings (
          provider_type,
          is_enabled,
          client_id,
          client_secret,
          settings
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [providerType, is_enabled || false, client_id, client_secret,
          JSON.stringify(settings || {})]);
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error saving provider settings:', error);
    res.status(500).json({ error: 'Failed to save provider settings' });
  }
});

// Delete provider settings
router.delete('/:providerType', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { providerType } = req.params;

    const result = await pool.query(
      'DELETE FROM backup_provider_settings WHERE provider_type = $1 RETURNING id',
      [providerType]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Provider settings not found' });
    }

    res.json({ message: 'Provider settings deleted successfully' });
  } catch (error) {
    console.error('Error deleting provider settings:', error);
    res.status(500).json({ error: 'Failed to delete provider settings' });
  }
});

// Get backup configuration status
router.get('/config/status', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request

    // Ensure table exists
    // SEC-05: table/column creation moved to migrations (see migrations/tenant/001 and 072).

    const result = await pool.query(`
      SELECT provider_type, is_enabled,
             (settings->>'access_token' IS NOT NULL AND settings->>'access_token' != '') AS has_token
      FROM backup_provider_settings
      WHERE provider_type IN ('google_drive', 'onedrive')
    `);

    const config = {
      googleDrive: { configured: false, enabled: false },
      oneDrive:    { configured: false, enabled: false }
    };

    result.rows.forEach(row => {
      if (row.provider_type === 'google_drive') {
        config.googleDrive = { configured: row.has_token, enabled: row.is_enabled };
      } else if (row.provider_type === 'onedrive') {
        config.oneDrive = { configured: row.has_token, enabled: row.is_enabled };
      }
    });

    res.json(config);
  } catch (error) {
    console.error('Error getting backup config:', error);
    res.status(500).json({ error: 'Failed to get backup configuration' });
  }
});

module.exports = router;
