/**
 * Optum Clearinghouse Service
 * Handles medical claims submission and eligibility verification
 * Documentation: https://www.optum.com/business/resources/clearinghouse.html
 */

const axios = require('axios');
const crypto = require('crypto');

class OptumService {
  constructor(config = {}) {
    this.config = config;
    this.baseUrl = config.sandbox_mode
      ? 'https://sandbox.optuminsight.com'
      : 'https://api.optuminsight.com';

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
    this.submitterId = this.settings.submitter_id || '';
    this.receiverId = this.settings.receiver_id || '';
    this.tradingPartnerId = this.settings.trading_partner_id || '';

    // Token management
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  /**
   * Test connection to Optum API
   */
  async testConnection() {
    try {
      if (!this.isEnabled) {
        throw new Error('Optum integration is not enabled');
      }

      if (!this.clientId || !this.clientSecret) {
        throw new Error('Optum credentials not configured');
      }

      // Authenticate and test connection
      await this.authenticate();

      // Test with a simple ping
      const response = await this.makeRequest('/v1/ping', 'GET');

      return {
        success: true,
        message: 'Successfully connected to Optum Clearinghouse',
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
   * Authenticate with Optum API and get access token
   * @private
   */
  async authenticate() {
    try {
      // Check if we have a valid token
      if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
        return this.accessToken;
      }

      // Request new token using OAuth2 client credentials flow
      const tokenUrl = `${this.baseUrl}/oauth2/token`;
      const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

      const response = await axios.post(
        tokenUrl,
        'grant_type=client_credentials',
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
      console.error('Optum authentication error:', error);
      throw new Error('Failed to authenticate with Optum');
    }
  }

  /**
   * Submit claim to Optum clearinghouse
   * @param {Object} claim - Claim details
   */
  async submitClaim(claim) {
    try {
      if (!this.isEnabled) {
        throw new Error('Optum integration is not enabled');
      }

      await this.authenticate();

      // Build X12 837 or FHIR claim
      const claimPayload = this.buildClaimPayload(claim);

      // Submit to Optum
      const response = await this.makeRequest('/v1/claims', 'POST', claimPayload);

      return {
        success: true,
        clearinghouseClaimId: response.data.claimId || response.data.controlNumber,
        status: 'submitted',
        response: response.data,
        submittedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Optum submitClaim error:', error);

      return {
        success: false,
        status: 'failed',
        error: error.message,
        response: error.response?.data || null
      };
    }
  }

  /**
   * Get claim status
   * @param {string} clearinghouseClaimId - Optum claim ID
   */
  async getClaimStatus(clearinghouseClaimId) {
    try {
      if (!this.isEnabled) {
        throw new Error('Optum integration is not enabled');
      }

      await this.authenticate();

      const response = await this.makeRequest(`/v1/claims/${clearinghouseClaimId}/status`, 'GET');

      return {
        success: true,
        status: response.data.status,
        payerStatus: response.data.payerStatus,
        data: response.data
      };
    } catch (error) {
      console.error('Optum getClaimStatus error:', error);

      return {
        success: false,
        error: error.message,
        response: error.response?.data || null
      };
    }
  }

  /**
   * Get claim remittance (835) response
   * @param {string} clearinghouseClaimId - Optum claim ID
   */
  async getClaimRemittance(clearinghouseClaimId) {
    try {
      if (!this.isEnabled) {
        throw new Error('Optum integration is not enabled');
      }

      await this.authenticate();

      const response = await this.makeRequest(`/v1/claims/${clearinghouseClaimId}/remittance`, 'GET');

      return {
        success: true,
        remittance: response.data,
        paymentAmount: response.data.paymentAmount,
        adjustments: response.data.adjustments || []
      };
    } catch (error) {
      console.error('Optum getClaimRemittance error:', error);

      return {
        success: false,
        error: error.message,
        response: error.response?.data || null
      };
    }
  }

  /**
   * Verify patient eligibility
   * @param {Object} eligibilityRequest - Eligibility request details
   */
  async verifyEligibility(eligibilityRequest) {
    try {
      if (!this.isEnabled) {
        throw new Error('Optum integration is not enabled');
      }

      await this.authenticate();

      const payload = this.buildEligibilityPayload(eligibilityRequest);
      const response = await this.makeRequest('/v1/eligibility', 'POST', payload);

      return {
        success: true,
        eligible: response.data.eligible,
        coverageDetails: response.data.coverage,
        data: response.data
      };
    } catch (error) {
      console.error('Optum verifyEligibility error:', error);

      return {
        success: false,
        error: error.message,
        response: error.response?.data || null
      };
    }
  }

  /**
   * Void/cancel a submitted claim
   * @param {string} clearinghouseClaimId - Optum claim ID
   * @param {Object} details - Cancellation details
   */
  async voidClaim(clearinghouseClaimId, details = {}) {
    try {
      if (!this.isEnabled) {
        throw new Error('Optum integration is not enabled');
      }

      await this.authenticate();

      const response = await this.makeRequest(
        `/v1/claims/${clearinghouseClaimId}/void`,
        'POST',
        {
          reason: details.reason || 'Requested by provider',
          notes: details.notes || ''
        }
      );

      return {
        success: true,
        status: 'voided',
        response: response.data
      };
    } catch (error) {
      console.error('Optum voidClaim error:', error);

      return {
        success: false,
        error: error.message,
        response: error.response?.data || null
      };
    }
  }

  /**
   * Build claim payload in X12 837 or FHIR format
   * @private
   */
  buildClaimPayload(claim) {
    return {
      resourceType: 'Claim',
      status: 'active',
      type: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/claim-type',
          code: claim.claim_type || 'professional'
        }]
      },
      use: 'claim',

      // Patient information
      patient: {
        reference: `Patient/${claim.patient_id}`,
        display: claim.patient?.full_name || ''
      },

      // Service date
      billablePeriod: {
        start: claim.service_date,
        end: claim.service_date_end || claim.service_date
      },

      // Provider information
      provider: {
        reference: `Practitioner/${claim.provider_id}`,
        identifier: {
          system: 'http://hl7.org/fhir/sid/us-npi',
          value: claim.provider?.npi || ''
        }
      },

      // Insurer/Payer
      insurer: {
        reference: `Organization/${claim.payer_id}`,
        identifier: {
          system: 'http://hl7.org/fhir/sid/us-npi',
          value: claim.payer?.payer_id || ''
        }
      },

      // Priority
      priority: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/processpriority',
          code: 'normal'
        }]
      },

      // Diagnosis codes
      diagnosis: (claim.diagnosis_codes || []).map((dx, index) => ({
        sequence: index + 1,
        diagnosisCodeableConcept: {
          coding: [{
            system: 'http://hl7.org/fhir/sid/icd-10',
            code: dx.code,
            display: dx.display || ''
          }]
        }
      })),

      // Procedure/Service lines
      item: (claim.procedure_codes || []).map((proc, index) => ({
        sequence: index + 1,
        productOrService: {
          coding: [{
            system: 'http://www.ama-assn.org/go/cpt',
            code: proc.code,
            display: proc.display || ''
          }]
        },
        servicedDate: claim.service_date,
        quantity: {
          value: proc.quantity || 1
        },
        unitPrice: {
          value: proc.charge || 0,
          currency: 'USD'
        },
        net: {
          value: (proc.quantity || 1) * (proc.charge || 0),
          currency: 'USD'
        }
      })),

      // Total claim amount
      total: {
        value: claim.claim_amount || 0,
        currency: 'USD'
      },

      // Clearinghouse metadata
      meta: {
        submitterId: this.submitterId,
        receiverId: this.receiverId,
        tradingPartnerId: this.tradingPartnerId
      }
    };
  }

  /**
   * Build eligibility verification payload
   * @private
   */
  buildEligibilityPayload(request) {
    return {
      resourceType: 'CoverageEligibilityRequest',
      status: 'active',
      purpose: ['validation'],

      // Patient
      patient: {
        reference: `Patient/${request.patient_id}`,
        identifier: {
          type: {
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
              code: 'MB' // Member number
            }]
          },
          value: request.member_id || ''
        }
      },

      // Service date
      servicedDate: request.service_date || new Date().toISOString().split('T')[0],

      // Insurer
      insurer: {
        reference: `Organization/${request.payer_id}`,
        identifier: {
          value: request.payer?.payer_id || ''
        }
      },

      // Provider
      provider: {
        reference: `Practitioner/${request.provider_id}`
      }
    };
  }

  /**
   * Make authenticated request to Optum API
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
      console.error('Optum API error:', error.response?.data || error.message);
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

module.exports = OptumService;
