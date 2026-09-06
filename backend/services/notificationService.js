const nodemailer = require('nodemailer');
const WhatsAppService = require('./whatsappService');
const { consumeSendQuota } = require('../utils/sendQuota');

let transporter = null;
let whatsappService = null;
let whatsappInitialized = false;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.AC_SM_H || 'smtp.gmail.com',
      port: parseInt(process.env.AC_SM_P) || 587,
      secure: false,
      auth: {
        user: process.env.AC_SM_U,
        pass: process.env.AC_SM_W,
      },
    });
  }
  return transporter;
}

async function initWhatsApp(pool) {
  if (whatsappInitialized) return;
  whatsappInitialized = true;
  try {
    const config = await WhatsAppService.getConfig(pool);
    if (config && config.enabled) {
      whatsappService = new WhatsAppService(config);
    }
  } catch (e) {
    console.error('NotificationService: WhatsApp init error:', e.message);
  }
}

function formatDate(dt) {
  if (!dt) return 'N/A';
  return new Date(dt).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

function formatTime(dt) {
  if (!dt) return 'N/A';
  return new Date(dt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function detailRow(label, value) {
  if (!value && value !== 0) return '';
  return `<tr>
    <td style="padding:8px 12px;font-weight:bold;color:#555;white-space:nowrap;width:35%">${label}</td>
    <td style="padding:8px 12px;color:#333">${value}</td>
  </tr>`;
}

function buildEmailHtml(title, headerColor, greeting, intro, rows, extra) {
  const clinic = process.env.AC_CLN || 'AureonCare';
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body{font-family:Arial,sans-serif;line-height:1.6;color:#333;margin:0;padding:0}
  .wrap{max-width:600px;margin:0 auto;padding:20px}
  .hdr{background:${headerColor};color:#fff;padding:20px 30px;border-radius:6px 6px 0 0;text-align:center}
  .hdr h2{margin:0;font-size:22px}
  .body{background:#f9f9f9;padding:30px;border-radius:0 0 6px 6px}
  .box{background:#fff;border-radius:6px;margin:20px 0;overflow:hidden;border:1px solid #e5e7eb}
  .box table{width:100%;border-collapse:collapse}
  .box tr+tr td{border-top:1px solid #f3f4f6}
  .footer{text-align:center;margin-top:20px;color:#999;font-size:13px}
</style>
</head>
<body><div class="wrap">
  <div class="hdr"><h2>${title}</h2></div>
  <div class="body">
    ${greeting ? `<p>${greeting}</p>` : ''}
    ${intro ? `<p>${intro}</p>` : ''}
    ${rows ? `<div class="box"><table>${rows}</table></div>` : ''}
    ${extra ? `<p style="margin-top:20px">${extra}</p>` : ''}
  </div>
  <div class="footer">
    <p>This is an automated message. Please do not reply to this email.</p>
    <p>&copy; ${new Date().getFullYear()} ${clinic}. All rights reserved.</p>
  </div>
</div></body>
</html>`;
}

/**
 * Send one email. Never throws — a notification failure must not fail the action that
 * raised it.
 *
 * Returns `{ sent, reason }` so a caller that needs to *tell the user* whether the mail
 * went out (an invite, say, where a silently dropped message means the invitee is simply
 * never onboarded) can do so. Callers that only fire-and-forget can ignore it.
 */
async function sendEmail(to, subject, html) {
  if (!to) return { sent: false, reason: 'no recipient' };
  // Both halves, not just the username. With AC_SM_U set and AC_SM_W missing, nodemailer
  // builds a transport it cannot authenticate and fails at send time with
  // `EAUTH Missing credentials for "PLAIN"` — technically accurate, but it points at the
  // mail server rather than at the unset variable that actually caused it.
  if (!process.env.AC_SM_U || !process.env.AC_SM_W) {
    return { sent: false, reason: 'smtp_not_configured' };
  }
  // SEC-24: cap sends per RECIPIENT. Notifications fire from ordinary business events, so
  // a per-IP or per-route limit would miss them; the abuse that matters is one inbox being
  // flooded, and the victim's address is the stable key.
  const quota = await consumeSendQuota('email', to);
  if (!quota.allowed) {
    console.warn(`[SEC-24] email to ${to} suppressed — ${quota.count} sends exceeds the limit of ${quota.limit} in the window`);
    return { sent: false, reason: 'rate_limited' };
  }
  try {
    const t = getTransporter();
    const from = `"${process.env.AC_CLN || 'AureonCare'}" <${process.env.AC_SM_U}>`;
    await t.sendMail({ from, to, subject, html });
    return { sent: true };
  } catch (e) {
    console.error(`NotificationService: email to ${to} failed:`, e.message);
    // Carry the provider's own words back to the caller. "Could not be delivered" is not
    // actionable; "535-5.7.8 Username and Password not accepted" is. Only the SMTP status
    // and the server's response line are passed on — never the transport configuration —
    // and it is truncated so a chatty server cannot flood a UI.
    return {
      sent: false,
      reason: 'send_failed',
      detail: [e.code, e.responseCode, e.response || e.message]
        .filter(Boolean).join(' ').slice(0, 300),
    };
  }
}

async function sendWhatsApp(phone, message) {
  if (!whatsappService || !phone) return;
  // SEC-24: same per-recipient cap, which also bounds spend at the messaging provider.
  const quota = await consumeSendQuota('whatsapp', phone);
  if (!quota.allowed) {
    console.warn(`[SEC-24] WhatsApp to ${phone} suppressed — ${quota.count} sends exceeds the limit of ${quota.limit} in the window`);
    return;
  }
  try {
    await whatsappService.sendMessage(phone, message);
  } catch (e) {
    console.error(`NotificationService: WhatsApp to ${phone} failed:`, e.message);
  }
}

async function getPatient(pool, patientId) {
  if (!patientId) return null;
  try {
    const r = await pool.query(
      'SELECT id, first_name, last_name, email, phone FROM patients WHERE id::text = $1::text',
      [patientId]
    );
    return r.rows[0] || null;
  } catch (e) { return null; }
}

async function getProvider(pool, providerId) {
  if (!providerId) return null;
  try {
    let r = await pool.query(
      'SELECT id, first_name, last_name, email, phone FROM providers WHERE id::text = $1::text',
      [providerId]
    );
    if (r.rows.length === 0) {
      r = await pool.query(
        'SELECT id, first_name, last_name, email, phone FROM users WHERE id::text = $1::text',
        [providerId]
      );
    }
    return r.rows[0] || null;
  } catch (e) { return null; }
}

async function getAdminInfo(pool) {
  const email = process.env.AC_ADMIN_EMAIL;
  const phone = process.env.AC_ADMIN_PHONE;
  if (email || phone) {
    return { first_name: 'Admin', last_name: '', email, phone };
  }
  try {
    const r = await pool.query('SELECT settings FROM organization_settings WHERE id = 1');
    if (r.rows.length > 0) {
      const s = r.rows[0].settings || {};
      if (s.admin_email || s.admin_phone) {
        return { first_name: 'Admin', last_name: '', email: s.admin_email, phone: s.admin_phone };
      }
    }
  } catch (e) { /* ignore */ }
  return null;
}

async function isWhatsAppEnabledForPatient(pool, patientId) {
  try {
    const r = await pool.query(
      `SELECT is_enabled, contact_info FROM notification_preferences
       WHERE patient_id::text = $1::text AND channel_type = 'whatsapp' AND is_enabled = true`,
      [patientId]
    );
    if (r.rows.length > 0) return r.rows[0].contact_info;
    return null;
  } catch (e) { return null; }
}

// ─── Event dispatch ────────────────────────────────────────────────────────────

async function dispatch(pool, eventType, data) {
  try {
    await initWhatsApp(pool);
    const handler = EVENTS[eventType];
    if (!handler) {
      console.warn(`NotificationService: unknown event "${eventType}"`);
      return;
    }
    await handler(pool, data);
  } catch (e) {
    console.error(`NotificationService: dispatch error for "${eventType}":`, e.message);
  }
}

// ─── Shared send helper ────────────────────────────────────────────────────────

async function notifyAll(pool, { patient_id, provider_id }, buildMsg) {
  const [patient, provider, admin] = await Promise.all([
    getPatient(pool, patient_id),
    getProvider(pool, provider_id),
    getAdminInfo(pool),
  ]);

  const recipients = [
    { role: 'patient', person: patient },
    { role: 'doctor', person: provider },
    { role: 'admin', person: admin },
  ].filter(r => r.person);

  for (const { role, person } of recipients) {
    const msg = buildMsg(role, person, { patient, provider, admin });
    if (!msg) continue;

    if (person.email) {
      await sendEmail(person.email, msg.subject, msg.html);
    }

    // WhatsApp: patients require opt-in, staff/admin send directly if phone available
    let waPhone = null;
    if (role === 'patient' && patient_id) {
      waPhone = await isWhatsAppEnabledForPatient(pool, patient_id);
      if (!waPhone) waPhone = null;
    } else if (person.phone) {
      waPhone = person.phone;
    }

    if (waPhone && msg.whatsapp) {
      await sendWhatsApp(waPhone, msg.whatsapp);
    }
  }
}

// ─── Event handlers ────────────────────────────────────────────────────────────

const EVENTS = {

  'appointment.created': async (pool, data) => {
    const { appointment } = data;
    await notifyAll(pool, {
      patient_id: appointment.patient_id,
      provider_id: appointment.provider_id,
    }, (role, person, { patient, provider }) => {
      const greeting = `Dear ${person.first_name},`;
      const intro = role === 'admin'
        ? 'A new appointment has been scheduled.'
        : role === 'doctor'
          ? 'You have a new appointment scheduled.'
          : 'Your appointment has been confirmed.';
      const rows = [
        detailRow('Patient', patient ? `${patient.first_name} ${patient.last_name}` : 'N/A'),
        detailRow('Doctor', provider ? `Dr. ${provider.first_name} ${provider.last_name}` : 'N/A'),
        detailRow('Date', formatDate(appointment.start_time)),
        detailRow('Time', formatTime(appointment.start_time)),
        detailRow('Type', appointment.appointment_type),
        detailRow('Duration', appointment.duration_minutes ? `${appointment.duration_minutes} min` : null),
        detailRow('Reason', appointment.reason),
      ].join('');
      const html = buildEmailHtml('Appointment Scheduled', '#3B82F6', greeting, intro, rows, null);
      const waText = `*Appointment Scheduled*\n\n${greeting}\n\n${intro}\n\nPatient: ${patient?.first_name} ${patient?.last_name}\nDoctor: Dr. ${provider?.first_name} ${provider?.last_name}\nDate: ${formatDate(appointment.start_time)}\nTime: ${formatTime(appointment.start_time)}${appointment.appointment_type ? `\nType: ${appointment.appointment_type}` : ''}${appointment.reason ? `\nReason: ${appointment.reason}` : ''}`;
      return { subject: `Appointment Scheduled – ${formatDate(appointment.start_time)}`, html, whatsapp: waText };
    });
  },

  'appointment.updated': async (pool, data) => {
    const { appointment } = data;
    await notifyAll(pool, {
      patient_id: appointment.patient_id,
      provider_id: appointment.provider_id,
    }, (role, person, { patient, provider }) => {
      const greeting = `Dear ${person.first_name},`;
      const intro = 'An appointment has been updated.';
      const rows = [
        detailRow('Patient', patient ? `${patient.first_name} ${patient.last_name}` : 'N/A'),
        detailRow('Doctor', provider ? `Dr. ${provider.first_name} ${provider.last_name}` : 'N/A'),
        detailRow('New Date', formatDate(appointment.start_time)),
        detailRow('New Time', formatTime(appointment.start_time)),
        detailRow('Status', appointment.status),
        detailRow('Type', appointment.appointment_type),
      ].join('');
      const html = buildEmailHtml('Appointment Updated', '#F59E0B', greeting, intro, rows, null);
      const waText = `*Appointment Updated*\n\n${greeting}\n\n${intro}\n\nPatient: ${patient?.first_name} ${patient?.last_name}\nDoctor: Dr. ${provider?.first_name} ${provider?.last_name}\nNew Date: ${formatDate(appointment.start_time)}\nNew Time: ${formatTime(appointment.start_time)}${appointment.status ? `\nStatus: ${appointment.status}` : ''}`;
      return { subject: `Appointment Updated – ${formatDate(appointment.start_time)}`, html, whatsapp: waText };
    });
  },

  'appointment.cancelled': async (pool, data) => {
    const { appointment } = data;
    await notifyAll(pool, {
      patient_id: appointment.patient_id,
      provider_id: appointment.provider_id,
    }, (role, person, { patient, provider }) => {
      const greeting = `Dear ${person.first_name},`;
      const intro = 'An appointment has been cancelled.';
      const rows = [
        detailRow('Patient', patient ? `${patient.first_name} ${patient.last_name}` : 'N/A'),
        detailRow('Doctor', provider ? `Dr. ${provider.first_name} ${provider.last_name}` : 'N/A'),
        detailRow('Date', formatDate(appointment.start_time)),
        detailRow('Time', formatTime(appointment.start_time)),
        detailRow('Type', appointment.appointment_type),
      ].join('');
      const html = buildEmailHtml('Appointment Cancelled', '#EF4444', greeting, intro, rows, null);
      const waText = `*Appointment Cancelled*\n\n${greeting}\n\n${intro}\n\nPatient: ${patient?.first_name} ${patient?.last_name}\nDoctor: Dr. ${provider?.first_name} ${provider?.last_name}\nDate: ${formatDate(appointment.start_time)}\nTime: ${formatTime(appointment.start_time)}`;
      return { subject: `Appointment Cancelled – ${formatDate(appointment.start_time)}`, html, whatsapp: waText };
    });
  },

  'appointment.status_changed': async (pool, data) => {
    const { appointment, old_status } = data;
    await notifyAll(pool, {
      patient_id: appointment.patient_id,
      provider_id: appointment.provider_id,
    }, (role, person, { patient, provider }) => {
      const greeting = `Dear ${person.first_name},`;
      const intro = `An appointment status has changed from <strong>${old_status}</strong> to <strong>${appointment.status}</strong>.`;
      const rows = [
        detailRow('Patient', patient ? `${patient.first_name} ${patient.last_name}` : 'N/A'),
        detailRow('Doctor', provider ? `Dr. ${provider.first_name} ${provider.last_name}` : 'N/A'),
        detailRow('Date', formatDate(appointment.start_time)),
        detailRow('New Status', appointment.status),
      ].join('');
      const html = buildEmailHtml('Appointment Status Changed', '#8B5CF6', greeting, intro, rows, null);
      const waText = `*Appointment Status Changed*\n\n${greeting}\n\nAppointment status changed from ${old_status} to ${appointment.status}.\n\nPatient: ${patient?.first_name} ${patient?.last_name}\nDoctor: Dr. ${provider?.first_name} ${provider?.last_name}\nDate: ${formatDate(appointment.start_time)}`;
      return { subject: `Appointment Status: ${appointment.status}`, html, whatsapp: waText };
    });
  },

  'prescription.created': async (pool, data) => {
    const { prescription, patient_id, provider_id } = data;
    await notifyAll(pool, { patient_id, provider_id }, (role, person, { patient, provider }) => {
      const greeting = `Dear ${person.first_name},`;
      const intro = role === 'patient'
        ? `Dr. ${provider?.first_name} ${provider?.last_name} has prescribed a new medication for you.`
        : role === 'doctor'
          ? `A prescription has been issued for ${patient?.first_name} ${patient?.last_name}.`
          : 'A new prescription has been created.';
      const rows = [
        detailRow('Patient', patient ? `${patient.first_name} ${patient.last_name}` : 'N/A'),
        detailRow('Doctor', provider ? `Dr. ${provider.first_name} ${provider.last_name}` : 'N/A'),
        detailRow('Medication', prescription.medication_name),
        detailRow('Dosage', prescription.dosage),
        detailRow('Instructions', prescription.instructions),
        detailRow('Refills', prescription.refills != null ? String(prescription.refills) : null),
        detailRow('Notes', prescription.notes),
      ].join('');
      const html = buildEmailHtml('New Prescription', '#10B981', greeting, intro, rows, null);
      const waText = `*New Prescription*\n\n${greeting}\n\n${intro.replace(/<[^>]+>/g, '')}\n\nMedication: ${prescription.medication_name}\nDosage: ${prescription.dosage}${prescription.instructions ? `\nInstructions: ${prescription.instructions}` : ''}${prescription.refills != null ? `\nRefills: ${prescription.refills}` : ''}`;
      return { subject: `New Prescription – ${prescription.medication_name}`, html, whatsapp: waText };
    });
  },

  'lab_order.created': async (pool, data) => {
    const { order, patient_id, provider_id } = data;
    await notifyAll(pool, { patient_id, provider_id }, (role, person, { patient, provider }) => {
      const greeting = `Dear ${person.first_name},`;
      const intro = role === 'patient'
        ? 'A lab order has been placed for you.'
        : role === 'doctor'
          ? `A lab order has been placed for ${patient?.first_name} ${patient?.last_name}.`
          : 'A new lab order has been created.';
      const rows = [
        detailRow('Patient', patient ? `${patient.first_name} ${patient.last_name}` : 'N/A'),
        detailRow('Doctor', provider ? `Dr. ${provider.first_name} ${provider.last_name}` : 'N/A'),
        detailRow('Test', order.test_name || order.order_name),
        detailRow('Lab', order.lab_name),
        detailRow('Priority', order.priority),
        detailRow('Status', order.status),
        detailRow('Notes', order.notes),
      ].join('');
      const html = buildEmailHtml('Lab Order Created', '#0EA5E9', greeting, intro, rows, null);
      const waText = `*Lab Order Created*\n\n${greeting}\n\n${intro}\n\nTest: ${order.test_name || order.order_name || 'N/A'}\nLab: ${order.lab_name || 'N/A'}${order.priority ? `\nPriority: ${order.priority}` : ''}`;
      return { subject: `Lab Order – ${order.test_name || order.order_name || 'Lab Test'}`, html, whatsapp: waText };
    });
  },

  'lab_order.status_changed': async (pool, data) => {
    const { order, patient_id, provider_id, old_status } = data;
    await notifyAll(pool, { patient_id, provider_id }, (role, person, { patient, provider }) => {
      const greeting = `Dear ${person.first_name},`;
      const intro = `A lab order status has changed from <strong>${old_status}</strong> to <strong>${order.status}</strong>.`;
      const rows = [
        detailRow('Patient', patient ? `${patient.first_name} ${patient.last_name}` : 'N/A'),
        detailRow('Test', order.test_name || order.order_name),
        detailRow('New Status', order.status),
        detailRow('Lab', order.lab_name),
      ].join('');
      const html = buildEmailHtml('Lab Order Updated', '#0EA5E9', greeting, intro, rows, null);
      const waText = `*Lab Order Updated*\n\n${greeting}\n\nLab order status changed from ${old_status} to ${order.status}.\n\nTest: ${order.test_name || order.order_name || 'N/A'}\nPatient: ${patient?.first_name} ${patient?.last_name}`;
      return { subject: `Lab Order Status: ${order.status}`, html, whatsapp: waText };
    });
  },

  'claim.created': async (pool, data) => {
    const { claim, patient_id } = data;
    const admin = await getAdminInfo(pool);
    const patient = await getPatient(pool, patient_id);

    for (const { role, person } of [{ role: 'patient', person: patient }, { role: 'admin', person: admin }].filter(r => r.person)) {
      const greeting = `Dear ${person.first_name},`;
      const intro = role === 'patient' ? 'A new insurance claim has been submitted for you.' : 'A new insurance claim has been submitted.';
      const rows = [
        detailRow('Claim Number', claim.claim_number),
        detailRow('Patient', patient ? `${patient.first_name} ${patient.last_name}` : 'N/A'),
        detailRow('Payer', claim.payer),
        detailRow('Amount', claim.amount != null ? `$${claim.amount}` : null),
        detailRow('Status', claim.status),
        detailRow('Service Date', formatDate(claim.service_date)),
      ].join('');
      const html = buildEmailHtml('Insurance Claim Submitted', '#6366F1', greeting, intro, rows, null);
      const waText = `*Insurance Claim Submitted*\n\n${greeting}\n\n${intro}\n\nClaim #: ${claim.claim_number || 'N/A'}\nPayer: ${claim.payer || 'N/A'}\nAmount: ${claim.amount != null ? `$${claim.amount}` : 'N/A'}\nStatus: ${claim.status || 'N/A'}`;
      if (person.email) await sendEmail(person.email, `Claim Submitted – ${claim.claim_number || ''}`, html);
      let waPhone = role === 'patient' ? await isWhatsAppEnabledForPatient(pool, patient_id) : person.phone;
      if (waPhone) await sendWhatsApp(waPhone, waText);
    }
  },

  'claim.status_changed': async (pool, data) => {
    const { claim, patient_id, old_status } = data;
    const admin = await getAdminInfo(pool);
    const patient = await getPatient(pool, patient_id);

    for (const { role, person } of [{ role: 'patient', person: patient }, { role: 'admin', person: admin }].filter(r => r.person)) {
      const greeting = `Dear ${person.first_name},`;
      const intro = `Your claim status has changed from <strong>${old_status}</strong> to <strong>${claim.status}</strong>.`;
      const rows = [
        detailRow('Claim Number', claim.claim_number),
        detailRow('Payer', claim.payer),
        detailRow('Old Status', old_status),
        detailRow('New Status', claim.status),
        detailRow('Amount', claim.amount != null ? `$${claim.amount}` : null),
      ].join('');
      const html = buildEmailHtml('Claim Status Updated', '#6366F1', greeting, intro, rows, null);
      const waText = `*Claim Status Updated*\n\n${greeting}\n\nClaim #${claim.claim_number || 'N/A'} status changed from ${old_status} to ${claim.status}.`;
      if (person.email) await sendEmail(person.email, `Claim Status: ${claim.status} – ${claim.claim_number || ''}`, html);
      let waPhone = role === 'patient' ? await isWhatsAppEnabledForPatient(pool, patient_id) : person.phone;
      if (waPhone) await sendWhatsApp(waPhone, waText);
    }
  },

  'payment.received': async (pool, data) => {
    const { payment, patient_id } = data;
    const admin = await getAdminInfo(pool);
    const patient = await getPatient(pool, patient_id);

    for (const { role, person } of [{ role: 'patient', person: patient }, { role: 'admin', person: admin }].filter(r => r.person)) {
      const greeting = `Dear ${person.first_name},`;
      const intro = role === 'patient' ? 'A payment has been recorded for your account.' : 'A new payment has been received.';
      const rows = [
        detailRow('Payment Number', payment.payment_number),
        detailRow('Patient', patient ? `${patient.first_name} ${patient.last_name}` : 'N/A'),
        detailRow('Amount', payment.amount != null ? `$${payment.amount}` : null),
        detailRow('Method', payment.payment_method),
        detailRow('Status', payment.payment_status),
        detailRow('Date', formatDate(payment.payment_date || payment.created_at)),
      ].join('');
      const html = buildEmailHtml('Payment Received', '#10B981', greeting, intro, rows, null);
      const waText = `*Payment Received*\n\n${greeting}\n\n${intro}\n\nAmount: ${payment.amount != null ? `$${payment.amount}` : 'N/A'}\nMethod: ${payment.payment_method || 'N/A'}\nStatus: ${payment.payment_status || 'N/A'}`;
      if (person.email) await sendEmail(person.email, `Payment Received – $${payment.amount || ''}`, html);
      let waPhone = role === 'patient' ? await isWhatsAppEnabledForPatient(pool, patient_id) : person.phone;
      if (waPhone) await sendWhatsApp(waPhone, waText);
    }
  },

  'task.created': async (pool, data) => {
    const { task } = data;
    const admin = await getAdminInfo(pool);
    if (!admin || !admin.email) return;
    const intro = 'A new task has been created.';
    const rows = [
      detailRow('Title', task.title),
      detailRow('Priority', task.priority),
      detailRow('Due Date', task.due_date ? formatDate(task.due_date) : null),
      detailRow('Status', task.status),
      detailRow('Description', task.description),
    ].join('');
    const html = buildEmailHtml('New Task Created', '#F59E0B', `Dear Admin,`, intro, rows, null);
    await sendEmail(admin.email, `New Task: ${task.title}`, html);
    if (admin.phone) {
      await sendWhatsApp(admin.phone, `*New Task Created*\n\nTitle: ${task.title}\nPriority: ${task.priority || 'N/A'}\nDue: ${task.due_date ? formatDate(task.due_date) : 'N/A'}\nStatus: ${task.status || 'N/A'}`);
    }
  },

  'task.completed': async (pool, data) => {
    const { task } = data;
    const admin = await getAdminInfo(pool);
    if (!admin || !admin.email) return;
    const intro = 'A task has been marked as completed.';
    const rows = [
      detailRow('Title', task.title),
      detailRow('Priority', task.priority),
      detailRow('Status', task.status),
    ].join('');
    const html = buildEmailHtml('Task Completed', '#10B981', `Dear Admin,`, intro, rows, null);
    await sendEmail(admin.email, `Task Completed: ${task.title}`, html);
    if (admin.phone) {
      await sendWhatsApp(admin.phone, `*Task Completed*\n\nTitle: ${task.title}\nPriority: ${task.priority || 'N/A'}`);
    }
  },

  'telehealth.session_created': async (pool, data) => {
    const { session, patient_id, provider_id } = data;
    await notifyAll(pool, { patient_id, provider_id }, (role, person, { patient, provider }) => {
      const greeting = `Dear ${person.first_name},`;
      const intro = role === 'patient'
        ? 'Your telehealth session has been scheduled.'
        : role === 'doctor'
          ? `A telehealth session has been scheduled with ${patient?.first_name} ${patient?.last_name}.`
          : 'A new telehealth session has been scheduled.';
      const rows = [
        detailRow('Patient', patient ? `${patient.first_name} ${patient.last_name}` : 'N/A'),
        detailRow('Doctor', provider ? `Dr. ${provider.first_name} ${provider.last_name}` : 'N/A'),
        detailRow('Date', formatDate(session.start_time)),
        detailRow('Time', formatTime(session.start_time)),
        detailRow('Duration', session.duration_minutes ? `${session.duration_minutes} min` : null),
        detailRow('Meeting Link', session.meeting_url || 'Will be provided shortly'),
      ].join('');
      const extra = session.meeting_url
        ? `<strong>Join Link:</strong> <a href="${session.meeting_url}">${session.meeting_url}</a>`
        : null;
      const html = buildEmailHtml('Telehealth Session Scheduled', '#8B5CF6', greeting, intro, rows, extra);
      const waText = `*Telehealth Session Scheduled*\n\n${greeting}\n\n${intro}\n\nDate: ${formatDate(session.start_time)}\nTime: ${formatTime(session.start_time)}${session.meeting_url ? `\n\nJoin: ${session.meeting_url}` : ''}`;
      return { subject: `Telehealth Session – ${formatDate(session.start_time)}`, html, whatsapp: waText };
    });
  },
};

module.exports = { dispatch, sendEmail, buildEmailHtml };
