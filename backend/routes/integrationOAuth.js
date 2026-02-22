const express = require('express');
const router = express.Router();
const crypto = require('crypto');

/**
 * Integration OAuth Flow Management
 * Handles OAuth flows for Zoom, Google Meet, Webex, and cloud storage providers.
 *
 * Zoom credentials resolution order:
 *   1. Database (client_id / client_secret columns)
 *   2. Environment variables: ZOOM_CLIENT_ID / ZOOM_CLIENT_SECRET
 *
 * All tokens are stored in dedicated columns (access_token, refresh_token,
 * token_expires_at, etc.) instead of the JSONB settings blob.
 */

// Store OAuth states temporarily (in production, use Redis or database)
const oauthStates = new Map();

/**
 * Build the base URL for OAuth redirect URIs.
 * Uses APP_BASE_URL env var if set, otherwise falls back to request-derived URL.
 */
function getBaseUrl(req) {
  if (process.env.APP_BASE_URL) {
    return process.env.APP_BASE_URL.replace(/\/+$/, '');
  }
  const protocol = req.get('x-forwarded-proto') || req.protocol;
  const host = req.get('x-forwarded-host') || req.get('host');
  return `${protocol}://${host}`;
}

/**
 * Resolve client_id and client_secret for a telehealth provider.
 * Falls back to env vars (ZOOM_CLIENT_ID, etc.) when DB has no credentials.
 */
function resolveClientCredentials(providerType, dbRow) {
  let client_id = dbRow?.client_id || null;
  let client_secret = dbRow?.client_secret || null;

  if (!client_id || !client_secret) {
    const prefix = providerType.toUpperCase();
    client_id = client_id || process.env[`${prefix}_CLIENT_ID`] || null;
    client_secret = client_secret || process.env[`${prefix}_CLIENT_SECRET`] || null;
  }

  return { client_id, client_secret };
}

