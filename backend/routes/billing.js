const express = require('express');
const { authenticate } = require('../middleware/auth');
const router = express.Router();
router.use(authenticate);
router.use(require('../middleware/planEnforcement').enforceActiveBilling); // SEC-05 S11: read-only when subscription past_due/canceled

const toCamelCase = (obj) => {
  if (!obj) return obj;
  const newObj = {};
  for (const key in obj) {
    const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
    newObj[camelKey] = obj[key];
  }
  return newObj;
};

// ============================================
// QUOTES
// ============================================

// Get all quotes
router.get('/quotes', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { patient_id, status } = req.query;
    let query = `
      SELECT q.*,
        p.first_name || ' ' || p.last_name AS patient_name,
        u.first_name || ' ' || u.last_name AS provider_name
      FROM billing_quotes q
      LEFT JOIN patients p ON q.patient_id = p.id
      LEFT JOIN users u ON q.provider_id = u.id
      WHERE 1=1
    `;
    const params = [];
    if (patient_id) {
      params.push(patient_id);
      query += ` AND q.patient_id = $${params.length}`;
    }
    if (status) {
      params.push(status);
      query += ` AND q.status = $${params.length}`;
    }
    query += ' ORDER BY q.created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows.map(toCamelCase));
  } catch (error) {
    console.error('Error fetching quotes:', error);
    res.status(500).json({ error: 'Failed to fetch quotes' });
  }
});

// Get single quote with items
router.get('/quotes/:id', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const quoteResult = await pool.query(`
      SELECT q.*,
        p.first_name || ' ' || p.last_name AS patient_name,
        u.first_name || ' ' || u.last_name AS provider_name
      FROM billing_quotes q
      LEFT JOIN patients p ON q.patient_id = p.id
      LEFT JOIN users u ON q.provider_id = u.id
      WHERE q.id = $1
    `, [req.params.id]);
    if (quoteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    const itemsResult = await pool.query(
      'SELECT * FROM billing_quote_items WHERE quote_id = $1 ORDER BY sort_order',
      [req.params.id]
    );
    const quote = toCamelCase(quoteResult.rows[0]);
    quote.items = itemsResult.rows.map(toCamelCase);
    res.json(quote);
  } catch (error) {
    console.error('Error fetching quote:', error);
    res.status(500).json({ error: 'Failed to fetch quote' });
  }
});

