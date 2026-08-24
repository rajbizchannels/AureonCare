const express = require('express');
const router = express.Router();
const cloudStorage = require('../services/cloudBackupStorage');
const { authenticate, authorize } = require('../middleware/auth');

// All inventory routes require authentication
router.use(authenticate);

const toCamelCase = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(toCamelCase);
  const out = {};
  for (const key in obj) {
    const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    out[camel] = obj[key];
  }
  return out;
};

// ─────────────────────────────────────────
// CATEGORIES
// ─────────────────────────────────────────

// GET /api/inventory/categories
router.get('/categories', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { search, active } = req.query;
    let query = `
      SELECT c.*,
        p.name AS parent_name,
        u.first_name || ' ' || u.last_name AS created_by_name
      FROM inventory_categories c
      LEFT JOIN inventory_categories p ON c.parent_id = p.id
      LEFT JOIN users u ON c.created_by = u.id
      WHERE 1=1
    `;
    const params = [];
    if (active !== undefined) { params.push(active === 'true'); query += ` AND c.is_active = $${params.length}`; }
    if (search) { params.push(`%${search}%`); query += ` AND (c.name ILIKE $${params.length} OR c.code ILIKE $${params.length})`; }
    query += ' ORDER BY c.code ASC';
    const result = await pool.query(query, params);
    res.json(result.rows.map(toCamelCase));
  } catch (err) {
    console.error('Error fetching categories:', err);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// POST /api/inventory/categories
router.post('/categories', authorize('admin', 'billing_manager'), async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { name, code, description, parentId } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });
    if (!code || !code.trim()) return res.status(400).json({ error: 'code is required' });
    const result = await pool.query(`
      INSERT INTO inventory_categories (code, name, description, parent_id, created_by)
      VALUES ($1, $2, $3, $4, $5) RETURNING *
    `, [code.trim().toUpperCase(), name.trim(), description || null, parentId || null, req.user.id]);
    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Error creating category:', err);
    if (err.code === '23505') return res.status(409).json({ error: 'Category code already exists' });
    if (err.code === '23514') return res.status(400).json({ error: 'Validation failed: ' + err.detail });
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// PUT /api/inventory/categories/:id
router.put('/categories/:id', authorize('admin', 'billing_manager'), async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const existing = await pool.query('SELECT * FROM inventory_categories WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Category not found' });
    const { name, code, description, parentId, isActive } = req.body;
    const result = await pool.query(`
      UPDATE inventory_categories SET
        name        = COALESCE($1, name),
        code        = COALESCE($2, code),
        description = COALESCE($3, description),
        parent_id   = COALESCE($4, parent_id),
        is_active   = COALESCE($5, is_active)
      WHERE id = $6 RETURNING *
    `, [
      name ? name.trim() : null,
      code ? code.trim().toUpperCase() : null,
      description !== undefined ? description : null,
      parentId !== undefined ? parentId : null,
      isActive !== undefined ? isActive : null,
      req.params.id
    ]);
    res.json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Error updating category:', err);
    if (err.code === '23505') return res.status(409).json({ error: 'Category code already exists' });
    if (err.code === '23514') return res.status(400).json({ error: 'Validation failed: ' + err.detail });
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// DELETE /api/inventory/categories/:id (soft-delete if items exist)
router.delete('/categories/:id', authorize('admin'), async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const existing = await pool.query('SELECT * FROM inventory_categories WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Category not found' });
    // Check for items in this category
    const itemsCheck = await pool.query(
      'SELECT COUNT(*) AS cnt FROM inventory_items WHERE category_id = $1 AND status != $2',
      [req.params.id, 'inactive']
    );
    if (parseInt(itemsCheck.rows[0].cnt) > 0) {
      // Soft-delete via deactivation
      await pool.query('UPDATE inventory_categories SET is_active = FALSE WHERE id = $1', [req.params.id]);
      return res.json({ message: 'Category deactivated (has associated items)', softDeleted: true });
    }
    await pool.query('DELETE FROM inventory_categories WHERE id = $1', [req.params.id]);
    res.json({ message: 'Category deleted successfully' });
  } catch (err) {
    console.error('Error deleting category:', err);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

// ─────────────────────────────────────────
// SUPPLIERS
// ─────────────────────────────────────────

// GET /api/inventory/suppliers
router.get('/suppliers', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { search, status } = req.query;
    let query = `
      SELECT s.*,
        u.first_name || ' ' || u.last_name AS created_by_name
      FROM inventory_suppliers s
      LEFT JOIN users u ON s.created_by = u.id
      WHERE 1=1
    `;
    const params = [];
    if (status) { params.push(status); query += ` AND s.status = $${params.length}`; }
    if (search) { params.push(`%${search}%`); query += ` AND (s.name ILIKE $${params.length} OR s.contact_name ILIKE $${params.length} OR s.supplier_number ILIKE $${params.length})`; }
    query += ' ORDER BY s.name ASC';
    const result = await pool.query(query, params);
    res.json(result.rows.map(toCamelCase));
  } catch (err) {
    console.error('Error fetching suppliers:', err);
    res.status(500).json({ error: 'Failed to fetch suppliers' });
  }
});

// POST /api/inventory/suppliers
router.post('/suppliers', authorize('admin', 'billing_manager'), async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { name, contactName, email, phone, address, city, country, paymentTerms,
      taxId, notes, linkedAccountId } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });
    if (email) {
      const emailRe = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;
      if (!emailRe.test(email)) return res.status(400).json({ error: 'Invalid email format' });
    }
    const supplierNumber = (await pool.query('SELECT generate_supplier_number() AS num')).rows[0].num;
    const result = await pool.query(`
      INSERT INTO inventory_suppliers (
        supplier_number, name, contact_name, email, phone, address, city, country,
        payment_terms, tax_id, notes, linked_account_id, created_by, updated_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13)
      RETURNING *
    `, [
      supplierNumber, name.trim(), contactName || null, email || null,
      phone || null, address || null, city || null, country || null,
      paymentTerms || null, taxId || null, notes || null, linkedAccountId || null,
      req.user.id
    ]);
    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Error creating supplier:', err);
    if (err.code === '23514') return res.status(400).json({ error: 'Validation failed: ' + err.detail });
    res.status(500).json({ error: 'Failed to create supplier' });
  }
});