const OAUTH_CONFIGS = {
  zoom: {
    authUrl: 'https://zoom.us/oauth/authorize',
    tokenUrl: 'https://zoom.us/oauth/token',
    // Admin-level granular scopes — required by Zoom Marketplace as of 2025/2026.
    // Classic scopes (meeting:write, user:read) are deprecated; granular are enforced for new apps.
    // Admin-level (:admin suffix) allows the account admin to manage meetings for all users.
    // This supports the "admin configures once, all providers launch sessions" model.
    scope: [
      'meeting:write:meeting:admin',           // Create / update meetings for any account user
      'meeting:read:meeting:admin',            // Read meeting details for any account user
      'meeting:delete:meeting:admin',          // Delete meetings for any account user
      'user:read:user:admin',                  // Read any user's profile in the account
      'user:read:token:admin',                 // Meeting SDK OBF token (required Feb 23 2026)
      'recording:read:list_account_recordings:admin', // List cloud recordings across the account
    ].join(' '),
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
  surescripts: { authType: 'api_key' },
  labcorp: { authType: 'api_key' },
  optum: { authType: 'api_key' },
};

/**
 * Helper: determine which DB table and field to use for a provider type
 */
function getTableInfo(providerType) {
  if (['zoom', 'google_meet', 'webex'].includes(providerType)) {
    return { table: 'telehealth_provider_settings', field: 'provider_type' };
  }
  if (['google_drive', 'onedrive'].includes(providerType)) {
    return { table: 'backup_provider_settings', field: 'provider_type' };
  }
  if (['surescripts', 'labcorp', 'optum'].includes(providerType)) {
    return { table: 'vendor_integration_settings', field: 'vendor_type' };
  }
  return null;
}

// ─── Initiate OAuth flow ────────────────────────────────────────────────────

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
      });
    }

    const pool = req.app.locals.pool;
    const info = getTableInfo(providerType);
    if (!info) return res.status(400).json({ error: 'Invalid provider type' });

    // Ensure table exists
    if (info.table === 'telehealth_provider_settings') {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS telehealth_provider_settings (
          id SERIAL PRIMARY KEY,
          provider_type VARCHAR(50) UNIQUE NOT NULL,
          is_enabled BOOLEAN DEFAULT false,
          client_id TEXT, client_secret TEXT,
          access_token TEXT, refresh_token TEXT,
          token_type VARCHAR(50) DEFAULT 'Bearer',
          token_scope TEXT, token_expires_at BIGINT,
          account_id VARCHAR(255), zoom_user_id VARCHAR(255), zoom_user_email VARCHAR(255),
          api_key TEXT, api_secret TEXT, webhook_secret TEXT,
          settings JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } else if (info.table === 'backup_provider_settings') {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS backup_provider_settings (
          id SERIAL PRIMARY KEY,
          provider_type VARCHAR(50) UNIQUE NOT NULL,
          is_enabled BOOLEAN DEFAULT false,
          client_id VARCHAR(255), client_secret VARCHAR(255),
          settings JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    }

    // Fetch DB row (may be empty)
    const result = await pool.query(
      `SELECT client_id, client_secret FROM ${info.table} WHERE ${info.field} = $1`,
      [providerType]
    );
    const dbRow = result.rows[0] || null;

    // Resolve credentials (DB → env vars)
    const { client_id, client_secret } = resolveClientCredentials(providerType, dbRow);

    if (!client_id || !client_secret) {
      return res.status(400).json({
        error: 'Provider not configured',
        needsEnvSetup: true,
        hint: `Set ${providerType.toUpperCase()}_CLIENT_ID and ${providerType.toUpperCase()}_CLIENT_SECRET environment variables on the server.`,
      });
    }

    // If credentials came from env vars and there's no DB row yet, create one
    if (!dbRow) {
      await pool.query(
        `INSERT INTO ${info.table} (${info.field}, client_id, client_secret, is_enabled)
         VALUES ($1, $2, $3, false)
         ON CONFLICT (${info.field}) DO UPDATE SET
           client_id = EXCLUDED.client_id,
           client_secret = EXCLUDED.client_secret,
           updated_at = CURRENT_TIMESTAMP`,
        [providerType, client_id, client_secret]
      );
    } else if (!dbRow.client_id || !dbRow.client_secret) {
      // DB row exists but missing creds — persist from env vars
      await pool.query(
        `UPDATE ${info.table}
         SET client_id = COALESCE(client_id, $1),
             client_secret = COALESCE(client_secret, $2),
             updated_at = CURRENT_TIMESTAMP
         WHERE ${info.field} = $3`,
        [client_id, client_secret, providerType]
      );
    }

    // Generate CSRF state
    const state = crypto.randomBytes(32).toString('hex');
    const redirectUri = `${getBaseUrl(req)}/api/integrations/oauth/${providerType}/callback`;

    oauthStates.set(state, {
      providerType,
      timestamp: Date.now(),
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    // Clean up expired states
    for (const [key, value] of oauthStates.entries()) {
      if (value.expiresAt < Date.now()) oauthStates.delete(key);
    }

    // Build authorization URL
    const authUrl = new URL(config.authUrl);
    authUrl.searchParams.append('client_id', client_id);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('scope', config.scope);
    authUrl.searchParams.append('state', state);

    if (['google_meet', 'google_drive'].includes(providerType)) {
      authUrl.searchParams.append('access_type', 'offline');
      authUrl.searchParams.append('prompt', 'consent');
    }

    res.json({ authUrl: authUrl.toString(), state });
  } catch (error) {
    console.error('Error initiating OAuth flow:', error);
    res.status(500).json({ error: 'Failed to initiate OAuth flow' });
  }
});

// ─── OAuth callback handler ─────────────────────────────────────────────────

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
    oauthStates.delete(state);

    const config = OAUTH_CONFIGS[providerType];
    const pool = req.app.locals.pool;
    const info = getTableInfo(providerType);

    // Fetch existing DB row for client credentials
    const result = await pool.query(
      `SELECT client_id, client_secret FROM ${info.table} WHERE ${info.field} = $1`,
      [providerType]
    );
    const dbRow = result.rows[0] || null;
    const { client_id, client_secret } = resolveClientCredentials(providerType, dbRow);

    if (!client_id || !client_secret) {
      return res.redirect(`/admin?error=provider_not_configured&provider=${providerType}`);
    }

    const redirectUri = `${getBaseUrl(req)}/api/integrations/oauth/${providerType}/callback`;

    // Exchange authorization code for tokens
    const tokenResponse = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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
    const expiresAt = tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : null;

    // For telehealth providers, store tokens in dedicated columns
    if (info.table === 'telehealth_provider_settings') {
      // Fetch Zoom user profile to store email + user ID
      let zoomUserId = null;
      let zoomUserEmail = null;
      let accountId = null;

      if (providerType === 'zoom' && tokens.access_token) {
        try {
          const userResponse = await fetch('https://api.zoom.us/v2/users/me', {
            headers: { 'Authorization': `Bearer ${tokens.access_token}` },
          });
          if (userResponse.ok) {
            const userData = await userResponse.json();
            zoomUserId = userData.id || null;
            zoomUserEmail = userData.email || null;
            accountId = userData.account_id || null;
          }
        } catch (e) {
          console.error('Failed to fetch Zoom user profile:', e.message);
        }
      }

      await pool.query(
        `UPDATE telehealth_provider_settings
         SET access_token = $1,
             refresh_token = $2,
             token_type = $3,
             token_scope = $4,
             token_expires_at = $5,
             account_id = COALESCE($6, account_id),
             zoom_user_id = COALESCE($7, zoom_user_id),
             zoom_user_email = COALESCE($8, zoom_user_email),
             is_enabled = true,
             settings = jsonb_build_object(
               'access_token', $1::text,
               'refresh_token', $2::text,
               'expires_at', $5::bigint,
               'scope', $4::text,
               'token_type', $3::text,
               'account_id', COALESCE($6, account_id)::text,
               'user_id', COALESCE($7, zoom_user_id)::text,
               'email', COALESCE($8, zoom_user_email)::text
             ),
             updated_at = CURRENT_TIMESTAMP
         WHERE provider_type = $9`,
        [
          tokens.access_token,
          tokens.refresh_token || null,
          tokens.token_type || 'Bearer',
          tokens.scope || config.scope,
          expiresAt,
          accountId,
          zoomUserId,
          zoomUserEmail,
          providerType,
        ]
      );
    } else {
      // Backup providers — keep using JSONB settings for now
      const settingsData = {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
        scope: tokens.scope || config.scope,
      };

      await pool.query(
        `UPDATE ${info.table}
         SET settings = $1, updated_at = CURRENT_TIMESTAMP
         WHERE ${info.field} = $2`,
        [JSON.stringify(settingsData), providerType]
      );
    }

    // Redirect to success page
    res.redirect(`/admin?success=oauth_configured&provider=${providerType}`);
  } catch (error) {
    console.error('Error handling OAuth callback:', error);
    res.redirect(`/admin?error=callback_failed&provider=${req.params.providerType}`);
  }
});

