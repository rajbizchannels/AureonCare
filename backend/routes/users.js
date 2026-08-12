const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { getTimezoneFromCountry } = require('../utils/timezoneUtils');
const { enforceUserQuota, enforceProviderQuota } = require('../middleware/planEnforcement');

// All user routes require a valid JWT
router.use(authenticate);

// Reusable guard: passes if caller is admin OR is acting on their own record
const isSelfOrAdmin = (req, res, next) => {
  if (req.user.role === 'admin' || String(req.user.id) === String(req.params.id)) {
    return next();
  }
  return res.status(403).json({ error: 'Access denied' });
};

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

// Get all users — admin only
router.get('/', authorize('admin'), async (req, res) => {
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

// Get single user — admin or own user
router.get('/:id', isSelfOrAdmin, async (req, res) => {
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

// Create new user — admin only (quota + provider-seat checks run after)
router.post('/', authorize('admin'), enforceUserQuota, enforceProviderQuota, async (req, res) => {
  const { firstName, lastName, first_name, last_name, role, practice, avatar, email, phone, license, specialty, preferences, status, password } = req.body;

  try {
    const pool = req.app.locals.pool;
    const bcrypt = require('bcryptjs');

    // Ensure UUID extension is enabled
    await pool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    // Accept both camelCase and snake_case
    const finalFirstName = first_name || firstName || '';
    const finalLastName = last_name || lastName || '';

    // Hash password if provided
    let passwordHash = null;
    if (password) {
      passwordHash = await bcrypt.hash(password, 10);
    }

    // Explicitly generate UUID for id
    const result = await pool.query(
      `INSERT INTO users (id, first_name, last_name, role, avatar, email, phone, license_number, specialty, preferences, status, password_hash, created_at)
       VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
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
        status || 'active',
        passwordHash
      ]
    );

    const newUser = result.rows[0];

    // Auto-create ancillary role records — non-fatal so the user creation
    // response always succeeds even if these steps fail.

    if (newUser.role === 'doctor' && newUser.email) {
      // Create providers record with id = user.id (migration 025 schema)
      try {
        const providerCheck = await pool.query(
          'SELECT id FROM providers WHERE id = $1 OR email = $2 LIMIT 1',
          [newUser.id, newUser.email]
        );
        if (providerCheck.rows.length === 0) {
          await pool.query(
            `INSERT INTO providers (id, first_name, last_name, specialization, email, phone, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
            [newUser.id, newUser.first_name, newUser.last_name, newUser.specialty || 'General Practice', newUser.email, newUser.phone]
          );
        }
      } catch (providerErr) {
        console.error('Non-fatal: failed to auto-create provider record for new doctor user:', providerErr.message);
      }

      try {
        const doctorRoleResult = await pool.query(
          "SELECT id FROM roles WHERE name = 'doctor' AND is_active = true LIMIT 1"
        );
        if (doctorRoleResult.rows.length > 0) {
          await pool.query(
            `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [newUser.id, doctorRoleResult.rows[0].id]
          );
        }
      } catch (roleErr) {
        console.error('Non-fatal: failed to assign doctor role for new user:', roleErr.message);
      }
    }

    if ((newUser.role || 'patient') === 'patient' && newUser.email) {
      // Create patients record with id = user.id (migration 023 schema)
      try {
        const patientCheck = await pool.query(
          'SELECT id FROM patients WHERE id = $1 OR email = $2 LIMIT 1',
          [newUser.id, newUser.email]
        );

        if (patientCheck.rows.length === 0) {
          const mrnResult = await pool.query(
            "SELECT MAX(CAST(SUBSTRING(mrn FROM 5) AS INTEGER)) as max_mrn FROM patients WHERE mrn LIKE 'MRN-%'"
          );
          const nextMrnNumber = (mrnResult.rows[0].max_mrn || 1000) + 1;
          const mrn = `MRN-${nextMrnNumber}`;

          await pool.query(
            `INSERT INTO patients (id, first_name, last_name, mrn, date_of_birth, email, phone, status, created_at, updated_at)
             VALUES ($1, $2, $3, $4, '1990-01-01', $5, $6, 'active', NOW(), NOW())`,
            [newUser.id, newUser.first_name, newUser.last_name, mrn, newUser.email, newUser.phone]
          );
        }
      } catch (patientErr) {
        console.error('Non-fatal: failed to auto-create patient record for new user:', patientErr.message);
      }

      try {
        const patientRoleResult = await pool.query(
          "SELECT id FROM roles WHERE name = 'patient' AND is_active = true LIMIT 1"
        );
        if (patientRoleResult.rows.length > 0) {
          await pool.query(
            `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [newUser.id, patientRoleResult.rows[0].id]
          );
        }
      } catch (roleErr) {
        console.error('Non-fatal: failed to assign patient role for new user:', roleErr.message);
      }
    }

    res.status(201).json(toCamelCase(newUser));
  } catch (error) {
    console.error('Error creating user:', error);

    // Handle duplicate email error
    if (error.code === '23505' && error.constraint === 'users_email_key') {
      return res.status(409).json({
        error: 'Email already exists',
        message: 'A user with this email address already exists. Please use a different email.'
      });
    }

    // Handle other constraint violations
    if (error.code === '23505') {
      return res.status(409).json({
        error: 'Duplicate entry',
        message: 'This user information conflicts with an existing user.'
      });
    }

    res.status(500).json({ error: 'Failed to create user', details: error.message });
  }
});

// Update user — admin or own user
router.put('/:id', isSelfOrAdmin, async (req, res) => {
  const { firstName, lastName, first_name, last_name, role, avatar, email, phone, address, practice, license, specialty, preferences, status, language, country, password } = req.body;

  try {
    const pool = req.app.locals.pool;
    const bcrypt = require('bcryptjs');

    // SEC-01: privilege fields (role, status) may only be changed by an admin.
    // A non-admin editing their own record (isSelfOrAdmin) must not be able to
    // escalate to 'admin' or flip account status — silently ignore those fields.
    const isAdmin = req.user.role === 'admin';
    const safeRole = isAdmin ? role : undefined;
    const safeStatus = isAdmin ? status : undefined;
    if (!isAdmin && (role !== undefined || status !== undefined)) {
      console.log(`[DEBUG sec01-rbac] non-admin user ${req.user.id} attempted role/status change on ${req.params.id} (role=${role}, status=${status}) — ignored`);
    }

    // Accept both camelCase and snake_case
    const finalFirstName = first_name || firstName;
    const finalLastName = last_name || lastName;

    // Calculate timezone from country if country is provided
    let timezone = null;
    if (country) {
      timezone = getTimezoneFromCountry(country);
    }

    // Hash password if provided
    let passwordHash = null;
    if (password) {
      passwordHash = await bcrypt.hash(password, 10);
    }

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
    const newRole = safeRole || oldRole;

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
           preferences = CASE WHEN $9::jsonb IS NOT NULL
                              THEN preferences || $9::jsonb
                              ELSE preferences END,
           status = COALESCE($10, status),
           language = COALESCE($11, language),
           country = COALESCE($12, country),
           timezone = COALESCE($13, timezone),
           password_hash = COALESCE($14, password_hash),
           updated_at = NOW()
       WHERE id::text = $15::text
       RETURNING *`,
      [
        finalFirstName,
        finalLastName,
        safeRole,
        avatar,
        email,
        phone,
        license,
        specialty,
        preferences ? JSON.stringify(preferences) : null,
        safeStatus,
        language,
        country,
        timezone,
        passwordHash,
        req.params.id,
      ]
    );

    const updatedUser = result.rows[0];

    // Handle role-based table synchronization
    if (oldRole !== newRole) {
      // If new role is doctor, ensure a providers record exists with id = user.id
      if (newRole === 'doctor') {
        const providerCheck = await pool.query(
          'SELECT id FROM providers WHERE id = $1 OR email = $2 LIMIT 1',
          [updatedUser.id, updatedUser.email]
        );

        if (providerCheck.rows.length === 0) {
          // providers.id = users.id (migration 025 schema)
          await pool.query(
            `INSERT INTO providers (id, first_name, last_name, specialization, email, phone, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
            [
              updatedUser.id,
              updatedUser.first_name,
              updatedUser.last_name,
              updatedUser.specialty || 'General Practice',
              updatedUser.email,
              updatedUser.phone
            ]
          );
        }

        // NOTE: We do NOT remove from patients table — a user can be both a doctor
        // and a patient; medical records and FK integrity must be preserved.
      }
      // If new role is patient, ensure a patients record exists with id = user.id
      else if (newRole === 'patient') {
        const patientCheck = await pool.query(
          'SELECT id FROM patients WHERE id = $1 OR email = $2 LIMIT 1',
          [updatedUser.id, updatedUser.email]
        );

        if (patientCheck.rows.length === 0) {
          const mrnResult = await pool.query(
            "SELECT MAX(CAST(SUBSTRING(mrn FROM 5) AS INTEGER)) as max_mrn FROM patients WHERE mrn LIKE 'MRN-%'"
          );
          const nextMrnNumber = (mrnResult.rows[0].max_mrn || 1000) + 1;
          const mrn = `MRN-${nextMrnNumber}`;

          // patients.id = users.id (migration 023 schema)
          await pool.query(
            `INSERT INTO patients (id, first_name, last_name, mrn, date_of_birth, email, phone, status, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', NOW(), NOW())`,
            [
              updatedUser.id,
              updatedUser.first_name,
              updatedUser.last_name,
              mrn,
              updatedUser.dob || updatedUser.date_of_birth || '1990-01-01',
              updatedUser.email,
              updatedUser.phone
            ]
          );
        }

        // NOTE: We do NOT remove from providers table — historical appointment data
        // and FK integrity must be preserved.
      }
    }

    res.json(toCamelCase(updatedUser));
  } catch (error) {
    console.error('Error updating user:', error);

    // Handle duplicate email error
    if (error.code === '23505' && error.constraint === 'users_email_key') {
      return res.status(409).json({
        error: 'Email already exists',
        message: 'A user with this email address already exists. Please use a different email.'
      });
    }

    // Handle other constraint violations
    if (error.code === '23505') {
      return res.status(409).json({
        error: 'Duplicate entry',
        message: 'This user information conflicts with an existing user.'
      });
    }

    res.status(500).json({ error: 'Failed to update user', details: error.message });
  }
});

// Delete user — admin only
router.delete('/:id', authorize('admin'), async (req, res) => {
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

// Update user language preference — admin or own user
router.put('/:id/language', isSelfOrAdmin, async (req, res) => {
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

// Switch active role — own user only
router.put('/:id/switch-role', isSelfOrAdmin, async (req, res) => {
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

// Get user's roles — admin or own user
router.get('/:id/roles', isSelfOrAdmin, async (req, res) => {
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

// Assign role to user — admin only
router.post('/:id/roles', authorize('admin'), async (req, res) => {
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

// Remove role from user — admin only
router.delete('/:id/roles/:role_id', authorize('admin'), async (req, res) => {
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
