/**
 * M1 — One patient, booking to bank deposit.
 *
 * The hero cut. Everything else in the marketing set is a cutdown of this or a
 * callback to it, so it carries the whole argument: one patient crosses booking,
 * a video visit, the chart, the claim and the payment without leaving the
 * product or being re-keyed into anything.
 *
 * Pacing runs at roughly double the training videos. A training viewer is
 * following along; this viewer is deciding whether to keep watching. Nothing is
 * explained that the screen already shows, and every confirmation step that is
 * not itself the point gets clicked through rather than narrated.
 */

module.exports = {
  id: 'M1',
  slug: 'm01-one-patient-booking-to-paid',
  marketing: true,
  pace: 0.5,
  title: 'One patient, booking to bank deposit',
  thumbHeadline: 'Booked to paid',
  thumbSub: 'One patient. One system. 90 seconds.',
  moduleLabel: 'Scheduling ▸ Telehealth ▸ Patients ▸ Billing',
  audience: 'Practice owner, COO',
  intro: 'A single visit travels the whole system: booked, seen on video, documented, claimed, paid.',
  journey: 'Book → video visit → chart → claim → payment posted',
  youtubeTitle: 'One patient, booking to bank deposit — AureonCare in 90 seconds',
  description:
    'One patient crosses the whole practice: a telehealth visit booked at the front desk, seen '
    + 'over video, documented in the chart, billed as a claim, and settled when the payment posts.\n\n'
    + 'No cuts between modules and no switching systems — the continuity is the point.\n\n'
    + '0:00 Booked\n0:25 Seen on video\n0:43 Documented\n0:58 Claimed\n1:22 Paid',
  tags: [
    'AureonCare', 'practice management software', 'medical billing software',
    'telehealth software', 'EHR demo', 'clinic software', 'revenue cycle management',
    'healthcare software demo', 'patient scheduling', 'medical practice software',
  ],
  recap: [
    'One patient, five stages, one system',
    'The visit carries its own context from booking to payment',
    'Nothing is re-keyed between modules',
  ],

  async run(d, page) {
    // The hook does the work of the title card in a fraction of the time: no
    // logo, no module label, just the claim the next ninety seconds has to earn.
    d.chapter('Booked');
    await d.card({
      heading: 'One patient. Booked to paid.',
      body: 'No cuts between systems, because there aren’t any.',
      holdMs: 2600,
      logo: false,
    });

    await d.step('Booked');
    await d.nav('Scheduling', 'Calendar');
    await d.say('Front desk books a virtual visit.', 1800);

    await d.click(page.getByRole('button', { name: 'New Appointment' }), { pause: 1100 });

    // Addressed by label rather than by index: the form carries an optional
    // Service dropdown between Type and Provider, and positional selects landed
    // on it — quietly attaching a priced programme and overriding the duration.
    await d.select(d.field('Patient', 'select'), { label: 'Sarah Williams - MRN-2025-001' });
    await d.select(d.field('Appointment Type', 'select'), { label: 'Telehealth consult' });
    await d.say('The type sets the duration and marks it virtual.', 2000);

    const when = new Date();
    when.setDate(when.getDate() + 1);
    const iso = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, '0')}-${String(when.getDate()).padStart(2, '0')}`;
    await d.fill(d.field('Date', 'input'), iso, { pause: 400 });
    await d.fill(d.field('Time', 'input'), '11:00', { pause: 400 });
    await d.select(d.field('Provider', 'select'), { label: 'Michael Anderson' });
    await d.type(d.field('Reason for Visit', 'input'), 'Medication review', { delay: 40, pause: 400 });

    // The booking has to actually complete — a hero cut whose first beat leaves
    // the form open argues the opposite of its own thesis. These use d.click
    // rather than d.maybeClick so a renamed button fails the recording instead
    // of quietly producing a video where nothing is ever saved.
    await d.click(page.getByRole('button', { name: /^Schedule Appointment$/ }).last(), { pause: 1200 });
    await d.click(page.getByRole('button', { name: /^Schedule$/ }).last(), { pause: 1600 });
    await d.maybeClick(page.getByRole('button', { name: /^OK$/ }).last(), { pause: 1200 });

    d.chapter('Seen on video');
    await d.step('Seen on video');
    await d.nav('Clinical', 'Telehealth');
    await d.say('It is already waiting in Telehealth.', 1800);

    await d.click(page.getByRole('button', { name: /New Session/i }), { pause: 1100 });
    await d.say('Patient, provider and time come with it.', 2000);

    const create = page.getByRole('button', { name: /^Create Session$/ }).first();
    await d.click(create, { pause: 1000 });
    const dialog = page.locator('div.fixed.inset-0').filter({ hasText: 'Create Telehealth Session' }).last();
    await dialog.waitFor({ timeout: 15000 }).catch(() => {});
    await d.click(dialog.getByRole('button', { name: /^Create Session$/ }), { pause: 2000 });

    // The link attaching itself to the visit is the beat that sells this
    // section, so it gets the narration and the scroll; joining the call is
    // ordinary and plays silently underneath.
    await d.say('A Meet room is created and attached to the visit.', 2400);
    await d.scrollBy(280);

    d.chapter('Documented');
    await d.step('Documented');
    await d.nav('Patients', 'Patient History');
    await d.click(page.getByRole('button', { name: /Sarah Williams/ }).first(), { pause: 1600 });
    await d.say('Same patient. The chart already knows her.', 2000);

    await d.click(page.getByRole('button', { name: /Edit Patient Chart/ }).first(), { pause: 1300 });
    const physical = page.getByRole('button', { name: /^Physical$/ });
    if (await d.exists(physical)) {
      await d.click(physical, { pause: 1100 });
      const numbers = page.locator('input[type="number"]:visible');
      const fields = await numbers.count();
      for (let i = 0; i < Math.min(fields, 2); i += 1) {
        await d.type(numbers.nth(i), ['78', '165'][i], { delay: 60, pause: 180 });
      }
      await d.say('Findings go in once, and chart themselves over time.', 2200);
    }
    await d.maybeClick(page.getByRole('button', { name: /^(Save|Update)/ }).last(), { pause: 1500 });

    d.chapter('Claimed');
    await d.step('Claimed');
    await d.nav('Billing', 'Claims');
    await d.say('The visit becomes a claim.', 2000);

    await d.click(page.getByRole('button', { name: 'New Claim' }), { pause: 1300 });
    const form = page.locator('form').last();
    const claimSelects = form.locator('select');
    await d.select(claimSelects.first(), { label: 'Sarah Williams - MRN-2025-001' });
    await d.say('Her insurance comes with her.', 1800);
    await page.waitForTimeout(700);

    const payer = claimSelects.nth(1);
    if (await d.exists(payer)) {
      const options = await payer.locator('option').allTextContents();
      const target = options.find((o) => /Blue Cross/i.test(o));
      if (target) await d.select(payer, { label: target });
    }

    // Service Date is required. Without it the submit is blocked, no claim is
    // created, and the payment beat later has nothing to post against.
    const serviceDate = new Date();
    serviceDate.setDate(serviceDate.getDate() - 1);
    const serviceIso = `${serviceDate.getFullYear()}-${String(serviceDate.getMonth() + 1).padStart(2, '0')}-${String(serviceDate.getDate()).padStart(2, '0')}`;
    await d.fill(form.locator('input[type="date"]').first(), serviceIso, { pause: 400 });
    await d.type(form.locator('input[type="number"]').first(), '180', { delay: 60 });

    // Bring the code fields to the middle of the frame first. Their search
    // results drop downward, and at the foot of the viewport they open beneath
    // the caption bar, which then swallows the click.
    await d.scrollBy(320);

    // Both code fields are required, so neither can be trimmed for pace even
    // though they play as the same beat twice.
    // Matched by role, not text: the "Select a previous diagnosis" dropdown
    // above carries the same codes as <option> elements, which sort earlier in
    // the DOM and cannot be clicked. Each search result is a real button.
    const dx = form.locator('input[placeholder*="diagnosis codes"]').first();
    await d.type(dx, 'E11', { delay: 80 });
    await page.waitForTimeout(900);
    await d.click(page.getByRole('button', { name: /E11\.9\b/ }).first(), { pause: 800 });

    const cpt = form.locator('input[placeholder*="procedure codes"]').first();
    await d.type(cpt, '99213', { delay: 80 });
    await page.waitForTimeout(900);
    await d.click(page.getByRole('button', { name: /99213/ }).first(), { pause: 800 });
    await d.say('Codes are searched, not remembered.', 2000);
    await d.click(page.getByRole('button', { name: /^Create Claim$/ }).last(), { pause: 1200 });
    // The confirmation modal renders ahead of the form in the DOM, so .last()
    // here would pick the form's own button — now behind the overlay, and the
    // click just times out against it.
    const claimDialog = page.locator('div.fixed.inset-0').last();
    await claimDialog.waitFor({ timeout: 15000 }).catch(() => {});
    await d.click(claimDialog.getByRole('button', { name: /^Create Claim$/ }), { pause: 1600 });

    d.chapter('Paid');
    await d.step('Paid');
    await d.nav('Billing', 'Payment Postings');
    await d.say('Money posts against the claim it settles.', 2000);

    await d.click(page.getByRole('button', { name: 'Post Payment' }), { pause: 1300 });

    // This form labels patients "name - date of birth" rather than the claim
    // form's "name - MRN", so match on the name instead of a label shape.
    const postPatient = d.field('Patient', 'select');
    const patientOptions = await postPatient.locator('option').allTextContents();
    const sarah = patientOptions.find((o) => /Sarah Williams/i.test(o));
    if (sarah) await d.select(postPatient, { label: sarah });
    // The claim list is filtered by the patient just chosen, so it only fills in
    // after that change has been applied.
    await page.waitForTimeout(900);
    const claim = d.field('Claim', 'select');
    const claimOptions = await claim.locator('option').allTextContents();
    const target = claimOptions.find((o) => /CLM-/i.test(o));
    // Loud on purpose: this list is filtered to the patient, so an empty one
    // means the claim beat never actually created a claim. Skipping quietly
    // here would leave the closing narration asserting something the screen
    // disproves.
    if (!target) {
      throw new Error(`No claim to post against — the claim beat did not create one. Options: ${JSON.stringify(claimOptions)}`);
    }
    await d.select(claim, { label: target });
    await d.type(d.field('Payment Amount', 'input'), '180', { delay: 60, pause: 400 });

    await d.click(page.getByRole('button', { name: /^Create Payment Posting$/ }).last(), { pause: 1200 });
    // "Post Payment" names two different controls: the page's own toolbar button
    // and the confirmation dialog's. The dialog renders after the form, so it is
    // the second one — and waiting for that second one to exist is also how we
    // know the dialog opened rather than the submit being rejected.
    const confirmPost = page.getByRole('button', { name: /^Post Payment$/ }).nth(1);
    await confirmPost.waitFor({ state: 'visible', timeout: 15000 });
    await d.click(confirmPost, { pause: 2000 });
    await d.say('Receivables are right. Nobody reconciled anything.', 2400);

    await d.card({
      heading: 'One patient. One system.',
      body: 'Booked, seen, documented, claimed, paid.',
      holdMs: 3800,
      keep: true,
    });
  },
};
