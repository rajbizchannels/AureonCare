const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { sendDbError } = require('../utils/dbErrors');
const router = express.Router();
router.use(authenticate);

// Reading the role list stays open to any signed-in user: it is a list of names, and the
// user-assignment dropdowns need it. CHANGING the list does not — and until now nothing
// guarded it at all, so any authenticated account, a nurse or a receptionist included,
// could create, rename and delete roles. With a name-only create form these three routes
// are the whole of role management, so they are the only thing standing between a
// non-admin and the shape of the practice's access control.
const requireAdmin = authorize('admin');

// Get all roles
// Query params:
//   - exclude_system=true: Exclude system roles (use for role management UI where you delete/edit roles)
//   - exclude_system=false or omitted: Include all roles (use for user assignment dropdowns)
// Note: System roles (admin, doctor, patient, etc.) can be ASSIGNED to users but cannot be DELETED
router.get('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { exclude_system } = req.query;

    // Build WHERE clause - exclude system roles if requested
    // System roles should still be shown in user assignment dropdowns
    const whereConditions = ['r.is_active = true'];
    if (exclude_system === 'true') {
      whereConditions.push('r.is_system_role = false');
    }
    const whereClause = whereConditions.join(' AND ');

    const result = await pool.query(`
      SELECT
        r.*,
        COUNT(DISTINCT ur.user_id) as user_count,
        COUNT(DISTINCT rp.permission_id) as permission_count
      FROM roles r
      LEFT JOIN user_roles ur ON r.id = ur.role_id
      LEFT JOIN role_permissions rp ON r.id = rp.role_id
      WHERE ${whereClause}
      GROUP BY r.id
      ORDER BY
        CASE r.name
          WHEN 'admin' THEN 1
          WHEN 'doctor' THEN 2
          WHEN 'patient' THEN 3
          WHEN 'nurse' THEN 4
          WHEN 'receptionist' THEN 5
          WHEN 'billing_manager' THEN 6
          WHEN 'crm_manager' THEN 7
          ELSE 8
        END,
        r.display_name
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
});

// Get role by ID with permissions
router.get('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;

    const roleResult = await pool.query(
      'SELECT * FROM roles WHERE id = $1',
      [req.params.id]
    );

    if (roleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }

    const permissionsResult = await pool.query(`
      SELECT p.*
      FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      WHERE rp.role_id = $1
      ORDER BY p.module, p.action
    `, [req.params.id]);

    const role = roleResult.rows[0];
    role.permissions = permissionsResult.rows;

    res.json(role);
  } catch (error) {
    console.error('Error fetching role:', error);
    res.status(500).json({ error: 'Failed to fetch role' });
  }
});

// Create new role
router.post('/', requireAdmin, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { name, display_name, description, permissions } = req.body;

    // Validate required fields
    if (!name || !display_name) {
      return res.status(400).json({ error: 'Name and display name are required' });
    }

    // Create role
    const roleResult = await pool.query(
      `INSERT INTO roles (name, display_name, description, is_system_role)
       VALUES ($1, $2, $3, false)
       RETURNING *`,
      [name.toLowerCase().replace(/\s+/g, '_'), display_name, description]
    );

    const newRole = roleResult.rows[0];

    // Assign permissions if provided
    if (permissions && Array.isArray(permissions)) {
      for (const permissionId of permissions) {
        await pool.query(
          'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [newRole.id, permissionId]
        );
      }
    }

    res.status(201).json(newRole);
  } catch (error) {
    console.error('Error creating role:', error);
    if (error.code === '23505') { // Unique violation
      res.status(400).json({ error: 'Role name already exists' });
    } else {
      // A constraint the request broke is the caller's to fix, not a server fault.
      if (sendDbError(res, error, 'Failed to create role')) return;
      res.status(500).json({ error: 'Failed to create role' });
    }
  }
});

// Update role
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { display_name, description, permissions, is_active } = req.body;

    // Check if role is system role
    const roleCheck = await pool.query(
      'SELECT is_system_role FROM roles WHERE id = $1',
      [req.params.id]
    );

    if (roleCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }

    // Update role
    const result = await pool.query(
      `UPDATE roles
       SET display_name = COALESCE($1, display_name),
           description = COALESCE($2, description),
           is_active = COALESCE($3, is_active),
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [display_name, description, is_active, req.params.id]
    );

    // Update permissions if provided
    if (permissions && Array.isArray(permissions)) {
      // Remove existing permissions
      await pool.query('DELETE FROM role_permissions WHERE role_id = $1', [req.params.id]);

      // Add new permissions
      for (const permissionId of permissions) {
        await pool.query(
          'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)',
          [req.params.id, permissionId]
        );
      }
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating role:', error);
    // A constraint the request broke is the caller's to fix, not a server fault.
    if (sendDbError(res, error, 'Failed to update role')) return;
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// Delete role (only custom roles)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const pool = req.app.locals.pool;

    // Check if role is system role
    const roleCheck = await pool.query(
      'SELECT is_system_role, name FROM roles WHERE id = $1',
      [req.params.id]
    );

    if (roleCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }

    if (roleCheck.rows[0].is_system_role) {
      return res.status(403).json({ error: 'Cannot delete system roles' });
    }

    // Who holds this role. Checked against users.role, which is where this application
    // actually keeps it — everything else reads it from there (req.user.role, the
    // permission registry, the enforcement middleware). The check used to count rows in
    // `user_roles`, a join table nothing in this codebase writes, so it always came back
    // zero and a role could be deleted out from under the people holding it.
    //
    // Deliberately NOT scoped to the caller's practice: `roles` is a global table, so a
    // name in use anywhere is a name that must not disappear.
    const userCheck = await pool.query(
      "SELECT COUNT(*) as count FROM users WHERE role = $1 AND status = 'active'",
      [roleCheck.rows[0].name]
    );

    if (parseInt(userCheck.rows[0].count) > 0) {
      return res.status(400).json({
        error: 'Cannot delete role assigned to users',
        userCount: userCheck.rows[0].count
      });
    }

    await pool.query('DELETE FROM roles WHERE id = $1', [req.params.id]);

    res.json({ message: 'Role deleted successfully' });
  } catch (error) {
    console.error('Error deleting role:', error);
    // A constraint the request broke is the caller's to fix, not a server fault.
    if (sendDbError(res, error, 'Failed to delete role')) return;
    res.status(500).json({ error: 'Failed to delete role' });
  }
});

// Get all permissions
router.get('/permissions/all', async (req, res) => {
  try {
    const pool = req.app.locals.pool;

    const result = await pool.query(`
      SELECT * FROM permissions
      ORDER BY module, action
    `);

    // Group by module
    const grouped = result.rows.reduce((acc, perm) => {
      if (!acc[perm.module]) {
        acc[perm.module] = [];
      }
      acc[perm.module].push(perm);
      return acc;
    }, {});

    res.json(grouped);
  } catch (error) {
    console.error('Error fetching permissions:', error);
    res.status(500).json({ error: 'Failed to fetch permissions' });
  }
});

module.exports = router;
