/**
 * V20 — Build a form template and read the submissions.
 */

module.exports = {
  id: 'V20',
  wave: 3,
  slug: 'v20-build-a-form-template',
  title: 'Build a form template and read the submissions',
  thumbHeadline: 'Build a form',
  moduleLabel: 'Patients ▸ Form Templates',
  audience: 'Admin',
  intro: 'One template, many submissions — and an audit trail behind both.',
  journey: 'Templates → what a version means → submissions → the audit log',
  youtubeTitle: 'AureonCare: Build a Form Template and Read Submissions',
  description:
    'Form management in AureonCare. Covers the template list and what publishing means, how '
    + 'versions protect submissions already collected, reading what patients sent back, and '
    + 'the audit log behind every change.\n\nPart of the AureonCare training series.',
  tags: [
    'AureonCare', 'form builder', 'patient forms', 'digital forms healthcare',
    'form templates', 'practice management software', 'form submissions',
    'clinical questionnaires', 'healthcare software', 'form audit trail',
  ],
  recap: [
    'Templates are versioned — editing never rewrites what patients already sent',
    'Submissions are the answers, tied to the version they were collected on',
    'Every change is in the audit log, with who and when',
  ],

  async run(d, page) {
    d.chapter('The template list');
    await d.step('Step 1 — Open Form Templates');
    await d.nav('Patients', 'Form Templates');
    await d.say(
      'Patients ▸ <b>Form Templates</b> is every form the practice can send, with its version and how many times it has been used.',
      4600
    );
    await d.say(
      '<b>Published</b> means it can be sent. A <b>draft</b> is yours to keep editing until it is ready.',
      4200
    );

    d.chapter('Versions, and why they matter');
    await d.step('Step 2 — Versions');
    await d.say(
      'Editing a published template makes a <b>new version</b>. The answers already collected stay attached to the version they were given on.',
      5000
    );
    await d.say(
      'That is what stops a wording change from quietly rewriting last year&rsquo;s consents.',
      3800
    );

    d.chapter('Reading what came back');
    await d.step('Step 3 — Submissions');
    const subs = page.getByRole('button', { name: /^Submissions/i }).first();
    if (await d.exists(subs)) {
      await d.click(subs, { pause: 2600 });
      await d.say(
        '<b>Submissions</b> are the completed forms: which patient, which template version, and whether it was signed.',
        4600
      );
    }

    await d.step('Step 4 — The audit log');
    const audit = page.getByRole('button', { name: /Audit/i }).first();
    if (await d.exists(audit)) {
      await d.click(audit, { pause: 2600 });
      await d.say(
        'The <b>audit log</b> records every publish, every edit and every signature — who did it, and when.',
        4400
      );
    }
    await d.say(
      'Between them, that is the answer to "which version did this patient actually agree to".',
      4000
    );
    await d.step('');
  },
};