// Create quote
router.post('/quotes', async (req, res) => {
  const { patientId, providerId, status, issueDate, expiryDate, subtotal, discountAmount, taxAmount, totalAmount, notes, terms, diagnosisIds, offeringIds, couponId, items } = req.body;
  const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
  const client = await req.app.locals.pool.connect();
  try {
    await client.query('BEGIN');
    // SEC-05: scope this transaction to the caller's tenant schema (SET LOCAL auto-reverts).
    const _schema = (req.tenant && /^[a-z_][a-z0-9_]*$/.test(req.tenant.schemaName || '')) ? req.tenant.schemaName : 'public';
    await client.query(`SET LOCAL search_path TO ${_schema}, public, control`);
    const quoteNumber = (await client.query('SELECT generate_quote_number() AS num')).rows[0].num;
    const quoteResult = await client.query(`
      INSERT INTO billing_quotes (quote_number, patient_id, provider_id, status, issue_date, expiry_date, subtotal, discount_amount, tax_amount, total_amount, notes, terms, diagnosis_ids, offering_ids, coupon_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `, [quoteNumber, patientId, providerId, status || 'draft', issueDate || new Date(), expiryDate, subtotal || 0, discountAmount || 0, taxAmount || 0, totalAmount || 0, notes, terms, diagnosisIds || [], offeringIds || [], couponId]);

    const quote = quoteResult.rows[0];
    if (items && items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        await client.query(`
          INSERT INTO billing_quote_items (quote_id, description, quantity, unit_price, discount_percent, total, offering_id, diagnosis_id, cpt_code, icd_code, sort_order)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [quote.id, item.description, item.quantity || 1, item.unitPrice, item.discountPercent || 0, item.total, item.offeringId, item.diagnosisId, item.cptCode, item.icdCode, i]);
      }
    }
    await client.query('COMMIT');

    // Fetch complete quote with joins
    const fullResult = await pool.query(`
      SELECT q.*, p.first_name || ' ' || p.last_name AS patient_name,
        u.first_name || ' ' || u.last_name AS provider_name
      FROM billing_quotes q
      LEFT JOIN patients p ON q.patient_id = p.id
      LEFT JOIN users u ON q.provider_id = u.id
      WHERE q.id = $1
    `, [quote.id]);
    res.status(201).json(toCamelCase(fullResult.rows[0]));
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating quote:', error);
    res.status(500).json({ error: 'Failed to create quote' });
  } finally {
    client.release();
  }
});

// Update quote
router.put('/quotes/:id', async (req, res) => {
  const { patientId, providerId, status, issueDate, expiryDate, subtotal, discountAmount, taxAmount, totalAmount, notes, terms, diagnosisIds, offeringIds, couponId, items } = req.body;
  const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
  const client = await req.app.locals.pool.connect();
  try {
    await client.query('BEGIN');
    // SEC-05: scope this transaction to the caller's tenant schema (SET LOCAL auto-reverts).
    const _schema = (req.tenant && /^[a-z_][a-z0-9_]*$/.test(req.tenant.schemaName || '')) ? req.tenant.schemaName : 'public';
    await client.query(`SET LOCAL search_path TO ${_schema}, public, control`);
    const quoteResult = await client.query(`
      UPDATE billing_quotes SET
        patient_id = COALESCE($1, patient_id),
        provider_id = COALESCE($2, provider_id),
        status = COALESCE($3, status),
        issue_date = COALESCE($4, issue_date),
        expiry_date = $5,
        subtotal = COALESCE($6, subtotal),
        discount_amount = COALESCE($7, discount_amount),
        tax_amount = COALESCE($8, tax_amount),
        total_amount = COALESCE($9, total_amount),
        notes = $10,
        terms = $11,
        diagnosis_ids = COALESCE($12, diagnosis_ids),
        offering_ids = COALESCE($13, offering_ids),
        coupon_id = $14,
        updated_at = NOW()
      WHERE id = $15
      RETURNING *
    `, [patientId, providerId, status, issueDate, expiryDate, subtotal, discountAmount, taxAmount, totalAmount, notes, terms, diagnosisIds, offeringIds, couponId, req.params.id]);

    if (quoteResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Quote not found' });
    }

    if (items) {
      await client.query('DELETE FROM billing_quote_items WHERE quote_id = $1', [req.params.id]);
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        await client.query(`
          INSERT INTO billing_quote_items (quote_id, description, quantity, unit_price, discount_percent, total, offering_id, diagnosis_id, cpt_code, icd_code, sort_order)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [req.params.id, item.description, item.quantity || 1, item.unitPrice, item.discountPercent || 0, item.total, item.offeringId, item.diagnosisId, item.cptCode, item.icdCode, i]);
      }
    }
    await client.query('COMMIT');

    const fullResult = await pool.query(`
      SELECT q.*, p.first_name || ' ' || p.last_name AS patient_name,
        u.first_name || ' ' || u.last_name AS provider_name
      FROM billing_quotes q
      LEFT JOIN patients p ON q.patient_id = p.id
      LEFT JOIN users u ON q.provider_id = u.id
      WHERE q.id = $1
    `, [req.params.id]);
    res.json(toCamelCase(fullResult.rows[0]));
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating quote:', error);
    res.status(500).json({ error: 'Failed to update quote' });
  } finally {
    client.release();
  }
});

// Delete quote
router.delete('/quotes/:id', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const result = await pool.query('DELETE FROM billing_quotes WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    res.json({ message: 'Quote deleted successfully' });
  } catch (error) {
    console.error('Error deleting quote:', error);
    res.status(500).json({ error: 'Failed to delete quote' });
  }
});

