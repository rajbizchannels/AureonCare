/**
 * Renders the visual assets for the AureonCare LinkedIn newsletter.
 *
 * Same brand kit as the training-video harness (docs/demo/video-harness), so a
 * reader who meets the newsletter first and the videos second sees one system:
 * amber-to-teal rule, ink background, the wide logo, uppercase teal kicker.
 *
 * The house rule for these is *one idea per image*. A LinkedIn card is looked at
 * for about a second on a phone, so each asset carries a single claim in large
 * type with a lot of empty space around it. Resist adding a second row.
 *
 *   NODE_PATH=$(npm root -g) node docs/marketing/linkedin/build-assets.js        # all
 *   NODE_PATH=$(npm root -g) node docs/marketing/linkedin/build-assets.js v04    # one issue
 *
 * Output lands in ./assets/<issue>/ and is kept alongside the issue documents —
 * these are deliverables, and whoever schedules the post should not need a Node
 * toolchain to get at them.
 */

const fs = require('fs');
const path = require('path');

const BRAND = {
  amber: '#f0b000',
  amberLight: '#ffd24a',
  teal: '#00b0a0',
  tealLight: '#2dd4bf',
  ink: '#041016',
  slate: '#94a3b8',
  slateDim: '#64748b',
  paper: '#f8fafc',
};

BRAND.logo = 'data:image/png;base64,' + fs.readFileSync(
  path.join(__dirname, '..', '..', 'demo', 'video-harness', 'brand', 'aureoncare-logo-wide.png')
).toString('base64');

const OUT_DIR = path.join(__dirname, 'assets');
const FONT = "'Liberation Sans', 'DejaVu Sans', system-ui, sans-serif";
const APP_URL = 'app.aureoncare.tech';

/** Ink background with the same off-centre glow the video title cards use. */
const SURFACE = `radial-gradient(circle at 22% 14%, #0a3540, ${BRAND.ink} 68%)`;

/* ─────────────────────────────────────────────────────────────────────────────
 * Shared pieces
 * ────────────────────────────────────────────────────────────────────────── */

/** The amber-to-teal rule that marks every AureonCare surface. */
const rule = (width = 150) => `<div style="width:${width}px;height:6px;border-radius:99px;
  background:linear-gradient(90deg,${BRAND.amber},${BRAND.teal});"></div>`;

const kicker = (text) => `<div style="font-size:19px;font-weight:700;letter-spacing:.2em;
  text-transform:uppercase;color:${BRAND.teal};">${text}</div>`;

const headline = (text, max = 1020, size = 56) => `<div style="font-size:${size}px;font-weight:800;
  line-height:1.06;max-width:${max}px;">${text}</div>`;

const footnote = (text) => `<div style="font-size:22px;color:${BRAND.slateDim};">${text}</div>`;

const chip = (text) => `<span style="font-size:23px;color:${BRAND.slate};
  border:1px solid rgba(148,163,184,.3);border-radius:999px;padding:13px 28px;">${text}</span>`;

/** Every asset is this frame plus one idea inside it. */
const frame = (w, h, pad, body) => `
<div style="width:${w}px;height:${h}px;box-sizing:border-box;padding:${pad};
  background:${SURFACE};font-family:${FONT};color:${BRAND.paper};
  display:flex;flex-direction:column;justify-content:space-between;">${body}</div>`;

/** The standard 1200x675 body card: kicker, one idea, one footnote. */
const card = (kick, main, foot = '') =>
  frame(1200, 675, '70px 76px', `${kicker(kick)}<div>${main}</div>${footnote(foot)}`);

/** A search field with a term already typed — used by more than one issue. */
const searchField = (term) => `
  <div style="display:flex;align-items:center;gap:24px;
    border:2px solid ${BRAND.teal}66;border-radius:20px;padding:28px 34px;
    background:rgba(0,176,160,.07);">
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none"
      stroke="${BRAND.tealLight}" stroke-width="2.2" stroke-linecap="round">
      <circle cx="10.5" cy="10.5" r="7"></circle><path d="M15.8 15.8 L21 21"></path>
    </svg>
    <span style="font-size:34px;color:${BRAND.paper};">${term}</span>
    <span style="width:2px;height:34px;background:${BRAND.amber};"></span>
  </div>`;

