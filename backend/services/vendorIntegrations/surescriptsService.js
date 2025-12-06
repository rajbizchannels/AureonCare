/**
 * Surescripts ePrescribing Service
 * Handles prescription transmission to pharmacies via Surescripts network
 * Documentation: https://surescripts.com/network-connections/eprescribing/
 */

const axios = require('axios');
const crypto = require('crypto');
const xml2js = require('xml2js');

class SurescriptsService {
  constructor(config = {}) {
    this.config = config;
    this.baseUrl = config.sandbox_mode
      ? 'https://cert.surescripts.net'
      : 'https://production.surescripts.net';

    // Override with custom base_url if provided
    if (config.base_url) {
      this.baseUrl = config.base_url;
    }

    this.clientId = config.client_id;
    this.clientSecret = config.client_secret;
    this.username = config.username;
    this.password = config.password;
    this.isEnabled = config.is_enabled || false;

    // Additional settings
    this.settings = config.settings || {};
    this.spi = this.settings.spi || ''; // Surescripts Provider Identifier
    this.accountId = this.settings.account_id || '';
  }

  /**
   * Test connection to Surescripts API
   */
  async testConnection() {
    try {
      if (!this.isEnabled) {
        throw new Error('Surescripts integration is not enabled');
      }

      if (!this.clientId || !this.clientSecret) {
        throw new Error('Surescripts credentials not configured');
      }

      // Test with a simple status check
      const response = await this.makeRequest('/v1/status', 'GET');

      return {
        success: true,
        message: 'Successfully connected to Surescripts',
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        error: error.response?.data || error.message
      };
    }
  }

