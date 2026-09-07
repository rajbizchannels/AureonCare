/**
 * V17 — Let patients book themselves.
 * Recorded from the public link, which is served before the auth gate.
 */

const W3 = require('../fixtures-wave3');

module.exports = {
  id: 'V17',
  wave: 3,
  slug: 'v17-let-patients-book-themselves',
  title: 'Let patients book themselves',
  thumbHeadline: 'Online booking',
  moduleLabel: 'Public booking page',
  audience: 'Admin · front desk',
  intro: 'Share one link and let patients pick their own slot, inside the rules you set.',
  journey: 'Open the public link → choose a type → pick a date and time → enter details → confirm',
  startPath: `/book/${W3.bookingSlug}`,
  // The public page is served ahead of the auth gate, so it has no app shell to
  // wait for; the provider header is what says it has painted.
  readySelector: 'h1, h2',
  youtubeTitle: 'AureonCare: Let Patients Book Their Own Appointments',
  description:
    'Online self-booking in AureonCare. Shows the public booking link exactly as a patient '
    + 'sees it: choosing an appointment type, picking from the slots you actually have free, '
    + 'entering their details, and confirming — with the booking landing straight on the '
    + 'clinic calendar.\n\nPart of the AureonCare training series.',
  tags: [
    'AureonCare', 'online appointment booking', 'patient self scheduling', 'medical scheduling software',
    'clinic booking page', 'practice management software', 'patient portal booking',
    'healthcare scheduling', 'reduce phone calls', 'appointment booking software',
  ],
  recap: [
    'One public link per provider — no login, no account needed',
    'Patients only ever see slots you have actually left open',
    'The booking lands on the clinic calendar and confirms by email',
  ],

  async run(d, page) {
    d.chapter('The link a patient opens');
    await d.step('Step 1 — The public page');
    await d.say(
      'This is the <b>public booking page</b>: one link per provider, opened with no login and no account.',
      4200
    );
    await d.say(
      'It carries your clinic name, the provider and the address — the patient knows they are in the right place.',
      4000
    );

    d.chapter('Choosing what and when');
    await d.step('Step 2 — Pick a type');
    const type = page.getByText(/Follow-up|Annual physical|Telehealth consult/).first();
    if (await d.exists(type, 8000)) {
      await d.click(type, { pause: 2000 });
    }
    await d.say(
      'Only the types you marked bookable online appear — the rest stay for staff to book.',
      3800
    );

    await d.step('Step 3 — Pick a time');
    const nextBtn = page.getByRole('button', { name: /Next|Continue|Choose Time/i }).first();
    if (await d.exists(nextBtn, 4000)) await d.click(nextBtn, { pause: 1800 });

    const dayCell = page.getByRole('button', { name: /^\d{1,2}$/ }).first();
    if (await d.exists(dayCell, 6000)) {
      await d.click(dayCell, { pause: 2000 });
      await d.say('The calendar only offers days the provider actually works.', 3200);
    }

    const slot = page.getByText(/^(09:00|09:30|10:00|11:00|1:30 PM|9:00 AM)/).first();
    if (await d.exists(slot, 6000)) {
      await d.click(slot, { pause: 2000 });
      await d.say(
        'And the times are your real free slots — a patient cannot book over an existing appointment.',
        4000
      );
    }

    d.chapter('Their details, and confirming');
    await d.step('Step 4 — Their details');
    const next2 = page.getByRole('button', { name: /Next|Continue|Your Info/i }).first();
    if (await d.exists(next2, 4000)) await d.click(next2, { pause: 1800 });

    const first = page.locator('input[type="text"]').first();
    if (await d.exists(first, 5000)) {
      await d.type(first, 'Elena', { delay: 40 });
      const inputs = page.locator('input[type="text"]');
      if (await inputs.count() > 1) await d.type(inputs.nth(1), 'Marchetti', { delay: 40 });
    }
    const email = page.locator('input[type="email"]').first();
    if (await d.exists(email, 3000)) await d.type(email, 'elena.marchetti@example.com', { delay: 25 });
    const phone = page.locator('input[type="tel"]').first();
    if (await d.exists(phone, 3000)) await d.type(phone, '555-0126', { delay: 40 });

    await d.say(
      'Name, email and phone is all you ask for. The email is what carries the confirmation and the reminder.',
      4200
    );

    await d.step('Step 5 — Confirm');
    const confirm = page.getByRole('button', { name: /Confirm Booking|Book Appointment|Confirm/i }).last();
    if (await d.exists(confirm, 5000)) {
      await d.click(confirm, { pause: 3000 });
    }
    await d.say(
      'Booked. It appears on the clinic calendar immediately, and the desk never touched the phone.',
      4000
    );
    await d.step('');
  },
};
