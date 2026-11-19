// Every email the backend sends uses the AureonCare layout.
//
// Renders each template with sample data — including hostile names, so escaping is
// exercised — and checks the brand is there, nothing executable got through, and the
// links, tokens and wording each email carried before the restyle are still present.
//
// No database and no SMTP: the event-driven notifications run through the real dispatch
// path against a fake pool, with nodemailer's transport replaced by a capture.

const path = require('path');

const BACKEND = path.join(__dirname, '..', '..');

// Environment BEFORE anything is required.
delete process.env.AC_CLN;                 // exercise the 'AureonCare' fallback
delete process.env.AC_RD_H;                // in-process send quota, no Redis
delete process.env.AC_RD_URL;
process.env.AC_SEND_MAX_EMAIL = '1000';    // many sends to one sample inbox
process.env.AC_SM_U = 'mailer@example.com';
process.env.AC_SM_W = 'test-app-password';
process.env.AC_ADMIN_EMAIL = 'admin@example.com';
process.env.FRONTEND_URL = 'https://app.example.com,https://other.example.com';
process.env.AC_FE_URL = 'https://app.example.com';

// Capture mail instead of sending it. notificationService looks createTransport up at send
// time, so patching the shared module object is enough.
const sent = [];
const nodemailer = require(require.resolve('nodemailer', { paths: [BACKEND] }));
nodemailer.createTransport = () => ({ sendMail: async (m) => { sent.push(m); return { messageId: 'test' }; } });

const notif = require(path.join(BACKEND, 'services/notificationService.js'));
const tpl = require(path.join(BACKEND, 'services/emailTemplates.js'));
const platformNotify = require(path.join(BACKEND, 'services/platformNotify.js'));
const { BRAND, TAGLINE, buildEmailHtml, emailButton } = notif;

const results = [];
const check = (n, c) => results.push([n, !!c]);

const HOSTILE = '<script>alert(1)</script>';
const PRACTICE = `O'Brien & Daughters ${HOSTILE}`;
const PRACTICE_ESC = 'O&#39;Brien &amp; Daughters &lt;script&gt;alert(1)&lt;/script&gt;';
const patient = { id: 'p1', first_name: `Ana ${HOSTILE}`, last_name: 'Lopez', email: 'ana@example.com', phone: null };
const provider = { id: 'd1', first_name: 'Grace', last_name: 'Hopper', email: 'grace@example.com', phone: null };

/** Checks every email must pass, plus the strings this particular email must still carry. */
function checkEmail(name, html, mustContain = [], opts = {}) {
  check(`${name}: is a full HTML document`, /^<!DOCTYPE html>/.test(html) && html.includes('</html>'));
  check(`${name}: gold "Aureon" wordmark`, html.includes(`<span style="color:${BRAND.gold}">Aureon</span>`));
  check(`${name}: teal "Care" wordmark`, html.includes(`<span style="color:${BRAND.teal}">Care</span>`));
  check(`${name}: tagline`, html.includes(TAGLINE));
  check(`${name}: dark slate header`, html.includes(`bgcolor="${BRAND.slate}"`));
  check(`${name}: logo image with alt text`,
    html.includes('src="https://app.example.com/assets/aureoncare-mark.png"') && /<img [^>]*alt="AureonCare logo"/.test(html));
  check(`${name}: 600px email-safe column`, html.includes('max-width:600px') && html.includes('role="presentation"'));
  check(`${name}: no external stylesheet or script`, !/<link\b/i.test(html) && !/<script/i.test(html));
  check(`${name}: footer safety text`, html.includes(opts.footerNote || 'This is an automated message. Please do not reply to this email.'));
  check(`${name}: footer product name`, /&copy; \d{4} AureonCare\. All rights reserved\./.test(html));
  if (opts.button) check(`${name}: brand teal button`, html.includes(`bgcolor="${BRAND.button}"`));
  if (opts.practice) {
    check(`${name}: "sent by <practice> via AureonCare"`,
      html.includes(`This message was sent by ${PRACTICE_ESC} via AureonCare.`));
  }
  for (const s of mustContain) check(`${name}: still contains ${JSON.stringify(s.slice(0, 70))}`, html.includes(s));
}

