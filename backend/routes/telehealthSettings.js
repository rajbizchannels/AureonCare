const express = require('express');
const router = express.Router();

/**
 * Telehealth Provider Settings API
 * Manages configuration for Zoom, Google Meet, Webex integrations
 */

// Get all telehealth provider settings
router.get('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(`
      SELECT * FROM telehealth_provider_settings
      ORDER BY provider_type
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching telehealth settings:', error);
    // Check if the error is due to missing table
    if (error.code === '42P01') {
      return res.status(503).json({
        error: 'Telehealth provider settings table does not exist. Please run database migration.',
        hint: 'Run: node backend/scripts/migrate-telehealth.js'
      });
    }
    res.status(500).json({ error: 'Failed to fetch telehealth settings' });
  }
});

// Get single provider settings
router.get('/:providerType', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { providerType } = req.params;

    const result = await pool.query(
      'SELECT * FROM telehealth_provider_settings WHERE provider_type = $1',
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
      api_key,
      api_secret,
      client_id,
      client_secret,
      webhook_secret,
      settings
    } = req.body;

    // Check if provider settings already exist
    const existing = await pool.query(
      'SELECT id FROM telehealth_provider_settings WHERE provider_type = $1',
      [providerType]
    );

    let result;
    if (existing.rows.length > 0) {
      // Update existing
      result = await pool.query(`
        UPDATE telehealth_provider_settings
        SET
          is_enabled = COALESCE($1, is_enabled),
          api_key = COALESCE($2, api_key),
          api_secret = COALESCE($3, api_secret),
          client_id = COALESCE($4, client_id),
          client_secret = COALESCE($5, client_secret),
          webhook_secret = COALESCE($6, webhook_secret),
          settings = COALESCE($7, settings),
          updated_at = CURRENT_TIMESTAMP
        WHERE provider_type = $8
        RETURNING *
      `, [is_enabled, api_key, api_secret, client_id, client_secret, webhook_secret,
          JSON.stringify(settings), providerType]);
    } else {
      // Insert new
      result = await pool.query(`
        INSERT INTO telehealth_provider_settings (
          provider_type,
          is_enabled,
          api_key,
          api_secret,
          client_id,
          client_secret,
          webhook_secret,
          settings
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [providerType, is_enabled || false, api_key, api_secret,
          client_id, client_secret, webhook_secret, JSON.stringify(settings || {})]);
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
      'DELETE FROM telehealth_provider_settings WHERE provider_type = $1 RETURNING id',
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

// Toggle provider enabled status
router.patch('/:providerType/toggle', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { providerType } = req.params;
    const { is_enabled } = req.body;

    // Check if provider settings exist
    const existing = await pool.query(
      'SELECT id FROM telehealth_provider_settings WHERE provider_type = $1',
      [providerType]
    );

    let result;
    if (existing.rows.length > 0) {
      // Update existing record
      result = await pool.query(`
        UPDATE telehealth_provider_settings
        SET is_enabled = $1, updated_at = CURRENT_TIMESTAMP
        WHERE provider_type = $2
        RETURNING *
      `, [is_enabled, providerType]);
    } else {
      // Create new record with just is_enabled set
      result = await pool.query(`
        INSERT INTO telehealth_provider_settings (provider_type, is_enabled)
        VALUES ($1, $2)
        RETURNING *
      `, [providerType, is_enabled]);
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error toggling provider status:', error);
    res.status(500).json({ error: 'Failed to toggle provider status' });
  }
});

// Get active/default provider
router.get('/active/provider', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(`
      SELECT * FROM telehealth_provider_settings
      WHERE is_enabled = true
      ORDER BY id
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      return res.json({ provider_type: 'medflow', is_enabled: false });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching active provider:', error);
    res.status(500).json({ error: 'Failed to fetch active provider' });
  }
});

// Test provider connection
router.post('/:providerType/test', async (req, res) => {
  try {
    const { providerType } = req.params;
    const TelehealthProviderManager = require('../services/telehealthProviders');
    const pool = req.app.locals.pool;

    const manager = new TelehealthProviderManager(pool);

    // Try to initialize the provider
    const provider = await manager.getProvider(providerType);

    res.json({
      success: true,
      message: `${providerType} connection test successful`,
      provider: providerType
    });
  } catch (error) {
    console.error('Error testing provider connection:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
