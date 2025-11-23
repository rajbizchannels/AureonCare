const axios = require('axios');
const jwt = require('jsonwebtoken');

/**
 * Zoom Telehealth Integration Service
 * Handles creating and managing Zoom meetings for telehealth sessions
 */

class ZoomService {
  constructor(config) {
    this.config = config;
    this.baseUrl = 'https://api.zoom.us/v2';
  }

  /**
   * Generate Zoom JWT token for API authentication
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
   * Generate OAuth token (for OAuth flow)
   */
  async generateOAuthToken() {
    if (!this.config.client_id || !this.config.client_secret) {
      throw new Error('Zoom Client ID and Secret are required for OAuth');
    }

    try {
      const credentials = Buffer.from(`${this.config.client_id}:${this.config.client_secret}`).toString('base64');
      const response = await axios.post(
        'https://zoom.us/oauth/token',
        null,
        {
          params: {
            grant_type: 'account_credentials',
            account_id: this.config.settings?.account_id
          },
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      return response.data.access_token;
    } catch (error) {
      console.error('Error generating Zoom OAuth token:', error.response?.data || error.message);
      throw new Error('Failed to generate Zoom OAuth token');
    }
  }

  /**
   * Create a Zoom meeting
   */
  async createMeeting(sessionData) {
    try {
      const token = this.config.settings?.use_oauth
        ? await this.generateOAuthToken()
        : this.generateToken();

      const userId = this.config.settings?.user_id || 'me';
      const meetingData = {
        topic: sessionData.topic || `Telehealth Session - ${sessionData.patientName}`,
        type: 2, // Scheduled meeting
        start_time: sessionData.startTime,
        duration: sessionData.duration || 30,
        timezone: 'UTC',
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
        startUrl: response.data.start_url, // For host
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
   * Get meeting details
   */
  async getMeeting(meetingId) {
    try {
      const token = this.config.settings?.use_oauth
        ? await this.generateOAuthToken()
        : this.generateToken();

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
      const token = this.config.settings?.use_oauth
        ? await this.generateOAuthToken()
        : this.generateToken();

      const response = await axios.patch(
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
      const token = this.config.settings?.use_oauth
        ? await this.generateOAuthToken()
        : this.generateToken();

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
      const token = this.config.settings?.use_oauth
        ? await this.generateOAuthToken()
        : this.generateToken();

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
}

module.exports = ZoomService;