// ─── OAuth configuration status ─────────────────────────────────────────────

router.get('/:providerType/status', async (req, res) => {
  try {
    const { providerType } = req.params;
    const pool = req.app.locals.pool;
    const info = getTableInfo(providerType);

    if (!info) return res.status(400).json({ error: 'Unknown provider type' });

    if (['surescripts', 'labcorp', 'optum'].includes(providerType)) {
      return res.json({ configured: false, authType: 'api_key' });
    }

    let query;
    if (info.table === 'telehealth_provider_settings') {
      query = `SELECT client_id, access_token, refresh_token, token_expires_at,
                      token_scope, account_id, zoom_user_id, zoom_user_email, is_enabled, settings
               FROM ${info.table} WHERE ${info.field} = $1`;
    } else {
      query = `SELECT client_id, settings FROM ${info.table} WHERE ${info.field} = $1`;
    }

    const result = await pool.query(query, [providerType]);

    if (result.rows.length === 0) {
      // Check env vars
      const { client_id } = resolveClientCredentials(providerType, null);
      return res.json({
        configured: false,
        hasClientId: Boolean(client_id),
        hasTokens: false,
        envConfigured: Boolean(client_id),
      });
    }

    const row = result.rows[0];

    if (info.table === 'telehealth_provider_settings') {
      const hasTokens = Boolean(row.access_token);
      const isExpired = row.token_expires_at ? Date.now() >= row.token_expires_at : false;

      return res.json({
        configured: Boolean(row.client_id && row.access_token),
        hasClientId: Boolean(row.client_id),
        hasTokens,
        isExpired,
        isEnabled: row.is_enabled || false,
        expiresAt: row.token_expires_at || null,
        scope: row.token_scope || null,
        accountId: row.account_id || null,
        userId: row.zoom_user_id || null,
        userEmail: row.zoom_user_email || null,
      });
    }

    // Backup providers — read from JSONB
    const settings = row.settings ? (typeof row.settings === 'string' ? JSON.parse(row.settings) : row.settings) : {};
    res.json({
      configured: Boolean(row.client_id && settings.access_token),
      hasClientId: Boolean(row.client_id),
      hasTokens: Boolean(settings.access_token),
      expiresAt: settings.expires_at || null,
    });
  } catch (error) {
    console.error('Error getting OAuth status:', error);
    res.status(500).json({ error: 'Failed to get OAuth status' });
  }
});

