/**
 * V12 — Quote, invoice, get paid.
 * The self-pay path, which the claims videos do not cover.
 */

module.exports = {
  id: 'V12',
  wave: 2,
  slug: 'v12-quote-invoice-get-paid',
  title: 'Quote, invoice, get paid',
  thumbHeadline: 'Quote to payment',
  moduleLabel: 'Billing ▸ Quotes & Invoices',
  audience: 'Front desk · Billing',
  intro: 'The self-pay path: price it up front, invoice it, take the money.',
  journey: 'Quotes & Invoices → New Quote → patient, service, price → send → convert to invoice → payment',
  youtubeTitle: 'AureonCare: Quote, Invoice and Get Paid (Self-Pay)',
  description:
    'The self-pay billing path in AureonCare, for work no insurer is covering. Covers '
    + 'building a quote from the service catalogue, what to put in front of the patient '
    + 'before they commit, converting an accepted quote into an invoice, and tracking it '
    + 'through to paid.\n\n'
    + 'Part of the AureonCare Getting Started series.',
  tags: [
    'AureonCare', 'medical invoice', 'patient quote', 'self pay billing',
    'healthcare invoicing', 'practice management software', 'clinic billing',
    'patient payments', 'service catalogue', 'medical practice revenue',
  ],
  recap: [
    'Billing ▸ Quotes & Invoices ▸ New Quote, priced from the service catalogue',
    'A quote is a price with an expiry — it commits nobody until accepted',
    'Accepted quote becomes an invoice; the invoice is what gets paid',
  ],

  async run(d, page) {
    d.chapter('Why quotes exist');
    await d.step('Step 1 — Quotes & Invoices');
    await d.nav('Billing', 'Quotes & Invoices');
    await d.say(
      'Billing ▸ <b>Quotes &amp; Invoices</b> is the self-pay side — programmes, cosmetic work, anything no insurer is covering.',
      4600
    );
    await d.say(
      'The tabs are the lifecycle: <b>Quotes</b>, then <b>Invoices</b>, then <b>Payments</b>, with coupons and reminders alongside.',
      4400
    );
    await d.say(
      'Quote first. A price agreed before the work starts is the cheapest way to avoid an argument after it.',
      4400
    );

    d.chapter('Building the quote');
    await d.step('Step 2 — New Quote');
    await d.click(page.getByRole('button', { name: 'New Quote' }), { pause: 2400 });

    const form = page.locator('form').last();
    const selects = form.locator('select');
    await d.select(selects.first(), { index: 1 });
    await d.say('Pick the patient the quote is for.', 2800);

    const offering = selects.last();
    if (await d.exists(offering)) {
      const options = await offering.locator('option').allTextContents();
      const programme = options.find((o) => /Diabetes management/i.test(o));
      if (programme) {
        await d.select(offering, { label: programme });
        await d.say(
          'Pull the line straight from the <b>service catalogue</b> and the price comes with it — no typing numbers from memory.',
          4600
        );
      }
    }

    const descr = form.locator('input[placeholder*="Item description"]').first();
    if (await d.exists(descr)) {
      const value = await descr.inputValue().catch(() => '');
      if (!value) await d.type(descr, 'Diabetes management programme, 12 weeks', { delay: 26 });
    }

    const price = form.locator('input[type="number"]').nth(1);
    if (await d.exists(price)) {
      const value = await price.inputValue().catch(() => '');
      if (!value || value === '0') await d.type(price, '240', { delay: 90 });
    }
    await d.say('Everything is itemised, so the patient can see what each part costs.', 3600);

    d.chapter('Terms and expiry');
    await d.step('Step 3 — Make it binding');
    const valid = form.locator('input[type="date"]').first();
    if (await d.exists(valid)) {
      const when = new Date();
      when.setDate(when.getDate() + 21);
      const iso = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, '0')}-${String(when.getDate()).padStart(2, '0')}`;
      await d.fill(valid, iso);
      await d.say(
        'Give it a <b>valid-until</b> date. A quote without an expiry is a price you have promised forever.',
        4400
      );
    }

    await d.scrollBy(240);
    const notes = form.locator('textarea').first();
    if (await d.exists(notes)) {
      await d.type(notes, 'Includes twelve weekly sessions and all review appointments.', { delay: 24 });
      await d.say('Say what is included. Most billing disputes are really scope disputes.', 3800);
    }

    d.chapter('Quote to invoice to paid');
    await d.step('Step 4 — Send it');
    await d.maybeClick(page.getByRole('button', { name: /Create|Save|Send/ }).last(), { pause: 3000 });
    await d.say('Saved and ready to send. Until the patient accepts, nobody is committed.', 4000);
    await d.say(
      'Once they accept, convert it to an <b>invoice</b> — same lines, same price, now a demand for payment.',
      4400
    );
    await d.say(
      'The invoice is what gets paid, and the payment closes it. Accounting picks it up from there.',
      4200
    );
    await d.step('');
  },
};
