// WhatsApp message templates (the 24-hour rule).
//
// Outside the 24-hour window WhatsApp delivers only APPROVED templates. Proves: the
// catalogue follows Meta's rules; templates are used only once configured; the exact
// Meta and Twilio requests (names, language, {{n}} values, the QR header); a message whose
// template is missing or fails still goes out as free-form text; a 24-hour refusal is
// recognised; and real notifications (appointment, telehealth, staff notices) pick the
// right template and values. No network, no database: axios is a recorder.

const path = require('path');
process.env.FRONTEND_URL = 'https://app.aureoncare.tech';
delete process.env.AC_SHORT_BASE;
const clearWa = () => { for (const k of Object.keys(process.env)) if (k.startsWith('AC_WA_')) delete process.env[k]; };
clearWa();

const BACKEND = path.join(__dirname, '..', '..');
const axios = require(require.resolve('axios', { paths: [BACKEND] }));
const calls = [];
let reject = null;   // (payload) => error object to throw, or null
axios.post = async (url, body) => {
  const payload = body instanceof URLSearchParams ? Object.fromEntries(body) : body;
  calls.push({ url, payload });
  const err = reject && reject(payload);
  if (err) { const e = new Error('provider error'); e.response = { data: err }; throw e; }
  return { data: url.includes('twilio') ? { sid: 'SM1', status: 'queued' } : { messages: [{ id: 'wamid.1' }] } };
};
const T = require(path.join(BACKEND, 'services/whatsappTemplates.js'));
const WhatsAppService = require(path.join(BACKEND, 'services/whatsappService.js'));

const results = [];
const check = (n, c) => results.push([n, !!c]);
const last = () => calls[calls.length - 1];
const SHORT = 'https://app.aureoncare.tech/s/Oz0f0J57lncw';
const metaEnv = { AC_WA_PROVIDER: 'whatsapp_business', AC_WA_META_TOKEN: 'EAAG', AC_WA_META_PHONE_ID: '42' };
const twilioEnv = { AC_WA_PROVIDER: 'twilio', AC_WA_TWILIO_SID: 'AC1', AC_WA_TWILIO_TOKEN: 't', AC_WA_TWILIO_FROM: '+15550001' };
const sid = (n) => `HX${String(n).padStart(32, '0')}`;

