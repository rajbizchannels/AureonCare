const express = require('express');
const router = express.Router();
const crypto = require('crypto');

/**
 * Integration OAuth Flow Management
 * Handles OAuth flows for Zoom, Google Meet, Webex, and cloud storage providers
 */

// Store OAuth states temporarily (in production, use Redis or database)
const oauthStates = new Map();

/**
 * OAuth Configuration for each provider
 */
const OAUTH_CONFIGS = {
  zoom: {
    authUrl: 'https://zoom.us/oauth/authorize',
    tokenUrl: 'https://zoom.us/oauth/token',
    scope: 'meeting:write meeting:read user:read',
  },
  google_meet: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/meetings.space.created',
  },
  webex: {
    authUrl: 'https://webexapis.com/v1/authorize',
    tokenUrl: 'https://webexapis.com/v1/access_token',
    scope: 'meeting:schedules_write meeting:schedules_read',
  },
  google_drive: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'https://www.googleapis.com/auth/drive.file',
  },
  onedrive: {
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scope: 'Files.ReadWrite offline_access',
  },
  surescripts: {
    // Surescripts uses API key authentication, not OAuth
    authType: 'api_key',
  },
  labcorp: {
    // Labcorp uses API key authentication
    authType: 'api_key',
  },
  optum: {
    // Optum uses API key authentication
    authType: 'api_key',
  },
};

/**
 * Initiate OAuth flow for a provider
 * GET /api/integrations/oauth/:providerType/initiate
 */
router.get('/:providerType/initiate', async (req, res) => {
  try {
    const { providerType } = req.params;
    const config = OAUTH_CONFIGS[providerType];

    if (!config) {
      return res.status(400).json({ error: 'Unknown provider type' });
    }

    if (config.authType === 'api_key') {
      return res.status(400).json({
        error: 'This provider uses API key authentication, not OAuth',
        hint: 'Please configure using the API key configuration modal'
      });
    }

    // Get provider settings from database to get client_id
    const pool = req.app.locals.pool;
    let settingsTable, providerField;

    if (['zoom', 'google_meet', 'webex'].includes(providerType)) {
      settingsTable = 'telehealth_provider_settings';
      providerField = 'provider_type';
    } else if (['google_drive', 'onedrive'].includes(providerType)) {
      settingsTable = 'backup_provider_settings';
      providerField = 'provider_type';
    } else {
      return res.status(400).json({ error: 'Invalid provider type' });
    }

    const result = await pool.query(
      `SELECT client_id, client_secret FROM ${settingsTable} WHERE ${providerField} = $1`,
      [providerType]
    );

    if (result.rows.length === 0 || !result.rows[0].client_id) {
      return res.status(400).json({
        error: 'Provider not configured',
        hint: 'Please configure the provider with client ID and secret first'
      });
    }

    const { client_id } = result.rows[0];

    // Generate state for CSRF protection
    const state = crypto.randomBytes(32).toString('hex');
    const redirectUri = `${req.protocol}://${req.get('host')}/api/integrations/oauth/${providerType}/callback`;

    // Store state temporarily (expires in 10 minutes)
    oauthStates.set(state, {
      providerType,
      timestamp: Date.now(),
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    // Clean up expired states
    for (const [key, value] of oauthStates.entries()) {
      if (value.expiresAt < Date.now()) {
        oauthStates.delete(key);
      }
    }

    // Build authorization URL
    const authUrl = new URL(config.authUrl);
    authUrl.searchParams.append('client_id', client_id);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('scope', config.scope);
    authUrl.searchParams.append('state', state);

    if (providerType === 'google_meet' || providerType === 'google_drive') {
      authUrl.searchParams.append('access_type', 'offline');
      authUrl.searchParams.append('prompt', 'consent');
    }

    res.json({
      authUrl: authUrl.toString(),
      state,
    });
  } catch (error) {
    console.error('Error initiating OAuth flow:', error);
    res.status(500).json({ error: 'Failed to initiate OAuth flow' });
  }
});

/**
 * OAuth callback handler
 * GET /api/integrations/oauth/:providerType/callback
 */
router.get('/:providerType/callback', async (req, res) => {
  try {
    const { providerType } = req.params;
    const { code, state, error: oauthError } = req.query;

    if (oauthError) {
      return res.redirect(`/admin?error=${encodeURIComponent(oauthError)}&provider=${providerType}`);
    }

    if (!code || !state) {
      return res.redirect(`/admin?error=invalid_callback&provider=${providerType}`);
    }

    // Verify state
    const storedState = oauthStates.get(state);
    if (!storedState || storedState.providerType !== providerType) {
      return res.redirect(`/admin?error=invalid_state&provider=${providerType}`);
    }

    // Delete used state
    oauthStates.delete(state);

    const config = OAUTH_CONFIGS[providerType];
    const pool = req.app.locals.pool;

    // Get provider settings
    let settingsTable, providerField;
    if (['zoom', 'google_meet', 'webex'].includes(providerType)) {
      settingsTable = 'telehealth_provider_settings';
      providerField = 'provider_type';
    } else if (['google_drive', 'onedrive'].includes(providerType)) {
      settingsTable = 'backup_provider_settings';
      providerField = 'provider_type';
    }

    const result = await pool.query(
      `SELECT client_id, client_secret FROM ${settingsTable} WHERE ${providerField} = $1`,
      [providerType]
    );

    if (result.rows.length === 0) {
      return res.redirect(`/admin?error=provider_not_configured&provider=${providerType}`);
    }

    const { client_id, client_secret } = result.rows[0];
    const redirectUri = `${req.protocol}://${req.get('host')}/api/integrations/oauth/${providerType}/callback`;

    // Exchange code for tokens
    const tokenResponse = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id,
        client_secret,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Token exchange error:', errorData);
      return res.redirect(`/admin?error=token_exchange_failed&provider=${providerType}`);
    }

    const tokens = await tokenResponse.json();

    // Store tokens in database
    const settingsData = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : null,
      scope: tokens.scope || config.scope,
    };

    await pool.query(
      `UPDATE ${settingsTable}
       SET settings = $1, updated_at = CURRENT_TIMESTAMP
       WHERE ${providerField} = $2`,
      [JSON.stringify(settingsData), providerType]
    );

    // Redirect to success page
    res.redirect(`/admin?success=oauth_configured&provider=${providerType}`);
  } catch (error) {
    console.error('Error handling OAuth callback:', error);
    res.redirect(`/admin?error=callback_failed&provider=${req.params.providerType}`);
  }
});