  /**
   * Send prescription to pharmacy via Surescripts
   * @param {Object} prescription - Prescription details
   * @returns {Object} Response from Surescripts
   */
  async sendPrescription(prescription) {
    try {
      if (!this.isEnabled) {
        throw new Error('Surescripts integration is not enabled');
      }

      // Build NCPDP SCRIPT XML message
      const xmlMessage = this.buildPrescriptionXML(prescription);

      // Send to Surescripts endpoint
      const response = await this.makeRequest('/v1/prescriptions', 'POST', xmlMessage, {
        'Content-Type': 'application/xml'
      });

      return {
        success: true,
        vendorId: response.data.messageId || response.data.prescriptionId,
        status: 'sent',
        response: response.data,
        sentAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Surescripts sendPrescription error:', error);

      return {
        success: false,
        status: 'failed',
        error: error.message,
        response: error.response?.data || null
      };
    }
  }

  /**
   * Cancel a prescription sent to Surescripts
   * @param {string} vendorPrescriptionId - Surescripts prescription ID
   * @param {Object} details - Cancellation details
   */
  async cancelPrescription(vendorPrescriptionId, details = {}) {
    try {
      if (!this.isEnabled) {
        throw new Error('Surescripts integration is not enabled');
      }

      const xmlMessage = this.buildCancellationXML(vendorPrescriptionId, details);

      const response = await this.makeRequest(
        `/v1/prescriptions/${vendorPrescriptionId}/cancel`,
        'POST',
        xmlMessage,
        { 'Content-Type': 'application/xml' }
      );

      return {
        success: true,
        status: 'cancelled',
        response: response.data
      };
    } catch (error) {
      console.error('Surescripts cancelPrescription error:', error);

      return {
        success: false,
        error: error.message,
        response: error.response?.data || null
      };
    }
  }

  /**
   * Get prescription status from Surescripts
   * @param {string} vendorPrescriptionId - Surescripts prescription ID
   */
  async getPrescriptionStatus(vendorPrescriptionId) {
    try {
      if (!this.isEnabled) {
        throw new Error('Surescripts integration is not enabled');
      }

      const response = await this.makeRequest(
        `/v1/prescriptions/${vendorPrescriptionId}/status`,
        'GET'
      );

      return {
        success: true,
        status: response.data.status,
        data: response.data
      };
    } catch (error) {
      console.error('Surescripts getPrescriptionStatus error:', error);

      return {
        success: false,
        error: error.message,
        response: error.response?.data || null
      };
    }
  }

  /**
   * Search for pharmacies via Surescripts
   * @param {Object} searchParams - Search criteria (zipCode, name, etc.)
   */
  async searchPharmacies(searchParams) {
    try {
      if (!this.isEnabled) {
        throw new Error('Surescripts integration is not enabled');
      }

      const response = await this.makeRequest('/v1/pharmacies/search', 'GET', null, {}, searchParams);

      return {
        success: true,
        pharmacies: response.data.pharmacies || [],
        total: response.data.total || 0
      };
    } catch (error) {
      console.error('Surescripts searchPharmacies error:', error);

      return {
        success: false,
        error: error.message,
        pharmacies: []
      };
    }
  }

  /**
   * Build NCPDP SCRIPT XML for prescription
   * @private
   */
  buildPrescriptionXML(prescription) {
    const builder = new xml2js.Builder({
      rootName: 'Message',
      xmldec: { version: '1.0', encoding: 'UTF-8' }
    });

    // NCPDP SCRIPT Standard format
    const messageData = {
      '$': {
        'version': '10.6',
        'release': '006'
      },
      'Header': {
        'To': prescription.pharmacy?.ncpdp_id || '',
        'From': this.spi,
        'MessageID': this.generateMessageId(),
        'SentTime': new Date().toISOString()
      },
      'Body': {
        'NewRx': {
          'Patient': {
            'Identification': {
              'PatientID': prescription.patient_id
            },
            'Name': {
              'LastName': prescription.patient?.last_name || '',
              'FirstName': prescription.patient?.first_name || ''
            },
            'DateOfBirth': prescription.patient?.date_of_birth || '',
            'Gender': prescription.patient?.gender || ''
          },
          'Prescriber': {
            'Identification': {
              'NPI': prescription.provider?.npi || '',
              'DEA': prescription.provider?.dea_number || ''
            },
            'Name': {
              'LastName': prescription.provider?.last_name || '',
              'FirstName': prescription.provider?.first_name || ''
            }
          },
          'Medication': {
            'DrugDescription': prescription.medication_name,
            'DrugCoded': {
              'ProductCode': prescription.ndc_code || '',
              'ProductCodeQualifier': 'ND'
            },
            'Quantity': {
              'Value': prescription.quantity || '',
              'Unit': prescription.quantity_unit || 'tablets'
            },
            'DaysSupply': prescription.days_supply || 30,
            'Substitutions': prescription.allow_substitutions ? '1' : '0',
            'Directions': prescription.instructions || '',
            'Refills': {
              'Quantity': prescription.refills || 0
            }
          },
          'Pharmacy': {
            'Identification': {
              'NCPDP': prescription.pharmacy?.ncpdp_id || ''
            }
          }
        }
      }
    };

    return builder.buildObject(messageData);
  }

  /**
   * Build cancellation XML message
   * @private
   */
  buildCancellationXML(vendorPrescriptionId, details) {
    const builder = new xml2js.Builder({
      rootName: 'Message',
      xmldec: { version: '1.0', encoding: 'UTF-8' }
    });

    const messageData = {
      '$': {
        'version': '10.6',
        'release': '006'
      },
      'Header': {
        'From': this.spi,
        'MessageID': this.generateMessageId(),
        'SentTime': new Date().toISOString()
      },
      'Body': {
        'CancelRx': {
          'PrescriptionReferenceNumber': vendorPrescriptionId,
          'CancellationReason': details.reason || 'Requested by prescriber'
        }
      }
    };

    return builder.buildObject(messageData);
  }

  /**
   * Make authenticated request to Surescripts API
   * @private
   */
  async makeRequest(endpoint, method = 'GET', data = null, headers = {}, params = {}) {
    const url = `${this.baseUrl}${endpoint}`;

    // Generate authentication token
    const authToken = this.generateAuthToken();

    const config = {
      method,
      url,
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...headers
      },
      params
    };

    if (data) {
      config.data = data;
    }

    try {
      const response = await axios(config);
      return response;
    } catch (error) {
      console.error('Surescripts API error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Generate authentication token for Surescripts
   * @private
   */
  generateAuthToken() {
    // In production, this would use OAuth2 or the specific auth method required by Surescripts
    // For now, using basic auth with client credentials
    const credentials = `${this.clientId}:${this.clientSecret}`;
    return Buffer.from(credentials).toString('base64');
  }

  /**
   * Generate unique message ID
   * @private
   */
  generateMessageId() {
    return `${this.accountId}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * Check if service is properly configured
   */
  isConfigured() {
    return !!(this.clientId && this.clientSecret && this.isEnabled);
  }
}

module.exports = SurescriptsService;
