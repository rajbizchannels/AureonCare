const express = require('express');
const router = express.Router();
const vendorIntegrationManager = require('../services/vendorIntegrations');

/**
 * Lab Orders API
 * Manages laboratory test orders with Labcorp integration
 */

// Get all lab orders with optional filters
router.get('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { patient_id, provider_id, status } = req.query;

    let query = 'SELECT * FROM lab_orders WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (patient_id) {
      query += ` AND patient_id = $${paramCount}`;
      params.push(patient_id);
      paramCount++;
    }

    if (provider_id) {
      query += ` AND provider_id = $${paramCount}`;
      params.push(provider_id);
      paramCount++;
    }

    if (status) {
      query += ` AND status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);

    // Fetch patient and provider names for each order
    for (const order of result.rows) {
      const patientResult = await pool.query(
        'SELECT first_name, last_name FROM users WHERE id = $1',
        [order.patient_id]
      );
      const providerResult = await pool.query(
        'SELECT first_name, last_name FROM users WHERE id = $1',
        [order.provider_id]
      );

      if (patientResult.rows.length > 0) {
        order.patient_name = `${patientResult.rows[0].first_name} ${patientResult.rows[0].last_name}`;
      }
      if (providerResult.rows.length > 0) {
        order.provider_name = `${providerResult.rows[0].first_name} ${providerResult.rows[0].last_name}`;
      }
    }

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching lab orders:', error);
    res.status(500).json({ error: 'Failed to fetch lab orders' });
  }
});

// Get single lab order
router.get('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { id } = req.params;

    const result = await pool.query(
      'SELECT * FROM lab_orders WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lab order not found' });
    }

    const order = result.rows[0];

    // Fetch patient and provider details
    const patientResult = await pool.query(
      'SELECT first_name, last_name, email, phone FROM users WHERE id = $1',
      [order.patient_id]
    );
    const providerResult = await pool.query(
      'SELECT first_name, last_name, email FROM users WHERE id = $1',
      [order.provider_id]
    );

    if (patientResult.rows.length > 0) {
      order.patient = patientResult.rows[0];
    }
    if (providerResult.rows.length > 0) {
      order.provider = providerResult.rows[0];
    }

    res.json(order);
  } catch (error) {
    console.error('Error fetching lab order:', error);
    res.status(500).json({ error: 'Failed to fetch lab order' });
  }
});

// Create new lab order
router.post('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const {
      patient_id,
      provider_id,
      laboratory_id,
      order_type,
      priority,
      diagnosis_codes,
      test_codes,
      clinical_notes,
      special_instructions,
      specimen_type,
      collection_date,
      order_status,
      order_status_date,
      frequency,
      collection_class,
      result_recipients,
      send_to_vendor
    } = req.body;

    // Generate order number
    const orderNumber = `LO-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Check if new columns exist, if not add them
    try {
      await pool.query(`
        ALTER TABLE lab_orders
        ADD COLUMN IF NOT EXISTS laboratory_id UUID REFERENCES laboratories(id),
        ADD COLUMN IF NOT EXISTS order_status VARCHAR(20) DEFAULT 'one-time',
        ADD COLUMN IF NOT EXISTS order_status_date DATE,
        ADD COLUMN IF NOT EXISTS frequency VARCHAR(20),
        ADD COLUMN IF NOT EXISTS collection_class VARCHAR(20) DEFAULT 'clinic-collect',
        ADD COLUMN IF NOT EXISTS result_recipients VARCHAR(50) DEFAULT 'doctors'
      `);
    } catch (err) {
      // Column might already exist, continue
      console.log('Lab orders table columns already exist or error:', err.message);
    }

    // Insert lab order
    const result = await pool.query(`
      INSERT INTO lab_orders (
        patient_id,
        provider_id,
        laboratory_id,
        order_number,
        order_type,
        priority,
        status,
        diagnosis_codes,
        test_codes,
        clinical_notes,
        special_instructions,
        specimen_type,
        collection_date,
        order_status,
        order_status_date,
        frequency,
        collection_class,
        result_recipients
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *
    `, [
      patient_id,
      provider_id,
      laboratory_id || null,
      orderNumber,
      order_type || 'lab_test',
      priority || 'routine',
      'pending',
      JSON.stringify(diagnosis_codes || []),
      JSON.stringify(test_codes || []),
      clinical_notes,
      special_instructions,
      specimen_type,
      collection_date,
      order_status || 'one-time',
      order_status_date || null,
      frequency || null,
      collection_class || 'clinic-collect',
      result_recipients || 'doctors'
    ]);

    const labOrder = result.rows[0];

    // Send to Labcorp if requested and integration is enabled
    if (send_to_vendor && vendorIntegrationManager.isVendorEnabled('labcorp')) {
      try {
        // Fetch full patient and provider details
        const patientResult = await pool.query(
          'SELECT * FROM users WHERE id = $1',
          [patient_id]
        );
        const providerResult = await pool.query(
          'SELECT * FROM users WHERE id = $1',
          [provider_id]
        );

        const labcorp = vendorIntegrationManager.getLabcorp();

        const vendorOrder = {
          ...labOrder,
          patient: patientResult.rows[0],
          provider: providerResult.rows[0]
        };

        const vendorResponse = await labcorp.submitLabOrder(vendorOrder);

        if (vendorResponse.success) {
          // Update order with vendor information
          await pool.query(`
            UPDATE lab_orders
            SET
              vendor_order_id = $1,
              vendor_status = $2,
              sent_to_vendor_at = $3,
              vendor_response = $4,
              status = 'sent_to_lab'
            WHERE id = $5
          `, [
            vendorResponse.vendorOrderId,
            vendorResponse.status,
            vendorResponse.submittedAt,
            JSON.stringify(vendorResponse.response),
            labOrder.id
          ]);

          labOrder.vendor_order_id = vendorResponse.vendorOrderId;
          labOrder.vendor_status = vendorResponse.status;
          labOrder.status = 'sent_to_lab';

          // Log transaction
          await vendorIntegrationManager.logTransaction('labcorp', 'lab_order_submit', {
            request: vendorOrder,
            response: vendorResponse.response,
            status: 'success',
            externalId: vendorResponse.vendorOrderId,
            internalReferenceId: labOrder.id,
            patientId: patient_id
          });
        } else {
          // Log failed transaction
          await vendorIntegrationManager.logTransaction('labcorp', 'lab_order_submit', {
            request: vendorOrder,
            response: vendorResponse.response,
            status: 'failed',
            error: vendorResponse.error,
            internalReferenceId: labOrder.id,
            patientId: patient_id
          });

          labOrder.vendor_error = vendorResponse.error;
        }
      } catch (vendorError) {
        console.error('Error sending to Labcorp:', vendorError);
        labOrder.vendor_error = vendorError.message;
      }
    }

    res.status(201).json(labOrder);
  } catch (error) {
    console.error('Error creating lab order:', error);
    res.status(500).json({ error: 'Failed to create lab order' });
  }
});