// Convert quote to invoice
router.post('/quotes/:id/convert', async (req, res) => {
  const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
  const client = await req.app.locals.pool.connect();
  try {
    await client.query('BEGIN');
    // SEC-05: scope this transaction to the caller's tenant schema (SET LOCAL auto-reverts).
    const _schema = (req.tenant && /^[a-z_][a-z0-9_]*$/.test(req.tenant.schemaName || '')) ? req.tenant.schemaName : 'public';
    await client.query(`SET LOCAL search_path TO ${_schema}, public, control`);

    const quoteResult = await client.query('SELECT * FROM billing_quotes WHERE id = $1', [req.params.id]);
    if (quoteResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Quote not found' });
    }
    const quote = quoteResult.rows[0];

    const invoiceNumber = (await client.query('SELECT generate_invoice_number() AS num')).rows[0].num;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    const invoiceResult = await client.query(`
      INSERT INTO billing_invoices (invoice_number, quote_id, patient_id, provider_id, status, issue_date, due_date, subtotal, discount_amount, tax_amount, total_amount, balance_due, notes, terms, diagnosis_ids, offering_ids, coupon_id)
      VALUES ($1, $2, $3, $4, 'sent', CURRENT_DATE, $5, $6, $7, $8, $9, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `, [invoiceNumber, quote.id, quote.patient_id, quote.provider_id, dueDate, quote.subtotal, quote.discount_amount, quote.tax_amount, quote.total_amount, quote.notes, quote.terms, quote.diagnosis_ids, quote.offering_ids, quote.coupon_id]);

    const invoice = invoiceResult.rows[0];

    // Copy quote items to invoice items
    const quoteItems = await client.query('SELECT * FROM billing_quote_items WHERE quote_id = $1 ORDER BY sort_order', [quote.id]);
    for (const item of quoteItems.rows) {
      await client.query(`
        INSERT INTO billing_invoice_items (invoice_id, description, quantity, unit_price, discount_percent, total, offering_id, diagnosis_id, cpt_code, icd_code, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [invoice.id, item.description, item.quantity, item.unit_price, item.discount_percent, item.total, item.offering_id, item.diagnosis_id, item.cpt_code, item.icd_code, item.sort_order]);
    }

    // Mark quote as converted
    await client.query("UPDATE billing_quotes SET status = 'converted', updated_at = NOW() WHERE id = $1", [quote.id]);

    await client.query('COMMIT');

    const fullResult = await pool.query(`
      SELECT i.*, p.first_name || ' ' || p.last_name AS patient_name,
        u.first_name || ' ' || u.last_name AS provider_name
      FROM billing_invoices i
      LEFT JOIN patients p ON i.patient_id = p.id
      LEFT JOIN users u ON i.provider_id = u.id
      WHERE i.id = $1
    `, [invoice.id]);
    res.status(201).json(toCamelCase(fullResult.rows[0]));
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error converting quote to invoice:', error);
    res.status(500).json({ error: 'Failed to convert quote to invoice' });
  } finally {
    client.release();
  }
});

// ============================================
// INVOICES
// ============================================

// Get all invoices
router.get('/invoices', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { patient_id, status } = req.query;
    let query = `
      SELECT i.*,
        p.first_name || ' ' || p.last_name AS patient_name,
        u.first_name || ' ' || u.last_name AS provider_name
      FROM billing_invoices i
      LEFT JOIN patients p ON i.patient_id = p.id
      LEFT JOIN users u ON i.provider_id = u.id
      WHERE 1=1
    `;
    const params = [];
    if (patient_id) {
      params.push(patient_id);
      query += ` AND i.patient_id = $${params.length}`;
    }
    if (status) {
      params.push(status);
      query += ` AND i.status = $${params.length}`;
    }
    query += ' ORDER BY i.created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows.map(toCamelCase));
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// Get single invoice with items
router.get('/invoices/:id', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const invoiceResult = await pool.query(`
      SELECT i.*,
        p.first_name || ' ' || p.last_name AS patient_name,
        u.first_name || ' ' || u.last_name AS provider_name
      FROM billing_invoices i
      LEFT JOIN patients p ON i.patient_id = p.id
      LEFT JOIN users u ON i.provider_id = u.id
      WHERE i.id = $1
    `, [req.params.id]);
    if (invoiceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    const itemsResult = await pool.query(
      'SELECT * FROM billing_invoice_items WHERE invoice_id = $1 ORDER BY sort_order',
      [req.params.id]
    );
    const invoice = toCamelCase(invoiceResult.rows[0]);
    invoice.items = itemsResult.rows.map(toCamelCase);
    res.json(invoice);
  } catch (error) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
});

// Create invoice
router.post('/invoices', async (req, res) => {
  const { patientId, providerId, quoteId, status, issueDate, dueDate, subtotal, discountAmount, taxAmount, totalAmount, notes, terms, diagnosisIds, offeringIds, couponId, items } = req.body;
  const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
  const client = await req.app.locals.pool.connect();
  try {
    await client.query('BEGIN');
    // SEC-05: scope this transaction to the caller's tenant schema (SET LOCAL auto-reverts).
    const _schema = (req.tenant && /^[a-z_][a-z0-9_]*$/.test(req.tenant.schemaName || '')) ? req.tenant.schemaName : 'public';
    await client.query(`SET LOCAL search_path TO ${_schema}, public, control`);
    const invoiceNumber = (await client.query('SELECT generate_invoice_number() AS num')).rows[0].num;
    const total = totalAmount || 0;
    const invoiceResult = await client.query(`
      INSERT INTO billing_invoices (invoice_number, quote_id, patient_id, provider_id, status, issue_date, due_date, subtotal, discount_amount, tax_amount, total_amount, amount_paid, balance_due, notes, terms, diagnosis_ids, offering_ids, coupon_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `, [invoiceNumber, quoteId, patientId, providerId, status || 'draft', issueDate || new Date(), dueDate, subtotal || 0, discountAmount || 0, taxAmount || 0, total, notes, terms, diagnosisIds || [], offeringIds || [], couponId]);

    const invoice = invoiceResult.rows[0];
    if (items && items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        await client.query(`
          INSERT INTO billing_invoice_items (invoice_id, description, quantity, unit_price, discount_percent, total, offering_id, diagnosis_id, cpt_code, icd_code, sort_order)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [invoice.id, item.description, item.quantity || 1, item.unitPrice, item.discountPercent || 0, item.total, item.offeringId, item.diagnosisId, item.cptCode, item.icdCode, i]);
      }
    }
    await client.query('COMMIT');

    const fullResult = await pool.query(`
      SELECT i.*, p.first_name || ' ' || p.last_name AS patient_name,
        u.first_name || ' ' || u.last_name AS provider_name
      FROM billing_invoices i
      LEFT JOIN patients p ON i.patient_id = p.id
      LEFT JOIN users u ON i.provider_id = u.id
      WHERE i.id = $1
    `, [invoice.id]);
    res.status(201).json(toCamelCase(fullResult.rows[0]));
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating invoice:', error);
    res.status(500).json({ error: 'Failed to create invoice' });
  } finally {
    client.release();
  }
});

