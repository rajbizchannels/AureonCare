/**
 * V01 — Find your way around AureonCare.
 * Teaches the navigation model every other video depends on.
 */

module.exports = {
  id: 'V01',
  slug: 'v01-find-your-way-around-aureoncare',
  title: 'Find your way around AureonCare',
  thumbHeadline: 'Find your way around',
  moduleLabel: 'App shell · search · help',
  audience: 'Everyone',
  showsLogin: true,
  intro: 'Sign in, learn the three-pane layout, and find anything in two clicks.',
  journey: 'Sign in → workspace rail → module list → universal search → notifications → help → theme',
  youtubeTitle: 'AureonCare: Find Your Way Around (2-Minute Tour)',
  description:
    'A two-minute tour of the AureonCare workspace. You will learn the three-pane layout, '
    + 'how to move between modules, how universal search jumps straight to a patient or a claim, '
    + 'and where notifications, help and the AI assistant live.\n\n'
    + 'This is the first video in the AureonCare Getting Started series — watch it before the others, '
    + 'because every later video gives directions in the form "go to Scheduling then Calendar".',
  tags: [
    'AureonCare', 'practice management software', 'EHR software', 'clinic software tutorial',
    'medical practice management', 'healthcare software training', 'getting started',
    'patient management system', 'EHR navigation', 'medical office software',
  ],
  recap: [
    'Pane 1 is the workspace rail, pane 2 the module list, pane 3 the work',
    'Universal search jumps to a patient, appointment or claim by name or number',
    'Notifications, help and the AI assistant sit in the top bar',
  ],

  async run(d, page) {
    const F = require('../fixtures');

    // ── sign in ─────────────────────────────────────────────────────────
    d.chapter('Signing in');
    await d.step('Step 1 — Sign in');
    await d.say('Sign in with the email and password your practice administrator issued.', 2400);
    await d.type(page.locator('input[type="email"]'), F.demoUser.email);
    await d.type(page.locator('input[type="password"]'), 'demo-password');
    await d.click(page.getByRole('button', { name: 'Sign In', exact: true }), { pause: 2800 });
    await page.waitForSelector('nav[aria-label="Primary"]', { timeout: 30000 });
    await d.say('You land on your dashboard. Everything else hangs off the rail on the left.', 3000);

    // ── the three panes ─────────────────────────────────────────────────
    d.chapter('The three-pane layout');
    await d.step('Step 2 — The three panes');
    await d.say(
      '<b>Pane 1</b> is the workspace rail: Home, Scheduling, Patients, Clinical, Billing and the rest, with Settings at the bottom.',
      3600
    );
    await d.click(page.locator('nav[aria-label="Primary"]').getByRole('button', { name: 'Scheduling' }), { pause: 1400 });
    await d.say(
      '<b>Pane 2</b> lists the modules inside the workspace you picked. <b>Pane 3</b> is the work itself.',
      3600
    );
    await d.click(page.getByRole('button', { name: /^Calendar/ }).first(), { pause: 2200 });
    await d.say('Scheduling ▸ Calendar. Directions in these videos always read workspace ▸ module.', 3200);

    await d.click(page.locator('nav[aria-label="Primary"]').getByRole('button', { name: 'Patients' }), { pause: 1400 });
    await d.click(page.getByRole('button', { name: /^Electronic Health Records/ }).first(), { pause: 2000 });

    // ── universal search ────────────────────────────────────────────────
    d.chapter('Universal search');
    await d.step('Step 3 — Search anything');
    await d.say('Rather than clicking through, search. The magnifier is in the top bar.', 2600);
    await d.click(page.locator('button[title="Search"]'), { pause: 1200 });
    await d.type(page.locator('input[placeholder*="Search across all modules"]'), 'Sarah', { delay: 120 });
    await page.waitForTimeout(1200);
    await d.say(
      'One box covers patients, appointments, claims and tasks. Results are grouped by what they are.',
      3600
    );
    const firstResult = page.locator('button, [role="button"]').filter({ hasText: 'Sarah Williams' }).first();
    if (await d.exists(firstResult)) {
      await d.click(firstResult, { pause: 2400 });
    } else {
      await page.keyboard.press('Escape');
    }
    await d.say('Selecting a result takes you straight to that record.', 2200);

    // ── top bar tools ───────────────────────────────────────────────────
    d.chapter('Notifications, help and the assistant');
    await d.step('Step 4 — The top bar');
    await d.click(page.locator('button[title="Notifications"]'), { pause: 1800 });
    await d.say('The bell collects what needs you: denied claims, portal messages, posted payments.', 3400);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);

    const help = page.locator('button[title="Help & Documentation"]');
    if (await d.exists(help)) {
      await d.click(help, { pause: 1800 });
      await d.say('Help opens the guides for the module you are standing in.', 2600);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(600);
    }

    const theme = page.locator('button[title*="Mode"]').first();
    if (await d.exists(theme)) {
      await d.say('The whole workspace switches between dark and light to suit your room.', 2600);
      await d.click(theme, { pause: 2000 });
      await d.click(theme, { pause: 1600 });
    }

    await d.step('');
  },
};
