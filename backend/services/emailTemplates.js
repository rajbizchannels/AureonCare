// Email bodies that are more than a one-line buildEmailHtml call.
//
// Each function only RENDERS — it returns the HTML and sends nothing — so the routes and
// services that own the send (and its error handling) keep it, and the templates can be
// rendered on their own in tests and previews. All of them go through the shared AureonCare
// layout in notificationService.buildEmailHtml; every user-supplied value is escaped here.

const {
  buildEmailHtml, detailRow, emailButton, emailParagraph, emailCallout, emailQr, escapeHtml, BRAND,
} = require('./notificationService');

const product = () => process.env.AC_CLN || 'AureonCare';
const link = (href) =>
  `<a href="${escapeHtml(href)}" style="color:${BRAND.primary};text-decoration:underline;word-break:break-all">${escapeHtml(href)}</a>`;

// ── Staff invite (routes/invites.js) ─────────────────────────────────────────────────
function renderStaffInviteEmail({ practiceName, inviterName, role, inviteUrl, expiresAt }) {
  const practice = escapeHtml(practiceName);
  return buildEmailHtml(
    `You have been invited to ${practice}`,
    '#08B39C',
    'Hello,',
    `${inviterName ? escapeHtml(inviterName) : 'An administrator'} has invited you to join <strong>${practice}</strong> on ${escapeHtml(product())}. ` +
      'Use the button below to set up your account — you can finish with a password or with your Google or Microsoft account.',
    [
      ['Practice', practiceName],
      ['Your role', role],
      ['Invited by', inviterName || '—'],
      ['Link expires', expiresAt ? new Date(expiresAt).toUTCString() : '—'],
    ],
    emailButton(inviteUrl, 'Accept the invitation') +
      emailQr(inviteUrl) +
      emailParagraph(`If the button does not work, paste this into your browser:<br>${link(inviteUrl)}`,
        { muted: true, margin: '16px 0 10px' }) +
      emailParagraph('If you were not expecting this, ignore this email — the invitation expires on its own ' +
        'and no account is created until it is used.', { muted: true, margin: '0' }),
    { practiceName }
  );
}

// ── Patient portal invite (routes/portalInvites.js) ──────────────────────────────────
function renderPortalInviteEmail({ firstName, practice, url, expiresAt }) {
  return buildEmailHtml(
    `Your ${escapeHtml(practice)} patient portal`,
    '#08B39C',
    `Hello ${escapeHtml(firstName) || 'there'},`,
    `<strong>${escapeHtml(practice)}</strong> has invited you to its patient portal, where you can see your ` +
      'appointments, messages and records. Setting up takes a minute: choose a password, or continue with ' +
      'your Google or Microsoft account.',
    [['Link expires', new Date(expiresAt).toUTCString()]],
    emailButton(url, 'Set up my portal') +
      emailQr(url, { caption: 'On your phone? Scan to set up your portal there.' }) +
      emailParagraph(`If the button does not work, paste this into your browser:<br>${link(url)}`,
        { muted: true, margin: '16px 0 10px' }) +
      emailParagraph('If you were not expecting this, you can ignore it — the link works once and expires on its own.',
        { muted: true, margin: '0' }),
    { practiceName: practice }
  );
}

// ── Domain join request, to the practice admins (routes/teamAccess.js) ───────────────
function renderJoinRequestEmail({ claim, user }) {
  return buildEmailHtml(
    'Someone has asked to join your practice',
    '#08B39C',
    'Hello,',
    `<strong>${escapeHtml(user.email)}</strong> signed up using your verified domain `
      + `<strong>${escapeHtml(claim.domain)}</strong> and is waiting for approval. They cannot sign in until `
      + 'an administrator approves the request.',
    [['Name', `${user.first_name || ''} ${user.last_name || ''}`.trim() || '—'],
     ['Email', user.email],
     ['Requested role', user.role]],
    'Review it under Settings → Team access.',
    { practiceName: claim.practice_name }
  );
}

// ── Join request decision, to the applicant (routes/teamAccess.js) ───────────────────
function renderJoinDecisionEmail({ approved }) {
  return buildEmailHtml(
    approved ? 'You can now sign in' : 'Your request was not approved',
    approved ? '#16a34a' : '#6b7280',
    'Hello,',
    approved
      ? 'An administrator approved your request. You can sign in with the password you chose.'
      : 'An administrator reviewed your request and did not approve it. If you think this is '
        + 'a mistake, contact them directly.',
    null, null
  );
}