/**
 * Get OAuth configuration status
 * GET /api/integrations/oauth/:providerType/status
 */
router.get('/:providerType/status', async (req, res) => {
  try {
    const { providerType } = req.params;
    const pool = req.app.locals.pool;

    let settingsTable, providerField;
    if (['zoom', 'google_meet', 'webex'].includes(providerType)) {
      settingsTable = 'telehealth_provider_settings';
      providerField = 'provider_type';
    } else if (['google_drive', 'onedrive'].includes(providerType)) {
      settingsTable = 'backup_provider_settings';
      providerField = 'provider_type';
    } else if (['surescripts', 'labcorp', 'optum'].includes(providerType)) {
      return res.json({
        configured: false,
        authType: 'api_key',
        message: 'This provider uses API key authentication'
      });
    } else {
      return res.status(400).json({ error: 'Unknown provider type' });
    }

    const result = await pool.query(
      `SELECT client_id, settings FROM ${settingsTable} WHERE ${providerField} = $1`,
      [providerType]
    );

    if (result.rows.length === 0) {
      return res.json({
        configured: false,
        hasClientId: false,
        hasTokens: false,
      });
    }

    const { client_id, settings } = result.rows[0];
    const parsedSettings = settings ? (typeof settings === 'string' ? JSON.parse(settings) : settings) : {};

    res.json({
      configured: Boolean(client_id && parsedSettings.access_token),
      hasClientId: Boolean(client_id),
      hasTokens: Boolean(parsedSettings.access_token),
      expiresAt: parsedSettings.expires_at || null,
    });
  } catch (error) {
    console.error('Error getting OAuth status:', error);
    res.status(500).json({ error: 'Failed to get OAuth status' });
  }
});

/**
 * Save provider client credentials (client_id, client_secret)
 * POST /api/integrations/oauth/:providerType/credentials
 */