/** A recap card: the logo, three remembered things, and the video's stamp. */
const recapCard = (lines, stamp) => {
  const line = (text) => `
    <div style="display:flex;align-items:baseline;gap:22px;">
      <span style="color:${BRAND.teal};font-size:30px;">&mdash;</span>
      <span style="font-size:31px;line-height:1.35;color:#cbd5e1;">${text}</span>
    </div>`;

  return frame(1200, 675, '70px 76px', `
    <div style="display:flex;align-items:center;justify-content:space-between;">
      <img src="${BRAND.logo}" alt="AureonCare" style="height:58px;">
      ${kicker('What you just learned')}
    </div>
    <div style="display:flex;flex-direction:column;gap:34px;">
      ${rule()}
      ${lines.map(line).join('')}
    </div>
    ${footnote(stamp)}`);
};

/** Cover — 1200x627, the ratio LinkedIn crops articles and link posts to. */
const coverCard = (issue, title, sub) => frame(1200, 627, '64px 76px', `
  <div style="display:flex;align-items:center;justify-content:space-between;">
    <img src="${BRAND.logo}" alt="AureonCare" style="height:64px;">
    ${kicker(issue)}
  </div>
  <div>
    ${rule()}
    <div style="margin-top:30px;font-size:82px;font-weight:800;line-height:1.04;max-width:960px;">
      ${title}
    </div>
    <div style="margin-top:26px;font-size:27px;color:${BRAND.slate};max-width:840px;line-height:1.4;">
      ${sub}
    </div>
  </div>
  ${footnote('Health &nbsp;|&nbsp; Efficiency &nbsp;|&nbsp; Growth')}`);

/**
 * Newsletter logo — 300x300, the square mark LinkedIn shows beside the
 * newsletter name in the feed and in subscriber email. It renders at about
 * 48px there, so it is the monogram and nothing else. Shared by every issue.
 */
const logoSquare = () => `
<div style="width:300px;height:300px;box-sizing:border-box;background:${SURFACE};
  font-family:${FONT};display:flex;flex-direction:column;align-items:center;
  justify-content:center;gap:22px;">
  <div style="font-size:150px;font-weight:800;line-height:1;
    background:linear-gradient(135deg,${BRAND.amber} 8%,${BRAND.teal} 82%);
    -webkit-background-clip:text;-webkit-text-fill-color:transparent;">A</div>
  ${rule(96)}
</div>`;

/**
 * A statement card: one sentence, nothing else. Used where an issue turns on a
 * single rule worth remembering rather than on a list.
 */
const statementCard = (kick, statement, sub) => frame(1200, 675, '70px 76px', `
  ${kicker(kick)}
  <div>
    <div style="font-size:66px;font-weight:800;line-height:1.08;max-width:1000px;">${statement}</div>
    <div style="margin-top:34px;font-size:27px;color:${BRAND.slate};line-height:1.45;max-width:900px;">
      ${sub}
    </div>
  </div>
  ${rule()}`);

/** Closing call to action. One destination, nothing competing with it. */
const ctaCard = (line) => frame(1200, 675, '70px 76px', `
  <img src="${BRAND.logo}" alt="AureonCare" style="height:62px;align-self:flex-start;">
  <div>
    ${rule()}
    <div style="margin-top:30px;font-size:38px;color:${BRAND.slate};line-height:1.35;max-width:1040px;">
      ${line}
    </div>
    <div style="margin-top:34px;font-size:64px;font-weight:800;
      background:linear-gradient(90deg,${BRAND.amberLight} 6%,${BRAND.tealLight} 78%);
      -webkit-background-clip:text;-webkit-text-fill-color:transparent;">${APP_URL}</div>
  </div>
  ${footnote('Health &nbsp;|&nbsp; Efficiency &nbsp;|&nbsp; Growth')}`);