// ─── Get redirect URL info (for Zoom setup guide) ──────────────────────────

router.get('/:providerType/redirect-url', (req, res) => {
  const { providerType } = req.params;
  const baseUrl = getBaseUrl(req);
  const redirectUri = `${baseUrl}/api/integrations/oauth/${providerType}/callback`;
  res.json({ redirectUrl: redirectUri, baseUrl });
});

// ─── Get provider client credentials (for editing) ─────────────────────────

router.get('/:providerType/credentials', async (req, res) => {
  try {
    const { providerType } = req.params;
    const pool = req.app.locals.pool;
    const info = getTableInfo(providerType);

    if (!info) return res.status(400).json({ error: 'Unknown provider type' });

    const result = await pool.query(
      `SELECT client_id, client_secret FROM ${info.table} WHERE ${info.field} = $1`,
      [providerType]
    );

    if (result.rows.length === 0) {
      // Fall back to env vars
      const { client_id, client_secret } = resolveClientCredentials(providerType, null);
      if (client_id) {
        return res.json({
          client_id,
          client_secret: client_secret ? '••••' + client_secret.slice(-4) : '',
          source: 'environment',
        });
      }
      return res.status(404).json({ error: 'Provider not configured' });
    }

    res.json({
      client_id: result.rows[0].client_id,
      client_secret: result.rows[0].client_secret,
      source: 'database',
    });
  } catch (error) {
    console.error('Error fetching credentials:', error);
    res.status(500).json({ error: 'Failed to fetch credentials' });
  }
});

// ─── Save provider client credentials ───────────────────────────────────────

