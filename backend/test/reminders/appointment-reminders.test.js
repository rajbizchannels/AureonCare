// Appointment reminders (services/appointmentReminders.js, GET /api/internal/cron/reminders).
//
// Proves each recipient gets ONLY what they chose: patients on their portal channels (email unless
// switched off, WhatsApp only if switched on); providers per "A reminder before each of my
// appointments"; staff per "Tomorrow's appointments". Appointments outside the window, cancelled
// ones and providers who turned patient reminders off send nothing; read-only practices are
// skipped; running twice sends nothing twice; the cron endpoint needs CRON_SECRET.

const path = require('path');
const crypto = require('crypto');

const BACKEND = path.join(__dirname, '..', '..');
process.env.PORT = process.env.TEST_PORT || '4886';
process.env.NODE_ENV = 'development';
process.env.AC_JWT_S = process.env.AC_JWT_S || crypto.randomBytes(48).toString('base64');
process.env.AC_TK_S = process.env.AC_TK_S || process.env.AC_JWT_S;
process.env.AC_PW_BREACH_CHECK = 'false';
delete process.env.CRON_SECRET;
const BASE = `http://127.0.0.1:${process.env.PORT}`;

const outbox = []; const whatsapps = [];
const notify = require(path.join(BACKEND, 'services/notificationService.js'));
notify.sendEmail = async (to, subject, html) => { outbox.push({ to, subject, html }); return { sent: true }; };
notify.sendWhatsAppTo = async (phone, text, tpl) => { whatsapps.push({ phone, text, tpl }); return { sent: true }; };

const pool = require(path.join(BACKEND, 'db.js'));
const bcrypt = require(path.join(BACKEND, '..', 'node_modules', 'bcryptjs'));
const { provisionTenant } = require(path.join(BACKEND, 'services/tenantProvisioning.js'));
const { runReminders } = require(path.join(BACKEND, 'services/appointmentReminders.js'));
require(path.join(BACKEND, 'server.js'));

const results = [];
const check = (n, c) => results.push([n, !!c]);
const report = (err) => {
  let failed = 0;
  for (const [n, c] of results) { console.log(`  ${c ? 'ok  ' : 'FAIL'} ${n}`); if (!c) failed += 1; }
  if (err) { console.error(`\nSTOPPED: ${err.message || err}`); console.error(err); }
  else console.log(`\n${results.length - failed}/${results.length} checks passed.`);
  process.exit(err || failed ? 1 : 0);
};

