/**
 * M3 — Chart it before the next patient sits down.
 *
 * The physician cut. Its claim is that documenting a visit and ordering a panel
 * happen in one patient record rather than in two systems, and the on-screen
 * timer is what makes that claim checkable: the clock runs from the moment the
 * chart opens until the order is placed, with nothing edited out.
 *
 * The timer is the reason this script never cuts away. Every navigation the
 * viewer does not see is time the clock would not have counted.
 */

module.exports = {
  id: 'M3',
  slug: 'm03-chart-it-and-go',
  marketing: true,
  pace: 0.5,
  title: 'Chart it before the next patient sits down',
  thumbHeadline: 'Note, then labs',
  thumbSub: 'One record. Clock on screen.',
  moduleLabel: 'Patients ▸ Patient History',
  audience: 'Physicians, clinical leads',
  intro: 'The note and the lab order are two tabs of one record.',
  journey: 'Open the chart → record findings → order a panel',
  youtubeTitle: 'Document a visit and order a panel — one record, clock on screen | AureonCare',
  description:
    'A clinician documents a visit and orders a lab panel without leaving the patient record. The '
    + 'elapsed-time clock runs on screen for the whole clip — nothing is cut away, and no step '
    + 'happens off camera.\n\n'
    + 'Diagnoses, prescriptions and lab orders are tabs of the same chart, so an order placed here '
    + 'files its result back to the same record.',
  tags: [
    'AureonCare', 'EHR software', 'electronic health records', 'lab orders',
    'clinical documentation', 'physician workflow', 'charting software',
    'reduce documentation burden', 'medical software demo',
  ],
  recap: [
    'The note and the order live in one record',
    'An order placed from the chart files its result back to the chart',
    'The clock runs the whole time — nothing is edited out',
  ],

  async run(d, page) {
    d.chapter('The chart');
    await d.card({
      heading: 'Chart it before the next patient sits down.',
      body: 'Clock on screen. Nothing cut out.',
      holdMs: 2800,
      logo: false,
    });

    await d.step('The chart');
    await d.nav('Patients', 'Patient History');
    await d.click(page.getByRole('button', { name: /Sarah Williams/ }).first(), { pause: 1400 });

    // Started once the chart is open, because that is when the clinician's own
    // clock starts. Everything after this point is on camera.
    await d.timer('start');
    await d.say('One record. The note and the order are tabs of it.', 2400);

    d.chapter('The note');
    await d.step('The note');
    await d.click(page.getByRole('button', { name: /Edit Patient Chart/ }).first(), { pause: 1200 });
    const physical = page.getByRole('button', { name: /^Physical$/ });
    if (await d.exists(physical)) {
      await d.click(physical, { pause: 1000 });
      const numbers = page.locator('input[type="number"]:visible');
      const fields = await numbers.count();
      for (let i = 0; i < Math.min(fields, 2); i += 1) {
        await d.type(numbers.nth(i), ['78', '165'][i], { delay: 55, pause: 160 });
      }
      await d.say('Findings go in once.', 1800);
    }
    await d.click(page.getByRole('button', { name: /^Save Changes$/ }).last(), { pause: 1400 });
    await d.maybeClick(page.getByRole('button', { name: /^(OK|Save Changes)$/ }).last(), { pause: 1200 });

    // The prescription beat is deliberately absent. Composing a script from this
    // chart works — search, select, dose, frequency, duration — but "Add to
    // Prescription" clears the form without adding anything, so there is no way
    // to send it. Filming that would mean narrating a prescription the product
    // never actually issues. The beat goes back in when the defect is fixed.

    d.chapter('The order');
    await d.step('The order');
    await d.click(page.getByRole('button', { name: /^Lab Orders/ }).first(), { pause: 1200 });
    await d.say('Same record. No new system.', 1800);
    await d.click(page.getByRole('button', { name: /New Lab Order/i }).first(), { pause: 1400 });

    const tests = page.locator('input[placeholder*="lab test CPT"]').first();
    if (!(await d.exists(tests, 8000))) {
      throw new Error('lab order form did not open — the order beat would play over the wrong screen');
    }
    await d.type(tests, '83036', { delay: 90 });
    await page.waitForTimeout(1400);
    // The row splits the code, the "Lab CPT" badge and the test name into
    // separate elements, so match the name alone and let the click bubble.
    await d.click(page.getByText(/^Hemoglobin A1c$/).first(), { pause: 1000 });
    await d.say('Ordered by code, so the lab and the claim describe the same test.', 2800);

    // Laboratory and Result Recipients are both required. The order cannot be
    // placed without them, and an order that never gets placed is the one thing
    // this beat must not show.
    await d.select(d.field('Laboratory', 'select'), { label: 'Labcorp - Portland Central' });
    await d.click(page.locator('input[placeholder*="receive the lab results"]').first(), { pause: 900 });
    await d.click(page.getByText(/Alex Rivera/).last(), { pause: 900 });
    await d.say('And who gets the result when it lands.', 2200);

    await d.scrollBy(300);
    await d.click(page.getByRole('button', { name: /^Create Order$/ }).last(), { pause: 1200 });
    const orderDialog = page.locator('div.fixed.inset-0').last();
    await orderDialog.waitFor({ timeout: 15000 }).catch(() => {});
    await d.click(orderDialog.getByRole('button', { name: /^Create$/ }), { pause: 1600 });
    await d.maybeClick(page.getByRole('button', { name: /^OK$/ }).last(), { pause: 1200 });
    await d.say('The result files itself back to this chart. Nobody scans anything.', 2800);

    await d.timer('stop');
    await d.card({
      heading: 'One record. One pass.',
      body: 'Documented and ordered — without leaving the chart.',
      holdMs: 3800,
      keep: true,
    });
  },
};