/** Two or three labelled columns with a coloured bar above each. */
const columns = (items) => `
  <div style="display:flex;gap:44px;margin-top:56px;">
    ${items.map(([label, note, accent]) => `
      <div style="flex:1;display:flex;flex-direction:column;gap:20px;">
        <div style="height:8px;width:88px;border-radius:99px;background:${accent};"></div>
        <div style="font-size:31px;font-weight:700;">${label}</div>
        <div style="font-size:22px;color:${BRAND.slate};line-height:1.4;">${note}</div>
      </div>`).join('')}
  </div>`;

/* ─────────────────────────────────────────────────────────────────────────────
 * Issue 01 — Find your way around AureonCare (video V01)
 * ────────────────────────────────────────────────────────────────────────── */

const v01 = {
  '01-cover.png': { w: 1200, h: 627, html: () => coverCard(
    'Issue 01',
    'Find your way<br>around AureonCare',
    'Three panes, one search box, and the two-click rule.'
  ) },

  '02-three-panes.png': { w: 1200, h: 675, html: () => {
    const pane = (n, label, note, flex, accent) => `
      <div style="flex:${flex};display:flex;flex-direction:column;gap:18px;">
        <div style="height:150px;border-radius:20px;border:2px solid ${accent}33;
          background:${accent}14;display:flex;align-items:flex-start;padding:22px;">
          <span style="width:46px;height:46px;border-radius:999px;background:${accent};
            color:${BRAND.ink};font-size:24px;font-weight:800;display:flex;
            align-items:center;justify-content:center;">${n}</span>
        </div>
        <div style="font-size:30px;font-weight:700;">${label}</div>
        <div style="font-size:21px;color:${BRAND.slate};line-height:1.35;">${note}</div>
      </div>`;

    return card('The layout', `
      ${headline('Every screen is three panes')}
      <div style="display:flex;gap:34px;margin-top:52px;align-items:flex-start;">
        ${pane(1, 'Workspace', 'Home, Scheduling,<br>Patients, Billing', 3, BRAND.amber)}
        ${pane(2, 'Module', 'What lives inside<br>the workspace', 4, BRAND.teal)}
        ${pane(3, 'The work', 'The calendar, the chart,<br>the claim', 6, BRAND.tealLight)}
      </div>`,
      'Directions always read <span style="color:' + BRAND.amberLight + ';">workspace &#9656; module</span>');
  } },

  '03-universal-search.png': { w: 1200, h: 675, html: () => card('Universal search', `
    ${headline('One box reaches<br>the whole practice', 860)}
    <div style="margin-top:52px;">${searchField('Sarah')}</div>
    <div style="display:flex;gap:18px;margin-top:34px;">
      ${chip('Patients')} ${chip('Appointments')} ${chip('Claims')} ${chip('Tasks')}
    </div>`,
    'Results are grouped by what they are &mdash; pick one and you are on the record') },

  '04-top-bar.png': { w: 1200, h: 675, html: () => {
    const ICON = {
      bell: '<path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z"></path><path d="M10.5 20a1.8 1.8 0 0 0 3 0"></path>',
      help: '<circle cx="12" cy="12" r="9"></circle><path d="M9.4 9.2a2.7 2.7 0 1 1 3.3 3.1v1.6"></path><path d="M12.7 17.2h.01"></path>',
      theme: '<path d="M20 13.4A8 8 0 1 1 10.6 4a6.6 6.6 0 0 0 9.4 9.4Z"></path>',
    };
    const tool = (icon, label, note) => `
      <div style="flex:1;display:flex;flex-direction:column;gap:20px;">
        <div style="width:78px;height:78px;border-radius:22px;display:flex;align-items:center;
          justify-content:center;background:rgba(0,176,160,.12);border:1px solid ${BRAND.teal}3d;">
          <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="${BRAND.tealLight}"
            stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${icon}</svg>
        </div>
        <div style="font-size:29px;font-weight:700;">${label}</div>
        <div style="font-size:21px;color:${BRAND.slate};line-height:1.4;">${note}</div>
      </div>`;

    return card('The top bar', `
      ${headline('Three tools you use every day')}
      <div style="display:flex;gap:44px;margin-top:56px;">
        ${tool(ICON.bell, 'Notifications', 'Denied claims, portal<br>messages, posted payments')}
        ${tool(ICON.help, 'Help', 'Guides for the module<br>you are standing in')}
        ${tool(ICON.theme, 'Theme', 'Dark or light, to suit<br>the room you work in')}
      </div>`,
      'The AI assistant sits alongside them &mdash; same bar, every screen');
  } },

  '05-recap.png': { w: 1200, h: 675, html: () => recapCard([
    'Pane 1 is the workspace, pane 2 the module, pane 3 the work',
    'Universal search jumps to a patient, appointment or claim',
    'Notifications, help and the theme switch live in the top bar',
  ], 'Video 1 of 8 &nbsp;&middot;&nbsp; 2 min 21 s &nbsp;&middot;&nbsp; AureonCare Getting Started') },

  '06-cta.png': { w: 1200, h: 675, html: () => ctaCard(
    'Walk the three panes in a workspace of your own.') },
};

