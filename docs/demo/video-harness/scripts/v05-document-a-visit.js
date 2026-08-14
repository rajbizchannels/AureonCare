/**
 * V05 — Document a visit.
 * The chart is the single source of truth, and the patient sees what you save.
 */

module.exports = {
  id: 'V05',
  slug: 'v05-document-a-visit',
  title: 'Document a visit',
  thumbHeadline: 'Document a visit',
  moduleLabel: 'Patients ▸ Patient History',
  audience: 'Clinician',
  intro: 'Read the chart, record what you found, and know what the patient will see.',
  journey: 'Patient History → chart timeline → diagnoses and records → edit chart → measurements and history → save',
  youtubeTitle: 'AureonCare: Document a Patient Visit (Clinician Guide)',
  description:
    'Documenting a visit in AureonCare. Covers the longitudinal chart timeline, the diagnoses and '
    + 'records tabs, recording physical measurements and medical history, and what becomes visible '
    + 'in the patient portal once you save.\n\n'
    + 'Part of the AureonCare Getting Started series.',
  tags: [
    'AureonCare', 'clinical documentation', 'EHR charting', 'patient chart tutorial',
    'medical records software', 'vitals documentation', 'clinician training',
    'electronic health records', 'practice management software', 'SOAP note software',
  ],
  recap: [
    'Patients ▸ Patient History opens the whole chart, not just today',
    'Diagnoses, records, prescriptions and labs are tabs on one timeline',
    'Anything you save here is what the patient sees in their portal',
  ],

  async run(d, page) {
    d.chapter('Opening the chart');
    await d.step('Step 1 — Find the patient');
    await d.nav('Patients', 'Patient History');
    await d.say(
      'Patients ▸ <b>Patient History</b> is the longitudinal chart — every visit, not just today’s.',
      3400
    );
    await d.click(page.getByRole('button', { name: /Sarah Williams/ }).first(), { pause: 2600 });
    await d.say('Opening a patient gives you the whole record on one set of tabs.', 3000);

    d.chapter('Reading before you write');
    await d.step('Step 2 — Read the chart');
    await d.scrollBy(300);
    await d.say(
      'The <b>Patient Chart</b> tab carries demographics, medical history and allergies — read the allergies first, always.',
      4000
    );
    await d.scrollBy(-300);

    // The module nav also has a "Diagnoses" entry; the chart tab carries a count,
    // so match that rather than navigating away from the patient.
    const diagnosesTab = page.getByRole('button', { name: /^Diagnoses \d+$/ }).first();
    if (await d.exists(diagnosesTab)) {
      await d.click(diagnosesTab, { pause: 2200 });
      await d.say('<b>Diagnoses</b> is the active problem list — what this patient is being treated for.', 3400);
    }

    const recordsTab = page.getByRole('button', { name: /^Records \d+$/ }).first();
    if (await d.exists(recordsTab)) {
      await d.click(recordsTab, { pause: 2200 });
      await d.say('<b>Records</b> holds the notes from previous visits, newest first.', 3200);
    }

    d.chapter('Recording what you found');
    await d.step('Step 3 — Record the visit');
    const chartTab = page.getByRole('button', { name: /^Patient Chart$/ }).first();
    if (await d.exists(chartTab)) await d.click(chartTab, { pause: 1600 });

    await d.click(page.getByRole('button', { name: /Edit Patient Chart/ }).first(), { pause: 2000 });
    await d.say('<b>Edit Patient Chart</b> is where today’s findings go, grouped into tabs.', 3000);

    const physical = page.getByRole('button', { name: /^Physical$/ });
    if (await d.exists(physical)) {
      await d.click(physical, { pause: 1800 });
      await d.say('<b>Physical</b> takes the measurements you just did — they chart over time automatically.', 3600);
      const numbers = page.locator('input[type="number"]:visible');
      const fields = await numbers.count();
      for (let i = 0; i < Math.min(fields, 3); i += 1) {
        await d.type(numbers.nth(i), ['78', '165', '72'][i], { delay: 90, pause: 250 });
      }
    }

    const history = page.getByRole('button', { name: /^Medical History$/ });
    if (await d.exists(history)) {
      await d.click(history, { pause: 1800 });
      await d.say(
        'Allergies and history live here. What you add is what every other clinician sees at the next visit.',
        3800
      );
    }

    d.chapter('Saving, and what the patient sees');
    await d.step('Step 4 — Save');
    const save = page.getByRole('button', { name: /^Save Changes$/ }).first();
    if (await d.exists(save)) {
      await d.click(save, { pause: 3000 });
    }
    await d.say('Saved to the chart — one record, visible to the whole care team immediately.', 3400);
    await d.say(
      'And to the patient: records, diagnoses and prescriptions appear in their portal, so write for both readers.',
      4200
    );
    await d.step('');
  },
};
