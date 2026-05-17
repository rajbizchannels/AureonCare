const axios = require('axios');

/**
 * Microsoft Teams Telehealth Integration Service
 * Handles creating and managing Teams meetings for telehealth sessions
 * via the Microsoft Graph API.
 *
 * Auth: OAuth 2.0 authorization code flow (delegated permissions).
 * Required scopes: OnlineMeetings.ReadWrite, User.Read, offline_access
 */
class TeamsService {
  constructor(config, pool) {
    this.config = config;
    this.pool = pool || null;
    this.graphBaseUrl = 'https://graph.microsoft.com/v1.0';
  }

  /**
   * Get a valid access token, refreshing if expired.
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

    if (!accessToken) {
      throw new Error(
        'Microsoft Teams is not authenticated. Please sign in via Admin Settings.'
      );
    }

    // Token still valid (60s buffer) — only trust this if expiresAt is known
    if (expiresAt && Date.now() < expiresAt - 60000) {
      return accessToken;
    }

    // Token expired or expiry unknown — refresh if possible
    if (refreshToken) {
      return this.refreshAccessToken(refreshToken);
    }

    // No refresh token and expiry unknown — return what we have and let the
    // caller surface the 401 if the token is actually expired.
    if (!expiresAt) {
      return accessToken;
    }

    throw new Error(
      'Microsoft Teams token expired and no refresh token available. Please reconnect in Admin Settings.'
    );
  }

  async refreshAccessToken(refreshToken) {
    const clientId = this.config.client_id;
    const clientSecret = this.config.client_secret;

    if (!clientId || !clientSecret) {
      throw new Error(
        'Microsoft Teams client credentials are missing. ' +
        'Please set AC_MS_CID and AC_MS_CSK environment variables, or reconnect Teams in Admin Settings.'
      );
    }

    const response = await axios.post(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'https://graph.microsoft.com/OnlineMeetings.ReadWrite https://graph.microsoft.com/User.Read offline_access',
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const tokens = response.data;
    const newExpiresAt = Date.now() + (tokens.expires_in || 3600) * 1000;

    // Persist
    if (this.pool) {
      try {
        await this.pool.query(
          `UPDATE telehealth_provider_settings
           SET access_token     = $1,
               refresh_token    = COALESCE($2, refresh_token),
               token_expires_at = $3,
               updated_at       = CURRENT_TIMESTAMP
           WHERE provider_type = 'microsoft_teams'`,
          [tokens.access_token, tokens.refresh_token || null, newExpiresAt]
        );
      } catch (e) {
        console.error('Failed to persist Teams tokens:', e.message);
      }
    }

    this.config.access_token = tokens.access_token;
    if (tokens.refresh_token) this.config.refresh_token = tokens.refresh_token;
    this.config.token_expires_at = newExpiresAt;

    return tokens.access_token;
  }

  /**
   * Create an online meeting via Microsoft Graph
   */
  async createMeeting(sessionData) {
    const startDateTime = sessionData.instant
      ? new Date()
      : new Date(sessionData.startTime);
    const endDateTime = new Date(
      startDateTime.getTime() + (sessionData.duration || 30) * 60000
    );

    const meetingData = {
      subject:
        sessionData.topic ||
        `Telehealth Session - ${sessionData.patientName}`,
      startDateTime: startDateTime.toISOString(),
      endDateTime: endDateTime.toISOString(),
      lobbyBypassSettings: {
        scope: 'organizer',
        isDialInBypassEnabled: false,
      },
      isEntryExitAnnounced: true,
      allowedPresenters: 'organizer',
    };

    let token = await this.getAccessToken();

    try {
      const response = await axios.post(
        `${this.graphBaseUrl}/me/onlineMeetings`,
        meetingData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = response.data;

      return {
        success: true,
        meetingId: data.id,
        meetingUrl: data.joinWebUrl || data.joinUrl,
        roomId: data.id,
        password: data.videoTeleconferenceId || '',
        provider: 'microsoft_teams',
        rawData: data,
      };
    } catch (error) {
      // 401 means the token is invalid/expired — retry with a fresh token
      const refreshToken =
        this.config.refresh_token ||
        (this.config.settings && this.config.settings.refresh_token);

      if (error.response?.status === 401 && refreshToken) {
        token = await this.refreshAccessToken(refreshToken);
        const retryResponse = await axios.post(
          `${this.graphBaseUrl}/me/onlineMeetings`,
          meetingData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );
        const data = retryResponse.data;
        return {
          success: true,
          meetingId: data.id,
          meetingUrl: data.joinWebUrl || data.joinUrl,
          roomId: data.id,
          password: data.videoTeleconferenceId || '',
          provider: 'microsoft_teams',
          rawData: data,
        };
      }

      console.error(
        'Error creating Teams meeting:',
        error.response?.data || error.message
      );
      throw new Error(
        'Failed to create Teams meeting: ' +
          (error.response?.data?.error?.message || error.message)
      );
    }
  }

  /**
   * Create an instant meeting
   */
  async createInstantMeeting(sessionData) {
    return this.createMeeting({ ...sessionData, instant: true });
  }

  /**
   * Get meeting details
   */
  async getMeeting(meetingId) {
    try {
      const token = await this.getAccessToken();
      const response = await axios.get(
        `${this.graphBaseUrl}/me/onlineMeetings/${meetingId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return { success: true, meeting: response.data };
    } catch (error) {
      console.error(
        'Error getting Teams meeting:',
        error.response?.data || error.message
      );
      throw new Error('Failed to get Teams meeting details');
    }
  }

  /**
   * Update meeting
   */
  async updateMeeting(meetingId, updates) {
    try {
      const token = await this.getAccessToken();
      await axios.patch(
        `${this.graphBaseUrl}/me/onlineMeetings/${meetingId}`,
        updates,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return { success: true, message: 'Meeting updated successfully' };
    } catch (error) {
      console.error(
        'Error updating Teams meeting:',
        error.response?.data || error.message
      );
      throw new Error('Failed to update Teams meeting');
    }
  }

  /**
   * Delete meeting
   */
  async deleteMeeting(meetingId) {
    try {
      const token = await this.getAccessToken();
      await axios.delete(
        `${this.graphBaseUrl}/me/onlineMeetings/${meetingId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return { success: true, message: 'Meeting deleted successfully' };
    } catch (error) {
      console.error(
        'Error deleting Teams meeting:',
        error.response?.data || error.message
      );
      throw new Error('Failed to delete Teams meeting');
    }
  }

  /**
   * Verify connection by fetching the user profile.
   */
  async testConnection() {
    try {
      const token = await this.getAccessToken();
      const response = await axios.get(`${this.graphBaseUrl}/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      return {
        success: true,
        message: `Connected as ${response.data.displayName} (${response.data.mail || response.data.userPrincipalName})`,
        user: {
          id: response.data.id,
          email: response.data.mail || response.data.userPrincipalName,
          displayName: response.data.displayName,
        },
      };
    } catch (error) {
      console.error(
        'Error testing Teams connection:',
        error.response?.data || error.message
      );
      throw new Error(
        'Teams connection test failed: ' +
          (error.response?.data?.error?.message || error.message)
      );
    }
  }
}

module.exports = TeamsService;
