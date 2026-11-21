#!/usr/bin/env node
// Register AureonCare's WhatsApp message templates with the provider, and check approval.
//
//   npm run whatsapp:templates                 print the catalogue (nothing is sent)
//   npm run whatsapp:templates -- --register   submit every template for approval
//   npm run whatsapp:templates -- --status     approval status + the env value to set
//
// Reads the same AC_WA_* variables as the app (run it with production's values, e.g.
// `vercel env pull` + `npx dotenv-cli -e .env.vercel -- npm run whatsapp:templates -- --status`).
//
// Meta (AC_WA_PROVIDER=whatsapp_business) also needs:
//   AC_WA_META_WABA_ID  — WhatsApp Business Account ID (WhatsApp → API Setup)
//   AC_WA_META_APP_ID   — the app's ID; used once to upload the example image Meta requires
//                         for the QR-code header of telehealth_session
// Twilio (AC_WA_PROVIDER=twilio) needs nothing more: templates are Twilio Content API
// items, submitted to WhatsApp for approval. --register prints AC_WA_TWILIO_CONTENT_SIDS.
//
// Approval usually takes minutes to a day. Until a template is approved and listed in the
// env (AC_WA_TEMPLATES for Meta, AC_WA_TWILIO_CONTENT_SIDS for Twilio), the app keeps
// sending that message as free-form text.

const path = require('path');
const axios = require('axios');
const { CATALOGUE, KEYS } = require(path.join(__dirname, '..', 'services', 'whatsappTemplates.js'));
const { DEFAULT_GRAPH_VERSION } = require(path.join(__dirname, '..', 'services', 'whatsappService.js'));

const env = process.env;
const mode = process.argv.includes('--register') ? 'register' : process.argv.includes('--status') ? 'status' : 'print';
const provider = String(env.AC_WA_PROVIDER || '').toLowerCase();
const PREFIX = (env.AC_WA_TEMPLATE_PREFIX || 'aureoncare_').trim();
const LANG = (env.AC_WA_TEMPLATE_LANG || 'en').trim();
const GRAPH = `https://graph.facebook.com/${/^v\d+\.\d+$/.test(env.AC_WA_GRAPH_VERSION || '') ? env.AC_WA_GRAPH_VERSION : DEFAULT_GRAPH_VERSION}`;
const shortBase = () => (env.AC_SHORT_BASE || env.FRONTEND_URL || 'https://app.aureoncare.tech').split(',')[0].trim().replace(/\/+$/, '');

const die = (msg) => { console.error(`\n${msg}\n`); process.exit(1); };
const apiError = (e) => JSON.stringify(e.response?.data || e.message).slice(0, 400);

// ── Meta ───────────────────────────────────────────────────────────────────────────
function metaComponents(key, headerHandle) {
  const t = CATALOGUE[key];
  const c = [];
  if (t.header === 'IMAGE') c.push({ type: 'HEADER', format: 'IMAGE', example: { header_handle: [headerHandle] } });
  c.push({ type: 'BODY', text: t.body, example: { body_text: [t.examples] } });
  return c;
}

async function metaUploadExampleImage() {
  if (!env.AC_WA_META_APP_ID) die('AC_WA_META_APP_ID is required to upload the example QR image for telehealth_session.');
  const png = await require('qrcode').toBuffer(`${shortBase()}/s/Abc123Def456`, { type: 'png', width: 264, margin: 2 });
  const token = env.AC_WA_META_TOKEN;
  const start = await axios.post(`${GRAPH}/${env.AC_WA_META_APP_ID}/uploads`, null, {
    params: { file_name: 'qr-example.png', file_length: png.length, file_type: 'image/png', access_token: token },
  });
  const up = await axios.post(`${GRAPH}/${start.data.id}`, png, {
    headers: { Authorization: `OAuth ${token}`, file_offset: '0', 'Content-Type': 'application/octet-stream' },
  });
  return up.data.h;
}

async function metaRegister() {
  if (!env.AC_WA_META_TOKEN || !env.AC_WA_META_WABA_ID) die('Set AC_WA_META_TOKEN and AC_WA_META_WABA_ID.');
  let handle = null;
  for (const key of KEYS) {
    const name = `${PREFIX}${key}`;
    try {
      if (CATALOGUE[key].header === 'IMAGE' && !handle) handle = await metaUploadExampleImage();
      const r = await axios.post(`${GRAPH}/${env.AC_WA_META_WABA_ID}/message_templates`,
        { name, language: LANG, category: 'UTILITY', components: metaComponents(key, handle) },
        { headers: { Authorization: `Bearer ${env.AC_WA_META_TOKEN}` } });
      console.log(`  submitted  ${name}  (${r.data.status || 'PENDING'})`);
    } catch (e) {
      const already = /already exists|2388024/i.test(apiError(e));
      console.log(`  ${already ? 'exists    ' : 'FAILED    '} ${name}${already ? '' : `  ${apiError(e)}`}`);
    }
  }
  console.log('\nRun again with --status once Meta has reviewed them.');
}

