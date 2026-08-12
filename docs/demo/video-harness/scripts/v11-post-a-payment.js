/**
 * V11 — Record a payment and post it.
 * Why unposted payments distort AR.
 */

module.exports = {
  id: 'V11',
  wave: 2,
  slug: 'v11-record-a-payment-and-post-it',
  title: 'Record a payment and post it',
  thumbHeadline: 'Post a payment',
  moduleLabel: 'Billing ▸ Payments · Payment Postings',
  audience: 'Billing',
  intro: 'Take the money, then post it against the claim so the balance is true.',
  journey: 'Payments → Process Payment → Payment Postings → Post Payment → claim, payer, allocation → balance clears',
  youtubeTitle: 'AureonCare: Record a Payment and Post It to a Claim',
  description:
    'Recording and posting payments in AureonCare. Covers the difference between taking a '
    + 'payment and posting it, allocating an insurance remittance against a claim, the '
    + 'contractual adjustment versus patient responsibility, and why unposted payments make '
    + 'accounts receivable lie to you.\n\n'
    + 'Part of the AureonCare Getting Started series.',
  tags: [
    'AureonCare', 'payment posting', 'medical billing', 'accounts receivable',
    'ERA remittance', 'revenue cycle management', 'insurance payment',
    'practice management software', 'healthcare billing', 'patient responsibility',
  ],
  recap: [
    'Billing ▸ Payments takes the money; Payment Postings applies it to a claim',
    'Paid + adjustment + patient responsibility must account for the whole charge',
    'A payment that is never posted leaves the claim looking unpaid in AR',
  ],

  async run(d, page) {
    d.chapter('Taking the payment');
    await d.step('Step 1 — Payments');
    await d.nav('Billing', 'Payments');
    await d.say(
      'Billing ▸ <b>Payments</b> is money arriving — a card at the desk, a cheque in the post, an insurance transfer.',
      4400
    );
    await d.say(
      'Recording it here says the money exists. It does <i>not</i> yet say which claim it settles.',
      4000
    );

    await d.step('Step 2 — Process Payment');
    await d.click(page.getByRole('button', { name: 'Process Payment' }), { pause: 2200 });
    const payForm = page.locator('form').last();
    await d.select(payForm.locator('select').first(), { index: 1 });
    const amt = payForm.locator('input[type="number"]').first();
    if (await d.exists(amt)) await d.type(amt, '36', { delay: 100 });
    const desc = payForm.locator('input[placeholder*="Consultation"]').first();
    if (await d.exists(desc)) await d.type(desc, 'Co-payment, office visit', { delay: 30 });
    await d.say('A patient co-payment: small, immediate, and tied to a visit rather than a remittance.', 4000);
    await d.maybeClick(page.getByRole('button', { name: /Process|Save|Record/ }).last(), { pause: 2600 });

    d.chapter('Posting it to the claim');
    await d.step('Step 3 — Payment Postings');
    await d.nav('Billing', 'Payment Postings');
    await d.say(
      'Billing ▸ <b>Payment Postings</b> is the other half: attaching money to the claim it actually pays.',
      4400
    );
    await d.say(
      'This is the step people skip. Skip it and the claim still reads unpaid, and your receivables report is wrong.',
      4600
    );

    await d.step('Step 4 — Post Payment');
    await d.click(page.getByRole('button', { name: 'Post Payment' }), { pause: 2200 });

    const form = page.locator('form').last();
    const selects = form.locator('select');
    await d.select(selects.nth(0), { index: 1 });

    const claim = selects.nth(1);
    if (await d.exists(claim)) {
      const options = await claim.locator('option').allTextContents();
      const paid = options.find((o) => /paid/i.test(o)) || options[1];
      if (paid) await d.select(claim, { label: paid });
      await d.say('Choose the claim, and the payer and expected amount come with it.', 3600);
    }

    const method = selects.nth(3);
    if (await d.exists(method)) {
      await d.select(method, { label: 'Electronic Funds Transfer (EFT)' });
      await d.say('Insurance money usually arrives as an electronic transfer with a remittance advice.', 3800);
    }

    const ref = form.locator('input[placeholder*="CHK"]').first();
    if (await d.exists(ref)) await d.type(ref, 'EFT-88214', { delay: 60 });

    d.chapter('Allocating it');
    await d.step('Step 5 — The allocation');
    const numbers = form.locator('input[type="number"]');
    if (await d.exists(numbers.first())) await d.type(numbers.first(), '144', { delay: 90 });
    await d.say(
      'The payer paid <b>144</b> of a <b>180</b> charge. The remaining 36 is not simply unpaid — it has to be explained.',
      4800
    );

    if (await d.exists(numbers.nth(1))) await d.type(numbers.nth(1), '36', { delay: 90 });
    const adjCode = selects.nth(4);
    if (await d.exists(adjCode)) {
      await d.select(adjCode, { index: 1 });
      await d.say(
        '<b>CO</b> is a contractual obligation — the discount you agreed with this payer. You write it off; you never bill the patient for it.',
        5000
      );
      await d.say(
        'Code it <b>PR</b> instead and it becomes patient responsibility, and the patient gets an invoice. The code decides who pays.',
        4800
      );
    }

    const era = form.locator('input[placeholder*="Remittance"]').first();
    if (await d.exists(era)) await d.type(era, 'ERA-55120', { delay: 50 });

    await d.step('Step 6 — Post it');
    await d.maybeClick(page.getByRole('button', { name: /Post|Save|Create/ }).last(), { pause: 3000 });
    await d.say(
      'Posted. The claim balance clears, and receivables now reflect what the clinic is genuinely owed.',
      4400
    );
    await d.step('');
  },
};
