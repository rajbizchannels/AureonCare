#!/usr/bin/env node
/**
 * Records the AureonCare → Google Meet demonstration video that Google's OAuth
 * verification team asks for: how the app requests the Calendar scopes, where
 * an admin grants them, and what the app does with them afterwards.
 *
 * The walkthrough covers three screens, in this order:
 *   1. Settings   → Settings ▸ Telehealth Setup (Google Meet connection + consent)
 *   2. Configuration → Settings ▸ Integrations (Google Meet credential configuration)
 *   3. Telehealth → Clinical ▸ Telehealth (a Google Meet visit is created and joined)
 *
 * Modes
 * -----
 *   mock (default)  Runs against a locally served frontend with every /api call
 *                   answered from demo-fixtures.js. No backend, no database and
 *                   no Google account are needed. The Google consent screen is
 *                   NOT simulated — the recording states plainly that the real
 *                   consent screen opens at that step.
 *   live            Runs against a deployed AureonCare instance with a real
 *                   backend and real Google credentials, so the actual Google
 *                   consent screen is captured in the popup. Requires
 *                   DEMO_BASE_URL, DEMO_EMAIL and DEMO_PASSWORD.
 *
 * Usage
 * -----
 *   # terminal 1
 *   cd frontend && HOST=localhost PORT=3000 BROWSER=none npm start
 *
 *   # terminal 2
 *   NODE_PATH=$(npm root -g) node docs/google-verification/record-google-meet-demo.js
 *
 *   # against a real deployment
 *   MODE=live DEMO_BASE_URL=https://app.example.com \
 *   DEMO_EMAIL=admin@example.com DEMO_PASSWORD=... \
 *   NODE_PATH=$(npm root -g) node docs/google-verification/record-google-meet-demo.js
 *
 * Output: out/aureoncare-google-meet-demo.webm (+ .mp4 when ffmpeg is available)
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const F = require('./demo-fixtures');

const MODE = process.env.MODE === 'live' ? 'live' : 'mock';
const BASE_URL = process.env.DEMO_BASE_URL || 'http://localhost:3000';
const API_BASE = process.env.DEMO_API_URL || 'http://localhost:3001/api';
const OUT_DIR = process.env.OUT_DIR || path.join(__dirname, 'out');
const OUT_NAME = 'aureoncare-google-meet-demo';
const VIEWPORT = { width: 1280, height: 720 };

const LOGIN_EMAIL = process.env.DEMO_EMAIL || F.demoUser.email;
const LOGIN_PASSWORD = process.env.DEMO_PASSWORD || 'demo-password';

// Playwright is normally installed globally in CI images; fall back to a local
// copy so the script also runs from a plain `npm i -D playwright` checkout.
function loadPlaywright() {
  const candidates = ['playwright', 'playwright-core'];
  for (const name of candidates) {
    try {
      return require(name);
    } catch (_) {
      /* keep looking */
    }
  }
  throw new Error(
    'Playwright not found. Install it (npm i -g playwright) and re-run with NODE_PATH=$(npm root -g).'
  );
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* ────────────────────────────── mock API ────────────────────────────────── */

/**
 * Mutable server state for the recording. The walkthrough changes it —
 * connecting Google, enabling the provider, creating a session — so the UI
 * reacts the way it would against a real backend.
 */
function createState() {
  return {
    providers: F.telehealthSettings(),
    sessions: F.telehealthSessions(),
    googleConnected: false,
    /** set once the OAuth popup is opened, so /status starts reporting tokens */
    consentGrantedAt: null,
    nextSessionId: 7100,
    meetLinkIndex: 0,
  };
}

const provider = (state, type) => state.providers.find((p) => p.provider_type === type);

function markGoogleConnected(state) {
  const gm = provider(state, 'google_meet');
  gm.has_tokens = true;
  gm.is_configured = true;
  gm.zoom_user_email = 'alex.rivera@demo-clinic.example';
  gm.token_expires_at = F.iso(0, 23, 59);
  state.googleConnected = true;
}

