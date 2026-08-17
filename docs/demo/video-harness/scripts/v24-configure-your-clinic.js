/**
 * V24 — Configure your clinic.
 * The three Practice screens, in the order a new clinic fills them in.
 */

module.exports = {
  id: 'V24',
  wave: 4,
  slug: 'v24-configure-your-clinic',
  title: 'Configure your clinic',
  thumbHeadline: 'Clinic setup',
  moduleLabel: 'Settings ▸ Practice',
  audience: 'Admin',
  intro: 'The settings everything else inherits — identity, hours, and the rules scheduling follows.',
  journey: 'Clinic Settings → Working Hours → Appointment Settings',
  youtubeTitle: 'AureonCare: Configure Your Clinic (Settings, Hours, Appointment Rules)',
  description:
    'Clinic configuration in AureonCare. Sets clinic identity, address, tax ID, NPI and currency; '
    + 'then working hours per day; then the appointment rules — default duration, slot interval, '
    + 'how far ahead patients can book and the cancellation deadline. These three screens sit '
    + 'upstream of everything the calendar and the booking page do.\n\nPart of the AureonCare training series.',
  tags: [
    'AureonCare', 'clinic settings', 'practice setup', 'medical practice software',
    'clinic configuration', 'working hours', 'appointment settings', 'practice management software',
    'healthcare admin', 'clinic onboarding',
  ],
  recap: [
    'Clinic identity feeds invoices, claims and the public booking page',
    'Working hours are the outer boundary — nothing books outside them',
    'Slot interval and booking window are what shape the calendar',
  ],

  async run(d, page) {
    // Each Save on these screens raises a confirm dialog; the recording has to
    // answer it or the next step waits on a covered page.
    const confirmSave = async () => {
      const modal = page.locator('div.fixed.inset-0').filter({ hasText: /Are you sure you want to save/i }).last();
      const ok = modal.getByRole('button', { name: /^Save$/i }).first();
      if (await d.exists(ok, 4000)) await d.click(ok, { pause: 2000 });
    };

    d.chapter('Who the clinic is');
    await d.step('Step 1 — Clinic Settings');
    await d.nav('Settings', 'Clinic Settings');
    await d.say(
      'Settings ▸ <b>Clinic Settings</b> is the clinic&rsquo;s identity — and almost every other screen reads from it.',
      4400
    );
    await d.say(
      'The name, address and phone print on invoices and statements, and show on the public booking page.',
      4200
    );

    await d.step('Step 2 — Tax ID, NPI and currency');
    const tax = page.getByPlaceholder('12-3456789').first();
    if (await d.exists(tax, 4000)) await d.type(tax, '84-2019773', { delay: 60 });
    const npi = page.getByPlaceholder('1234567890').first();
    if (await d.exists(npi, 3000)) await d.type(npi, '1770558492', { delay: 45 });
    await d.say(
      '<b>Tax ID</b> and <b>NPI</b> are what claims are submitted under — a claim with the wrong NPI comes straight back.',
      4600
    );
    const currency = page.locator('select').first();
    if (await d.exists(currency, 3000)) {
      await d.select(currency, 'USD').catch(() => {});
    }
    await d.say(
      '<b>Currency</b> is set once here and every price, quote and invoice in the system follows it.',
      4000
    );
    const save = page.getByRole('button', { name: /Save Settings/i }).first();
    if (await d.exists(save, 3000)) {
      await d.click(save, { pause: 1400 });
      await confirmSave();
    }

    d.chapter('When the clinic is open');
    await d.step('Step 3 — Working Hours');
    await d.nav('Settings', 'Working Hours');
    await d.say(
      '<b>Working Hours</b> is the outer boundary of the whole calendar: nothing can be booked outside it.',
      4400
    );
    await d.say(
      'Each day has its own open and close, and its own switch — late clinic on Thursday, half day Saturday, closed Sunday.',
      4800
    );
    const sunday = page.getByText(/^Sunday$/).first();
    if (await d.exists(sunday, 3000)) await d.click(sunday, { pause: 1400 });
    await d.say(
      'A day switched off is greyed out. Providers can still be given narrower hours of their own inside this.',
      4400
    );
    const saveHours = page.getByRole('button', { name: /Save Working Hours/i }).first();
    if (await d.exists(saveHours, 3000)) {
      await d.click(saveHours, { pause: 1400 });
      await confirmSave();
    }

    d.chapter('How appointments behave');
    await d.step('Step 4 — Appointment Settings');
    await d.nav('Settings', 'Appointment Settings');
    await d.say(
      '<b>Appointment Settings</b> is where the calendar gets its shape.',
      3400
    );
    await d.say(
      '<b>Default duration</b> is the length a new appointment starts at. <b>Slot interval</b> is the grid the day is cut into.',
      4800
    );
    const advance = page.locator('input[type="number"]').nth(2);
    if (await d.exists(advance, 4000)) {
      await d.fill(advance, '45');
      await d.say(
        '<b>Maximum advance booking</b> caps how far ahead a patient can book — set it to the horizon you can actually staff.',
        4800
      );
    }
    await d.say(
      'And the <b>cancellation deadline</b> is the cut-off the patient sees when they try to cancel late.',
      4400
    );
    const saveAppt = page.getByRole('button', { name: /^Save/i }).first();
    if (await d.exists(saveAppt, 3000)) {
      await d.click(saveAppt, { pause: 1400 });
      await confirmSave();
    }
    await d.say(
      'Three screens, ten minutes — and the calendar, the booking page and the claims all behave.',
      4200
    );
    await d.step('');
  },
};
