const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');

/**
 * Telehealth Provider Settings API
 * Manages configuration for Zoom, Google Meet, Webex integrations
 */

// Get all telehealth provider settings
// Returns status + connection info (never raw tokens)
router.get('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(`
      SELECT id, provider_type, is_enabled, client_id, api_key,
             zoom_user_email, zoom_user_id, account_id,
             token_expires_at, token_scope,
             CASE WHEN access_token IS NOT NULL THEN true ELSE false END AS has_tokens,
             CASE WHEN token_expires_at IS NOT NULL AND token_expires_at < $1 THEN true ELSE false END AS is_expired,
             created_at, updated_at
      FROM telehealth_provider_settings
      ORDER BY provider_type
    `, [Date.now()]);

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

// Get all enabled providers (used by frontend for patient preference dropdown)
router.get('/enabled/providers', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(`
      SELECT provider_type, zoom_user_email
      FROM telehealth_provider_settings
      WHERE is_enabled = true
      ORDER BY provider_type
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching enabled providers:', error);
    res.status(500).json({ error: 'Failed to fetch enabled providers' });
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
      return res.json({ provider_type: 'aureoncare', is_enabled: false });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching active provider:', error);
    res.status(500).json({ error: 'Failed to fetch active provider' });
  }
});

// Test provider connection (validates credentials against provider API)
router.post('/:providerType/test', async (req, res) => {
  try {
    const { providerType } = req.params;
    const TelehealthProviderManager = require('../services/telehealthProviders');
    const pool = req.app.locals.pool;

    const manager = new TelehealthProviderManager(pool);
    const provider = await manager.getProvider(providerType);

    // Use provider-specific test if available (e.g., ZoomService.testConnection)
    if (typeof provider.testConnection === 'function') {
      const result = await provider.testConnection();
      return res.json({
        success: true,
        message: result.message || `${providerType} connection test successful`,
        provider: providerType,
        details: result.user || null
      });
    }

    // Fallback: just confirm the provider can be initialized
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

// Create an instant Zoom meeting (one-click launch)
router.post('/:providerType/instant-meeting', async (req, res) => {
  try {
    const { providerType } = req.params;
    const { topic, duration, patientName, recordingEnabled } = req.body;
    const TelehealthProviderManager = require('../services/telehealthProviders');
    const pool = req.app.locals.pool;

    const manager = new TelehealthProviderManager(pool);
    const provider = await manager.getProvider(providerType);

    if (typeof provider.createInstantMeeting !== 'function') {
      return res.status(400).json({
        error: `${providerType} does not support instant meetings`
      });
    }

    const result = await provider.createInstantMeeting({
      topic: topic || 'AureonCare Telehealth Session',
      duration: duration || 30,
      patientName: patientName || 'Patient',
      recordingEnabled: recordingEnabled || false
    });

    res.json(result);
  } catch (error) {
    console.error('Error creating instant meeting:', error);
    const isConfigError = error.message?.includes('not configured') || error.message?.includes('credentials');
    res.status(isConfigError ? 422 : 500).json({ error: error.message });
  }
});

/**
 * GET /zoom/host-token?meetingId=<id>
 *
 * Returns data needed for the embedded Zoom Meeting SDK (Client View, CDN):
 *   - zakToken   : ZAK token — grants host privileges in the SDK
 *   - signature  : HMAC-JWT signed with SDK Key + SDK Secret
 *   - sdkKey     : SDK Key (= ZOOM_SDK_KEY, or falls back to ZOOM_CLIENT_ID)
 *   - password   : meeting password (fetched from Zoom API)
 *
 * For Zoom General Apps the OAuth Client ID/Secret ARE the SDK Key/Secret —
 * no separate app or extra env vars are required.
 */
router.get('/zoom/host-token', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { meetingId } = req.query;

    // Get stored admin OAuth access token + app credentials (client_id / client_secret)
    const result = await pool.query(
      `SELECT access_token, zoom_user_id, client_id, client_secret
       FROM telehealth_provider_settings
       WHERE provider_type = 'zoom' AND is_enabled = true LIMIT 1`
    );

    const row = result.rows[0];
    if (!row || !row.access_token) {
      return res.status(422).json({
        error: 'Zoom is not connected. Please connect Zoom in Admin Settings.'
      });
    }

    const { access_token } = row;
    const authHeader = { Authorization: `Bearer ${access_token}` };

    // Fetch ZAK token — required for the host role in the Meeting SDK.
    // Try the v2 /users/me/zak endpoint first (works with user:read:zak scope),
    // fall back to the legacy /users/me/token?type=zak path (admin scope).
    let zakToken = null;
    try {
      const zakResponse = await axios.get(
        'https://api.zoom.us/v2/users/me/zak',
        { headers: authHeader }
      );
      zakToken = zakResponse.data.token;
    } catch (_zakErr) {
      // Fallback for older apps that have user:read:token:admin
      const zakFallback = await axios.get(
        'https://api.zoom.us/v2/users/me/token?type=zak',
        { headers: authHeader }
      );
      zakToken = zakFallback.data.token;
    }

    // Resolve SDK Key / Secret.
    // For Zoom General Apps the Client ID == SDK Key and Client Secret == SDK Secret.
    // Priority: env override → database credentials (from Admin Panel).
    const sdkKey    = process.env.ZOOM_SDK_KEY    || process.env.ZOOM_CLIENT_ID  || row.client_id;
    const sdkSecret = process.env.ZOOM_SDK_SECRET || process.env.ZOOM_CLIENT_SECRET || row.client_secret;

    if (!sdkKey || !sdkSecret) {
      return res.status(422).json({
        error: 'ZOOM_CLIENT_ID / ZOOM_CLIENT_SECRET are not configured on the server.'
      });
    }

    // Generate the Meeting SDK JWT signature (role 1 = host)
    let signature = null;
    if (meetingId) {
      const b64url = (s) =>
        Buffer.from(s).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      const iat = Math.round(Date.now() / 1000) - 30;
      const exp = iat + 7200; // valid for 2 hours
      const header  = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
      const payload = b64url(
        JSON.stringify({ appKey: sdkKey, mn: String(meetingId), role: 1, iat, exp, tokenExp: exp })
      );
      const sigPart = crypto
        .createHmac('sha256', sdkSecret)
        .update(`${header}.${payload}`)
        .digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
      signature = `${header}.${payload}.${sigPart}`;
    }

    // Fetch meeting password from Zoom API
    let password = '';
    if (meetingId) {
      try {
        const mtgResponse = await axios.get(
          `https://api.zoom.us/v2/meetings/${meetingId}`,
          { headers: authHeader }
        );
        password = mtgResponse.data.password || '';
      } catch (mtgErr) {
        console.warn('Could not fetch meeting password:', mtgErr.response?.data?.message || mtgErr.message);
      }
    }

    res.json({ zakToken, signature, sdkKey, password });
  } catch (error) {
    console.error('Error fetching Zoom host token:', error.response?.data || error.message);
    if (error.response?.status === 401) {
      return res.status(401).json({
        error: 'Zoom access token expired. Please reconnect Zoom in Admin Settings.'
      });
    }
    res.status(500).json({
      error: 'Failed to fetch Zoom host token: ' + (error.response?.data?.message || error.message)
    });
  }
});

module.exports = router;