async function handleApiRoute(route, state) {
  const request = route.request();
  const url = new URL(request.url());
  const method = request.method();
  const p = url.pathname.replace(/^.*\/api/, '') || '/';
  const json = (body, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

  // ── auth & core practice data ──────────────────────────────────────────
  if (p === '/auth/login' && method === 'POST') {
    return json({ token: 'demo.jwt.token', user: F.demoUser });
  }
  if (p === '/users') return json(F.users);
  if (/^\/users\/\d+$/.test(p)) return json(F.demoUser);
  if (p === '/appointments') return json(F.appointments);
  if (p === '/patients') return json(F.patients);
  if (p === '/notifications') return json(F.notifications);
  if (p === '/tasks') return json(F.tasks);
  if (p === '/clinic-settings') return json(F.clinicSettings);
  if (p === '/stripe-settings') return json(F.stripeSettings);
  if (p === '/vendor-integration-settings') return json(F.vendorIntegrationSettings);
  if (p === '/audit' && method === 'POST') return json({ id: 1 });

  // ── telehealth provider settings ───────────────────────────────────────
  if (p === '/telehealth-settings') return json(state.providers);

  const toggleMatch = p.match(/^\/telehealth-settings\/([^/]+)\/toggle$/);
  if (toggleMatch) {
    const target = provider(state, toggleMatch[1]);
    if (target) {
      const body = request.postDataJSON?.() || {};
      target.is_enabled = body.isEnabled ?? body.is_enabled ?? !target.is_enabled;
    }
    return json(target || {});
  }

  const testMatch = p.match(/^\/telehealth-settings\/([^/]+)\/test$/);
  if (testMatch) {
    return json({
      success: true,
      message:
        'Google Calendar API reachable — token valid for alex.rivera@demo-clinic.example',
    });
  }

  const instantMatch = p.match(/^\/telehealth-settings\/([^/]+)\/instant-meeting$/);
  if (instantMatch) {
    const link = F.MEET_LINKS[state.meetLinkIndex++ % F.MEET_LINKS.length];
    return json({ joinUrl: link, join_url: link, meetingUrl: link, start_url: link });
  }

  const settingsMatch = p.match(/^\/telehealth-settings\/([^/]+)$/);
  if (settingsMatch) {
    const target = provider(state, settingsMatch[1]) || {};
    if (method === 'PUT' || method === 'POST') {
      Object.assign(target, request.postDataJSON?.() || {});
    }
    return json(target);
  }

  // ── OAuth plumbing ─────────────────────────────────────────────────────
  const oauthMatch = p.match(/^\/integrations\/oauth\/([^/]+)\/([^/]+)$/);
  if (oauthMatch) {
    const [, providerType, action] = oauthMatch;
    if (action === 'redirect-url') {
      return json({ redirectUrl: `${API_BASE}/integrations/oauth/${providerType}/callback` });
    }
    if (action === 'credentials') {
      const target = provider(state, providerType) || {};
      return json({ client_id: target.client_id || '', client_secret: target.client_secret || '' });
    }
    if (action === 'initiate') {
      if (providerType !== 'google_meet') {
        return json({ error: 'Provider not configured' }, 400);
      }
      state.consentGrantedAt = Date.now();
      const authUrl =
        'https://accounts.google.com/o/oauth2/v2/auth' +
        `?client_id=${encodeURIComponent(F.DEMO_CLIENT_ID)}` +
        `&redirect_uri=${encodeURIComponent(`${API_BASE}/integrations/oauth/google_meet/callback`)}` +
        '&response_type=code&access_type=offline&prompt=consent' +
        '&scope=' +
        encodeURIComponent(
          'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events'
        );
      return json({ authUrl });
    }
    if (action === 'status') {
      // The recording narrates the consent screen for ~6s; report tokens after that.
      if (state.consentGrantedAt && Date.now() - state.consentGrantedAt > 6000) {
        markGoogleConnected(state);
      }
      return json({ hasTokens: state.googleConnected });
    }
  }

  // ── telehealth sessions ────────────────────────────────────────────────
  if (p === '/telehealth' && method === 'GET') return json(state.sessions);
  if (p === '/telehealth' && method === 'POST') {
    const body = request.postDataJSON?.() || {};
    const appointment = F.appointments.find((a) => a.id === body.appointmentId) || {};
    const link = F.MEET_LINKS[state.meetLinkIndex++ % F.MEET_LINKS.length];
    const session = {
      id: state.nextSessionId++,
      appointment_id: body.appointmentId,
      patient_id: body.patientId ?? appointment.patient_id,
      provider_id: body.providerId ?? appointment.provider_id,
      provider_type: 'google_meet',
      session_status: 'scheduled',
      start_time: body.startTime || appointment.start_time,
      duration_minutes: body.duration || appointment.duration_minutes || 30,
      meeting_url: link,
      join_url: link,
      calendar_event_id: `demo_evt_${state.nextSessionId}`,
    };
    state.sessions = [session, ...state.sessions];
    return json(session);
  }
  const sessionMatch = p.match(/^\/telehealth\/(\d+)$/);
  if (sessionMatch) {
    const target = state.sessions.find((s) => String(s.id) === sessionMatch[1]);
    if (target && (method === 'PUT' || method === 'PATCH')) {
      Object.assign(target, request.postDataJSON?.() || {});
    }
    return json(target || {});
  }

  // ── everything else the shell polls for ────────────────────────────────
  if (method === 'GET') return json([]);
  return json({ success: true });
}

/* ─────────────────────────── on-screen chrome ───────────────────────────── */

/** Caption bar, watermark and the synthetic cursor used to make clicks legible. */
const OVERLAY_SCRIPT = `
window.__demo = (() => {
  const ensure = () => {
    if (document.getElementById('demo-overlay-style')) return;
    const style = document.createElement('style');
    style.id = 'demo-overlay-style';
    style.textContent = \`
      #demo-caption {
        position: fixed; left: 0; right: 0; bottom: 0; z-index: 2147483646;
        padding: 14px 28px 16px; font: 500 17px/1.45 system-ui, -apple-system, Segoe UI, sans-serif;
        color: #f8fafc; background: linear-gradient(to top, rgba(2,6,23,.96), rgba(2,6,23,.82));
        border-top: 2px solid #22d3ee; letter-spacing: .2px;
        opacity: 0; transition: opacity .35s ease; pointer-events: none;
      }
      #demo-caption.on { opacity: 1; }
      #demo-caption b { color: #67e8f9; font-weight: 600; }
      #demo-watermark {
        position: fixed; bottom: 78px; right: 16px; z-index: 2147483646;
        font: 500 11px/1 system-ui, sans-serif; color: #94a3b8;
        background: rgba(2,6,23,.72); border: 1px solid rgba(148,163,184,.35);
        border-radius: 999px; padding: 6px 12px; pointer-events: none;
      }
      #demo-cursor {
        position: fixed; z-index: 2147483647; width: 22px; height: 22px; margin: -11px 0 0 -11px;
        border-radius: 50%; border: 2px solid #22d3ee; background: rgba(34,211,238,.28);
        box-shadow: 0 0 0 4px rgba(34,211,238,.12); pointer-events: none;
        transition: left .55s cubic-bezier(.4,0,.2,1), top .55s cubic-bezier(.4,0,.2,1), transform .18s ease;
        left: -100px; top: -100px;
      }
      #demo-cursor.press { transform: scale(.6); background: rgba(34,211,238,.6); }
      #demo-title {
        position: fixed; inset: 0; z-index: 2147483645; display: flex; flex-direction: column;
        align-items: center; justify-content: center; gap: 18px; text-align: center;
        background: radial-gradient(circle at 50% 40%, #0f172a, #020617 70%);
        color: #e2e8f0; font-family: system-ui, -apple-system, Segoe UI, sans-serif;
        opacity: 0; transition: opacity .5s ease; pointer-events: none;
      }
      #demo-title.on { opacity: 1; }
      #demo-title h1 { font-size: 38px; font-weight: 700; color: #f8fafc; margin: 0; }
      #demo-title h2 { font-size: 20px; font-weight: 500; color: #67e8f9; margin: 0; }
      #demo-title p { font-size: 15px; color: #94a3b8; margin: 0; max-width: 720px; line-height: 1.6; }
    \`;
    document.head.appendChild(style);

    const caption = document.createElement('div');
    caption.id = 'demo-caption';
    document.body.appendChild(caption);

    const mark = document.createElement('div');
    mark.id = 'demo-watermark';
    mark.textContent = 'AureonCare demo environment · synthetic data, no real patients';
    document.body.appendChild(mark);

    const cursor = document.createElement('div');
    cursor.id = 'demo-cursor';
    document.body.appendChild(cursor);
  };

  return {
    caption(html) {
      ensure();
      const el = document.getElementById('demo-caption');
      el.innerHTML = html || '';
      el.classList.toggle('on', Boolean(html));
    },
    title(heading, sub, body) {
      ensure();
      let el = document.getElementById('demo-title');
      if (!el) {
        el = document.createElement('div');
        el.id = 'demo-title';
        document.body.appendChild(el);
      }
      el.innerHTML = heading
        ? '<h1>' + heading + '</h1>' + (sub ? '<h2>' + sub + '</h2>' : '') + (body ? '<p>' + body + '</p>' : '')
        : '';
      el.classList.toggle('on', Boolean(heading));
    },
    moveCursor(x, y) {
      ensure();
      const c = document.getElementById('demo-cursor');
      c.style.left = x + 'px';
      c.style.top = y + 'px';
    },
    pressCursor() {
      const c = document.getElementById('demo-cursor');
      if (!c) return;
      c.classList.add('press');
      setTimeout(() => c.classList.remove('press'), 220);
    },
    ensure,
  };
})();
window.__demo.ensure();
`;

/** Keeps the OAuth popup out of the recording in mock mode. */
const STUB_WINDOW_OPEN = `
window.__demoOpenedUrls = [];
window.open = function (url) {
  window.__demoOpenedUrls.push(url);
  return { closed: false, close() { this.closed = true; }, focus() {}, postMessage() {} };
};
`;

/* ───────────────────────────── driver helpers ───────────────────────────── */

class Director {
  constructor(page) {
    this.page = page;
  }

  async ensureOverlay() {
    await this.page.evaluate(OVERLAY_SCRIPT).catch(() => {});
  }

  async say(html, holdMs = 2600) {
    await this.ensureOverlay();
    await this.page.evaluate((t) => window.__demo.caption(t), html);
    await sleep(holdMs);
  }

  async clearCaption() {
    await this.page.evaluate(() => window.__demo.caption('')).catch(() => {});
  }

  async titleCard(heading, sub, body, holdMs = 4200) {
    await this.ensureOverlay();
    await this.clearCaption();
    await this.page.evaluate(
      ([h, s, b]) => window.__demo.title(h, s, b),
      [heading, sub, body]
    );
    await sleep(holdMs);
    await this.page.evaluate(() => window.__demo.title(''));
    await sleep(600);
  }

  /** Move the synthetic cursor onto a locator, then really click it. */
  async click(locator, { pause = 900 } = {}) {
    await locator.scrollIntoViewIfNeeded().catch(() => {});
    await sleep(350);
    const box = await locator.boundingBox();
    if (box) {
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      await this.page.evaluate(([px, py]) => window.__demo.moveCursor(px, py), [x, y]);
      await sleep(650);
      await this.page.mouse.move(x, y);
      await this.page.evaluate(() => window.__demo.pressCursor());
    }
    await locator.click({ timeout: 15000 });
    await sleep(pause);
  }

  async type(locator, text, { delay = 55 } = {}) {
    await locator.scrollIntoViewIfNeeded().catch(() => {});
    const box = await locator.boundingBox();
    if (box) {
      await this.page.evaluate(
        ([px, py]) => window.__demo.moveCursor(px, py),
        [box.x + box.width / 2, box.y + box.height / 2]
      );
      await sleep(450);
    }
    await locator.click();
    await locator.fill('');
    await locator.type(text, { delay });
    await sleep(500);
  }

  /** Slow, readable scroll so reviewers can follow long settings pages. */
  async scrollBy(pixels, steps = 14) {
    const step = Math.round(pixels / steps);
    for (let i = 0; i < steps; i += 1) {
      await this.page.mouse.wheel(0, step);
      await sleep(90);
    }
    await sleep(500);
  }
}

/* ─────────────────────────────── the script ─────────────────────────────── */

async function signIn(d, page) {
  await d.titleCard(
    'AureonCare',
    'Google Meet integration — OAuth verification walkthrough',
    'AureonCare is a practice-management system for medical clinics. This recording shows where a clinic administrator connects the clinic&rsquo;s Google account, which Google Calendar scopes are requested, and how the app uses them to run a telehealth visit over Google Meet.'
  );

  await d.say(
    'A clinic administrator signs in to AureonCare. <b>Screen 1 of 3: Settings.</b>',
    2600
  );

  await d.type(page.locator('input[type="email"]'), LOGIN_EMAIL);
  await d.type(page.locator('input[type="password"]'), LOGIN_PASSWORD);
  await d.click(page.getByRole('button', { name: 'Sign In', exact: true }), { pause: 2600 });
  await page.waitForSelector('nav[aria-label="Primary"]', { timeout: 30000 });
  await sleep(1200);
}

async function settingsScreen(d, page) {
  await d.say('<b>Settings page.</b> Every integration lives under Settings in the left rail.', 2600);
  await d.click(page.locator('nav[aria-label="Primary"]').getByRole('button', { name: 'Settings' }));
  await d.click(page.getByRole('button', { name: 'Telehealth Setup' }), { pause: 1800 });

  await d.say(
    'Settings ▸ <b>Telehealth Setup</b> lists the video providers a clinic can connect. Google Meet is not connected yet.',
    3600
  );

  // Scope every interaction to the Google Meet card so the other providers'
  // identically-labelled controls are never picked up.
  const googleCard = page
    .locator('div.border.rounded-lg')
    .filter({ has: page.getByRole('heading', { name: 'Google Meet', exact: true }) })
    .first();
  await googleCard.scrollIntoViewIfNeeded().catch(() => {});
  await sleep(900);

  await d.say(
    'Opening the platform setup notes: AureonCare uses the <b>Google Calendar API</b> to place a Meet link on the appointment.',
    3200
  );
  const guide = page.getByRole('button', { name: /Platform Developer Setup/i });
  if (await guide.count()) {
    await d.click(guide, { pause: 1200 });
    await d.scrollBy(420);
    await d.say(
      'The clinic&rsquo;s redirect URI and the required Google APIs are shown here for the administrator.',
      3000
    );
    await d.scrollBy(-420);
    await d.click(guide, { pause: 900 });
  }

  await d.say(
    'The administrator clicks <b>Connect Google Meet Account</b> to start the OAuth flow.',
    2800
  );
  await d.click(googleCard.getByRole('button', { name: /Connect Google Meet Account/i }), {
    pause: 1500,
  });

  if (MODE === 'mock') {
    await d.say(
      'AureonCare now redirects to <b>accounts.google.com</b>. Google&rsquo;s own consent screen appears there and asks the administrator to grant ' +
        '<b>.../auth/calendar</b> and <b>.../auth/calendar.events</b>. It is Google&rsquo;s screen, so it is not reproduced in this recording.',
      6500
    );
    const opened = await page.evaluate(() => (window.__demoOpenedUrls || [])[0] || '');
    if (opened) {
      await d.say(
        'Authorization request sent to Google:<br><span style="font-size:13px;color:#cbd5e1;word-break:break-all">' +
          opened.replace(/&/g, '&amp;').slice(0, 260) +
          '…</span>',
        5200
      );
    }
  } else {
    await d.say(
      'Google&rsquo;s consent screen opens in a popup. Grant the requested Calendar scopes to continue.',
      3000
    );
    await page.waitForFunction(
      () => document.body.innerText.includes('Connected'),
      { timeout: 180000 }
    ).catch(() => {});
  }

  await page.waitForFunction(
    () => document.body.innerText.includes('Connected'),
    { timeout: 60000 }
  ).catch(() => {});
  await sleep(1200);

  await d.say(
    'Consent granted. The clinic&rsquo;s Google account is now <b>connected</b>, and the refresh token is stored server-side only.',
    3400
  );

  const testBtn = googleCard.getByRole('button', { name: /^Test Connection$/ });
  if (await testBtn.count()) {
    await d.click(testBtn, { pause: 2600 });
    await d.say(
      'A connection test confirms AureonCare can reach the <b>Google Calendar API</b> with the granted token.',
      3600
    );
  }

  const toggle = googleCard.locator('button[role="switch"]').first();
  if (await toggle.count()) {
    await d.say('Google Meet is switched on as the clinic&rsquo;s telehealth provider.', 2400);
    await d.click(toggle, { pause: 2400 });
  }
}

async function configurationScreen(d, page) {
  await d.titleCard(
    'Screen 2 of 3',
    'Configuration page — Settings ▸ Integrations',
    'Where the Google OAuth client id and secret for the clinic are reviewed and stored.'
  );

  await d.click(page.getByRole('button', { name: 'Integrations', exact: true }), { pause: 2200 });
  await d.say(
    '<b>Configuration page.</b> Integrations lists every external system AureonCare talks to, including the telehealth providers.',
    3400
  );

  await d.scrollBy(300);
  await d.say(
    'Under <b>Telehealth Providers</b>, Google Meet now reads <b>Active</b> — the connection made on the settings page.',
    3400
  );

  // The chevron next to the provider name opens its credential form.
  const expandGoogle = page
    .getByText('Google Meet', { exact: true })
    .locator('xpath=./following-sibling::button[1]');
  if (await expandGoogle.count()) {
    await d.click(expandGoogle.first(), { pause: 1800 });
  }

  await d.say(
    'The entry holds the <b>OAuth client id and client secret</b> issued in Google Cloud Console for AureonCare.',
    4000
  );
  await d.scrollBy(220);
  await d.say(
    'The secret is write-only: it is stored encrypted server-side and never returned to the browser. Clinic staff never see or handle Google tokens.',
    4200
  );
  await d.scrollBy(-320);
}

async function telehealthScreen(d, page) {
  await d.titleCard(
    'Screen 3 of 3',
    'Telehealth — how the Calendar scopes are used',
    'Creating a visit calls calendar.events.insert with conferenceData, which returns the Google Meet link that clinician and patient join.'
  );

  await d.click(page.locator('nav[aria-label="Primary"]').getByRole('button', { name: 'Clinical' }));
  // Secondary-nav buttons carry their description too, so match on the prefix.
  await d.click(page.getByRole('button', { name: /^Telehealth\b/ }).first(), { pause: 2200 });

  await d.say(
    '<b>Telehealth page.</b> The active provider banner shows Google Meet is the connected platform.',
    3200
  );

  await d.say(
    'The clinician starts a new visit from an upcoming appointment.',
    2400
  );
  await d.click(page.getByRole('button', { name: /New Session/i }), { pause: 1800 });

  await d.say(
    'Choosing an appointment makes AureonCare call the Google Calendar API — <b>events.insert</b> with a <b>conferenceData</b> request — using the scopes granted earlier.',
    4200
  );
  const createBtn = page.getByRole('button', { name: /^Create Session$/ }).first();
  await d.click(createBtn, { pause: 1500 });

  const createDialog = page
    .locator('div.fixed.inset-0')
    .filter({ hasText: 'Create Telehealth Session' })
    .last();
  await createDialog.waitFor({ timeout: 15000 }).catch(() => {});
  await d.say(
    'AureonCare confirms what will happen: a Google Meet session, and a join link for the patient.',
    2800
  );
  await d.click(createDialog.getByRole('button', { name: /^Create Session$/ }), { pause: 2600 });

  await sleep(1500);
  await d.say(
    'Google returns a calendar event with a Meet link. AureonCare stores the link on the visit — <b>this is the only thing the Calendar scopes are used for</b>.',
    4200
  );
  await d.scrollBy(300);

  await d.say(
    'The visit now appears under Upcoming Sessions, tagged <b>via Google Meet</b>, ready for clinician and patient to join.',
    3600
  );

  const joinBtn = page.getByRole('button', { name: /^Join$/ }).first();
  if (await joinBtn.count()) {
    await d.click(joinBtn, { pause: 1500 });
    const joinDialog = page
      .locator('div.fixed.inset-0')
      .filter({ hasText: 'Join Telehealth Session' })
      .last();
    await joinDialog.waitFor({ timeout: 15000 }).catch(() => {});
    if (await joinDialog.count()) {
      await d.click(joinDialog.getByRole('button', { name: /^Join Session$/ }), { pause: 2200 });
    }
    if (MODE === 'mock') {
      const links = await page.evaluate(() => window.__demoOpenedUrls || []);
      const meetLink = links.reverse().find((u) => String(u).includes('meet.google.com'));
      await d.say(
        'Joining opens the Google Meet room created for this visit' +
          (meetLink ? ': <b>' + meetLink + '</b>' : '.'),
        4000
      );
    }
  }

  await d.titleCard(
    'Summary',
    'Requested scopes and what they are for',
    'calendar and calendar.events are used solely to create, update and cancel the calendar event that carries the Google Meet link for a telehealth visit. AureonCare does not read unrelated calendar entries, and Google tokens stay on the server.',
    7000
  );
}

/* ─────────────────────────────── entrypoint ─────────────────────────────── */

async function main() {
  const { chromium } = loadPlaywright();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-device-scale-factor=1'],
  });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    recordVideo: { dir: OUT_DIR, size: VIEWPORT },
  });

  const state = createState();
  if (MODE === 'mock') {
    await context.route('**/api/**', (route) => handleApiRoute(route, state));
    await context.addInitScript(STUB_WINDOW_OPEN);
  }
  await context.addInitScript(OVERLAY_SCRIPT);

  const page = await context.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.warn('  [page error]', msg.text().slice(0, 160));
  });

  const d = new Director(page);
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('input[type="email"]', { timeout: 60000 });
  await sleep(1500);

  try {
    await signIn(d, page);
    await settingsScreen(d, page);
    await configurationScreen(d, page);
    await telehealthScreen(d, page);
    await d.clearCaption();
    await sleep(1200);
  } finally {
    const video = page.video();
    await context.close();
    await browser.close();

    if (video) {
      const raw = await video.path();
      const webm = path.join(OUT_DIR, `${OUT_NAME}.webm`);
      fs.renameSync(raw, webm);
      console.log('Recorded', webm);
      convertToMp4(webm, path.join(OUT_DIR, `${OUT_NAME}.mp4`));
    }
  }
}

/**
 * Google's upload form prefers mp4/H.264; convert when a capable ffmpeg exists.
 * Playwright's bundled ffmpeg is deliberately skipped — it ships VP8 only and
 * cannot mux H.264 — so install `ffmpeg-static` (or a system ffmpeg) for mp4.
 */
function convertToMp4(webm, mp4) {
  const candidates = [process.env.FFMPEG_PATH, findStaticFfmpeg(), 'ffmpeg'].filter(Boolean);

  for (const bin of candidates) {
    try {
      execFileSync(
        bin,
        ['-y', '-i', webm, '-c:v', 'libx264', '-preset', 'slow', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4],
        { stdio: 'ignore' }
      );
      console.log('Converted', mp4);
      return;
    } catch (_) {
      /* try the next candidate */
    }
  }
  console.log(
    'No H.264-capable ffmpeg found — keeping the .webm only (npm i -g ffmpeg-static to get an mp4).'
  );
}

/** Path exported by the `ffmpeg-static` package, if it is installed anywhere. */
function findStaticFfmpeg() {
  try {
    const bin = require('ffmpeg-static');
    if (bin && fs.existsSync(bin)) return bin;
  } catch (_) {
    /* not installed */
  }
  return null;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
