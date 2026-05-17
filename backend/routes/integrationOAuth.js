const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const axios = require('axios');

/**
 * Integration OAuth Flow Management
 * Handles OAuth flows for Zoom, Google Meet, Webex, and cloud storage providers.
 *
 * Zoom credentials resolution order:
 *   1. Database (client_id / client_secret columns)
 *   2. Environment variables: AC_ZM_CID / AC_ZM_CSK
 *
 * All tokens are stored in dedicated columns (access_token, refresh_token,
 * token_expires_at, etc.) instead of the JSONB settings blob.
 */

// Store OAuth states temporarily (in production, use Redis or database)
const oauthStates = new Map();

/**
 * Build the frontend URL for post-OAuth redirects.
 * Uses AC_FE_URL env var so the browser ends up on the React app, not the backend.
 */
function getFrontendUrl() {
  return (process.env.AC_FE_URL || 'http://localhost:3001').replace(/\/+$/, '');
}

/**
 * Serve a minimal self-closing HTML page in the OAuth popup.
 * Posts a postMessage to the opener, then closes itself after 1.5 s.
 * If window.opener is unavailable (COOP), the parent detects success via polling.
 */
function sendOAuthResult(res, success, providerType, errorDetail) {
  // Helmet sets a strict CSP that blocks inline <script> by default.
  // Override it for this tiny self-closing page so window.close() can run.
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'"
  );

  const frontendUrl = getFrontendUrl();
  const msgType = success ? 'oauth_success' : 'oauth_error';
  const icon = success ? '&#x2713;' : '&#x2717;';
  const iconColor = success ? '#22c55e' : '#ef4444';
  const title = success ? 'Connected!' : 'Connection Failed';
  const subtitle = success
    ? 'Connected successfully. This window will close automatically.'
    : (errorDetail || 'Please close this window and try again.');

  const safeProvider = String(providerType).replace(/[^a-z0-9_]/gi, '');
  const safeDetail = errorDetail ? String(errorDetail).substring(0, 200) : '';

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
         background:#0f172a;color:#e2e8f0;display:flex;
         align-items:center;justify-content:center;height:100vh}
    .card{text-align:center;padding:48px 40px}
    .icon{font-size:56px;color:${iconColor};margin-bottom:20px;line-height:1}
    h2{font-size:22px;font-weight:600;margin-bottom:10px}
    p{font-size:14px;color:#94a3b8;max-width:320px;line-height:1.5}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h2>${title}</h2>
    <p>${subtitle}</p>
  </div>
  <script>
    (function(){
      try{
        if(window.opener&&!window.opener.closed){
          window.opener.postMessage(
            {type:'${msgType}',provider:'${safeProvider}',error:'${safeDetail}'},
            '${frontendUrl}'
          );
        }
      }catch(e){}
      setTimeout(function(){window.close();},1500);
    })();
  </script>
</body>
</html>`);
}

/**
 * Build the base URL for OAuth redirect URIs.
 * Uses AC_BE_URL env var if set, otherwise falls back to request-derived URL.
 */
function getBaseUrl(req) {
  if (process.env.AC_BE_URL) {
    return process.env.AC_BE_URL.replace(/\/+$/, '');
  }
  const protocol = req.get('x-forwarded-proto') || req.protocol;
  const host = req.get('x-forwarded-host') || req.get('host');
  return `${protocol}://${host}`;
}

