// WhatsApp: credentials come from AC_WA_* environment variables only, the Meta Graph API
// version is current and configurable, and messages that carry one of our short links
// (/s/<code>) also carry its QR code.
//
// Both providers attach an image by public URL: Twilio via MediaUrl, the WhatsApp Business
// API as an image message with the text as its caption. The image is /s/<code>/qr.png on
// our own domain. If the provider refuses the image, the text is sent on its own.
// No network and no database: axios is replaced with a recorder.

const path = require('path');
process.env.FRONTEND_URL = 'https://app.aureoncare.tech';
delete process.env.AC_SHORT_BASE;

const BACKEND = path.join(__dirname, '..', '..');
const axios = require(require.resolve('axios', { paths: [BACKEND] }));
const calls = [];
let failMedia = false;
axios.post = async (url, body) => {
  const payload = body instanceof URLSearchParams ? Object.fromEntries(body) : body;
  calls.push({ url, payload });
  const hasMedia = (payload && (payload.MediaUrl || payload.type === 'image'));
  if (failMedia && hasMedia) { const e = new Error('media rejected'); e.response = { data: 'bad media' }; throw e; }
  return { data: url.includes('twilio') ? { sid: 'SM1', status: 'queued' } : { messages: [{ id: 'wamid.1' }] } };
};
const WhatsAppService = require(path.join(BACKEND, 'services/whatsappService.js'));

const results = [];
const check = (n, c) => results.push([n, !!c]);
const SHORT = 'https://app.aureoncare.tech/s/Oz0f0J57lncw';
const QR = `${SHORT}/qr.png`;
const twilio = new WhatsAppService({ provider: 'twilio', account_sid: 'AC1', auth_token: 't', phone_number: '+15550001' });
const meta = new WhatsAppService({ provider: 'whatsapp_business', access_token: 'x', phone_number_id: '123' });
const last = () => calls[calls.length - 1];

(async () => {
  await twilio.sendMessage('+15550002', `Join: ${SHORT}`);
  check('Twilio: a message with a short link carries its QR code (MediaUrl)', last().payload.MediaUrl === QR && last().payload.Body.includes(SHORT));
  await twilio.sendMessage('+15550002', 'Your appointment is confirmed.');
  check('Twilio: a message without one carries no image', !('MediaUrl' in last().payload));
  await twilio.sendMessage('+15550002', 'See https://evil.example/s/Oz0f0J57lncw');
  check('Twilio: a look-alike link on another domain gets no QR code', !('MediaUrl' in last().payload));

  await meta.sendMessage('15550002', `Join: ${SHORT}`);
  check('Business API: sent as an image (the QR code) with the text as its caption',
    last().payload.type === 'image' && last().payload.image.link === QR && last().payload.image.caption.includes(SHORT));
  await meta.sendMessage('15550002', `Join: ${SHORT}\n${'x'.repeat(1100)}`);
  check('Business API: text over the 1024-character caption limit goes as plain text', last().payload.type === 'text');
  await meta.sendMessage('15550002', 'x', { name: 'appointment_reminder' });
  check('Business API: template messages are left alone', last().payload.type === 'template');

  failMedia = true;
  const before = calls.length;
  const r = await twilio.sendMessage('+15550002', `Join: ${SHORT}`);
  const tried = calls.slice(before);
  check('if the provider refuses the image, the text is still sent', r.success && tried.length === 2
    && tried[0].payload.MediaUrl && !('MediaUrl' in tried[1].payload) && tried[1].payload.Body.includes(SHORT));
  const before2 = calls.length;
  await meta.sendMessage('15550002', `Join: ${SHORT}`);
  const tried2 = calls.slice(before2);
  check('...for the Business API too', tried2.length === 2 && tried2[1].payload.type === 'text');
  failMedia = false;

  // ── configuration: environment only ─────────────────────────────────────────────
  const fakePool = (whatsapp) => ({ query: async () => ({ rows: [{ settings: whatsapp === undefined ? {} : { whatsapp } }] }) });
  const clear = () => { for (const k of Object.keys(process.env)) if (k.startsWith('AC_WA_')) delete process.env[k]; };
  clear();
  check('not configured → null', (await WhatsAppService.getConfig(fakePool())) === null);
  check('CREDENTIALS IN THE DATABASE ARE IGNORED',
    (await WhatsAppService.getConfig(fakePool({ enabled: true, provider: 'twilio', account_sid: 'AC1', auth_token: 't', phone_number: '+1' }))) === null);
  Object.assign(process.env, { AC_WA_PROVIDER: 'twilio', AC_WA_TWILIO_SID: 'ACenv', AC_WA_TWILIO_TOKEN: 'tok', AC_WA_TWILIO_FROM: 'whatsapp:+15550009' });
  const tw = await WhatsAppService.getConfig(fakePool());
  check('Twilio from AC_WA_TWILIO_*', tw && tw.provider === 'twilio' && tw.account_sid === 'ACenv' && tw.phone_number === '+15550009');
  check('...the database can still switch it off ("enabled": false)', (await WhatsAppService.getConfig(fakePool({ enabled: false }))) === null);
  process.env.AC_WA_TWILIO_TOKEN = '';
  check('an incomplete set → null (not a half-configured sender)', (await WhatsAppService.getConfig(fakePool())) === null);
  clear();
  Object.assign(process.env, { AC_WA_PROVIDER: 'whatsapp_business', AC_WA_META_TOKEN: 'EAAG', AC_WA_META_PHONE_ID: '42' });
  const mc = await WhatsAppService.getConfig(fakePool());
  check(`Meta from AC_WA_META_*, default Graph version ${WhatsAppService.DEFAULT_GRAPH_VERSION}`,
    mc && mc.provider === 'whatsapp_business' && mc.phone_number_id === '42' && mc.graph_version === 'v26.0');
  await new WhatsAppService(mc).sendMessage('15550002', 'Hello');
  check('...and calls graph.facebook.com/v26.0 (was v18.0)', last().url === 'https://graph.facebook.com/v26.0/42/messages');
  process.env.AC_WA_GRAPH_VERSION = 'v27.0';
  const mc2 = await WhatsAppService.getConfig(fakePool());
  await new WhatsAppService(mc2).sendMessage('15550002', 'Hello');
  check('AC_WA_GRAPH_VERSION overrides it', last().url.startsWith('https://graph.facebook.com/v27.0/'));
  process.env.AC_WA_GRAPH_VERSION = '../evil';
  check('...a malformed version falls back to the default', (await WhatsAppService.getConfig(fakePool())).graph_version === 'v26.0');
  clear();

  process.env.FRONTEND_URL = 'http://localhost:3000';
  await twilio.sendMessage('+15550002', 'Join: http://localhost:3000/s/Oz0f0J57lncw');
  check('no QR image when the app is not on public https (the provider could not fetch it)', !('MediaUrl' in last().payload));
})().then(() => {
  let failed = 0;
  for (const [n, c] of results) { console.log(`  ${c ? 'ok  ' : 'FAIL'} ${n}`); if (!c) failed += 1; }
  console.log(`\n${results.length - failed}/${results.length} checks passed.`);
  process.exit(failed ? 1 : 0);
}, (e) => { console.error(e); process.exit(1); });
