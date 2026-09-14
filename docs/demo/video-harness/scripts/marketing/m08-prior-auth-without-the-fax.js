/**
 * M8 — Prior auth, without the fax machine.
 *
 * Third vertical reel. The request is raised against the patient and payer,
 * carries its codes, and goes to the clearinghouse — then sits on a queue with
 * a status instead of in a fax tray.
 *
 * "Approved in seconds" is not something this footage shows and is not a
 * promise anyone should make about a payer, so the claim stops at where the
 * request goes and how it is tracked.
 */

module.exports = {
  id: 'M8',
  slug: 'm08-prior-auth-without-the-fax',
  marketing: true,
  reel: true,
  silent: true,
  pace: 0.45,
  title: 'Prior auth, without the fax machine',
  thumbHeadline: 'No fax. No follow-up call.',
  thumbSub: 'Raised against the claim, tracked on a queue.',
  reelKicker: 'Prior authorization',
  moduleLabel: 'Billing ▸ Pre-Authorizations',
  audience: 'Front desk, billing manager',
  intro: 'A prior authorization raised electronically and tracked to a status.',
  journey: 'Pre-Authorizations → request → codes → submitted → on the queue',
  youtubeTitle: 'Prior auth without the fax machine | AureonCare',
  description:
    'A prior authorization raised against the patient and payer, carrying its diagnosis and '
    + 'procedure codes, submitted to the clearinghouse, and tracked on a queue with a status.\n\n'
    + 'Synthetic data; no real patient information appears.',
  tags: [
    'AureonCare', 'prior authorization', 'pre-authorization', 'medical billing',
    'revenue cycle management', 'clearinghouse', 'practice management',
  ],
  recap: [
    'The request is raised against the patient and payer',
    'It carries the diagnosis and procedure codes',
    'It is tracked to a status, not a fax confirmation',
  ],

  async run(d, page) {
    d.chapter('The request');
    await d.step('The request');
    await d.nav('Billing', 'Pre-Authorizations');
    await d.say('Prior auth. Still a fax in most practices.', 2400);

    await d.click(page.getByRole('button', { name: 'Request Pre-Authorization' }), { pause: 1600 });

    // Selected by index rather than by label: the option text carries the MRN,
    // and matching on a rendered string is one formatting change away from
    // breaking. The payer is not chosen at all — it derives from the patient.
    const patient = d.field('Patient', 'select').first();
    await d.select(patient, { index: 1 });
    await page.waitForTimeout(900);
    await d.say('Pick the patient. The payer comes with them.', 2600);

    const service = page.locator('input[placeholder*="MRI"]').first();
    await d.type(service, 'MRI lumbar spine without contrast', { delay: 24 });
    await d.say('Say what you are asking them to cover.', 2400);

    await d.scrollBy(320);
    await d.say('It carries the codes, so the payer is answering the right question.', 3000);

    await d.click(page.getByRole('button', { name: /^Submit Pre-Authorization Request$/ }), { pause: 2000 });
    await d.say('Sent to the clearinghouse. Not to a fax tray.', 2600);
    await d.say('And it sits on a queue with a status until they answer.', 2600);
  },
};
