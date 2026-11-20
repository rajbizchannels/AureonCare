// WhatsApp message templates — the 24-hour rule.
//
// WhatsApp only lets a business send FREE-FORM text to someone who messaged it in the
// last 24 hours. Anything else (an appointment confirmation, a reminder, a join link) must
// use a TEMPLATE that Meta has approved in advance. Without templates those messages are
// refused (Meta error 131047, Twilio 63016) and only the email arrives.
//
// This is the catalogue of every message AureonCare sends on WhatsApp. Each one is
// registered once with the provider (npm run whatsapp:templates -- --register), approved by
// Meta, and then sent by reference with its {{n}} values filled in. A message whose
// template is not set up (or not approved yet) still goes out as free-form text, exactly
// as before — which works inside the 24-hour window.
//
// Rules Meta enforces, and this catalogue follows: category UTILITY (transactional, about
// something the person already has with the practice); the body may not start or end with
// a variable; variables carry no newlines; an example value per variable.

const CATALOGUE = {
  appointment_scheduled: {
    body: 'Hello {{1}}, your appointment with {{2}} is booked for {{3}} at {{4}}. Please contact the practice if you need to change it.',
    examples: ['Ana', 'Dr. Maya Patel', 'Monday, 7 December 2026', '10:30 AM'],
  },
  appointment_updated: {
    body: 'Hello {{1}}, your appointment with {{2}} has changed. It is now on {{3}} at {{4}}.',
    examples: ['Ana', 'Dr. Maya Patel', 'Tuesday, 8 December 2026', '2:00 PM'],
  },
  appointment_cancelled: {
    body: 'Hello {{1}}, your appointment with {{2}} on {{3}} at {{4}} has been cancelled. Please contact the practice to book a new time.',
    examples: ['Ana', 'Dr. Maya Patel', 'Monday, 7 December 2026', '10:30 AM'],
  },
  appointment_status: {
    body: 'Hello {{1}}, your appointment with {{2}} on {{3}} is now marked as {{4}}.',
    examples: ['Ana', 'Dr. Maya Patel', 'Monday, 7 December 2026', 'checked in'],
  },
  appointment_reminder: {
    body: 'Hello {{1}}, this is a reminder of your appointment with {{2}} on {{3}} at {{4}}. Please arrive a few minutes early.',
    examples: ['Ana', 'Dr. Maya Patel', 'Monday, 7 December 2026', '10:30 AM'],
  },
  telehealth_session: {
    // Header image: the QR code of the join link (/s/<code>/qr.png).
    header: 'IMAGE',
    body: 'Hello {{1}}, your video appointment with {{2}} is on {{3}} at {{4}}. Join here: {{5}} or scan the code above on your phone.',
    examples: ['Ana', 'Dr. Maya Patel', 'Monday, 7 December 2026', '10:30 AM', 'https://app.aureoncare.tech/s/Abc123Def456'],
  },
  prescription_new: {
    body: 'Hello {{1}}, {{2}} has prescribed {{3}} for you. Dosage: {{4}}. Please contact the practice if you have any questions.',
    examples: ['Ana', 'Dr. Maya Patel', 'Amoxicillin 500 mg', 'one capsule three times a day'],
  },
  lab_order_new: {
    body: 'Hello {{1}}, a lab test ({{2}}) has been ordered for you with {{3}}. The practice will tell you how to prepare.',
    examples: ['Ana', 'Complete blood count', 'Quest Diagnostics'],
  },
  general_update: {
    // Staff and admin notices (claims, payments, tasks, lab status) and anything else.
    body: 'Hello {{1}}, there is an update in AureonCare: {{2}}. Please sign in to see the details.',
    examples: ['Sam', 'claim CLM-1042 is now paid'],
  },
};

const KEYS = Object.keys(CATALOGUE);
const varCount = (key) => (CATALOGUE[key].body.match(/\{\{\d+\}\}/g) || []).length;

/** A variable value WhatsApp will accept: one line, no runs of spaces, not empty, ≤ 1024. */
function cleanVar(v) {
  const s = String(v == null ? '' : v).replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ').trim();
  return (s || '—').slice(0, 1024);
}

/**
 * The template configuration from the environment, or null when templates are off.
 *   Meta:   AC_WA_TEMPLATES = all | key,key,…   (which templates are APPROVED)
 *           AC_WA_TEMPLATE_PREFIX (default 'aureoncare_'), AC_WA_TEMPLATE_LANG (default 'en')
 *   Twilio: AC_WA_TWILIO_CONTENT_SIDS = {"appointment_scheduled":"HX…", …}
 *           (a key with a Content SID is in use; printed by the registration script)
 */
function templateConfig(e = process.env) {
  const provider = String(e.AC_WA_PROVIDER || '').trim().toLowerCase();
  if (provider === 'twilio') {
    let sids = {};
    try { sids = JSON.parse(e.AC_WA_TWILIO_CONTENT_SIDS || '{}') || {}; } catch {
      console.warn('[whatsapp] AC_WA_TWILIO_CONTENT_SIDS is not valid JSON — templates are off');
      return null;
    }
    const ready = Object.fromEntries(Object.entries(sids).filter(([k, v]) => CATALOGUE[k] && /^HX[0-9a-f]{32}$/i.test(String(v))));
    return Object.keys(ready).length ? { provider: 'twilio', sids: ready } : null;
  }
  if (provider === 'whatsapp_business' || provider === 'meta') {
    const raw = String(e.AC_WA_TEMPLATES || '').trim();
    if (!raw) return null;
    const keys = raw.toLowerCase() === 'all' ? KEYS : raw.split(',').map((s) => s.trim()).filter((k) => CATALOGUE[k]);
    if (!keys.length) return null;
    return {
      provider: 'whatsapp_business',
      keys: new Set(keys),
      prefix: (e.AC_WA_TEMPLATE_PREFIX || 'aureoncare_').trim(),
      lang: (e.AC_WA_TEMPLATE_LANG || 'en').trim(),
    };
  }
  return null;
}

/** Is template `key` ready to send under this configuration? */
function isReady(cfg, key) {
  if (!cfg || !CATALOGUE[key]) return false;
  return cfg.provider === 'twilio' ? Boolean(cfg.sids[key]) : cfg.keys.has(key);
}

/** The Meta Cloud API `template` object for a send. */
function metaTemplatePayload(cfg, key, vars, { headerImageUrl } = {}) {
  const t = CATALOGUE[key];
  const components = [];
  if (t.header === 'IMAGE') components.push({ type: 'header', parameters: [{ type: 'image', image: { link: headerImageUrl } }] });
  components.push({ type: 'body', parameters: vars.map((v) => ({ type: 'text', text: cleanVar(v) })) });
  return { name: `${cfg.prefix}${key}`, language: { code: cfg.lang }, components };
}

/** Twilio ContentVariables for a send: {"1": …, "2": …} (+ the QR code's short code). */
function twilioVariables(key, vars, { shortCode } = {}) {
  const out = {};
  vars.forEach((v, i) => { out[String(i + 1)] = cleanVar(v); });
  if (CATALOGUE[key].header === 'IMAGE') out[String(vars.length + 1)] = shortCode || '';
  return out;
}

module.exports = { CATALOGUE, KEYS, varCount, cleanVar, templateConfig, isReady, metaTemplatePayload, twilioVariables };