/* ─────────────────────────────────────────────────────────────────────────────
 * Issue 02 — Register a new patient (video V02)
 * ────────────────────────────────────────────────────────────────────────── */

const v02 = {
  '01-cover.png': { w: 1200, h: 627, html: () => coverCard(
    'Issue 02',
    'Register a<br>new patient',
    'Three fields at the desk decide what works a month later.'
  ) },

  /* The heart of the issue: what each field is actually for. */
  '02-downstream.png': { w: 1200, h: 675, html: () => {
    const row = (field, accent, consequence) => `
      <div style="display:flex;align-items:center;gap:28px;">
        <span style="flex:0 0 250px;font-size:27px;font-weight:700;color:${BRAND.ink};
          background:${accent};border-radius:999px;padding:14px 0;text-align:center;">${field}</span>
        <svg width="34" height="20" viewBox="0 0 34 20" fill="none" stroke="${BRAND.slateDim}"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex:0 0 auto;">
          <path d="M1 10h30"></path><path d="M24 3l8 7-8 7"></path>
        </svg>
        <span style="font-size:26px;color:${BRAND.slate};line-height:1.35;">${consequence}</span>
      </div>`;

    return card('What matters later', `
      ${headline('Three fields, three consequences')}
      <div style="display:flex;flex-direction:column;gap:32px;margin-top:52px;">
        ${row('Insurance', BRAND.amber, 'Claims are built from it. Blank bills as self-pay.')}
        ${row('Email', BRAND.teal, 'This is the portal invitation. Get it right at the desk.')}
        ${row('MRN', BRAND.tealLight, 'Generated for you the moment you save. Never typed.')}
      </div>`,
      'Everything else on the form can follow later');
  } },

  '03-one-form.png': { w: 1200, h: 675, html: () => card('The form', `
    ${headline('One form, four short sections')}
    <div style="display:flex;gap:18px;margin-top:56px;flex-wrap:wrap;">
      ${chip('Identity')} ${chip('Contact')} ${chip('Insurance')} ${chip('Emergency contact')}
    </div>
    <div style="margin-top:44px;font-size:29px;color:${BRAND.slate};line-height:1.45;max-width:940px;">
      Required fields are marked. The rest can follow later.
    </div>`,
    'AureonCare confirms before it writes a new record') },

  '04-find-again.png': { w: 1200, h: 675, html: () => card('Finding them again', `
    ${headline('Search takes<br>whatever you have', 860)}
    <div style="margin-top:52px;">${searchField('Marchetti')}</div>
    <div style="display:flex;gap:18px;margin-top:34px;">
      ${chip('Name')} ${chip('MRN')} ${chip('Email')} ${chip('Phone')}
    </div>`,
    'The record joins the register the moment you save, with an MRN assigned') },

  '05-recap.png': { w: 1200, h: 675, html: () => recapCard([
    'Patients &#9656; Electronic Health Records &#9656; New Patient',
    'Insurance drives claims; email drives the portal; the MRN is automatic',
    'Search by name, MRN, email or phone to find the record again',
  ], 'Video 2 of 8 &nbsp;&middot;&nbsp; 2 min 25 s &nbsp;&middot;&nbsp; AureonCare Getting Started') },

  '06-cta.png': { w: 1200, h: 675, html: () => ctaCard(
    'Register your first patient in your own workspace.') },
};