router.post('/:providerType/credentials', async (req, res) => {
  try {
    const { providerType } = req.params;
    const { client_id, client_secret } = req.body;

    if (!client_id || !client_secret) {
      return res.status(400).json({ error: 'client_id and client_secret are required' });
    }

    const pool = req.app.locals.pool;
    let settingsTable, providerField;

    if (['zoom', 'google_meet', 'webex'].includes(providerType)) {
      settingsTable = 'telehealth_provider_settings';
      providerField = 'provider_type';
    } else if (['google_drive', 'onedrive'].includes(providerType)) {
      settingsTable = 'backup_provider_settings';
      providerField = 'provider_type';
    } else if (['surescripts', 'labcorp', 'optum'].includes(providerType)) {
      settingsTable = 'vendor_integration_settings';
      providerField = 'vendor_type';
    } else {
      return res.status(400).json({ error: 'Unknown provider type' });
    }

    // Check if provider exists
    const existing = await pool.query(
      `SELECT id FROM ${settingsTable} WHERE ${providerField} = $1`,
      [providerType]
    );

    if (existing.rows.length > 0) {
      // Update existing
      await pool.query(
        `UPDATE ${settingsTable}
         SET client_id = $1, client_secret = $2, updated_at = CURRENT_TIMESTAMP
         WHERE ${providerField} = $3`,
        [client_id, client_secret, providerType]
      );
    } else {
      // Insert new
      await pool.query(
        `INSERT INTO ${settingsTable} (${providerField}, client_id, client_secret, is_enabled)
         VALUES ($1, $2, $3, false)`,
        [providerType, client_id, client_secret]
      );
    }

    res.json({ success: true, message: 'Credentials saved successfully' });
  } catch (error) {
    console.error('Error saving credentials:', error);
    res.status(500).json({ error: 'Failed to save credentials' });
  }
});

/**
 * Refresh OAuth access token
 * POST /api/integrations/oauth/:providerType/refresh
 */
router.post('/:providerType/refresh', async (req, res) => {
  try {
    const { providerType } = req.params;
    const config = OAUTH_CONFIGS[providerType];
    const pool = req.app.locals.pool;

    let settingsTable, providerField;
    if (['zoom', 'google_meet', 'webex'].includes(providerType)) {
      settingsTable = 'telehealth_provider_settings';
      providerField = 'provider_type';
    } else if (['google_drive', 'onedrive'].includes(providerType)) {
      settingsTable = 'backup_provider_settings';
      providerField = 'provider_type';
    }

    const result = await pool.query(
      `SELECT client_id, client_secret, settings FROM ${settingsTable} WHERE ${providerField} = $1`,
      [providerType]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Provider not configured' });
    }

    const { client_id, client_secret, settings } = result.rows[0];
    const parsedSettings = typeof settings === 'string' ? JSON.parse(settings) : settings;

    if (!parsedSettings.refresh_token) {
      return res.status(400).json({ error: 'No refresh token available' });
    }

    // Refresh the token
    const tokenResponse = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: parsedSettings.refresh_token,
        client_id,
        client_secret,
      }),
    });

    if (!tokenResponse.ok) {
      return res.status(400).json({ error: 'Failed to refresh token' });
    }

    const tokens = await tokenResponse.json();

    // Update tokens in database
    const newSettings = {
      ...parsedSettings,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || parsedSettings.refresh_token,
      expires_at: tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : null,
    };

    await pool.query(
      `UPDATE ${settingsTable}
       SET settings = $1, updated_at = CURRENT_TIMESTAMP
       WHERE ${providerField} = $2`,
      [JSON.stringify(newSettings), providerType]
    );

    res.json({ success: true, message: 'Token refreshed successfully' });
  } catch (error) {
    console.error('Error refreshing token:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

/**
 * Delete OAuth configuration
 * DELETE /api/integrations/oauth/:providerType
 */
router.delete('/:providerType', async (req, res) => {
  try {
    const { providerType } = req.params;
    const pool = req.app.locals.pool;

    let settingsTable, providerField;
    if (['zoom', 'google_meet', 'webex'].includes(providerType)) {
      settingsTable = 'telehealth_provider_settings';
      providerField = 'provider_type';
    } else if (['google_drive', 'onedrive'].includes(providerType)) {
      settingsTable = 'backup_provider_settings';
      providerField = 'provider_type';
    }

    // Clear OAuth tokens but keep client credentials
    await pool.query(
      `UPDATE ${settingsTable}
       SET settings = '{}'::jsonb, is_enabled = false, updated_at = CURRENT_TIMESTAMP
       WHERE ${providerField} = $1`,
      [providerType]
    );

    res.json({ success: true, message: 'OAuth configuration cleared' });
  } catch (error) {
    console.error('Error deleting OAuth configuration:', error);
    res.status(500).json({ error: 'Failed to delete OAuth configuration' });
  }
});

module.exports = router;
