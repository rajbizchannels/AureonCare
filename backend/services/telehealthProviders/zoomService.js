const axios = require('axios');
const jwt = require('jsonwebtoken');

/**
 * Zoom Telehealth Integration Service
 * Handles creating and managing Zoom meetings for telehealth sessions.
 *
 * Authentication priority:
 *   1. Stored OAuth access token (from authorization code flow)
 *   2. Refresh the token if expired (and persist the new token to DB)
 *   3. Server-to-Server OAuth (account_credentials grant) — persisted to DB
 *   4. Legacy JWT (api_key / api_secret) — deprecated by Zoom but kept for
 *      backwards compatibility with existing deployments
 *
 * Token persistence:
 *   Tokens are written back to the `settings` JSONB column of
 *   `telehealth_provider_settings` so they survive server restarts and
 *   can be reused across requests without re-authorizing.
 */

class ZoomService {
  /**
   * @param {object} config  Row from telehealth_provider_settings
   * @param {object} [pool]  PostgreSQL pool for persisting tokens (optional
   *                          for backwards compat, but required for token storage)
   */
  constructor(config, pool) {
    this.config = config;
    this.pool = pool || null;
    this.baseUrl = 'https://api.zoom.us/v2';
    // In-memory cache to avoid hitting the DB / Zoom token endpoint on every call
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
      exp: Math.floor(Date.now() / 1000) + 3600 // Token expires in 1 hour
    };