async function metaStatus() {
  if (!env.AC_WA_META_TOKEN || !env.AC_WA_META_WABA_ID) die('Set AC_WA_META_TOKEN and AC_WA_META_WABA_ID.');
  const r = await axios.get(`${GRAPH}/${env.AC_WA_META_WABA_ID}/message_templates`, {
    params: { fields: 'name,status,language', limit: 200 }, headers: { Authorization: `Bearer ${env.AC_WA_META_TOKEN}` },
  });
  const byName = new Map((r.data.data || []).filter((t) => t.language === LANG).map((t) => [t.name, t.status]));
  const approved = [];
  for (const key of KEYS) {
    const status = byName.get(`${PREFIX}${key}`) || 'NOT REGISTERED';
    if (status === 'APPROVED') approved.push(key);
    console.log(`  ${status.padEnd(15)} ${PREFIX}${key}`);
  }
  console.log(`\nSet in the backend environment, then redeploy:\n  AC_WA_TEMPLATES=${approved.length === KEYS.length ? 'all' : approved.join(',') || '(none approved yet)'}`);
}

// ── Twilio (Content API) ─────────────────────────────────────────────────────────
const twilioAuth = () => ({ username: env.AC_WA_TWILIO_SID, password: env.AC_WA_TWILIO_TOKEN });
const CONTENT = 'https://content.twilio.com/v1/Content';

function twilioContent(key) {
  const t = CATALOGUE[key];
  const variables = Object.fromEntries(t.examples.map((v, i) => [String(i + 1), v]));
  if (t.header === 'IMAGE') {
    // The QR code: /s/<code>/qr.png, with <code> the last variable.
    const n = String(t.examples.length + 1);
    variables[n] = 'Abc123Def456';
    return { friendly_name: `${PREFIX}${key}`, language: LANG, variables,
      types: { 'twilio/media': { body: t.body, media: [`${shortBase()}/s/{{${n}}}/qr.png`] } } };
  }
  return { friendly_name: `${PREFIX}${key}`, language: LANG, variables, types: { 'twilio/text': { body: t.body } } };
}

async function twilioExisting() {
  const r = await axios.get(CONTENT, { auth: twilioAuth(), params: { PageSize: 500 } });
  return new Map((r.data.contents || []).map((c) => [c.friendly_name, c.sid]));
}

async function twilioRegister() {
  if (!env.AC_WA_TWILIO_SID || !env.AC_WA_TWILIO_TOKEN) die('Set AC_WA_TWILIO_SID and AC_WA_TWILIO_TOKEN.');
  const existing = await twilioExisting();
  const sids = {};
  for (const key of KEYS) {
    const name = `${PREFIX}${key}`;
    try {
      let sid = existing.get(name);
      if (!sid) sid = (await axios.post(CONTENT, twilioContent(key), { auth: twilioAuth() })).data.sid;
      sids[key] = sid;
      try {
        await axios.post(`${CONTENT}/${sid}/ApprovalRequests/whatsapp`, { name, category: 'UTILITY' }, { auth: twilioAuth() });
        console.log(`  submitted  ${name}  ${sid}`);
      } catch (e) {
        console.log(`  ${/already/i.test(apiError(e)) ? 'pending   ' : 'FAILED    '} ${name}  ${sid}  ${/already/i.test(apiError(e)) ? '' : apiError(e)}`);
      }
    } catch (e) {
      console.log(`  FAILED     ${name}  ${apiError(e)}`);
    }
  }
  console.log(`\nWhen --status shows them approved, set in the backend environment and redeploy:\n  AC_WA_TWILIO_CONTENT_SIDS=${JSON.stringify(sids)}`);
}

async function twilioStatus() {
  if (!env.AC_WA_TWILIO_SID || !env.AC_WA_TWILIO_TOKEN) die('Set AC_WA_TWILIO_SID and AC_WA_TWILIO_TOKEN.');
  const existing = await twilioExisting();
  const approved = {};
  for (const key of KEYS) {
    const name = `${PREFIX}${key}`;
    const sid = existing.get(name);
    let status = 'NOT REGISTERED';
    if (sid) {
      try {
        const r = await axios.get(`${CONTENT}/${sid}/ApprovalRequests`, { auth: twilioAuth() });
        status = String((r.data.whatsapp && r.data.whatsapp.status) || 'unsubmitted').toUpperCase();
      } catch (e) { status = 'UNKNOWN'; }
      if (status === 'APPROVED') approved[key] = sid;
    }
    console.log(`  ${status.padEnd(15)} ${name}${sid ? `  ${sid}` : ''}`);
  }
  console.log(`\nSet in the backend environment, then redeploy:\n  AC_WA_TWILIO_CONTENT_SIDS=${JSON.stringify(approved)}`);
}

// ── main ───────────────────────────────────────────────────────────────────────────
(async () => {
  if (mode === 'print') {
    console.log(`WhatsApp templates (category UTILITY, language ${LANG}, name prefix "${PREFIX}"):\n`);
    for (const key of KEYS) {
      const t = CATALOGUE[key];
      console.log(`${PREFIX}${key}${t.header === 'IMAGE' ? '   [header: image — the QR code of the link]' : ''}\n  ${t.body}\n  e.g. ${t.examples.join(' | ')}\n`);
    }
    console.log('Submit them with --register (needs AC_WA_* set), then check with --status.');
    return;
  }
  if (provider === 'twilio') return mode === 'register' ? twilioRegister() : twilioStatus();
  if (provider === 'whatsapp_business' || provider === 'meta') return mode === 'register' ? metaRegister() : metaStatus();
  die('Set AC_WA_PROVIDER to twilio or whatsapp_business (and its credentials) first.');
})().catch((e) => die(`Failed: ${apiError(e)}`));
