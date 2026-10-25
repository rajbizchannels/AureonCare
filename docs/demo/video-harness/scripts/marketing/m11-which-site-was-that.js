/**
 * M11 — Which site was that?
 *
 * The multi-site cut. Locations landed in October as a first-class tenant
 * entity, which sounds like plumbing until you have a second site and every
 * report starts answering the wrong question.
 *
 * Kept deliberately short. The feature is one screen, and the argument for it
 * is the shape of the list rather than anything you do to it: a clinic, a
 * second clinic, a hall the practice does not own, and a van. One of them is
 * primary, and the camp venue is the same kind of object as the surgery —
 * which is what stops outreach growing its own parallel address book.
 *
 * Deviation from the plan: no site is created on camera. Adding a row to a
 * list demonstrates nothing, and the interesting half of the feature is what
 * deactivation does — it keeps the site on historical records while removing
 * it from every picker — which is a sentence over a visible list.
 */

module.exports = {
  id: 'M11',
  slug: 'm11-which-site-was-that',
  marketing: true,
  pace: 0.5,
  title: 'Which site was that?',
  thumbHeadline: 'One practice. Four sites.',
  thumbSub: 'Including one you do not own.',
  moduleLabel: 'Settings ▸ Locations',
  audience: 'Practice manager, multi-site owner',
  intro: 'A second site should not mean a second system.',
  journey: 'Locations → four site types → the primary site → deactivation and history',
  youtubeTitle: 'Running more than one site without running two systems | AureonCare',
  description:
    'The moment a practice opens a second site, every number needs a qualifier: which site, whose '
    + 'patients, which room. Most systems answer that with a free-text address field and hope.\n\n'
    + 'Locations makes a site a real thing the rest of the product can point at — clinics, camp '
    + 'venues, mobile units and partner premises, all the same kind of object. One is primary, and '
    + 'anything not assigned to a site belongs to it. Deactivating a site takes it out of every '
    + 'picker without rewriting the history that already references it.',
  tags: [
    'AureonCare', 'multi site practice', 'clinic management', 'healthcare operations',
    'practice management software', 'multi location', 'medical practice', 'healthcare IT',
  ],
  recap: [
    'Clinics, camp venues and mobile units are the same kind of object',
    'One primary site catches anything unassigned',
    'Deactivating removes a site from pickers, not from history',
  ],

  async run(d, page) {
    d.chapter('Which site?');
    await d.card({
      heading: 'Which site was that?',
      body: 'The question a second location adds to every report.',
      holdMs: 2800,
      logo: false,
    });

    await d.step('The sites');
    await d.nav('Settings', 'Locations');
    await d.say('Every place this practice works, in one list.', 2400);
    await d.say('Two clinics, a community hall, and a van.', 2600);

    await d.step('Same kind of thing');
    await d.scrollBy(260);
    // The camp venue is the point: it is not a special case bolted onto
    // outreach, it is a site like the surgery, which is why a camp can simply
    // point at one instead of carrying its own address.
    await d.say('The hall is not the practice’s building. It is still a site.', 2800);
    await d.say('Which is why a camp points at one, instead of keeping its own address.', 3200);

    await d.step('The primary one');
    await d.scrollBy(-260);
    await d.say('One site is primary. Anything not assigned to a site belongs to it.', 3000);
    await d.say('So nothing is ever stranded while the second site is being set up.', 3000);

    await d.card({
      heading: 'A second site, not a second system.',
      body: 'Clinics, halls and vans — all the same kind of thing.',
      holdMs: 3600,
      keep: true,
    });
  },
};
