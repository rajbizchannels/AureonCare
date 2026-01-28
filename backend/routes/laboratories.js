const express = require('express');
const router = express.Router();

// Helper function to convert snake_case to camelCase
const toCamelCase = (obj) => {
  const newObj = {};
  for (const key in obj) {
    const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
    newObj[camelKey] = obj[key];
  }
  return newObj;
};

// Helper function to ensure laboratories table exists
let tableChecked = false;
const ensureTableExists = async (pool) => {
  if (tableChecked) {
    return;
  }

  try {
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'laboratories'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('Creating laboratories table...');
      await pool.query(`
        CREATE TABLE laboratories (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          lab_name VARCHAR(255) NOT NULL,
          address_line1 VARCHAR(255),
          address_line2 VARCHAR(255),
          city VARCHAR(100),
          state VARCHAR(2),
          zip_code VARCHAR(10),
          phone VARCHAR(20),
          fax VARCHAR(20),
          email VARCHAR(255),
          website VARCHAR(255),
          clia_number VARCHAR(50),
          npi VARCHAR(20),
          is_active BOOLEAN DEFAULT true,
          accepts_electronic_orders BOOLEAN DEFAULT true,
          specialty VARCHAR(100),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('✓ Laboratories table created successfully');
    }

    tableChecked = true;
  } catch (error) {
    console.error('Error ensuring laboratories table:', error);
    tableChecked = true;
  }
};

// Get all laboratories
router.get('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    await ensureTableExists(pool);

    const { is_active } = req.query;

    let query = 'SELECT * FROM laboratories';
    const params = [];

    if (is_active !== undefined) {
      query += ' WHERE is_active = $1';
      params.push(is_active === 'true');
    }

    query += ' ORDER BY lab_name';

    const result = await pool.query(query, params);
    res.json(result.rows.map(toCamelCase));
  } catch (error) {
    console.error('Error fetching laboratories:', error);
    res.status(500).json({ error: 'Failed to fetch laboratories' });
  }
});

// Get laboratory by ID
router.get('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    await ensureTableExists(pool);

    const result = await pool.query(
      'SELECT * FROM laboratories WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Laboratory not found' });
    }

    res.json(toCamelCase(result.rows[0]));
  } catch (error) {
    console.error('Error fetching laboratory:', error);
    res.status(500).json({ error: 'Failed to fetch laboratory' });
  }
});

// Create new laboratory
router.post('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    await ensureTableExists(pool);

    const {
      labName,
      addressLine1,
      addressLine2,
      city,
      state,
      zipCode,
      phone,
      fax,
      email,
      website,
      cliaNumber,
      npi,
      isActive,
      acceptsElectronicOrders,
      specialty
    } = req.body;

    const result = await pool.query(
      `INSERT INTO laboratories (
        lab_name, address_line1, address_line2, city, state, zip_code,
        phone, fax, email, website, clia_number, npi,
        is_active, accepts_electronic_orders, specialty
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        labName,
        addressLine1 || null,
        addressLine2 || null,
        city || null,
        state || null,
        zipCode || null,
        phone || null,
        fax || null,
        email || null,
        website || null,
        cliaNumber || null,
        npi || null,
        isActive !== undefined ? isActive : true,
        acceptsElectronicOrders !== undefined ? acceptsElectronicOrders : true,
        specialty || null
      ]
    );

    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (error) {
    console.error('Error creating laboratory:', error);
    res.status(500).json({ error: 'Failed to create laboratory' });
  }
});

// Update laboratory
router.put('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    await ensureTableExists(pool);

    const {
      labName,
      addressLine1,
      addressLine2,
      city,
      state,
      zipCode,
      phone,
      fax,
      email,
      website,
      cliaNumber,
      npi,
      isActive,
      acceptsElectronicOrders,
      specialty
    } = req.body;

    const result = await pool.query(
      `UPDATE laboratories SET
        lab_name = COALESCE($1, lab_name),
        address_line1 = COALESCE($2, address_line1),
        address_line2 = COALESCE($3, address_line2),
        city = COALESCE($4, city),
        state = COALESCE($5, state),
        zip_code = COALESCE($6, zip_code),
        phone = COALESCE($7, phone),
        fax = COALESCE($8, fax),
        email = COALESCE($9, email),
        website = COALESCE($10, website),
        clia_number = COALESCE($11, clia_number),
        npi = COALESCE($12, npi),
        is_active = COALESCE($13, is_active),
        accepts_electronic_orders = COALESCE($14, accepts_electronic_orders),
        specialty = COALESCE($15, specialty),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $16
      RETURNING *`,
      [
        labName,
        addressLine1,
        addressLine2,
        city,
        state,
        zipCode,
        phone,
        fax,
        email,
        website,
        cliaNumber,
        npi,
        isActive,
        acceptsElectronicOrders,
        specialty,
        req.params.id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Laboratory not found' });
    }

    res.json(toCamelCase(result.rows[0]));
  } catch (error) {
    console.error('Error updating laboratory:', error);
    res.status(500).json({ error: 'Failed to update laboratory' });
  }
});

// Delete laboratory
router.delete('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    await ensureTableExists(pool);

    const result = await pool.query(
      'DELETE FROM laboratories WHERE id = $1 RETURNING *',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Laboratory not found' });
    }

    res.json({ message: 'Laboratory deleted successfully', laboratory: toCamelCase(result.rows[0]) });
  } catch (error) {
    console.error('Error deleting laboratory:', error);
    res.status(500).json({ error: 'Failed to delete laboratory' });
  }
});

module.exports = router;
