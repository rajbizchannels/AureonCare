/**
 * What each role may see and do.
 *
 * This is a faithful port of `frontend/src/utils/rolePermissions.js`, kept as a
 * literal copy rather than a re-derivation for the same reason the colour
 * tokens are: two hand-maintained interpretations of the same rules drift, and
 * when they drift it is a clinician seeing a button the server will refuse.
 *
 * It is NOT a security boundary. Every route re-checks the role server-side
 * (`backend/middleware/auth.js` → `authorize(...)`), and the role itself is
 * read from the database on each request, never from the token's claim. What
 * this file decides is what to *offer*: a tab that 403s on arrival is worse
 * than no tab.
 *
 * Why one app rather than four: the role is a property of the account, not of
 * the install. People change roles, cover a colleague's desk, and are
 * sometimes a patient at the practice they work for. A single binary that
 * reads `account.role` handles all of that at sign-in; four binaries would ask
 * someone to uninstall and reinstall to be promoted.
 */

export type Role =
  | 'admin'
  | 'doctor'
  | 'nurse'
  | 'receptionist'
  | 'billing_manager'
  | 'crm_manager'
  | 'staff'
  | 'patient';

export type Module =
  | 'patients' | 'appointments' | 'claims' | 'ehr' | 'telehealth' | 'messages'
  | 'crm' | 'rcm' | 'accounts' | 'practiceManagement' | 'clinicalServices'
  | 'reports' | 'users' | 'settings' | 'backup' | 'audit';

export type Action = 'view' | 'create' | 'edit' | 'delete';

type Grants = Record<Module, Record<Action, boolean>>;

/** `{ view: true, create: false, edit: false, delete: false }` without the noise. */
const g = (view: boolean, create = false, edit = false, del = false): Record<Action, boolean> => ({
  view,
  create,
  edit,
  delete: del,
});

const NONE = g(false);

/** Admin-only switches, kept separate because they are not module/action shaped. */
export interface AdminGrants {
  users: boolean;
  roles: boolean;
  plans: boolean;
  settings: boolean;
}

interface RoleGrants {
  modules: Grants;
  admin: AdminGrants;
}

const NO_ADMIN: AdminGrants = { users: false, roles: false, plans: false, settings: false };