// Maps dynamically-generated legacy key names (e.g. "ZOOM_CLIENT_ID") to their
// abbreviated equivalents so the runtime lookup always finds the correct var.
const PROVIDER_ENV_MAP = {
  ZOOM_CLIENT_ID:              'AC_ZM_CID',
  ZOOM_CLIENT_SECRET:          'AC_ZM_CSK',
  TEAMS_CLIENT_ID:             'AC_MS_CID',
  TEAMS_CLIENT_SECRET:         'AC_MS_CSK',
  MICROSOFT_TEAMS_CLIENT_ID:   'AC_MS_CID',
  MICROSOFT_TEAMS_CLIENT_SECRET:'AC_MS_CSK',
  WEBEX_CLIENT_ID:             'AC_WBX_CID',
  WEBEX_CLIENT_SECRET:         'AC_WBX_CSK',
  GOOGLE_MEET_CLIENT_ID:       'AC_GM_CID',
  GOOGLE_MEET_CLIENT_SECRET:   'AC_GM_CSK',
  GOOGLE_DRIVE_CLIENT_ID:      'REACT_APP_GG_CID',
  GOOGLE_DRIVE_CLIENT_SECRET:  'AC_GD_CSK',
  ONEDRIVE_CLIENT_ID:          'REACT_APP_MS_CID',
  ONEDRIVE_CLIENT_SECRET:      'AC_OD_CSK',
};

function resolveProviderEnv(key) {
  return process.env[PROVIDER_ENV_MAP[key] || key];
}

/**
 * Resolve client_id and client_secret for a telehealth provider.
 * Env vars (AC_ZM_CID, etc.) take precedence over DB values so that
 * updating credentials after Marketplace approval takes effect immediately.
 */
function resolveClientCredentials(providerType, dbRow) {
  const prefix = providerType.toUpperCase();
  const envPrefixes = providerType === 'microsoft_teams'
    ? ['TEAMS', prefix]
    : [prefix];

  let envClientId = null;
  let envClientSecret = null;
  for (const ep of envPrefixes) {
    envClientId = envClientId || resolveProviderEnv(`${ep}_CLIENT_ID`) || null;
    envClientSecret = envClientSecret || resolveProviderEnv(`${ep}_CLIENT_SECRET`) || null;
  }

  const client_id = envClientId || dbRow?.client_id || null;
  const client_secret = envClientSecret || dbRow?.client_secret || null;

  return { client_id, client_secret };
}

