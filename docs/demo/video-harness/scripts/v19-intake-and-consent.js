/**
 * V19 — Collect intake and consent before arrival.
 */

module.exports = {
  id: 'V19',
  wave: 3,
  slug: 'v19-collect-intake-and-consent',
  title: 'Collect intake and consent before arrival',
  thumbHeadline: 'Intake before arrival',
  moduleLabel: 'Patients ▸ Patient Intake',
  audience: 'Front desk',
  intro: 'Get the paperwork done before the patient walks in, not in the waiting room.',
  journey: 'Intake forms → intake flows → consent forms → what each one is for',
  youtubeTitle: 'AureonCare: Collect Patient Intake and Consent Before the Visit',
  description:
    'Patient intake in AureonCare. Explains the difference between an intake form, an intake '
    + 'flow and a consent form, how packets are sent ahead of a visit, and how completed '
    + 'answers and signatures come back to the chart.\n\nPart of the AureonCare training series.',
  tags: [
    'AureonCare', 'patient intake', 'digital intake forms', 'patient consent',
    'HIPAA authorization', 'paperless clinic', 'practice management software',
    'patient onboarding', 'healthcare forms', 'front desk training',
  ],
  recap: [
    'Intake forms are single questionnaires; flows are packets of them',
    'Consent forms are signed and dated, and they expire',
    'Completed answers land on the chart — nothing is re-typed',
  ],

  async run(d, page) {
    d.chapter('Where intake lives');
    await d.step('Step 1 — Open Patient Intake');
    await d.nav('Patients', 'Patient Intake');
    await d.say(
      'Patients ▸ <b>Patient Intake</b> tracks the paperwork you asked for and whether it came back.',
      4000
    );
    await d.say(
      'The three tabs are three different things, and mixing them up is the usual confusion.',
      3600
    );

    d.chapter('Forms, flows and consents');
    await d.step('Step 2 — Intake forms');
    await d.say(
      '<b>Intake forms</b> are single questionnaires sent to one patient, each with its own status: sent, in progress, completed.',
      4600
    );

    const flows = page.getByRole('button', { name: /Intake Flows/i }).first();
    if (await d.exists(flows)) {
      await d.click(flows, { pause: 2400 });
      await d.say(
        '<b>Intake flows</b> are packets — several forms sent as one journey, so a new patient gets everything in a single link.',
        4800
      );
    }

    const consents = page.getByRole('button', { name: /Consent Forms/i }).first();
    if (await d.exists(consents)) {
      await d.click(consents, { pause: 2400 });
      await d.say(
        '<b>Consent forms</b> are the signed ones. They record who signed, when, and how — and they carry an expiry.',
        4800
      );
    }

    d.chapter('Why it saves the visit');
    await d.step('Step 3 — What it buys you');
    const back = page.getByRole('button', { name: /Intake Forms/i }).first();
    if (await d.exists(back)) await d.click(back, { pause: 1800 });
    await d.say(
      'Completed answers land on the chart, so the clinician reads them before the visit rather than during it.',
      4400
    );
    await d.say(
      'And a consent signed at home is one less clipboard in the waiting room.',
      3600
    );
    await d.step('');
  },
};
