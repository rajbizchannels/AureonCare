/**
 * V21 — Answer a question with a report.
 */

module.exports = {
  id: 'V21',
  wave: 3,
  slug: 'v21-answer-a-question-with-a-report',
  title: 'Answer a question with a report',
  thumbHeadline: 'Run a report',
  moduleLabel: 'Insights ▸ Reports',
  audience: 'Manager',
  intro: 'Find the report that answers your question, and read it properly.',
  journey: 'Report categories → the Daily Appointment report → date range → summary and chart → export',
  youtubeTitle: 'AureonCare: Run a Report and Read It Properly',
  description:
    'Reporting in AureonCare. Shows how reports are grouped into operational, financial, '
    + 'insurance, patient, provider and compliance categories, reads the daily appointment '
    + 'report end to end — including the no-show count buried in it — and exports the result.'
    + '\n\nPart of the AureonCare training series.',
  tags: [
    'AureonCare', 'healthcare reporting', 'clinic analytics', 'no show report',
    'practice management software', 'medical practice reports', 'KPI reporting',
    'healthcare data', 'clinic metrics', 'report export',
  ],
  recap: [
    'Reports are grouped by the question they answer, not by the table they read',
    'Set the date range before you read the number',
    'Export to PDF or Excel when the number has to leave the room',
  ],

  async run(d, page) {
    d.chapter('Finding the right report');
    await d.step('Step 1 — Open Reports');
    await d.nav('Insights', 'Reports');
    await d.say(
      'Insights ▸ <b>Reports</b> groups reports by the question they answer: operational, financial, insurance, patient, provider.',
      4800
    );
    await d.say(
      'Start from the question. "How is the schedule actually running?" is an <b>operational</b> question.',
      4000
    );

    d.chapter('Running it');
    await d.step('Step 2 — The no-show report');
    const operational = page.getByRole('button', { name: /^Operational/ }).first();
    if (await d.exists(operational)) await d.click(operational, { pause: 2600 });
    await d.say(
      'The <b>Daily Appointment Report</b> opens on the summary: booked, completed, no-shows, and the completion rate.',
      4600
    );

    await d.step('Step 3 — Set the range');
    await d.say(
      'Always set the <b>date range</b> before reading the number — a rate without a period attached means nothing.',
      4400
    );
    await d.scrollBy(280);

    d.chapter('Reading and sharing it');
    await d.step('Step 4 — Read it, then export');
    await d.say(
      'Read the cards first, then the chart for the shape — five no-shows out of ninety-seven is a very different story from fifty.',
      4800
    );
    const exportBtn = page.getByRole('button', { name: /Export|PDF|Excel/i }).first();
    if (await d.exists(exportBtn)) {
      await d.click(exportBtn, { pause: 2400 });
      await d.say('Export to PDF or Excel when the number has to leave the room.', 3400);
    }
    await d.step('');
  },
};
