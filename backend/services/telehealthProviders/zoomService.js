const axios = require('axios');
const jwt = require('jsonwebtoken');

/**
 * Zoom Telehealth Integration Service
 * Handles creating and managing Zoom meetings for telehealth sessions.
 *
 * Authentication priority:
 *   1. Stored OAuth access_token (dedicated column, from authorization code flow)
 *   2. Refresh the token if expired (using refresh_token column)
 *   3. Server-to-Server OAuth (account_credentials grant using account_id column)
 *   4. Legacy JWT (api_key / api_secret) — deprecated by Zoom
 *
 * Token persistence:
 *   Tokens are stored in dedicated columns (access_token, refresh_token,
 *   token_expires_at, etc.) on telehealth_provider_settings, with a
 *   mirrored copy in the JSONB 'settings' column for backwards compatibility.
 */

class ZoomService {
  /**
   * @param {object} config  Row from telehealth_provider_settings
   * @param {object} [pool]  PostgreSQL pool for persisting tokens
   */
  constructor(config, pool) {
    this.config = config;
    this.pool = pool || null;
    this.baseUrl = 'https://api.zoom.us/v2';
    this._cachedToken = null;
    this._tokenExpiresAt = 0;
  }

  /**
   * Generate Zoom JWT token for API authentication (legacy)
   */
  generateToken() {
    if (!this.config.api_key || !this.config.api_secret) {
      throw new Error('Zoom API Key and Secret are required');
    }

    const payload = {
      iss: this.config.api_key,
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    return jwt.sign(payload, this.config.api_secret);
  }

  /**
   * Persist updated token data into dedicated columns + JSONB settings.
   */
  async persistTokens(tokenData) {
    if (!this.pool) return;

    try {
      const providerType = this.config.provider_type || 'zoom';

      await this.pool.query(
        `UPDATE telehealth_provider_settings
         SET access_token     = COALESCE($1, access_token),
             refresh_token    = COALESCE($2, refresh_token),
             token_expires_at = COALESCE($3, token_expires_at),
             token_scope      = COALESCE($4, token_scope),
             token_type       = COALESCE($5, token_type),
             settings = settings || jsonb_build_object(
               'access_token', $1::text,
               'refresh_token', COALESCE($2, refresh_token)::text,
               'expires_at', $3::bigint,
               'scope', $4::text,
               'token_type', $5::text,
               'last_refreshed_at', $6::bigint
             ),
             updated_at = CURRENT_TIMESTAMP
         WHERE provider_type = $7`,
        [
          tokenData.access_token || null,
          tokenData.refresh_token || null,
          tokenData.expires_at || null,
          tokenData.scope || null,
          tokenData.token_type || 'Bearer',
          Date.now(),
          providerType,
        ]
      );

      // Keep in-memory config in sync
      if (tokenData.access_token) this.config.access_token = tokenData.access_token;
      if (tokenData.refresh_token) this.config.refresh_token = tokenData.refresh_token;
      if (tokenData.expires_at) this.config.token_expires_at = tokenData.expires_at;
    } catch (error) {
      console.error('Failed to persist Zoom tokens to database:', error.message);
    }
  }

  /**
   * Get a valid OAuth access token.
   * Reads from dedicated columns first, falls back to JSONB settings.
   */
  async generateOAuthToken() {
    if (!this.config.client_id || !this.config.client_secret) {
      throw new Error('Zoom Client ID and Secret are required for OAuth');
    }

    // Return in-memory cached token if still valid (60s buffer)
    if (this._cachedToken && Date.now() < this._tokenExpiresAt - 60000) {
      return this._cachedToken;
    }

    // Read token from dedicated columns first, then JSONB fallback
    const accessToken = this.config.access_token ||
      (this.config.settings && this.config.settings.access_token);
    const refreshToken = this.config.refresh_token ||
      (this.config.settings && this.config.settings.refresh_token);
    const expiresAt = this.config.token_expires_at ||
      (this.config.settings && this.config.settings.expires_at);
    const accountId = this.config.account_id ||
      (this.config.settings && this.config.settings.account_id);

    // 1. Use stored access token if not expired
    if (accessToken) {
      const isExpired = expiresAt && Date.now() >= expiresAt;

      if (!isExpired) {
        this._cachedToken = accessToken;
        this._tokenExpiresAt = expiresAt || Date.now() + 3600000;
        return accessToken;
      }

      // 2. Token expired — try to refresh
      if (refreshToken) {
        try {
          const refreshResult = await this.refreshOAuthToken(refreshToken);
          const newExpiresAt = Date.now() + (refreshResult.expires_in || 3600) * 1000;

          await this.persistTokens({
            access_token: refreshResult.access_token,
            refresh_token: refreshResult.refresh_token || refreshToken,
            expires_at: newExpiresAt,
            scope: refreshResult.scope,
            token_type: refreshResult.token_type || 'Bearer',
          });

          this._cachedToken = refreshResult.access_token;
          this._tokenExpiresAt = newExpiresAt;
          return refreshResult.access_token;
        } catch (refreshError) {
          console.error('Failed to refresh Zoom OAuth token:', refreshError.message);
        }
      }
    }

    // 3. Fall back to Server-to-Server OAuth (account_credentials)
    if (!accountId) {
      throw new Error(
        'Zoom OAuth token expired and no account_id configured for Server-to-Server fallback. ' +
        'Please re-authorize Zoom in the Admin Panel.'
      );
    }

    try {
      const credentials = Buffer.from(
        `${this.config.client_id}:${this.config.client_secret}`
      ).toString('base64');

      const response = await axios.post('https://zoom.us/oauth/token', null, {
        params: { grant_type: 'account_credentials', account_id: accountId },
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const newExpiresAt = Date.now() + (response.data.expires_in || 3600) * 1000;

      await this.persistTokens({
        access_token: response.data.access_token,
        expires_at: newExpiresAt,
        scope: response.data.scope,
        token_type: response.data.token_type || 'Bearer',
      });

      this._cachedToken = response.data.access_token;
      this._tokenExpiresAt = newExpiresAt;
      return response.data.access_token;
    } catch (error) {
      console.error('Error generating Zoom OAuth token:', error.response?.data || error.message);
      throw new Error(
        'Failed to generate Zoom OAuth token: ' +
        (error.response?.data?.reason || error.message)
      );
    }
  }

  /**
   * Refresh an expired OAuth access token using a refresh token.
   */
  async refreshOAuthToken(refreshToken) {
    const credentials = Buffer.from(
      `${this.config.client_id}:${this.config.client_secret}`
    ).toString('base64');

    const response = await axios.post('https://zoom.us/oauth/token', null, {
      params: { grant_type: 'refresh_token', refresh_token: refreshToken },
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    return response.data;
  }

  /**
   * Resolve a valid Bearer token using the best available auth method
   */
  async getToken() {
    const hasOAuth = this.config.client_id && this.config.client_secret;
    const hasJwt = this.config.api_key && this.config.api_secret;

    if (hasOAuth) {
      return this.generateOAuthToken();
    }

    if (hasJwt) {
      return this.generateToken();
    }

    throw new Error(
      'No valid Zoom credentials configured. ' +
      'Please configure OAuth or API credentials in the Admin Panel.'
    );
  }

  /**
   * Create a Zoom meeting
   */
  async createMeeting(sessionData) {
    try {
      const token = await this.getToken();

      const userId = this.config.zoom_user_id ||
        (this.config.settings && this.config.settings.user_id) || 'me';

      const meetingData = {
        topic: sessionData.topic || `Telehealth Session - ${sessionData.patientName}`,
        type: sessionData.instant ? 1 : 2,
        start_time: sessionData.instant ? undefined : sessionData.startTime,
        duration: sessionData.duration || 30,
        timezone: sessionData.timezone || 'UTC',
        agenda: sessionData.agenda || 'Telehealth consultation',
        settings: {
          host_video: true,
          participant_video: true,
          join_before_host: false,
          mute_upon_entry: true,
          watermark: false,
          use_pmi: false,
          approval_type: 2,
          audio: 'both',
          auto_recording: sessionData.recordingEnabled ? 'cloud' : 'none',
          waiting_room: true,
          meeting_authentication: false,
        },
      };

      const response = await axios.post(
        `${this.baseUrl}/users/${userId}/meetings`,
        meetingData,
        { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }
      );

      return {
        success: true,
        meetingId: response.data.id.toString(),
        meetingUrl: response.data.join_url,
        startUrl: response.data.start_url,
        password: response.data.password,
        roomId: response.data.id.toString(),
        provider: 'zoom',
        rawData: response.data,
      };
    } catch (error) {
      console.error('Error creating Zoom meeting:', error.response?.data || error.message);
      throw new Error('Failed to create Zoom meeting: ' + (error.response?.data?.message || error.message));
    }
  }

  /**
   * Create an instant Zoom meeting (one-click launch)
   */
  async createInstantMeeting(sessionData) {
    return this.createMeeting({ ...sessionData, instant: true });
  }

  /**
   * Get meeting details
   */
  async getMeeting(meetingId) {
    try {
      const token = await this.getToken();
      const response = await axios.get(`${this.baseUrl}/meetings/${meetingId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      return { success: true, meeting: response.data };
    } catch (error) {
      console.error('Error getting Zoom meeting:', error.response?.data || error.message);
      throw new Error('Failed to get Zoom meeting details');
    }
  }

  /**
   * Update meeting
   */
  async updateMeeting(meetingId, updates) {
    try {
      const token = await this.getToken();
      await axios.patch(`${this.baseUrl}/meetings/${meetingId}`, updates, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      return { success: true, message: 'Meeting updated successfully' };
    } catch (error) {
      console.error('Error updating Zoom meeting:', error.response?.data || error.message);
      throw new Error('Failed to update Zoom meeting');
    }
  }

  /**
   * Delete meeting
   */
  async deleteMeeting(meetingId) {
    try {
      const token = await this.getToken();
      await axios.delete(`${this.baseUrl}/meetings/${meetingId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      return { success: true, message: 'Meeting deleted successfully' };
    } catch (error) {
      console.error('Error deleting Zoom meeting:', error.response?.data || error.message);
      throw new Error('Failed to delete Zoom meeting');
    }
  }

  /**
   * Get meeting recordings
   */
  async getMeetingRecordings(meetingId) {
    try {
      const token = await this.getToken();
      const response = await axios.get(`${this.baseUrl}/meetings/${meetingId}/recordings`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      return { success: true, recordings: response.data.recording_files || [] };
    } catch (error) {
      console.error('Error getting Zoom recordings:', error.response?.data || error.message);
      return { success: false, recordings: [] };
    }
  }

  /**
   * Verify Zoom connection by fetching the current user profile.
   */
  async testConnection() {
    try {
      const token = await this.getToken();
      const response = await axios.get(`${this.baseUrl}/users/me`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      return {
        success: true,
        message: `Connected as ${response.data.first_name} ${response.data.last_name} (${response.data.email})`,
        user: {
          id: response.data.id,
          email: response.data.email,
          first_name: response.data.first_name,
          last_name: response.data.last_name,
          type: response.data.type,
          account_id: response.data.account_id,
        },
      };
    } catch (error) {
      console.error('Error testing Zoom connection:', error.response?.data || error.message);
      throw new Error('Zoom connection test failed: ' + (error.response?.data?.message || error.message));
    }
  }
}

module.exports = ZoomService;
