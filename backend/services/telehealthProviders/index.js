const ZoomService = require('./zoomService');
const GoogleMeetService = require('./googleMeetService');
const WebexService = require('./webexService');

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
      webex: null
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
        return { provider_type: 'medflow', is_enabled: false };
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error getting active provider:', error);
      return { provider_type: 'medflow', is_enabled: false };
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
        this.providers.zoom = new ZoomService(config);
        return this.providers.zoom;

      case 'google_meet':
        this.providers.google_meet = new GoogleMeetService(config);
        return this.providers.google_meet;

      case 'webex':
        this.providers.webex = new WebexService(config);
        return this.providers.webex;

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
   * Create a meeting using the specified or default provider
   */
  async createMeeting(sessionData, providerType = null) {
    try {
      // If no provider specified, use the active one
      if (!providerType) {
        const activeProvider = await this.getActiveProvider();
        if (!activeProvider.is_enabled) {
          // Fall back to default MedFlow meeting
          return this.createDefaultMeeting(sessionData);
        }
        providerType = activeProvider.provider_type;
      }

      const provider = await this.getProvider(providerType);
      return await provider.createMeeting(sessionData);
    } catch (error) {
      console.error('Error creating telehealth meeting:', error);
      // Fall back to default if provider fails
      return this.createDefaultMeeting(sessionData);
    }
  }

  /**
   * Create a default MedFlow meeting (fallback)
   */
  createDefaultMeeting(sessionData) {
    const crypto = require('crypto');
    const roomId = `room-${crypto.randomBytes(16).toString('hex')}`;

    return {
      success: true,
      meetingId: roomId,
      meetingUrl: `https://meet.medflow.com/${roomId}`,
      roomId: roomId,
      provider: 'medflow'
    };
  }

  /**
   * Get meeting details
   */
  async getMeeting(meetingId, providerType) {
    try {
      if (providerType === 'medflow') {
        return {
          success: true,
          meeting: {
            id: meetingId,
            provider: 'medflow'
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
      if (providerType === 'medflow') {
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
      if (providerType === 'medflow') {
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
