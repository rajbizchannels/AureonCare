// WhatsApp messages that carry one of our short links (/s/<code>) also carry its QR code.
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

  process.env.FRONTEND_URL = 'http://localhost:3000';
  await twilio.sendMessage('+15550002', 'Join: http://localhost:3000/s/Oz0f0J57lncw');
  check('no QR image when the app is not on public https (the provider could not fetch it)', !('MediaUrl' in last().payload));
})().then(() => {
  let failed = 0;
  for (const [n, c] of results) { console.log(`  ${c ? 'ok  ' : 'FAIL'} ${n}`); if (!c) failed += 1; }
  console.log(`\n${results.length - failed}/${results.length} checks passed.`);
  process.exit(failed ? 1 : 0);
}, (e) => { console.error(e); process.exit(1); });
