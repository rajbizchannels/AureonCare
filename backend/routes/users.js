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
      SELECT * FROM users
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
      'SELECT * FROM users WHERE id::text = $1::text',
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
  const { name, role, practice, avatar, email, phone, license, specialty, preferences } = req.body;

  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      `INSERT INTO users (name, role, practice, avatar, email, phone, license, specialty, preferences, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       RETURNING *`,
      [
        name,
        role || 'user',
        practice,
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
  const { name, role, practice, avatar, email, phone, license, specialty, preferences } = req.body;

  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      `UPDATE users
       SET name = COALESCE($1, name),
           role = COALESCE($2, role),
           practice = COALESCE($3, practice),
           avatar = COALESCE($4, avatar),
           email = COALESCE($5, email),
           phone = COALESCE($6, phone),
           license = COALESCE($7, license),
           specialty = COALESCE($8, specialty),
           preferences = COALESCE($9, preferences),
           updated_at = NOW()
       WHERE id::text = $10::text
       RETURNING *`,
      [
        name,
        role,
        practice,
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
