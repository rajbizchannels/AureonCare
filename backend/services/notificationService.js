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

// ─── Branded email layout ──────────────────────────────────────────────────────
//
// Every email the backend sends goes through buildEmailHtml, so this is the one place the
// AureonCare look is defined. Colours are taken from the brand's own assets, not guessed:
//   gold / teal  – sampled from frontend/public/assets/aureoncare-wordmark.png
//                  ("Aureon" averages #F9BD00, "Care" averages #08B39C)
//   tagline      – frontend/src/components/common/BrandLogo.js (#108050 light, #5EEAD4 on dark)
//   slate        – the app's dark top bar (TopBar.js: bg-slate-900 / border-slate-800)
//   primary      – the app's primary button colour (bg-blue-600, Tailwind default palette)
//   button       – call-to-action buttons: the brand teal (#08B39C) deepened to #068573 so
//                  white button text keeps WCAG AA contrast (4.56:1; the logo teal is 2.65:1)
//
// Email-safe on purpose: layout tables, inline styles, a 600px column, no web fonts, no
// external CSS. The <style> block only adds a dark-mode enhancement for the clients that
// honour it; everything still reads correctly where it is stripped, and the wordmark is
// live text so the header is intact with images blocked.

const BRAND = {
  gold: '#F9BD00',
  teal: '#08B39C',
  tagline: '#108050',
  taglineOnDark: '#5EEAD4',
  slate: '#0F172A',
  slateEdge: '#1E293B',
  primary: '#2563EB',
  primaryDark: '#1D4ED8',
  button: '#068573',
  text: '#1E293B',
  muted: '#64748B',
  border: '#E2E8F0',
  page: '#F1F5F9',
  card: '#FFFFFF',
  panel: '#F8FAFC',
  danger: '#DC2626',
  warning: '#D97706',
  neutral: '#64748B',
};
const TAGLINE = 'Health | Efficiency | Growth';
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const LOGO_PATH = '/assets/aureoncare-mark.png'; // served from frontend/public

const escapeHtml = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const productName = () => process.env.AC_CLN || 'AureonCare';

/** Absolute logo URL, or null when there is no public frontend origin to serve it from. */
function logoUrl() {
  const base = (process.env.FRONTEND_URL || '').split(',')[0].trim().replace(/\/+$/, '');
  return /^https?:\/\/[^\s"'<>]+$/i.test(base) ? `${base}${LOGO_PATH}` : null;
}

/**
 * Callers still pass their own header colour (the signature predates the brand layout).
 * Rather than paint headers in arbitrary colours, the colour now only picks a TONE for the
 * small accent beside the title, so a cancellation or a critical platform alert still reads
 * as such while everything else is on-brand.
 */
function toneFor(colour) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(colour || '').trim());
  if (!m) return BRAND.teal;
  let hex = m[1];
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d < 0.12) return BRAND.neutral;                       // greys
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  if (h < 15 || h >= 345) return BRAND.danger;               // reds
  if (h < 50) return BRAND.warning;                          // ambers / oranges
  return BRAND.teal;                                         // everything else -> brand teal
}

/** One label/value row for the details panel. The value is escaped; the label is trusted. */
function detailRow(label, value, opts = {}) {
  if (!value && value !== 0) return '';
  const valueStyle = opts.mono
    ? `font-family:Consolas,'Courier New',monospace;font-size:15px;word-break:break-all;`
    : '';
  return `<tr>
    <td class="ac-muted ac-rule" valign="top" style="padding:10px 16px;border-top:1px solid ${BRAND.border};font-family:${FONT};font-size:13px;font-weight:bold;color:${BRAND.muted};white-space:nowrap;width:35%">${label}</td>
    <td class="ac-text ac-rule" valign="top" style="padding:10px 16px;border-top:1px solid ${BRAND.border};font-family:${FONT};font-size:14px;color:${BRAND.text};${valueStyle}">${escapeHtml(value)}</td>
  </tr>`;
}

