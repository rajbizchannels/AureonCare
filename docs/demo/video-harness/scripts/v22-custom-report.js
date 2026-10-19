/**
 * V22 — Build a custom report and export it.
 */

module.exports = {
  id: 'V22',
  wave: 3,
  slug: 'v22-build-a-custom-report',
  title: 'Build a custom report and export it',
  thumbHeadline: 'Custom report',
  moduleLabel: 'Insights ▸ Custom Report',
  audience: 'Manager',
  intro: 'The escape hatch for when no standard report answers your question.',
  journey: 'Custom Report Builder → data source → fields → filters → run → export',
  youtubeTitle: 'AureonCare: Build a Custom Report',
  description:
    'The custom report builder in AureonCare: choosing a data source, picking the fields you '
    + 'want, filtering, running it and exporting the result — for the questions the standard '
    + 'reports do not cover.\n\nPart of the AureonCare training series.',
  tags: [
    'AureonCare', 'custom reports', 'report builder', 'healthcare analytics',
    'practice management software', 'clinic data', 'ad hoc reporting',
    'medical practice reports', 'data export', 'business intelligence',
  ],
  recap: [
    'Pick the data source first — it decides which fields exist',
    'Filter before you run, or you will read the wrong rows',
    'Save it once and it becomes a report you can re-run',
  ],

  async run(d, page) {
    d.chapter('When the standard reports run out');
    await d.step('Step 1 — Open the builder');
    await d.nav('Insights', 'Custom Report');
    await d.say(
      'Insights ▸ <b>Custom Report</b> is for the question no standard report answers.',
      3800
    );
    await d.say(
      'The standard reports cover the usual questions. This is the escape hatch for yours.',
      3800
    );

    d.chapter('Building it');
    await d.step('Step 2 — Data source');
    const source = page.locator('select').first();
    if (await d.exists(source)) {
      const options = await source.locator('option').allTextContents();
      const pick = options.find((o) => /appointment/i.test(o)) || options[1];
      if (pick) await d.select(source, { label: pick }, { pause: 2000 });
    }
    await d.say(
      'The <b>data source</b> comes first, because it decides which fields even exist — appointments, claims, patients.',
      4600
    );

    await d.step('Step 3 — Fields and filters');
    const field = page.locator('input[type="checkbox"]').first();
    if (await d.exists(field)) {
      await d.click(field, { pause: 1400 });
      const more = page.locator('input[type="checkbox"]');
      const count = await more.count();
      for (let i = 1; i < Math.min(count, 4); i += 1) {
        await d.click(more.nth(i), { pause: 700 });
      }
    }
    await d.say(
      'Pick the columns you want. Then <b>filter before you run</b> — otherwise you are reading the wrong rows carefully.',
      4600
    );
    await d.scrollBy(280);

    d.chapter('Running and keeping it');
    await d.step('Step 4 — Run and export');
    const run = page.getByRole('button', { name: /Generate|Run Report|Run/i }).first();
    if (await d.exists(run)) {
      await d.click(run, { pause: 3000 });
      await d.say('Run it, and the result is a table you can read or hand over.', 3400);
    }
    const exportBtn = page.getByRole('button', { name: /Export|Excel|PDF/i }).first();
    if (await d.exists(exportBtn)) {
      await d.click(exportBtn, { pause: 2200 });
    }
    await d.say(
      'Save the definition and it stops being a one-off — next month you re-run it rather than rebuild it.',
      4200
    );
    await d.step('');
  },
};
