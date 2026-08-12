/**
 * V18 — Fill a cancelled slot from the waitlist.
 */

module.exports = {
  id: 'V18',
  wave: 3,
  slug: 'v18-fill-a-slot-from-the-waitlist',
  title: 'Fill a cancelled slot from the waitlist',
  thumbHeadline: 'Fill a cancelled slot',
  moduleLabel: 'Scheduling ▸ Waitlist',
  audience: 'Front desk',
  intro: 'Turn a cancellation into a booking instead of an empty hour.',
  journey: 'Waitlist → read the queue → notify the next patient → mark them scheduled',
  youtubeTitle: 'AureonCare: Fill a Cancelled Slot from the Waitlist',
  description:
    'Working the waitlist in AureonCare. Covers what each entry records, how priority and '
    + 'flexibility decide who gets called first, notifying the next patient when a slot opens, '
    + 'and closing the entry once they are booked.\n\nPart of the AureonCare training series.',
  tags: [
    'AureonCare', 'medical waitlist', 'appointment cancellation', 'clinic scheduling',
    'practice management software', 'fill empty appointments', 'patient waitlist software',
    'healthcare scheduling', 'front desk training', 'reduce no shows',
  ],
  recap: [
    'Scheduling ▸ Waitlist holds everyone waiting for an earlier slot',
    'Priority and flexibility decide who to call first, not who asked first',
    'Notify, then mark scheduled — the entry closes itself',
  ],

  async run(d, page) {
    d.chapter('The queue');
    await d.step('Step 1 — Open the waitlist');
    await d.nav('Scheduling', 'Waitlist');
    await d.say(
      'Scheduling ▸ <b>Waitlist</b> is everyone who wants an earlier slot than the one they have.',
      3800
    );
    await d.say(
      'Each entry carries the provider they need, the type of visit, and the days and times they can actually make.',
      4200
    );

    d.chapter('Who to call first');
    await d.step('Step 2 — Read the queue');
    await d.say(
      '<b>Priority</b> and <b>flexibility</b> are what matter — the patient who can come any morning fills a gap the rigid one cannot.',
      4600
    );
    const statusFilter = page.locator('select').first();
    if (await d.exists(statusFilter)) {
      await d.select(statusFilter, { label: 'All Status' }, { pause: 1800 });
      await d.say('Switching to every status shows who has already been called, and who is booked.', 3600);
    }

    d.chapter('Calling the next patient');
    await d.step('Step 3 — Notify');
    const notify = page.getByRole('button', { name: /Notify/i }).first();
    if (await d.exists(notify)) {
      await d.click(notify, { pause: 2600 });
      await d.say(
        'A slot has just opened. <b>Notify</b> contacts the next patient and marks the entry as called, so nobody rings them twice.',
        4600
      );
    } else {
      await d.say(
        'When a slot opens, notifying the next patient marks the entry as called, so nobody rings them twice.',
        4200
      );
    }

    await d.step('Step 4 — Close the entry');
    const scheduled = page.getByRole('button', { name: /Scheduled|Mark as/i }).first();
    if (await d.exists(scheduled)) {
      await d.click(scheduled, { pause: 2600 });
    }
    await d.say(
      'Once they accept and you book them, mark the entry <b>scheduled</b> — it leaves the queue and the slot is filled.',
      4400
    );
    await d.say(
      'The habit that makes this work: put people on the waitlist with real availability, not just a name.',
      4000
    );
    await d.step('');
  },
};
