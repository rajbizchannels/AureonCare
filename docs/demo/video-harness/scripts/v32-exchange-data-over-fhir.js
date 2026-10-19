/**
 * V32 — Exchange data over FHIR.
 * Where to look when a partner says "we didn't get it".
 */

module.exports = {
  id: 'V32',
  wave: 4,
  slug: 'v32-exchange-data-over-fhir',
  title: 'Exchange data over FHIR',
  thumbHeadline: 'FHIR exchange',
  moduleLabel: 'Clinical ▸ FHIR',
  audience: 'IT',
  intro: 'The standard your partners speak — and the worklist for when a message does not land.',
  journey: 'FHIR Resources → resource types → sync a patient → FHIR Tracking → read a failure → fix it',
  youtubeTitle: 'AureonCare: FHIR Resources and Tracking Failed Exchanges',
  description:
    'Interoperability in AureonCare. Browses FHIR R4 resources by type, syncs a patient and '
    + 'downloads a FHIR bundle, then moves to FHIR Tracking — the worklist of outbound exchanges '
    + 'that failed, with the error, the severity and the suggested fix. This is where to look when '
    + 'a pharmacy or lab says they never received it.\n\nPart of the AureonCare training series.',
  tags: [
    'AureonCare', 'FHIR', 'HL7 FHIR R4', 'healthcare interoperability',
    'FHIR resources', 'health data exchange', 'practice management software',
    'eprescribing errors', 'lab order integration', 'EHR interoperability',
  ],
  recap: [
    'FHIR R4 is the shared language — Patient, Observation, Condition, Medication, Procedure',
    'A bundle is one patient&rsquo;s whole record in one file',
    'Tracking is the worklist: what failed, why, and what to do about it',
  ],

  async run(d, page) {
    d.chapter('What is being shared');
    await d.step('Step 1 — FHIR Resources');
    await d.nav('Clinical', 'FHIR Resources');
    await d.say(
      'Clinical ▸ <b>FHIR Resources</b> is the clinic&rsquo;s data in the format the rest of healthcare reads.',
      4600
    );
    await d.say(
      '<b>FHIR R4</b> is the standard. A patient is a Patient, a vital sign is an Observation, a diagnosis is a Condition.',
      5000
    );
    await d.say(
      'Which matters because a partner system does not need to know anything about AureonCare to read it.',
      4800
    );

    await d.step('Step 2 — Filter by type');
    const condition = page.getByRole('button', { name: /^Condition$/ }).first();
    if (await d.exists(condition, 5000)) {
      await d.click(condition, { pause: 2400 });
      await d.say(
        'Filter by <b>resource type</b> to see just the diagnoses, just the observations, just the medications.',
        4600
      );
    }
    const all = page.getByRole('button', { name: /^all$/ }).first();
    if (await d.exists(all, 3000)) await d.click(all, { pause: 1800 });

    d.chapter('Sending one out');
    await d.step('Step 3 — Sync a patient');
    const sync = page.locator('button[title="Sync to FHIR"]').first();
    if (await d.exists(sync, 5000)) {
      await d.click(sync, { pause: 2800 });
      await d.say(
        '<b>Sync</b> pushes that patient&rsquo;s record out as FHIR resources, and stamps the version it sent.',
        4600
      );
    }
    const bundle = page.locator('button[title="Download FHIR Bundle"]').first();
    if (await d.exists(bundle, 4000)) {
      await d.click(bundle, { pause: 2400 });
      await d.say(
        'A <b>bundle</b> is the whole patient in one file — what you hand to a specialist or a new provider.',
        4600
      );
    }

    d.chapter('When it does not land');
    await d.step('Step 4 — FHIR Tracking');
    await d.nav('Clinical', 'FHIR Tracking');
    await d.say(
      '<b>FHIR Tracking</b> is the worklist that matters day to day: outbound exchanges that need someone to act.',
      5000
    );
    await d.say(
      'A prescription that the pharmacy never acknowledged. A lab order the lab rejected. Each with a tracking number.',
      5000
    );

    await d.step('Step 5 — Read the failure');
    const expand = page.locator('button[aria-label="Show error detail"]').first();
    if (await d.exists(expand, 5000)) {
      await d.click(expand, { pause: 2800 });
      await d.say(
        'Open one and it tells you what actually went wrong — here, the ordering provider has no NPI on file.',
        5000
      );
      await d.say(
        'And it tells you what to do: fix the provider record, then resend. No new order, no phone call yet.',
        4800
      );
    }
    await d.say(
      '<b>Severity</b> separates the two kinds: an error needs a person, a warning usually clears on a retry.',
      4800
    );

    await d.step('Step 6 — The habit');
    await d.say(
      'Check this list daily. It is the difference between finding out here, and finding out when a patient calls.',
      5000
    );
    await d.step('');
  },
};
