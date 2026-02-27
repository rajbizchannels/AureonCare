const ZoomService = require('./zoomService');
const GoogleMeetService = require('./googleMeetService');
const WebexService = require('./webexService');
const TeamsService = require('./teamsService');

/**
 * Telehealth Provider Manager
 * Manages different telehealth provider integrations
 */

class TelehealthProviderManager {
  constructor(pool) {
    this.pool = pool;
    this.providers = {
      zoom: null,
      google_meet: null,
      webex: null,
      microsoft_teams: null
    };
  }

  /**
   * Get provider configuration from database
   */
  async getProviderConfig(providerType) {
    try {
      const result = await this.pool.query(
        'SELECT * FROM telehealth_provider_settings WHERE provider_type = $1 AND is_enabled = true',
        [providerType]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      console.error(`Error getting ${providerType} config:`, error);
      return null;
    }
  }

  /**
   * Get the active/default provider
   */
  async getActiveProvider() {
    try {
      const result = await this.pool.query(
        'SELECT * FROM telehealth_provider_settings WHERE is_enabled = true ORDER BY id LIMIT 1'
      );

      if (result.rows.length === 0) {
        return { provider_type: 'aureoncare', is_enabled: false };
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error getting active provider:', error);
      return { provider_type: 'aureoncare', is_enabled: false };
    }
  }

  /**
   * Initialize a provider service
   */
  async initializeProvider(providerType) {
    const config = await this.getProviderConfig(providerType);

    if (!config) {
      throw new Error(`Provider ${providerType} is not configured or not enabled`);
    }

    switch (providerType) {
      case 'zoom':
        this.providers.zoom = new ZoomService(config, this.pool);
        return this.providers.zoom;

      case 'google_meet':
        this.providers.google_meet = new GoogleMeetService(config);
        return this.providers.google_meet;

      case 'webex':
        this.providers.webex = new WebexService(config, this.pool);
        return this.providers.webex;

      case 'microsoft_teams':
        this.providers.microsoft_teams = new TeamsService(config, this.pool);
        return this.providers.microsoft_teams;

      default:
        throw new Error(`Unknown provider type: ${providerType}`);
    }
  }

  /**
   * Get or initialize a provider
   */
  async getProvider(providerType) {
    if (!this.providers[providerType]) {
      return await this.initializeProvider(providerType);
    }
    return this.providers[providerType];
  }

  /**
   * Validate that a provider has the required credentials configured
   */
  validateProviderCredentials(providerType, config) {
    switch (providerType) {
      case 'zoom': {
        const hasJwt = config.api_key && config.api_secret;
        const hasOAuth = config.client_id && config.client_secret;
        if (!hasJwt && !hasOAuth) {
          throw new Error(
            'Zoom is enabled but API credentials are not configured. ' +
            'Please add your Zoom API Key & Secret (or Client ID & Secret) in Admin Panel > Telehealth Settings.'
          );
        }
        break;
      }
      case 'google_meet':
        if (!config.client_id || !config.client_secret) {
          throw new Error(
            'Google Meet is enabled but API credentials are not configured. ' +
            'Please add your Google Client ID & Secret in Admin Panel > Telehealth Settings.'
          );
        }
        break;
      case 'webex':
        if (!config.client_id || !config.client_secret) {
          if (!config.api_key) {
            throw new Error(
              'Webex is enabled but credentials are not configured. ' +
              'Please connect Webex in Admin Panel > Telehealth Settings.'
            );
          }
        }
        break;
      case 'microsoft_teams':
        if (!config.client_id || !config.client_secret) {
          throw new Error(
            'Microsoft Teams is enabled but credentials are not configured. ' +
            'Please connect Teams in Admin Panel > Telehealth Settings.'
          );
        }
        break;
    }
  }

  /**
   * Create a meeting using the specified or default provider
   */
  async createMeeting(sessionData, providerType = null) {
    // If no provider specified, use the active one
    if (!providerType) {
      const activeProvider = await this.getActiveProvider();
      if (!activeProvider.is_enabled) {
        // No provider enabled - return clear error
        throw new Error(
          'No telehealth provider is enabled. ' +
          'Please enable and configure Zoom, Google Meet, Teams, or Webex in Admin Panel > Telehealth Settings.'
        );
      }
      providerType = activeProvider.provider_type;
    }

    // Validate credentials before attempting to create the meeting
    const config = await this.getProviderConfig(providerType);
    if (config) {
      this.validateProviderCredentials(providerType, config);
    }

    try {
      const provider = await this.getProvider(providerType);
      return await provider.createMeeting(sessionData);
    } catch (error) {
      console.error('Error creating telehealth meeting:', error);
      throw error;
    }
  }

  /**
   * Create a default AureonCare meeting (fallback)
   */
  createDefaultMeeting(sessionData) {
    const crypto = require('crypto');
    const roomId = `room-${crypto.randomBytes(16).toString('hex')}`;

    return {
      success: true,
      meetingId: roomId,
      meetingUrl: `https://meet.aureoncare.com/${roomId}`,
      roomId: roomId,
      provider: 'aureoncare'
    };
  }

  /**
   * Get meeting details
   */
  async getMeeting(meetingId, providerType) {
    try {
      if (providerType === 'aureoncare') {
        return {
          success: true,
          meeting: {
            id: meetingId,
            provider: 'aureoncare'
          }
        };
      }

      const provider = await this.getProvider(providerType);
      return await provider.getMeeting(meetingId);
    } catch (error) {
      console.error('Error getting meeting details:', error);
      throw error;
    }
  }

  /**
   * Update meeting
   */
  async updateMeeting(meetingId, updates, providerType) {
    try {
      if (providerType === 'aureoncare') {
        return {
          success: true,
          message: 'Default meeting updated'
        };
      }

      const provider = await this.getProvider(providerType);
      return await provider.updateMeeting(meetingId, updates);
    } catch (error) {
      console.error('Error updating meeting:', error);
      throw error;
    }
  }

  /**
   * Delete meeting
   */
  async deleteMeeting(meetingId, providerType) {
    try {
      if (providerType === 'aureoncare') {
        return {
          success: true,
          message: 'Default meeting deleted'
        };
      }

      const provider = await this.getProvider(providerType);
      return await provider.deleteMeeting(meetingId);
    } catch (error) {
      console.error('Error deleting meeting:', error);
      throw error;
    }
  }
}

module.exports = TelehealthProviderManager;
