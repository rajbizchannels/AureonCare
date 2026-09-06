/**
 * M2 — Friday, 4:07pm. The 3:30 just cancelled.
 *
 * The front-desk cut. Its argument is that a cancellation is not an event the
 * desk has to work: the waitlist already knows who wants the slot, and the
 * paperwork for whoever takes it goes out without anyone typing an address.
 *
 * Deliberately short on forms. The point of this one is how little the person
 * at the desk actually does, so the camera stays on row-level actions rather
 * than on filling anything in.
 */

module.exports = {
  id: 'M2',
  slug: 'm02-friday-cancellation',
  marketing: true,
  pace: 0.5,
  title: 'Friday, 4:07pm — the 3:30 just cancelled',
  thumbHeadline: 'The slot refills itself',
  thumbSub: 'A cancellation, handled in three clicks.',
  moduleLabel: 'Scheduling ▸ Waitlist ▸ Intake',
  audience: 'Front desk, practice manager',
  intro: 'A late cancellation becomes a booking instead of an empty hour.',
  journey: 'Cancel → waitlist notifies the next patient → intake goes out',
  youtubeTitle: 'Friday 4:07pm, your 3:30 cancels — AureonCare front desk in 60 seconds',
  description:
    'A late Friday cancellation, handled from the front desk: the appointment is cancelled, the '
    + 'waitlist notifies the next patient who wanted that slot, and their intake paperwork goes '
    + 'out on its own.\n\n'
    + 'No phone tree, no re-typing, no empty hour.',
  tags: [
    'AureonCare', 'medical practice management', 'patient waitlist', 'appointment cancellation',
    'front desk software', 'clinic scheduling software', 'reduce empty appointments',
    'patient intake software', 'healthcare scheduling', 'practice manager',
  ],
  recap: [
    'A cancellation is a queue event, not a phone call',
    'The waitlist knows who wanted that slot',
    'Intake goes out without anyone re-keying it',
  ],

  async run(d, page) {
    d.chapter('The cancellation');
    await d.card({
      heading: '4:07pm. Friday.',
      body: 'Your 3:30 just cancelled.',
      holdMs: 2600,
      logo: false,
    });

    await d.step('The cancellation');
    await d.nav('Scheduling', 'Appointments');
    await d.say('One patient cancels.', 1600);

    // Targeted by row rather than by position: the list is sorted by date, so
    // an index would drift every day the fixtures roll forward.
    const row = page.locator('tr')
      .filter({ hasText: 'Sarah Williams' })
      .filter({ hasText: 'Telehealth consult' })
      .last();
    await d.click(row.getByRole('button', { name: /^Edit$/ }), { pause: 1200 });

    await d.select(d.field('Status', 'select'), { label: 'Cancelled' });
    await d.say('Thirty seconds of admin. That is the whole cancellation.', 2400);
    await d.click(page.getByRole('button', { name: /^Save Changes$/ }).last(), { pause: 1200 });
    // The confirmation repeats the form's own button label, so it has to be
    // addressed through the dialog. Left unconfirmed, the overlay stays up and
    // swallows the next navigation rather than failing here.
    const saveDialog = page.locator('div.fixed.inset-0')
      .filter({ hasText: 'Are you sure you want to save these changes?' })
      .last();
    await saveDialog.waitFor({ timeout: 15000 });
    await d.click(saveDialog.getByRole('button', { name: /^Save Changes$/ }), { pause: 1600 });

    d.chapter('The queue');
    await d.step('The queue');
    await d.nav('Scheduling', 'Waitlist');
    await d.say('The waitlist already knows who wanted that slot.', 2400);
    await d.say('Priority and flexibility decide who gets called — not who asked first.', 2800);

    await d.step('Notify');
    await d.click(page.getByRole('button', { name: /^Notify$/ }).first(), { pause: 1600 });
    await d.say('Notify marks the entry called, so nobody rings them twice.', 2600);

    await d.click(page.getByRole('button', { name: /^Confirm$/ }).first(), { pause: 1200 });
    const wlDialog = page.locator('div.fixed.inset-0')
      .filter({ hasText: 'Confirm appointment for' })
      .last();
    await wlDialog.waitFor({ timeout: 15000 });
    await d.click(wlDialog.getByRole('button', { name: /^Confirm & Schedule$/ }), { pause: 1600 });
    await d.say('They accept. The entry leaves the queue.', 2200);

    d.chapter('The paperwork');
    await d.step('The paperwork');
    await d.nav('Patients', 'Patient Intake');
    await d.say('Their intake goes out on its own.', 2000);
    await d.scrollBy(260);
    await d.say('Answers land on the chart before the visit, not during it.', 2600);

    await d.card({
      heading: 'The slot refills itself.',
      body: 'Front desk, 4:08pm.',
      holdMs: 3600,
      keep: true,
    });
  },
};
