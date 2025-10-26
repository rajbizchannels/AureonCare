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

// Get all users
router.get('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(`
      SELECT *,
             CONCAT(first_name, ' ', last_name) as name
      FROM users
      ORDER BY id ASC
    `);
    const users = result.rows.map(toCamelCase);
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get single user
router.get('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      `SELECT *,
              CONCAT(first_name, ' ', last_name) as name
       FROM users
       WHERE id::text = $1::text`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(toCamelCase(result.rows[0]));
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Create new user
router.post('/', async (req, res) => {
  const { name, firstName, lastName, role, practice, avatar, email, phone, license, specialty, preferences } = req.body;

  try {
    const pool = req.app.locals.pool;

    // Parse name into first_name and last_name if provided as single field
    let first_name = firstName;
    let last_name = lastName;

    if (!first_name && !last_name && name) {
      const nameParts = name.trim().split(/\s+/);
      first_name = nameParts[0] || '';
      last_name = nameParts.slice(1).join(' ') || '';
    }

    const result = await pool.query(
      `INSERT INTO users (first_name, last_name, role, avatar, email, phone, license, specialty, preferences, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       RETURNING *, CONCAT(first_name, ' ', last_name) as name`,
      [
        first_name,
        last_name,
        role || 'user',
        avatar,
        email,
        phone,
        license,
        specialty,
        JSON.stringify(preferences || {})
      ]
    );
    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update user
router.put('/:id', async (req, res) => {
  const { name, firstName, lastName, role, avatar, email, phone, license, specialty, preferences } = req.body;

  try {
    const pool = req.app.locals.pool;

    // Parse name into first_name and last_name if provided as single field
    let first_name = firstName;
    let last_name = lastName;

    if (!first_name && !last_name && name) {
      const nameParts = name.trim().split(/\s+/);
      first_name = nameParts[0] || '';
      last_name = nameParts.slice(1).join(' ') || '';
    }

    const result = await pool.query(
      `UPDATE users
       SET first_name = COALESCE($1, first_name),
           last_name = COALESCE($2, last_name),
           role = COALESCE($3, role),
           avatar = COALESCE($4, avatar),
           email = COALESCE($5, email),
           phone = COALESCE($6, phone),
           license = COALESCE($7, license),
           specialty = COALESCE($8, specialty),
           preferences = COALESCE($9, preferences),
           updated_at = NOW()
       WHERE id::text = $10::text
       RETURNING *, CONCAT(first_name, ' ', last_name) as name`,
      [
        first_name,
        last_name,
        role,
        avatar,
        email,
        phone,
        license,
        specialty,
        preferences ? JSON.stringify(preferences) : null,
        req.params.id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(toCamelCase(result.rows[0]));
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user
router.delete('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      'DELETE FROM users WHERE id::text = $1::text RETURNING *',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router;
