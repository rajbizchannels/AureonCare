/**
 * Labcorp Laboratory Integration Service
 * Handles lab test orders and results retrieval via Labcorp API
 * Documentation: https://developer.labcorp.com/
 */

const axios = require('axios');
const crypto = require('crypto');

class LabcorpService {
  constructor(config = {}) {
    this.config = config;
    this.baseUrl = config.sandbox_mode
      ? 'https://sandbox-api.labcorp.com'
      : 'https://api.labcorp.com';

    // Override with custom base_url if provided
    if (config.base_url) {
      this.baseUrl = config.base_url;
    }

    this.apiKey = config.api_key;
    this.apiSecret = config.api_secret;
    this.clientId = config.client_id;
    this.clientSecret = config.client_secret;
    this.username = config.username;
    this.password = config.password;
    this.isEnabled = config.is_enabled || false;

    // Additional settings
    this.settings = config.settings || {};
    this.accountNumber = this.settings.account_number || '';
    this.facilityId = this.settings.facility_id || '';

    // Token management
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  /**
   * Test connection to Labcorp API
   */
  async testConnection() {
    try {
      if (!this.isEnabled) {
        throw new Error('Labcorp integration is not enabled');
      }

      if (!this.clientId || !this.clientSecret) {
        throw new Error('Labcorp credentials not configured');
      }

      // Authenticate and test connection
      await this.authenticate();

      // Test with a simple status check
      const response = await this.makeRequest('/v1/health', 'GET');

      return {
        success: true,
        message: 'Successfully connected to Labcorp',
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
   * Authenticate with Labcorp API and get access token
   * @private
   */
  async authenticate() {
    try {
      // Check if we have a valid token
      if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
        return this.accessToken;
      }

      // Request new token using OAuth2 client credentials flow
      const tokenUrl = `${this.baseUrl}/oauth/token`;
      const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

      const response = await axios.post(
        tokenUrl,
        'grant_type=client_credentials&scope=api',
        {
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      this.accessToken = response.data.access_token;
      // Set expiry to 5 minutes before actual expiry for safety
      this.tokenExpiry = Date.now() + ((response.data.expires_in - 300) * 1000);

      return this.accessToken;
    } catch (error) {
      console.error('Labcorp authentication error:', error);
      throw new Error('Failed to authenticate with Labcorp');
    }
  }

  /**
   * Submit lab order to Labcorp
   * @param {Object} labOrder - Lab order details
   */
  async submitLabOrder(labOrder) {
    try {
      if (!this.isEnabled) {
        throw new Error('Labcorp integration is not enabled');
      }

      await this.authenticate();

      // Build HL7 or FHIR order message
      const orderPayload = this.buildLabOrderPayload(labOrder);

      // Submit to Labcorp
      const response = await this.makeRequest('/v1/orders', 'POST', orderPayload);

      return {
        success: true,
        vendorOrderId: response.data.orderId || response.data.accessionNumber,
        status: 'submitted',
        response: response.data,
        submittedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Labcorp submitLabOrder error:', error);

      return {
        success: false,
        status: 'failed',
        error: error.message,
        response: error.response?.data || null
      };
    }
  }

  /**
   * Get lab order status
   * @param {string} vendorOrderId - Labcorp order ID
   */
  async getLabOrderStatus(vendorOrderId) {
    try {
      if (!this.isEnabled) {
        throw new Error('Labcorp integration is not enabled');
      }

      await this.authenticate();

      const response = await this.makeRequest(`/v1/orders/${vendorOrderId}`, 'GET');

      return {
        success: true,
        status: response.data.status,
        data: response.data
      };
    } catch (error) {
      console.error('Labcorp getLabOrderStatus error:', error);

      return {
        success: false,
        error: error.message,
        response: error.response?.data || null
      };
    }
  }

  /**
   * Get lab results
   * @param {string} vendorOrderId - Labcorp order ID
   */
  async getLabResults(vendorOrderId) {
    try {
      if (!this.isEnabled) {
        throw new Error('Labcorp integration is not enabled');
      }

      await this.authenticate();

      const response = await this.makeRequest(`/v1/orders/${vendorOrderId}/results`, 'GET');

      return {
        success: true,
        results: response.data.results || [],
        status: response.data.status,
        reportUrl: response.data.reportUrl,
        data: response.data
      };
    } catch (error) {
      console.error('Labcorp getLabResults error:', error);

      return {
        success: false,
        error: error.message,
        response: error.response?.data || null
      };
    }
  }

  /**
   * Cancel lab order
   * @param {string} vendorOrderId - Labcorp order ID
   * @param {Object} details - Cancellation details
   */
  async cancelLabOrder(vendorOrderId, details = {}) {
    try {
      if (!this.isEnabled) {
        throw new Error('Labcorp integration is not enabled');
      }

      await this.authenticate();

      const response = await this.makeRequest(
        `/v1/orders/${vendorOrderId}/cancel`,
        'POST',
        {
          reason: details.reason || 'Requested by provider',
          notes: details.notes || ''
        }
      );

      return {
        success: true,
        status: 'cancelled',
        response: response.data
      };
    } catch (error) {
      console.error('Labcorp cancelLabOrder error:', error);

      return {
        success: false,
        error: error.message,
        response: error.response?.data || null
      };
    }
  }

  /**
   * Search for available lab tests
   * @param {Object} searchParams - Search criteria
   */
  async searchLabTests(searchParams = {}) {
    try {
      if (!this.isEnabled) {
        throw new Error('Labcorp integration is not enabled');
      }

      await this.authenticate();

      const response = await this.makeRequest('/v1/tests/search', 'GET', null, {}, searchParams);

      return {
        success: true,
        tests: response.data.tests || [],
        total: response.data.total || 0
      };
    } catch (error) {
      console.error('Labcorp searchLabTests error:', error);

      return {
        success: false,
        error: error.message,
        tests: []
      };
    }
  }

  /**
   * Get test details by code (CPT or LOINC)
   * @param {string} testCode - Test code
   * @param {string} codeType - 'CPT' or 'LOINC'
   */
  async getTestDetails(testCode, codeType = 'CPT') {
    try {
      if (!this.isEnabled) {
        throw new Error('Labcorp integration is not enabled');
      }

      await this.authenticate();

      const response = await this.makeRequest(
        `/v1/tests/${testCode}`,
        'GET',
        null,
        {},
        { codeType }
      );

      return {
        success: true,
        test: response.data
      };
    } catch (error) {
      console.error('Labcorp getTestDetails error:', error);

      return {
        success: false,
        error: error.message,
        test: null
      };
    }
  }

  /**
   * Build lab order payload in FHIR format
   * @private
   */
  buildLabOrderPayload(labOrder) {
    return {
      resourceType: 'ServiceRequest',
      status: 'active',
      intent: 'order',
      priority: labOrder.priority || 'routine',

      // Patient information
      subject: {
        reference: `Patient/${labOrder.patient_id}`,
        display: labOrder.patient?.full_name || ''
      },

      // Ordering provider
      requester: {
        reference: `Practitioner/${labOrder.provider_id}`,
        display: labOrder.provider?.full_name || ''
      },

      // Tests ordered
      code: {
        coding: (labOrder.test_codes || []).map(test => ({
          system: test.system || 'http://loinc.org',
          code: test.code,
          display: test.display || ''
        })),
        text: labOrder.test_codes?.map(t => t.display).join(', ') || ''
      },

      // Clinical information
      reasonCode: (labOrder.diagnosis_codes || []).map(dx => ({
        coding: [{
          system: 'http://hl7.org/fhir/sid/icd-10',
          code: dx.code,
          display: dx.display || ''
        }]
      })),

      note: [
        {
          text: labOrder.clinical_notes || ''
        }
      ],

      // Specimen details
      specimen: labOrder.specimen_type ? [{
        type: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v2-0487',
            code: labOrder.specimen_type
          }]
        }
      }] : undefined,

      // Account information
      insurance: {
        accountNumber: this.accountNumber,
        facilityId: this.facilityId
      },

      // Collection information
      occurrence: {
        occurrenceDateTime: labOrder.collection_date || new Date().toISOString()
      }
    };
  }

  /**
   * Make authenticated request to Labcorp API
   * @private
   */
  async makeRequest(endpoint, method = 'GET', data = null, headers = {}, params = {}) {
    const url = `${this.baseUrl}${endpoint}`;

    // Ensure we're authenticated
    await this.authenticate();

    const config = {
      method,
      url,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
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
      console.error('Labcorp API error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Check if service is properly configured
   */
  isConfigured() {
    return !!(this.clientId && this.clientSecret && this.isEnabled);
  }
}

module.exports = LabcorpService;