// PUT /api/inventory/suppliers/:id
router.put('/suppliers/:id', authorize('admin', 'billing_manager'), async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const existing = await pool.query('SELECT * FROM inventory_suppliers WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Supplier not found' });
    const { name, contactName, email, phone, address, city, country, paymentTerms,
      status, taxId, notes, linkedAccountId } = req.body;
    if (email) {
      const emailRe = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;
      if (!emailRe.test(email)) return res.status(400).json({ error: 'Invalid email format' });
    }
    const result = await pool.query(`
      UPDATE inventory_suppliers SET
        name              = COALESCE($1,  name),
        contact_name      = COALESCE($2,  contact_name),
        email             = COALESCE($3,  email),
        phone             = COALESCE($4,  phone),
        address           = COALESCE($5,  address),
        city              = COALESCE($6,  city),
        country           = COALESCE($7,  country),
        payment_terms     = COALESCE($8,  payment_terms),
        status            = COALESCE($9,  status),
        tax_id            = COALESCE($10, tax_id),
        notes             = COALESCE($11, notes),
        linked_account_id = COALESCE($12, linked_account_id),
        updated_by        = $13
      WHERE id = $14 RETURNING *
    `, [
      name ? name.trim() : null, contactName || null, email || null, phone || null,
      address || null, city || null, country || null, paymentTerms || null,
      status || null, taxId || null, notes || null, linkedAccountId || null,
      req.user.id, req.params.id
    ]);
    res.json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Error updating supplier:', err);
    if (err.code === '23514') return res.status(400).json({ error: 'Validation failed: ' + err.detail });
    res.status(500).json({ error: 'Failed to update supplier' });
  }
});

// DELETE /api/inventory/suppliers/:id (soft-delete via status='inactive')
router.delete('/suppliers/:id', authorize('admin'), async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const existing = await pool.query('SELECT * FROM inventory_suppliers WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Supplier not found' });
    const itemsCheck = await pool.query(
      'SELECT COUNT(*) AS cnt FROM inventory_items WHERE supplier_id = $1 AND status != $2',
      [req.params.id, 'inactive']
    );
    if (parseInt(itemsCheck.rows[0].cnt) > 0) {
      await pool.query(
        'UPDATE inventory_suppliers SET status = $1, updated_by = $2 WHERE id = $3',
        ['inactive', req.user.id, req.params.id]
      );
      return res.json({ message: 'Supplier deactivated (has associated items)', softDeleted: true });
    }
    await pool.query(
      'UPDATE inventory_suppliers SET status = $1, updated_by = $2 WHERE id = $3',
      ['inactive', req.user.id, req.params.id]
    );
    res.json({ message: 'Supplier deactivated successfully' });
  } catch (err) {
    console.error('Error deleting supplier:', err);
    res.status(500).json({ error: 'Failed to delete supplier' });
  }
});

// ─────────────────────────────────────────
// INVENTORY ITEMS
// ─────────────────────────────────────────

// GET /api/inventory/items
router.get('/items', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { search, category, status, type, limit = 100, offset = 0 } = req.query;
    let query = `
      SELECT i.*,
        c.name AS category_name, c.code AS category_code,
        s.name AS supplier_name, s.supplier_number,
        u.first_name || ' ' || u.last_name AS created_by_name
      FROM inventory_items i
      LEFT JOIN inventory_categories c ON i.category_id = c.id
      LEFT JOIN inventory_suppliers s  ON i.supplier_id  = s.id
      LEFT JOIN users u ON i.created_by = u.id
      WHERE 1=1
    `;
    const params = [];
    if (status)   { params.push(status);   query += ` AND i.status = $${params.length}`; }
    if (type)     { params.push(type);     query += ` AND i.item_type = $${params.length}`; }
    if (category) { params.push(category); query += ` AND i.category_id = $${params.length}`; }
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (i.name ILIKE $${params.length} OR i.item_number ILIKE $${params.length} OR i.sku ILIKE $${params.length} OR i.barcode ILIKE $${params.length})`;
    }
    query += ` ORDER BY i.item_number ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));
    const result = await pool.query(query, params);
    res.json(result.rows.map(toCamelCase));
  } catch (err) {
    console.error('Error fetching items:', err);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

// GET /api/inventory/items/:id
router.get('/items/:id', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const itemResult = await pool.query(`
      SELECT i.*,
        c.name AS category_name, c.code AS category_code,
        s.name AS supplier_name, s.supplier_number,
        u.first_name || ' ' || u.last_name AS created_by_name
      FROM inventory_items i
      LEFT JOIN inventory_categories c ON i.category_id = c.id
      LEFT JOIN inventory_suppliers s  ON i.supplier_id  = s.id
      LEFT JOIN users u ON i.created_by = u.id
      WHERE i.id = $1
    `, [req.params.id]);
    if (itemResult.rows.length === 0) return res.status(404).json({ error: 'Item not found' });
    const movResult = await pool.query(`
      SELECT m.*,
        pu.first_name || ' ' || pu.last_name AS performed_by_name
      FROM inventory_stock_movements m
      LEFT JOIN users pu ON m.performed_by = pu.id
      WHERE m.item_id = $1
      ORDER BY m.movement_date DESC, m.created_at DESC
      LIMIT 20
    `, [req.params.id]);
    const item = toCamelCase(itemResult.rows[0]);
    item.recentMovements = movResult.rows.map(toCamelCase);
    item.availableQuantity = parseFloat(item.quantityOnHand) - parseFloat(item.quantityReserved || 0);
    item.totalValue = parseFloat(item.quantityOnHand) * parseFloat(item.unitCost);
    res.json(item);
  } catch (err) {
    console.error('Error fetching item:', err);
    res.status(500).json({ error: 'Failed to fetch item' });
  }
});

