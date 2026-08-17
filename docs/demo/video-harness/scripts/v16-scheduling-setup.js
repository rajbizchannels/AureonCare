/**
 * V16 — Set up appointment types and provider schedules.
 * Most scheduling complaints are a configuration problem, fixed here.
 */

module.exports = {
  id: 'V16',
  wave: 2,
  slug: 'v16-set-up-appointment-types-and-schedules',
  title: 'Set up appointment types and provider schedules',
  thumbHeadline: 'Configure scheduling',
  moduleLabel: 'Scheduling ▸ Appointment Types · Provider Scheduling',
  audience: 'Admin',
  intro: 'Fix the configuration and most scheduling complaints stop happening.',
  journey: 'Appointment Types → create a type with duration and rules → Provider Scheduling → working hours and coverage',
  youtubeTitle: 'AureonCare: Set Up Appointment Types and Provider Schedules',
  description:
    'Configuring scheduling in AureonCare. Covers appointment types and what the duration, '
    + 'colour and online-booking settings actually control downstream, then provider working '
    + 'hours, clinic hours and time off — the settings behind most day-to-day scheduling '
    + 'complaints.\n\n'
    + 'Part of the AureonCare Getting Started series.',
  tags: [
    'AureonCare', 'appointment types', 'provider scheduling', 'clinic configuration',
    'medical scheduling software', 'practice management software', 'working hours',
    'healthcare admin', 'calendar setup', 'online booking setup',
  ],
  recap: [
    'Scheduling ▸ Appointment Types sets duration, colour and online availability',
    'Duration comes from the type — that is why the calendar blocks what it blocks',
    'Provider Scheduling sets working hours; the calendar obeys both immediately',
  ],

  async run(d, page) {
    d.chapter('Appointment types');
    await d.step('Step 1 — Appointment Types');
    await d.nav('Scheduling', 'Appointment Types');
    await d.say(
      'Scheduling ▸ <b>Appointment Types</b> is the configuration behind most scheduling complaints.',
      4200
    );
    await d.say(
      'Each type carries a <b>duration</b>, a <b>colour</b> and rules. Book that type and the calendar blocks exactly that much time.',
      4800
    );
    await d.say(
      'If visits routinely overrun, the type is wrong — fix it once here rather than dragging appointments every day.',
      4800
    );

    d.chapter('Creating a type');
    await d.step('Step 2 — Create Appointment Type');
    await d.click(page.getByRole('button', { name: 'Create Appointment Type' }), { pause: 2400 });

    const form = page.locator('form').last();
    const name = form.locator('input[type="text"]').first();
    if (await d.exists(name, 6000)) {
      await d.type(name, 'Diabetes review', { delay: 34 });
    }

    const duration = form.locator('input[type="number"]').first();
    if (await d.exists(duration)) {
      await d.type(duration, '45', { delay: 90 });
      await d.say(
        'Set the duration to how long the visit <i>actually</i> takes, not how long you wish it took.',
        4400
      );
    }

    const descr = form.locator('textarea').first();
    if (await d.exists(descr)) {
      await d.type(descr, 'Quarterly review: labs, medication and foot check.', { delay: 24 });
    }
    await d.say(
      'The colour is not decoration — it is how a clinician reads a whole week at a glance.',
      4000
    );
    await d.say(
      'And whether patients can book this type themselves online is decided right here.',
      4000
    );

    await d.step('Step 3 — Save it');
    await d.maybeClick(page.getByRole('button', { name: /Create|Save/ }).last(), { pause: 2800 });
    await d.say('Saved, and available on every booking screen from this moment.', 3600);

    d.chapter('Provider schedules');
    await d.step('Step 4 — Provider Scheduling');
    await d.nav('Scheduling', 'Provider Scheduling');
    await d.say(
      'Scheduling ▸ <b>Provider Scheduling</b> is the other half — when each clinician is actually available.',
      4400
    );
    await d.say(
      'Types decide <i>how long</i> a visit takes. Working hours decide <i>when</i> it can happen. Both have to be right.',
      4800
    );

    await d.step('Step 5 — Hours and coverage');
    await d.maybeClick(page.getByRole('button', { name: /Manage Schedule/ }).first(), { pause: 2600 });
    await d.say(
      'Set working hours per provider, and the calendar stops offering slots nobody is there to cover.',
      4600
    );
    await d.say(
      'Time off goes in here too — booked leave removes the slots instead of leaving them to be cancelled later.',
      4800
    );
    await d.say(
      '<b>Set Clinic Hours</b> sits above all of it as the practice-wide envelope no booking can escape.',
      4600
    );
    await d.say(
      'Get these two screens right and the calendar largely runs itself. Get them wrong and you rebook by hand forever.',
      5000
    );
    await d.step('');
  },
};