export const rolePermissions: Record<Role, RoleGrants> = {
  admin: {
    modules: {
      patients: g(true, true, true, true),
      appointments: g(true, true, true, true),
      claims: g(true, true, true, true),
      ehr: g(true, true, true, true),
      telehealth: g(true, true, true, true),
      messages: g(true, true, true, true),
      crm: g(true, true, true, true),
      rcm: g(true, true, true, true),
      accounts: g(true, true, true, true),
      practiceManagement: g(true, true, true, true),
      clinicalServices: g(true, true, true, true),
      reports: g(true, true, true, true),
      users: g(true, true, true, true),
      settings: g(true, true, true, true),
      backup: g(true, true, true, true),
      audit: g(true, false, false, true),
    },
    admin: { users: true, roles: true, plans: true, settings: true },
  },

  doctor: {
    modules: {
      patients: g(true, true, true),
      appointments: g(true, true, true),
      claims: g(true, true),
      ehr: g(true, true, true),
      telehealth: g(true, true, true),
      messages: g(true, true),
      crm: g(true),
      rcm: g(true),
      accounts: g(true),
      practiceManagement: g(true, true, true),
      clinicalServices: g(true, true, true),
      reports: g(true, true),
      users: g(true),
      settings: NONE,
      backup: NONE,
      audit: NONE,
    },
    admin: NO_ADMIN,
  },

  nurse: {
    modules: {
      patients: g(true, true, true),
      appointments: g(true, true, true),
      claims: g(true),
      ehr: g(true, true, true),
      telehealth: g(true, true),
      messages: g(true, true),
      crm: NONE,
      rcm: NONE,
      accounts: g(true),
      practiceManagement: g(true, true, true),
      clinicalServices: g(true, true),
      reports: g(true),
      users: NONE,
      settings: NONE,
      backup: NONE,
      audit: NONE,
    },
    admin: NO_ADMIN,
  },

  receptionist: {
    modules: {
      patients: g(true, true, true),
      appointments: g(true, true, true),
      claims: g(true),
      // No clinical record access at all — this is the line that makes the
      // front-desk shell different from the clinician one.
      ehr: NONE,
      telehealth: g(true),
      messages: g(true, true),
      crm: g(true, true, true),
      rcm: g(true),
      accounts: g(true),
      practiceManagement: g(true, true, true),
      clinicalServices: NONE,
      reports: NONE,
      users: NONE,
      settings: NONE,
      backup: NONE,
      audit: NONE,
    },
    admin: NO_ADMIN,
  },

  billing_manager: {
    modules: {
      patients: g(true),
      appointments: g(true),
      claims: g(true, true, true),
      ehr: NONE,
      telehealth: NONE,
      messages: g(true, true),
      crm: NONE,
      rcm: g(true, true, true),
      accounts: g(true, true, true),
      practiceManagement: g(true),
      clinicalServices: NONE,
      reports: g(true, true),
      users: NONE,
      settings: NONE,
      backup: NONE,
      audit: NONE,
    },
    admin: NO_ADMIN,
  },

  crm_manager: {
    modules: {
      patients: g(true),
      appointments: g(true),
      claims: NONE,
      ehr: NONE,
      telehealth: NONE,
      messages: g(true, true),
      crm: g(true, true, true, true),
      rcm: NONE,
      accounts: NONE,
      practiceManagement: g(true),
      clinicalServices: NONE,
      reports: g(true, true),
      users: NONE,
      settings: NONE,
      backup: NONE,
      audit: NONE,
    },
    admin: NO_ADMIN,
  },

  staff: {
    modules: {
      patients: g(true, true, true),
      appointments: g(true, true, true),
      claims: g(true, true),
      ehr: g(true),
      telehealth: g(true, true),
      messages: g(true, true),
      crm: g(true, true, true),
      rcm: g(true, true, true),
      accounts: g(true),
      practiceManagement: g(true, true, true),
      clinicalServices: g(true),
      reports: g(true),
      users: NONE,
      settings: NONE,
      backup: NONE,
      audit: NONE,
    },
    admin: NO_ADMIN,
  },

  patient: {
    // A patient's grants describe their OWN data through the portal, never the
    // staff consoles that read the same modules. `canAccessModule` enforces
    // that distinction; these rows alone would wrongly suggest otherwise.
    modules: {
      patients: g(true),
      appointments: g(true, true),
      claims: g(true),
      ehr: g(true),
      telehealth: g(true),
      messages: g(true, true),
      crm: NONE,
      rcm: g(true),
      accounts: NONE,
      practiceManagement: g(true),
      clinicalServices: g(true),
      reports: NONE,
      users: NONE,
      settings: NONE,
      backup: NONE,
      audit: NONE,
    },
    admin: NO_ADMIN,
  },
};

/** Unknown roles get nothing. A custom role the practice invented is not a licence. */
export const can = (role: Role | undefined, module: Module, action: Action = 'view'): boolean =>
  Boolean(role && rolePermissions[role]?.modules[module]?.[action]);

export const canAdmin = (role: Role | undefined, key: keyof AdminGrants): boolean =>
  Boolean(role && rolePermissions[role]?.admin[key]);

export const isPatient = (role: Role | undefined): boolean => role === 'patient';

/** Doctors and nurses. The people who may open a chart. */
export const isClinician = (role: Role | undefined): boolean =>
  role === 'doctor' || role === 'nurse';

/**
 * Which shell this account gets.
 *
 * Four shells, one binary. The navigator still filters each shell's tabs by
 * capability — this only picks the starting arrangement, because "what a
 * receptionist opens the app for" is a different question from "what a
 * receptionist is allowed to read".
 */
export type Shell = 'patient' | 'clinician' | 'frontdesk' | 'admin';

export const shellFor = (role: Role | undefined): Shell => {
  if (role === 'patient') return 'patient';
  if (role === 'admin') return 'admin';
  if (isClinician(role)) return 'clinician';
  return 'frontdesk';
};

/**
 * Camps are scheduled work, so the web app gates them on `appointments.view`
 * (see `modulePermissions.camps`). Patients never organise one.
 */
export const canUseCamps = (role: Role | undefined): boolean =>
  !isPatient(role) && can(role, 'appointments');

/** Who may staff a camp desk — mirrors `canWork` in routes/camp-registrations.js. */
export const canWorkCampDesk = (role: Role | undefined): boolean =>
  role === 'admin' || role === 'receptionist' || role === 'doctor' ||
  role === 'nurse' || role === 'staff';

/** Who may create or reshape a camp — mirrors `canPlan` in routes/camps.js. */
export const canPlanCamps = (role: Role | undefined): boolean =>
  role === 'admin' || role === 'receptionist' || role === 'doctor' || role === 'nurse';
