// Who can hold an appointment, and who is defaulted into the field — in one place.
//
// The new-appointment form and the edit-appointment modal each had their own answer, and
// the two disagreed: the new form accepted physician/doctor plus rows with no role at all
// (providers-table rows carry no role column), while the edit modal accepted
// doctor/physician/provider/admin and silently dropped every role-less row. So a provider
// you could book in one screen could vanish from the dropdown in the other.
//
// Shared from here so there is one rule, and changing it changes both.

/** Roles that can hold an appointment. */
export const PROVIDER_ROLES = ['physician', 'doctor'];

export const roleOf = (u) => u?.role || u?.activeRole || u?.active_role || null;

/**
 * Is this row from a provider list a provider?
 *
 * Lenient about a missing role on purpose: callers pass rows from the providers table,
 * which has no role column because every row in it is a provider.
 */
export const isProviderRow = (u) => {
  const role = roleOf(u);
  return role ? PROVIDER_ROLES.includes(role) : true;
};

/**
 * Is the SIGNED-IN user a provider?
 *
 * Strict, unlike isProviderRow: applying that leniency to the signed-in user would default
 * whoever is booking into the provider field on nothing more than a missing field —
 * booking the appointment against the receptionist at the front desk.
 */
export const isProviderUser = (u) => PROVIDER_ROLES.includes(roleOf(u));

/** Append `extra` unless the list already holds a row with that id. */
export const withFallback = (list, extra) => {
  const rows = Array.isArray(list) ? list : [];
  if (!extra || extra.id == null) return rows;
  return rows.some((r) => String(r.id) === String(extra.id)) ? rows : [...rows, extra];
};

/** Merge provider lists from several sources, de-duplicated by id, first spelling wins. */
export const mergeById = (...lists) => {
  const seen = new Set();
  const out = [];
  for (const list of lists) {
    for (const row of Array.isArray(list) ? list : []) {
      if (row == null || row.id == null) continue;
      const key = String(row.id);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(row);
    }
  }
  return out;
};

export const participantName = (p) => {
  if (!p) return '';
  const full = `${p.first_name || p.firstName || ''} ${p.last_name || p.lastName || ''}`.trim();
  return full || p.name || p.email || '—';
};

/**
 * The providers a booking screen may offer.
 *
 * `fetched` comes from /api/providers/bookable, which is the authoritative list for the
 * practice. The other two sources are kept because they close real gaps:
 *
 *   * `passed` is whatever list the host screen already had. Before the bookable endpoint
 *     existed this was the only source, and on the dashboard and practice calendar it is
 *     /api/users — which is admin-only, so for a doctor it came back empty and the
 *     dropdown held nothing but the placeholder.
 *   * `currentUser` guarantees the person defaulted into the field is also offered by it.
 *     Without that the field shows a name its own dropdown cannot produce, and changing
 *     away from it is a one-way door.
 */
export const bookableProviders = ({ fetched, passed, currentUser }) => mergeById(
  (fetched || []).filter(isProviderRow),
  (passed || []).filter(isProviderRow),
  isProviderUser(currentUser) ? [currentUser] : [],
);
