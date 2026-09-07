/**
 * V10 — Work a denial to resolution.
 * The reason code tells you what to fix; the appeal is how you get paid.
 */

module.exports = {
  id: 'V10',
  wave: 2,
  slug: 'v10-work-a-denial-to-resolution',
  title: 'Work a denial to resolution',
  thumbHeadline: 'Work a denial',
  moduleLabel: 'Billing ▸ Denials',
  audience: 'Billing',
  intro: 'Read the reason code, fix the cause, and appeal — money you already earned.',
  journey: 'Denials queue → open a denial → reason code and category → priority → appeal → resolved',
  youtubeTitle: 'AureonCare: Work an Insurance Denial to Resolution',
  description:
    'Working a denied insurance claim in AureonCare. Covers the denials queue, reading the '
    + 'CARC reason code the payer returned, recording a denial against the original claim, '
    + 'setting category and priority so the queue sorts itself, and tracking the appeal '
    + 'through to resolved.\n\n'
    + 'Part of the AureonCare Getting Started series.',
  tags: [
    'AureonCare', 'claim denial', 'denial management', 'insurance appeal',
    'CARC codes', 'revenue cycle management', 'medical billing', 'denied claim',
    'practice management software', 'healthcare revenue',
  ],
  recap: [
    'Billing ▸ Denials — every denied claim, with the payer&rsquo;s reason code',
    'The reason code names the fix: CO-16 is missing information, CO-45 is a fee-schedule cut',
    'Appeal or correct and resubmit — a denial is unpaid work, not a closed case',
  ],

  async run(d, page) {
    d.chapter('The denials queue');
    await d.step('Step 1 — The queue');
    await d.nav('Billing', 'Denials');
    await d.say(
      'Billing ▸ <b>Denials</b> is where refused claims land. Every row here is work you have already done and not been paid for.',
      4600
    );
    await d.say(
      'Treat it as a worklist, not an archive. Denials have filing deadlines — an untouched queue quietly becomes written-off revenue.',
      4800
    );

    d.chapter('Recording the denial');
    await d.step('Step 2 — Record Denial');
    await d.click(page.getByRole('button', { name: 'Record Denial' }), { pause: 2200 });

    const form = page.locator('form').last();
    const selects = form.locator('select');

    await d.select(selects.nth(0), { index: 1 });
    await d.say('Start from the patient, then the claim that was refused.', 3200);

    const claim = selects.nth(1);
    if (await d.exists(claim)) {
      const options = await claim.locator('option').allTextContents();
      const denied = options.find((o) => /denied/i.test(o));
      if (denied) await d.select(claim, { label: denied });
      await d.say(
        'Picking the claim pulls its payer and amount across — the denial stays tied to the claim it came from.',
        4200
      );
    }

    d.chapter('The reason code');
    await d.step('Step 3 — Why it was refused');
    const reason = selects.nth(3);
    if (await d.exists(reason)) {
      await d.select(reason, { index: 1 });
      await d.say(
        'The <b>reason code</b> is the payer telling you exactly what is wrong. <b>CO-16</b> means the claim is missing information.',
        4800
      );
      await d.say(
        'Learn the common ones and the fix is obvious: CO-16 add what is missing, CO-45 the charge exceeded the fee schedule, CO-18 it is a duplicate.',
        5200
      );
    }

    const category = selects.nth(4);
    if (await d.exists(category)) await d.select(category, { index: 5 });

    const priority = selects.nth(5);
    if (await d.exists(priority)) {
      await d.select(priority, { label: 'High' });
      await d.say('Priority is what makes the queue sort itself — high-value and near-deadline first.', 3800);
    }

    const amount = form.locator('input[type="number"]').first();
    if (await d.exists(amount)) await d.type(amount, '210', { delay: 90 });

    await d.scrollBy(220);
    const notes = form.locator('textarea').first();
    if (await d.exists(notes)) {
      await d.type(
        notes,
        'Rendering provider NPI missing on the original submission. Corrected and ready to resubmit.',
        { delay: 24 }
      );
      await d.say(
        'Write what you actually did. The next person to touch this — or you in three weeks — needs the trail.',
        4400
      );
    }

    d.chapter('Resolving it');
    await d.step('Step 4 — Appeal and close');
    await d.maybeClick(
      page.getByRole('button', { name: /Record|Save|Create|Submit/ }).last(),
      { pause: 3000 }
    );
    await d.say('Recorded, and it joins the queue as <b>open</b> with an appeal status of not started.', 4000);
    await d.say(
      'Fix the cause, resubmit, and move it to <b>resolved</b>. A denial worked is revenue recovered; a denial ignored is revenue lost.',
      4800
    );
    await d.step('');
  },
};
