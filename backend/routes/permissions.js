const express = require('express');
const router = express.Router();

// Get all role permissions (organized by role and module)
router.get('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;

    // Get all roles with their permissions
    const result = await pool.query(`
      SELECT
        r.name as role_name,
        r.display_name as role_display_name,
        p.module,
        p.action,
        p.name as permission_name
      FROM roles r
      LEFT JOIN role_permissions rp ON r.id = rp.role_id
      LEFT JOIN permissions p ON rp.permission_id = p.id
      WHERE r.is_active = true
      ORDER BY r.name, p.module, p.action
    `);

    // Transform into nested object structure: { role: { module: { view: true, create: false, ... } } }
    const permissions = {};
    result.rows.forEach(row => {
      if (!row.module) return; // Skip roles without permissions

      if (!permissions[row.role_name]) {
        permissions[row.role_name] = {};
      }
      if (!permissions[row.role_name][row.module]) {
        permissions[row.role_name][row.module] = {
          view: false,
          create: false,
          edit: false,
          delete: false
        };
      }

      // Set the action to true
      if (row.action && permissions[row.role_name][row.module][row.action] !== undefined) {
        permissions[row.role_name][row.module][row.action] = true;
      }
    });

    res.json(permissions);
  } catch (error) {
    console.error('Error fetching permissions:', error);
    res.status(500).json({ error: 'Failed to fetch permissions' });
  }
});

// Get permissions for a specific role
router.get('/:role', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { role } = req.params;

    const result = await pool.query(`
      SELECT
        p.module,
        p.action,
        p.name as permission_name,
        p.display_name as permission_display_name
      FROM roles r
      LEFT JOIN role_permissions rp ON r.id = rp.role_id
      LEFT JOIN permissions p ON rp.permission_id = p.id
      WHERE r.name = $1 AND r.is_active = true
      ORDER BY p.module, p.action
    `, [role]);

    // Transform into nested object structure: { module: { view: true, create: false, ... } }
    const permissions = {};
    result.rows.forEach(row => {
      if (!row.module) return; // Skip if no permissions

      if (!permissions[row.module]) {
        permissions[row.module] = {
          view: false,
          create: false,
          edit: false,
          delete: false
        };
      }

      // Set the action to true
      if (row.action && permissions[row.module][row.action] !== undefined) {
        permissions[row.module][row.action] = true;
      }
    });

    res.json(permissions);
  } catch (error) {
    console.error('Error fetching role permissions:', error);
    res.status(500).json({ error: 'Failed to fetch role permissions' });
  }
});

// Update all role permissions
router.put('/', async (req, res) => {
  const permissions = req.body;
  const pool = req.app.locals.pool;

  try {
    // Begin transaction
    await pool.query('BEGIN');

    // Get all role IDs
    const rolesResult = await pool.query('SELECT id, name FROM roles WHERE is_active = true');
    const roleMap = {};
    rolesResult.rows.forEach(r => {
      roleMap[r.name] = r.id;
    });

    // Get all permission IDs
    const permsResult = await pool.query('SELECT id, module, action FROM permissions');
    const permMap = {};
    permsResult.rows.forEach(p => {
      const key = `${p.module}.${p.action}`;
      permMap[key] = p.id;
    });

    // Delete all existing role permissions for non-system roles
    await pool.query('DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE is_system_role = false)');

    // Insert new permissions
    for (const [roleName, modules] of Object.entries(permissions)) {
      const roleId = roleMap[roleName];
      if (!roleId) continue; // Skip if role doesn't exist

      for (const [module, actions] of Object.entries(modules)) {
        for (const [action, enabled] of Object.entries(actions)) {
          if (enabled) {
            const permKey = `${module}.${action}`;
            const permId = permMap[permKey];
            if (permId) {
              await pool.query(
                'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT (role_id, permission_id) DO NOTHING',
                [roleId, permId]
              );
            }
          }
        }
      }
    }

    // Commit transaction
    await pool.query('COMMIT');

    res.json({ message: 'Permissions updated successfully' });
  } catch (error) {
    // Rollback on error
    try {
      await pool.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Error during rollback:', rollbackError);
    }
    console.error('Error updating permissions:', error);
    res.status(500).json({ error: 'Failed to update permissions' });
  }
});

// Update permissions for a specific role
router.put('/:role', async (req, res) => {
  const { role } = req.params;
  const permissions = req.body;
  const pool = req.app.locals.pool;

  try {
    // Begin transaction
    await pool.query('BEGIN');

    // Get role ID
    const roleResult = await pool.query('SELECT id, is_system_role FROM roles WHERE name = $1', [role]);
    if (roleResult.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ error: 'Role not found' });
    }

    const roleId = roleResult.rows[0].id;
    const isSystemRole = roleResult.rows[0].is_system_role;

    // Optionally prevent updating system roles
    // if (isSystemRole) {
    //   await pool.query('ROLLBACK');
    //   return res.status(403).json({ error: 'Cannot modify system role permissions' });
    // }

    // Get all permission IDs
    const permsResult = await pool.query('SELECT id, module, action FROM permissions');
    const permMap = {};
    permsResult.rows.forEach(p => {
      const key = `${p.module}.${p.action}`;
      permMap[key] = p.id;
    });

    // Delete existing permissions for this role
    await pool.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);

    // Insert new permissions for this role
    for (const [module, actions] of Object.entries(permissions)) {
      for (const [action, enabled] of Object.entries(actions)) {
        if (enabled) {
          const permKey = `${module}.${action}`;
          const permId = permMap[permKey];
          if (permId) {
            await pool.query(
              'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT (role_id, permission_id) DO NOTHING',
              [roleId, permId]
            );
          }
        }
      }
    }

    // Commit transaction
    await pool.query('COMMIT');

    res.json({ message: `Permissions for ${role} updated successfully` });
  } catch (error) {
    // Rollback on error
    try {
      await pool.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Error during rollback:', rollbackError);
    }
    console.error('Error updating role permissions:', error);
    res.status(500).json({ error: 'Failed to update role permissions' });
  }
});

module.exports = router;