// Update invoice
router.put('/invoices/:id', async (req, res) => {
  const { patientId, providerId, status, issueDate, dueDate, subtotal, discountAmount, taxAmount, totalAmount, amountPaid, balanceDue, notes, terms, diagnosisIds, offeringIds, couponId, reminderTaskId, items } = req.body;
  const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
  const client = await req.app.locals.pool.connect();
  try {
    await client.query('BEGIN');
    // SEC-05: scope this transaction to the caller's tenant schema (SET LOCAL auto-reverts).
    const _schema = (req.tenant && /^[a-z_][a-z0-9_]*$/.test(req.tenant.schemaName || '')) ? req.tenant.schemaName : 'public';
    await client.query(`SET LOCAL search_path TO ${_schema}, public, control`);
    const invoiceResult = await client.query(`
      UPDATE billing_invoices SET
        patient_id = COALESCE($1, patient_id),
        provider_id = COALESCE($2, provider_id),
        status = COALESCE($3, status),
        issue_date = COALESCE($4, issue_date),
        due_date = $5,
        subtotal = COALESCE($6, subtotal),
        discount_amount = COALESCE($7, discount_amount),
        tax_amount = COALESCE($8, tax_amount),
        total_amount = COALESCE($9, total_amount),
        amount_paid = COALESCE($10, amount_paid),
        balance_due = COALESCE($11, balance_due),
        notes = $12,
        terms = $13,
        diagnosis_ids = COALESCE($14, diagnosis_ids),
        offering_ids = COALESCE($15, offering_ids),
        coupon_id = $16,
        reminder_task_id = COALESCE($17, reminder_task_id),
        updated_at = NOW()
      WHERE id = $18
      RETURNING *
    `, [patientId, providerId, status, issueDate, dueDate, subtotal, discountAmount, taxAmount, totalAmount, amountPaid, balanceDue, notes, terms, diagnosisIds, offeringIds, couponId, reminderTaskId, req.params.id]);

    if (invoiceResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Invoice not found' });
    }

    if (items) {
      await client.query('DELETE FROM billing_invoice_items WHERE invoice_id = $1', [req.params.id]);
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        await client.query(`
          INSERT INTO billing_invoice_items (invoice_id, description, quantity, unit_price, discount_percent, total, offering_id, diagnosis_id, cpt_code, icd_code, sort_order)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [req.params.id, item.description, item.quantity || 1, item.unitPrice, item.discountPercent || 0, item.total, item.offeringId, item.diagnosisId, item.cptCode, item.icdCode, i]);
      }
    }
    await client.query('COMMIT');

    const fullResult = await pool.query(`
      SELECT i.*, p.first_name || ' ' || p.last_name AS patient_name,
        u.first_name || ' ' || u.last_name AS provider_name
      FROM billing_invoices i
      LEFT JOIN patients p ON i.patient_id = p.id
      LEFT JOIN users u ON i.provider_id = u.id
      WHERE i.id = $1
    `, [req.params.id]);
    res.json(toCamelCase(fullResult.rows[0]));
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating invoice:', error);
    res.status(500).json({ error: 'Failed to update invoice' });
  } finally {
    client.release();
  }
});

// Delete invoice
router.delete('/invoices/:id', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const result = await pool.query('DELETE FROM billing_invoices WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    res.json({ message: 'Invoice deleted successfully' });
  } catch (error) {
    console.error('Error deleting invoice:', error);
    res.status(500).json({ error: 'Failed to delete invoice' });
  }
});

// ============================================
// COUPONS
// ============================================

// Get all coupons
router.get('/coupons', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { is_active } = req.query;
    let query = 'SELECT * FROM billing_coupons WHERE 1=1';
    const params = [];
    if (is_active !== undefined) {
      params.push(is_active === 'true');
      query += ` AND is_active = $${params.length}`;
    }
    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows.map(toCamelCase));
  } catch (error) {
    console.error('Error fetching coupons:', error);
    res.status(500).json({ error: 'Failed to fetch coupons' });
  }
});

// Get single coupon
router.get('/coupons/:id', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const result = await pool.query('SELECT * FROM billing_coupons WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Coupon not found' });
    }
    res.json(toCamelCase(result.rows[0]));
  } catch (error) {
    console.error('Error fetching coupon:', error);
    res.status(500).json({ error: 'Failed to fetch coupon' });
  }
});

// Validate coupon code
router.post('/coupons/validate', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { code, amount } = req.body;
    const result = await pool.query(
      "SELECT * FROM billing_coupons WHERE code = $1 AND is_active = true AND (start_date IS NULL OR start_date <= CURRENT_DATE) AND (end_date IS NULL OR end_date >= CURRENT_DATE) AND (usage_limit IS NULL OR used_count < usage_limit)",
      [code.toUpperCase()]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired coupon code' });
    }
    const coupon = result.rows[0];
    if (coupon.min_amount && amount < parseFloat(coupon.min_amount)) {
      return res.status(400).json({ error: `Minimum amount of $${coupon.min_amount} required` });
    }
    let discount = 0;
    if (coupon.discount_type === 'percentage') {
      discount = (amount * parseFloat(coupon.discount_value)) / 100;
      if (coupon.max_discount) {
        discount = Math.min(discount, parseFloat(coupon.max_discount));
      }
    } else {
      discount = parseFloat(coupon.discount_value);
    }
    res.json({ ...toCamelCase(coupon), calculatedDiscount: discount });
  } catch (error) {
    console.error('Error validating coupon:', error);
    res.status(500).json({ error: 'Failed to validate coupon' });
  }
});

// Create coupon
router.post('/coupons', async (req, res) => {
  const { code, name, description, discountType, discountValue, minAmount, maxDiscount, usageLimit, startDate, endDate, isActive, applicableOfferings } = req.body;
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const result = await pool.query(`
      INSERT INTO billing_coupons (code, name, description, discount_type, discount_value, min_amount, max_discount, usage_limit, start_date, end_date, is_active, applicable_offerings)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [code.toUpperCase(), name, description, discountType, discountValue, minAmount || 0, maxDiscount, usageLimit, startDate, endDate, isActive !== false, applicableOfferings || []]);
    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (error) {
    console.error('Error creating coupon:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Coupon code already exists' });
    }
    res.status(500).json({ error: 'Failed to create coupon' });
  }
});

