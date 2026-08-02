/**
 * V13 — Prescribe and send electronically.
 * The safety checks are the point; don't click past them.
 */

module.exports = {
  id: 'V13',
  wave: 2,
  slug: 'v13-prescribe-and-send-electronically',
  title: 'Prescribe and send electronically',
  thumbHeadline: 'Prescribe safely',
  moduleLabel: 'Patients ▸ Diagnoses ▸ e-Prescribe',
  audience: 'Clinician',
  intro: 'Write a prescription, respect the safety checks, send it to the pharmacy.',
  journey: 'Diagnosis → add a prescription → drug, dose, frequency, refills → allergy and interaction check → pharmacy → send',
  youtubeTitle: 'AureonCare: Prescribe and Send Electronically (e-Prescribing)',
  description:
    'Electronic prescribing in AureonCare. Covers writing a prescription against the '
    + 'diagnosis that justifies it, the dose, frequency, quantity and refill fields and what '
    + 'each one controls, the allergy and interaction checks that fire before you can send, '
    + 'choosing the patient’s pharmacy, and where the prescription shows up afterwards.\n\n'
    + 'Part of the AureonCare Getting Started series.',
  tags: [
    'AureonCare', 'e-prescribing', 'eprescribe', 'electronic prescription',
    'drug interaction check', 'medication safety', 'clinician training',
    'electronic health records', 'practice management software', 'pharmacy integration',
  ],
  recap: [
    'Prescribe from the diagnosis, so the medication has a documented reason',
    'Allergy and interaction warnings are the feature — read them, do not dismiss them',
    'Pick the patient&rsquo;s pharmacy and send; it lands in their portal too',
  ],

  async run(d, page) {
    d.chapter('Prescribing in context');
    await d.step('Step 1 — Start from the diagnosis');
    await d.nav('Patients', 'Diagnoses');
    await d.say(
      'Prescribing starts from the <b>diagnosis</b>, not from a blank drug field — the medication should always have a documented reason.',
      4800
    );
    await d.click(page.getByRole('button', { name: 'New Diagnosis' }), { pause: 2400 });

    const form = page.locator('form').last();
    const patient = form.locator('select').filter({ hasText: /Sarah Williams/ }).first();
    if (await d.exists(patient, 6000)) {
      const options = await patient.locator('option').allTextContents();
      const sarah = options.find((o) => /Sarah/i.test(o));
      if (sarah) await d.select(patient, { label: sarah });
    }
    const name = form.locator('input[placeholder*="Essential Hypertension"]').first();
    if (await d.exists(name)) await d.type(name, 'Type 2 Diabetes Mellitus', { delay: 30 });
    const icd = form.locator('input[placeholder*="ICD"]').first();
    if (await d.exists(icd)) {
      await d.type(icd, 'E11', { delay: 120 });
      await page.waitForTimeout(1100);
      await d.maybeClick(page.getByText(/E11\.9/).first(), { pause: 1400 });
    }
    await d.say('Diagnosis coded. Now the treatment that follows from it.', 3200);

    d.chapter('Writing the prescription');
    await d.step('Step 2 — Add a prescription');
    await d.scrollBy(300);
    await d.click(page.getByTitle('Add a new prescription').first(), { pause: 2600 });

    const drug = page.locator('input[placeholder*="medication name"]').first();
    // Hard failure rather than a silent skip: this video narrates the allergy
    // and interaction checks, so a run where the modal never opened would be
    // describing a screen the viewer cannot see.
    if (!(await d.exists(drug, 8000))) {
      throw new Error('e-Prescribe modal did not open — the prescribing steps would be narrated over the wrong screen');
    }
    {
      await d.type(drug, 'Metformin', { delay: 120 });
      await page.waitForTimeout(1400);
      await d.say(
        'Medications are searched, not free-typed — that is what keeps the name, strength and form unambiguous.',
        4400
      );
      await d.maybeClick(page.getByText(/Metformin/i).nth(1), { pause: 1600 });
    }

    await d.step('Step 3 — Dose and duration');
    const dosage = page.locator('input[placeholder*="500mg"]').first();
    if (await d.exists(dosage)) await d.type(dosage, '500mg', { delay: 90 });

    const freq = page.locator('select').filter({ hasText: 'Select frequency' }).first();
    if (await d.exists(freq)) {
      await d.select(freq, { label: 'Twice daily (BID)' });
      await d.say('Dose and frequency are what the pharmacy dispenses against. Be exact.', 3800);
    }

    const duration = page.locator('input[placeholder*="30 days"]').first();
    if (await d.exists(duration)) await d.type(duration, '90 days', { delay: 80 });

    const qty = page.locator('input[placeholder="30"]').first();
    if (await d.exists(qty)) await d.type(qty, '180', { delay: 80 });
    await d.say(
      'Quantity and refills together decide how long the patient goes before they need you again.',
      4200
    );

    d.chapter('The safety checks');
    await d.step('Step 4 — Read the warnings');
    await d.say(
      'Before this can be sent, AureonCare checks the drug against the patient&rsquo;s <b>allergies</b> and their <b>current medications</b>.',
      4800
    );
    await d.say(
      'These warnings are the whole point of prescribing inside the record instead of on a pad. Read them — do not click past them.',
      5000
    );

    const instructions = page.locator('input[placeholder*="Take with food"], textarea[placeholder*="Take with food"]').first();
    if (await d.exists(instructions)) {
      await d.type(instructions, 'Take with food. Report persistent nausea.', { delay: 26 });
      await d.say('Patient instructions print on the label — write them for the patient, not for the chart.', 4200);
    }

    d.chapter('Sending it');
    await d.step('Step 5 — Pharmacy and send');
    await d.scrollBy(260);
    const pharmacy = page.locator('select').last();
    if (await d.exists(pharmacy)) {
      const options = await pharmacy.locator('option').allTextContents();
      const northside = options.find((o) => /Northside/i.test(o));
      if (northside) {
        await d.select(pharmacy, { label: northside });
        await d.say(
          'Choose the pharmacy the patient actually uses — their preferred one is listed first.',
          4000
        );
      }
    }
    await d.maybeClick(page.getByRole('button', { name: /Send|Prescribe|Save/ }).last(), { pause: 3000 });
    await d.say(
      'Sent electronically. It is on the chart, in the patient&rsquo;s portal, and at the pharmacy before they have left the building.',
      5000
    );
    await d.step('');
  },
};
