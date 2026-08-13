/**
 * V03 — Book an appointment.
 * The whole appointment lifecycle: create, find, and change it.
 */

module.exports = {
  id: 'V03',
  slug: 'v03-book-an-appointment',
  title: 'Book an appointment',
  thumbHeadline: 'Book an appointment',
  moduleLabel: 'Scheduling ▸ Calendar',
  audience: 'Front desk',
  intro: 'Create, find and change an appointment — and understand what the type controls.',
  journey: 'Calendar views → New Appointment → patient, type, provider, time → save → find it in the list',
  youtubeTitle: 'AureonCare: Book an Appointment (Calendar Basics)',
  description:
    'Booking, finding and changing appointments in AureonCare. Covers the day and week calendar '
    + 'views, what the appointment type controls (duration and whether the visit is virtual), and '
    + 'where a booked visit shows up afterwards.\n\n'
    + 'Part of the AureonCare Getting Started series.',
  tags: [
    'AureonCare', 'medical appointment scheduling', 'clinic calendar software',
    'appointment booking tutorial', 'practice management software', 'patient scheduling',
    'healthcare scheduling software', 'front desk training', 'EHR scheduling', 'book appointment',
  ],
  recap: [
    'Scheduling ▸ Calendar ▸ New Appointment',
    'The appointment type sets the duration and marks a visit as telehealth',
    'Day, week and list views show the same appointments three ways',
  ],

  async run(d, page) {
    d.chapter('The calendar');
    await d.step('Step 1 — Open the calendar');
    await d.nav('Scheduling', 'Calendar');
    await d.say('Scheduling ▸ <b>Calendar</b> is the practice diary — every provider, every room.', 3200);

    const week = page.getByRole('button', { name: 'Week', exact: true });
    const dayBtn = page.getByRole('button', { name: 'Day', exact: true });
    if (await d.exists(dayBtn)) {
      await d.click(dayBtn, { pause: 1600 });
      await d.say('<b>Day</b> view for working the desk hour by hour.', 2400);
    }
    if (await d.exists(week)) {
      await d.click(week, { pause: 1600 });
      await d.say('<b>Week</b> view for spotting the gaps worth filling.', 2600);
    }

    d.chapter('Booking the visit');
    await d.step('Step 2 — New Appointment');
    await d.click(page.getByRole('button', { name: 'New Appointment' }), { pause: 1800 });
    await d.say('Every booking answers four questions: who, what, with whom, and when.', 3000);

    const selects = page.locator('select');
    await d.select(selects.nth(0), { label: 'Sarah Williams - MRN-2025-001' });
    await d.say('<b>Who.</b> Start typing or pick from the register — the MRN disambiguates namesakes.', 3200);

    await d.select(selects.nth(1), { label: 'Follow-up' });
    await d.say(
      '<b>What.</b> The appointment type sets the duration for you — change the type, not the clock.',
      3600
    );

    const providerSelect = page.locator('select').filter({ hasText: 'Select Provider' }).first();
    if (await d.exists(providerSelect)) {
      await d.select(providerSelect, { label: 'Michael Anderson' });
    }
    await d.say('<b>With whom.</b> Only providers who work that day are offered.', 2800);

    const date = page.locator('input[type="date"]').first();
    const time = page.locator('input[type="time"]').first();
    const when = new Date();
    when.setDate(when.getDate() + 2);
    const iso = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, '0')}-${String(when.getDate()).padStart(2, '0')}`;
    await d.fill(date, iso);
    await d.fill(time, '11:30');
    await d.say('<b>When.</b> Pick the slot; the duration follows the type you chose.', 3000);

    const reason = page.locator('input[placeholder*="reason"], input[placeholder*="Reason"]').first();
    if (await d.exists(reason)) {
      await d.type(reason, 'Review of latest HbA1c results');
      await d.say('A one-line reason is what the clinician reads before the patient walks in.', 3000);
    }

    d.chapter('After the booking');
    await d.step('Step 3 — Save');
    const save = page.getByRole('button', { name: /Schedule Appointment|Create Appointment|^Save/ }).last();
    await d.click(save, { pause: 1500 });
    const confirm = page.locator('div.fixed.inset-0')
      .filter({ hasText: 'Are you sure you want to schedule this appointment' }).last();
    if (await d.exists(confirm)) {
      await d.say('A confirmation step, so a mis-click never books a patient.', 2600);
      await d.click(confirm.getByRole('button', { name: /^Schedule$/ }), { pause: 3200 });
    }
    await d.say('Booked. The slot fills on the calendar and the patient gets their reminder.', 3400);

    const listTab = page.getByRole('button', { name: 'List', exact: true });
    if (await d.exists(listTab)) {
      await d.click(listTab, { pause: 2200 });
      await d.say(
        'The <b>List</b> view is the same diary as a searchable table — where you change or cancel a booking.',
        3600
      );
      await d.say(
        'Cancelling keeps the record and its reason. Deleting would erase the history — so cancel, do not delete.',
        3800
      );
    }
    await d.step('');
  },
};
