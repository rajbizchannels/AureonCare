/**
 * V31 — Back up, restore, archive.
 * Two different problems, two different tools.
 */

module.exports = {
  id: 'V31',
  wave: 4,
  slug: 'v31-back-up-restore-archive',
  title: 'Back up, restore, archive',
  thumbHeadline: 'Backup & archive',
  moduleLabel: 'Settings ▸ System',
  audience: 'Admin · IT',
  intro: 'Backup is for disaster. Archive is for age. They are not the same job.',
  journey: 'Backup → what it includes → restore → Archive Management → rules → browse an archive',
  youtubeTitle: 'AureonCare: Backup, Restore and Archive Explained',
  description:
    'Backup and archiving in AureonCare. Runs a backup to local and cloud storage, explains what '
    + 'restoring actually does, then covers Archive Management — automatic archive rules, creating '
    + 'an archive, browsing what is inside one, and restoring it back — and why archive and backup '
    + 'solve different problems.\n\nPart of the AureonCare training series.',
  tags: [
    'AureonCare', 'data backup', 'clinic data backup', 'restore from backup',
    'data archiving', 'healthcare data retention', 'practice management software',
    'google drive backup', 'HIPAA data retention', 'disaster recovery',
  ],
  recap: [
    'Backup protects against loss; archive keeps old data out of the way but reachable',
    'A restore merges — duplicates are detected and skipped, nothing is overwritten',
    'Archive rules do it on a schedule, so nobody has to remember',
  ],

  async run(d, page) {
    // Several actions here end in a confirmation dialog (the backup-succeeded
    // notice, the archive browser); it has to be dismissed or it covers the
    // next control.
    const dismissModal = async () => {
      const modal = page.locator('div.fixed.inset-0').last();
      const named = modal.getByRole('button', { name: /Close|OK|Done|Got it/i }).first();
      if (await d.exists(named, 2500)) return d.click(named, { pause: 1400 });
      const anyButton = modal.locator('button').first();
      if (await d.exists(anyButton, 2000)) return d.click(anyButton, { pause: 1400 });
      return page.keyboard.press('Escape');
    };

    d.chapter('Backup');
    await d.step('Step 1 — Backup & Restore');
    await d.nav('Settings', 'Backup & Restore');
    await d.say(
      'Settings ▸ <b>Backup &amp; Restore</b> takes a full copy of the clinic&rsquo;s data — three places to put it.',
      4600
    );
    await d.say(
      '<b>Local</b> downloads a file to this machine. <b>Google Drive</b> and <b>OneDrive</b> push it to the cloud account you connected.',
      5000
    );
    await d.say(
      'A cloud destination that has not been connected cannot be used — the button says so rather than failing later.',
      4800
    );

    await d.step('Step 2 — Run one');
    const download = page.getByRole('button', { name: /Download Backup/i }).first();
    if (await d.exists(download, 5000)) {
      await d.click(download, { pause: 2600 });
      await d.say(
        'The backup is every table: patients, appointments, clinical records, claims, settings.',
        4400
      );
      await dismissModal();
    }

    await d.step('Step 3 — Module backups');
    await d.scrollBy(500);
    await d.say(
      'Accounting and Inventory also take their own <b>module backups</b> — useful before a big change to just one of them.',
      5000
    );

    await d.step('Step 4 — Restoring');
    await d.say(
      '<b>Restore</b> reads a backup file back in. Read the warning: this replaces current data, and it cannot be undone.',
      5000
    );
    await d.say(
      'Which is why a restore is a decision made deliberately, on a quiet system, not a thing tried during clinic.',
      4800
    );

    d.chapter('Archive is a different job');
    await d.step('Step 5 — Archive Management');
    await d.nav('Settings', 'Archive Management');
    await d.say(
      '<b>Archive</b> solves the opposite problem. Backup is for losing data; archive is for data you must keep but no longer work with.',
      5400
    );
    await d.say(
      'Old appointments, closed claims, audit history — out of the working tables, still fully retrievable.',
      4800
    );
    await d.say(
      'And read the note: restoring an archive <b>merges</b>. Duplicates are detected and skipped, so nothing is lost.',
      5000
    );

    await d.step('Step 6 — Rules do it for you');
    await d.say(
      '<b>Automatic archive rules</b> run on a schedule — closed claims after twenty-four months, audit logs after twenty-four.',
      5200
    );
    await d.say(
      'Set the retention your regulator asks for once, and nobody has to remember it again.',
      4400
    );

    await d.step('Step 7 — Look inside one');
    await d.scrollBy(700);
    const browse = page.locator('button[title="Browse Archive Data"]').first();
    if (await d.exists(browse, 5000)) {
      await d.click(browse, { pause: 3000 });
      await d.say(
        'You can <b>browse</b> an archive without restoring it — table by table, row by row.',
        4600
      );
      await dismissModal();
    }
    await d.say(
      'So: back up for disaster, archive for age. Two problems, two tools — and both of them scheduled, not remembered.',
      5200
    );
    await d.step('');
  },
};
