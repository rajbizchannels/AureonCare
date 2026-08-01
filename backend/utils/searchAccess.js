/**
 * View permissions for search scoping.
 *
 * Mirrors the matrix the frontend ships in src/utils/rolePermissions.js so the
 * two agree on what a role may see. Rows in the `role_permissions` table take
 * precedence when they exist — that table is the tenant-editable source of
 * truth, but it is only seeded for a handful of modules, so these defaults fill
 * the gaps rather than replacing it.
 */
const DEFAULT_VIEW_PERMISSIONS = {
  admin: ['accounts', 'appointments', 'audit', 'backup', 'claims', 'clinicalServices', 'crm', 'ehr', 'patients', 'practiceManagement', 'rcm', 'reports', 'settings', 'telehealth', 'users'],
  doctor: ['accounts', 'appointments', 'claims', 'clinicalServices', 'crm', 'ehr', 'patients', 'practiceManagement', 'rcm', 'reports', 'telehealth', 'users'],
  nurse: ['accounts', 'appointments', 'claims', 'clinicalServices', 'ehr', 'patients', 'practiceManagement', 'reports', 'telehealth'],
  receptionist: ['accounts', 'appointments', 'claims', 'crm', 'patients', 'practiceManagement', 'rcm', 'telehealth'],
  billing_manager: ['accounts', 'appointments', 'claims', 'patients', 'practiceManagement', 'rcm', 'reports'],
  crm_manager: ['appointments', 'crm', 'patients', 'practiceManagement', 'reports'],
  staff: ['accounts', 'appointments', 'claims', 'clinicalServices', 'crm', 'ehr', 'patients', 'practiceManagement', 'rcm', 'reports', 'telehealth'],
  // Patients never reach the staff matrix — their search is scoped to their own
  // records by a dedicated code path, not by these module flags.
  patient: [],
};

/**
 * Resolve which permission modules a role may view.
 *
 * @param {object} pool  pg pool
 * @param {string} role
 * @returns {Promise<Set<string>>}
 */
const resolveViewPermissions = async (pool, role) => {
  const allowed = new Set(DEFAULT_VIEW_PERMISSIONS[role] || []);

  try {
    const { rows } = await pool.query(
      'SELECT module, view_permission FROM role_permissions WHERE role = $1',
      [role]
    );
    for (const row of rows) {
      if (row.view_permission) {
        allowed.add(row.module);
      } else {
        allowed.delete(row.module);
      }
    }
  } catch (error) {
    // Table missing or unreadable — fall back to the defaults above rather than
    // failing open on a search that could otherwise leak across roles.
    console.error('Could not read role_permissions, using defaults:', error.message);
  }

  return allowed;
};

module.exports = { DEFAULT_VIEW_PERMISSIONS, resolveViewPermissions };
