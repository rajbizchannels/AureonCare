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
 *   NODE_PATH=$(npm root -g) node docs/marketing/linkedin/build-assets.js
 *
 * Output lands in ./assets and is committed — these are deliverables, not build
 * junk, and whoever schedules the post should not need Playwright to get them.
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

/** Ink background with the same off-centre glow the video title cards use. */
const SURFACE = `radial-gradient(circle at 22% 14%, #0a3540, ${BRAND.ink} 68%)`;

/** The amber-to-teal rule that marks every AureonCare surface. */
const rule = (width = 150) => `<div style="width:${width}px;height:6px;border-radius:99px;
  background:linear-gradient(90deg,${BRAND.amber},${BRAND.teal});"></div>`;

const kicker = (text) => `<div style="font-size:19px;font-weight:700;letter-spacing:.2em;
  text-transform:uppercase;color:${BRAND.teal};">${text}</div>`;

/** Every asset is this frame plus one idea inside it. */
const frame = (w, h, pad, body) => `
<div style="width:${w}px;height:${h}px;box-sizing:border-box;padding:${pad};
  background:${SURFACE};font-family:${FONT};color:${BRAND.paper};
  display:flex;flex-direction:column;justify-content:space-between;">${body}</div>`;

/* ─────────────────────────────────────────────────────────────────────────────
 * The assets
 * ────────────────────────────────────────────────────────────────────────── */

/** Cover — 1200x627, the ratio LinkedIn crops articles and link posts to. */
const cover = () => frame(1200, 627, '64px 76px', `
  <div style="display:flex;align-items:center;justify-content:space-between;">
    <img src="${BRAND.logo}" alt="AureonCare" style="height:64px;">
    ${kicker('Issue 01')}
  </div>
  <div>
    ${rule()}
    <div style="margin-top:30px;font-size:82px;font-weight:800;line-height:1.04;max-width:940px;">
      Find your way<br>around AureonCare
    </div>
    <div style="margin-top:26px;font-size:27px;color:${BRAND.slate};max-width:800px;line-height:1.4;">
      Three panes, one search box, and the two-click rule.
    </div>
  </div>
  <div style="font-size:21px;color:${BRAND.slateDim};letter-spacing:.03em;">
    Health &nbsp;|&nbsp; Efficiency &nbsp;|&nbsp; Growth
  </div>`);

/**
 * Newsletter logo — 300x300, the square mark LinkedIn shows beside the
 * newsletter name in the feed and in subscriber email. It renders at about
 * 48px there, so it is the monogram and nothing else.
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

/** The three panes. Proportions match the real shell: narrow rail, list, work. */
const threePanes = () => {
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

  return frame(1200, 675, '70px 76px', `
    ${kicker('The layout')}
    <div>
      <div style="font-size:56px;font-weight:800;line-height:1.06;max-width:1020px;">
        Every screen is three panes
      </div>
      <div style="display:flex;gap:34px;margin-top:52px;align-items:flex-start;">
        ${pane(1, 'Workspace', 'Home, Scheduling,<br>Patients, Billing', 3, BRAND.amber)}
        ${pane(2, 'Module', 'What lives inside<br>the workspace', 4, BRAND.teal)}
        ${pane(3, 'The work', 'The calendar, the chart,<br>the claim', 6, BRAND.tealLight)}
      </div>
    </div>
    <div style="font-size:22px;color:${BRAND.slateDim};">
      Directions always read <span style="color:${BRAND.amberLight};">workspace &#9656; module</span>
    </div>`);
};

