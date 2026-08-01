const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');

/**
 * Google Meet Telehealth Integration Service
 * Handles creating and managing Google Meet sessions via Calendar API.
 *
 * Auth: OAuth 2.0. Reads tokens from dedicated columns first,
 * then falls back to JSONB settings for backwards compatibility.
 */

class GoogleMeetService {
  constructor(config, pool) {
    this.config = config;
    this.pool = pool || null;
    this.calendar = null;
    this.initializeClient();
  }

  initializeClient() {
    if (!this.config.client_id || !this.config.client_secret) {
      throw new Error('Google Meet Client ID and Secret are required');
    }

    this.oauth2Client = new OAuth2Client(
      this.config.client_id,
      this.config.client_secret,
      this.config.settings?.redirect_uri || 'http://localhost:3000/oauth/callback'
    );

    // Read tokens from dedicated columns first, then JSONB fallback
    const refreshToken =
      this.config.refresh_token ||
      (this.config.settings && this.config.settings.refresh_token);
    const accessToken =
      this.config.access_token ||
      (this.config.settings && this.config.settings.access_token);

    if (refreshToken || accessToken) {
      this.oauth2Client.setCredentials({
        refresh_token: refreshToken,
        access_token: accessToken,
      });
    }

    this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
  }

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

  async createMeeting(sessionData) {
    try {
      const refreshToken =
        this.config.refresh_token ||
        (this.config.settings && this.config.settings.refresh_token);

      if (!refreshToken) {
        throw new Error('Google Meet is not authenticated. Please complete OAuth setup.');
      }

      const startDateTime = sessionData.instant
        ? new Date()
        : new Date(sessionData.startTime);
      const endDateTime = new Date(startDateTime.getTime() + (sessionData.duration || 30) * 60000);

      const event = {
        summary: sessionData.topic || `Telehealth Session - ${sessionData.patientName}`,
        description: sessionData.agenda || 'Telehealth consultation',
        start: { dateTime: startDateTime.toISOString(), timeZone: 'UTC' },
        end: { dateTime: endDateTime.toISOString(), timeZone: 'UTC' },
        conferenceData: {
          createRequest: {
            requestId: `telehealth-${Date.now()}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' }
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

  async createInstantMeeting(sessionData) {
    return this.createMeeting({ ...sessionData, instant: true });
  }

  async getMeeting(eventId) {
    try {
      const response = await this.calendar.events.get({
        calendarId: 'primary',
        eventId: eventId
      });
      return { success: true, meeting: response.data };
    } catch (error) {
      console.error('Error getting Google Meet event:', error.message);
      throw new Error('Failed to get Google Meet details');
    }
  }

  async updateMeeting(eventId, updates) {
    try {
      const response = await this.calendar.events.patch({
        calendarId: 'primary',
        eventId: eventId,
        resource: updates
      });
      return { success: true, message: 'Meeting updated successfully', meeting: response.data };
    } catch (error) {
      console.error('Error updating Google Meet event:', error.message);
      throw new Error('Failed to update Google Meet session');
    }
  }

  async deleteMeeting(eventId) {
    try {
      await this.calendar.events.delete({
        calendarId: 'primary',
        eventId: eventId,
        sendUpdates: 'all'
      });
      return { success: true, message: 'Meeting deleted successfully' };
    } catch (error) {
      console.error('Error deleting Google Meet event:', error.message);
      throw new Error('Failed to delete Google Meet session');
    }
  }

  async testConnection() {
    try {
      // List a single event to confirm token is valid
      const response = await this.calendar.calendarList.get({
        calendarId: 'primary',
      });
      return {
        success: true,
        message: `Connected to Google Calendar (${response.data.summary || 'primary'})`,
        user: {
          email: response.data.summary || response.data.id,
        },
      };
    } catch (error) {
      console.error('Error testing Google Meet connection:', error.message);
      throw new Error('Google Meet connection test failed: ' + error.message);
    }
  }
}

module.exports = GoogleMeetService;
