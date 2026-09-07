/**
 * V30 — Prove who touched what.
 * The HIPAA answer to "who viewed this record".
 */

module.exports = {
  id: 'V30',
  wave: 4,
  slug: 'v30-prove-who-touched-what',
  title: 'Prove who touched what',
  thumbHeadline: 'Audit logs',
  moduleLabel: 'Settings ▸ Audit Logs',
  audience: 'Compliance',
  intro: 'Every view, every edit, every failed attempt — with a name and a timestamp on it.',
  journey: 'Audit Logs → filter → open an entry → export for the request',
  youtubeTitle: 'AureonCare: Audit Logs — Prove Who Accessed a Patient Record',
  description:
    'Audit logging in AureonCare. Filters the trail by user, action, module and date, opens a '
    + 'single entry to read exactly what changed, shows what a failed action looks like, and '
    + 'exports the filtered result for an audit request. This is the answer to "who viewed this '
    + 'record".\n\nPart of the AureonCare training series.',
  tags: [
    'AureonCare', 'audit logs', 'HIPAA compliance', 'patient record access log',
    'healthcare compliance software', 'access audit trail', 'practice management software',
    'medical records security', 'compliance reporting', 'who accessed my record',
  ],
  recap: [
    'Views are logged, not just changes — reading a chart leaves a trace',
    'A failed action is logged too, with why it was refused',
    'Filter first, then export — the export follows the filter',
  ],

  async run(d, page) {
    d.chapter('The trail');
    await d.step('Step 1 — Audit Logs');
    await d.nav('Settings', 'Audit Logs');
    await d.say(
      'Settings ▸ <b>Audit Logs</b> is every action taken in the system: who, what, when, and from where.',
      4600
    );
    await d.say(
      'Note the first row. A <b>view</b> is logged — opening a chart leaves a trace, not only changing it.',
      4800
    );
    await d.say(
      'That is the requirement most systems miss, and the one an auditor asks about first.',
      4200
    );

    d.chapter('Finding the one you need');
    await d.step('Step 2 — Filter');
    const filters = page.getByRole('button', { name: /Filters/i }).first();
    if (await d.exists(filters, 5000)) await d.click(filters, { pause: 2000 });

    const selects = page.locator('select');
    if (await d.exists(selects.first(), 4000)) {
      await d.select(selects.first(), 'update').catch(() => {});
      await d.say(
        'Filter by <b>action</b> — views, creates, updates, deletes — and the list narrows to just those.',
        4600
      );
    }
    const email = page.getByPlaceholder(/Search by email/i).first();
    if (await d.exists(email, 3000)) {
      await d.type(email, 'michael.anderson@demo-clinic.example', { delay: 18 });
      await d.say(
        'Add a <b>user</b>, a <b>module</b> or a <b>date range</b> and you are down to the handful that matter.',
        4600
      );
    }

    d.chapter('Reading one entry');
    await d.step('Step 3 — Open the detail');
    const view = page.getByRole('button', { name: /View Details/i }).first();
    if (await d.exists(view, 5000)) {
      await d.click(view, { pause: 2800 });
      await d.say(
        'The detail gives the exact timestamp, the user and their email, the resource, and the module.',
        4800
      );
      await d.say(
        'On an update it also lists the <b>changed fields</b> — so you can answer what changed, not only that something did.',
        5000
      );
      // The dialog closes on its X, which carries no accessible name — the
      // first button inside the overlay is it.
      const closeX = page.locator('div.fixed.inset-0').last().locator('button').first();
      if (await d.exists(closeX, 3000)) await d.click(closeX, { pause: 1600 });
      else await page.keyboard.press('Escape');
    }

    await d.step('Step 4 — Failures count too');
    await d.say(
      'Failed actions are logged as well. A refused export tells you the controls worked — and that someone tried.',
      5000
    );

    d.chapter('Handing it over');
    await d.step('Step 5 — Export');
    const exportBtn = page.getByRole('button', { name: /^Export$/i }).first();
    if (await d.exists(exportBtn, 4000)) {
      await d.click(exportBtn, { pause: 2600 });
    }
    await d.say(
      '<b>Export</b> takes the filtered list, not the whole table — so an audit request gets exactly what it asked for.',
      5000
    );
    await d.say(
      'Filter, read, export. That is the whole workflow, and it is the one you want to have practised before you need it.',
      5000
    );
    await d.step('');
  },
};