(async () => {
  // ── 1. the catalogue follows Meta's template rules ──────────────────────────────────
  for (const key of T.KEYS) {
    const t = T.CATALOGUE[key];
    const nums = (t.body.match(/\{\{(\d+)\}\}/g) || []).map((m) => Number(m.slice(2, -2)));
    check(`${key}: variables are {{1}}..{{${nums.length}}} in order`, nums.every((n, i) => n === i + 1));
    check(`${key}: does not start or end with a variable`, !/^\s*\{\{/.test(t.body) && !/\}\}\s*$/.test(t.body));
    check(`${key}: one example per variable`, t.examples.length === nums.length);
    check(`${key}: a valid template name`, /^[a-z0-9_]{1,512}$/.test(`aureoncare_${key}`));
  }
  check('values are made single-line and never empty', T.cleanVar('a\n\nb   c\t') === 'a b c' && T.cleanVar('') === '—' && T.cleanVar(null) === '—');

  // ── 2. configuration ─────────────────────────────────────────────────────────────────
  Object.assign(process.env, metaEnv);
  check('templates are OFF until configured (free-form as before)', T.templateConfig() === null);
  process.env.AC_WA_TEMPLATES = 'appointment_scheduled, nonsense';
  const c1 = T.templateConfig();
  check('Meta: only the listed (approved) templates are used; unknown keys ignored',
    c1 && T.isReady(c1, 'appointment_scheduled') && !T.isReady(c1, 'appointment_reminder'));
  process.env.AC_WA_TEMPLATES = 'all';
  check('Meta: AC_WA_TEMPLATES=all uses every template', T.KEYS.every((k) => T.isReady(T.templateConfig(), k)));
  clearWa(); Object.assign(process.env, twilioEnv, { AC_WA_TWILIO_CONTENT_SIDS: '{bad json' });
  check('Twilio: malformed AC_WA_TWILIO_CONTENT_SIDS turns templates off', T.templateConfig() === null);
  process.env.AC_WA_TWILIO_CONTENT_SIDS = JSON.stringify({ appointment_scheduled: sid(1), telehealth_session: sid(2), x: 'HXnope' });
  const c2 = T.templateConfig();
  check('Twilio: keys with a valid Content SID are used', T.isReady(c2, 'appointment_scheduled') && T.isReady(c2, 'telehealth_session') && !T.isReady(c2, 'general_update'));

  // ── 3. Meta requests ─────────────────────────────────────────────────────────────────
  clearWa(); Object.assign(process.env, metaEnv, { AC_WA_TEMPLATES: 'all' });
  const meta = new WhatsAppService(WhatsAppService.envConfig());
  await meta.notify('15550002', 'free text', { key: 'appointment_scheduled', vars: ['Ana', 'Dr. Lee', 'Monday,\n7 Dec', '10:30 AM'] });
  let p = last().payload;
  check('Meta: sent as a TEMPLATE with the prefixed name and language', p.type === 'template' && p.template.name === 'aureoncare_appointment_scheduled' && p.template.language.code === 'en');
  check('...with the values as body parameters, cleaned to one line',
    JSON.stringify(p.template.components) === JSON.stringify([{ type: 'body', parameters: ['Ana', 'Dr. Lee', 'Monday, 7 Dec', '10:30 AM'].map((text) => ({ type: 'text', text })) }]));
  await meta.notify('15550002', 'free text', { key: 'telehealth_session', vars: ['Ana', 'Dr. Lee', 'Mon', '10:30 AM', SHORT] });
  p = last().payload;
  check('Meta: the telehealth template carries the QR code as its header image',
    p.template.components[0].type === 'header' && p.template.components[0].parameters[0].image.link === `${SHORT}/qr.png`
    && p.template.components[1].parameters[4].text === SHORT);
  const nShort = calls.length;
  await meta.notify('15550002', 'Join: https://zoom.example/j/1', { key: 'telehealth_session', vars: ['Ana', 'Dr. Lee', 'Mon', '10:30', 'https://zoom.example/j/1'] });
  check('...without a short link (no QR possible) it falls back to free-form text', calls.length === nShort + 1 && last().payload.type === 'text');
  process.env.AC_WA_TEMPLATE_PREFIX = 'clinic_'; process.env.AC_WA_TEMPLATE_LANG = 'en_GB';
  await meta.notify('15550002', 'x', { key: 'general_update', vars: ['Sam', 'claim paid'] });
  check('prefix and language are configurable', last().payload.template.name === 'clinic_general_update' && last().payload.template.language.code === 'en_GB');
  delete process.env.AC_WA_TEMPLATE_PREFIX; delete process.env.AC_WA_TEMPLATE_LANG;

  // ── 4. Twilio requests ───────────────────────────────────────────────────────────────
  clearWa(); Object.assign(process.env, twilioEnv, { AC_WA_TWILIO_CONTENT_SIDS: JSON.stringify({ appointment_scheduled: sid(1), telehealth_session: sid(2) }) });
  const tw = new WhatsAppService(WhatsAppService.envConfig());
  await tw.notify('+15550002', 'free text', { key: 'appointment_scheduled', vars: ['Ana', 'Dr. Lee', 'Mon', '10:30 AM'] });
  p = last().payload;
  check('Twilio: sent with ContentSid + ContentVariables, no Body', p.ContentSid === sid(1) && !('Body' in p)
    && JSON.stringify(JSON.parse(p.ContentVariables)) === JSON.stringify({ 1: 'Ana', 2: 'Dr. Lee', 3: 'Mon', 4: '10:30 AM' }));
  await tw.notify('+15550002', 'free text', { key: 'telehealth_session', vars: ['Ana', 'Dr. Lee', 'Mon', '10:30 AM', SHORT] });
  check('Twilio: telehealth passes the short code for the QR image as variable 6', JSON.parse(last().payload.ContentVariables)['6'] === 'Oz0f0J57lncw');
  await tw.notify('+15550002', 'Your appointment is confirmed.', { key: 'appointment_reminder', vars: ['Ana'] });
  check('a template that is not set up → free-form text, as before', last().payload.Body === 'Your appointment is confirmed.' && !last().payload.ContentSid);

  // ── 5. failures ──────────────────────────────────────────────────────────────────────
  reject = (pl) => (pl.ContentSid ? { code: 63016, message: 'template rejected' } : null);
  const before = calls.length;
  await tw.notify('+15550002', 'fallback text', { key: 'appointment_scheduled', vars: ['Ana', 'Dr. Lee', 'Mon', '10:30'] });
  check('a failing template falls back to free-form text', calls.length === before + 2 && calls[before + 1].payload.Body === 'fallback text');
  reject = () => ({ error: { code: 131047, message: 'Re-engagement message' } });
  clearWa(); Object.assign(process.env, metaEnv);
  let caught = null;
  try { await meta.notify('15550002', 'x', null); } catch (e) { caught = e; }
  check('a 24-hour refusal is recognised (Meta 131047)', caught && WhatsAppService.isOutsideWindow(caught));
  check('...and Twilio 63016', WhatsAppService.isOutsideWindow({ providerCode: 63016 }) && !WhatsAppService.isOutsideWindow({ providerCode: 1 }));
  reject = null;

  // ── 6. real notifications pick the right template ────────────────────────────────────
  clearWa(); Object.assign(process.env, metaEnv, { AC_WA_TEMPLATES: 'all' });
  process.env.AC_ADMIN_EMAIL = 'admin@example.com';
  const notif = require(path.join(BACKEND, 'services/notificationService.js'));
  notif.sendEmail = async () => ({ sent: true });
  const patient = { id: 'p1', first_name: 'Ana', last_name: 'Ruiz', email: 'ana@example.com', phone: '+15550100' };
  const provider = { id: 'd1', first_name: 'Maya', last_name: 'Lee', email: 'lee@example.com', phone: '+15550200' };
  const pool = { async query(sql) {
    if (/notification_preferences/.test(sql)) return { rows: [{ is_enabled: true, contact_info: '+15550100' }] };
    if (/FROM patients/.test(sql)) return { rows: [patient] };
    if (/FROM providers/.test(sql)) return { rows: [provider] };
    return { rows: [] };
  } };
  const sentTo = (phone, from) => calls.slice(from).filter((c) => c.payload && c.payload.to === phone).map((c) => c.payload);
  const appt = { id: 'a1', start_time: '2026-12-07T10:30:00Z', patient_id: 'p1', provider_id: 'd1' };
  let mark = calls.length;
  await notif.dispatch(pool, 'appointment.created', { appointment: appt });
  const toPatient = sentTo('+15550100', mark)[0];
  const toDoctor = sentTo('+15550200', mark)[0];
  check('appointment.created → the patient gets appointment_scheduled with the doctor\'s name',
    toPatient && toPatient.template.name === 'aureoncare_appointment_scheduled'
    && toPatient.template.components[0].parameters[0].text === 'Ana' && toPatient.template.components[0].parameters[1].text === 'Dr. Maya Lee');
  check('...the doctor gets it with the PATIENT\'s name', toDoctor && toDoctor.template.components[0].parameters[1].text === 'Ana Ruiz');
  mark = calls.length;
  await notif.dispatch(pool, 'appointment.status_changed', { appointment: { ...appt, status: 'checked_in' }, old_status: 'scheduled' });
  const st = sentTo('+15550100', mark)[0];
  check('status change → appointment_status with the new status', st && st.template.name === 'aureoncare_appointment_status'
    && st.template.components[0].parameters[3].text === 'checked_in');
  mark = calls.length;
  await notif.dispatch(pool, 'telehealth.session_created', { session: { start_time: appt.start_time, meeting_url: 'https://zoom.example/j/9' }, patient_id: 'p1', provider_id: 'd1' });
  const th = sentTo('+15550100', mark)[0];
  check('telehealth → telehealth_session with the SHORT join link and its QR header',
    th && th.template.name === 'aureoncare_telehealth_session'
    && /^https:\/\/app\.aureoncare\.tech\/s\/[A-Za-z0-9]{12}$/.test(th.template.components[1].parameters[4].text)
    && th.template.components[0].parameters[0].image.link.endsWith('/qr.png'));
  mark = calls.length;
  await notif.dispatch(pool, 'claim.status_changed', { claim: { claim_number: 'CLM-1', status: 'paid' }, old_status: 'submitted', patient_id: 'p1' });
  const cl = sentTo('+15550100', mark)[0];
  check('claim update → general_update with a one-line summary', cl && cl.template.name === 'aureoncare_general_update'
    && cl.template.components[0].parameters[1].text === 'claim CLM-1 is now paid');
})().then(() => {
  let failed = 0;
  for (const [n, c] of results) { console.log(`  ${c ? 'ok  ' : 'FAIL'} ${n}`); if (!c) failed += 1; }
  console.log(`\n${results.length - failed}/${results.length} checks passed.`);
  process.exit(failed ? 1 : 0);
}, (e) => { console.error(e); process.exit(1); });
