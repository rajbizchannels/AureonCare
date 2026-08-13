/**
 * V21 — Answer a question with a report.
 * The question is "how bad are our no-shows?", so the video opens the report
 * that answers it rather than the one next to it.
 */

module.exports = {
  id: 'V21',
  wave: 3,
  slug: 'v21-answer-a-question-with-a-report',
  title: 'Answer a question with a report',
  thumbHeadline: 'Run a report',
  moduleLabel: 'Insights ▸ Reports',
  audience: 'Manager',
  intro: 'Start from the question, find the report that answers it, and read it properly.',
  journey: 'Report categories → the No-Show Report → date range → rate, trend and the names → export',
  youtubeTitle: 'AureonCare: Run the No-Show Report and Read It Properly',
  description:
    'Reporting in AureonCare. Shows how reports are grouped by the question they answer — '
    + 'operational, financial, insurance, patient, provider, compliance — then opens the No-Show '
    + 'Report end to end: the rate, the trend over time, the patients behind the number, and '
    + 'exporting the result to PDF or Excel.\n\nPart of the AureonCare training series.',
  tags: [
    'AureonCare', 'healthcare reporting', 'clinic analytics', 'no show report',
    'practice management software', 'medical practice reports', 'no show rate',
    'healthcare data', 'clinic metrics', 'report export',
  ],
  recap: [
    'Reports are grouped by the question they answer, not by the table they read',
    'Set the date range before you read the rate — a percentage with no period means nothing',
    'The detail rows are the point: a rate tells you the size, the names tell you what to do',
  ],

  async run(d, page) {
    d.chapter('Finding the right report');
    await d.step('Step 1 — Open Reports');
    await d.nav('Insights', 'Reports');
    await d.say(
      'Insights ▸ <b>Reports</b> groups reports by the question they answer: operational, financial, insurance, patient, provider, compliance.',
      5000
    );
    await d.say(
      'So start from the question. "How many people are not turning up?" is an <b>operational</b> question.',
      4400
    );

    d.chapter('The No-Show Report');
    await d.step('Step 2 — Open it');
    // Clicking the category selects its first report; the report itself is a
    // child item in the same pane.
    const noShow = page.getByRole('button', { name: 'No-Show Report' }).first();
    if (await d.exists(noShow, 6000)) {
      await d.click(noShow, { pause: 2800 });
    }
    await d.say(
      'The <b>No-Show Report</b> opens on the numbers that answer it: how many were scheduled, how many did not arrive, and the rate.',
      5200
    );
    await d.say(
      '<b>Late cancellations</b> sit alongside them, because a slot cancelled an hour before is lost just as completely.',
      4800
    );

    await d.step('Step 3 — Set the range');
    // Selected rather than clicked open: an open native dropdown lingers on
    // camera and swallows the scroll a couple of beats later.
    const range = page.locator('select').first();
    if (await d.exists(range, 4000)) {
      await d.select(range, '90').catch(() => {});
    }
    await d.say(
      'Set the <b>date range</b> before you read the rate. A percentage with no period attached means nothing.',
      4800
    );
    await d.say(
      'Ninety days smooths out a bad week. Seven days is what you look at when you have just changed something.',
      4800
    );

    d.chapter('Reading it');
    await d.step('Step 4 — The trend');
    await d.say(
      'The chart is the <b>trend</b>: no-shows per day. One bad Monday is noise — the same day every week is a pattern.',
      5000
    );
    await d.say(
      'Switch between bar, line and area if a different shape makes the pattern easier to see.',
      4200
    );

    await d.step('Step 5 — The names behind the number');
    await d.scrollBy(700);
    await d.say(
      '<b>Detailed Records</b> is the part that lets you act: who missed, which provider, what it was for, and their phone number.',
      5200
    );
    await d.say(
      'A rate tells you the size of the problem. The names tell you what to do about it — and one patient appearing three times is its own answer.',
      5400
    );

    d.chapter('Sharing it');
    await d.step('Step 6 — Export');
    const exportBtn = page.getByRole('button', { name: /^(Excel|PDF)$/ }).first();
    if (await d.exists(exportBtn, 4000)) {
      await d.click(exportBtn, { pause: 2600 });
    }
    await d.say(
      'Export to <b>PDF</b> for a meeting or <b>Excel</b> when someone needs to work the list. Both carry the range you set.',
      5000
    );
    await d.step('');
  },
};
