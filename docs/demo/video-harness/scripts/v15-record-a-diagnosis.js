/**
 * V15 — Record a diagnosis.
 *
 * Recorded against the current UI, which moved on twice since the plan was
 * written: Diagnoses now lives under Clinical rather than Patients, and the
 * standalone form carries its own patient picker and opens above the list.
 * Both changes are called out on screen, because a viewer who learned the old
 * layout needs to be told where it went.
 */

module.exports = {
  id: 'V15',
  slug: 'v15-record-a-diagnosis',
  wave: 2,
  title: 'Record a diagnosis',
  thumbHeadline: 'Record a diagnosis',
  moduleLabel: 'Clinical ▸ Diagnoses',
  audience: 'Clinician',
  intro: 'Code a problem properly, so the claim behind it is accepted first time.',
  journey: 'Clinical ▸ Diagnoses → New Diagnosis → patient → ICD-10 search → severity, status, onset → notes → save',
  youtubeTitle: 'AureonCare: Record a Diagnosis (ICD-10 Coding)',
  description:
    'Recording a diagnosis in AureonCare. Covers where the problem list lives, the patient '
    + 'picker on the standalone form, searching ICD-10 codes rather than typing them from '
    + 'memory, what active, resolved and chronic mean, and how the coded diagnosis flows onto '
    + 'claims and into the patient portal.\n\n'
    + 'Part of the AureonCare training series.',
  tags: [
    'AureonCare', 'ICD-10 coding', 'medical diagnosis software', 'problem list',
    'clinical documentation', 'EHR diagnosis', 'medical coding tutorial',
    'practice management software', 'healthcare software training', 'diagnosis coding',
  ],
  recap: [
    'Clinical ▸ Diagnoses — moved out of Patients, same problem list',
    'Codes are searched, never typed from memory; the name alone will not bill',
    'Active, resolved or chronic is what the next clinician reads first',
  ],

  async run(d, page) {
    d.chapter('Where the problem list lives');
    await d.step('Step 1 — Open Diagnoses');
    await d.nav('Clinical', 'Diagnoses');
    await d.say(
      'Diagnoses now sits under <b>Clinical</b>, not Patients — it is coding work, so it lives beside the other clinical modules.',
      4200
    );
    await d.say(
      'This is the practice-wide problem list, filtered by patient or by status.',
      3000
    );

    d.chapter('Opening the form');
    await d.step('Step 2 — New Diagnosis');
    await d.click(page.getByRole('button', { name: 'New Diagnosis' }).first(), { pause: 2000 });
    await d.say(
      'The form opens <b>above</b> the list and pushes it down, so nothing you were reading is hidden behind it.',
      3800
    );

    // Locate each dropdown by an option only it carries: the page also holds
    // the two list filters, and their order is not something to rely on.
    const selectWithOption = (text) => page.locator('select')
      .filter({ has: page.locator(`option:text-is("${text}")`) }).last();
    const patientPicker = selectWithOption('Select a patient...');
    if (await d.exists(patientPicker)) {
      await d.say(
        'Opened from here there is no patient in context, so the form asks for one — with the MRN alongside, to separate namesakes.',
        4200
      );
      await d.select(patientPicker, { label: 'Jordan Ellis - MRN: MRN-2025-014' }, { pause: 1600 });
    }

    d.chapter('Coding it');
    await d.step('Step 3 — Name and code');
    const name = page.locator('input[placeholder*="Essential Hypertension"]').first();
    if (await d.exists(name)) {
      await d.type(name, 'Acute upper respiratory infection', { delay: 35 });
    }
    await d.say('The plain-English name is what your colleagues read. It is not what pays.', 3200);

    const icd = page.locator('input[placeholder*="ICD codes"]').first();
    await d.type(icd, 'J06', { delay: 150 });
    await page.waitForTimeout(1400);
    await d.say(
      '<b>ICD-10 codes are searched, not remembered</b> — type the code or the words and take it from the list.',
      4000
    );
    const hit = page.getByText(/J06\.9/).first();
    if (await d.exists(hit)) {
      await d.click(hit, { pause: 1600 });
      await d.say('Picked from the database, the code is current and it exists.', 2800);
    }

    d.chapter('Severity, status and onset');
    await d.step('Step 4 — The clinical detail');
    await d.scrollBy(260);
    const severity = selectWithOption('Severe');
    if (await d.exists(severity)) {
      await d.select(severity, { label: 'Moderate' }, { pause: 1200 });
    }
    // The status filter above the list offers the same words, so match the one
    // that has no "All Statuses" entry.
    const status = page.locator('select')
      .filter({ has: page.locator('option:text-is("Resolved")') })
      .filter({ hasNot: page.locator('option:text-is("All Statuses")') })
      .last();
    if (await d.exists(status)) {
      await d.select(status, { label: 'Active' }, { pause: 1200 });
    }
    await d.say(
      '<b>Active, resolved or chronic</b> is the line the next clinician reads first — and the one that goes stale if nobody updates it.',
      4400
    );

    const notes = page.locator('textarea[placeholder*="Subjective"]').first();
    if (await d.exists(notes)) {
      await d.type(notes, 'Subjective: three days of sore throat and cough. Objective: temp 37.4, chest clear.', { delay: 14 });
      await d.say('The note travels with the diagnosis, so the reasoning is attached to the code.', 3000);
    }

    d.chapter('Saving, and where it goes');
    await d.step('Step 5 — Save');
    await d.scrollBy(320);
    const save = page.getByRole('button', { name: /^Save Diagnosis$/ }).first();
    await d.click(save, { pause: 1600 });
    const confirm = page.locator('div.fixed.inset-0')
      .filter({ hasText: 'Create Diagnosis' }).last();
    if (await d.exists(confirm)) {
      await d.click(confirm.getByRole('button', { name: /^Create$/ }), { pause: 2800 });
    }
    await d.say('Saved to the problem list, and to that patient’s chart.', 3000);
    await d.say(
      'From here the code carries: onto the claim, where the payer checks it against the procedure, and into the patient’s portal.',
      4400
    );
    await d.step('');
  },
};
