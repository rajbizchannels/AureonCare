/**
 * M3 — Chart it before the next patient sits down.
 *
 * The physician cut. Its claim is that the note, the prescription and the lab
 * order are three tabs of one patient record rather than three systems, and the
 * on-screen timer is what makes that claim checkable: the clock runs from the
 * moment the chart opens until the order is placed, with nothing edited out.
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
  thumbHeadline: 'Note, script, labs',
  thumbSub: 'One record. Clock on screen.',
  moduleLabel: 'Patients ▸ Patient History',
  audience: 'Physicians, clinical leads',
  intro: 'The note, the prescription and the lab order are three tabs of one record.',
  journey: 'Open the chart → record findings → prescribe → order a panel',
  youtubeTitle: 'Note, prescription, lab order — one record, clock on screen | AureonCare',
  description:
    'A clinician documents a visit, writes a prescription and orders a lab panel without leaving '
    + 'the patient record. The elapsed-time clock runs on screen for the whole clip — nothing is '
    + 'cut away, and no step happens off camera.\n\n'
    + 'Diagnoses, prescriptions and lab orders are tabs of the same chart, so an order placed here '
    + 'files its result back to the same record.',
  tags: [
    'AureonCare', 'EHR software', 'electronic health records', 'e-prescribing',
    'lab orders', 'clinical documentation', 'physician workflow', 'charting software',
    'reduce documentation burden', 'medical software demo',
  ],
  recap: [
    'The note, the script and the order live in one record',
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
    await d.say('One record. The note, the script and the order are tabs of it.', 2800);

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

    d.chapter('The prescription');
    await d.step('The prescription');
    await d.click(page.getByRole('button', { name: /^Prescriptions/ }).first(), { pause: 1200 });
    await d.say('Same record. No new system.', 1800);
    await d.click(page.getByRole('button', { name: /New ePrescription/i }).first(), { pause: 1400 });

    const drug = page.locator('input[placeholder*="medication name"]').first();
    if (!(await d.exists(drug, 8000))) {
      throw new Error('e-prescribe form did not open — the prescription beat would play over the wrong screen');
    }
    await d.type(drug, 'Metformin', { delay: 80 });
    await page.waitForTimeout(1200);
    // Results are clickable divs titled by generic name, not buttons.
    await d.click(page.getByText(/^Metformin hydrochloride$/).first(), { pause: 1000 });
    await d.say('Medications are searched, not typed.', 2200);

    // Dosage auto-fills from the medication's strength; frequency and duration
    // are both required before the medication can be added.
    const freq = page.locator('select').filter({ hasText: 'Select frequency' }).first();
    if (await d.exists(freq)) await d.select(freq, { label: 'Twice daily (BID)' });
    const duration = page.locator('input[placeholder*="30 days"]').first();
    if (await d.exists(duration)) await d.type(duration, '30 days', { delay: 70 });

    await d.click(page.getByRole('button', { name: /^Add to Prescription$/ }), { pause: 1000 });
    // Adding clears the entry fields and reveals the summary below them.
    await d.scrollBy(320);
    const send = page.locator('button').filter({ hasText: /Prescription\(s\)/ }).last();
    await send.waitFor({ state: 'visible', timeout: 15000 });
    await d.click(send, { pause: 1800 });
    await d.say('Sent, and it lands on the chart.', 2400);

    d.chapter('The order');
    await d.step('The order');
    await d.click(page.getByRole('button', { name: /^Lab Orders/ }).first(), { pause: 1200 });
    await d.say('And the lab order, from the same place.', 2200);
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
      body: 'Note, prescription and order — without leaving the chart.',
      holdMs: 3800,
      keep: true,
    });
  },
};