// Update coupon
router.put('/coupons/:id', async (req, res) => {
  const { code, name, description, discountType, discountValue, minAmount, maxDiscount, usageLimit, startDate, endDate, isActive, applicableOfferings } = req.body;
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const result = await pool.query(`
      UPDATE billing_coupons SET
        code = COALESCE($1, code),
        name = COALESCE($2, name),
        description = $3,
        discount_type = COALESCE($4, discount_type),
        discount_value = COALESCE($5, discount_value),
        min_amount = COALESCE($6, min_amount),
        max_discount = $7,
        usage_limit = $8,
        start_date = $9,
        end_date = $10,
        is_active = COALESCE($11, is_active),
        applicable_offerings = COALESCE($12, applicable_offerings),
        updated_at = NOW()
      WHERE id = $13
      RETURNING *
    `, [code?.toUpperCase(), name, description, discountType, discountValue, minAmount, maxDiscount, usageLimit, startDate, endDate, isActive, applicableOfferings, req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Coupon not found' });
    }
    res.json(toCamelCase(result.rows[0]));
  } catch (error) {
    console.error('Error updating coupon:', error);
    res.status(500).json({ error: 'Failed to update coupon' });
  }
});

// Delete coupon
router.delete('/coupons/:id', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const result = await pool.query('DELETE FROM billing_coupons WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Coupon not found' });
    }
    res.json({ message: 'Coupon deleted successfully' });
  } catch (error) {
    console.error('Error deleting coupon:', error);
    res.status(500).json({ error: 'Failed to delete coupon' });
  }
});

