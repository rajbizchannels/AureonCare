/**
 * V14 — Order a lab and file the result.
 * The ordering loop closes in the chart, not in email.
 */

module.exports = {
  id: 'V14',
  wave: 2,
  slug: 'v14-order-a-lab-and-file-the-result',
  title: 'Order a lab and file the result',
  thumbHeadline: 'Order a lab',
  moduleLabel: 'Patients ▸ Patient History ▸ Lab Orders',
  audience: 'Clinician',
  intro: 'Order the panel, track it, and file the result where it belongs — the chart.',
  journey: 'Patient chart → Lab Orders → New Lab Order → tests, diagnosis, priority, lab → transmit → review the result',
  youtubeTitle: 'AureonCare: Order a Lab Test and File the Result',
  description:
    'Ordering laboratory tests and handling results in AureonCare. Covers the Lab Orders tab '
    + 'on the patient chart, building an order with the right CPT panels and the diagnosis '
    + 'that justifies them, routine versus STAT, transmitting to the laboratory, and '
    + 'reviewing an abnormal result so the loop closes in the chart rather than in somebody’s '
    + 'inbox.\n\n'
    + 'Part of the AureonCare Getting Started series.',
  tags: [
    'AureonCare', 'lab orders', 'laboratory results', 'clinical workflow',
    'lab integration', 'electronic health records', 'clinician training',
    'practice management software', 'LabCorp Quest', 'result management',
  ],
  recap: [
    'Order from the chart, so the result files itself back to the same place',
    'The diagnosis on the order is what makes the test payable',
    'Abnormal results need review and a patient conversation — not just filing',
  ],

  async run(d, page) {
    d.chapter('Ordering from the chart');
    await d.step('Step 1 — Open the chart');
    await d.nav('Patients', 'Patient History');
    await d.click(page.getByRole('button', { name: /Sarah Williams/ }).first(), { pause: 2600 });
    await d.say(
      'Lab orders belong on the <b>chart</b>. Order from here and the result comes back to the same record automatically.',
      4600
    );

    await d.step('Step 2 — Lab Orders');
    const tab = page.getByRole('button', { name: /^Lab Orders/ }).first();
    if (await d.exists(tab)) {
      await d.click(tab, { pause: 2400 });
      await d.say(
        'The <b>Lab Orders</b> tab is every panel ordered for this patient and where each one has got to.',
        4200
      );
      await d.say(
        'Status is the whole story — <b>ordered</b>, <b>transmitted</b> to the lab, then <b>resulted</b> and waiting for you.',
        4600
      );
    }

    d.chapter('Building the order');
    await d.step('Step 3 — New Lab Order');
    await d.maybeClick(page.getByRole('button', { name: /New Lab Order/ }).first(), { pause: 2600 });

    const tests = page.locator('input[placeholder*="lab test CPT"]').first();
    if (await d.exists(tests, 6000)) {
      await d.type(tests, '83036', { delay: 120 });
      await page.waitForTimeout(1200);
      await d.say(
        'Tests are picked by <b>CPT code</b> from the catalogue, so the lab and the claim describe the same thing.',
        4600
      );
      await d.maybeClick(page.getByText(/Hemoglobin A1c|83036/i).first(), { pause: 1600 });
    }

    await d.step('Step 4 — Justify and prioritise');
    await d.say(
      'Attach the <b>diagnosis</b>. A panel with no clinical indication is a panel the payer will not cover.',
      4600
    );

    const priority = page.locator('select').filter({ hasText: 'Routine' }).first();
    if (await d.exists(priority)) {
      await d.say(
        '<b>Routine</b> comes back in a day or two. <b>STAT</b> means now, and it costs more — use it when it changes what you do today.',
        5000
      );
    }

    await d.scrollBy(280);
    const indication = page.locator('textarea[placeholder*="Clinical indication"]').first();
    if (await d.exists(indication)) {
      await d.type(indication, 'Diabetes monitoring, quarterly A1c and lipid review.', { delay: 24 });
    }
    const instructions = page.locator('input[placeholder*="Fasting"], textarea[placeholder*="Fasting"]').first();
    if (await d.exists(instructions)) {
      await d.type(instructions, 'Fasting required, collect in morning', { delay: 26 });
      await d.say('Collection instructions save the patient a wasted trip.', 3400);
    }

    await d.step('Step 5 — Transmit');
    await d.maybeClick(page.getByRole('button', { name: /Create|Save|Submit|Order/ }).last(), { pause: 3000 });
    await d.say('Sent to the laboratory electronically, with an order number to track it by.', 4000);

    d.chapter('Filing the result');
    await d.step('Step 6 — Review what comes back');
    await d.say(
      'When the result returns it lands on this tab as <b>resulted</b>, with abnormal values flagged.',
      4400
    );
    await d.say(
      'Sarah&rsquo;s A1c came back at <b>8.2 percent</b> against a range topping out at 5.6 — flagged, and worth a conversation.',
      4800
    );
    await d.say(
      'Review it, file it to the chart, and tell the patient. A result nobody acted on is the most expensive kind.',
      4800
    );
    await d.step('');
  },
};