// Update lab order
router.put('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { id } = req.params;
    const {
      status,
      priority,
      laboratory_id,
      diagnosis_codes,
      test_codes,
      clinical_notes,
      special_instructions,
      order_status,
      order_status_date,
      frequency,
      collection_class,
      result_recipients,
      results_data,
      results_reviewed_by
    } = req.body;

    const result = await pool.query(`
      UPDATE lab_orders
      SET
        status = COALESCE($1, status),
        priority = COALESCE($2, priority),
        laboratory_id = COALESCE($3, laboratory_id),
        diagnosis_codes = COALESCE($4, diagnosis_codes),
        test_codes = COALESCE($5, test_codes),
        clinical_notes = COALESCE($6, clinical_notes),
        special_instructions = COALESCE($7, special_instructions),
        order_status = COALESCE($8, order_status),
        order_status_date = COALESCE($9, order_status_date),
        frequency = COALESCE($10, frequency),
        collection_class = COALESCE($11, collection_class),
        result_recipients = COALESCE($12, result_recipients),
        results_data = COALESCE($13, results_data),
        results_received_at = CASE WHEN $13 IS NOT NULL THEN CURRENT_TIMESTAMP ELSE results_received_at END,
        results_reviewed_by = COALESCE($14, results_reviewed_by),
        results_reviewed_at = CASE WHEN $14 IS NOT NULL THEN CURRENT_TIMESTAMP ELSE results_reviewed_at END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $15
      RETURNING *
    `, [
      status,
      priority,
      laboratory_id,
      diagnosis_codes ? JSON.stringify(diagnosis_codes) : null,
      test_codes ? JSON.stringify(test_codes) : null,
      clinical_notes,
      special_instructions,
      order_status,
      order_status_date,
      frequency,
      collection_class,
      result_recipients,
      results_data ? JSON.stringify(results_data) : null,
      results_reviewed_by,
      id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lab order not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating lab order:', error);
    res.status(500).json({ error: 'Failed to update lab order' });
  }
});

