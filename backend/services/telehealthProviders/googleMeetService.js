const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');

/**
 * Google Meet Telehealth Integration Service
 * Handles creating and managing Google Meet sessions for telehealth
 */

class GoogleMeetService {
  constructor(config) {
    this.config = config;
    this.calendar = null;
    this.initializeClient();
  }

  /**
   * Initialize Google OAuth2 client
   */
  initializeClient() {
    if (!this.config.client_id || !this.config.client_secret) {
      throw new Error('Google Meet Client ID and Secret are required');
    }

    this.oauth2Client = new OAuth2Client(
      this.config.client_id,
      this.config.client_secret,
      this.config.settings?.redirect_uri || 'http://localhost:3000/oauth/callback'
    );

    // Set credentials if available
    if (this.config.settings?.refresh_token) {
      this.oauth2Client.setCredentials({
        refresh_token: this.config.settings.refresh_token,
        access_token: this.config.settings.access_token
      });
    }

    this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
  }

  /**
   * Get authorization URL for OAuth flow
   */
  getAuthUrl() {
    const scopes = [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar'
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async getTokensFromCode(code) {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);
      return tokens;
    } catch (error) {
      console.error('Error exchanging code for tokens:', error);
      throw new Error('Failed to get tokens from authorization code');
    }
  }

  /**
   * Create a Google Meet session via Calendar API
   */
  async createMeeting(sessionData) {
    try {
      if (!this.config.settings?.refresh_token) {
        throw new Error('Google Meet is not authenticated. Please complete OAuth setup.');
      }

      const startDateTime = new Date(sessionData.startTime);
      const endDateTime = new Date(startDateTime.getTime() + (sessionData.duration || 30) * 60000);

      const event = {
        summary: sessionData.topic || `Telehealth Session - ${sessionData.patientName}`,
        description: sessionData.agenda || 'Telehealth consultation',
        start: {
          dateTime: startDateTime.toISOString(),
          timeZone: 'UTC'
        },
        end: {
          dateTime: endDateTime.toISOString(),
          timeZone: 'UTC'
        },
        conferenceData: {
          createRequest: {
            requestId: `telehealth-${Date.now()}`,
            conferenceSolutionKey: {
              type: 'hangoutsMeet'
            }
          }
        },
        attendees: sessionData.attendees || [],
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 },
            { method: 'popup', minutes: 30 }
          ]
        }
      };

      const response = await this.calendar.events.insert({
        calendarId: 'primary',
        conferenceDataVersion: 1,
        sendUpdates: 'all',
        resource: event
      });

      const meetData = response.data;
      const meetingUrl = meetData.conferenceData?.entryPoints?.find(
        ep => ep.entryPointType === 'video'
      )?.uri || meetData.hangoutLink;

      return {
        success: true,
        meetingId: meetData.id,
        meetingUrl: meetingUrl,
        conferenceId: meetData.conferenceData?.conferenceId,
        roomId: meetData.conferenceData?.conferenceId || meetData.id,
        provider: 'google_meet',
        rawData: meetData
      };
    } catch (error) {
      console.error('Error creating Google Meet session:', error.message);
      throw new Error('Failed to create Google Meet session: ' + error.message);
    }
  }

  /**
   * Get meeting details
   */
  async getMeeting(eventId) {
    try {
      const response = await this.calendar.events.get({
        calendarId: 'primary',
        eventId: eventId
      });

      return {
        success: true,
        meeting: response.data
      };
    } catch (error) {
      console.error('Error getting Google Meet event:', error.message);
      throw new Error('Failed to get Google Meet details');
    }
  }

  /**
   * Update meeting
   */
  async updateMeeting(eventId, updates) {
    try {
      const response = await this.calendar.events.patch({
        calendarId: 'primary',
        eventId: eventId,
        resource: updates
      });

      return {
        success: true,
        message: 'Meeting updated successfully',
        meeting: response.data
      };
    } catch (error) {
      console.error('Error updating Google Meet event:', error.message);
      throw new Error('Failed to update Google Meet session');
    }
  }

  /**
   * Delete meeting
   */
  async deleteMeeting(eventId) {
    try {
      await this.calendar.events.delete({
        calendarId: 'primary',
        eventId: eventId,
        sendUpdates: 'all'
      });

      return {
        success: true,
        message: 'Meeting deleted successfully'
      };
    } catch (error) {
      console.error('Error deleting Google Meet event:', error.message);
      throw new Error('Failed to delete Google Meet session');
    }
  }
}

module.exports = GoogleMeetService;
