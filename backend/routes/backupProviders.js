const express = require('express');
const router = express.Router();

/**
 * Backup Provider Settings API
 * Manages configuration for Google Drive, OneDrive backup integrations
 */

// Get all backup provider settings
router.get('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;

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
        await pool.query(`
          CREATE TABLE IF NOT EXISTS backup_provider_settings (
            id SERIAL PRIMARY KEY,
            provider_type VARCHAR(50) UNIQUE NOT NULL,
            is_enabled BOOLEAN DEFAULT false,
            client_id VARCHAR(255),
            client_secret VARCHAR(255),
            settings JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);

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
    const pool = req.app.locals.pool;
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
    const pool = req.app.locals.pool;
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
    const pool = req.app.locals.pool;
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
    const pool = req.app.locals.pool;
    const result = await pool.query(`
      SELECT provider_type, is_enabled,
             (client_id IS NOT NULL AND client_id != '') as has_credentials,
             (settings->>'access_token' IS NOT NULL) as has_token
      FROM backup_provider_settings
      WHERE provider_type IN ('google_drive', 'onedrive')
    `);

    const config = {
      googleDrive: {
        configured: false,
        enabled: false
      },
      oneDrive: {
        configured: false,
        enabled: false
      }
    };

    result.rows.forEach(row => {
      if (row.provider_type === 'google_drive') {
        config.googleDrive = {
          configured: row.has_credentials && row.has_token,
          enabled: row.is_enabled
        };
      } else if (row.provider_type === 'onedrive') {
        config.oneDrive = {
          configured: row.has_credentials && row.has_token,
          enabled: row.is_enabled
        };
      }
    });

    res.json(config);
  } catch (error) {
    console.error('Error getting backup config:', error);
    res.status(500).json({ error: 'Failed to get backup configuration' });
  }
});

module.exports = router;