/* ─────────────────────────────────────────────────────────────────────────────
 * Issue 03 — Book an appointment (video V03)
 * ────────────────────────────────────────────────────────────────────────── */

const v03 = {
  '01-cover.png': { w: 1200, h: 627, html: () => coverCard(
    'Issue 03',
    'Book an<br>appointment',
    'Four questions, and one rule about the clock.'
  ) },

  /* The booking form, reduced to the four things it actually asks. */
  '02-four-questions.png': { w: 1200, h: 675, html: () => {
    const q = (label, text) => `
      <div style="display:flex;align-items:baseline;gap:26px;">
        <span style="flex:0 0 210px;font-size:29px;font-weight:800;color:${BRAND.amberLight};">${label}</span>
        <span style="flex:0 0 2px;align-self:stretch;background:rgba(148,163,184,.25);"></span>
        <span style="font-size:25px;color:${BRAND.slate};line-height:1.35;">${text}</span>
      </div>`;

    return card('Booking', `
      ${headline('Every booking answers<br>four questions', 900)}
      <div style="display:flex;flex-direction:column;gap:28px;margin-top:48px;">
        ${q('Who', 'The patient. The MRN disambiguates namesakes.')}
        ${q('What', 'The appointment type.')}
        ${q('With whom', 'Only providers who work that day are offered.')}
        ${q('When', 'Pick the slot. The duration follows the type.')}
      </div>`,
      'A one-line reason is what the clinician reads before the patient walks in');
  } },

  '03-type-not-clock.png': { w: 1200, h: 675, html: () => statementCard(
    'The one rule',
    'Change the type,<br>not the clock',
    'The appointment type sets the duration for you, and marks whether the visit '
    + 'is virtual. Override the clock by hand and you have taught the calendar '
    + 'something that is not true.') },

  '04-three-views.png': { w: 1200, h: 675, html: () => card('The same diary, three ways', `
    ${headline('Day, week, list')}
    ${columns([
      ['Day', 'Working the desk<br>hour by hour', BRAND.amber],
      ['Week', 'Spotting the gaps<br>worth filling', BRAND.teal],
      ['List', 'The diary as a searchable<br>table &mdash; change or cancel here', BRAND.tealLight],
    ])}`,
    'Cancel a booking, never delete it &mdash; deleting erases the history') },

  '05-recap.png': { w: 1200, h: 675, html: () => recapCard([
    'Scheduling &#9656; Calendar &#9656; New Appointment',
    'The type sets the duration and marks a visit as telehealth',
    'Day, week and list show the same appointments three ways',
  ], 'Video 3 of 8 &nbsp;&middot;&nbsp; 2 min 24 s &nbsp;&middot;&nbsp; AureonCare Getting Started') },

  '06-cta.png': { w: 1200, h: 675, html: () => ctaCard(
    'Book your first appointment in your own workspace.') },
};

/* ─────────────────────────────────────────────────────────────────────────────
 * Issue 04 — Read your day on the dashboard (video V04)
 * ────────────────────────────────────────────────────────────────────────── */

