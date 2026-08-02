/**
 * V15 — Record a diagnosis.
 * Diagnosis quality drives claim acceptance.
 */

module.exports = {
  id: 'V15',
  wave: 2,
  slug: 'v15-record-a-diagnosis',
  title: 'Record a diagnosis',
  thumbHeadline: 'Record a diagnosis',
  moduleLabel: 'Patients ▸ Diagnoses',
  audience: 'Clinician',
  intro: 'Code it properly once, and the claim, the chart and the portal all agree.',
  journey: 'Patients ▸ Diagnoses → New Diagnosis → name, ICD-10 search, severity, status → save',
  youtubeTitle: 'AureonCare: Record a Diagnosis and Code It Correctly',
  description:
    'Recording a diagnosis in AureonCare. Covers the diagnoses list and its filters, '
    + 'searching ICD-10 rather than typing codes from memory, what active, chronic and '
    + 'resolved each mean, severity, and how the coded diagnosis flows onto claims and into '
    + 'the patient portal.\n\n'
    + 'Part of the AureonCare Getting Started series.',
  tags: [
    'AureonCare', 'ICD-10 coding', 'medical diagnosis', 'clinical documentation',
    'EHR charting', 'diagnosis coding', 'electronic health records',
    'practice management software', 'clinician training', 'medical coding tutorial',
  ],
  recap: [
    'Patients ▸ Diagnoses ▸ New Diagnosis, coded from the ICD-10 search',
    'Active, chronic and resolved are clinical facts — keep them current',
    'The coded diagnosis is what justifies the claim and what the patient sees',
  ],

  async run(d, page) {
    d.chapter('The diagnoses list');
    await d.step('Step 1 — The list');
    await d.nav('Patients', 'Diagnoses');
    await d.say(
      'Patients ▸ <b>Diagnoses</b> is every coded problem across the practice, not just one chart.',
      4000
    );
    await d.say(
      'Filter by patient or by status to answer the questions that actually come up — who is active, what is chronic, what resolved.',
      4600
    );

    d.chapter('Adding one');
    await d.step('Step 2 — New Diagnosis');
    await d.click(page.getByRole('button', { name: 'New Diagnosis' }), { pause: 2400 });

    const form = page.locator('form').last();
    // Pick the dropdown that actually lists patients rather than trusting
    // position — the form also carries severity and status selects.
    // The page also has an "All Patients" filter listing the same names, so
    // match the form's own control by its placeholder option instead.
    const patient = page.locator('select').filter({ hasText: 'Select a patient' }).first();
    if (await d.exists(patient, 6000)) {
      const options = await patient.locator('option').allTextContents();
      const sarah = options.find((o) => /Sarah/i.test(o));
      if (sarah) await d.select(patient, { label: sarah });
      await d.say('Choose the patient this diagnosis belongs to.', 2800);
    }

    const name = form.locator('input[placeholder*="Essential Hypertension"]').first();
    await d.type(name, 'Type 2 Diabetes Mellitus', { delay: 34 });
    await d.say('Give it the name a clinician would say out loud.', 3000);

    d.chapter('Coding it');
    await d.step('Step 3 — Find the ICD-10 code');
    const icd = form.locator('input[placeholder*="ICD"]').first();
    await d.type(icd, 'E11', { delay: 130 });
    await page.waitForTimeout(1200);
    await d.say(
      'Now the part that matters: <b>search</b> the ICD-10 code. Typing one from memory is how claims get denied.',
      4600
    );
    await d.maybeClick(page.getByText(/E11\.9/).first(), { pause: 1600 });
    await d.say(
      'Picking from the list guarantees the code and its description agree — payers check exactly that.',
      4400
    );

    d.chapter('Status and severity');
    await d.step('Step 4 — Describe it properly');
    const severity = form.locator('select').filter({ hasText: 'Severe' }).first();
    if (await d.exists(severity)) {
      await d.select(severity, { label: 'Moderate' });
      await d.say('Severity is clinical judgement, and it travels with the diagnosis.', 3400);
    }

    const status = form.locator('select').filter({ hasText: 'Chronic' }).last();
    if (await d.exists(status)) {
      await d.select(status, { label: 'Chronic' });
      await d.say(
        '<b>Active</b> is happening now. <b>Chronic</b> is ongoing and managed. <b>Resolved</b> is over — and marking it so is what keeps the problem list honest.',
        5200
      );
    }

    await d.scrollBy(260);
    const notes = form.locator('textarea').first();
    if (await d.exists(notes)) {
      await d.type(
        notes,
        'A1c 8.2 percent on last panel. Continuing metformin, dietary review scheduled.',
        { delay: 24 }
      );
    }

    await d.step('Step 5 — Save');
    await d.maybeClick(page.getByRole('button', { name: /Save|Create|Add Diagnosis/ }).last(), { pause: 3000 });
    await d.say(
      'Saved once, used everywhere — it justifies the claim, sits on the chart, and appears in the patient&rsquo;s portal.',
      4800
    );
    await d.step('');
  },
};
