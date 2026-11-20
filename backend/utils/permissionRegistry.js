// Which modules have fine-grained permissions, which resources each one covers, and what
// each role may do by default.
//
// ONE source of truth, deliberately. The admin screen builds its grids from this, the
// write endpoint validates against it, and the enforcement middleware resolves against it.
// The alternative — a CHECK constraint listing resources, a hardcoded array in the route,
// and another array in the React component — is how the inventory grid ended up offering a
// `purchase_orders` row that no route consulted.
//
// A resource name is a noun a practice administrator would recognise, and every one of
// them maps to routes that actually enforce it. Adding a resource here without wiring the
// middleware would put a switch on screen that does nothing, which is the fault this
// whole exercise exists to fix.

const ACTIONS = ['view', 'create', 'edit', 'delete', 'approve', 'export'];

/**
 * Roles the grids offer. `admin` is listed so the screen can show it, but it is never
 * editable and never denied — a practice that can lock its own administrators out of the
 * permissions screen has no way back in.
 */
const ROLES = ['admin', 'doctor', 'nurse', 'receptionist', 'billing_manager', 'crm_manager', 'staff'];

const ALWAYS_ALLOWED_ROLE = 'admin';

/**
 * Shorthand for the default grids below.
 *   'all'  — every action
 *   'rw'   — view/create/edit, no delete, no approve
 *   'ro'   — view and export only
 *   'view' — view only
 *   'none' — nothing
 */
const PRESETS = {
  all: { view: true, create: true, edit: true, delete: true, approve: true, export: true },
  rw: { view: true, create: true, edit: true, delete: false, approve: false, export: true },
  ro: { view: true, create: false, edit: false, delete: false, approve: false, export: true },
  view: { view: true, create: false, edit: false, delete: false, approve: false, export: false },
  none: { view: false, create: false, edit: false, delete: false, approve: false, export: false },
};

/**
 * The modules.
 *
 * `defaults` gives each role a preset per module. These mirror the coarse role defaults the
 * application already behaves by (frontend/src/utils/rolePermissions.js), so switching
 * enforcement on changes nothing until an administrator actually edits something. A
 * permissions feature whose arrival silently locks people out of their own work is worse
 * than not having it.
 */
const MODULES = {
  patients: {
    label: 'Patients',
    resources: ['patients', 'medical_records', 'health_metrics'],
    defaults: {
      doctor: 'rw', nurse: 'rw', receptionist: 'rw', billing_manager: 'ro', crm_manager: 'view', staff: 'rw',
    },
  },
  appointments: {
    label: 'Appointments & Scheduling',
    resources: ['appointments', 'appointment_types', 'waitlist'],
    defaults: {
      doctor: 'rw', nurse: 'rw', receptionist: 'rw', billing_manager: 'ro', crm_manager: 'view', staff: 'rw',
    },
  },
  clinical: {
    label: 'Clinical Records',
    resources: ['diagnoses', 'prescriptions', 'lab_orders'],
    defaults: {
      doctor: 'all', nurse: 'rw', receptionist: 'none', billing_manager: 'none', crm_manager: 'none', staff: 'view',
    },
  },
  rcm: {
    label: 'Revenue Cycle',
    resources: ['claims', 'denials', 'preapprovals', 'payments'],
    defaults: {
      doctor: 'view', nurse: 'none', receptionist: 'view', billing_manager: 'all', crm_manager: 'none', staff: 'rw',
    },
  },
  crm: {
    label: 'CRM & Campaigns',
    resources: ['campaigns', 'quotes'],
    defaults: {
      doctor: 'none', nurse: 'none', receptionist: 'rw', billing_manager: 'none', crm_manager: 'all', staff: 'rw',
    },
  },
  camps: {
    label: 'Medical Camps',
    resources: ['camps', 'camp_registrations'],
    defaults: {
      doctor: 'rw', nurse: 'rw', receptionist: 'rw', billing_manager: 'ro', crm_manager: 'rw', staff: 'rw',
    },
  },
  forms: {
    label: 'Forms',
    // Separate on purpose: filling a form in and redesigning it are different privileges,
    // and a practice will want reception to do the first and not the second.
    resources: ['form_templates', 'form_submissions'],
    defaults: {
      doctor: 'rw', nurse: 'rw', receptionist: 'view', billing_manager: 'none', crm_manager: 'none', staff: 'view',
    },
  },
  offerings: {
    label: 'Services & Pricing',
    resources: ['offerings', 'service_categories'],
    defaults: {
      doctor: 'view', nurse: 'view', receptionist: 'view', billing_manager: 'rw', crm_manager: 'view', staff: 'view',
    },
  },
  providers: {
    label: 'Providers & Locations',
    resources: ['providers', 'locations'],
    defaults: {
      doctor: 'view', nurse: 'view', receptionist: 'view', billing_manager: 'view', crm_manager: 'view', staff: 'view',
    },
  },
  // The two that existed before, folded in so the admin screen is one screen and the
  // middleware is one piece of code. Their own tables are left in place untouched; the
  // defaults below match what their grids were seeded with.
  inventory: {
    label: 'Inventory',
    resources: ['items', 'categories', 'suppliers', 'stock_movements', 'purchase_orders'],
    legacyTable: 'inventory_role_permissions',
    defaults: {
      doctor: 'view', nurse: 'rw', receptionist: 'view', billing_manager: 'all', crm_manager: 'none', staff: 'rw',
    },
  },
  accounts: {
    label: 'Accounts',
    resources: ['invoices', 'payments', 'ledger', 'statements'],
    legacyTable: 'account_role_permissions',
    defaults: {
      doctor: 'view', nurse: 'none', receptionist: 'view', billing_manager: 'all', crm_manager: 'none', staff: 'view',
    },
  },
};

