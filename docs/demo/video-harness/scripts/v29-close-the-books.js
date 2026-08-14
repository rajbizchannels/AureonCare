/**
 * V29 — Close the books.
 * How clinical and billing activity ends up in the ledger.
 */

module.exports = {
  id: 'V29',
  wave: 4,
  slug: 'v29-close-the-books',
  title: 'Close the books',
  thumbHeadline: 'Month end',
  moduleLabel: 'Operations ▸ Accounting',
  audience: 'Finance',
  intro: 'Every visit, claim and payment lands in the ledger. This is where you check that it did.',
  journey: 'Overview → chart of accounts → journal → receivables and payables → reconcile → statements',
  youtubeTitle: 'AureonCare: Close the Books — Accounting for a Clinic',
  description:
    'Month-end accounting in AureonCare. Walks the chart of accounts, posts a journal entry, '
    + 'reads the receivables and payables ageing, completes a reconciliation against a bank '
    + 'statement and sends a patient statement — showing how clinical and billing activity '
    + 'reaches the ledger automatically.\n\nPart of the AureonCare training series.',
  tags: [
    'AureonCare', 'medical practice accounting', 'clinic bookkeeping', 'chart of accounts',
    'journal entries', 'accounts receivable', 'bank reconciliation', 'practice management software',
    'healthcare finance', 'month end close',
  ],
  recap: [
    'Clinical and billing activity posts to the ledger on its own — you review, not re-key',
    'A draft entry changes nothing until it is posted',
    'Reconciliation is the check that the ledger matches the bank',
  ],

  async run(d, page) {
    d.chapter('Where the money is');
    await d.step('Step 1 — Accounting Overview');
    await d.nav('Operations', 'Accounting Overview');
    await d.say(
      'Operations ▸ <b>Accounting</b> opens on four numbers: what you are owed, what you owe, cash, and anything unposted.',
      5000
    );
    await d.say(
      '<b>Module Integrations</b> is the important part — these accounts are wired to claims, billing and payments.',
      4600
    );
    await d.say(
      'Which means the ledger fills itself in. Your job here is to check it, not to type it again.',
      4400
    );

    d.chapter('The accounts, and the entries');
    await d.step('Step 2 — Chart of Accounts');
    await d.nav('Operations', 'Chart of Accounts');
    await d.say(
      'The <b>chart of accounts</b> is the shape of the books: assets, liabilities, equity, revenue, expense.',
      4600
    );
    await d.say(
      'The ones marked as system accounts are the ones other modules post into — leave those alone.',
      4400
    );

    await d.step('Step 3 — Journal');
    await d.nav('Operations', 'Journal');
    await d.say(
      'The <b>journal</b> is every entry, with what created it: a remittance, a supplier invoice, or someone here by hand.',
      5000
    );
    await d.say(
      'A <b>draft</b> changes no balance. Only <b>posting</b> does — which is why the draft count is on the overview.',
      4800
    );
    const post = page.getByRole('button', { name: /^Post$/i }).first();
    if (await d.exists(post, 5000)) {
      await d.click(post, { pause: 2800 });
      await d.say(
        'Posted. Debits and credits balance, or the entry would not have been allowed to post at all.',
        4400
      );
    }

    d.chapter('Owed to you, owed by you');
    await d.step('Step 4 — Receivables');
    await d.nav('Operations', 'Receivables');
    await d.say(
      '<b>Receivables</b> is what has not been paid yet, bucketed by how late it is — current, thirty days, sixty.',
      5000
    );
    await d.say(
      'Insurance and patient balances sit side by side, so chasing work can be sorted by age rather than by guess.',
      4800
    );

    await d.step('Step 5 — Payables');
    await d.nav('Operations', 'Payables');
    await d.say(
      '<b>Payables</b> is the other direction — supplier invoices, including the ones raised by receiving stock.',
      4800
    );

    d.chapter('Proving it, then sending it');
    await d.step('Step 6 — Reconciliation');
    await d.nav('Operations', 'Reconciliation');
    await d.say(
      '<b>Reconciliation</b> is the honest check: the bank&rsquo;s balance against ours, and the difference between them.',
      5000
    );
    await d.say(
      'A non-zero discrepancy is the whole point of the screen — it is a thing to explain before you close the month.',
      4800
    );
    const complete = page.getByRole('button', { name: /^Complete$/i }).first();
    if (await d.exists(complete, 4000)) await d.click(complete, { pause: 2600 });

    await d.step('Step 7 — Statements');
    await d.nav('Operations', 'Statements');
    await d.say(
      '<b>Statements</b> close the loop with the payer or the patient: opening balance, charges, payments, what is left.',
      5000
    );
    const send = page.getByRole('button', { name: /^Send$/i }).first();
    if (await d.exists(send, 4000)) {
      await d.click(send, { pause: 2600 });
      await d.say(
        'Sent, and marked as sent. The books are closed, and every number on them can be traced back to a visit.',
        4800
      );
    }
    await d.step('');
  },
};
