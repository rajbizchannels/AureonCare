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
      SELECT *
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
      `SELECT *
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
  const { firstName, lastName, first_name, last_name, role, practice, avatar, email, phone, license, specialty, preferences, status, password } = req.body;

  try {
    const pool = req.app.locals.pool;
    const bcrypt = require('bcryptjs');

    // Accept both camelCase and snake_case
    const finalFirstName = first_name || firstName || '';
    const finalLastName = last_name || lastName || '';

    // Hash password if provided
    let passwordHash = null;
    if (password) {
      passwordHash = await bcrypt.hash(password, 10);
    }

    const result = await pool.query(
      `INSERT INTO users (first_name, last_name, role, avatar, email, phone, license_number, specialty, preferences, status, password_hash, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
       RETURNING *`,
      [
        finalFirstName,
        finalLastName,
        role || 'patient',
        avatar,
        email,
        phone,
        license,
        specialty,
        JSON.stringify(preferences || {}),
        status || 'pending',
        passwordHash
      ]
    );
    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user', details: error.message });
  }
});

// Update user
router.put('/:id', async (req, res) => {
  const { firstName, lastName, first_name, last_name, role, avatar, email, phone, license, specialty, preferences, status } = req.body;

  try {
    const pool = req.app.locals.pool;

    // Accept both camelCase and snake_case
    const finalFirstName = first_name || firstName;
    const finalLastName = last_name || lastName;

    // Get current user data to check for role changes
    const currentUserResult = await pool.query(
      'SELECT * FROM users WHERE id::text = $1::text',
      [req.params.id]
    );

    if (currentUserResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const currentUser = currentUserResult.rows[0];
    const oldRole = currentUser.role;
    const newRole = role || oldRole;

    const result = await pool.query(
      `UPDATE users
       SET first_name = COALESCE($1, first_name),
           last_name = COALESCE($2, last_name),
           role = COALESCE($3, role),
           avatar = COALESCE($4, avatar),
           email = COALESCE($5, email),
           phone = COALESCE($6, phone),
           license_number = COALESCE($7, license_number),
           specialty = COALESCE($8, specialty),
           preferences = COALESCE($9, preferences),
           status = COALESCE($10, status),
           updated_at = NOW()
       WHERE id::text = $11::text
       RETURNING *`,
      [
        finalFirstName,
        finalLastName,
        role,
        avatar,
        email,
        phone,
        license,
        specialty,
        preferences ? JSON.stringify(preferences) : null,
        status,
        req.params.id
      ]
    );

    const updatedUser = result.rows[0];

    // Handle role-based table synchronization
    if (oldRole !== newRole) {
      // Check if user_id column exists in providers and patients tables
      const providerColumnCheck = await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'providers' AND column_name = 'user_id'
      `);
      const patientColumnCheck = await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'patients' AND column_name = 'user_id'
      `);

      const hasProviderUserIdColumn = providerColumnCheck.rows.length > 0;
      const hasPatientUserIdColumn = patientColumnCheck.rows.length > 0;

      // If new role is doctor, add to providers table
      if (newRole === 'doctor') {
        // Check if already exists in providers
        const providerCheck = await pool.query(
          'SELECT id FROM providers WHERE email = $1',
          [updatedUser.email]
        );

        if (providerCheck.rows.length === 0) {
          if (hasProviderUserIdColumn) {
            // Include user_id if column exists
            await pool.query(
              `INSERT INTO providers (first_name, last_name, specialization, email, phone, user_id)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [
                updatedUser.first_name,
                updatedUser.last_name,
                updatedUser.specialty || 'General Practice',
                updatedUser.email,
                updatedUser.phone,
                updatedUser.id
              ]
            );
          } else {
            // Exclude user_id if column doesn't exist
            await pool.query(
              `INSERT INTO providers (first_name, last_name, specialization, email, phone)
               VALUES ($1, $2, $3, $4, $5)`,
              [
                updatedUser.first_name,
                updatedUser.last_name,
                updatedUser.specialty || 'General Practice',
                updatedUser.email,
                updatedUser.phone
              ]
            );
          }
        }

        // Remove from patients table if exists
        await pool.query(
          'DELETE FROM patients WHERE email = $1',
          [updatedUser.email]
        );
      }
      // If new role is patient, add to patients table
      else if (newRole === 'patient') {
        // Check if already exists in patients
        const patientCheck = await pool.query(
          'SELECT id FROM patients WHERE email = $1',
          [updatedUser.email]
        );

        if (patientCheck.rows.length === 0) {
          // Generate unique MRN
          const mrnResult = await pool.query(
            'SELECT MAX(CAST(SUBSTRING(mrn FROM 5) AS INTEGER)) as max_mrn FROM patients WHERE mrn LIKE \'MRN-%\''
          );
          const nextMrnNumber = (mrnResult.rows[0].max_mrn || 1000) + 1;
          const mrn = `MRN-${nextMrnNumber}`;

          if (hasPatientUserIdColumn) {
            // Include user_id if column exists
            await pool.query(
              `INSERT INTO patients (first_name, last_name, mrn, dob, email, phone, user_id, status)
               VALUES ($1, $2, $3, $4, $5, $6, $7, 'Active')`,
              [
                updatedUser.first_name,
                updatedUser.last_name,
                mrn,
                updatedUser.dob || '1990-01-01', // Default DOB if not provided
                updatedUser.email,
                updatedUser.phone,
                updatedUser.id
              ]
            );
          } else {
            // Exclude user_id if column doesn't exist
            await pool.query(
              `INSERT INTO patients (first_name, last_name, mrn, dob, email, phone, status)
               VALUES ($1, $2, $3, $4, $5, $6, 'Active')`,
              [
                updatedUser.first_name,
                updatedUser.last_name,
                mrn,
                updatedUser.dob || '1990-01-01', // Default DOB if not provided
                updatedUser.email,
                updatedUser.phone
              ]
            );
          }
        }

        // Remove from providers table if exists
        await pool.query(
          'DELETE FROM providers WHERE email = $1',
          [updatedUser.email]
        );
      }
    }

    res.json(toCamelCase(updatedUser));
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user', details: error.message });
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