// POST /api/inventory/items
router.post('/items', authorize('admin', 'billing_manager'), async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const {
      name, description, categoryId, supplierId, unitOfMeasure, itemType,
      sku, barcode, unitCost, sellingPrice,
      quantityOnHand, reorderLevel, reorderQuantity,
      expiryDate, lotNumber, isLotTracked, isExpiryTracked,
      requiresRefrigeration, linkedAccountId
    } = req.body;

    if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });
    if (!unitOfMeasure) return res.status(400).json({ error: 'unitOfMeasure is required' });
    if (!itemType) return res.status(400).json({ error: 'itemType is required' });
    if (unitCost === undefined || unitCost === null) return res.status(400).json({ error: 'unitCost is required' });
    if (parseFloat(unitCost) < 0) return res.status(400).json({ error: 'unitCost must be >= 0' });

    const validUOM = ['unit','pack','box','kg','g','l','ml','each','dozen','case'];
    if (!validUOM.includes(unitOfMeasure)) {
      return res.status(400).json({ error: `unitOfMeasure must be one of: ${validUOM.join(', ')}` });
    }
    const validTypes = ['medication','supply','equipment','consumable','reagent','implant','other'];
    if (!validTypes.includes(itemType)) {
      return res.status(400).json({ error: `itemType must be one of: ${validTypes.join(', ')}` });
    }

    const itemNumber = (await pool.query('SELECT generate_item_number() AS num')).rows[0].num;
    const result = await pool.query(`
      INSERT INTO inventory_items (
        item_number, name, description, category_id, supplier_id,
        unit_of_measure, item_type, sku, barcode,
        unit_cost, selling_price,
        quantity_on_hand, reorder_level, reorder_quantity,
        expiry_date, lot_number, is_lot_tracked, is_expiry_tracked,
        requires_refrigeration, linked_account_id,
        created_by, updated_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$21)
      RETURNING *
    `, [
      itemNumber, name.trim(), description || null, categoryId || null, supplierId || null,
      unitOfMeasure, itemType, sku || null, barcode || null,
      parseFloat(unitCost), sellingPrice !== undefined ? parseFloat(sellingPrice) : null,
      parseFloat(quantityOnHand || 0), parseFloat(reorderLevel || 0), parseFloat(reorderQuantity || 0),
      expiryDate || null, lotNumber || null,
      isLotTracked || false, isExpiryTracked || false,
      requiresRefrigeration || false, linkedAccountId || null,
      req.user.id
    ]);
    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Error creating item:', err);
    if (err.code === '23505') return res.status(409).json({ error: 'Item number or SKU already exists' });
    if (err.code === '23514') return res.status(400).json({ error: 'Validation failed: ' + err.detail });
    res.status(500).json({ error: 'Failed to create item' });
  }
});

// PUT /api/inventory/items/:id
router.put('/items/:id', authorize('admin', 'billing_manager'), async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const existing = await pool.query('SELECT * FROM inventory_items WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Item not found' });

    const {
      name, description, categoryId, supplierId, unitOfMeasure, itemType,
      sku, barcode, unitCost, sellingPrice,
      reorderLevel, reorderQuantity,
      expiryDate, lotNumber, isLotTracked, isExpiryTracked,
      requiresRefrigeration, status, linkedAccountId
    } = req.body;

    if (unitCost !== undefined && parseFloat(unitCost) < 0) {
      return res.status(400).json({ error: 'unitCost must be >= 0' });
    }

    const result = await pool.query(`
      UPDATE inventory_items SET
        name                  = COALESCE($1,  name),
        description           = COALESCE($2,  description),
        category_id           = COALESCE($3,  category_id),
        supplier_id           = COALESCE($4,  supplier_id),
        unit_of_measure       = COALESCE($5,  unit_of_measure),
        item_type             = COALESCE($6,  item_type),
        sku                   = COALESCE($7,  sku),
        barcode               = COALESCE($8,  barcode),
        unit_cost             = COALESCE($9,  unit_cost),
        selling_price         = COALESCE($10, selling_price),
        reorder_level         = COALESCE($11, reorder_level),
        reorder_quantity      = COALESCE($12, reorder_quantity),
        expiry_date           = COALESCE($13, expiry_date),
        lot_number            = COALESCE($14, lot_number),
        is_lot_tracked        = COALESCE($15, is_lot_tracked),
        is_expiry_tracked     = COALESCE($16, is_expiry_tracked),
        requires_refrigeration = COALESCE($17, requires_refrigeration),
        status                = COALESCE($18, status),
        linked_account_id     = COALESCE($19, linked_account_id),
        updated_by            = $20
      WHERE id = $21 RETURNING *
    `, [
      name ? name.trim() : null,
      description !== undefined ? description : null,
      categoryId !== undefined ? categoryId : null,
      supplierId !== undefined ? supplierId : null,
      unitOfMeasure || null, itemType || null,
      sku !== undefined ? sku : null,
      barcode !== undefined ? barcode : null,
      unitCost !== undefined ? parseFloat(unitCost) : null,
      sellingPrice !== undefined ? parseFloat(sellingPrice) : null,
      reorderLevel !== undefined ? parseFloat(reorderLevel) : null,
      reorderQuantity !== undefined ? parseFloat(reorderQuantity) : null,
      expiryDate !== undefined ? expiryDate : null,
      lotNumber !== undefined ? lotNumber : null,
      isLotTracked !== undefined ? isLotTracked : null,
      isExpiryTracked !== undefined ? isExpiryTracked : null,
      requiresRefrigeration !== undefined ? requiresRefrigeration : null,
      status || null,
      linkedAccountId !== undefined ? linkedAccountId : null,
      req.user.id,
      req.params.id
    ]);
    res.json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Error updating item:', err);
    if (err.code === '23514') return res.status(400).json({ error: 'Validation failed: ' + err.detail });
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// DELETE /api/inventory/items/:id (soft-delete via status='inactive')
router.delete('/items/:id', authorize('admin'), async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const existing = await pool.query('SELECT * FROM inventory_items WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Item not found' });
    await pool.query(
      'UPDATE inventory_items SET status = $1, updated_by = $2 WHERE id = $3',
      ['inactive', req.user.id, req.params.id]
    );
    res.json({ message: 'Item deactivated successfully' });
  } catch (err) {
    console.error('Error deleting item:', err);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// ─────────────────────────────────────────
// STOCK MOVEMENTS
// ─────────────────────────────────────────

// GET /api/inventory/movements
router.get('/movements', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { item, type, dateFrom, dateTo, limit = 100, offset = 0 } = req.query;
    let query = `
      SELECT m.*,
        i.name AS item_name, i.item_number, i.unit_of_measure,
        pu.first_name || ' ' || pu.last_name AS performed_by_name
      FROM inventory_stock_movements m
      JOIN inventory_items i ON m.item_id = i.id
      LEFT JOIN users pu ON m.performed_by = pu.id
      WHERE 1=1
    `;
    const params = [];
    if (item)     { params.push(item);     query += ` AND m.item_id = $${params.length}`; }
    if (type)     { params.push(type);     query += ` AND m.movement_type = $${params.length}`; }
    if (dateFrom) { params.push(dateFrom); query += ` AND m.movement_date >= $${params.length}`; }
    if (dateTo)   { params.push(dateTo);   query += ` AND m.movement_date <= $${params.length}`; }
    query += ` ORDER BY m.movement_date DESC, m.created_at DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`;
    params.push(parseInt(limit), parseInt(offset));
    const result = await pool.query(query, params);
    res.json(result.rows.map(toCamelCase));
  } catch (err) {
    console.error('Error fetching movements:', err);
    res.status(500).json({ error: 'Failed to fetch stock movements' });
  }
});

