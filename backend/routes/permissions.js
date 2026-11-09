const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const registry = require('../utils/permissionRegistry');
const { sendDbError } = require('../utils/dbErrors');
const router = express.Router();
router.use(authenticate);

// ─────────────────────────────────────────────────────────────────────────────
// Fine-grained module permissions
//
// ONE pair of endpoints for every module, where the pattern they generalise had a pair per
// module (/api/inventory/rbac/permissions, /api/accounts/rbac/permissions) and would have
// needed nine more. The registry decides which modules and resources exist, so the screen,
// the validator here and the enforcement middleware cannot disagree about them.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The registry plus every stored grant: everything the admin screen needs to draw itself.
 *
 * `effective` is the answer that is actually enforced — a stored row where one exists, the
 * role default where none does. The screen shows that, rather than an empty grid that
 * implies nobody can do anything, which is what a raw dump of the table would suggest for
 * a practice that has never edited its permissions.
 */
router.get('/modules', authorize('admin', 'billing_manager'), async (req, res) => {
  try {
    const db = req.db || req.app.locals.pool;

    // Roles this practice actually uses, so a custom role is grantable rather than
    // invisible. Read from the practice's own users (users is an identity-plane table in
    // `public`, scoped by practice_id) and from public.roles, which is empty on every
    // installation checked but costs nothing to consult.
    const extraRoles = [];
    try {
      const { rows } = await req.app.locals.pool.query(
        `SELECT DISTINCT role FROM public.users
          WHERE practice_id = $1 AND status = 'active' AND role IS NOT NULL
          UNION
         SELECT name FROM public.roles WHERE is_active = true`,
        [req.user.practiceId || null]);
      extraRoles.push(...rows.map((r) => r.role).filter(Boolean));
    } catch (err) {
      console.error('[permissions] could not list practice roles:', err.message);
    }

    const described = registry.describe(extraRoles);

    let stored = [];
    try {
      const { rows } = await db.query(
        `SELECT mp.module, mp.role_name, mp.resource, mp.can_view, mp.can_create, mp.can_edit,
                mp.can_delete, mp.can_approve, mp.can_export, mp.updated_at,
                u.first_name || ' ' || u.last_name AS updated_by_name
           FROM module_permissions mp
           LEFT JOIN users u ON u.id = mp.updated_by
          ORDER BY mp.module, mp.role_name, mp.resource`);
      stored = rows;
    } catch (err) {
      // The tenant may not have had tenant/011 applied yet. Say so in the payload rather
      // than failing the screen: the defaults are still the truth until a row is written.
      if (err.code !== '42P01') throw err;
      console.error('[permissions] module_permissions is missing for this tenant; run npm run migrate:tenants');
    }

    // Rows from the two modules that predate this table, so their existing settings are
    // shown and honoured rather than silently replaced by defaults.
    for (const [key, mod] of Object.entries(registry.MODULES)) {
      if (!mod.legacyTable) continue;
      try {
        const { rows } = await db.query(
          `SELECT $1::text AS module, role_name, resource, can_view, can_create, can_edit,
                  can_delete, can_approve, can_export, updated_at
             FROM ${mod.legacyTable}`, [key]);
        for (const row of rows) {
          // A row in the new table wins: that is where an edit made today lands.
          const already = stored.some((s) => s.module === key
            && s.role_name === row.role_name && s.resource === row.resource);
          if (!already) stored.push(row);
        }
      } catch (err) {
        if (err.code !== '42P01') throw err;
      }
    }

    const effective = [];
    for (const mod of described.modules) {
      for (const role of described.roles) {
        for (const resource of mod.resources) {
          const row = stored.find((s) => s.module === mod.key
            && s.role_name === role && s.resource === resource);
          effective.push({
            module: mod.key,
            roleName: role,
            resource,
            source: row ? 'stored' : 'default',
            editable: role !== described.alwaysAllowedRole,
            ...Object.fromEntries(described.actions.map((a) => [
              `can${a[0].toUpperCase()}${a.slice(1)}`,
              row ? row[`can_${a}`] === true : mod.defaults[role][a] === true,
            ])),
          });
        }
      }
    }

    res.json({ ...described, permissions: effective });
  } catch (error) {
    console.error('Error fetching module permissions:', error);
    res.status(500).json({ error: 'Failed to fetch module permissions' });
  }
});

/**
 * Save one grant.
 *
 * All six flags are written together rather than one at a time: a partial update would
 * make the result depend on whether a row already existed, so the same click would mean
 * different things on a fresh practice and an edited one.
 */