// ── Password reset (routes/auth.js) ──────────────────────────────────────────────────
function renderPasswordResetEmail({ firstName, resetToken, resetLink }) {
  return buildEmailHtml(
    'Password Reset Request',
    '#08B39C',
    `Hi ${escapeHtml(firstName)},`,
    'We received a request to reset your AureonCare password. Use the reset code below — it expires in 1 hour. If you did not request this, you can safely ignore this email.',
    detailRow('Reset code', resetToken, { mono: true }),
    resetLink
      ? `Or click here to reset your password: ${link(resetLink)}` + emailQr(resetLink)
      : 'Enter this code in the password reset screen to choose a new password.'
  );
}

// ── Appointment confirmation / reminder / cancellation (services/reminderService.js) ─
const fmtDate = (d) => d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
const fmtTime = (d) => d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
const centered = (html) => `<div style="text-align:center;margin:4px 0 16px">${html}</div>`;
const fullName = (p) => `${escapeHtml(p.first_name)} ${escapeHtml(p.last_name)}`;

function renderAppointmentConfirmationEmail({ appointment, patient, provider, frontendUrl = process.env.AC_FE_URL }) {
  const when = new Date(appointment.start_time);
  return buildEmailHtml(
    'Appointment Confirmed',
    '#3B82F6',
    `Dear ${fullName(patient)},`,
    'Your appointment has been confirmed. Here are the details:',
    [
      ['Date:', fmtDate(when)],
      ['Time:', fmtTime(when)],
      ['Provider:', `Dr. ${provider.first_name} ${provider.last_name}`],
      ['Appointment Type:', appointment.appointment_type],
      ['Duration:', `${appointment.duration_minutes} minutes`],
      ['Reason:', appointment.reason],
    ],
    (frontendUrl
      ? centered(emailButton(`${frontendUrl}/appointments/${appointment.id}`, 'View Appointment') +
          emailButton(`${frontendUrl}/api/scheduling/cancel/${appointment.id}`, 'Cancel Appointment', { secondary: true }))
      : '') +
      emailParagraph('If you need to cancel or reschedule, please do so at least 24 hours in advance.') +
      emailParagraph(`Thank you for choosing ${escapeHtml(product())}!`, { margin: '0' })
  );
}

function renderAppointmentReminderEmail({ appointment, patient, provider, frontendUrl = process.env.AC_FE_URL, now = new Date() }) {
  const when = new Date(appointment.start_time);
  const hoursUntil = Math.floor((when - now) / (1000 * 60 * 60));
  return buildEmailHtml(
    '⏰ Appointment Reminder',
    '#F59E0B',
    `Dear ${fullName(patient)},`,
    emailCallout(`<strong>You have an upcoming appointment in approximately ${hoursUntil} hours!</strong>`) +
      emailParagraph('Here are your appointment details:', { margin: '0' }),
    [
      ['Date:', fmtDate(when)],
      ['Time:', fmtTime(when)],
      ['Provider:', `Dr. ${provider.first_name} ${provider.last_name}`],
      ['Appointment Type:', appointment.appointment_type],
      ['Duration:', `${appointment.duration_minutes} minutes`],
    ],
    (frontendUrl ? centered(emailButton(`${frontendUrl}/appointments/${appointment.id}`, 'View Details')) : '') +
      emailParagraph('<strong>Please arrive 15 minutes early</strong> for check-in.') +
      emailParagraph('If you need to cancel or reschedule, please contact us as soon as possible.') +
      emailParagraph('We look forward to seeing you!', { margin: '0' }),
    { footerNote: 'This is an automated reminder. Please do not reply to this email.' }
  );
}

function renderAppointmentCancellationEmail({ appointment, patient, provider, frontendUrl = process.env.AC_FE_URL }) {
  const when = new Date(appointment.start_time);
  return buildEmailHtml(
    'Appointment Cancelled',
    '#EF4444',
    `Dear ${fullName(patient)},`,
    'This is to confirm that your appointment has been cancelled.',
    [
      ['Date:', fmtDate(when)],
      ['Time:', fmtTime(when)],
      ['Provider:', `Dr. ${provider.first_name} ${provider.last_name}`],
      ['Reason:', appointment.cancellation_reason],
    ],
    (frontendUrl ? centered(emailButton(`${frontendUrl}/book`, 'Book a New Appointment')) : '') +
      emailParagraph('If you would like to schedule a new appointment, please visit our website or contact us.') +
      emailParagraph('Thank you!', { margin: '0' })
  );
}

module.exports = {
  renderStaffInviteEmail,
  renderPortalInviteEmail,
  renderJoinRequestEmail,
  renderJoinDecisionEmail,
  renderPasswordResetEmail,
  renderAppointmentConfirmationEmail,
  renderAppointmentReminderEmail,
  renderAppointmentCancellationEmail,
};