    return jwt.sign(payload, this.config.api_secret);
  }

  /**
   * Persist updated token data into the `settings` JSONB column.
   * Merges the new token fields into the existing settings so other
   * fields (account_id, use_oauth, user_id, etc.) are preserved.
   */
  async persistTokens(tokenData) {
    if (!this.pool) {
      return; // No pool — can't persist (graceful degradation)
    }

    try {
      const providerType = this.config.provider_type || 'zoom';

      // Merge new token data into existing settings
      const existingSettings = (typeof this.config.settings === 'object' && this.config.settings)
        ? this.config.settings
        : {};

      const mergedSettings = {
        ...existingSettings,
        ...tokenData
      };

      await this.pool.query(
        `UPDATE telehealth_provider_settings
         SET settings = $1, updated_at = CURRENT_TIMESTAMP
         WHERE provider_type = $2`,
        [JSON.stringify(mergedSettings), providerType]
      );

      // Keep the in-memory config in sync
      this.config.settings = mergedSettings;
    } catch (error) {
      // Log but don't throw — token persistence failure shouldn't block the API call
      console.error('Failed to persist Zoom tokens to database:', error.message);
    }
  }

  /**
   * Get a valid OAuth access token.
   * Checks for stored tokens from the OAuth authorization code flow first,
   * refreshes if expired, then falls back to Server-to-Server account_credentials.
   * All new/refreshed tokens are persisted to the database.
   */
  async generateOAuthToken() {
    if (!this.config.client_id || !this.config.client_secret) {
      throw new Error('Zoom Client ID and Secret are required for OAuth');
    }

    // Return in-memory cached token if still valid (with 60s buffer)
    if (this._cachedToken && Date.now() < this._tokenExpiresAt - 60000) {
      return this._cachedToken;
    }

    const settings = this.config.settings || {};

    // 1. Use stored access token from OAuth authorization code flow if available and not expired
    if (settings.access_token) {
      const isExpired = settings.expires_at && Date.now() >= settings.expires_at;

      if (!isExpired) {
        this._cachedToken = settings.access_token;
        this._tokenExpiresAt = settings.expires_at || Date.now() + 3600000;
        return settings.access_token;
      }

      // 2. Token expired — try to refresh it
      if (settings.refresh_token) {
        try {
          const refreshResult = await this.refreshOAuthToken(settings.refresh_token);

          const expiresAt = Date.now() + (refreshResult.expires_in || 3600) * 1000;

          // Persist refreshed tokens to DB
          await this.persistTokens({
            access_token: refreshResult.access_token,
            refresh_token: refreshResult.refresh_token || settings.refresh_token,
            expires_at: expiresAt,
            scope: refreshResult.scope || settings.scope,
            token_type: refreshResult.token_type || 'bearer',
            last_refreshed_at: Date.now()
          });

          this._cachedToken = refreshResult.access_token;
          this._tokenExpiresAt = expiresAt;
          return refreshResult.access_token;
        } catch (refreshError) {
          console.error('Failed to refresh Zoom OAuth token, falling back to account_credentials:', refreshError.message);
        }
      }
    }

    // 3. Fall back to Server-to-Server OAuth (account_credentials grant)
    if (!settings.account_id) {
      throw new Error('Zoom OAuth token expired and no account_id configured for Server-to-Server fallback. Please re-authorize Zoom in the Admin Panel.');
    }

    try {
      const credentials = Buffer.from(`${this.config.client_id}:${this.config.client_secret}`).toString('base64');
      const response = await axios.post(
        'https://zoom.us/oauth/token',
        null,
        {
          params: {
            grant_type: 'account_credentials',
            account_id: settings.account_id
          },
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      const expiresAt = Date.now() + (response.data.expires_in || 3600) * 1000;

      // Persist S2S token to DB so subsequent requests (and server restarts) reuse it
      await this.persistTokens({
        access_token: response.data.access_token,
        expires_at: expiresAt,
        scope: response.data.scope || settings.scope,
        token_type: response.data.token_type || 'bearer',
        grant_type: 'account_credentials',
        last_refreshed_at: Date.now()
      });

      this._cachedToken = response.data.access_token;
      this._tokenExpiresAt = expiresAt;
      return response.data.access_token;
    } catch (error) {
      console.error('Error generating Zoom OAuth token:', error.response?.data || error.message);
      throw new Error('Failed to generate Zoom OAuth token: ' + (error.response?.data?.reason || error.message));
    }
  }

  /**
   * Refresh an expired OAuth access token using a refresh token.
   * Returns the full token response (access_token, refresh_token, expires_in, etc.)
   */
  async refreshOAuthToken(refreshToken) {
    const credentials = Buffer.from(`${this.config.client_id}:${this.config.client_secret}`).toString('base64');
    const response = await axios.post(
      'https://zoom.us/oauth/token',
      null,
      {
        params: {
          grant_type: 'refresh_token',
          refresh_token: refreshToken
        },
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    // Return the full response so the caller can persist all fields
    return response.data;
  }

  /**
   * Resolve a valid Bearer token using the best available auth method
   */
  async getToken() {
    const settings = this.config.settings || {};
    const hasOAuth = this.config.client_id && this.config.client_secret;
    const hasJwt = this.config.api_key && this.config.api_secret;

    // Prefer OAuth (covers both authorization-code & server-to-server flows)
    if (hasOAuth && (settings.use_oauth !== false)) {
      return this.generateOAuthToken();
    }

    if (hasJwt) {
      return this.generateToken();
    }

    throw new Error('No valid Zoom credentials configured. Please configure OAuth or API credentials in the Admin Panel.');
  }

  /**
   * Create a Zoom meeting
   */
  async createMeeting(sessionData) {
    try {
      const token = await this.getToken();

      const userId = this.config.settings?.user_id || 'me';
      const meetingData = {
        topic: sessionData.topic || `Telehealth Session - ${sessionData.patientName}`,
        type: sessionData.instant ? 1 : 2, // 1 = instant, 2 = scheduled
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
          approval_type: 2, // No registration required
          audio: 'both',
          auto_recording: sessionData.recordingEnabled ? 'cloud' : 'none',
          waiting_room: true,
          meeting_authentication: false
        }
      };

      const response = await axios.post(
        `${this.baseUrl}/users/${userId}/meetings`,
        meetingData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        meetingId: response.data.id.toString(),
        meetingUrl: response.data.join_url,
        startUrl: response.data.start_url, // For host to launch directly
        password: response.data.password,
        roomId: response.data.id.toString(),
        provider: 'zoom',
        rawData: response.data
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

      const response = await axios.get(
        `${this.baseUrl}/meetings/${meetingId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      return {
        success: true,
        meeting: response.data
      };
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

      await axios.patch(
        `${this.baseUrl}/meetings/${meetingId}`,
        updates,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        message: 'Meeting updated successfully'
      };
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

      await axios.delete(
        `${this.baseUrl}/meetings/${meetingId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      return {
        success: true,
        message: 'Meeting deleted successfully'
      };
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

      const response = await axios.get(
        `${this.baseUrl}/meetings/${meetingId}/recordings`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      return {
        success: true,
        recordings: response.data.recording_files || []
      };
    } catch (error) {
      console.error('Error getting Zoom recordings:', error.response?.data || error.message);
      return {
        success: false,
        recordings: []
      };
    }
  }

  /**
   * Verify Zoom connection by fetching the current user profile.
   * Used for one-click "Test Connection" in the Admin Panel.
   */
  async testConnection() {
    try {
      const token = await this.getToken();

      const response = await axios.get(
        `${this.baseUrl}/users/me`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      return {
        success: true,
        message: `Connected as ${response.data.first_name} ${response.data.last_name} (${response.data.email})`,
        user: {
          id: response.data.id,
          email: response.data.email,
          first_name: response.data.first_name,
          last_name: response.data.last_name,
          type: response.data.type, // 1=Basic, 2=Licensed, 3=On-Prem
          account_id: response.data.account_id
        }
      };
    } catch (error) {
      console.error('Error testing Zoom connection:', error.response?.data || error.message);
      throw new Error('Zoom connection test failed: ' + (error.response?.data?.message || error.message));
    }
  }
}

module.exports = ZoomService;