router.put('/modules', authorize('admin'), async (req, res) => {
  try {
    const db = req.db || req.app.locals.pool;
    const { module, roleName, resource } = req.body || {};

    if (!registry.isModule(module)) {
      return res.status(400).json({ error: `Unknown module "${module}"` });
    }
    if (!registry.isResource(module, resource)) {
      return res.status(400).json({
        error: `"${resource}" is not a resource of ${module}`,
        validResources: registry.MODULES[module].resources,
      });
    }
    // Validated against the roles this practice uses, not the built-in list alone: the read
    // endpoint offers custom roles, so refusing them here would put a switch on screen
    // that the server rejects.
    let allowedRoles = registry.ROLES;
    try {
      const { rows } = await req.app.locals.pool.query(
        `SELECT DISTINCT role AS name FROM public.users
          WHERE practice_id = $1 AND status = 'active' AND role IS NOT NULL
          UNION
         SELECT name FROM public.roles WHERE is_active = true`,
        [req.user.practiceId || null]);
      allowedRoles = registry.rolesFor(rows.map((r) => r.name).filter(Boolean));
    } catch (err) {
      console.error('[permissions] could not list practice roles:', err.message);
    }
    if (!allowedRoles.includes(roleName)) {
      return res.status(400).json({ error: `Unknown role "${roleName}"`, validRoles: allowedRoles });
    }
    // Refused rather than quietly ignored: an administrator who believes they have just
    // restricted their own role would be wrong, and would find out the hard way.
    if (roleName === registry.ALWAYS_ALLOWED_ROLE) {
      return res.status(400).json({
        error: `The ${registry.ALWAYS_ALLOWED_ROLE} role cannot be restricted`,
        message: 'Administrators always keep full access, so that a practice cannot lock '
          + 'itself out of this screen.',
      });
    }

    const flag = (name) => req.body[`can${name[0].toUpperCase()}${name.slice(1)}`] === true;
    const values = registry.ACTIONS.map(flag);

    const { rows } = await db.query(
      `INSERT INTO module_permissions
         (module, role_name, resource, can_view, can_create, can_edit, can_delete,
          can_approve, can_export, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (module, role_name, resource) DO UPDATE SET
         can_view = $4, can_create = $5, can_edit = $6, can_delete = $7,
         can_approve = $8, can_export = $9, updated_by = $10, updated_at = now()
       RETURNING *`,
      [module, roleName, resource, ...values, req.user.id]);

    const row = rows[0];
    res.json({
      module: row.module,
      roleName: row.role_name,
      resource: row.resource,
      source: 'stored',
      editable: true,
      ...Object.fromEntries(registry.ACTIONS.map((a) => [
        `can${a[0].toUpperCase()}${a.slice(1)}`, row[`can_${a}`] === true,
      ])),
    });
  } catch (error) {
    if (error.code === '42P01') {
      return res.status(503).json({
        error: 'Module permissions are not set up for this practice',
        message: 'Run the tenant migrations (npm run migrate:tenants) and try again.',
      });
    }
    console.error('Error saving module permission:', error);
    // A constraint the request broke is the caller's to fix, not a server fault.
    if (sendDbError(res, error, 'Failed to save module permission')) return;
    res.status(500).json({ error: 'Failed to save module permission' });
  }
});

/**
 * Drop a stored grant so the role falls back to its default.
 *
 * Worth having as its own verb: without it, "put it back how it was" means knowing what
 * the defaults were and re-entering them by hand.
 */
router.delete('/modules/:module/:roleName/:resource', authorize('admin'), async (req, res) => {
  try {
    const db = req.db || req.app.locals.pool;
    const { module, roleName, resource } = req.params;
    if (!registry.isModule(module) || !registry.isResource(module, resource)) {
      return res.status(400).json({ error: 'Unknown module or resource' });
    }
    await db.query(
      'DELETE FROM module_permissions WHERE module = $1 AND role_name = $2 AND resource = $3',
      [module, roleName, resource]);
    const mod = registry.describe().modules.find((m) => m.key === module);
    res.json({
      module, roleName, resource, source: 'default', editable: roleName !== registry.ALWAYS_ALLOWED_ROLE,
      ...Object.fromEntries(registry.ACTIONS.map((a) => [
        `can${a[0].toUpperCase()}${a.slice(1)}`, mod.defaults[roleName]?.[a] === true,
      ])),
    });
  } catch (error) {
    if (error.code === '42P01') return res.json({ reset: true });
    console.error('Error resetting module permission:', error);
    // A constraint the request broke is the caller's to fix, not a server fault.
    if (sendDbError(res, error, 'Failed to reset module permission')) return;
    res.status(500).json({ error: 'Failed to reset module permission' });
  }
});

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
    // A constraint the request broke is the caller's to fix, not a server fault.
    if (sendDbError(res, error, 'Failed to update permissions')) return;
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
    // A constraint the request broke is the caller's to fix, not a server fault.
    if (sendDbError(res, error, 'Failed to update role permissions')) return;
    res.status(500).json({ error: 'Failed to update role permissions' });
  }
});

module.exports = router;
