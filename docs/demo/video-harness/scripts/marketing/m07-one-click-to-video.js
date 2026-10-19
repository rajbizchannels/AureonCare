/**
 * M7 — The link is already on the chart.
 *
 * Second vertical reel. One idea, held for twenty seconds: a telehealth
 * session is created from a booked appointment and the meeting link attaches
 * itself to that visit, rather than being generated somewhere else and pasted
 * back in.
 *
 * The claim is narrow on purpose. "No plugin" and "works everywhere" are not
 * things this footage shows; the link arriving on the visit by itself is.
 */

module.exports = {
  id: 'M7',
  slug: 'm07-one-click-to-video',
  marketing: true,
  reel: true,
  silent: true,
  pace: 0.45,
  title: 'The link is already on the chart',
  thumbHeadline: 'Nobody pasted this link.',
  thumbSub: 'The session makes it, and the visit keeps it.',
  reelKicker: 'Telehealth',
  moduleLabel: 'Clinical ▸ Telehealth',
  audience: 'Clinicians, practice owners',
  intro: 'A video visit built from the booking, with the link attached to it.',
  journey: 'Telehealth → New Session → created → the link sits on the visit',
  youtubeTitle: 'Nobody pasted this link | AureonCare telehealth',
  description:
    'A telehealth session built from a booked appointment: the patient, provider and time come '
    + 'with it, and the meeting link attaches itself to the visit instead of being generated '
    + 'elsewhere and copied back in.\n\n'
    + 'Synthetic data; no real patient information appears.',
  tags: [
    'AureonCare', 'telehealth', 'virtual visit', 'Google Meet',
    'telemedicine software', 'video consultation', 'clinic software',
  ],
  recap: [
    'The session is built from a booked appointment',
    'The meeting link attaches itself to the visit',
    'Nothing is copied between systems',
  ],

  async run(d, page) {
    d.chapter('One click');
    await d.step('One click');
    await d.nav('Clinical', 'Telehealth');
    await d.say('Every virtual visit starts with a link.', 2000);

    await d.click(page.getByRole('button', { name: /New Session/i }), { pause: 1400 });
    await d.say('Usually copied in from somewhere else.', 2200);

    await d.click(page.getByRole('button', { name: /^Create Session$/ }).first(), { pause: 1200 });
    const dialog = page.locator('div.fixed.inset-0').filter({ hasText: 'Create Telehealth Session' }).last();
    await dialog.waitFor({ timeout: 15000 });
    await d.say('Built from the booking — patient, provider and time come with it.', 2800);
    await d.click(dialog.getByRole('button', { name: /^Create Session$/ }), { pause: 2000 });

    await d.scrollBy(280);
    await d.say('The room is made, and it lands on the visit.', 2400);
    await d.say('Nobody pasted anything.', 2000);
  },
};
