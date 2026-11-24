/**
 * Appointment reminders — run on a schedule (GET /api/internal/cron/reminders), every practice.
 *
 * Who gets what, and on which channel — always each person's own choice, never "everything":
 *   PATIENT   before each appointment, on the channels they chose in the patient portal
 *             (notification_preferences): email unless they switched it off; WhatsApp only if they
 *             switched it on. The provider's booking settings decide how many hours before
 *             (reminder_hours_before, default 24) and can turn patient reminders off.
 *   PROVIDER  before each of their appointments — "A reminder before each of my appointments"
 *             under My notifications (default: in the app only).
 *   STAFF     one summary of tomorrow's appointments a day — "Tomorrow's appointments in the
 *             practice" under My notifications (front desk, nurses, admins; default: in the app).
 *
 * Each reminder is claimed in reminder_deliveries (unique per kind, appointment, recipient,
 * channel, day) BEFORE it is sent, so running the job twice — or two runs overlapping — never
 * sends anything twice. A send that fails releases its claim and is retried next run.
 * Practices whose workspace is read-only (subscription ended) are skipped.
 *
 *   runReminders(pool, { now }) → { practices, sent: { patient, provider, digest }, failed, skipped }
 */
const { makeTenantDb } = require('../db/requestTenantDb');
const SN = require('./staffNotifications');

const RESERVED_EMAIL = /@(example\.(com|org|net)|[^@]+\.(test|invalid|localhost))$/i; // never real inboxes

const fmtWhen = (local, tz) => {
  // `local` is the clinic-local wall time (timestamp without time zone) as YYYY-MM-DD HH:MM.
  const d = new Date(`${String(local).replace(' ', 'T').slice(0, 16)}:00Z`);
  const date = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  return { date, time, label: `${date} at ${time}${tz && tz !== 'UTC' ? ` (${tz})` : ''}` };
};
const localText = (v) => (v instanceof Date ? v.toISOString().replace('T', ' ').slice(0, 16) : String(v).slice(0, 16));

/** Claim a reminder; false when it was already sent (or is being sent by another run). */
async function claim(db, { kind, appointmentId = null, recipientId, channel, forDate = null }) {
  const { rows } = await db.query(
    `INSERT INTO reminder_deliveries (kind, appointment_id, recipient_id, channel, for_date)
     VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING RETURNING id`,
    [kind, appointmentId, recipientId, channel, forDate]);
  return rows[0] ? rows[0].id : null;
}
const release = (db, id) => db.query('DELETE FROM reminder_deliveries WHERE id = $1', [id]).catch(() => {});

/** Send one message on one channel, claimed first. → true when sent */
async function deliver(db, key, send) {
  const id = await claim(db, key);
  if (!id) return false;
  try {
    const ok = await send();
    if (ok === false) { await release(db, id); return false; }
    return true;
  } catch (e) {
    console.error(`[reminders] ${key.kind}/${key.channel} failed:`, e.message);
    await release(db, id);
    return null;
  }
}

async function dueAppointments(db, now) {
  const { rows } = await db.query(
    `SELECT a.id, a.patient_id, a.provider_id, a.appointment_type, a.duration_minutes, a.meeting_url,
            to_char(a.start_time, 'YYYY-MM-DD HH24:MI') AS local_start, tz.name AS tz,
            COALESCE(c.reminder_hours_before, 24) AS lead_hours, COALESCE(c.send_reminder_email, true) AS remind_patient
       FROM appointments a
       LEFT JOIN pg_timezone_names tz ON tz.name = a.timezone
       LEFT JOIN LATERAL (SELECT reminder_hours_before, send_reminder_email FROM provider_booking_config pc
                           WHERE pc.provider_id = a.provider_id ORDER BY pc.updated_at DESC NULLS LAST LIMIT 1) c ON true
      WHERE a.status IN ('scheduled', 'confirmed') AND a.cancelled_at IS NULL
        AND (a.start_time AT TIME ZONE COALESCE(tz.name, 'UTC')) > $1::timestamptz
        AND (a.start_time AT TIME ZONE COALESCE(tz.name, 'UTC')) <= $1::timestamptz + make_interval(hours => COALESCE(c.reminder_hours_before, 24))
      ORDER BY a.start_time LIMIT 2000`, [now]);
  return rows;
}

