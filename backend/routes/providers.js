const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');

// Helper function to convert snake_case to camelCase
const toCamelCase = (obj) => {
  const newObj = {};
  for (const key in obj) {
    const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
    newObj[camelKey] = obj[key];
  }
  return newObj;
};

// Get all providers (requires authentication)
// Admin/receptionist can see all, doctors can only see themselves
router.get('/', authenticate, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const userRole = req.user.role;
    const userId = req.user.id;

    // First check if user_id column exists in providers table
    const columnCheck = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'providers' AND column_name = 'user_id'
    `);

    const hasUserIdColumn = columnCheck.rows.length > 0;

    let result;

    // Role-based access control
    if (userRole === 'admin' || userRole === 'receptionist' || userRole === 'nurse') {
      // Admin, receptionist, and nurses can see all providers
      if (hasUserIdColumn) {
        result = await pool.query(`
          SELECT p.*, u.status, u.role
          FROM providers p
          LEFT JOIN users u ON p.user_id = u.id
          ORDER BY p.last_name, p.first_name ASC
        `);
      } else {
        result = await pool.query(`
          SELECT *
          FROM providers
          ORDER BY last_name, first_name ASC
        `);
      }
    } else if (userRole === 'doctor') {
      // Doctors can only see their own provider record
      if (hasUserIdColumn) {
        result = await pool.query(`
          SELECT p.*, u.status, u.role
          FROM providers p
          LEFT JOIN users u ON p.user_id = u.id
          WHERE p.user_id::text = $1::text
          ORDER BY p.last_name, p.first_name ASC
        `, [userId]);
      } else {
        // Fallback: filter by email if user_id column doesn't exist
        const userResult = await pool.query('SELECT email FROM users WHERE id::text = $1::text', [userId]);
        if (userResult.rows.length > 0) {
          result = await pool.query(`
            SELECT *
            FROM providers
            WHERE email = $1
            ORDER BY last_name, first_name ASC
          `, [userResult.rows[0].email]);
        } else {
          result = { rows: [] };
        }
      }
    } else {
      // Other roles (patient, etc.) cannot access provider management
      return res.status(403).json({
        error: 'Access denied',
        message: 'You do not have permission to access provider management'
      });
    }

    const providers = result.rows.map(toCamelCase);
    res.json(providers);
  } catch (error) {
    console.error('Error fetching providers:', error);
    res.status(500).json({ error: 'Failed to fetch providers' });
  }
});

// Get single provider (requires authentication)
router.get('/:id', authenticate, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const userRole = req.user.role;
    const userId = req.user.id;
    const providerId = req.params.id;

    const result = await pool.query(
      `SELECT p.*, u.status, u.role
       FROM providers p
       LEFT JOIN users u ON p.user_id = u.id
       WHERE p.id::text = $1::text`,
      [providerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Provider not found' });
    }

    const provider = result.rows[0];

    // Check access permissions
    if (userRole === 'doctor') {
      // Doctors can only view their own provider record
      if (provider.user_id && provider.user_id.toString() !== userId.toString()) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You can only view your own provider information'
        });
      }
    } else if (userRole !== 'admin' && userRole !== 'receptionist' && userRole !== 'nurse') {
      // Other roles cannot access provider details
      return res.status(403).json({
        error: 'Access denied',
        message: 'You do not have permission to view provider information'
      });
    }

    res.json(toCamelCase(provider));
  } catch (error) {
    console.error('Error fetching provider:', error);
    res.status(500).json({ error: 'Failed to fetch provider' });
  }
});

// Create new provider (admin/receptionist only)
router.post('/', authenticate, authorize('admin', 'receptionist'), async (req, res) => {
  const { firstName, first_name, lastName, last_name, specialization, email, phone, userId, user_id } = req.body;

  try {
    const pool = req.app.locals.pool;

    // Accept both camelCase and snake_case
    const finalFirstName = first_name || firstName || '';
    const finalLastName = last_name || lastName || '';
    const finalUserId = user_id || userId;

    const result = await pool.query(
      `INSERT INTO providers (first_name, last_name, specialization, email, phone, user_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [
        finalFirstName,
        finalLastName,
        specialization,
        email,
        phone,
        finalUserId
      ]
    );
    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (error) {
    console.error('Error creating provider:', error);
    res.status(500).json({ error: 'Failed to create provider' });
  }
});

// Update provider (admin/receptionist or own record for doctors)
router.put('/:id', authenticate, async (req, res) => {
  const { firstName, first_name, lastName, last_name, specialization, email, phone } = req.body;

  try {
    const pool = req.app.locals.pool;
    const userRole = req.user.role;
    const userId = req.user.id;
    const providerId = req.params.id;

    // Check if provider exists and get user_id
    const providerCheck = await pool.query(
      'SELECT * FROM providers WHERE id::text = $1::text',
      [providerId]
    );

    if (providerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Provider not found' });
    }

    const provider = providerCheck.rows[0];

    // Check access permissions
    if (userRole === 'doctor') {
      // Doctors can only update their own provider record
      if (provider.user_id && provider.user_id.toString() !== userId.toString()) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You can only update your own provider information'
        });
      }
    } else if (userRole !== 'admin' && userRole !== 'receptionist') {
      // Only admin, receptionist, and doctors can update provider records
      return res.status(403).json({
        error: 'Access denied',
        message: 'You do not have permission to update provider information'
      });
    }

    // Accept both camelCase and snake_case
    const finalFirstName = first_name || firstName;
    const finalLastName = last_name || lastName;

    const result = await pool.query(
      `UPDATE providers
       SET first_name = COALESCE($1, first_name),
           last_name = COALESCE($2, last_name),
           specialization = COALESCE($3, specialization),
           email = COALESCE($4, email),
           phone = COALESCE($5, phone),
           updated_at = NOW()
       WHERE id::text = $6::text
       RETURNING *`,
      [
        finalFirstName,
        finalLastName,
        specialization,
        email,
        phone,
        providerId
      ]
    );

    res.json(toCamelCase(result.rows[0]));
  } catch (error) {
    console.error('Error updating provider:', error);
    res.status(500).json({ error: 'Failed to update provider' });
  }
});

// Delete provider (admin only)
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      'DELETE FROM providers WHERE id::text = $1::text RETURNING *',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Provider not found' });
    }

    res.json({ message: 'Provider deleted successfully' });
  } catch (error) {
    console.error('Error deleting provider:', error);
    res.status(500).json({ error: 'Failed to delete provider' });
  }
});

module.exports = router;