/** Bulletproof brand button (a padded table cell, so Outlook still shows the colour). */
function emailButton(href, label, opts = {}) {
  const bg = opts.secondary ? BRAND.neutral : BRAND.button;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-table;margin:6px 6px 6px 0;border-collapse:separate"><tr>
    <td bgcolor="${bg}" style="background:${bg};border-radius:8px;mso-padding-alt:12px 24px">
      <a href="${escapeHtml(href)}" target="_blank" style="display:inline-block;padding:12px 24px;font-family:${FONT};font-size:15px;font-weight:bold;line-height:20px;color:#FFFFFF;text-decoration:none;border-radius:8px">${escapeHtml(label)}</a>
    </td></tr></table>`;
}

/**
 * A scan-to-open QR code for one of our short links (/s/<code>), so a link read on a
 * computer can be opened on a phone. The image is served by GET /s/<code>/qr.png, which
 * only draws the short URL itself — it never resolves the code. Any other URL gets
 * nothing: a QR code is offered only where the link is short and on our own domain.
 * With images blocked, the alt text and the link above it still work.
 */
function emailQr(url, opts = {}) {
  const base = require('./shortLinks').shortBase();
  const m = /^(.*)\/s\/([A-Za-z0-9]{12})$/.exec(String(url || ''));
  if (!base || !m || m[1] !== base) return '';
  const src = `${base}/s/${m[2]}/qr.png`;
  const caption = opts.caption || 'On your phone? Scan to open this link.';
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:${opts.margin || '14px 0 6px'}"><tr>
    <td style="padding:8px;background:#FFFFFF;border:1px solid ${BRAND.border};border-radius:10px">
      <img src="${escapeHtml(src)}" width="132" height="132" alt="QR code for the link above" style="display:block;width:132px;height:132px;border:0">
    </td>
    <td class="ac-muted" style="padding:0 0 0 14px;font-family:${FONT};font-size:13px;line-height:1.5;color:${BRAND.muted};vertical-align:middle">${escapeHtml(caption)}</td>
  </tr></table>`;
}

/** A paragraph in the body text style. `html` is trusted markup. */
function emailParagraph(html, opts = {}) {
  const muted = opts.muted;
  return `<p class="${muted ? 'ac-muted' : 'ac-text'}" style="margin:${opts.margin || '0 0 14px'};font-family:${FONT};font-size:${muted ? '13px' : '15px'};line-height:1.6;color:${muted ? BRAND.muted : BRAND.text}">${html}</p>`;
}

