const axios = require('axios');

/**
 * Webex Telehealth Integration Service
 * Handles creating and managing Webex meetings for telehealth sessions
 */

class WebexService {
  constructor(config) {
    this.config = config;
    this.baseUrl = 'https://webexapis.com/v1';
  }

  /**
   * Get access token (assumes OAuth setup or Bot token)
   */
  getAccessToken() {
    if (!this.config.api_key) {
      throw new Error('Webex Access Token is required');
    }
    return this.config.api_key;
  }

  /**
   * Create a Webex meeting
   */
  async createMeeting(sessionData) {
    try {
      const token = this.getAccessToken();
      const startDateTime = new Date(sessionData.startTime);
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

      // Add site URL if configured
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

  /**
   * Get meeting details
   */
  async getMeeting(meetingId) {
    try {
      const token = this.getAccessToken();

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
      console.error('Error getting Webex meeting:', error.response?.data || error.message);
      throw new Error('Failed to get Webex meeting details');
    }
  }

  /**
   * Update meeting
   */
  async updateMeeting(meetingId, updates) {
    try {
      const token = this.getAccessToken();

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

      return {
        success: true,
        message: 'Meeting updated successfully',
        meeting: response.data
      };
    } catch (error) {
      console.error('Error updating Webex meeting:', error.response?.data || error.message);
      throw new Error('Failed to update Webex meeting');
    }
  }

  /**
   * Delete meeting
   */
  async deleteMeeting(meetingId) {
    try {
      const token = this.getAccessToken();

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
      console.error('Error deleting Webex meeting:', error.response?.data || error.message);
      throw new Error('Failed to delete Webex meeting');
    }
  }

  /**
   * List meeting recordings
   */
  async getMeetingRecordings(meetingId) {
    try {
      const token = this.getAccessToken();

      const response = await axios.get(
        `${this.baseUrl}/recordings`,
        {
          params: { meetingId },
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      return {
        success: true,
        recordings: response.data.items || []
      };
    } catch (error) {
      console.error('Error getting Webex recordings:', error.response?.data || error.message);
      return {
        success: false,
        recordings: []
      };
    }
  }
}

module.exports = WebexService;
