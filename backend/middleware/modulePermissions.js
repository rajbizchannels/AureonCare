// Enforce fine-grained module permissions.
//
// This is the piece the two older modules never had. inventory_role_permissions and
// account_role_permissions were written by their admin endpoints and read by nothing, so
// unticking Delete for a nurse changed a checkbox and nothing else: every route stayed
// gated by the coarse `authorize('admin', ...)` role check. A permissions screen whose
// switches do not take effect is worse than no screen, because an administrator reasonably
// believes the access is gone.
//
// TWO RULES THAT MATTER MORE THAN THE REST:
//
//   * ABSENCE IS NOT DENIAL. A practice that has never opened the permissions screen has no
//     rows. If "no row" meant "no access", deploying this would lock every practice out of
//     its own work at once. Missing rows fall back to the role defaults in
//     utils/permissionRegistry.js, which mirror how the application already behaves, so
//     switching enforcement on is a no-op until somebody edits something.
//
//   * AN ADMIN IS NEVER DENIED. A practice that can revoke its own administrators' access
//     to the permissions screen has no way back in. `admin` is allowed through before the
//     table is consulted at all.
//
// A denial is a 403 that says which permission was missing, because "Access denied" sends
// the administrator to support rather than to the screen where they can fix it.

const { isModule, isResource, isAction, defaultsFor, ALWAYS_ALLOWED_ROLE, MODULES } = require('../utils/permissionRegistry');

const COLUMN = {
  view: 'can_view', create: 'can_create', edit: 'can_edit',
  delete: 'can_delete', approve: 'can_approve', export: 'can_export',
};

/**
 * Read one grant, or null when nothing is stored.
 *
 * The two older modules keep their own tables, so their rows are read from there: an
 * administrator who set inventory permissions before this existed must not find their
 * settings quietly ignored. Where a legacy module has no row, module_permissions is
 * consulted too, so new edits can land in one place.
 */
async function loadGrant(db, module, role, resource) {
  const legacy = MODULES[module] && MODULES[module].legacyTable;
  if (legacy) {
    const { rows } = await db.query(
      `SELECT can_view, can_create, can_edit, can_delete, can_approve, can_export
         FROM ${legacy} WHERE role_name = $1 AND resource = $2 LIMIT 1`,
      [role, resource]);
    if (rows.length) return rows[0];
  }
  const { rows } = await db.query(
    `SELECT can_view, can_create, can_edit, can_delete, can_approve, can_export
       FROM module_permissions WHERE module = $1 AND role_name = $2 AND resource = $3 LIMIT 1`,
    [module, role, resource]);
  return rows[0] || null;
}

/**
 * Decide whether `role` may perform `action` on `module`/`resource`.
 *
 * Exported on its own because routes sometimes need the answer without a 403 — to hide a
 * field, or to choose between two queries — and because it is the part worth testing
 * directly.
 */
async function can(db, { role, module, resource, action }) {
  if (role === ALWAYS_ALLOWED_ROLE) return true;
  if (!isModule(module) || !isResource(module, resource) || !isAction(action)) {
    // A programming mistake, not a permission question. Fail closed and say so loudly:
    // silently returning true would make a typo in a route into an open door.
    console.error(`[modulePermissions] unknown module/resource/action: ${module}/${resource}/${action}`);
    return false;
  }

  let grant = null;
  try {
    grant = await loadGrant(db, module, role, resource);
  } catch (err) {
    // The table may not exist yet on a tenant that has not had tenant/011 applied. Falling
    // back to the defaults keeps that practice working rather than returning 500 on every
    // request; the deploy order (migrate, then migrate:tenants) closes the window.
    console.error(`[modulePermissions] could not read grants (${err.code || err.message}); using role defaults`);
    grant = null;
  }

  if (!grant) return defaultsFor(module, role)[action] === true;
  return grant[COLUMN[action]] === true;
}

/**
 * Express middleware: refuse the request unless the caller's role allows `action` on
 * `module`/`resource`.
 *
 * Mount it AFTER `authenticate`, which is what puts req.user in place.
 */
function requireModulePermission(module, resource, action) {
  return async (req, res, next) => {
    const role = req.user && (req.user.role || req.user.activeRole);
    if (!role) return res.status(401).json({ error: 'Authentication required' });

    const db = req.db || req.app.locals.pool;
    let allowed;
    try {
      allowed = await can(db, { role, module, resource, action });
    } catch (err) {
      console.error('[modulePermissions] permission check failed:', err.message);
      return res.status(500).json({ error: 'Could not check permissions' });
    }
    if (allowed) return next();

    return res.status(403).json({
      error: 'Access denied',
      // Named so an administrator can go straight to the switch rather than to support.
      message: `Your role (${role}) is not allowed to ${action} ${resource.replace(/_/g, ' ')}. `
        + 'An administrator can change this under Admin Panel → Roles & Permissions.',
      required: { module, resource, action },
    });
  };
}

/**
 * Pick the permission from the HTTP method, for mounting on a whole router.
 *
 * GET is `view`, POST `create`, PUT/PATCH `edit`, DELETE `delete`. Routes that mean
 * something else — approving a purchase order with a POST, exporting with a GET — declare
 * it explicitly with requireModulePermission instead.
 */
const METHOD_ACTION = { GET: 'view', HEAD: 'view', POST: 'create', PUT: 'edit', PATCH: 'edit', DELETE: 'delete' };

function requireModuleAccess(module, resource) {
  return (req, res, next) => {
    const action = METHOD_ACTION[req.method];
    if (!action) return next();
    return requireModulePermission(module, resource, action)(req, res, next);
  };
}

/**
 * Mount on a router that serves several resources under different paths.
 *
 * `map` takes the first path segment to a resource name. A segment that is not in the map
 * is left alone — which is what the `/rbac/permissions` endpoints need: gating the
 * permissions screen with the permissions it edits is how a practice locks itself out of
 * the one screen that could let it back in. Those endpoints keep their own admin-only
 * check.
 *
 * Needed because the inventory and accounts routers each serve five resources from one
 * router, so a single router-level mount would judge every one of them as `items`.
 */
function requireModuleAccessByPath(module, map) {
  return (req, res, next) => {
    const segment = String(req.path || '').split('/').filter(Boolean)[0];
    const resource = map[segment];
    if (!resource) return next();
    const action = METHOD_ACTION[req.method];
    if (!action) return next();
    return requireModulePermission(module, resource, action)(req, res, next);
  };
}

module.exports = {
  can, requireModulePermission, requireModuleAccess, requireModuleAccessByPath, COLUMN,
};