/** A highlighted call-out (e.g. the reminder banner). `html` is trusted markup. */
function emailCallout(html) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px"><tr>
    <td class="ac-callout ac-text" style="background:#FEF9E7;border-left:4px solid ${BRAND.gold};border-radius:6px;padding:14px 16px;font-family:${FONT};font-size:15px;line-height:1.5;color:${BRAND.text}">${html}</td>
  </tr></table>`;
}

/** Rows are separated by a top rule; the first row (both cells) sits flush with the panel. */
function firstRowUnruled(rowsHtml) {
  let n = 0;
  const rule = `border-top:1px solid ${BRAND.border};`;
  return rowsHtml.split(rule).reduce((acc, part, i) => (i === 0 ? part : acc + (n++ < 2 ? '' : rule) + part), '');
}

function wordmarkHtml() {
  const name = productName();
  const m = /^(Aureon)(Care)$/i.exec(name);
  const word = m
    ? `<span style="color:${BRAND.gold}">${escapeHtml(m[1])}</span><span style="color:${BRAND.teal}">${escapeHtml(m[2])}</span>`
    : `<span style="color:${BRAND.gold}">${escapeHtml(name)}</span>`;
  return `<div style="font-family:${FONT};font-size:26px;line-height:30px;font-weight:bold;letter-spacing:-0.3px">${word}</div>
          <div style="font-family:${FONT};font-size:11px;line-height:16px;font-weight:600;letter-spacing:0.6px;color:${BRAND.taglineOnDark};padding-top:2px">${TAGLINE}</div>`;
}

/**
 * Wrap content in the AureonCare layout.
 *
 * Backward compatible: (title, headerColor, greeting, intro, rows, extra) as before.
 *   title / greeting / intro / extra – trusted HTML (callers escape what they interpolate)
 *   rows   – an HTML string of <tr>s (detailRow), or an array of [label, value] pairs,
 *            whose values are escaped here
 *   opts   – optional { practiceName, footerNote }: practiceName adds the "sent by ... via"
 *            line; footerNote replaces the default do-not-reply safety text
 */
function buildEmailHtml(title, headerColor, greeting, intro, rows, extra, opts = {}) {
  const product = productName();
  const tone = toneFor(headerColor);
  const logo = logoUrl();
  const rowsHtml = Array.isArray(rows)
    ? rows.map((r) => (Array.isArray(r) ? detailRow(escapeHtml(r[0]), r[1]) : '')).join('')
    : (rows || '');
  const plainTitle = String(title || product).replace(/<[^>]+>/g, '');
  const footerNote = opts.footerNote || 'This is an automated message. Please do not reply to this email.';
  const sentBy = opts.practiceName
    ? `This message was sent by ${escapeHtml(opts.practiceName)} via ${escapeHtml(product)}.`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${plainTitle}</title>
<style>
  @media (prefers-color-scheme: dark) {
    .ac-page { background:#020617 !important; }
    .ac-card { background:${BRAND.slateEdge} !important; }
    .ac-panel { background:${BRAND.slate} !important; border-color:#334155 !important; }
    .ac-callout { background:#332B0A !important; }
    .ac-rule { border-color:#334155 !important; }
    .ac-tagline { color:${BRAND.taglineOnDark} !important; }
    .ac-text { color:#E2E8F0 !important; }
    .ac-muted { color:#94A3B8 !important; }
  }
  @media only screen and (max-width:620px) {
    .ac-pad { padding-left:20px !important; padding-right:20px !important; }
  }
</style>
</head>
<body class="ac-page" style="margin:0;padding:0;background:${BRAND.page};-webkit-text-size-adjust:100%">
<table role="presentation" class="ac-page" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BRAND.page}" style="background:${BRAND.page}">
<tr><td align="center" style="padding:24px 12px">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;border-collapse:separate">
    <tr><td class="ac-pad" bgcolor="${BRAND.slate}" style="background:${BRAND.slate};border-radius:12px 12px 0 0;padding:22px 32px">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        ${logo ? `<td valign="middle" style="padding-right:12px"><img src="${escapeHtml(logo)}" width="44" height="37" alt="${escapeHtml(product)} logo" style="display:block;border:0;outline:none;width:44px;height:37px;font-family:${FONT};font-size:10px;color:${BRAND.gold}"></td>` : ''}
        <td valign="middle">${wordmarkHtml()}</td>
      </tr></table>
    </td></tr>
    <tr><td style="font-size:0;line-height:0;height:4px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="50%" height="4" bgcolor="${BRAND.gold}" style="background:${BRAND.gold};height:4px;font-size:0;line-height:0">&nbsp;</td>
      <td width="50%" height="4" bgcolor="${BRAND.teal}" style="background:${BRAND.teal};height:4px;font-size:0;line-height:0">&nbsp;</td>
    </tr></table></td></tr>
    <tr><td class="ac-card ac-pad" bgcolor="${BRAND.card}" style="background:${BRAND.card};border-radius:0 0 12px 12px;padding:32px">
      <h1 class="ac-text" style="margin:0 0 20px;padding:2px 0 2px 12px;border-left:4px solid ${tone};font-family:${FONT};font-size:22px;line-height:1.3;font-weight:bold;color:${BRAND.slate}">${title}</h1>
      ${greeting ? emailParagraph(greeting) : ''}
      ${intro ? `<div class="ac-text" style="margin:0 0 14px;font-family:${FONT};font-size:15px;line-height:1.6;color:${BRAND.text}">${intro}</div>` : ''}
      ${rowsHtml ? `<table role="presentation" class="ac-panel" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BRAND.panel}" style="background:${BRAND.panel};border:1px solid ${BRAND.border};border-radius:8px;border-collapse:separate;margin:8px 0 20px;overflow:hidden">${firstRowUnruled(rowsHtml)}</table>` : ''}
      ${extra ? `<div class="ac-text" style="margin:8px 0 0;font-family:${FONT};font-size:15px;line-height:1.6;color:${BRAND.text}">${extra}</div>` : ''}
    </td></tr>
    <tr><td class="ac-pad" align="center" style="padding:24px 32px 8px;font-family:${FONT};font-size:12px;line-height:1.6;color:${BRAND.muted}">
      ${sentBy ? `<p class="ac-muted" style="margin:0 0 6px;color:${BRAND.muted}">${sentBy}</p>` : ''}
      <p class="ac-muted" style="margin:0 0 6px;color:${BRAND.muted}">${footerNote}</p>
      <p class="ac-muted" style="margin:0 0 6px;color:${BRAND.muted}">&copy; ${new Date().getFullYear()} ${escapeHtml(product)}. All rights reserved.</p>
      <p class="ac-tagline" style="margin:8px 0 0;font-weight:bold;color:${BRAND.tagline};letter-spacing:0.4px">${TAGLINE}</p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
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

