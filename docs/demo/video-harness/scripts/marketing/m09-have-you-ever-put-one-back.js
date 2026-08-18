/**
 * M9 — Have you ever put one back?
 *
 * Last of the vertical reels.
 *
 * The plan built this one around an on-screen stopwatch: "Restore. Watch the
 * clock." The clock was recorded and it read two seconds — which is a fact
 * about the demo API answering instantly, not about restoring a real
 * practice's data. Publishing it would have been a performance claim nothing
 * here supports, so the timer is gone.
 *
 * What is true is that a restore is self-serve, takes a real backup file, and
 * comes back naming what it restored. That is the argument now: not how fast,
 * but that you can do it at all and are told what happened.
 *
 * The backup file is written to disk and handed to the input the product
 * actually uses, so this is a real restore rather than a button that happens
 * to show a success dialog.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

module.exports = {
  id: 'M9',
  slug: 'm09-have-you-ever-put-one-back',
  marketing: true,
  reel: true,
  silent: true,
  pace: 0.45,
  title: 'Have you ever put one back?',
  thumbHeadline: 'Have you ever put one back?',
  thumbSub: 'Restore is self-serve, and it names what it restored.',
  reelKicker: 'Backup & restore',
  moduleLabel: 'Settings ▸ Backup & Restore',
  audience: 'Practice owner, IT, compliance',
  intro: 'A real backup file restored, with a confirmation naming what came back.',
  journey: 'Backup & Restore → hand it the file → restored, and told what was restored',
  youtubeTitle: 'Have you ever put a backup back? | AureonCare',
  description:
    'Taking backups is easy. Restoring one is the part nobody rehearses. A real backup file is '
    + 'handed to the restore and the product confirms what came back.\n\n'
    + 'Timing is not shown: this runs against a demo API, so any duration on screen would say '
    + 'more about the demo than about your data.\n\n'
    + 'Synthetic data; no real patient information appears.',
  tags: [
    'AureonCare', 'backup and restore', 'disaster recovery', 'healthcare IT',
    'practice management', 'data protection', 'business continuity',
  ],
  recap: [
    'The restore takes a real backup file',
    'It is self-serve, not a support ticket',
    'The confirmation names what was restored',
  ],

  async run(d, page) {
    d.chapter('The question');
    await d.step('The question');
    await d.nav('Settings', 'Backup & Restore');
    await d.say('Everyone takes backups.', 1800);
    await d.say('Far fewer have ever put one back.', 2200);

    // A genuine file, written here and handed to the input the product uses.
    const backup = {
      generated_at: new Date().toISOString(),
      version: 'AureonCare demo backup',
      data: {
        patients: [], appointments: [], claims: [], payments: [], prescriptions: [],
        lab_orders: [], denials: [], preapprovals: [], audit_logs: [], users: [],
      },
    };
    const file = path.join(os.tmpdir(), 'aureoncare-demo-backup.json');
    fs.writeFileSync(file, JSON.stringify(backup, null, 2), 'utf8');

    d.chapter('The restore');
    await d.step('The restore');
    // No timer. It read two seconds against a mock API, and a duration on
    // screen would be read as a claim about restoring real data.
    await page.locator('input[type="file"][accept=".json"]').first().setInputFiles(file);
    await d.say('Hand it a backup file.', 2000);

    const done = page.locator('div.fixed.inset-0').filter({ hasText: 'Restore Completed Successfully' }).last();
    await done.waitFor({ timeout: 30000 });
    await d.say('And it tells you what came back.', 2400);

    await d.click(done.getByRole('button', { name: /^OK$/ }), { pause: 1400 });
    await d.say('No ticket. No waiting on someone else.', 2400);
  },
};
