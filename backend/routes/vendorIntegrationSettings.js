const express = require('express');
const router = express.Router();
const vendorIntegrationManager = require('../services/vendorIntegrations');

/**
 * Vendor Integration Settings API
 * Manages configuration for Surescripts, Labcorp, and Optum integrations
 */

// Get all vendor integration settings
router.get('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(`
      SELECT * FROM vendor_integration_settings
      ORDER BY vendor_type
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching vendor integration settings:', error);
    // Check if the error is due to missing table
    if (error.code === '42P01') {
      return res.status(503).json({
        error: 'Vendor integration settings table does not exist. Please run database migration.',
        hint: 'Run migration: 033_add_vendor_integrations.sql'
      });
    }
    res.status(500).json({ error: 'Failed to fetch vendor integration settings' });
  }
});

// Get single vendor settings
router.get('/:vendorType', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { vendorType } = req.params;

    const result = await pool.query(
      'SELECT * FROM vendor_integration_settings WHERE vendor_type = $1',
      [vendorType]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vendor settings not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching vendor settings:', error);
    res.status(500).json({ error: 'Failed to fetch vendor settings' });
  }
});

// Create or update vendor settings
router.post('/:vendorType', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { vendorType } = req.params;
    const {
      is_enabled,
      api_key,
      api_secret,
      client_id,
      client_secret,
      username,
      password,
      base_url,
      sandbox_mode,
      settings
    } = req.body;

    // Check if vendor settings already exist
    const existing = await pool.query(
      'SELECT id FROM vendor_integration_settings WHERE vendor_type = $1',
      [vendorType]
    );

    let result;
    if (existing.rows.length > 0) {
      // Update existing
      result = await pool.query(`
        UPDATE vendor_integration_settings
        SET
          is_enabled = COALESCE($1, is_enabled),
          api_key = COALESCE($2, api_key),
          api_secret = COALESCE($3, api_secret),
          client_id = COALESCE($4, client_id),
          client_secret = COALESCE($5, client_secret),
          username = COALESCE($6, username),
          password = COALESCE($7, password),
          base_url = COALESCE($8, base_url),
          sandbox_mode = COALESCE($9, sandbox_mode),
          settings = COALESCE($10, settings),
          updated_at = CURRENT_TIMESTAMP
        WHERE vendor_type = $11
        RETURNING *
      `, [is_enabled, api_key, api_secret, client_id, client_secret, username, password,
          base_url, sandbox_mode, JSON.stringify(settings), vendorType]);
    } else {
      // Insert new
      result = await pool.query(`
        INSERT INTO vendor_integration_settings (
          vendor_type,
          is_enabled,
          api_key,
          api_secret,
          client_id,
          client_secret,
          username,
          password,
          base_url,
          sandbox_mode,
          settings
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `, [vendorType, is_enabled || false, api_key, api_secret,
          client_id, client_secret, username, password, base_url,
          sandbox_mode !== undefined ? sandbox_mode : true,
          JSON.stringify(settings || {})]);
    }

    // Reload vendor settings in the manager
    await vendorIntegrationManager.reloadVendorSettings(vendorType);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error saving vendor settings:', error);
    res.status(500).json({ error: 'Failed to save vendor settings' });
  }
});

// Delete vendor settings
router.delete('/:vendorType', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { vendorType } = req.params;

    const result = await pool.query(
      'DELETE FROM vendor_integration_settings WHERE vendor_type = $1 RETURNING id',
      [vendorType]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vendor settings not found' });
    }

    // Reload vendor settings in the manager
    await vendorIntegrationManager.reloadVendorSettings();

    res.json({ message: 'Vendor settings deleted successfully' });
  } catch (error) {
    console.error('Error deleting vendor settings:', error);
    res.status(500).json({ error: 'Failed to delete vendor settings' });
  }
});

// Toggle vendor enabled status
router.patch('/:vendorType/toggle', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { vendorType } = req.params;
    const { is_enabled } = req.body;

    // Check if vendor settings exist
    const existing = await pool.query(
      'SELECT id FROM vendor_integration_settings WHERE vendor_type = $1',
      [vendorType]
    );

    let result;
    if (existing.rows.length > 0) {
      // Update existing record
      result = await pool.query(`
        UPDATE vendor_integration_settings
        SET is_enabled = $1, updated_at = CURRENT_TIMESTAMP
        WHERE vendor_type = $2
        RETURNING *
      `, [is_enabled, vendorType]);
    } else {
      // Create new record with just is_enabled set
      result = await pool.query(`
        INSERT INTO vendor_integration_settings (vendor_type, is_enabled)
        VALUES ($1, $2)
        RETURNING *
      `, [vendorType, is_enabled]);
    }

    // Reload vendor settings in the manager
    await vendorIntegrationManager.reloadVendorSettings(vendorType);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error toggling vendor status:', error);
    res.status(500).json({ error: 'Failed to toggle vendor status' });
  }
});

// Get all vendor statuses
router.get('/status/all', async (req, res) => {
  try {
    const statuses = vendorIntegrationManager.getVendorStatuses();
    res.json(statuses);
  } catch (error) {
    console.error('Error fetching vendor statuses:', error);
    res.status(500).json({ error: 'Failed to fetch vendor statuses' });
  }
});

// Test vendor connection
router.post('/:vendorType/test', async (req, res) => {
  try {
    const { vendorType } = req.params;
    const pool = req.app.locals.pool;

    // Get vendor settings
    const settingsResult = await pool.query(
      'SELECT * FROM vendor_integration_settings WHERE vendor_type = $1',
      [vendorType]
    );

    if (settingsResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Vendor settings not found'
      });
    }

    // Reload vendor with current settings
    await vendorIntegrationManager.reloadVendorSettings(vendorType);

    // Get vendor instance
    const vendor = vendorIntegrationManager.getVendor(vendorType);

    // Test connection
    const testResult = await vendor.testConnection();

    // Update test status in database
    await pool.query(`
      UPDATE vendor_integration_settings
      SET
        last_tested_at = CURRENT_TIMESTAMP,
        test_status = $1,
        test_message = $2
      WHERE vendor_type = $3
    `, [
      testResult.success ? 'success' : 'failed',
      testResult.message,
      vendorType
    ]);

    res.json(testResult);
  } catch (error) {
    console.error('Error testing vendor connection:', error);

    // Update test status in database
    const pool = req.app.locals.pool;
    await pool.query(`
      UPDATE vendor_integration_settings
      SET
        last_tested_at = CURRENT_TIMESTAMP,
        test_status = 'failed',
        test_message = $1
      WHERE vendor_type = $2
    `, [error.message, req.params.vendorType]);

    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Get transaction history for a reference
router.get('/transactions/:internalReferenceId', async (req, res) => {
  try {
    const { internalReferenceId } = req.params;
    const transactions = await vendorIntegrationManager.getTransactionHistory(internalReferenceId);
    res.json(transactions);
  } catch (error) {
    console.error('Error fetching transaction history:', error);
    res.status(500).json({ error: 'Failed to fetch transaction history' });
  }
});

module.exports = router;
