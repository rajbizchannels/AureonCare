/**
 * M6 — Where does Tuesday keep going?
 *
 * First of the vertical reels. Silent by design: these play muted in a feed,
 * so the words are on screen and the pacing is set by how long a thumb will
 * hold rather than by a narrator.
 *
 * Recorded 16:9 like everything else and composed into 9:16 afterwards. A
 * phone-shaped crop of this screen would lose the nav rail and half the table,
 * which is most of what the footage is for.
 */

module.exports = {
  id: 'M6',
  slug: 'm06-where-does-tuesday-go',
  marketing: true,
  reel: true,
  silent: true,
  pace: 0.45,
  title: 'Where does Tuesday keep going?',
  // No figures, though the instinct behind the old one was right: a hook
  // number the footage contradicts is the one thing a viewer will notice. It
  // read "135 booked. 10 no-shows." — the seven-day fixture's totals — and
  // stayed burned into the reel after the demo API began honouring the range,
  // above a clip showing 380 and 27 at thirty days and 1240 and 96 at ninety.
  // The totals follow the range selector and the calendar, so any number here
  // goes stale.
  thumbHeadline: 'The slots nobody turned up for.',
  thumbSub: 'The no-show report, ninety days at a time.',
  reelKicker: 'No-show report',
  moduleLabel: 'Insights ▸ Reports',
  audience: 'Practice owner, front desk',
  intro: 'The gap between booked and seen, made visible.',
  journey: 'Reports → No-Show Report → 90 days → the detail',
  youtubeTitle: 'Where does Tuesday keep going? | AureonCare',
  description:
    'The gap between what you booked and what you saw, in the report that shows it: no-show rate '
    + 'over ninety days, late cancellations alongside, and the detail behind the number.\n\n'
    + 'Synthetic data; no real patient information appears.',
  tags: [
    'AureonCare', 'no show rate', 'medical practice', 'patient no shows',
    'practice management', 'clinic reports', 'healthcare analytics',
  ],
  recap: [
    'The no-show rate needs a period attached to mean anything',
    'Late cancellations cost the same as a no-show',
    'The detail names who and when',
  ],

  async run(d, page) {
    // No hook or sign-off card. In a 9:16 reel a full-screen card inside the
    // clip shows up as a postage stamp in the middle of the frame, and it says
    // the same thing the surround already says much larger. The frame carries
    // the hook; the clip carries only product.
    d.chapter('The gap');
    await d.step('The gap');
    await d.nav('Insights', 'Reports');
    // Deliberately no figure here. This line used to be "where did the other
    // ten go?", which worked only because the fixture happened to total ten
    // no-shows over its seven days — the demo API now honours the range
    // selector, so that total moves with whatever window is chosen and a
    // hook naming a number would contradict the card behind it.
    await d.say('The appointments nobody turned up for. Where do they go?', 2400);

    await d.click(page.getByRole('button', { name: 'No-Show Report' }).first(), { pause: 2000 });
    await d.say('Scheduled, no-shows, and the rate between them.', 2400);

    // Selected rather than opened: an open native dropdown lingers on camera
    // and swallows the scroll a beat later.
    const range = page.locator('select').first();
    if (await d.exists(range, 4000)) {
      await d.select(range, '90').catch(() => {});
      await d.say('Ninety days, because one bad week proves nothing.', 2400);
    }

    // Cover: the ninety-day figures, before the page scrolls away from them.
    await d.cover();

    await d.scrollBy(340);
    await d.say('Late cancellations count too. The slot is gone either way.', 2600);

    await d.scrollBy(320);
    await d.say('And the detail names who, and when.', 2400);
  },
};
