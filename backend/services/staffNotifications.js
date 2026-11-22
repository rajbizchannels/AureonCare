/**
 * Staff notifications: what each person receives, on which channel, and the sender that obeys it.
 *
 *   CATALOG  every notification a staff member can receive, who is ELIGIBLE for it (by role, or
 *            by the practice's module permissions) and its default per channel.
 *   settingsFor / saveSettings
 *            the "Notification settings" page: only notifications the person is eligible for are
 *            shown or accepted.
 *   channelsFor
 *            one person's effective channels for one notification (their saved choice, else the
 *            default) — used by notificationService for the doctor on appointments, labs etc.
 *   notifyEligible
 *            send to every eligible member of the practice, each on their own channels — used by
 *            low-stock alerts, claim/payment updates and AI drafts.
 *
 * Channels: in_app (the bell), email, whatsapp. A channel the person cannot receive (no email /
 * no mobile number) is reported as unavailable on the page and skipped when sending.
 */

const { can } = require('../middleware/modulePermissions');

const CHANNELS = [
  { key: 'in_app', label: 'In the app' },
  { key: 'email', label: 'Email' },
  { key: 'whatsapp', label: 'WhatsApp' },
];
const CHANNEL_KEYS = CHANNELS.map((c) => c.key);

const CLINICIANS = ['doctor', 'provider'];
const BILLING = ['billing_manager', 'admin'];

// Roles the inventory routes let through for raising purchase orders (admin, billing manager)
// and for recording stock movements (also nurses) — routes/inventory.js `authorize(...)`.
const STOCK_ROUTE_ROLES = { purchase_orders: ['admin', 'billing_manager'], stock_movements: ['admin', 'billing_manager', 'nurse'] };

/**
 * Can this role act on low stock — raise a purchase order or record a stock receipt? Both gates
 * must agree: the route's role list AND the practice's own inventory permissions (Settings →
 * Roles & Permissions), so a practice that takes stock rights away from nurses stops alerting them.
 */
async function canManageStock(db, role) {
  if (role === 'admin') return true;
  try {
    for (const [resource, roles] of Object.entries(STOCK_ROUTE_ROLES)) {
      if (roles.includes(role) && await can(db, { role, module: 'inventory', resource, action: 'create' })) return true;
    }
    return false;
  } catch { return false; }
}

const on = { in_app: true, email: true, whatsapp: true };
const CATALOG = [
  // Sent by notificationService to the appointment's / order's doctor. Defaults are what was
  // sent before this page existed (email + WhatsApp), so nobody's inbox changes on deploy.
  { key: 'appointment.created', group: 'Appointments', label: 'A new appointment is booked with me', roles: CLINICIANS, defaults: { in_app: false, email: true, whatsapp: true } },
  { key: 'appointment.updated', group: 'Appointments', label: 'One of my appointments is changed', roles: CLINICIANS, defaults: { in_app: false, email: true, whatsapp: true } },
  { key: 'appointment.cancelled', group: 'Appointments', label: 'One of my appointments is cancelled', roles: CLINICIANS, defaults: { in_app: false, email: true, whatsapp: true } },
  { key: 'appointment.status_changed', group: 'Appointments', label: "An appointment's status changes (checked in, completed…)", roles: CLINICIANS, defaults: { in_app: false, email: true, whatsapp: true } },
  { key: 'telehealth.session_created', group: 'Appointments', label: 'A video visit is scheduled with me', roles: CLINICIANS, defaults: { in_app: false, email: true, whatsapp: true } },
  { key: 'prescription.created', group: 'Clinical', label: 'A prescription is written under my name', roles: CLINICIANS, defaults: { in_app: false, email: true, whatsapp: true } },
  { key: 'lab_order.created', group: 'Clinical', label: 'A lab order is placed under my name', roles: CLINICIANS, defaults: { in_app: false, email: true, whatsapp: true } },
  { key: 'lab_order.status_changed', group: 'Clinical', label: 'One of my lab orders changes status (results in…)', roles: CLINICIANS, defaults: { in_app: false, email: true, whatsapp: true } },
  // Billing: before this page only the practice's contact address heard about these.
  { key: 'claim.status_changed', group: 'Billing', label: "A claim's status changes (paid, denied…)", roles: BILLING, defaults: { in_app: true, email: false, whatsapp: false } },
  { key: 'payment.received', group: 'Billing', label: 'A payment is received', roles: BILLING, defaults: { in_app: true, email: false, whatsapp: false } },
  // Inventory: everyone whose role can reorder; admins are the fallback (see notifyLowStock).
  { key: 'inventory.low_stock', group: 'Inventory', label: 'An item falls to or below its reorder level', eligible: canManageStock, defaults: on, adminFallbackOnly: true },
  // AI review queue — in-app only, as before.
  { key: 'ai.draft_ready', group: 'AI', label: 'An AI draft is waiting for my review', roles: ['doctor', 'provider', 'nurse', 'billing_manager', 'admin'], channels: ['in_app'], defaults: { in_app: true } },
];
const byKey = Object.fromEntries(CATALOG.map((e) => [e.key, e]));
const getEvent = (key) => byKey[key] || null;
const channelsOf = (event) => event.channels || CHANNEL_KEYS;

