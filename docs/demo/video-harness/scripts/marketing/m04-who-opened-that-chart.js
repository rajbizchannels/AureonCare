/**
 * M4 — Who opened that chart, and when?
 *
 * The compliance cut, aimed at the person who gets asked that question after an
 * incident and has to answer it with something better than a promise.
 *
 * Three claims, in the order a reviewer would test them: the trail records
 * reads and not just writes, the roles explain why the access was possible at
 * all, and the data can leave in a standard format — which is what stops an
 * audit trail from doubling as a lock-in mechanism.
 */

module.exports = {
  id: 'M4',
  slug: 'm04-who-opened-that-chart',
  marketing: true,
  pace: 0.5,
  title: 'Who opened that chart, and when?',
  thumbHeadline: 'Answer it in two clicks',
  thumbSub: 'Audit trail, roles, and a way out.',
  moduleLabel: 'Settings ▸ Audit Logs ▸ Roles',
  audience: 'CMO, compliance lead, practice owner',
  intro: 'The trail records reads as well as writes, and the data can still leave.',
  journey: 'Audit Logs → filter → open an entry → role matrix → FHIR export',
  youtubeTitle: '"Who opened that chart?" — answering it in two clicks | AureonCare',
  description:
    'The question a compliance lead gets asked after an incident, answered on screen: the audit '
    + 'trail logs views as well as changes, filters down to the entry that matters, and shows who '
    + 'did what, when, and from where.\n\n'
    + 'Then the part that decides whether the answer is trustworthy — the role matrix that made the '
    + 'access possible, and a FHIR R4 export proving the record can leave in a format any other '
    + 'system reads.',
  tags: [
    'AureonCare', 'healthcare compliance', 'audit trail', 'HIPAA audit log',
    'role based access control', 'FHIR R4', 'interoperability', 'clinical governance',
    'medical records access', 'healthcare IT',
  ],
  recap: [
    'A view is logged, not only a change',
    'The role matrix explains why the access was possible',
    'FHIR R4 export means the record can leave',
  ],

  async run(d, page) {
    d.chapter('The trail');
    await d.card({
      heading: 'Who opened that chart, and when?',
      body: 'Two clicks, not a two-week search.',
      holdMs: 2800,
      logo: false,
    });

    await d.step('The trail');
    await d.nav('Settings', 'Audit Logs');
    await d.say('Every action, with the user and the address behind it.', 2600);
    // The read-logging point is the one an auditor tests first, and the one
    // most systems fail, so it gets its own beat rather than a clause.
    await d.say('Note the views. Opening a chart leaves a trace, not just changing it.', 3000);

    await d.step('Narrow it');
    await d.click(page.getByRole('button', { name: /^Filters$/ }).first(), { pause: 1200 });
    const action = page.locator('select').first();
    if (await d.exists(action, 5000)) {
      await d.select(action, { index: 1 });
      await d.say('Filter by action, user, module or date, and the list is the handful that matter.', 3200);
    }

    await d.step('Read one');
    await d.click(page.getByRole('button', { name: /View Details/i }).first(), { pause: 1600 });
    await d.say('One entry: who, what, when, and from where.', 2400);
    // The detail dialog closes on an unlabelled X, so it has to be dismissed
    // through the dialog itself — otherwise the overlay sits there and eats the
    // next navigation.
    const detail = page.locator('div.fixed.inset-0').filter({ hasText: 'Audit Log Details' }).last();
    await d.click(detail.locator('button').first(), { pause: 1200 });

    d.chapter('Why they could');
    await d.step('Why they could');
    await d.nav('Settings', 'Roles & Permissions');
    await d.say('The trail says what happened. This says why it was allowed.', 2800);
    await d.scrollBy(320);
    await d.say('Every role, every module, spelled out rather than assumed.', 2600);

    d.chapter('And it can leave');
    await d.step('And it can leave');
    await d.nav('Clinical', 'FHIR Resources');
    await d.say('And the record is not trapped here.', 2000);
    await d.click(page.getByRole('button', { name: /^Condition$/ }).first(), { pause: 1400 });
    await d.say('FHIR R4 — a diagnosis is a Condition, a vital sign an Observation.', 3000);
    await d.click(page.getByRole('button', { name: /^Download$/ }).first(), { pause: 1600 });
    await d.say('Downloadable as standard JSON, readable by a system that has never heard of us.', 3200);

    await d.card({
      heading: 'Answerable. Explainable. Portable.',
      body: 'The three things an auditor actually asks for.',
      holdMs: 3800,
      keep: true,
    });
  },
};