/** Is this a module we know about? */
const isModule = (module) => Object.prototype.hasOwnProperty.call(MODULES, module);

/**
 * Roles that may be granted permissions: the built-in list plus whatever a practice
 * actually uses.
 *
 * The built-in seven are not the whole story. A practice can create its own roles, and the
 * grids that this screen replaced each hardcoded their own six-role list — so a custom
 * role was invisible in them and could never be granted anything. `extra` comes from the
 * roles the practice's own users hold, which is the honest answer to "which roles exist
 * here": `public.roles` is a global table that is empty on every installation checked, so
 * reading it alone would have found nothing.
 *
 * `patient` is excluded deliberately. Patients reach their own data through the portal,
 * which has its own rules; offering a staff permissions row for them would imply this
 * screen governs that, and it does not.
 */
const EXCLUDED_ROLES = new Set(['patient']);

function rolesFor(extra = []) {
  const out = [...ROLES];
  for (const role of extra) {
    const name = String(role || '').trim();
    if (!name || EXCLUDED_ROLES.has(name) || out.includes(name)) continue;
    out.push(name);
  }
  return out;
}

/** Is `resource` one of `module`'s? */
const isResource = (module, resource) =>
  isModule(module) && MODULES[module].resources.includes(resource);

const isAction = (action) => ACTIONS.includes(action);

/**
 * What `role` may do on `module`/`resource` when no row has been saved.
 *
 * An unknown role gets nothing. `admin` gets everything — see ALWAYS_ALLOWED_ROLE.
 */
function defaultsFor(module, role) {
  if (role === ALWAYS_ALLOWED_ROLE) return { ...PRESETS.all };
  if (!isModule(module)) return { ...PRESETS.none };
  const preset = MODULES[module].defaults[role];
  return { ...(PRESETS[preset] || PRESETS.none) };
}

/**
 * The whole registry, shaped for the admin screen to render without any knowledge of it.
 *
 * `extraRoles` are roles the practice uses beyond the built-in list; they get the same
 * treatment as any other role, defaulting to nothing until granted, which is the safe
 * direction for a role nobody has described yet.
 */
function describe(extraRoles = []) {
  const roles = rolesFor(extraRoles);
  return {
    actions: ACTIONS,
    roles,
    alwaysAllowedRole: ALWAYS_ALLOWED_ROLE,
    modules: Object.entries(MODULES).map(([key, m]) => ({
      key,
      label: m.label,
      resources: m.resources,
      defaults: Object.fromEntries(roles.map((r) => [r, defaultsFor(key, r)])),
    })),
  };
}

module.exports = {
  ACTIONS, ROLES, MODULES, PRESETS, ALWAYS_ALLOWED_ROLE, EXCLUDED_ROLES,
  isModule, isResource, isAction, defaultsFor, describe, rolesFor,
};