// ── Fake pool for the event-driven and platform notifications ──────────────────────────
const pool = {
  async query(sql) {
    if (/FROM patients/.test(sql)) return { rows: [patient] };
    if (/FROM providers/.test(sql)) return { rows: [provider] };
    if (/FROM control\.operators\s+WHERE status/.test(sql)) return { rows: [{ id: 'op1', email: 'ops@example.com', name: 'Ops' }] };
    if (/FROM control\.tenants/.test(sql)) return { rows: [{ name: PRACTICE, slug: 'obrien' }] };
    if (/FROM control\.operators WHERE id/.test(sql)) return { rows: [{ email: 'actor@example.com' }] };
    return { rows: [] };
  },
};
const lastTo = (to) => [...sent].reverse().find((m) => m.to === to);

(async () => {
  // ── buildEmailHtml: backward-compatible signature ────────────────────────────────────
  {
    const legacy = buildEmailHtml('Legacy Title', '#EF4444', 'Hello,', 'Intro text.',
      '<tr><td>Raw label</td><td>Raw value</td></tr>', '<em>extra</em>');
    checkEmail('legacy buildEmailHtml call', legacy, ['Legacy Title', 'Hello,', 'Intro text.', 'Raw value', '<em>extra</em>']);
    check('legacy: caller colour is mapped to a brand tone (red -> danger)', legacy.includes(`border-left:4px solid ${BRAND.danger}`));
    check('legacy: caller colour no longer paints the header', !legacy.includes('background:#EF4444'));
    const blue = buildEmailHtml('T', '#8B5CF6', null, null, null, null);
    check('violet caller colour -> brand teal accent', blue.includes(`border-left:4px solid ${BRAND.teal}`));
    const teal = buildEmailHtml('T', '#08B39C', null, null, null, null);
    check('brand teal caller colour -> brand teal accent', teal.includes(`border-left:4px solid ${BRAND.teal}`));
    const amber = buildEmailHtml('T', '#F59E0B', null, null, null, null);
    check('amber caller colour keeps its warning tone', amber.includes(`border-left:4px solid ${BRAND.warning}`));
    const green = buildEmailHtml('T', '#10B981', null, null, null, null);
    check('green caller colour -> brand teal accent', green.includes(`border-left:4px solid ${BRAND.teal}`));
    const arr = buildEmailHtml('T', '#2563eb', null, null, [['Tenant', `Acme ${HOSTILE}`], ['When', 'now']], null);
    check('array rows render as table rows', />Tenant<\/td>/.test(arr) && />now<\/td>/.test(arr) && !arr.includes('Tenant,'));
    check('array row values are escaped', !/<script/i.test(arr) && arr.includes('Acme &lt;script&gt;'));
    const btn = emailButton('https://x.example.com/a?b=1&c="2"', 'Go');
    check('button href is attribute-escaped', btn.includes('href="https://x.example.com/a?b=1&amp;c=&quot;2&quot;"'));

    const saved = process.env.FRONTEND_URL;
    delete process.env.FRONTEND_URL;
    const noLogo = buildEmailHtml('T', '#2563eb', null, null, null, null);
    check('no FRONTEND_URL: no logo image, text wordmark still there',
      !/<img/i.test(noLogo) && noLogo.includes(`<span style="color:${BRAND.gold}">Aureon</span>`));
    process.env.FRONTEND_URL = 'javascript:alert(1)';
    check('non-http FRONTEND_URL is never used as an image source', !/<img/i.test(buildEmailHtml('T', '', null, null, null, null)));
    process.env.FRONTEND_URL = saved;
  }

  // ── Route emails ─────────────────────────────────────────────────────────────────────
  const inviteUrl = 'https://app.example.com/accept-invite?token=inv_tok_9f8e7d';
  checkEmail('staff invite', tpl.renderStaffInviteEmail({
    practiceName: PRACTICE, inviterName: `Dr ${HOSTILE}`, role: 'nurse', inviteUrl,
    expiresAt: '2026-12-01T10:00:00Z',
  }), [
    `href="${inviteUrl}"`, `>${inviteUrl}</a>`, 'Accept the invitation',
    `You have been invited to ${PRACTICE_ESC}`, `join <strong>${PRACTICE_ESC}</strong> on AureonCare`,
    'Use the button below to set up your account — you can finish with a password or with your Google or Microsoft account.',
    'If the button does not work, paste this into your browser:',
    'If you were not expecting this, ignore this email — the invitation expires on its own and no account is created until it is used.',
    '>Your role<', '>nurse<', 'Tue, 01 Dec 2026 10:00:00 GMT',
  ], { button: true, practice: true });

  const portalUrl = 'https://app.example.com/portal/invite?token=ptl_tok_123abc';
  checkEmail('portal invite', tpl.renderPortalInviteEmail({
    firstName: `Ana ${HOSTILE}`, practice: PRACTICE, url: portalUrl, expiresAt: '2026-12-01T10:00:00Z',
  }), [
    `href="${portalUrl}"`, `>${portalUrl}</a>`, 'Set up my portal',
    `Your ${PRACTICE_ESC} patient portal`, 'Hello Ana &lt;script&gt;',
    'has invited you to its patient portal, where you can see your appointments, messages and records.',
    'If you were not expecting this, you can ignore it — the link works once and expires on its own.',
  ], { button: true, practice: true });

  checkEmail('join request', tpl.renderJoinRequestEmail({
    claim: { domain: 'obrien.example', practice_name: PRACTICE },
    user: { email: 'new@obrien.example', first_name: `Sam ${HOSTILE}`, last_name: 'Lee', role: 'staff' },
  }), [
    'Someone has asked to join your practice', '<strong>new@obrien.example</strong> signed up using your verified domain',
    '<strong>obrien.example</strong>', 'Review it under Settings → Team access.', '>Requested role<',
  ], { practice: true });

  checkEmail('join approved', tpl.renderJoinDecisionEmail({ approved: true }),
    ['You can now sign in', 'An administrator approved your request. You can sign in with the password you chose.']);
  checkEmail('join rejected', tpl.renderJoinDecisionEmail({ approved: false }),
    ['Your request was not approved', 'If you think this is a mistake, contact them directly.']);

  const resetToken = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';
  const resetLink = `https://app.example.com/reset-password?token=${resetToken}`;
  checkEmail('password reset (with link)', tpl.renderPasswordResetEmail({ firstName: `Ana ${HOSTILE}`, resetToken, resetLink }), [
    resetToken, `href="${resetLink}"`, `>${resetLink}</a>`, 'Or click here to reset your password:', 'Reset code',
    'We received a request to reset your AureonCare password. Use the reset code below — it expires in 1 hour.',
  ]);
  checkEmail('password reset (no link)', tpl.renderPasswordResetEmail({ firstName: 'there', resetToken, resetLink: null }),
    [resetToken, 'Enter this code in the password reset screen to choose a new password.']);

  // ── Appointment emails (reminderService) ─────────────────────────────────────────────
  const appt = {
    id: 'appt-42', start_time: '2026-12-03T15:30:00Z', appointment_type: 'Follow-up',
    duration_minutes: 30, reason: `Knee ${HOSTILE}`, cancellation_reason: 'Provider unavailable',
  };
  checkEmail('appointment confirmation', tpl.renderAppointmentConfirmationEmail({ appointment: appt, patient, provider }), [
    'Appointment Confirmed', 'Your appointment has been confirmed. Here are the details:',
    'href="https://app.example.com/appointments/appt-42"', 'href="https://app.example.com/api/scheduling/cancel/appt-42"',
    'View Appointment', 'Cancel Appointment', 'Dr. Grace Hopper', '30 minutes',
    'If you need to cancel or reschedule, please do so at least 24 hours in advance.', 'Thank you for choosing AureonCare!',
  ], { button: true });
  checkEmail('appointment reminder', tpl.renderAppointmentReminderEmail({
    appointment: appt, patient, provider, now: new Date('2026-12-02T15:30:00Z'),
  }), [
    '⏰ Appointment Reminder', 'You have an upcoming appointment in approximately 24 hours!',
    'Here are your appointment details:', 'href="https://app.example.com/appointments/appt-42"', 'View Details',
    '<strong>Please arrive 15 minutes early</strong> for check-in.', 'We look forward to seeing you!',
  ], { button: true, footerNote: 'This is an automated reminder. Please do not reply to this email.' });
  checkEmail('appointment cancellation', tpl.renderAppointmentCancellationEmail({ appointment: appt, patient, provider }), [
    'This is to confirm that your appointment has been cancelled.', 'href="https://app.example.com/book"',
    'Book a New Appointment', 'Provider unavailable',
    'If you would like to schedule a new appointment, please visit our website or contact us.', 'Thank you!',
  ], { button: true });

  // ── Event-driven notifications (real dispatch, fake pool) ────────────────────────────
  const events = [
    ['appointment.created', { appointment: { ...appt, patient_id: 'p1', provider_id: 'd1' } }, ['Appointment Scheduled', 'Your appointment has been confirmed.', 'Knee &lt;script&gt;']],
    ['appointment.updated', { appointment: { ...appt, status: 'rescheduled', patient_id: 'p1', provider_id: 'd1' } }, ['Appointment Updated', 'rescheduled']],
    ['appointment.cancelled', { appointment: { ...appt, patient_id: 'p1', provider_id: 'd1' } }, ['Appointment Cancelled', 'An appointment has been cancelled.']],
    ['appointment.status_changed', { appointment: { ...appt, status: 'checked_in', patient_id: 'p1', provider_id: 'd1' }, old_status: HOSTILE },
      ['Appointment Status Changed', '<strong>&lt;script&gt;alert(1)&lt;/script&gt;</strong> to <strong>checked_in</strong>']],
    ['prescription.created', { prescription: { medication_name: 'Amoxicillin', dosage: '500mg', refills: 0 }, patient_id: 'p1', provider_id: 'd1' },
      ['New Prescription', 'Dr. Grace Hopper has prescribed a new medication for you.', 'Amoxicillin', '>0<']],
    ['lab_order.created', { order: { test_name: 'CBC', lab_name: 'Central Lab' }, patient_id: 'p1', provider_id: 'd1' }, ['Lab Order Created', 'CBC', 'Central Lab']],
    ['lab_order.status_changed', { order: { test_name: 'CBC', status: 'resulted' }, old_status: 'pending', patient_id: 'p1', provider_id: 'd1' }, ['Lab Order Updated', 'resulted']],
    ['claim.created', { claim: { claim_number: 'CLM-0001', payer: 'Acme Health', amount: 120, status: 'submitted' }, patient_id: 'p1' }, ['Insurance Claim Submitted', 'CLM-0001', '$120']],
    ['claim.status_changed', { claim: { claim_number: 'CLM-0001', status: 'paid' }, old_status: 'submitted', patient_id: 'p1' }, ['Claim Status Updated', '<strong>submitted</strong> to <strong>paid</strong>']],
    ['payment.received', { payment: { payment_number: 'PAY-77', amount: 45, payment_method: 'card' }, patient_id: 'p1' }, ['Payment Received', 'PAY-77', '$45']],
    ['task.created', { task: { title: `Call back ${HOSTILE}`, priority: 'high' } }, ['New Task Created', 'Dear Admin,', 'Call back &lt;script&gt;']],
    ['task.completed', { task: { title: 'Call back', priority: 'high', status: 'done' } }, ['Task Completed', 'A task has been marked as completed.']],
    ['telehealth.session_created', { session: { start_time: appt.start_time, duration_minutes: 20, meeting_url: 'https://meet.example.com/r/abc?pwd=1' }, patient_id: 'p1', provider_id: 'd1' },
      ['Telehealth Session Scheduled', '<strong>Join Link:</strong>', 'href="https://meet.example.com/r/abc?pwd=1"', '>https://meet.example.com/r/abc?pwd=1</a>']],
  ];
  for (const [event, data, must] of events) {
    const before = sent.length;
    await notif.dispatch(pool, event, data);
    const mails = sent.slice(before);
    check(`${event}: sent at least one email`, mails.length > 0);
    const toPatient = mails.find((m) => m.to === 'ana@example.com') || mails[0];
    if (toPatient) checkEmail(`${event} email`, toPatient.html, must);
    if (toPatient && toPatient.to === 'ana@example.com') {
      check(`${event}: patient's name escaped in greeting`, toPatient.html.includes('Dear Ana &lt;script&gt;'));
    }
  }

  // ── Platform operator alert (platformNotify) ─────────────────────────────────────────
  await platformNotify.notify(pool, {
    action: 'break_glass.start', actorId: 'actor-1', tenantId: 't1', detail: { reason: `Ticket ${HOSTILE}` }, ip: '203.0.113.9',
  });
  const plat = lastTo('ops@example.com');
  check('platform alert: sent', !!plat);
  if (plat) {
    checkEmail('platform alert', plat.html, [
      'Break-glass access opened over tenant data', 'Platform operator',
      'This is a security-relevant change to the AureonCare platform. If you were not expecting it, investigate now.',
      '>Tenant<', PRACTICE_ESC, 'actor@example.com', '203.0.113.9', 'Ticket &lt;script&gt;',
    ]);
    check('platform alert: critical severity keeps a red accent', plat.html.includes(`border-left:4px solid ${BRAND.danger}`));
  }

  // ── Summary ──────────────────────────────────────────────────────────────────────────
  const failed = results.filter(([, ok]) => !ok);
  for (const [n, ok] of results) if (!ok || process.env.VERBOSE) console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}`);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