(async () => {
  for (let i = 0; i < 40; i++) { try { await fetch(BASE + '/health'); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  const RUN = crypto.randomBytes(3).toString('hex');
  const A = await provisionTenant(pool, { name: `Remind A ${RUN}`, timezone: 'UTC' });
  const B = await provisionTenant(pool, { name: `Remind B ${RUN}`, timezone: 'UTC' });
  const schema = async (t) => (await pool.query('SELECT schema_name FROM control.tenants WHERE practice_id = $1', [t.practiceId])).rows[0].schema_name;
  const SA = await schema(A); const SB = await schema(B);
  const hash = await bcrypt.hash('A-Strong-Passphrase!23', 4);
  const mk = async (t, role, first) => {
    const email = `${role}.${first}.${RUN}@aureon-qa.net`;
    const { rows: [u] } = await pool.query(`INSERT INTO public.users (id,email,first_name,last_name,role,status,password_hash,practice_id,phone,created_at)
      VALUES (gen_random_uuid(),$1,$2,'Test',$3,'active',$4,$5,'+34600000000',NOW()) RETURNING id`, [email, first, role, hash, t.practiceId]);
    if (['doctor', 'provider'].includes(role)) await pool.query('INSERT INTO public.providers (id, first_name, last_name, email) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING', [u.id, first, 'Test', email]);
    return { id: u.id, email };
  };
  const doc = await mk(A, 'doctor', 'dora');
  const doc2 = await mk(A, 'doctor', 'dan');           // turned patient reminders off
  const desk = await mk(A, 'receptionist', 'rita');     // digest: default (in the app)
  const nurse = await mk(A, 'nurse', 'nia');            // digest: switched off
  const admin = await mk(A, 'admin', 'ada');            // digest: switched on by email too
  const docB = await mk(B, 'doctor', 'bob');
  await pool.query(`INSERT INTO ${SA}.staff_notification_preferences (user_id, event_key, channel, enabled) VALUES
    ($1,'schedule.daily_digest','in_app',false), ($2,'schedule.daily_digest','email',true), ($3,'appointment.reminder','email',true)`, [nurse.id, admin.id, doc2.id]);
  await pool.query(`INSERT INTO ${SA}.provider_booking_config (provider_id, send_reminder_email, reminder_hours_before) VALUES ($1, false, 24)`, [doc2.id]).catch(() => {});

  const patient = async (S, mrn, email, extra = {}) => (await pool.query(
    `INSERT INTO ${S}.patients (id, mrn, first_name, last_name, date_of_birth, email, phone, status) VALUES (gen_random_uuid(), $1, $2, 'Patient', '1980-01-01', $3, '+34611111111', 'active') RETURNING id`,
    [mrn, extra.first || mrn, email])).rows[0].id;
  const pEmail = await patient(SA, `E-${RUN}`, `pe.${RUN}@aureon-qa.net`);
  const pWa = await patient(SA, `W-${RUN}`, `pw.${RUN}@aureon-qa.net`);
  const pNone = await patient(SA, `N-${RUN}`, null);
  const pOff = await patient(SA, `O-${RUN}`, `po.${RUN}@aureon-qa.net`);
  await pool.query(`INSERT INTO ${SA}.notification_preferences (patient_id, channel_type, is_enabled, contact_info) VALUES
    ($1,'email',false,NULL), ($1,'whatsapp',true,'+34622222222'), ($2,'email',false,NULL)`, [pWa, pOff]);
  const pB = await patient(SB, `B-${RUN}`, `pb.${RUN}@aureon-qa.net`);

  const appt = async (S, patientId, providerId, hours, status = 'scheduled', extra = '') => (await pool.query(
    `INSERT INTO ${S}.appointments (patient_id, provider_id, start_time, end_time, duration_minutes, status, appointment_type, timezone${extra ? ', cancelled_at' : ''})
     VALUES ($1, $2, (now() + make_interval(hours => $3)) AT TIME ZONE 'UTC', (now() + make_interval(hours => $3) + interval '30 minutes') AT TIME ZONE 'UTC', 30, $4, 'Follow-up', 'UTC'${extra ? ', now()' : ''}) RETURNING id`,
    [patientId, providerId, hours, status])).rows[0].id;
  const aEmail = await appt(SA, pEmail, doc.id, 3);
  const aWa = await appt(SA, pWa, doc.id, 10);
  await appt(SA, pNone, doc.id, 5);
  await appt(SA, pEmail, doc.id, 72);                       // not due yet
  await appt(SA, pEmail, doc.id, 2, 'cancelled', 'x');      // cancelled
  const aOffProv = await appt(SA, pOff, doc2.id, 4);        // patient said no email; doc2 says no patient reminders
  // Tomorrow in UTC, for the daily summary.
  const tomorrowHours = Math.ceil((Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() + 1, 11) - Date.now()) / 3600000);
  await appt(SA, pNone, doc2.id, tomorrowHours);
  await appt(SB, pB, docB.id, 3);
  await pool.query("UPDATE control.subscriptions SET status = 'canceled' WHERE practice_id = $1", [B.practiceId]);
  require(path.join(BACKEND, 'services/entitlements.js')).invalidateEntitlements();

  const out = await runReminders(pool, { practiceId: A.practiceId });
  check(`the job ran for the practice (${JSON.stringify(out)})`, out.practices === 1 && out.failed === 0);

  // Patients
  check('patient with email on: reminder by email', outbox.some((m) => m.to === `pe.${RUN}@aureon-qa.net` && /Reminder: your appointment/.test(m.subject)));
  check('...only one, for the appointment that is due', outbox.filter((m) => m.to === `pe.${RUN}@aureon-qa.net`).length === 1);
  check('patient who switched email off and WhatsApp on: WhatsApp only',
    !outbox.some((m) => m.to === `pw.${RUN}@aureon-qa.net`) && whatsapps.some((w) => w.phone === '+34622222222' && w.tpl.key === 'appointment_reminder'));
  check('patient who switched email off gets no email', !outbox.some((m) => m.to === `po.${RUN}@aureon-qa.net`));
  check("a provider who turned patient reminders off: their patient gets none",
    (await pool.query(`SELECT count(*)::int AS n FROM ${SA}.reminder_deliveries WHERE appointment_id = $1 AND kind = 'patient'`, [aOffProv])).rows[0].n === 0);

  // Providers
  const docInApp = (await pool.query(`SELECT message FROM ${SA}.notifications WHERE user_id = $1 AND type = 'appointment.reminder'`, [doc.id])).rows;
  check('provider: in the app by default, one per due appointment', docInApp.length === 3);
  check('...and not by email (not chosen)', !outbox.some((m) => m.to === doc.email));
  check('a provider who chose email gets it, with the patient shortened', outbox.some((m) => m.to === doc2.email && /Reminder: appointment/.test(m.subject) && /O-.*\b[A-Z]\./.test(m.html)));

  // Staff summary
  const digestTo = async (u) => (await pool.query(`SELECT count(*)::int AS n FROM ${SA}.notifications WHERE user_id = $1 AND type = 'schedule.daily_digest'`, [u.id])).rows[0].n;
  check('front desk: tomorrow\'s summary in the app (default)', (await digestTo(desk)) === 1);
  check('nurse who switched it off: nothing', (await digestTo(nurse)) === 0);
  const adminMail = outbox.find((m) => m.to === admin.email && /^Tomorrow:/.test(m.subject));
  check('admin who chose email: the summary by email, without patient names', adminMail && !/N-|Patient/.test(adminMail.html));
  check('providers do not get the staff summary', (await digestTo(doc)) === 0);

  // Exactly once
  const before = { mails: outbox.length, wa: whatsapps.length };
  const again = await runReminders(pool, { practiceId: A.practiceId });
  check(`running again sends nothing new (${JSON.stringify(again.sent)})`, again.sent.patient === 0 && again.sent.provider === 0 && again.sent.digest === 0
    && outbox.length === before.mails && whatsapps.length === before.wa);
  check('every reminder is logged once', (await pool.query(`SELECT count(*)::int AS n FROM ${SA}.reminder_deliveries WHERE appointment_id = $1`, [aEmail])).rows[0].n === 2);
  check('...WhatsApp reminder logged', (await pool.query(`SELECT count(*)::int AS n FROM ${SA}.reminder_deliveries WHERE appointment_id = $1 AND channel = 'whatsapp'`, [aWa])).rows[0].n === 1);

  // Read-only practice
  const outB = await runReminders(pool, { practiceId: B.practiceId });
  check('a read-only practice (subscription ended) is skipped', outB.skipped === 1 && !outbox.some((m) => m.to === `pb.${RUN}@aureon-qa.net`));

  // Cron endpoint
  check('without CRON_SECRET the job refuses to run', (await fetch(`${BASE}/api/internal/cron/reminders`)).status === 503);
  process.env.CRON_SECRET = `cron-${RUN}-0123456789abcdef`;
  check('a wrong secret is refused', (await fetch(`${BASE}/api/internal/cron/reminders`, { headers: { Authorization: 'Bearer nope' } })).status === 401);
  const ok = await fetch(`${BASE}/api/internal/cron/reminders`, { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } });
  const okBody = await ok.json();
  check(`the right secret runs it (got ${ok.status})`, ok.status === 200 && okBody.ok === true);

  // My notifications lists the new choices for the right roles
  const login = async (email) => (await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'A-Strong-Passphrase!23' }) })).json()).token;
  const settings = async (email) => (await (await fetch(`${BASE}/api/notification-settings`, { headers: { Authorization: `Bearer ${await login(email)}` } })).json()).events.map((e) => e.key);
  const docKeys = await settings(doc.email); const deskKeys = await settings(desk.email);
  check('My notifications: providers can choose appointment reminders', docKeys.includes('appointment.reminder') && !docKeys.includes('schedule.daily_digest'));
  check("My notifications: front desk can choose tomorrow's summary", deskKeys.includes('schedule.daily_digest') && !deskKeys.includes('appointment.reminder'));

  report();
})().catch(report);