// WhatsApp template for an event (services/whatsappTemplates.js). Patients and doctors get
// the specific template; admins, and events with no patient-facing template, get the
// general "update" one with a one-line summary.
const drName = (p) => (p ? `Dr. ${p.first_name || ''} ${p.last_name || ''}`.trim() : 'your doctor');
const ptName = (p) => (p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() : 'a patient');
function apptTemplate(key, role, person, { patient, provider }, appointment, statusText) {
  const name = person.first_name || 'there';
  const date = formatDate(appointment.start_time);
  const time = formatTime(appointment.start_time);
  if (role === 'admin') {
    const what = { appointment_scheduled: 'new appointment', appointment_updated: 'appointment changed',
      appointment_cancelled: 'appointment cancelled', appointment_status: `appointment now ${statusText}` }[key] || 'appointment update';
    return { key: 'general_update', vars: [name, `${what} for ${ptName(patient)} with ${drName(provider)} on ${date} at ${time}`] };
  }
  const other = role === 'doctor' ? ptName(patient) : drName(provider);
  if (key === 'appointment_status') return { key, vars: [name, other, date, statusText] };
  return { key, vars: [name, other, date, time] };
}
const updateTemplate = (person, summary) => ({ key: 'general_update', vars: [person.first_name || 'there', summary] });