// ============================================
// BILLING PAYMENTS
// ============================================

// Get all billing payments
router.get('/payments', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { patient_id, invoice_id, status } = req.query;
    let query = `
      SELECT bp.*,
        p.first_name || ' ' || p.last_name AS patient_name,
        bi.invoice_number
      FROM billing_payments bp
      LEFT JOIN patients p ON bp.patient_id = p.id
      LEFT JOIN billing_invoices bi ON bp.invoice_id = bi.id
      WHERE 1=1
    `;
    const params = [];
    if (patient_id) {
      params.push(patient_id);
      query += ` AND bp.patient_id = $${params.length}`;
    }
    if (invoice_id) {
      params.push(invoice_id);
      query += ` AND bp.invoice_id = $${params.length}`;
    }
    if (status) {
      params.push(status);
      query += ` AND bp.status = $${params.length}`;
    }
    query += ' ORDER BY bp.created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows.map(toCamelCase));
  } catch (error) {
    console.error('Error fetching billing payments:', error);
    res.status(500).json({ error: 'Failed to fetch billing payments' });
  }
});

// Create billing payment
router.post('/payments', async (req, res) => {
  const { invoiceId, patientId, amount, paymentMethod, paymentDate, status, transactionId, referenceNumber, notes } = req.body;
  const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
  const client = await req.app.locals.pool.connect();
  try {
    await client.query('BEGIN');
    // SEC-05: scope this transaction to the caller's tenant schema (SET LOCAL auto-reverts).
    const _schema = (req.tenant && /^[a-z_][a-z0-9_]*$/.test(req.tenant.schemaName || '')) ? req.tenant.schemaName : 'public';
    await client.query(`SET LOCAL search_path TO ${_schema}, public, control`);
    const paymentNumber = (await client.query('SELECT generate_billing_payment_number() AS num')).rows[0].num;
    const paymentResult = await client.query(`
      INSERT INTO billing_payments (payment_number, invoice_id, patient_id, amount, payment_method, payment_date, status, transaction_id, reference_number, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [paymentNumber, invoiceId, patientId, amount, paymentMethod, paymentDate || new Date(), status || 'completed', transactionId, referenceNumber, notes]);

    // Update invoice amount_paid and balance_due if linked
    if (invoiceId && (status || 'completed') === 'completed') {
      await client.query(`
        UPDATE billing_invoices SET
          amount_paid = amount_paid + $1,
          balance_due = total_amount - (amount_paid + $1),
          status = CASE
            WHEN total_amount <= (amount_paid + $1) THEN 'paid'
            WHEN (amount_paid + $1) > 0 THEN 'partially_paid'
            ELSE status
          END,
          updated_at = NOW()
        WHERE id = $2
      `, [amount, invoiceId]);
    }
    await client.query('COMMIT');

    const fullResult = await pool.query(`
      SELECT bp.*, p.first_name || ' ' || p.last_name AS patient_name, bi.invoice_number
      FROM billing_payments bp
      LEFT JOIN patients p ON bp.patient_id = p.id
      LEFT JOIN billing_invoices bi ON bp.invoice_id = bi.id
      WHERE bp.id = $1
    `, [paymentResult.rows[0].id]);
    res.status(201).json(toCamelCase(fullResult.rows[0]));
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating billing payment:', error);
    res.status(500).json({ error: 'Failed to create billing payment' });
  } finally {
    client.release();
  }
});

// Update billing payment
router.put('/payments/:id', async (req, res) => {
  const { amount, paymentMethod, paymentDate, status, transactionId, referenceNumber, notes } = req.body;
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const result = await pool.query(`
      UPDATE billing_payments SET
        amount = COALESCE($1, amount),
        payment_method = COALESCE($2, payment_method),
        payment_date = COALESCE($3, payment_date),
        status = COALESCE($4, status),
        transaction_id = $5,
        reference_number = $6,
        notes = $7,
        updated_at = NOW()
      WHERE id = $8
      RETURNING *
    `, [amount, paymentMethod, paymentDate, status, transactionId, referenceNumber, notes, req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    res.json(toCamelCase(result.rows[0]));
  } catch (error) {
    console.error('Error updating billing payment:', error);
    res.status(500).json({ error: 'Failed to update billing payment' });
  }
});

// Delete billing payment
router.delete('/payments/:id', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const result = await pool.query('DELETE FROM billing_payments WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    res.json({ message: 'Billing payment deleted successfully' });
  } catch (error) {
    console.error('Error deleting billing payment:', error);
    res.status(500).json({ error: 'Failed to delete billing payment' });
  }
});

// ============================================
// BILLING SUMMARY / STATS
// ============================================
router.get('/summary', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const [quotes, invoices, coupons, payments] = await Promise.all([
      pool.query("SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'draft') as draft, COUNT(*) FILTER (WHERE status = 'sent') as sent, COUNT(*) FILTER (WHERE status = 'accepted') as accepted, COALESCE(SUM(total_amount), 0) as total_value FROM billing_quotes"),
      pool.query("SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'paid') as paid, COUNT(*) FILTER (WHERE status = 'overdue') as overdue, COUNT(*) FILTER (WHERE status = 'sent') as sent, COALESCE(SUM(total_amount), 0) as total_value, COALESCE(SUM(balance_due), 0) as total_balance FROM billing_invoices"),
      pool.query("SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE is_active = true) as active FROM billing_coupons"),
      pool.query("SELECT COUNT(*) as total, COALESCE(SUM(amount), 0) as total_collected FROM billing_payments WHERE status = 'completed'")
    ]);
    res.json({
      quotes: quotes.rows[0],
      invoices: invoices.rows[0],
      coupons: coupons.rows[0],
      payments: payments.rows[0]
    });
  } catch (error) {
    console.error('Error fetching billing summary:', error);
    res.status(500).json({ error: 'Failed to fetch billing summary' });
  }
});

module.exports = router;
