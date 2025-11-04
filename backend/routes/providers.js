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

// Get all providers
router.get('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;

    // First check if user_id column exists in providers table
    const columnCheck = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'providers' AND column_name = 'user_id'
    `);

    const hasUserIdColumn = columnCheck.rows.length > 0;

    let result;
    if (hasUserIdColumn) {
      // If user_id column exists, join with users table
      result = await pool.query(`
        SELECT p.*, u.status, u.role
        FROM providers p
        LEFT JOIN users u ON p.user_id = u.id
        WHERE u.role = 'doctor' AND u.status = 'active' OR u.id IS NULL
        ORDER BY p.last_name, p.first_name ASC
      `);
    } else {
      // If user_id column doesn't exist yet, just get all providers
      result = await pool.query(`
        SELECT *
        FROM providers
        ORDER BY last_name, first_name ASC
      `);
    }

    const providers = result.rows.map(toCamelCase);
    res.json(providers);
  } catch (error) {
    console.error('Error fetching providers:', error);
    res.status(500).json({ error: 'Failed to fetch providers' });
  }
});

// Get single provider
router.get('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      `SELECT p.*, u.status, u.role
       FROM providers p
       LEFT JOIN users u ON p.user_id = u.id
       WHERE p.id::text = $1::text`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Provider not found' });
    }

    res.json(toCamelCase(result.rows[0]));
  } catch (error) {
    console.error('Error fetching provider:', error);
    res.status(500).json({ error: 'Failed to fetch provider' });
  }
});

// Create new provider
router.post('/', async (req, res) => {
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

// Update provider
router.put('/:id', async (req, res) => {
  const { firstName, first_name, lastName, last_name, specialization, email, phone } = req.body;

  try {
    const pool = req.app.locals.pool;

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
        req.params.id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Provider not found' });
    }

    res.json(toCamelCase(result.rows[0]));
  } catch (error) {
    console.error('Error updating provider:', error);
    res.status(500).json({ error: 'Failed to update provider' });
  }
});

// Delete provider
router.delete('/:id', async (req, res) => {
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