async function sendWhatsApp(phone, message, template = null) {
  if (!whatsappService || !phone) return;
  // SEC-24: same per-recipient cap, which also bounds spend at the messaging provider.
  const quota = await consumeSendQuota('whatsapp', phone);
  if (!quota.allowed) {
    console.warn(`[SEC-24] WhatsApp to ${phone} suppressed — ${quota.count} sends exceeds the limit of ${quota.limit} in the window`);
    return;
  }
  try {
    await whatsappService.notify(phone, message, template);
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
      await sendWhatsApp(waPhone, msg.whatsapp, msg.whatsappTemplate || null);
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
      const html = buildEmailHtml('Appointment Scheduled', '#3B82F6', escapeHtml(greeting), escapeHtml(intro), rows, null);
      const waText = `*Appointment Scheduled*\n\n${greeting}\n\n${intro}\n\nPatient: ${patient?.first_name} ${patient?.last_name}\nDoctor: Dr. ${provider?.first_name} ${provider?.last_name}\nDate: ${formatDate(appointment.start_time)}\nTime: ${formatTime(appointment.start_time)}${appointment.appointment_type ? `\nType: ${appointment.appointment_type}` : ''}${appointment.reason ? `\nReason: ${appointment.reason}` : ''}`;
      return { subject: `Appointment Scheduled – ${formatDate(appointment.start_time)}`, html, whatsapp: waText, whatsappTemplate: apptTemplate('appointment_scheduled', role, person, { patient, provider }, appointment) };
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
      const html = buildEmailHtml('Appointment Updated', '#F59E0B', escapeHtml(greeting), escapeHtml(intro), rows, null);
      const waText = `*Appointment Updated*\n\n${greeting}\n\n${intro}\n\nPatient: ${patient?.first_name} ${patient?.last_name}\nDoctor: Dr. ${provider?.first_name} ${provider?.last_name}\nNew Date: ${formatDate(appointment.start_time)}\nNew Time: ${formatTime(appointment.start_time)}${appointment.status ? `\nStatus: ${appointment.status}` : ''}`;
      return { subject: `Appointment Updated – ${formatDate(appointment.start_time)}`, html, whatsapp: waText, whatsappTemplate: apptTemplate('appointment_updated', role, person, { patient, provider }, appointment) };
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
      const html = buildEmailHtml('Appointment Cancelled', '#EF4444', escapeHtml(greeting), escapeHtml(intro), rows, null);
      const waText = `*Appointment Cancelled*\n\n${greeting}\n\n${intro}\n\nPatient: ${patient?.first_name} ${patient?.last_name}\nDoctor: Dr. ${provider?.first_name} ${provider?.last_name}\nDate: ${formatDate(appointment.start_time)}\nTime: ${formatTime(appointment.start_time)}`;
      return { subject: `Appointment Cancelled – ${formatDate(appointment.start_time)}`, html, whatsapp: waText, whatsappTemplate: apptTemplate('appointment_cancelled', role, person, { patient, provider }, appointment) };
    });
  },

  'appointment.status_changed': async (pool, data) => {
    const { appointment, old_status } = data;
    await notifyAll(pool, {
      patient_id: appointment.patient_id,
      provider_id: appointment.provider_id,
    }, (role, person, { patient, provider }) => {
      const greeting = `Dear ${person.first_name},`;
      const intro = `An appointment status has changed from <strong>${escapeHtml(old_status)}</strong> to <strong>${escapeHtml(appointment.status)}</strong>.`;
      const rows = [
        detailRow('Patient', patient ? `${patient.first_name} ${patient.last_name}` : 'N/A'),
        detailRow('Doctor', provider ? `Dr. ${provider.first_name} ${provider.last_name}` : 'N/A'),
        detailRow('Date', formatDate(appointment.start_time)),
        detailRow('New Status', appointment.status),
      ].join('');
      const html = buildEmailHtml('Appointment Status Changed', '#8B5CF6', escapeHtml(greeting), intro, rows, null);
      const waText = `*Appointment Status Changed*\n\n${greeting}\n\nAppointment status changed from ${old_status} to ${appointment.status}.\n\nPatient: ${patient?.first_name} ${patient?.last_name}\nDoctor: Dr. ${provider?.first_name} ${provider?.last_name}\nDate: ${formatDate(appointment.start_time)}`;
      return { subject: `Appointment Status: ${appointment.status}`, html, whatsapp: waText, whatsappTemplate: apptTemplate('appointment_status', role, person, { patient, provider }, appointment, appointment.status) };
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
      const html = buildEmailHtml('New Prescription', '#10B981', escapeHtml(greeting), escapeHtml(intro), rows, null);
      const waText = `*New Prescription*\n\n${greeting}\n\n${intro.replace(/<[^>]+>/g, '')}\n\nMedication: ${prescription.medication_name}\nDosage: ${prescription.dosage}${prescription.instructions ? `\nInstructions: ${prescription.instructions}` : ''}${prescription.refills != null ? `\nRefills: ${prescription.refills}` : ''}`;
      return { subject: `New Prescription – ${prescription.medication_name}`, html, whatsapp: waText, whatsappTemplate: role === 'patient'
        ? { key: 'prescription_new', vars: [person.first_name, drName(provider), prescription.medication_name, prescription.dosage] }
        : updateTemplate(person, `prescription of ${prescription.medication_name} for ${ptName(patient)}`) };
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
      const html = buildEmailHtml('Lab Order Created', '#0EA5E9', escapeHtml(greeting), escapeHtml(intro), rows, null);
      const waText = `*Lab Order Created*\n\n${greeting}\n\n${intro}\n\nTest: ${order.test_name || order.order_name || 'N/A'}\nLab: ${order.lab_name || 'N/A'}${order.priority ? `\nPriority: ${order.priority}` : ''}`;
      return { subject: `Lab Order – ${order.test_name || order.order_name || 'Lab Test'}`, html, whatsapp: waText, whatsappTemplate: role === 'patient'
        ? { key: 'lab_order_new', vars: [person.first_name, order.test_name || order.order_name || 'lab test', order.lab_name || 'the laboratory'] }
        : updateTemplate(person, `lab order ${order.test_name || order.order_name || ''} for ${ptName(patient)}`.replace(/  +/g, ' ')) };
    });
  },

  'lab_order.status_changed': async (pool, data) => {
    const { order, patient_id, provider_id, old_status } = data;
    await notifyAll(pool, { patient_id, provider_id }, (role, person, { patient, provider }) => {
      const greeting = `Dear ${person.first_name},`;
      const intro = `A lab order status has changed from <strong>${escapeHtml(old_status)}</strong> to <strong>${escapeHtml(order.status)}</strong>.`;
      const rows = [
        detailRow('Patient', patient ? `${patient.first_name} ${patient.last_name}` : 'N/A'),
        detailRow('Test', order.test_name || order.order_name),
        detailRow('New Status', order.status),
        detailRow('Lab', order.lab_name),
      ].join('');
      const html = buildEmailHtml('Lab Order Updated', '#0EA5E9', escapeHtml(greeting), intro, rows, null);
      const waText = `*Lab Order Updated*\n\n${greeting}\n\nLab order status changed from ${old_status} to ${order.status}.\n\nTest: ${order.test_name || order.order_name || 'N/A'}\nPatient: ${patient?.first_name} ${patient?.last_name}`;
      return { subject: `Lab Order Status: ${order.status}`, html, whatsapp: waText, whatsappTemplate: updateTemplate(person, `lab order ${order.test_name || order.order_name || ''} is now ${order.status}`.replace(/  +/g, ' ')) };
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
      const html = buildEmailHtml('Insurance Claim Submitted', '#6366F1', escapeHtml(greeting), escapeHtml(intro), rows, null);
      const waText = `*Insurance Claim Submitted*\n\n${greeting}\n\n${intro}\n\nClaim #: ${claim.claim_number || 'N/A'}\nPayer: ${claim.payer || 'N/A'}\nAmount: ${claim.amount != null ? `$${claim.amount}` : 'N/A'}\nStatus: ${claim.status || 'N/A'}`;
      if (person.email) await sendEmail(person.email, `Claim Submitted – ${claim.claim_number || ''}`, html);
      let waPhone = role === 'patient' ? await isWhatsAppEnabledForPatient(pool, patient_id) : person.phone;
      if (waPhone) await sendWhatsApp(waPhone, waText, updateTemplate(person, `claim ${claim.claim_number || ''} submitted${claim.amount != null ? ` for $${claim.amount}` : ''}`.replace(/  +/g, ' ')));
    }
  },

  'claim.status_changed': async (pool, data) => {
    const { claim, patient_id, old_status } = data;
    const admin = await getAdminInfo(pool);
    const patient = await getPatient(pool, patient_id);

    for (const { role, person } of [{ role: 'patient', person: patient }, { role: 'admin', person: admin }].filter(r => r.person)) {
      const greeting = `Dear ${person.first_name},`;
      const intro = `Your claim status has changed from <strong>${escapeHtml(old_status)}</strong> to <strong>${escapeHtml(claim.status)}</strong>.`;
      const rows = [
        detailRow('Claim Number', claim.claim_number),
        detailRow('Payer', claim.payer),
        detailRow('Old Status', old_status),
        detailRow('New Status', claim.status),
        detailRow('Amount', claim.amount != null ? `$${claim.amount}` : null),
      ].join('');
      const html = buildEmailHtml('Claim Status Updated', '#6366F1', escapeHtml(greeting), intro, rows, null);
      const waText = `*Claim Status Updated*\n\n${greeting}\n\nClaim #${claim.claim_number || 'N/A'} status changed from ${old_status} to ${claim.status}.`;
      if (person.email) await sendEmail(person.email, `Claim Status: ${claim.status} – ${claim.claim_number || ''}`, html);
      let waPhone = role === 'patient' ? await isWhatsAppEnabledForPatient(pool, patient_id) : person.phone;
      if (waPhone) await sendWhatsApp(waPhone, waText, updateTemplate(person, `claim ${claim.claim_number || ''} is now ${claim.status}`.replace(/  +/g, ' ')));
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
      const html = buildEmailHtml('Payment Received', '#10B981', escapeHtml(greeting), escapeHtml(intro), rows, null);
      const waText = `*Payment Received*\n\n${greeting}\n\n${intro}\n\nAmount: ${payment.amount != null ? `$${payment.amount}` : 'N/A'}\nMethod: ${payment.payment_method || 'N/A'}\nStatus: ${payment.payment_status || 'N/A'}`;
      if (person.email) await sendEmail(person.email, `Payment Received – $${payment.amount || ''}`, html);
      let waPhone = role === 'patient' ? await isWhatsAppEnabledForPatient(pool, patient_id) : person.phone;
      if (waPhone) await sendWhatsApp(waPhone, waText, updateTemplate(person, `payment of ${payment.amount != null ? `$${payment.amount}` : 'an amount'} received`));
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
      await sendWhatsApp(admin.phone, `*New Task Created*\n\nTitle: ${task.title}\nPriority: ${task.priority || 'N/A'}\nDue: ${task.due_date ? formatDate(task.due_date) : 'N/A'}\nStatus: ${task.status || 'N/A'}`,
        updateTemplate(admin, `new task "${task.title}"`));
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
      await sendWhatsApp(admin.phone, `*Task Completed*\n\nTitle: ${task.title}\nPriority: ${task.priority || 'N/A'}`,
        updateTemplate(admin, `task "${task.title}" completed`));
    }
  },

  'telehealth.session_created': async (pool, data) => {
    const { patient_id, provider_id } = data;
    // The join link goes out as a short link (/s/<code>); it keeps working until a day
    // after the session starts. Falls back to the full URL if it cannot be shortened.
    const session = { ...data.session };
    if (session.meeting_url) {
      const start = session.start_time ? new Date(session.start_time) : null;
      const expiresAt = start && !Number.isNaN(start.getTime()) ? new Date(start.getTime() + 24 * 3600 * 1000) : null;
      session.meeting_url = await require('./shortLinks').shorten(session.meeting_url, { expiresAt, kind: 'telehealth', db: pool });
    }
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
        ? `<strong>Join Link:</strong> <a href="${escapeHtml(session.meeting_url)}" style="color:${BRAND.primary}">${escapeHtml(session.meeting_url)}</a>`
          + emailQr(session.meeting_url, { caption: 'Joining from your phone? Scan to open the session.' })
        : null;
      const html = buildEmailHtml('Telehealth Session Scheduled', '#8B5CF6', escapeHtml(greeting), escapeHtml(intro), rows, extra);
      const waText = `*Telehealth Session Scheduled*\n\n${greeting}\n\n${intro}\n\nDate: ${formatDate(session.start_time)}\nTime: ${formatTime(session.start_time)}${session.meeting_url ? `\n\nJoin: ${session.meeting_url}` : ''}`;
      return { subject: `Telehealth Session – ${formatDate(session.start_time)}`, html, whatsapp: waText, whatsappTemplate: session.meeting_url
        ? { key: 'telehealth_session', vars: [person.first_name, role === 'doctor' ? ptName(patient) : drName(provider),
            formatDate(session.start_time), formatTime(session.start_time), session.meeting_url] }
        : updateTemplate(person, `video appointment on ${formatDate(session.start_time)} at ${formatTime(session.start_time)}`) };
    });
  },
};

module.exports = {
  dispatch, sendEmail, buildEmailHtml,
  // Building blocks for templates that need more than buildEmailHtml's fixed slots.
  detailRow, emailButton, emailParagraph, emailCallout, emailQr, escapeHtml, BRAND, TAGLINE,
};