async function remindPatient(db, a, ctx) {
  if (!a.remind_patient || !a.patient_id) return;
  const { rows: [p] } = await db.query('SELECT id, first_name, last_name, email, phone FROM patients WHERE id = $1', [a.patient_id]);
  if (!p) return;
  const { rows: prefs } = await db.query('SELECT channel_type, is_enabled, contact_info FROM notification_preferences WHERE patient_id = $1', [p.id])
    .catch(() => ({ rows: [] }));
  const pref = (ch) => prefs.find((r) => r.channel_type === ch);
  const when = fmtWhen(a.local_start, a.tz);
  const provider = a.provider_id
    ? (await db.query('SELECT first_name, last_name FROM public.users WHERE id = $1', [a.provider_id])).rows[0] : null;
  const withWhom = provider ? `${provider.first_name || ''} ${provider.last_name || ''}`.trim() : ctx.practiceName;
  const { sendEmail, sendWhatsAppTo, buildEmailHtml, escapeHtml, emailButton } = require('./notificationService');

  // Email: on unless the patient switched it off.
  const emailPref = pref('email');
  const email = (emailPref && emailPref.contact_info) || p.email;
  if (email && !RESERVED_EMAIL.test(email) && !(emailPref && emailPref.is_enabled === false)) {
    const ok = await deliver(db, { kind: 'patient', appointmentId: a.id, recipientId: p.id, channel: 'email' }, async () => {
      const r = await sendEmail(email, `Reminder: your appointment on ${when.date}`, buildEmailHtml(
        'Appointment reminder', '#08B39C', `Hello ${escapeHtml(p.first_name || '')},`,
        `This is a reminder of your appointment with <strong>${escapeHtml(withWhom)}</strong>.`,
        [['When', when.label], ['Appointment', a.appointment_type || 'Appointment'], ['Duration', a.duration_minutes ? `${a.duration_minutes} minutes` : '—']],
        (a.meeting_url ? emailButton(a.meeting_url, 'Join the video visit') : '')
          + '<p style="font-size:13px;color:#64748B">Need to change or cancel? Please contact the practice as soon as possible. You can change how you receive reminders in your patient portal.</p>',
        { practiceName: ctx.practiceName }));
      return Boolean(r && r.sent);
    });
    if (ok) ctx.sent.patient += 1; else if (ok === null) ctx.failed += 1;
  }

  // WhatsApp: only when the patient switched it on.
  const wa = pref('whatsapp');
  const phone = wa && wa.is_enabled ? (wa.contact_info || p.phone) : null;
  if (phone) {
    const ok = await deliver(db, { kind: 'patient', appointmentId: a.id, recipientId: p.id, channel: 'whatsapp' }, async () => {
      await sendWhatsAppTo(phone, `Hello ${p.first_name || ''}, this is a reminder of your appointment with ${withWhom} on ${when.label}.`,
        { key: 'appointment_reminder', vars: [p.first_name || 'there', withWhom, when.date, when.time] }, db);
      return true;
    });
    if (ok) ctx.sent.patient += 1; else if (ok === null) ctx.failed += 1;
  }
}

