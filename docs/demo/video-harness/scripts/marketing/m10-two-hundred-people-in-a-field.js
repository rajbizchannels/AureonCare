/**
 * M10 — Two hundred people in a field, and a record for every one
 *
 * The outreach cut. Medical camps shipped in October as a four-part module —
 * plan, desk, board, outcomes — and this follows one camp through all four in
 * the order the day actually happens.
 *
 * Three claims, chosen because they are the ones a clipboard cannot make: the
 * plan knows a camp takes people away from the clinic and refuses to pretend
 * otherwise, the desk turns a walk-in into a real record at the point of
 * contact, and the sponsor gets counts without ever getting names.
 *
 * Deviation from the plan: the plan called for issuing stock on camera. Cut —
 * the supplies section is the fourth on a long page and the beat it buys
 * ("reconcile before the camp can close") is a sentence, not a demo. The
 * staffing clash earns the time instead; it is the only place the module
 * refuses the user something, and refusals are what prove a system is real.
 */

module.exports = {
  id: 'M10',
  slug: 'm10-two-hundred-people-in-a-field',
  marketing: true,
  pace: 0.5,
  title: 'Two hundred people in a field, and a record for every one',
  thumbHeadline: 'Run the camp. Keep the records.',
  thumbSub: 'Plan, desk, board, sponsor report.',
  moduleLabel: 'Scheduling ▸ Medical Camps',
  audience: 'Practice owner, outreach lead, CMO',
  intro: 'A camp is a clinic that moved. The records should move with it.',
  journey: 'Camp plan → staffing clash → registration desk → station board → outcomes and sponsor report',
  youtubeTitle: 'Running a medical camp without losing the records | AureonCare',
  description:
    'Outreach camps are run on paper almost everywhere: a table at the gate, a register, and a box '
    + 'of forms that someone types up weeks later — if at all. This follows one camp through the '
    + 'four parts of the module, in the order the day happens.\n\n'
    + 'Planning that knows a camp takes clinicians away from the clinic, and says which '
    + 'appointments clash before anyone is rostered. A registration desk that issues a queue token '
    + 'and creates a real record at the gate. A live station board showing where the queue is '
    + 'building. And a sponsor report that is counts only — no names, no dates of birth, with small '
    + 'groups combined so a single case cannot identify anyone.',
  tags: [
    'AureonCare', 'medical camp', 'health camp software', 'outreach clinic',
    'community health', 'screening camp', 'queue management', 'health camp report',
    'patient registration', 'healthcare IT',
  ],
  recap: [
    'The roster refuses a clinician already booked at the clinic',
    'A walk-in becomes a record and a token at the gate',
    'The sponsor gets counts, never names',
  ],

  async run(d, page) {
    d.chapter('The camp');
    await d.card({
      heading: 'Two hundred people. One field.',
      body: 'And a record for every one of them.',
      holdMs: 2800,
      logo: false,
    });

    await d.step('The camp');
    await d.nav('Scheduling', 'Plan');
    // The practice-setup banner offers itself on a fresh tenant and sits above
    // the content. Dismiss it so the camp is what the frame is about.
    await d.maybeClick(page.getByRole('button', { name: /^Not now$/ }), { pause: 600 });
    await d.say('Camps are planned here, alongside the clinic that staffs them.', 2800);
    await d.click(page.getByRole('button', { name: /Riverside Community Health Camp/ }).first(), { pause: 1600 });
    await d.say('Services, people, stations and supplies — the four things a camp needs.', 3000);

    d.chapter('Who is on duty');
    await d.step('Who is on duty');
    await d.scrollBy(520);
    await d.say('A camp takes clinicians out of the building.', 2200);
    // The clash is the point of this beat: choosing a clinician who already has
    // clinic work inside the camp window lists the appointments rather than
    // quietly double-booking them. This must go through the ThemedSelect's own
    // button and listbox — selectOption() on the hidden native select is a
    // silent no-op (see Director.choose).
    const staffPicker = d.combo('Choose a team member');
    if (await d.exists(staffPicker, 6000)) {
      await d.choose(staffPicker, 'Michael Anderson');
      await d.say('Pick one who is already booked, and the clinic says so first.', 3000);
      await d.say('Three appointments inside the camp window, listed before anyone is rostered.', 3200);
    }

    d.chapter('The gate');
    await d.step('The gate');
    await d.click(page.getByRole('button', { name: /^Registration desk$/ }).first(), { pause: 1600 });
    await d.say('At the gate, a walk-in with no appointment and no file.', 2600);
    await d.fill(d.field('Name', 'input'), 'Meera Sundaram');
    await d.fill(d.field('Age', 'input'), '46');
    await d.say('Name, age, consent. Nothing that slows the queue down.', 2800);
    await d.click(page.getByRole('button', { name: /^Register and issue token$/ }), { pause: 1800 });
    await d.say('A token for them, and a record for you — at the point of contact.', 3200);

    d.chapter('The queue');
    await d.step('The queue');
    await d.click(page.getByRole('button', { name: /^Station board$/ }).first(), { pause: 1600 });
    await d.say('Every station, live, with the longest wait at each.', 2600);
    await d.say('Fourteen waiting at the doctor, thirty-six minutes deep. That is where to move people.', 3400);

    d.chapter('What it was worth');
    await d.step('What it was worth');
    await d.click(page.getByRole('button', { name: /^Outcomes$/ }).first(), { pause: 1700 });
    await d.say('Ninety-four seen. Thirty-seven now have a patient record.', 2800);
    await d.say('Twenty-one booked a follow-up — the number that decides whether the camp pays for itself.', 3400);

    await d.scrollBy(620);
    await d.click(page.getByRole('button', { name: /^Build sponsor report$/ }).first(), { pause: 1800 });
    await d.say('The sponsor funded it, so the sponsor gets counts.', 2400);
    await d.say('No names, no dates of birth, and small groups combined so nobody is identifiable.', 3400);

    await d.card({
      heading: 'A clinic that moved.',
      body: 'Not a clipboard you type up later.',
      holdMs: 3800,
      keep: true,
    });
  },
};