// Cancel lab order
router.delete('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { id } = req.params;

    // Get order details
    const orderResult = await pool.query(
      'SELECT * FROM lab_orders WHERE id = $1',
      [id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Lab order not found' });
    }

    const order = orderResult.rows[0];

    // If order was sent to vendor, try to cancel it
    if (order.vendor_order_id && vendorIntegrationManager.isVendorEnabled('labcorp')) {
      try {
        const labcorp = vendorIntegrationManager.getLabcorp();
        await labcorp.cancelLabOrder(order.vendor_order_id, {
          reason: req.body.reason || 'Cancelled by provider'
        });
      } catch (vendorError) {
        console.error('Error cancelling with Labcorp:', vendorError);
        // Continue with local cancellation even if vendor cancellation fails
      }
    }

    // Update status to cancelled
    await pool.query(
      'UPDATE lab_orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['cancelled', id]
    );

    res.json({ message: 'Lab order cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling lab order:', error);
    res.status(500).json({ error: 'Failed to cancel lab order' });
  }
});

// Get lab results for an order
router.get('/:id/results', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { id } = req.params;

    // Get order
    const orderResult = await pool.query(
      'SELECT * FROM lab_orders WHERE id = $1',
      [id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Lab order not found' });
    }

    const order = orderResult.rows[0];

    // If order has vendor ID and Labcorp is enabled, fetch latest results
    if (order.vendor_order_id && vendorIntegrationManager.isVendorEnabled('labcorp')) {
      try {
        const labcorp = vendorIntegrationManager.getLabcorp();
        const vendorResults = await labcorp.getLabResults(order.vendor_order_id);

        if (vendorResults.success && vendorResults.results) {
          // Update local results
          await pool.query(`
            UPDATE lab_orders
            SET
              results_data = $1,
              results_received_at = CURRENT_TIMESTAMP,
              vendor_status = $2,
              status = 'completed',
              updated_at = CURRENT_TIMESTAMP
            WHERE id = $3
          `, [
            JSON.stringify(vendorResults.results),
            vendorResults.status,
            id
          ]);

          order.results_data = vendorResults.results;
          order.status = 'completed';
        }
      } catch (vendorError) {
        console.error('Error fetching results from Labcorp:', vendorError);
      }
    }

    res.json({
      order_id: order.id,
      order_number: order.order_number,
      status: order.status,
      results: order.results_data,
      received_at: order.results_received_at,
      reviewed_by: order.results_reviewed_by,
      reviewed_at: order.results_reviewed_at
    });
  } catch (error) {
    console.error('Error fetching lab results:', error);
    res.status(500).json({ error: 'Failed to fetch lab results' });
  }
});

module.exports = router;
