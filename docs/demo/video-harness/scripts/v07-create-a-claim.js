/**
 * V07 — Create and submit a claim.
 * The claim states, and what each one means for cash.
 */

module.exports = {
  id: 'V07',
  slug: 'v07-create-and-submit-a-claim',
  title: 'Create and submit a claim',
  thumbHeadline: 'Submit a claim',
  moduleLabel: 'Billing ▸ Claims',
  audience: 'Billing',
  intro: 'Build a claim from a visit, code it, and send it to the clearinghouse.',
  journey: 'Claims queue → New Claim → patient, payer, date, amount → diagnosis and procedure codes → create → submit EDI 837',
  youtubeTitle: 'AureonCare: Create and Submit an Insurance Claim',
  description:
    'Creating and submitting an insurance claim in AureonCare. Covers the claims queue and what '
    + 'each status means, building a claim from a completed visit, searching ICD-10 and CPT codes, '
    + 'and submitting an EDI 837 to the clearinghouse.\n\n'
    + 'Part of the AureonCare Getting Started series.',
  tags: [
    'AureonCare', 'medical billing', 'insurance claim submission', 'EDI 837',
    'revenue cycle management', 'claims processing', 'medical coding', 'ICD-10 CPT',
    'practice management software', 'healthcare billing tutorial',
  ],
  recap: [
    'Billing ▸ Claims ▸ New Claim, built from a completed visit',
    'Diagnosis and procedure codes are searchable — never typed from memory',
    'Draft → Submitted → Paid or Denied; a denial goes to the Denials queue',
  ],

  async run(d, page) {
    d.chapter('The claims queue');
    await d.step('Step 1 — The queue');
    await d.nav('Billing', 'Claims');
    await d.say('Billing ▸ <b>Claims</b> is the money pipeline: every claim and where it has got to.', 3400);
    await d.say(
      'Status is the whole story — <b>draft</b> not sent, <b>submitted</b> waiting, <b>paid</b> settled, <b>denied</b> needs work.',
      4200
    );

    d.chapter('Building the claim');
    await d.step('Step 2 — New Claim');
    await d.click(page.getByRole('button', { name: 'New Claim' }), { pause: 2000 });

    const form = page.locator('form').last();
    const selects = form.locator('select');
    await d.select(selects.first(), { label: 'Sarah Williams - MRN-2025-001' });
    await d.say('Pick the patient and the claim inherits their insurance — no re-keying policy numbers.', 3600);
    await page.waitForTimeout(900);

    const payer = selects.nth(1);
    if (await d.exists(payer)) {
      const options = await payer.locator('option').allTextContents();
      const target = options.find((o) => /Blue Cross/i.test(o));
      if (target) await d.select(payer, { label: target });
    }

    const date = form.locator('input[type="date"]').first();
    const when = new Date();
    when.setDate(when.getDate() - 2);
    const iso = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, '0')}-${String(when.getDate()).padStart(2, '0')}`;
    await d.fill(date, iso);
    await d.type(form.locator('input[type="number"]').first(), '180', { delay: 90 });
    await d.say('Service date and charge come from the visit you are billing for.', 3000);

    d.chapter('Coding it');
    await d.step('Step 3 — Codes');
    const dx = form.locator('input[placeholder*="diagnosis codes"]').first();
    await d.type(dx, 'E11', { delay: 130 });
    await page.waitForTimeout(1100);
    await d.say(
      'Diagnosis codes are <b>searched, not remembered</b> — type the code or the words and pick from the list.',
      3800
    );
    const dxHit = page.getByText(/E11\.9/).first();
    if (await d.exists(dxHit)) await d.click(dxHit, { pause: 1400 });

    const cpt = form.locator('input[placeholder*="procedure codes"]').first();
    await d.type(cpt, '99213', { delay: 130 });
    await page.waitForTimeout(1100);
    const cptHit = page.getByText(/99213/).last();
    if (await d.exists(cptHit)) await d.click(cptHit, { pause: 1400 });
    await d.say(
      'The procedure code is what you are billing; the diagnosis is why. Payers check that the two agree.',
      4000
    );

    await d.scrollBy(240);
    const notes = form.locator('textarea').first();
    if (await d.exists(notes)) {
      await d.type(notes, 'Routine diabetes follow-up, 20 minutes.', { delay: 30 });
    }

    d.chapter('Submitting it');
    await d.step('Step 4 — Create, then submit');
    await d.click(page.getByRole('button', { name: /^Create Claim$/ }).last(), { pause: 3000 });
    await d.say('Created as a <b>draft</b>. Nothing has been sent yet — drafts are safe to fix.', 3400);

    const submit = page.getByRole('button', { name: /Submit EDI 837/ }).first();
    if (await d.exists(submit)) {
      await d.click(submit, { pause: 3000 });
      await d.say(
        '<b>Submit EDI 837</b> sends it to the clearinghouse in the format payers expect.',
        3600
      );
    }
    await d.say(
      'From here it comes back paid, or denied with a reason — and a denial goes straight to the Denials queue.',
      4000
    );
    await d.step('');
  },
};
