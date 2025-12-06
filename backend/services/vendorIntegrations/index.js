/**
 * Vendor Integration Manager
 * Central manager for all healthcare vendor integrations
 * Handles Surescripts (ePrescribe), Labcorp (Lab Orders), and Optum (Clearinghouse)
 */

const SurescriptsService = require('./surescriptsService');
const LabcorpService = require('./labcorpService');
const OptumService = require('./optumService');
const pool = require('../../db');

class VendorIntegrationManager {
  constructor() {
    this.vendors = {
      surescripts: null,
      labcorp: null,
      optum: null
    };
    this.initialized = false;
  }

  /**
   * Initialize all vendor integrations from database settings
   */
  async initialize() {
    try {
      const result = await pool.query(
        'SELECT * FROM vendor_integration_settings WHERE is_enabled = true'
      );

      for (const settings of result.rows) {
        await this.initializeVendor(settings.vendor_type, settings);
      }

      this.initialized = true;
      console.log('Vendor integrations initialized successfully');
    } catch (error) {
      console.error('Error initializing vendor integrations:', error);
      throw error;
    }
  }

  /**
   * Initialize a specific vendor
   * @param {string} vendorType - Type of vendor (surescripts, labcorp, optum)
   * @param {Object} settings - Vendor settings from database
   */
  async initializeVendor(vendorType, settings) {
    try {
      switch (vendorType.toLowerCase()) {
        case 'surescripts':
          this.vendors.surescripts = new SurescriptsService(settings);
          break;
        case 'labcorp':
          this.vendors.labcorp = new LabcorpService(settings);
          break;
        case 'optum':
          this.vendors.optum = new OptumService(settings);
          break;
        default:
          console.warn(`Unknown vendor type: ${vendorType}`);
      }
    } catch (error) {
      console.error(`Error initializing ${vendorType}:`, error);
      throw error;
    }
  }

  /**
   * Get vendor instance
   * @param {string} vendorType - Type of vendor
   * @returns {Object} Vendor service instance
   */
  getVendor(vendorType) {
    if (!this.initialized) {
      throw new Error('Vendor integrations not initialized. Call initialize() first.');
    }

    const vendor = this.vendors[vendorType.toLowerCase()];
    if (!vendor) {
      throw new Error(`Vendor ${vendorType} not found or not enabled`);
    }

    return vendor;
  }

  /**
   * Get Surescripts service instance
   */
  getSurescripts() {
    return this.getVendor('surescripts');
  }

  /**
   * Get Labcorp service instance
   */
  getLabcorp() {
    return this.getVendor('labcorp');
  }

  /**
   * Get Optum service instance
   */
  getOptum() {
    return this.getVendor('optum');
  }

  /**
   * Check if a vendor is enabled and configured
   * @param {string} vendorType - Type of vendor
   */
  isVendorEnabled(vendorType) {
    try {
      const vendor = this.vendors[vendorType.toLowerCase()];
      return vendor && vendor.isConfigured();
    } catch (error) {
      return false;
    }
  }

  /**
   * Reload vendor settings from database
   * @param {string} vendorType - Type of vendor to reload (optional, reloads all if not specified)
   */
  async reloadVendorSettings(vendorType = null) {
    try {
      let query = 'SELECT * FROM vendor_integration_settings';
      const params = [];

      if (vendorType) {
        query += ' WHERE vendor_type = $1';
        params.push(vendorType);
      }

      const result = await pool.query(query, params);

      for (const settings of result.rows) {
        await this.initializeVendor(settings.vendor_type, settings);
      }

      console.log(`Vendor settings reloaded for ${vendorType || 'all vendors'}`);
    } catch (error) {
      console.error('Error reloading vendor settings:', error);
      throw error;
    }
  }

  /**
   * Log vendor transaction to database
   * @param {string} vendorType - Type of vendor
   * @param {string} transactionType - Type of transaction
   * @param {Object} details - Transaction details
   */
  async logTransaction(vendorType, transactionType, details) {
    try {
      const query = `
        INSERT INTO vendor_transaction_log
        (vendor_type, transaction_type, request_data, response_data, status, error_message,
         external_id, internal_reference_id, patient_id, completed_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id
      `;

      const values = [
        vendorType,
        transactionType,
        JSON.stringify(details.request || {}),
        JSON.stringify(details.response || {}),
        details.status || 'completed',
        details.error || null,
        details.externalId || null,
        details.internalReferenceId || null,
        details.patientId || null,
        details.completedAt || new Date()
      ];

      const result = await pool.query(query, values);
      return result.rows[0].id;
    } catch (error) {
      console.error('Error logging vendor transaction:', error);
      // Don't throw - logging failures shouldn't break the main flow
      return null;
    }
  }

  /**
   * Get transaction history for a specific reference
   * @param {string} internalReferenceId - Internal reference ID (prescription_id, claim_id, etc.)
   */
  async getTransactionHistory(internalReferenceId) {
    try {
      const query = `
        SELECT * FROM vendor_transaction_log
        WHERE internal_reference_id = $1
        ORDER BY created_at DESC
      `;

      const result = await pool.query(query, [internalReferenceId]);
      return result.rows;
    } catch (error) {
      console.error('Error getting transaction history:', error);
      return [];
    }
  }

  /**
   * Get all vendor statuses
   */
  getVendorStatuses() {
    return {
      surescripts: {
        enabled: this.isVendorEnabled('surescripts'),
        configured: this.vendors.surescripts?.isConfigured() || false
      },
      labcorp: {
        enabled: this.isVendorEnabled('labcorp'),
        configured: this.vendors.labcorp?.isConfigured() || false
      },
      optum: {
        enabled: this.isVendorEnabled('optum'),
        configured: this.vendors.optum?.isConfigured() || false
      }
    };
  }
}

// Create singleton instance
const vendorIntegrationManager = new VendorIntegrationManager();

module.exports = vendorIntegrationManager;