async function remindProvider(db, a, ctx) {
  if (!a.provider_id) return;
  const { rows: [u] } = await db.query(
    `SELECT u.id, u.first_name, u.email, u.phone, COALESCE(m.role, u.role) AS role
       FROM public.users u LEFT JOIN public.memberships m ON m.user_id = u.id AND m.practice_id = $2 AND m.status = 'active'
      WHERE u.id = $1 AND COALESCE(u.status, 'active') = 'active'`, [a.provider_id, ctx.practiceId]);
  if (!u) return;
  const channels = await SN.channelsFor(db, { userId: u.id, role: u.role, eventKey: 'appointment.reminder' });
  if (!Object.values(channels).some(Boolean)) return;
  const { rows: [p] } = await db.query('SELECT first_name, last_name FROM patients WHERE id = $1', [a.patient_id]);
  // Patient named by first name and initial outside the app; in full inside it.
  const who = p ? `${p.first_name || ''} ${(p.last_name || '').slice(0, 1)}.`.trim() : 'a patient';
  const whoFull = p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() : 'a patient';
  const when = fmtWhen(a.local_start, a.tz);
  const { sendEmail, sendWhatsAppTo, buildEmailHtml, escapeHtml } = require('./notificationService');
  const sends = {
    in_app: async () => {
      await db.query('INSERT INTO notifications (user_id, type, message, read, created_at) VALUES ($1, $2, $3, false, NOW())',
        [u.id, 'appointment.reminder', `Reminder: ${whoFull}, ${when.label}${a.appointment_type ? ` — ${a.appointment_type}` : ''}`]);
      return true;
    },
    email: async () => {
      if (!u.email || RESERVED_EMAIL.test(u.email)) return false;
      const r = await sendEmail(u.email, `Reminder: appointment ${when.label}`, buildEmailHtml(
        'Appointment reminder', '#08B39C', `Hello ${escapeHtml(u.first_name || '')},`,
        `You have an appointment with <strong>${escapeHtml(who)}</strong>.`,
        [['When', when.label], ['Appointment', a.appointment_type || 'Appointment']],
        '<p style="font-size:13px;color:#64748B">Change which reminders you receive under My notifications in AureonCare.</p>',
        { practiceName: ctx.practiceName }));
      return Boolean(r && r.sent);
    },
    whatsapp: async () => {
      if (!u.phone) return false;
      await sendWhatsAppTo(u.phone, `Reminder: appointment with ${who} on ${when.label}.`,
        { key: 'general_update', vars: [u.first_name || 'there', `Reminder: appointment with ${who} on ${when.label}.`] }, db);
      return true;
    },
  };
  for (const [ch, on] of Object.entries(channels)) {
    if (!on) continue;
    const ok = await deliver(db, { kind: 'provider', appointmentId: a.id, recipientId: u.id, channel: ch }, sends[ch]);
    if (ok) ctx.sent.provider += 1; else if (ok === null) ctx.failed += 1;
  }
}

