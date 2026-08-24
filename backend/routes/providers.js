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

    let result;

    // providers.id = users.id in current schema (migration 025)
    if (userRole === 'admin' || userRole === 'receptionist' || userRole === 'nurse' || userRole === 'patient') {
      // SEC-05: providers are staff — scope to the caller's practice via users.practice_id
      // (providers.id = users.id).
      result = await pool.query(`
        SELECT p.*, u.status, u.role
        FROM providers p
        JOIN users u ON p.id = u.id
        WHERE u.practice_id = $1
        ORDER BY p.last_name, p.first_name ASC
      `, [req.user.practiceId || null]);
    } else if (userRole === 'doctor') {
      result = await pool.query(`
        SELECT p.*, u.status, u.role
        FROM providers p
        LEFT JOIN users u ON p.id = u.id
        WHERE p.id::text = $1::text
        ORDER BY p.last_name, p.first_name ASC
      `, [userId]);
    } else {
      // Other roles cannot access provider management
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

    // SEC-05: only providers in the caller's practice (self always allowed).
    const result = await pool.query(
      `SELECT p.*, u.status, u.role
       FROM providers p
       JOIN users u ON p.id = u.id
       WHERE p.id::text = $1::text
         AND (p.id::text = $2::text OR u.practice_id = $3)`,
      [providerId, userId, req.user.practiceId || null]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Provider not found' });
    }

    const provider = result.rows[0];

    // providers.id = users.id in current schema
    if (userRole === 'doctor') {
      if (provider.id && provider.id.toString() !== userId.toString()) {
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
// userId / user_id in the request body is the linked users.id — becomes providers.id
router.post('/', authenticate, authorize('admin', 'receptionist'), async (req, res) => {
  const { firstName, first_name, lastName, last_name, specialization, email, phone, userId, user_id } = req.body;

  try {
    const pool = req.app.locals.pool;

    // Accept both camelCase and snake_case
    const finalFirstName = first_name || firstName || '';
    const finalLastName = last_name || lastName || '';
    const finalUserId = user_id || userId;

    if (!finalUserId) {
      return res.status(400).json({ error: 'userId is required — providers.id must equal users.id' });
    }

    // providers.id = users.id (migration 025 schema)
    const result = await pool.query(
      `INSERT INTO providers (id, first_name, last_name, specialization, email, phone, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [finalUserId, finalFirstName, finalLastName, specialization, email, phone]
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

    // Check if provider exists and get user_id — SEC-05: scope to caller's practice
    // (self always allowed). providers.id = users.id.
    const providerCheck = await pool.query(
      `SELECT p.* FROM providers p
       JOIN users u ON p.id = u.id
       WHERE p.id::text = $1::text
         AND (p.id::text = $2::text OR u.practice_id = $3)`,
      [providerId, userId, req.user.practiceId || null]
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
    // SEC-05: only delete a provider whose linked user is in the caller's practice.
    const result = await pool.query(
      `DELETE FROM providers WHERE id::text = $1::text
         AND id IN (SELECT id FROM users WHERE practice_id = $2) RETURNING *`,
      [req.params.id, req.user.practiceId || null]
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