// POST /api/inventory/movements
router.post('/movements', authorize('admin', 'billing_manager', 'nurse'), async (req, res) => {
  const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
  const client = await req.app.locals.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL search_path TO ${req.tenant && /^[a-z_][a-z0-9_]*$/.test(req.tenant.schemaName || '') ? req.tenant.schemaName : 'public'}, public, control`); // SEC-05
    const { itemId, movementType, referenceType, referenceId, quantity,
      unitCost, lotNumber, expiryDate, movementDate, notes, journalEntryId } = req.body;

    if (!itemId) return res.status(400).json({ error: 'itemId is required' });
    if (!movementType) return res.status(400).json({ error: 'movementType is required' });
    if (quantity === undefined || quantity === null || parseFloat(quantity) === 0) {
      return res.status(400).json({ error: 'quantity is required and must be non-zero' });
    }

    const validTypes = ['receipt','issue','adjustment','transfer','return','write_off','opening'];
    if (!validTypes.includes(movementType)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `movementType must be one of: ${validTypes.join(', ')}` });
    }

    // Lock item row for update
    const itemResult = await client.query(
      'SELECT * FROM inventory_items WHERE id = $1 FOR UPDATE',
      [itemId]
    );
    if (itemResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Item not found' });
    }
    const item = itemResult.rows[0];
    const qty = parseFloat(quantity);
    const newBalance = parseFloat(item.quantity_on_hand) + qty;

    if (newBalance < 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Insufficient stock. Current: ${item.quantity_on_hand}, Requested change: ${qty}`
      });
    }

    // Update item quantity
    await client.query(
      'UPDATE inventory_items SET quantity_on_hand = $1, updated_by = $2 WHERE id = $3',
      [newBalance, req.user.id, itemId]
    );

    // Generate movement number
    const movNumber = (await client.query('SELECT generate_movement_number() AS num')).rows[0].num;

    // Create movement record
    const result = await client.query(`
      INSERT INTO inventory_stock_movements (
        movement_number, item_id, movement_type, reference_type, reference_id,
        quantity, unit_cost, lot_number, expiry_date, movement_date,
        notes, balance_after, journal_entry_id, performed_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING *
    `, [
      movNumber, itemId, movementType, referenceType || null, referenceId || null,
      qty, unitCost !== undefined ? parseFloat(unitCost) : parseFloat(item.unit_cost),
      lotNumber || null, expiryDate || null,
      movementDate || new Date().toISOString().split('T')[0],
      notes || null, newBalance, journalEntryId || null,
      req.user.id
    ]);

    await client.query('COMMIT');
    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating stock movement:', err);
    if (err.code === '23514') return res.status(400).json({ error: 'Validation failed: ' + err.detail });
    res.status(500).json({ error: 'Failed to create stock movement' });
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────
// PURCHASE ORDERS
// ─────────────────────────────────────────

// GET /api/inventory/orders
router.get('/orders', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { status, supplier, limit = 100, offset = 0 } = req.query;
    let query = `
      SELECT o.*,
        s.name AS supplier_name, s.supplier_number,
        u.first_name || ' ' || u.last_name AS created_by_name,
        ab.first_name || ' ' || ab.last_name AS approved_by_name
      FROM inventory_purchase_orders o
      JOIN inventory_suppliers s ON o.supplier_id = s.id
      LEFT JOIN users u  ON o.created_by  = u.id
      LEFT JOIN users ab ON o.approved_by = ab.id
      WHERE 1=1
    `;
    const params = [];
    if (status)   { params.push(status);   query += ` AND o.status = $${params.length}`; }
    if (supplier) { params.push(supplier); query += ` AND o.supplier_id = $${params.length}`; }
    query += ` ORDER BY o.order_date DESC, o.created_at DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`;
    params.push(parseInt(limit), parseInt(offset));
    const result = await pool.query(query, params);
    res.json(result.rows.map(toCamelCase));
  } catch (err) {
    console.error('Error fetching purchase orders:', err);
    res.status(500).json({ error: 'Failed to fetch purchase orders' });
  }
});

// GET /api/inventory/orders/:id
router.get('/orders/:id', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const orderResult = await pool.query(`
      SELECT o.*,
        s.name AS supplier_name, s.supplier_number, s.contact_name, s.email AS supplier_email,
        u.first_name || ' ' || u.last_name AS created_by_name,
        ab.first_name || ' ' || ab.last_name AS approved_by_name
      FROM inventory_purchase_orders o
      JOIN inventory_suppliers s ON o.supplier_id = s.id
      LEFT JOIN users u  ON o.created_by  = u.id
      LEFT JOIN users ab ON o.approved_by = ab.id
      WHERE o.id = $1
    `, [req.params.id]);
    if (orderResult.rows.length === 0) return res.status(404).json({ error: 'Purchase order not found' });
    const linesResult = await pool.query(`
      SELECT pol.*, i.name AS item_name, i.item_number, i.unit_of_measure, i.unit_cost AS current_unit_cost
      FROM inventory_purchase_order_lines pol
      JOIN inventory_items i ON pol.item_id = i.id
      WHERE pol.po_id = $1
      ORDER BY pol.line_number ASC
    `, [req.params.id]);
    const order = toCamelCase(orderResult.rows[0]);
    order.lines = linesResult.rows.map(toCamelCase);
    res.json(order);
  } catch (err) {
    console.error('Error fetching purchase order:', err);
    res.status(500).json({ error: 'Failed to fetch purchase order' });
  }
});