const v04 = {
  '01-cover.png': { w: 1200, h: 627, html: () => coverCard(
    'Issue 04',
    'Read your day<br>on the dashboard',
    'Four live numbers, and a click straight into the work.'
  ) },

  /* What the four tiles actually count. */
  '02-four-tiles.png': { w: 1200, h: 675, html: () => {
    const tile = (label, accent) => `
      <div style="flex:1;border-radius:20px;border:1px solid ${accent}3d;
        background:${accent}12;padding:30px 26px;display:flex;flex-direction:column;gap:22px;">
        <div style="height:8px;width:56px;border-radius:99px;background:${accent};"></div>
        <div style="font-size:25px;font-weight:700;line-height:1.25;">${label}</div>
      </div>`;

    return card('The tiles', `
      ${headline('Four numbers, counted live')}
      <div style="display:flex;gap:24px;margin-top:56px;">
        ${tile("Today's<br>appointments", BRAND.amber)}
        ${tile('Active<br>patients', BRAND.teal)}
        ${tile('Open<br>tasks', BRAND.tealLight)}
        ${tile('Revenue<br>this month', BRAND.amberLight)}
      </div>`,
      'Home &#9656; Dashboard &mdash; the practice at a glance');
  } },

  '03-not-a-report.png': { w: 1200, h: 675, html: () => statementCard(
    'What they are',
    'Not a report<br>you run',
    'These are the current state of the practice, and they move as the day does. '
    + 'Nothing to generate, nothing to schedule, no date range to pick.') },

  '04-launchpad.png': { w: 1200, h: 675, html: () => card('From number to work', `
    ${headline('Every card opens the<br>module behind it', 900)}
    ${columns([
      ['Click a tile', 'You land in the module itself,<br>ready to work rather than to read', BRAND.amber],
      ['Quick Actions', 'Start a patient, an appointment<br>or a claim without hunting', BRAND.teal],
    ])}`,
    'One click, no navigation') },

  '05-recap.png': { w: 1200, h: 675, html: () => recapCard([
    'Home &#9656; Dashboard is the practice at a glance',
    'Each tile counts something live, not a report you run',
    'Click a card and you land in the module, ready to work',
  ], 'Video 4 of 8 &nbsp;&middot;&nbsp; 1 min 48 s &nbsp;&middot;&nbsp; AureonCare Getting Started') },

  '06-cta.png': { w: 1200, h: 675, html: () => ctaCard(
    'Read your own day on your own dashboard.') },
};

const ISSUES = { v01, v02, v03, v04 };

/** Shared across issues, so it sits at the root of assets/ rather than in one. */
const SHARED = { 'newsletter-logo.png': { w: 300, h: 300, html: logoSquare } };

/* ─────────────────────────────────────────────────────────────────────────── */

function loadPlaywright() {
  for (const name of ['playwright', 'playwright-core']) {
    try {
      return require(name);
    } catch (_) { /* keep looking */ }
  }
  throw new Error('Playwright not found. npm i -g playwright, then run with NODE_PATH=$(npm root -g).');
}

async function shoot(browser, asset, file) {
  const page = await browser.newPage({
    viewport: { width: asset.w, height: asset.h },
    deviceScaleFactor: 2,
  });
  await page.setContent(
    `<body style="margin:0;background:${BRAND.ink};">${asset.html()}</body>`,
    { waitUntil: 'load' }
  );
  await page.waitForTimeout(250);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await page.screenshot({ path: file, clip: { x: 0, y: 0, width: asset.w, height: asset.h } });
  await page.close();
  console.log(`  ${path.relative(OUT_DIR, file).padEnd(28)} ${asset.w}x${asset.h} @2x`);
}

async function main() {
  const wanted = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const issues = wanted.length ? wanted : Object.keys(ISSUES);

  for (const id of issues) {
    if (!ISSUES[id]) {
      console.error(`Unknown issue "${id}". Known: ${Object.keys(ISSUES).join(', ')}`);
      process.exit(1);
    }
  }

  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ args: ['--no-sandbox', '--force-color-profile=srgb'] });
  let count = 0;

  // The shared mark is cheap and only rendered when everything is being rebuilt.
  if (!wanted.length) {
    for (const [name, asset] of Object.entries(SHARED)) {
      await shoot(browser, asset, path.join(OUT_DIR, name));
      count += 1;
    }
  }

  for (const id of issues) {
    for (const [name, asset] of Object.entries(ISSUES[id])) {
      await shoot(browser, asset, path.join(OUT_DIR, id, name));
      count += 1;
    }
  }

  await browser.close();
  console.log(`\n${count} assets written to ${path.relative(process.cwd(), OUT_DIR)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
