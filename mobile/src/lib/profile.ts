/**
 * The patient's own profile — which fields the app lets them change, and what to send.
 * Plain logic, tested with node (tests/profile.test.mjs).
 *
 * Name, date of birth and email are identity: they are what the practice matched the chart
 * and the sign-in on, so the app shows them and asks the person to contact their practice to
 * change them. Everything else a patient keeps up to date themselves.
 */

export interface PortalProfile {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  date_of_birth?: string | null;
  email?: string | null;
  mrn?: string | null;
  phone?: string | null;
  address?: string | null;
  emergency_contact?: unknown;
  language?: string | null;
  allergies?: string | null;
  current_medications?: string | null;
  [key: string]: unknown;
}

export interface EmergencyContact { name: string; phone: string; relationship: string }

export interface ProfileForm {
  phone: string;
  address: string;
  emergency: EmergencyContact;
  allergies: string;
  currentMedications: string;
}

/** The emergency contact is stored as JSON (or, on older rows, a JSON string). */
export function readEmergency(v: unknown): EmergencyContact {
  let o: unknown = v;
  if (typeof v === 'string') { try { o = JSON.parse(v); } catch { o = { name: v }; } }
  const r = (o && typeof o === 'object' ? o : {}) as Record<string, unknown>;
  const s = (x: unknown) => (typeof x === 'string' ? x : '');
  return { name: s(r.name), phone: s(r.phone), relationship: s(r.relationship) };
}

export function formFrom(p: PortalProfile): ProfileForm {
  return {
    phone: p.phone ?? '',
    address: p.address ?? '',
    emergency: readEmergency(p.emergency_contact),
    allergies: p.allergies ?? '',
    currentMedications: p.current_medications ?? '',
  };
}

const PHONE = /^[+()\d\s.-]{6,25}$/;

/** The first problem with the form, or null. Empty fields are allowed (left unchanged). */
export function formProblem(f: ProfileForm): string | null {
  if (f.phone.trim() && !PHONE.test(f.phone.trim())) return 'Enter a valid phone number.';
  if (f.emergency.phone.trim() && !PHONE.test(f.emergency.phone.trim())) return 'Enter a valid phone number for your emergency contact.';
  if (f.address.length > 500) return 'The address is too long.';
  return null;
}

/**
 * Only what changed, in the server's field names. Identity fields are never sent, so the
 * app cannot change them even by accident. Returns null when nothing changed.
 */
export function changes(before: PortalProfile, f: ProfileForm): Record<string, unknown> | null {
  const was = formFrom(before);
  const out: Record<string, unknown> = {};
  if (f.phone.trim() !== was.phone.trim()) out.phone = f.phone.trim();
  if (f.address.trim() !== was.address.trim()) out.address = f.address.trim();
  const e = { name: f.emergency.name.trim(), phone: f.emergency.phone.trim(), relationship: f.emergency.relationship.trim() };
  if (JSON.stringify(e) !== JSON.stringify(was.emergency)) out.emergencyContact = e;
  if (f.allergies.trim() !== was.allergies.trim()) out.allergies = f.allergies.trim();
  if (f.currentMedications.trim() !== was.currentMedications.trim()) out.current_medications = f.currentMedications.trim();
  return Object.keys(out).length ? out : null;
}