// POST /api/inventory/orders
router.post('/orders', authorize('admin', 'billing_manager'), async (req, res) => {
  const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
  const client = await req.app.locals.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL search_path TO ${req.tenant && /^[a-z_][a-z0-9_]*$/.test(req.tenant.schemaName || '') ? req.tenant.schemaName : 'public'}, public, control`); // SEC-05
    const { supplierId, orderDate, expectedDate, taxAmount, shippingAmount,
      notes, linkedAccountId, lines } = req.body;

    if (!supplierId) return res.status(400).json({ error: 'supplierId is required' });
    if (!lines || lines.length === 0) return res.status(400).json({ error: 'At least one line item is required' });

    // Validate supplier exists
    const supplierCheck = await client.query('SELECT id FROM inventory_suppliers WHERE id = $1', [supplierId]);
    if (supplierCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Supplier not found' });
    }

    // Calculate total
    let totalAmount = 0;
    for (const line of lines) {
      if (!line.itemId) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Each line requires itemId' }); }
      if (!line.quantityOrdered || parseFloat(line.quantityOrdered) <= 0) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Each line requires quantityOrdered > 0' }); }
      if (line.unitCost === undefined || parseFloat(line.unitCost) < 0) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Each line requires unitCost >= 0' }); }
      totalAmount += parseFloat(line.quantityOrdered) * parseFloat(line.unitCost);
    }
    totalAmount += parseFloat(taxAmount || 0) + parseFloat(shippingAmount || 0);

    const poNumber = (await client.query('SELECT generate_po_number() AS num')).rows[0].num;
    const orderResult = await client.query(`
      INSERT INTO inventory_purchase_orders (
        po_number, supplier_id, order_date, expected_date,
        total_amount, tax_amount, shipping_amount,
        notes, linked_account_id, created_by, updated_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)
      RETURNING *
    `, [
      poNumber, supplierId,
      orderDate || new Date().toISOString().split('T')[0],
      expectedDate || null,
      totalAmount, parseFloat(taxAmount || 0), parseFloat(shippingAmount || 0),
      notes || null, linkedAccountId || null,
      req.user.id
    ]);

    const orderId = orderResult.rows[0].id;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      await client.query(`
        INSERT INTO inventory_purchase_order_lines (
          po_id, item_id, line_number, quantity_ordered, unit_cost,
          lot_number, expiry_date, notes
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      `, [
        orderId, l.itemId, i + 1,
        parseFloat(l.quantityOrdered), parseFloat(l.unitCost),
        l.lotNumber || null, l.expiryDate || null, l.notes || null
      ]);
    }

    await client.query('COMMIT');
    const order = toCamelCase(orderResult.rows[0]);
    order.lines = lines;
    res.status(201).json(order);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating purchase order:', err);
    if (err.code === '23514') return res.status(400).json({ error: 'Validation failed: ' + err.detail });
    res.status(500).json({ error: 'Failed to create purchase order' });
  } finally {
    client.release();
  }
});

// PUT /api/inventory/orders/:id (status transitions)
router.put('/orders/:id', authorize('admin', 'billing_manager'), async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const existing = await pool.query('SELECT * FROM inventory_purchase_orders WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Purchase order not found' });

    const current = existing.rows[0];
    const { status, expectedDate, receivedDate, notes, linkedAccountId } = req.body;

    // Validate status transitions
    const validTransitions = {
      draft:              ['submitted', 'cancelled'],
      submitted:          ['approved', 'cancelled', 'draft'],
      approved:           ['partially_received', 'received', 'cancelled'],
      partially_received: ['received', 'cancelled'],
      received:           [],
      cancelled:          []
    };
    if (status && !validTransitions[current.status].includes(status)) {
      return res.status(409).json({
        error: `Cannot transition from '${current.status}' to '${status}'. Valid transitions: ${validTransitions[current.status].join(', ') || 'none'}`
      });
    }

    let approvedBy = current.approved_by;
    if (status === 'approved') approvedBy = req.user.id;

    const result = await pool.query(`
      UPDATE inventory_purchase_orders SET
        status            = COALESCE($1, status),
        expected_date     = COALESCE($2, expected_date),
        received_date     = COALESCE($3, received_date),
        notes             = COALESCE($4, notes),
        linked_account_id = COALESCE($5, linked_account_id),
        approved_by       = $6,
        updated_by        = $7
      WHERE id = $8 RETURNING *
    `, [
      status || null, expectedDate || null, receivedDate || null,
      notes || null, linkedAccountId || null,
      approvedBy, req.user.id, req.params.id
    ]);
    res.json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Error updating purchase order:', err);
    res.status(500).json({ error: 'Failed to update purchase order' });
  }
});

// POST /api/inventory/orders/:id/receive (receive all lines, create movements)
router.post('/orders/:id/receive', authorize('admin', 'billing_manager'), async (req, res) => {
  const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
  const client = await req.app.locals.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL search_path TO ${req.tenant && /^[a-z_][a-z0-9_]*$/.test(req.tenant.schemaName || '') ? req.tenant.schemaName : 'public'}, public, control`); // SEC-05
    const orderResult = await client.query(
      'SELECT * FROM inventory_purchase_orders WHERE id = $1 FOR UPDATE',
      [req.params.id]
    );
    if (orderResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Purchase order not found' });
    }
    const order = orderResult.rows[0];
    if (!['approved', 'partially_received'].includes(order.status)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Only approved or partially_received orders can be received' });
    }

    const lines = await client.query(
      'SELECT * FROM inventory_purchase_order_lines WHERE po_id = $1',
      [req.params.id]
    );

    const { receiptLines = [], movementDate, notes } = req.body;
    // receiptLines: [{ lineId, quantityReceived }] — if empty, receive all remaining
    const receiptMap = {};
    for (const rl of receiptLines) {
      receiptMap[rl.lineId] = parseFloat(rl.quantityReceived);
    }

    let allReceived = true;
    const createdMovements = [];

    for (const line of lines.rows) {
      const qtyToReceive = receiptMap[line.id] !== undefined
        ? receiptMap[line.id]
        : parseFloat(line.quantity_ordered) - parseFloat(line.quantity_received);

      if (qtyToReceive <= 0) { allReceived = false; continue; }
      const newQtyReceived = parseFloat(line.quantity_received) + qtyToReceive;
      if (newQtyReceived < parseFloat(line.quantity_ordered)) allReceived = false;

      // Update line received quantity
      await client.query(
        'UPDATE inventory_purchase_order_lines SET quantity_received = $1 WHERE id = $2',
        [newQtyReceived, line.id]
      );

      // Update item quantity on hand (lock row)
      const itemRow = await client.query(
        'SELECT * FROM inventory_items WHERE id = $1 FOR UPDATE',
        [line.item_id]
      );
      const item = itemRow.rows[0];
      const newBalance = parseFloat(item.quantity_on_hand) + qtyToReceive;

      await client.query(
        'UPDATE inventory_items SET quantity_on_hand = $1, quantity_on_order = GREATEST(quantity_on_order - $2, 0), updated_by = $3 WHERE id = $4',
        [newBalance, qtyToReceive, req.user.id, line.item_id]
      );

      // Create stock movement
      const movNumber = (await client.query('SELECT generate_movement_number() AS num')).rows[0].num;
      const movResult = await client.query(`
        INSERT INTO inventory_stock_movements (
          movement_number, item_id, movement_type,
          reference_type, reference_id,
          quantity, unit_cost, lot_number, expiry_date,
          movement_date, notes, balance_after, performed_by
        ) VALUES ($1,$2,'receipt','purchase_order',$3,$4,$5,$6,$7,$8,$9,$10,$11)
        RETURNING *
      `, [
        movNumber, line.item_id, order.id,
        qtyToReceive, parseFloat(line.unit_cost),
        line.lot_number || null, line.expiry_date || null,
        movementDate || new Date().toISOString().split('T')[0],
        notes || null, newBalance, req.user.id
      ]);
      createdMovements.push(toCamelCase(movResult.rows[0]));
    }

    const newStatus = allReceived ? 'received' : 'partially_received';
    const receivedDate = allReceived ? (movementDate || new Date().toISOString().split('T')[0]) : null;
    const updatedOrder = await client.query(`
      UPDATE inventory_purchase_orders SET
        status = $1,
        received_date = COALESCE($2, received_date),
        updated_by = $3
      WHERE id = $4 RETURNING *
    `, [newStatus, receivedDate, req.user.id, req.params.id]);

    await client.query('COMMIT');
    res.json({
      order: toCamelCase(updatedOrder.rows[0]),
      movements: createdMovements,
      fullyReceived: allReceived
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error receiving purchase order:', err);
    res.status(500).json({ error: 'Failed to receive purchase order' });
  } finally {
    client.release();
  }
});

// DELETE /api/inventory/orders/:id (only draft or cancelled)
router.delete('/orders/:id', authorize('admin'), async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const existing = await pool.query('SELECT * FROM inventory_purchase_orders WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Purchase order not found' });
    if (!['draft', 'cancelled'].includes(existing.rows[0].status)) {
      return res.status(409).json({ error: 'Only draft or cancelled orders can be deleted' });
    }
    await pool.query('DELETE FROM inventory_purchase_orders WHERE id = $1', [req.params.id]);
    res.json({ message: 'Purchase order deleted successfully' });
  } catch (err) {
    console.error('Error deleting purchase order:', err);
    res.status(500).json({ error: 'Failed to delete purchase order' });
  }
});