async function isEligible(db, event, role) {
  if (!event || !role || role === 'patient') return false;
  if (event.eligible) return event.eligible(db, role);
  return (event.roles || []).includes(role);
}

/** Default for one person: admins get "fallback only" notifications only when nobody else does. */
function defaultFor(event, channel, role) {
  if (event.adminFallbackOnly && role === 'admin') return false;
  return Boolean((event.defaults || {})[channel]);
}

async function savedPrefs(db, userIds, eventKey = null) {
  if (!userIds.length) return [];
  try {
    const params = [userIds];
    let sql = 'SELECT user_id, event_key, channel, enabled FROM staff_notification_preferences WHERE user_id = ANY($1::uuid[])';
    if (eventKey) { params.push(eventKey); sql += ' AND event_key = $2'; }
    return (await db.query(sql, params)).rows;
  } catch (err) {
    // Table missing (migration 100 not run yet): behave as "no choices saved" — the defaults.
    if (err.code !== '42P01') console.error('[staffNotifications] reading preferences failed:', err.message);
    return [];
  }
}

/** One person's effective channels for one notification: { in_app, email, whatsapp } booleans. */
async function channelsFor(db, { userId, role, eventKey, fallback = false }) {
  const event = getEvent(eventKey);
  const out = { in_app: false, email: false, whatsapp: false };
  if (!event || !userId) return out;
  const saved = await savedPrefs(db, [userId], eventKey);
  for (const ch of channelsOf(event)) {
    const row = saved.find((r) => r.channel === ch);
    out[ch] = row ? row.enabled : (fallback ? Boolean((event.defaults || {})[ch]) : defaultFor(event, ch, role));
  }
  return out;
}

/** The settings page: notifications this person may receive, with their current choices. */
async function settingsFor(db, user) {
  const saved = await savedPrefs(db, [user.id]);
  const events = [];
  for (const event of CATALOG) {
    if (!(await isEligible(db, event, user.role))) continue;
    const channels = {};
    for (const ch of CHANNEL_KEYS) {
      if (!channelsOf(event).includes(ch)) { channels[ch] = { offered: false }; continue; }
      const row = saved.find((r) => r.event_key === event.key && r.channel === ch);
      channels[ch] = {
        offered: true,
        enabled: row ? row.enabled : defaultFor(event, ch, user.role),
        isDefault: !row,
        available: ch === 'in_app' ? true : ch === 'email' ? Boolean(user.email) : Boolean(user.phone),
      };
    }
    events.push({
      key: event.key, group: event.group, label: event.label, channels,
      note: event.adminFallbackOnly && user.role === 'admin'
        ? 'Admins receive this only when nobody else in the practice can act on stock, unless you switch it on here.'
        : null,
    });
  }
  return { channels: CHANNELS, events };
}

class SettingsError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

/** Save choices: [{ event, channel, enabled }]. Refuses notifications the person is not eligible for. */
async function saveSettings(db, user, changes) {
  if (!Array.isArray(changes) || !changes.length) throw new SettingsError(400, 'Nothing to save.');
  if (changes.length > 200) throw new SettingsError(400, 'Too many changes in one request.');
  for (const c of changes) {
    const event = getEvent(c && c.event);
    if (!event) throw new SettingsError(400, `Unknown notification: ${c && c.event}`);
    if (!channelsOf(event).includes(c.channel)) throw new SettingsError(400, `“${event.label}” is not sent by ${c.channel}.`);
    if (typeof c.enabled !== 'boolean') throw new SettingsError(400, 'enabled must be true or false.');
    if (!(await isEligible(db, event, user.role))) throw new SettingsError(403, `Your role does not receive “${event.label}”.`);
  }
  for (const c of changes) {
    await db.query(
      `INSERT INTO staff_notification_preferences (user_id, event_key, channel, enabled, updated_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (user_id, event_key, channel) DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = now()`,
      [user.id, c.event, c.channel, c.enabled]);
  }
  return settingsFor(db, user);
}

