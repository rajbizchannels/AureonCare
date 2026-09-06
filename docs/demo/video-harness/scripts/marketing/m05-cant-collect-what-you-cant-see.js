/**
 * M5 — You can't collect what you can't see.
 *
 * The CFO cut.
 *
 * The plan called this one "a denial is not a dead claim — watch it get worked
 * in ninety seconds". The product cannot do that: a denial can be recorded and
 * deleted, and that is all. There is no appeal, resolve or work-it action on a
 * denial row, so the original premise would have been a promise the software
 * does not keep.
 *
 * What is true, and is still a finance argument, is visibility: every denial
 * carries its reason code, its category, its amount and its appeal deadline,
 * new ones are captured against the claim they belong to, and the receivable
 * stays on the books until it is settled. That is what this cut shows.
 */

module.exports = {
  id: 'M5',
  slug: 'm05-cant-collect-what-you-cant-see',
  marketing: true,
  pace: 0.5,
  title: 'You can’t collect what you can’t see',
  thumbHeadline: 'Every denial, with its reason',
  thumbSub: 'Codes, deadlines, and what it is worth.',
  moduleLabel: 'Billing ▸ Denials ▸ Receivables',
  audience: 'CFO, practice owner, billing manager',
  intro: 'Denials carry their reason, their amount and their deadline — and the receivable stays visible.',
  journey: 'Denials queue → record one against its claim → receivables',
  youtubeTitle: 'Every denial, with its reason code and what it costs you | AureonCare',
  description:
    'Denials are where practice revenue quietly leaks. This shows the queue that makes each one '
    + 'visible — reason code, category, amount, priority and appeal deadline — recording a new '
    + 'denial against the claim it belongs to, and the receivable that stays on the books until it '
    + 'is settled.\n\n'
    + 'Synthetic data throughout; no real patient information appears.',
  tags: [
    'AureonCare', 'medical billing', 'claim denials', 'denial management',
    'revenue cycle management', 'accounts receivable', 'practice revenue',
    'healthcare finance', 'billing software', 'RCM software',
  ],
  recap: [
    'Every denial carries its reason code and what it is worth',
    'A denial is recorded against the claim it belongs to',
    'The receivable stays visible until it settles',
  ],

  async run(d, page) {
    d.chapter('The queue');
    await d.card({
      heading: 'You can’t collect what you can’t see.',
      holdMs: 2400,
      logo: false,
    });

    await d.step('The queue');
    await d.nav('Billing', 'Denials');
    await d.say('Every denial, with the reason the payer gave.', 2400);
    await d.say('Category, amount, priority, and the date the appeal window shuts.', 3000);

    d.chapter('Nothing gets lost');
    await d.step('Nothing gets lost');
    await d.click(page.getByRole('button', { name: /^Record Denial$/ }), { pause: 1400 });
    await d.say('A new one gets recorded against the claim it belongs to.', 2800);

    // Patient first: the claim list is filtered by it, so the order matters.
    const patient = d.field('Patient', 'select');
    const patientOptions = await patient.locator('option').allTextContents();
    const target = patientOptions.find((o) => /Marcus Boone/i.test(o)) || patientOptions[1];
    await d.select(patient, { label: target });
    await page.waitForTimeout(900);

    const claim = d.field('Claim', 'select');
    const claimOptions = await claim.locator('option').allTextContents();
    const claimHit = claimOptions.find((o) => /CLM-/i.test(o));
    if (!claimHit) {
      throw new Error(`No claim to deny — options were ${JSON.stringify(claimOptions)}`);
    }
    await d.select(claim, { label: claimHit });

    await d.type(d.field('Denial Amount', 'input'), '210', { delay: 60, pause: 400 });
    const denialDate = new Date();
    const iso = `${denialDate.getFullYear()}-${String(denialDate.getMonth() + 1).padStart(2, '0')}-${String(denialDate.getDate()).padStart(2, '0')}`;
    await d.fill(d.field('Denial Date', 'input'), iso, { pause: 400 });

    // The narration calls the reason code the whole story, so it has to be set
    // on screen — narrating over an empty dropdown would be the video arguing
    // against itself.
    const reason = d.field('Denial Reason Code', 'select');
    const reasonOptions = await reason.locator('option').allTextContents();
    const co16 = reasonOptions.find((o) => /^CO-16/.test(o));
    if (co16) await d.select(reason, { label: co16 });
    // Category is a separate field and does not follow the code, so it is set
    // too — a queue row reading "Other" next to narration about reason codes
    // reads as carelessness.
    await d.select(d.field('Denial Category', 'select'), { label: 'Invalid/Missing Information' });
    await d.say('The reason code is the whole story — it decides whether this is worth appealing.', 3200);

    await d.click(page.getByRole('button', { name: /^Create Denial$/ }).last(), { pause: 1200 });
    // The confirmation repeats the form's button label, so it is addressed
    // through the dialog rather than by name.
    const denialDialog = page.locator('div.fixed.inset-0').filter({ hasText: /Confirm Denial|review the denial/i }).last();
    await denialDialog.waitFor({ timeout: 15000 });
    await d.click(denialDialog.getByRole('button', { name: /^Create Denial$/ }), { pause: 1800 });
    await d.say('On the queue, with its deadline. Not in somebody’s inbox.', 2800);

    d.chapter('On the books');
    await d.step('On the books');
    await d.nav('Operations', 'Receivables');
    await d.say('And the receivable stays visible until the money actually arrives.', 3000);
    await d.scrollBy(280);
    await d.say('Open, partial, paid, written off — the difference between hoping and knowing.', 3200);

    await d.card({
      heading: 'Visible beats optimistic.',
      body: 'Every denial with its reason, every receivable with its status.',
      holdMs: 3800,
      keep: true,
    });
  },
};