// ─────────────────────────────────────────
// REPORTS
// ─────────────────────────────────────────

// GET /api/inventory/reports/summary
router.get('/reports/summary', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const [items, lowStock, movThisMonth, orders] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) AS total_items,
          COUNT(*) FILTER (WHERE status = 'active') AS active_items,
          COALESCE(SUM(quantity_on_hand * unit_cost), 0) AS total_inventory_value,
          COUNT(*) FILTER (WHERE quantity_on_hand = 0 AND status = 'active') AS out_of_stock_count
        FROM inventory_items
      `),
      pool.query(`
        SELECT COUNT(*) AS low_stock_count
        FROM inventory_items
        WHERE status = 'active' AND quantity_on_hand <= reorder_level AND reorder_level > 0
      `),
      pool.query(`
        SELECT COUNT(*) AS movements_this_month,
          COALESCE(SUM(CASE WHEN movement_type = 'receipt' THEN quantity ELSE 0 END), 0) AS total_received,
          COALESCE(SUM(CASE WHEN movement_type = 'issue'   THEN ABS(quantity) ELSE 0 END), 0) AS total_issued
        FROM inventory_stock_movements
        WHERE movement_date >= DATE_TRUNC('month', CURRENT_DATE)
      `),
      pool.query(`
        SELECT COUNT(*) AS total_orders,
          COUNT(*) FILTER (WHERE status = 'draft')    AS draft_orders,
          COUNT(*) FILTER (WHERE status = 'approved') AS approved_orders,
          COALESCE(SUM(CASE WHEN status NOT IN ('cancelled') THEN total_amount ELSE 0 END), 0) AS total_order_value
        FROM inventory_purchase_orders
      `)
    ]);
    res.json({
      ...toCamelCase(items.rows[0]),
      lowStockCount: parseInt(lowStock.rows[0].low_stock_count),
      ...toCamelCase(movThisMonth.rows[0]),
      ...toCamelCase(orders.rows[0]),
      asOfDate: new Date().toISOString().split('T')[0]
    });
  } catch (err) {
    console.error('Error fetching inventory summary:', err);
    res.status(500).json({ error: 'Failed to fetch inventory summary' });
  }
});

// GET /api/inventory/reports/stock-levels
router.get('/reports/stock-levels', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const result = await pool.query(`
      SELECT
        i.item_number, i.name, i.item_type, i.unit_of_measure, i.status,
        c.name AS category_name,
        i.quantity_on_hand, i.quantity_reserved, i.quantity_on_order,
        i.reorder_level, i.reorder_quantity,
        i.unit_cost,
        ROUND((i.quantity_on_hand * i.unit_cost)::NUMERIC, 2) AS total_value,
        (i.quantity_on_hand - i.quantity_reserved)             AS available_quantity,
        (i.quantity_on_hand <= i.reorder_level AND i.reorder_level > 0) AS is_low_stock
      FROM inventory_items i
      LEFT JOIN inventory_categories c ON i.category_id = c.id
      WHERE i.status NOT IN ('discontinued')
      ORDER BY i.item_number ASC
    `);
    res.json(result.rows.map(toCamelCase));
  } catch (err) {
    console.error('Error fetching stock levels:', err);
    res.status(500).json({ error: 'Failed to fetch stock levels' });
  }
});

// GET /api/inventory/reports/low-stock
router.get('/reports/low-stock', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const result = await pool.query(`
      SELECT
        i.id, i.item_number, i.name, i.item_type, i.unit_of_measure,
        c.name AS category_name,
        s.name AS supplier_name, s.email AS supplier_email,
        i.quantity_on_hand, i.quantity_on_order, i.reorder_level, i.reorder_quantity,
        i.unit_cost,
        (i.reorder_level - i.quantity_on_hand) AS shortage_quantity,
        ROUND(((i.reorder_level - i.quantity_on_hand) * i.unit_cost)::NUMERIC, 2) AS estimated_reorder_cost
      FROM inventory_items i
      LEFT JOIN inventory_categories c ON i.category_id = c.id
      LEFT JOIN inventory_suppliers  s ON i.supplier_id  = s.id
      WHERE i.status = 'active'
        AND i.reorder_level > 0
        AND i.quantity_on_hand <= i.reorder_level
      ORDER BY (i.quantity_on_hand / NULLIF(i.reorder_level, 0)) ASC
    `);
    res.json(result.rows.map(toCamelCase));
  } catch (err) {
    console.error('Error fetching low stock report:', err);
    res.status(500).json({ error: 'Failed to fetch low stock report' });
  }
});

// GET /api/inventory/reports/movement-history
router.get('/reports/movement-history', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { dateFrom, dateTo } = req.query;
    let whereClause = 'WHERE 1=1';
    const params = [];
    if (dateFrom) { params.push(dateFrom); whereClause += ` AND m.movement_date >= $${params.length}`; }
    if (dateTo)   { params.push(dateTo);   whereClause += ` AND m.movement_date <= $${params.length}`; }

    const result = await pool.query(`
      SELECT
        m.movement_type,
        COUNT(*) AS movement_count,
        COALESCE(SUM(ABS(m.quantity)), 0) AS total_quantity,
        COALESCE(SUM(ABS(m.quantity) * COALESCE(m.unit_cost, 0)), 0) AS total_value
      FROM inventory_stock_movements m
      ${whereClause}
      GROUP BY m.movement_type
      ORDER BY m.movement_type
    `, params);
    res.json(result.rows.map(toCamelCase));
  } catch (err) {
    console.error('Error fetching movement history:', err);
    res.status(500).json({ error: 'Failed to fetch movement history' });
  }
});

// GET /api/inventory/reports/valuation
router.get('/reports/valuation', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const result = await pool.query(`
      SELECT
        i.id, i.item_number, i.name, i.item_type, i.unit_of_measure,
        c.name AS category_name,
        i.quantity_on_hand,
        i.unit_cost,
        ROUND((i.quantity_on_hand * i.unit_cost)::NUMERIC, 2) AS inventory_value,
        i.selling_price,
        CASE
          WHEN i.selling_price IS NOT NULL AND i.selling_price > 0
          THEN ROUND(((i.selling_price - i.unit_cost) / NULLIF(i.selling_price, 0) * 100)::NUMERIC, 2)
          ELSE NULL
        END AS margin_percent
      FROM inventory_items i
      LEFT JOIN inventory_categories c ON i.category_id = c.id
      WHERE i.status NOT IN ('inactive','discontinued')
      ORDER BY (i.quantity_on_hand * i.unit_cost) DESC
    `);
    const rows = result.rows.map(toCamelCase);
    const totalValue = rows.reduce((s, r) => s + parseFloat(r.inventoryValue || 0), 0);
    res.json({ totalInventoryValue: totalValue, asOfDate: new Date().toISOString().split('T')[0], items: rows });
  } catch (err) {
    console.error('Error fetching valuation report:', err);
    res.status(500).json({ error: 'Failed to fetch valuation report' });
  }
});

// GET /api/inventory/reports/expiry-alerts
router.get('/reports/expiry-alerts', async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { daysAhead = 90 } = req.query;
    const result = await pool.query(`
      SELECT
        i.id, i.item_number, i.name, i.item_type, i.unit_of_measure,
        c.name AS category_name,
        s.name AS supplier_name,
        i.expiry_date, i.lot_number,
        i.quantity_on_hand, i.unit_cost,
        (i.expiry_date - CURRENT_DATE) AS days_until_expiry,
        CASE
          WHEN i.expiry_date < CURRENT_DATE THEN 'expired'
          WHEN i.expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'critical'
          WHEN i.expiry_date <= CURRENT_DATE + INTERVAL '60 days' THEN 'warning'
          ELSE 'attention'
        END AS alert_level
      FROM inventory_items i
      LEFT JOIN inventory_categories c ON i.category_id = c.id
      LEFT JOIN inventory_suppliers  s ON i.supplier_id  = s.id
      WHERE i.expiry_date IS NOT NULL
        AND i.expiry_date <= CURRENT_DATE + ($1 || ' days')::INTERVAL
        AND i.status = 'active'
        AND i.quantity_on_hand > 0
      ORDER BY i.expiry_date ASC
    `, [parseInt(daysAhead)]);
    res.json(result.rows.map(toCamelCase));
  } catch (err) {
    console.error('Error fetching expiry alerts:', err);
    res.status(500).json({ error: 'Failed to fetch expiry alerts' });
  }
});

// ─────────────────────────────────────────
// RBAC — Inventory Role Permissions
// ─────────────────────────────────────────

// GET /api/inventory/rbac/permissions
router.get('/rbac/permissions', authorize('admin', 'billing_manager'), async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const result = await pool.query(`
      SELECT irp.*, u.first_name || ' ' || u.last_name AS updated_by_name
      FROM inventory_role_permissions irp
      LEFT JOIN users u ON irp.updated_by = u.id
      ORDER BY irp.role_name, irp.resource
    `);
    res.json(result.rows.map(toCamelCase));
  } catch (err) {
    console.error('Error fetching RBAC permissions:', err);
    res.status(500).json({ error: 'Failed to fetch permissions' });
  }
});

// PUT /api/inventory/rbac/permissions
router.put('/rbac/permissions', authorize('admin'), async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    const { roleName, resource, canView, canCreate, canEdit, canDelete, canApprove, canExport } = req.body;
    if (!roleName || !resource) return res.status(400).json({ error: 'roleName and resource are required' });
    const validResources = ['items','categories','suppliers','stock_movements','purchase_orders'];
    if (!validResources.includes(resource)) {
      return res.status(400).json({ error: `resource must be one of: ${validResources.join(', ')}` });
    }
    const result = await pool.query(`
      INSERT INTO inventory_role_permissions (role_name, resource, can_view, can_create, can_edit, can_delete, can_approve, can_export, updated_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (role_name, resource) DO UPDATE SET
        can_view   = $3, can_create = $4, can_edit   = $5,
        can_delete = $6, can_approve = $7, can_export = $8,
        updated_by = $9, updated_at = NOW()
      RETURNING *
    `, [
      roleName, resource,
      canView   || false, canCreate  || false, canEdit   || false,
      canDelete || false, canApprove || false, canExport || false,
      req.user.id
    ]);
    res.json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Error updating RBAC permission:', err);
    if (err.code === '23514') return res.status(400).json({ error: 'Validation failed: ' + err.detail });
    res.status(500).json({ error: 'Failed to update permission' });
  }
});

// ─────────────────────────────────────────
// BACKUP
// ─────────────────────────────────────────

// GET /api/inventory/backup — list recent backups (metadata log)
router.get('/backup', authorize('admin'), async (req, res) => {
  try {
    const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
    // Return current snapshot metadata for reference
    const [itemCount, movCount, supplierCount, orderCount] = await Promise.all([
      pool.query('SELECT COUNT(*) AS cnt FROM inventory_items'),
      pool.query('SELECT COUNT(*) AS cnt FROM inventory_stock_movements'),
      pool.query('SELECT COUNT(*) AS cnt FROM inventory_suppliers'),
      pool.query('SELECT COUNT(*) AS cnt FROM inventory_purchase_orders')
    ]);
    res.json({
      backupHistory: [],  // Extend with a dedicated backup log table if needed
      currentSnapshot: {
        generatedAt: new Date().toISOString(),
        recordCounts: {
          items:          parseInt(itemCount.rows[0].cnt),
          movements:      parseInt(movCount.rows[0].cnt),
          suppliers:      parseInt(supplierCount.rows[0].cnt),
          purchaseOrders: parseInt(orderCount.rows[0].cnt)
        }
      }
    });
  } catch (err) {
    console.error('Error fetching backup info:', err);
    res.status(500).json({ error: 'Failed to fetch backup information' });
  }
});

// POST /api/inventory/backup — export full inventory data snapshot
router.post('/backup', authorize('admin'), async (req, res) => {
  const pool = req.db || req.app.locals.pool; // SEC-05: tenant-scoped per request
  const client = await req.app.locals.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL search_path TO ${req.tenant && /^[a-z_][a-z0-9_]*$/.test(req.tenant.schemaName || '') ? req.tenant.schemaName : 'public'}, public, control`); // SEC-05
    const [items, categories, suppliers, movements, orders, orderLines, permissions] = await Promise.all([
      client.query('SELECT * FROM inventory_items ORDER BY item_number'),
      client.query('SELECT * FROM inventory_categories ORDER BY code'),
      client.query('SELECT * FROM inventory_suppliers ORDER BY name'),
      client.query('SELECT * FROM inventory_stock_movements ORDER BY movement_date, created_at'),
      client.query('SELECT * FROM inventory_purchase_orders ORDER BY order_date'),
      client.query('SELECT * FROM inventory_purchase_order_lines ORDER BY po_id, line_number'),
      client.query('SELECT * FROM inventory_role_permissions ORDER BY role_name, resource')
    ]);
    await client.query('COMMIT');

    const backupData = {
      generatedAt:      new Date().toISOString(),
      generatedBy:      req.user.id,
      backupType:       'full',
      recordCounts: {
        items:          items.rows.length,
        categories:     categories.rows.length,
        suppliers:      suppliers.rows.length,
        movements:      movements.rows.length,
        purchaseOrders: orders.rows.length,
        orderLines:     orderLines.rows.length,
        permissions:    permissions.rows.length
      },
      data: {
        items:               items.rows,
        categories:          categories.rows,
        suppliers:           suppliers.rows,
        stockMovements:      movements.rows,
        purchaseOrders:      orders.rows,
        purchaseOrderLines:  orderLines.rows,
        rolePermissions:     permissions.rows
      }
    };

    const totalRecords = Object.values(backupData.recordCounts).reduce((s, v) => s + v, 0);
    const dataStr = JSON.stringify(backupData);
    const fileName = `inventory_backup_${new Date().toISOString().split('T')[0]}.json`;

    // Optionally push a copy to a connected cloud provider. An upload failure
    // must not lose the snapshot, so it is still returned and the problem
    // reported alongside it.
    let cloud = null;
    let cloudError = null;
    const destination = req.body?.destination;
    if (destination && cloudStorage.isSupported(destination)) {
      try {
        cloud = await cloudStorage.uploadBackup(pool, destination, fileName, backupData);
      } catch (uploadErr) {
        console.error(`Inventory backup upload to ${destination} failed:`, uploadErr);
        cloudError = uploadErr.message;
      }
    }

    res.status(201).json({
      fileName,
      fileSizeBytes: Buffer.byteLength(dataStr, 'utf8'),
      totalRecords,
      status: 'completed',
      cloud,
      cloudError,
      ...backupData
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating backup:', err);
    res.status(500).json({ error: 'Failed to create backup' });
  } finally {
    client.release();
  }
});

module.exports = router;