/** Universal search. One box, and the three things it reaches. */
const search = () => {
  const chip = (text) => `<span style="font-size:23px;color:${BRAND.slate};
    border:1px solid rgba(148,163,184,.3);border-radius:999px;padding:13px 28px;">${text}</span>`;

  return frame(1200, 675, '70px 76px', `
    ${kicker('Universal search')}
    <div>
      <div style="font-size:56px;font-weight:800;line-height:1.06;max-width:860px;">
        One box reaches<br>the whole practice
      </div>
      <div style="display:flex;align-items:center;gap:24px;margin-top:52px;
        border:2px solid ${BRAND.teal}66;border-radius:20px;padding:28px 34px;
        background:rgba(0,176,160,.07);">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none"
          stroke="${BRAND.tealLight}" stroke-width="2.2" stroke-linecap="round">
          <circle cx="10.5" cy="10.5" r="7"></circle><path d="M15.8 15.8 L21 21"></path>
        </svg>
        <span style="font-size:34px;color:${BRAND.paper};">Sarah</span>
        <span style="width:2px;height:34px;background:${BRAND.amber};"></span>
      </div>
      <div style="display:flex;gap:18px;margin-top:34px;">
        ${chip('Patients')} ${chip('Appointments')} ${chip('Claims')} ${chip('Tasks')}
      </div>
    </div>
    <div style="font-size:22px;color:${BRAND.slateDim};">
      Results are grouped by what they are &mdash; pick one and you are on the record
    </div>`);
};

/** The top bar. Three tools, three jobs. */
const topBar = () => {
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

  return frame(1200, 675, '70px 76px', `
    ${kicker('The top bar')}
    <div>
      <div style="font-size:56px;font-weight:800;line-height:1.06;max-width:1020px;">
        Three tools you use every day
      </div>
      <div style="display:flex;gap:44px;margin-top:56px;">
        ${tool(ICON.bell, 'Notifications', 'Denied claims, portal<br>messages, posted payments')}
        ${tool(ICON.help, 'Help', 'Guides for the module<br>you are standing in')}
        ${tool(ICON.theme, 'Theme', 'Dark or light, to suit<br>the room you work in')}
      </div>
    </div>
    <div style="font-size:22px;color:${BRAND.slateDim};">
      The AI assistant sits alongside them &mdash; same bar, every screen
    </div>`);
};

/** Recap — the three things to remember, and the call to watch. */
const recap = () => {
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
      ${line('Pane 1 is the workspace, pane 2 the module, pane 3 the work')}
      ${line('Universal search jumps to a patient, appointment or claim')}
      ${line('Notifications, help and the theme switch live in the top bar')}
    </div>
    <div style="font-size:23px;color:${BRAND.slateDim};">
      Video 1 of 8 &nbsp;&middot;&nbsp; 2 min 21 s &nbsp;&middot;&nbsp; AureonCare Getting Started
    </div>`);
};

const ASSETS = [
  { file: '00-newsletter-logo.png', w: 300, h: 300, html: logoSquare },
  { file: '01-cover.png', w: 1200, h: 627, html: cover },
  { file: '02-three-panes.png', w: 1200, h: 675, html: threePanes },
  { file: '03-universal-search.png', w: 1200, h: 675, html: search },
  { file: '04-top-bar.png', w: 1200, h: 675, html: topBar },
  { file: '05-recap.png', w: 1200, h: 675, html: recap },
];

function loadPlaywright() {
  for (const name of ['playwright', 'playwright-core']) {
    try {
      return require(name);
    } catch (_) { /* keep looking */ }
  }
  throw new Error('Playwright not found. npm i -g playwright, then run with NODE_PATH=$(npm root -g).');
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ args: ['--no-sandbox', '--force-color-profile=srgb'] });

  for (const asset of ASSETS) {
    const page = await browser.newPage({
      viewport: { width: asset.w, height: asset.h },
      deviceScaleFactor: 2,
    });
    await page.setContent(
      `<body style="margin:0;background:${BRAND.ink};">${asset.html()}</body>`,
      { waitUntil: 'load' }
    );
    await page.waitForTimeout(250);
    const out = path.join(OUT_DIR, asset.file);
    await page.screenshot({ path: out, clip: { x: 0, y: 0, width: asset.w, height: asset.h } });
    await page.close();
    console.log(`  ${asset.file}  ${asset.w}x${asset.h} @2x`);
  }

  await browser.close();
  console.log(`\n${ASSETS.length} assets written to ${path.relative(process.cwd(), OUT_DIR)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