router.post('/:providerType/credentials', async (req, res) => {
  try {
    const { providerType } = req.params;
    const { client_id, client_secret } = req.body;

    if (!client_id || !client_secret) {
      return res.status(400).json({ error: 'client_id and client_secret are required' });
    }

    const pool = req.app.locals.pool;
    const info = getTableInfo(providerType);
    if (!info) return res.status(400).json({ error: 'Unknown provider type' });

    // Ensure table exists
    if (info.table === 'telehealth_provider_settings') {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS telehealth_provider_settings (
          id SERIAL PRIMARY KEY,
          provider_type VARCHAR(50) UNIQUE NOT NULL,
          is_enabled BOOLEAN DEFAULT false,
          client_id TEXT, client_secret TEXT,
          access_token TEXT, refresh_token TEXT,
          token_type VARCHAR(50) DEFAULT 'Bearer',
          token_scope TEXT, token_expires_at BIGINT,
          account_id VARCHAR(255), zoom_user_id VARCHAR(255), zoom_user_email VARCHAR(255),
          api_key TEXT, api_secret TEXT, webhook_secret TEXT,
          settings JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } else if (info.table === 'backup_provider_settings') {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS backup_provider_settings (
          id SERIAL PRIMARY KEY,
          provider_type VARCHAR(50) UNIQUE NOT NULL,
          is_enabled BOOLEAN DEFAULT false,
          client_id VARCHAR(255), client_secret VARCHAR(255),
          settings JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } else if (info.table === 'vendor_integration_settings') {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS vendor_integration_settings (
          id SERIAL PRIMARY KEY,
          vendor_type VARCHAR(50) UNIQUE NOT NULL,
          is_enabled BOOLEAN DEFAULT false,
          client_id VARCHAR(255), client_secret VARCHAR(255),
          api_key VARCHAR(255),
          settings JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    }

    // Upsert
    const existing = await pool.query(
      `SELECT id FROM ${info.table} WHERE ${info.field} = $1`,
      [providerType]
    );

    if (existing.rows.length > 0) {
      await pool.query(
        `UPDATE ${info.table}
         SET client_id = $1, client_secret = $2, updated_at = CURRENT_TIMESTAMP
         WHERE ${info.field} = $3`,
        [client_id, client_secret, providerType]
      );
    } else {
      await pool.query(
        `INSERT INTO ${info.table} (${info.field}, client_id, client_secret, is_enabled)
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

// ─── Refresh OAuth access token ─────────────────────────────────────────────

router.post('/:providerType/refresh', async (req, res) => {
  try {
    const { providerType } = req.params;
    const config = OAUTH_CONFIGS[providerType];
    const pool = req.app.locals.pool;
    const info = getTableInfo(providerType);

    const result = await pool.query(
      `SELECT client_id, client_secret, refresh_token, access_token, token_expires_at, settings
       FROM ${info.table} WHERE ${info.field} = $1`,
      [providerType]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Provider not configured' });
    }

    const row = result.rows[0];
    const { client_id, client_secret } = resolveClientCredentials(providerType, row);

    // Use dedicated column first, fall back to JSONB
    const refreshToken = row.refresh_token ||
      (row.settings && typeof row.settings === 'object' ? row.settings.refresh_token : null);

    if (!refreshToken) {
      return res.status(400).json({ error: 'No refresh token available' });
    }

    const tokenResponse = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id,
        client_secret,
      }),
    });

    if (!tokenResponse.ok) {
      return res.status(400).json({ error: 'Failed to refresh token' });
    }

    const tokens = await tokenResponse.json();
    const expiresAt = tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : null;

    if (info.table === 'telehealth_provider_settings') {
      await pool.query(
        `UPDATE telehealth_provider_settings
         SET access_token = $1,
             refresh_token = COALESCE($2, refresh_token),
             token_expires_at = $3,
             token_scope = COALESCE($4, token_scope),
             settings = settings || jsonb_build_object(
               'access_token', $1::text,
               'refresh_token', COALESCE($2, refresh_token)::text,
               'expires_at', $3::bigint,
               'last_refreshed_at', $5::bigint
             ),
             updated_at = CURRENT_TIMESTAMP
         WHERE provider_type = $6`,
        [
          tokens.access_token,
          tokens.refresh_token || null,
          expiresAt,
          tokens.scope || null,
          Date.now(),
          providerType,
        ]
      );
    } else {
      const parsedSettings = typeof row.settings === 'string' ? JSON.parse(row.settings) : (row.settings || {});
      const newSettings = {
        ...parsedSettings,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || parsedSettings.refresh_token,
        expires_at: expiresAt,
      };
      await pool.query(
        `UPDATE ${info.table}
         SET settings = $1, updated_at = CURRENT_TIMESTAMP
         WHERE ${info.field} = $2`,
        [JSON.stringify(newSettings), providerType]
      );
    }

    res.json({ success: true, message: 'Token refreshed successfully' });
  } catch (error) {
    console.error('Error refreshing token:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

// ─── Disconnect / clear OAuth tokens ────────────────────────────────────────

router.delete('/:providerType', async (req, res) => {
  try {
    const { providerType } = req.params;
    const pool = req.app.locals.pool;
    const info = getTableInfo(providerType);
    if (!info) return res.status(400).json({ error: 'Unknown provider type' });

    if (info.table === 'telehealth_provider_settings') {
      // Clear tokens but keep client credentials
      await pool.query(
        `UPDATE telehealth_provider_settings
         SET access_token = NULL,
             refresh_token = NULL,
             token_type = 'Bearer',
             token_scope = NULL,
             token_expires_at = NULL,
             account_id = NULL,
             zoom_user_id = NULL,
             zoom_user_email = NULL,
             is_enabled = false,
             settings = '{}'::jsonb,
             updated_at = CURRENT_TIMESTAMP
         WHERE provider_type = $1`,
        [providerType]
      );
    } else {
      await pool.query(
        `UPDATE ${info.table}
         SET settings = '{}'::jsonb, is_enabled = false, updated_at = CURRENT_TIMESTAMP
         WHERE ${info.field} = $1`,
        [providerType]
      );
    }

    res.json({ success: true, message: 'OAuth configuration cleared' });
  } catch (error) {
    console.error('Error deleting OAuth configuration:', error);
    res.status(500).json({ error: 'Failed to delete OAuth configuration' });
  }
});

module.exports = router;
