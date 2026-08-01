const axios = require('axios');

/**
 * Webex Telehealth Integration Service
 * Handles creating and managing Webex meetings for telehealth sessions.
 *
 * Auth: OAuth 2.0 access_token (from dedicated column), with refresh support.
 * Falls back to legacy api_key if no OAuth tokens are stored.
 */

class WebexService {
  constructor(config, pool) {
    this.config = config;
    this.pool = pool || null;
    this.baseUrl = 'https://webexapis.com/v1';
  }

  /**
   * Get a valid access token.
   * Priority: dedicated access_token column → legacy api_key.
   */
  async getAccessToken() {
    const accessToken =
      this.config.access_token ||
      (this.config.settings && this.config.settings.access_token);
    const refreshToken =
      this.config.refresh_token ||
      (this.config.settings && this.config.settings.refresh_token);
    const expiresAt =
      this.config.token_expires_at ||
      (this.config.settings && this.config.settings.expires_at);

    // Use OAuth token if available
    if (accessToken) {
      const isExpired = expiresAt && Date.now() >= expiresAt;
      if (!isExpired) return accessToken;

      // Try refresh
      if (refreshToken && this.config.client_id && this.config.client_secret) {
        return this.refreshAccessToken(refreshToken);
      }
    }

    // Fallback to legacy api_key
    if (this.config.api_key) return this.config.api_key;

    throw new Error(
      'Webex is not authenticated. Please sign in via Admin Settings.'
    );
  }

  async refreshAccessToken(refreshToken) {
    const response = await axios.post(
      'https://webexapis.com/v1/access_token',
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.config.client_id,
        client_secret: this.config.client_secret,
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const tokens = response.data;
    const newExpiresAt = Date.now() + (tokens.expires_in || 3600) * 1000;

    if (this.pool) {
      try {
        await this.pool.query(
          `UPDATE telehealth_provider_settings
           SET access_token     = $1,
               refresh_token    = COALESCE($2, refresh_token),
               token_expires_at = $3,
               updated_at       = CURRENT_TIMESTAMP
           WHERE provider_type = 'webex'`,
          [tokens.access_token, tokens.refresh_token || null, newExpiresAt]
        );
      } catch (e) {
        console.error('Failed to persist Webex tokens:', e.message);
      }
    }

    this.config.access_token = tokens.access_token;
    if (tokens.refresh_token) this.config.refresh_token = tokens.refresh_token;
    this.config.token_expires_at = newExpiresAt;

    return tokens.access_token;
  }

  /**
   * Create a Webex meeting
   */
  async createMeeting(sessionData) {
    try {
      const token = await this.getAccessToken();
      const startDateTime = sessionData.instant
        ? new Date()
        : new Date(sessionData.startTime);
      const endDateTime = new Date(startDateTime.getTime() + (sessionData.duration || 30) * 60000);

      const meetingData = {
        title: sessionData.topic || `Telehealth Session - ${sessionData.patientName}`,
        agenda: sessionData.agenda || 'Telehealth consultation',
        start: startDateTime.toISOString(),
        end: endDateTime.toISOString(),
        timezone: 'UTC',
        enabledAutoRecordMeeting: sessionData.recordingEnabled || false,
        allowAnyUserToBeCoHost: false,
        enableConnectAudioBeforeHost: false,
        enableJoinBeforeHost: false,
        joinBeforeHostMinutes: 0,
        excludePassword: false,
        publicMeeting: false,
        meetingType: 'meetingSeries',
        enableAutomaticLock: true,
        automaticLockMinutes: 0
      };

      if (this.config.settings?.site_url) {
        meetingData.siteUrl = this.config.settings.site_url;
      }

      const response = await axios.post(
        `${this.baseUrl}/meetings`,
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
        meetingId: response.data.id,
        meetingUrl: response.data.webLink,
        sipAddress: response.data.sipAddress,
        meetingNumber: response.data.meetingNumber,
        password: response.data.password,
        roomId: response.data.id,
        provider: 'webex',
        rawData: response.data
      };
    } catch (error) {
      console.error('Error creating Webex meeting:', error.response?.data || error.message);
      throw new Error('Failed to create Webex meeting: ' + (error.response?.data?.message || error.message));
    }
  }

  async createInstantMeeting(sessionData) {
    return this.createMeeting({ ...sessionData, instant: true });
  }

  async getMeeting(meetingId) {
    try {
      const token = await this.getAccessToken();
      const response = await axios.get(
        `${this.baseUrl}/meetings/${meetingId}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      return { success: true, meeting: response.data };
    } catch (error) {
      console.error('Error getting Webex meeting:', error.response?.data || error.message);
      throw new Error('Failed to get Webex meeting details');
    }
  }

  async updateMeeting(meetingId, updates) {
    try {
      const token = await this.getAccessToken();
      const response = await axios.put(
        `${this.baseUrl}/meetings/${meetingId}`,
        updates,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return { success: true, message: 'Meeting updated successfully', meeting: response.data };
    } catch (error) {
      console.error('Error updating Webex meeting:', error.response?.data || error.message);
      throw new Error('Failed to update Webex meeting');
    }
  }

  async deleteMeeting(meetingId) {
    try {
      const token = await this.getAccessToken();
      await axios.delete(
        `${this.baseUrl}/meetings/${meetingId}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      return { success: true, message: 'Meeting deleted successfully' };
    } catch (error) {
      console.error('Error deleting Webex meeting:', error.response?.data || error.message);
      throw new Error('Failed to delete Webex meeting');
    }
  }

  async getMeetingRecordings(meetingId) {
    try {
      const token = await this.getAccessToken();
      const response = await axios.get(
        `${this.baseUrl}/recordings`,
        {
          params: { meetingId },
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      return { success: true, recordings: response.data.items || [] };
    } catch (error) {
      console.error('Error getting Webex recordings:', error.response?.data || error.message);
      return { success: false, recordings: [] };
    }
  }

  async testConnection() {
    try {
      const token = await this.getAccessToken();
      const response = await axios.get(`${this.baseUrl}/people/me`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      return {
        success: true,
        message: `Connected as ${response.data.displayName} (${response.data.emails?.[0] || ''})`,
        user: {
          id: response.data.id,
          email: response.data.emails?.[0] || '',
          displayName: response.data.displayName,
        },
      };
    } catch (error) {
      console.error('Error testing Webex connection:', error.response?.data || error.message);
      throw new Error('Webex connection test failed: ' + (error.response?.data?.message || error.message));
    }
  }
}

module.exports = WebexService;
