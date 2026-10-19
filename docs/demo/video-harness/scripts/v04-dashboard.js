/**
 * V04 — Read your day on the dashboard.
 * Shortest video in the wave: the dashboard is a launchpad, not a report.
 */

module.exports = {
  id: 'V04',
  slug: 'v04-read-your-day-on-the-dashboard',
  title: 'Read your day on the dashboard',
  thumbHeadline: 'Read your day',
  moduleLabel: 'Home ▸ Dashboard',
  audience: 'Everyone',
  intro: 'What each tile counts, and how to jump from a number to the work behind it.',
  journey: 'Dashboard tiles → quick views → click through to the module',
  youtubeTitle: 'AureonCare: Read Your Day on the Dashboard (1 Minute)',
  description:
    'A one-minute guide to the AureonCare dashboard: what each metric counts, what the quick '
    + 'views are for, and why the dashboard is a launchpad rather than a report.\n\n'
    + 'Part of the AureonCare Getting Started series.',
  tags: [
    'AureonCare', 'medical practice dashboard', 'clinic dashboard', 'practice management software',
    'healthcare analytics', 'EHR dashboard', 'clinic KPIs', 'daily huddle',
    'medical office software', 'practice metrics',
  ],
  recap: [
    'Every tile counts something live — no refresh needed',
    'Quick views open the day’s appointments and tasks without leaving Home',
    'Click a number to land in the module behind it',
  ],

  async run(d, page) {
    d.chapter('The tiles');
    await d.step('Step 1 — Your numbers');
    await d.nav('Home', 'Dashboard');
    await d.say('Home ▸ <b>Dashboard</b> is where the day starts: the practice at a glance.', 3200);
    await d.say(
      'Each tile counts something live — today’s appointments, active patients, open tasks, revenue this month.',
      3800
    );
    await d.scrollBy(260);
    await d.say(
      'These are not a report you run. They are the current state, and they move as the day does.',
      3400
    );

    d.chapter('Click through to the work');
    await d.step('Step 2 — Follow a number');
    await d.scrollBy(-260);
    const open = page.getByRole('button', { name: /Telehealth Open|Practice Management Open/ }).first();
    if (await d.exists(open)) {
      await d.say('Every card on the dashboard opens the module behind it — one click, no navigation.', 3400);
      await d.click(open, { pause: 2600 });
      await d.say('You land in the module itself, ready to work rather than to read.', 3000);
      await d.nav('Home', 'Dashboard');
    }

    // Quick Actions goes last: the panel overlays the cards while it is open.
    d.chapter('Quick actions');
    await d.step('Step 3 — Start a job from here');
    const quick = page.getByRole('button', { name: /Quick Actions/i });
    if (await d.exists(quick)) {
      await d.click(quick.first(), { pause: 1800 });
      await d.say(
        '<b>Quick Actions</b> starts the jobs you do most — a patient, an appointment, a claim — without hunting for the module.',
        4000
      );
    }
    await d.say(
      'That is the habit: read the tiles at the start of the day, then click the one that needs you.',
      3400
    );
    await d.step('');
  },
};