const OAUTH_CONFIGS = {
  zoom: {
    authUrl: 'https://zoom.us/oauth/authorize',
    tokenUrl: 'https://zoom.us/oauth/token',
    // User-level granular scopes (no :admin suffix).
    // User-managed apps work cross-account — any Zoom user can authorize,
    // even from a different Zoom organization, without Marketplace publication.
    // Admin-level (:admin) scopes restrict OAuth to the same Zoom org as the app developer.
    scope: [
      'meeting:write:meeting',              // Create / update own meetings
      'meeting:read:meeting',               // Read own meeting details
      'user:read:user',                     // Read own user profile
      'user:read:zak',                      // Read own ZAK token for embedded SDK hosting
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
  microsoft_teams: {
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scope: 'OnlineMeetings.ReadWrite User.Read offline_access',
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
  if (['zoom', 'google_meet', 'webex', 'microsoft_teams'].includes(providerType)) {
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

    // Sync DB with resolved credentials (env vars may have changed after
    // Marketplace approval, or DB row may not exist yet).
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
    } else if (dbRow.client_id !== client_id || dbRow.client_secret !== client_secret) {
      await pool.query(
        `UPDATE ${info.table}
         SET client_id = $1,
             client_secret = $2,
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
      return sendOAuthResult(res, false, providerType, oauthError);
    }
    if (!code || !state) {
      return sendOAuthResult(res, false, providerType, 'Invalid callback — missing code or state.');
    }

    // Verify state
    const storedState = oauthStates.get(state);
    if (!storedState || storedState.providerType !== providerType) {
      return sendOAuthResult(res, false, providerType, 'Invalid or expired state. Please try again.');
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
      return sendOAuthResult(res, false, providerType, 'Provider not configured — missing Client ID or Secret on the server.');
    }

    const redirectUri = `${getBaseUrl(req)}/api/integrations/oauth/${providerType}/callback`;

    // Exchange authorization code for tokens (using axios for Node.js compatibility)
    let tokens;
    try {
      const tokenResponse = await axios.post(config.tokenUrl,
        new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          client_id,
          client_secret,
        }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );
      tokens = tokenResponse.data;
    } catch (tokenError) {
      console.error('Token exchange error:', tokenError.response?.data || tokenError.message);
      return sendOAuthResult(res, false, providerType, 'Token exchange failed — check your Client Secret and Redirect URL.');
    }

    const expiresAt = tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : null;

    // For telehealth providers, store tokens in dedicated columns
    if (info.table === 'telehealth_provider_settings') {
      // Fetch connected user's profile (email, user id, account id)
      let connectedUserId = null;
      let connectedUserEmail = null;
      let accountId = null;

      if (tokens.access_token) {
        try {
          if (providerType === 'zoom') {
            const userResponse = await axios.get('https://api.zoom.us/v2/users/me', {
              headers: { 'Authorization': `Bearer ${tokens.access_token}` },
            });
            connectedUserId = userResponse.data.id || null;
            connectedUserEmail = userResponse.data.email || null;
            accountId = userResponse.data.account_id || null;
          } else if (providerType === 'google_meet') {
            const userResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
              headers: { 'Authorization': `Bearer ${tokens.access_token}` },
            });
            connectedUserId = userResponse.data.id || null;
            connectedUserEmail = userResponse.data.email || null;
          } else if (providerType === 'webex') {
            const userResponse = await axios.get('https://webexapis.com/v1/people/me', {
              headers: { 'Authorization': `Bearer ${tokens.access_token}` },
            });
            connectedUserId = userResponse.data.id || null;
            connectedUserEmail = (userResponse.data.emails && userResponse.data.emails[0]) || null;
          } else if (providerType === 'microsoft_teams') {
            const userResponse = await axios.get('https://graph.microsoft.com/v1.0/me', {
              headers: { 'Authorization': `Bearer ${tokens.access_token}` },
            });
            connectedUserId = userResponse.data.id || null;
            connectedUserEmail = userResponse.data.mail || userResponse.data.userPrincipalName || null;
          }
        } catch (e) {
          console.error(`Failed to fetch ${providerType} user profile:`, e.message);
        }
      }

      const settingsJson = JSON.stringify({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        expires_at: expiresAt,
        scope: tokens.scope || config.scope,
        token_type: tokens.token_type || 'Bearer',
        account_id: accountId,
        user_id: connectedUserId,
        email: connectedUserEmail,
      });

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
             settings = $10::jsonb,
             updated_at = CURRENT_TIMESTAMP
         WHERE provider_type = $9`,
        [
          tokens.access_token,
          tokens.refresh_token || null,
          tokens.token_type || 'Bearer',
          tokens.scope || config.scope,
          expiresAt,
          accountId,
          connectedUserId,
          connectedUserEmail,
          providerType,
          settingsJson,
        ]
      );
    } else {
      // Backup providers — store tokens in JSONB settings
      const settingsData = {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        expires_at: expiresAt,
        scope: tokens.scope || config.scope,
      };

      // UPSERT so tokens are saved even if no row exists yet
      await pool.query(
        `INSERT INTO ${info.table} (${info.field}, is_enabled, settings, updated_at)
         VALUES ($1, true, $2::jsonb, CURRENT_TIMESTAMP)
         ON CONFLICT (${info.field}) DO UPDATE
           SET settings = $2::jsonb,
               is_enabled = true,
               updated_at = CURRENT_TIMESTAMP`,
        [providerType, JSON.stringify(settingsData)]
      );
    }

    // Serve the self-closing success page
    sendOAuthResult(res, true, providerType);
  } catch (error) {
    console.error('Error handling OAuth callback:', error.message, error.stack);
    sendOAuthResult(res, false, req.params.providerType, error.message || 'Unexpected error');
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

    let tokens;
    try {
      const tokenResponse = await axios.post(config.tokenUrl,
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id,
          client_secret,
        }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );
      tokens = tokenResponse.data;
    } catch (refreshError) {
      console.error('Token refresh error:', refreshError.response?.data || refreshError.message);
      return res.status(400).json({ error: 'Failed to refresh token' });
    }
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
