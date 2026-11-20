-- Fine-grained, per-module permissions — for every module, not two of them.
--
-- WHAT WAS THERE. Two modules had this: inventory_role_permissions and
-- account_role_permissions, identical in shape (role x resource x six actions), each with
-- its own /rbac/permissions pair of endpoints and its own hand-written table in the admin
-- panel. Copying that a further eleven times would mean eleven more tables, twenty-two
-- more endpoints and eleven more hand-written grids, all drifting apart. This is one table
-- with a `module` column instead.
--
-- AND A WARNING ABOUT THOSE TWO. Nothing ever read them. Both are written by their admin
-- endpoints, dumped by the inventory backup, and consulted by no route: every inventory
-- and accounts endpoint is still gated by the coarse `authorize('admin', ...)` role check
-- alone. So an administrator could untick Delete for a nurse, watch the box go grey, and
-- the nurse could still delete. The middleware added alongside this migration
-- (middleware/modulePermissions.js) is what makes a grant mean something, and it covers
-- the two older modules as well by reading their rows through this same table.
--
-- Tenant-scoped, like the two tables it generalises: a practice decides its own access
-- rules, and `role_name` is that practice's own role list.
--
-- Idempotent.

CREATE TABLE IF NOT EXISTS module_permissions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Deliberately NOT a CHECK constraint listing the modules. The registry in
  -- utils/permissionRegistry.js is the single source of truth, and a CHECK here would be a
  -- second one that has to be migrated in lockstep every time a module gains a resource —
  -- the route validates against the registry before writing.
  module        varchar(50)  NOT NULL,
  role_name     varchar(50)  NOT NULL,
  resource      varchar(60)  NOT NULL,
  can_view      boolean NOT NULL DEFAULT false,
  can_create    boolean NOT NULL DEFAULT false,
  can_edit      boolean NOT NULL DEFAULT false,
  can_delete    boolean NOT NULL DEFAULT false,
  can_approve   boolean NOT NULL DEFAULT false,
  can_export    boolean NOT NULL DEFAULT false,
  updated_by    uuid REFERENCES users(id),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (module, role_name, resource)
);

-- No index on (module, role_name, resource): the UNIQUE constraint above already creates
-- a btree on exactly those columns in that order, which is the lookup the middleware does
-- on every request. A second one would cost a write on every change and buy nothing.
CREATE INDEX IF NOT EXISTS idx_module_perms_role
  ON module_permissions(role_name);

COMMENT ON TABLE module_permissions IS
  'Fine-grained access control: one row per (module, role, resource) with six action flags. Absence of a row is NOT a denial — see middleware/modulePermissions.js, which falls back to the role defaults so a practice that has never opened the permissions screen keeps working.';
COMMENT ON COLUMN module_permissions.module IS
  'Module key from utils/permissionRegistry.js. Not constrained here on purpose; the route validates against the registry.';