async function sendDigest(db, ctx, now) {
  const tz = ctx.timezone || 'UTC';
  const { rows: [{ tomorrow }] } = await db.query(
    `SELECT ((($1::timestamptz) AT TIME ZONE COALESCE((SELECT name FROM pg_timezone_names WHERE name = $2), 'UTC'))::date + 1) AS tomorrow`, [now, tz]);
  const forDate = tomorrow instanceof Date ? tomorrow.toISOString().slice(0, 10) : String(tomorrow).slice(0, 10);
  const { rows: appts } = await db.query(
    `SELECT to_char(a.start_time, 'HH24:MI') AS t, a.appointment_type, p.first_name, p.last_name,
            pu.first_name AS pf, pu.last_name AS pl
       FROM appointments a JOIN patients p ON p.id = a.patient_id
       LEFT JOIN public.users pu ON pu.id = a.provider_id
      WHERE a.status IN ('scheduled', 'confirmed') AND a.cancelled_at IS NULL AND a.start_time::date = $1::date
      ORDER BY a.start_time`, [forDate]);
  if (!appts.length) return;
  const recipients = await SN.recipientsFor(db, ctx.practiceId, 'schedule.daily_digest');
  const dateLabel = new Date(`${forDate}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  const summary = `${appts.length} appointment${appts.length === 1 ? '' : 's'} tomorrow (${dateLabel})`;
  // In the app: the full list. Outside it (email, WhatsApp): counts only, no patient names.
  const fullList = appts.slice(0, 40).map((x) => `${x.t} ${x.first_name} ${x.last_name}${x.pf ? ` — ${x.pf} ${x.pl || ''}`.trimEnd() : ''}`).join('; ');
  const byProvider = {};
  for (const x of appts) { const k = x.pf ? `${x.pf} ${x.pl || ''}`.trim() : 'No provider'; byProvider[k] = (byProvider[k] || 0) + 1; }
  const { sendEmail, sendWhatsAppTo, buildEmailHtml, escapeHtml } = require('./notificationService');
  for (const r of recipients) {
    const sends = {
      in_app: async () => {
        await db.query('INSERT INTO notifications (user_id, type, message, read, created_at) VALUES ($1, $2, $3, false, NOW())',
          [r.id, 'schedule.daily_digest', `${summary}: ${fullList}${appts.length > 40 ? ' …' : ''}`]);
        return true;
      },
      email: async () => {
        if (!r.email || RESERVED_EMAIL.test(r.email)) return false;
        const res = await sendEmail(r.email, `Tomorrow: ${summary}`, buildEmailHtml(
          "Tomorrow's appointments", '#08B39C', `Hello ${escapeHtml(r.first_name || '')},`,
          `${escapeHtml(summary)}. Open AureonCare for the full schedule.`,
          Object.entries(byProvider).map(([k, n]) => [k, `${n} appointment${n === 1 ? '' : 's'}`]),
          '<p style="font-size:13px;color:#64748B">Change which summaries you receive under My notifications in AureonCare.</p>',
          { practiceName: ctx.practiceName }));
        return Boolean(res && res.sent);
      },
      whatsapp: async () => {
        if (!r.phone) return false;
        await sendWhatsAppTo(r.phone, `${summary}. Open AureonCare for the schedule.`,
          { key: 'general_update', vars: [r.first_name || 'there', `${summary}. Open AureonCare for the schedule.`] }, db);
        return true;
      },
    };
    for (const [ch, on] of Object.entries(r.channels)) {
      if (!on) continue;
      const ok = await deliver(db, { kind: 'digest', recipientId: r.id, channel: ch, forDate }, sends[ch]);
      if (ok) ctx.sent.digest += 1; else if (ok === null) ctx.failed += 1;
    }
  }
}

async function remindPractice(pool, tenant, now, totals) {
  const db = makeTenantDb(pool, tenant.schema_name);
  try {
    if (!(await db.query("SELECT to_regclass('reminder_deliveries') AS t")).rows[0].t) { totals.skipped += 1; return; } // migration 106 not run
    const ctx = { practiceId: tenant.practice_id, practiceName: tenant.name, timezone: tenant.timezone, sent: totals.sent, failed: 0 };
    for (const a of await dueAppointments(db, now)) {
      await remindPatient(db, a, ctx);
      await remindProvider(db, a, ctx);
    }
    await sendDigest(db, ctx, now);
    totals.failed += ctx.failed;
  } finally {
    db.release();
  }
}

async function runReminders(pool, { now = new Date(), practiceId = null } = {}) {
  const totals = { practices: 0, sent: { patient: 0, provider: 0, digest: 0 }, failed: 0, skipped: 0 };
  const { getTenantEntitlements } = require('./entitlements');
  const { rows: tenants } = await pool.query(
    `SELECT t.practice_id, t.schema_name, COALESCE(p.name, t.name) AS name, t.timezone
       FROM control.tenants t LEFT JOIN public.practices p ON p.id = t.practice_id
      WHERE t.status = 'active' AND t.schema_name IS NOT NULL AND t.schema_name <> 'public'
        AND ($1::uuid IS NULL OR t.practice_id = $1)`, [practiceId]);
  for (const t of tenants) {
    try {
      const ent = await getTenantEntitlements(pool, t.practice_id);
      if (ent && ent.enforcementEnabled && ent.isReadOnly) { totals.skipped += 1; continue; }
      await remindPractice(pool, t, now, totals);
      totals.practices += 1;
    } catch (e) {
      totals.failed += 1;
      console.error(`[reminders] practice ${t.practice_id} failed:`, e.message);
    }
  }
  return totals;
}

module.exports = { runReminders, fmtWhen, localText };
