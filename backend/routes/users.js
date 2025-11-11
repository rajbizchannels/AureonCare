const express = require('express');
const router = express.Router();

// Helper function to convert snake_case to camelCase
const toCamelCase = (obj) => {
  const newObj = {};
  for (const key in obj) {
    const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
    let value = obj[key];

    // Parse JSON fields if they're strings
    if (camelKey === 'preferences' && typeof value === 'string') {
      try {
        value = JSON.parse(value);
      } catch (e) {
        // If parsing fails, keep as string
      }
    }

    newObj[camelKey] = value;
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
  const { firstName, lastName, first_name, last_name, role, avatar, email, phone, license, specialty, preferences, status, language } = req.body;

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
           language = COALESCE($11, language),
           updated_at = NOW()
       WHERE id::text = $12::text
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
        language,
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

        // NOTE: We do NOT remove from patients table
        // A user can be both a doctor (provider) and a patient
        // Medical records (FHIR resources) must be preserved
        // This prevents foreign key constraint violations
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

        // NOTE: We do NOT remove from providers table
        // A user can have multiple roles (e.g., a doctor who becomes a patient)
        // Provider records should be preserved for historical appointment data
        // This maintains referential integrity with appointments and other records
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

// Update user language preference
router.put('/:id/language', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { language } = req.body;

    if (!language) {
      return res.status(400).json({ error: 'Language is required' });
    }

    // Supported languages
    const supportedLanguages = ['en', 'es', 'fr', 'de', 'pt', 'zh', 'ar', 'hi'];
    if (!supportedLanguages.includes(language)) {
      return res.status(400).json({
        error: 'Unsupported language',
        supported: supportedLanguages
      });
    }

    const result = await pool.query(
      `UPDATE users
       SET language = $1, updated_at = NOW()
       WHERE id::text = $2::text
       RETURNING *`,
      [language, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(toCamelCase(result.rows[0]));
  } catch (error) {
    console.error('Error updating language:', error);
    res.status(500).json({ error: 'Failed to update language' });
  }
});

// Switch active role (for users with multiple roles)
router.put('/:id/switch-role', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { role_name } = req.body;

    if (!role_name) {
      return res.status(400).json({ error: 'Role name is required' });
    }

    // Check if user has this role
    const roleCheck = await pool.query(`
      SELECT r.id, r.name, r.display_name
      FROM roles r
      JOIN user_roles ur ON r.id = ur.role_id
      WHERE ur.user_id::text = $1::text AND r.name = $2
    `, [req.params.id, role_name]);

    if (roleCheck.rows.length === 0) {
      return res.status(403).json({
        error: 'User does not have this role',
        requested_role: role_name
      });
    }

    // Update active role
    const result = await pool.query(
      `UPDATE users
       SET active_role = $1, role = $1, updated_at = NOW()
       WHERE id::text = $2::text
       RETURNING *`,
      [role_name, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'Role switched successfully',
      user: toCamelCase(result.rows[0]),
      new_role: roleCheck.rows[0]
    });
  } catch (error) {
    console.error('Error switching role:', error);
    res.status(500).json({ error: 'Failed to switch role' });
  }
});

// Get user's roles
router.get('/:id/roles', async (req, res) => {
  try {
    const pool = req.app.locals.pool;

    const result = await pool.query(`
      SELECT r.id, r.name, r.display_name, r.description,
             ur.assigned_at,
             CASE WHEN u.active_role = r.name THEN true ELSE false END as is_active
      FROM roles r
      JOIN user_roles ur ON r.id = ur.role_id
      JOIN users u ON ur.user_id = u.id
      WHERE ur.user_id::text = $1::text
      ORDER BY is_active DESC, r.display_name
    `, [req.params.id]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching user roles:', error);
    res.status(500).json({ error: 'Failed to fetch user roles' });
  }
});

// Assign role to user
router.post('/:id/roles', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { role_id, assigned_by } = req.body;

    if (!role_id) {
      return res.status(400).json({ error: 'Role ID is required' });
    }

    // Check if role exists
    const roleCheck = await pool.query(
      'SELECT * FROM roles WHERE id = $1 AND is_active = true',
      [role_id]
    );

    if (roleCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }

    const role = roleCheck.rows[0];

    // Check if already assigned
    const existingCheck = await pool.query(
      'SELECT * FROM user_roles WHERE user_id::text = $1::text AND role_id = $2',
      [req.params.id, role_id]
    );

    if (existingCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Role already assigned to user' });
    }

    // Assign role
    await pool.query(
      `INSERT INTO user_roles (user_id, role_id, assigned_by)
       VALUES ($1, $2, $3)`,
      [req.params.id, role_id, assigned_by || null]
    );

    // If this is the first role or user doesn't have an active role, set it as active
    const userCheck = await pool.query(
      'SELECT active_role FROM users WHERE id::text = $1::text',
      [req.params.id]
    );

    if (userCheck.rows.length > 0 && !userCheck.rows[0].active_role) {
      await pool.query(
        'UPDATE users SET active_role = $1, role = $1 WHERE id::text = $2::text',
        [role.name, req.params.id]
      );
    }

    res.json({
      message: 'Role assigned successfully',
      role: role
    });
  } catch (error) {
    console.error('Error assigning role:', error);
    res.status(500).json({ error: 'Failed to assign role' });
  }
});

// Remove role from user
router.delete('/:id/roles/:role_id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;

    // Check if user has other roles
    const rolesCheck = await pool.query(
      'SELECT COUNT(*) as count FROM user_roles WHERE user_id::text = $1::text',
      [req.params.id]
    );

    if (parseInt(rolesCheck.rows[0].count) <= 1) {
      return res.status(400).json({ error: 'Cannot remove last role from user' });
    }

    // Remove role
    const result = await pool.query(
      'DELETE FROM user_roles WHERE user_id::text = $1::text AND role_id = $2 RETURNING *',
      [req.params.id, req.params.role_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Role assignment not found' });
    }

    // If removed role was active, switch to another role
    const userCheck = await pool.query(
      'SELECT active_role FROM users WHERE id::text = $1::text',
      [req.params.id]
    );

    const roleCheck = await pool.query(
      'SELECT name FROM roles WHERE id = $1',
      [req.params.role_id]
    );

    if (userCheck.rows.length > 0 && roleCheck.rows.length > 0 &&
        userCheck.rows[0].active_role === roleCheck.rows[0].name) {
      // Get first remaining role
      const newRole = await pool.query(`
        SELECT r.name
        FROM roles r
        JOIN user_roles ur ON r.id = ur.role_id
        WHERE ur.user_id::text = $1::text
        LIMIT 1
      `, [req.params.id]);

      if (newRole.rows.length > 0) {
        await pool.query(
          'UPDATE users SET active_role = $1, role = $1 WHERE id::text = $2::text',
          [newRole.rows[0].name, req.params.id]
        );
      }
    }

    res.json({ message: 'Role removed successfully' });
  } catch (error) {
    console.error('Error removing role:', error);
    res.status(500).json({ error: 'Failed to remove role' });
  }
});

module.exports = router;
