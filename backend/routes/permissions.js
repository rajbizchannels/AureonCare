const express = require('express');
const router = express.Router();

// Get all role permissions
router.get('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      'SELECT * FROM role_permissions ORDER BY role'
    );

    // Transform flat rows into nested object structure
    const permissions = {};
    result.rows.forEach(row => {
      if (!permissions[row.role]) {
        permissions[row.role] = {};
      }
      permissions[row.role][row.module] = {
        view: row.view_permission,
        create: row.create_permission,
        edit: row.edit_permission,
        delete: row.delete_permission
      };
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
    const result = await pool.query(
      'SELECT * FROM role_permissions WHERE role = $1 ORDER BY module',
      [req.params.role]
    );

    const permissions = {};
    result.rows.forEach(row => {
      permissions[row.module] = {
        view: row.view_permission,
        create: row.create_permission,
        edit: row.edit_permission,
        delete: row.delete_permission
      };
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

  try {
    const pool = req.app.locals.pool;

    // Begin transaction
    await pool.query('BEGIN');

    // Delete all existing permissions
    await pool.query('DELETE FROM role_permissions');

    // Insert new permissions
    for (const [role, modules] of Object.entries(permissions)) {
      for (const [module, actions] of Object.entries(modules)) {
        await pool.query(
          `INSERT INTO role_permissions (role, module, view_permission, create_permission, edit_permission, delete_permission)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [role, module, actions.view, actions.create, actions.edit, actions.delete]
        );
      }
    }

    // Commit transaction
    await pool.query('COMMIT');

    res.json({ message: 'Permissions updated successfully' });
  } catch (error) {
    // Rollback on error
    await pool.query('ROLLBACK');
    console.error('Error updating permissions:', error);
    res.status(500).json({ error: 'Failed to update permissions' });
  }
});

// Update permissions for a specific role
router.put('/:role', async (req, res) => {
  const { role } = req.params;
  const permissions = req.body;

  try {
    const pool = req.app.locals.pool;

    // Begin transaction
    await pool.query('BEGIN');

    // Delete existing permissions for this role
    await pool.query('DELETE FROM role_permissions WHERE role = $1', [role]);

    // Insert new permissions for this role
    for (const [module, actions] of Object.entries(permissions)) {
      await pool.query(
        `INSERT INTO role_permissions (role, module, view_permission, create_permission, edit_permission, delete_permission)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [role, module, actions.view, actions.create, actions.edit, actions.delete]
      );
    }

    // Commit transaction
    await pool.query('COMMIT');

    res.json({ message: `Permissions for ${role} updated successfully` });
  } catch (error) {
    // Rollback on error
    await pool.query('ROLLBACK');
    console.error('Error updating role permissions:', error);
    res.status(500).json({ error: 'Failed to update role permissions' });
  }
});

module.exports = router;
