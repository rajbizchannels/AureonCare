/**
 * V09 — Get a pre-authorization approved.
 * Do this before the visit, not after the denial.
 */

module.exports = {
  id: 'V09',
  wave: 2,
  slug: 'v09-get-a-pre-authorization-approved',
  title: 'Get a pre-authorization approved',
  thumbHeadline: 'Get a pre-auth approved',
  moduleLabel: 'Billing ▸ Pre-Authorizations',
  audience: 'Billing',
  intro: 'Request approval before the service, and track it to a decision.',
  journey: 'Pre-Authorizations queue → Request Pre-Authorization → patient, service, codes, cost → submit → track to Approved',
  youtubeTitle: 'AureonCare: Get a Pre-Authorization Approved',
  description:
    'Requesting and tracking an insurance pre-authorization in AureonCare. Covers the '
    + 'pre-authorization queue and what each status means, building a request with the '
    + 'service description and the ICD-10 and CPT codes that justify it, and following it '
    + 'through to an approval with an authorization number.\n\n'
    + 'Part of the AureonCare Getting Started series.',
  tags: [
    'AureonCare', 'pre-authorization', 'prior authorization', 'insurance approval',
    'revenue cycle management', 'medical billing', 'preauth tutorial',
    'practice management software', 'healthcare billing', 'payer authorization',
  ],
  recap: [
    'Billing ▸ Pre-Authorizations ▸ Request Pre-Authorization, before the service',
    'The clinical justification and codes are what the payer actually reviews',
    'Approved returns an authorization number — put it on the claim',
  ],

  async run(d, page) {
    d.chapter('The pre-auth queue');
    await d.step('Step 1 — The queue');
    await d.nav('Billing', 'Pre-Authorizations');
    await d.say(
      'Billing ▸ <b>Pre-Authorizations</b> is where you ask a payer to agree <i>before</i> you deliver the service.',
      4000
    );
    await d.say(
      'Every request sits here with its status — <b>pending</b> waiting on the payer, <b>approved</b> good to go, <b>denied</b> needs another route.',
      4400
    );
    await d.say(
      'Get this wrong and the work is already done when the refusal arrives. That is why it lives before the visit.',
      4200
    );

    d.chapter('Making the request');
    await d.step('Step 2 — New request');
    await d.click(page.getByRole('button', { name: 'Request Pre-Authorization' }), { pause: 2200 });

    const form = page.locator('form').last();
    const selects = form.locator('select');
    await d.select(selects.first(), { index: 1 });
    await d.say('Pick the patient — the request carries their insurance across automatically.', 3400);

    const service = form.locator('input[placeholder*="MRI"]').first();
    await d.type(service, 'MRI lumbar spine without contrast', { delay: 32 });
    await d.say(
      'Describe the service in the payer&rsquo;s language, not shorthand. A vague description is a slow decision.',
      4000
    );

    const dates = form.locator('input[type="date"]');
    if (await d.exists(dates.first())) {
      const when = new Date();
      when.setDate(when.getDate() + 7);
      const iso = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, '0')}-${String(when.getDate()).padStart(2, '0')}`;
      await d.fill(dates.first(), iso);
    }

    d.chapter('Justifying it');
    await d.step('Step 3 — Codes and cost');
    const dx = form.locator('input[placeholder*="ICD-10"]').first();
    if (await d.exists(dx)) {
      await d.type(dx, 'E11', { delay: 120 });
      await page.waitForTimeout(1100);
      await d.say(
        'The diagnosis is <b>why</b> the service is needed — searched from the code set, never typed from memory.',
        4000
      );
      await d.maybeClick(page.getByText(/E11\.9/).first(), { pause: 1300 });
    }

    const cpt = form.locator('input[placeholder*="CPT"]').first();
    if (await d.exists(cpt)) {
      await d.type(cpt, '99213', { delay: 120 });
      await page.waitForTimeout(1100);
      await d.maybeClick(page.getByText(/99213/).last(), { pause: 1300 });
    }

    const cost = form.locator('input[type="number"]').first();
    if (await d.exists(cost)) await d.type(cost, '1450', { delay: 90 });
    await d.say('The estimated cost sets expectations for the patient as well as the payer.', 3600);

    await d.scrollBy(240);
    const notes = form.locator('textarea').first();
    if (await d.exists(notes)) {
      await d.type(
        notes,
        'Six weeks of conservative treatment documented without improvement. Imaging required before referral.',
        { delay: 22 }
      );
      await d.say(
        'This box is the one a reviewer reads. Say what you already tried — that is what turns pending into approved.',
        4400
      );
    }

    d.chapter('Tracking the decision');
    await d.step('Step 4 — Submit and track');
    await d.maybeClick(
      page.getByRole('button', { name: /Submit|Create|Save/ }).last(),
      { pause: 3000 }
    );
    await d.say('Submitted. It joins the queue as <b>pending</b> while the payer reviews it.', 3600);
    await d.say(
      'When it comes back <b>approved</b> you get an authorization number — that number goes on the claim, or the claim gets denied.',
      4600
    );
    await d.step('');
  },
};