/** Active staff members of the practice, with their membership role. */
async function members(db, practiceId) {
  if (!practiceId) return [];
  const { rows } = await db.query(
    `SELECT u.id, u.first_name, u.last_name, u.email, u.phone, COALESCE(m.role, u.role) AS role
       FROM public.memberships m JOIN public.users u ON u.id = m.user_id
      WHERE m.practice_id = $1 AND m.status = 'active' AND COALESCE(m.role, u.role) <> 'patient'
        AND COALESCE(u.status, 'active') = 'active'`,
    [practiceId]);
  return rows;
}

/**
 * Who should receive `eventKey` in this practice, and on which channels.
 * `adminFallbackOnly` notifications go to eligible non-admins; admins are added when none exist
 * (a solo practice, or nobody else can act) — and any admin who switched it on explicitly.
 */
async function recipientsFor(db, practiceId, eventKey) {
  const event = getEvent(eventKey);
  if (!event) return [];
  const all = await members(db, practiceId);
  const eligible = [];
  for (const m of all) if (await isEligible(db, event, m.role)) eligible.push(m);
  const saved = await savedPrefs(db, eligible.map((m) => m.id), eventKey);
  const nonAdmins = eligible.filter((m) => m.role !== 'admin');
  const fallback = event.adminFallbackOnly && nonAdmins.length === 0;

  const out = [];
  for (const m of eligible) {
    const channels = {};
    for (const ch of channelsOf(event)) {
      const row = saved.find((r) => r.user_id === m.id && r.channel === ch);
      if (row) channels[ch] = row.enabled;
      else if (fallback && m.role === 'admin') channels[ch] = Boolean((event.defaults || {})[ch]);
      else channels[ch] = defaultFor(event, ch, m.role);
    }
    if (Object.values(channels).some(Boolean)) out.push({ ...m, channels, fallback: fallback && m.role === 'admin' });
  }
  return out;
}

/**
 * Send one notification to every eligible member, each on their own channels.
 * message: { type, inApp, subject, html, whatsappText, whatsappSummary }
 * Never throws; returns what was sent, for tests and logs.
 */
async function practiceIdOf(db) {
  try {
    const { rows } = await db.query('SELECT practice_id FROM control.tenants WHERE schema_name = current_schema() LIMIT 1');
    return rows[0] ? rows[0].practice_id : null;
  } catch { return null; }
}

async function notifyEligible(db, practiceId, eventKey, message, { excludeUserId = null } = {}) {
  const sent = [];
  try {
    if (!practiceId) practiceId = await practiceIdOf(db);
    const { sendEmail, sendWhatsAppTo } = require('./notificationService');
    const recipients = (await recipientsFor(db, practiceId, eventKey)).filter((r) => r.id !== excludeUserId);
    for (const r of recipients) {
      const done = { userId: r.id, role: r.role, fallback: r.fallback, channels: [] };
      if (r.channels.in_app) {
        await db.query(
          'INSERT INTO notifications (user_id, type, message, read, created_at) VALUES ($1, $2, $3, false, NOW())',
          [r.id, message.type || eventKey, message.inApp]);
        done.channels.push('in_app');
      }
      if (r.channels.email && r.email && message.subject) {
        const res = await sendEmail(r.email, message.subject, message.html);
        if (res && res.sent) done.channels.push('email');
      }
      if (r.channels.whatsapp && r.phone && message.whatsappText) {
        await sendWhatsAppTo(r.phone, message.whatsappText,
          { key: 'general_update', vars: [r.first_name || 'there', message.whatsappSummary || message.inApp] }, db);
        done.channels.push('whatsapp');
      }
      sent.push(done);
    }
  } catch (err) {
    console.error(`[staffNotifications] ${eventKey} failed:`, err.message);
  }
  return sent;
}

module.exports = {
  CHANNELS, CATALOG, getEvent, isEligible, channelsFor, settingsFor, saveSettings,
  recipientsFor, notifyEligible, canManageStock, practiceIdOf, SettingsError,
};
