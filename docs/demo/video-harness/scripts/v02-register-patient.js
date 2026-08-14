/**
 * V02 — Register a new patient.
 * The first record every clinic creates, and the fields that matter downstream.
 */

module.exports = {
  id: 'V02',
  slug: 'v02-register-a-new-patient',
  title: 'Register a new patient',
  thumbHeadline: 'Register a patient',
  moduleLabel: 'Patients ▸ Electronic Health Records',
  audience: 'Front desk',
  intro: 'Create a patient record properly, so scheduling, billing and the portal all work later.',
  journey: 'Patient list → New Patient → demographics, contact, insurance, emergency contact → save → find them again',
  youtubeTitle: 'AureonCare: Register a New Patient (Step by Step)',
  description:
    'How to create a patient record in AureonCare, and which fields matter downstream. '
    + 'Insurance details drive claims, the email address drives the patient portal, and the '
    + 'MRN is generated for you.\n\n'
    + 'Part of the AureonCare Getting Started series.',
  tags: [
    'AureonCare', 'patient registration', 'add new patient', 'EHR tutorial',
    'medical records software', 'practice management software', 'patient intake',
    'clinic front desk training', 'healthcare software', 'patient demographics',
  ],
  recap: [
    'Patients ▸ Electronic Health Records ▸ New Patient',
    'Insurance drives claims; email drives the portal; the MRN is automatic',
    'Search by name, MRN, email or phone to find the record again',
  ],

  async run(d, page) {
    d.chapter('The patient list');
    await d.step('Step 1 — Open the patient list');
    await d.nav('Patients', 'Electronic Health Records');
    await d.say(
      'Patients ▸ <b>Electronic Health Records</b> is the register: every patient the practice knows.',
      3200
    );
    await d.say('Search accepts a name, an MRN, an email or a phone number.', 2600);

    d.chapter('Creating the record');
    await d.step('Step 2 — New Patient');
    await d.click(page.getByRole('button', { name: 'New Patient', exact: true }), { pause: 1600 });
    await d.say('<b>New Patient</b> opens one form. Required fields are marked; the rest can follow later.', 3200);

    const inputs = page.locator('form input[type="text"]');
    await d.type(inputs.nth(0), 'Elena');
    await d.type(inputs.nth(1), 'Marchetti');
    await d.fill(page.locator('form input[type="date"]').first(), '1991-03-14');
    await d.select(page.locator('form select').first(), { label: 'Female' });
    await d.say('Name, date of birth and gender identify the record. The MRN is generated for you.', 3400);

    d.chapter('Contact and insurance');
    await d.step('Step 3 — Contact details');
    await d.type(page.locator('input[type="tel"]').first(), '555-0126');
    await d.type(page.locator('input[type="email"]').first(), 'elena.marchetti@example.com');
    await d.say(
      'The email address is what invites this patient to the portal later — worth getting right at the desk.',
      3600
    );

    await d.type(page.locator('input[placeholder="Enter address"]'), '77 Belmont Rise');
    const cityZip = page.locator('form input[type="text"]');
    await d.type(cityZip.nth(3), 'Portland');
    await d.type(page.locator('input[placeholder="Enter state"]'), 'OR');
    await d.type(page.locator('input[placeholder="Enter ZIP code"]'), '97214');
    await d.scrollBy(320);

    await d.step('Step 4 — Insurance');
    const payer = page.locator('form select').nth(1);
    if (await d.exists(payer)) {
      await d.select(payer, { label: 'Blue Cross Blue Shield (BCBS001)' });
    }
    const policy = page.locator('input[placeholder="Enter insurance ID"]');
    if (await d.exists(policy)) await d.type(policy, 'BCBS-44120');
    await d.say(
      'Insurance is what claims are built from. A record without it will bill as self-pay.',
      3600
    );

    await d.scrollBy(300);
    const contactName = page.locator('input[placeholder="Contact name"]');
    if (await d.exists(contactName)) {
      await d.type(contactName, 'Luca Marchetti');
      await d.type(page.locator('input[placeholder="Contact phone number"]'), '555-0127');
      await d.say('An emergency contact takes ten seconds now and matters on the worst day.', 3000);
    }

    d.chapter('Saving and finding the record');
    await d.step('Step 5 — Save');
    await d.click(page.getByRole('button', { name: 'Add Patient' }).first(), { pause: 1600 });
    // AureonCare asks before it writes; the confirmation carries the same label.
    const confirm = page.locator('div.fixed.inset-0')
      .filter({ hasText: 'Are you sure you want to add this patient' }).last();
    if (await d.exists(confirm)) {
      await d.say('AureonCare confirms before it writes a new record.', 2400);
      await d.click(confirm.getByRole('button', { name: /^Add Patient$/ }), { pause: 3000 });
    }
    await d.say('Saved. The patient joins the register immediately, with an MRN assigned.', 3200);

    const search = page.locator('input[placeholder*="Search patients"]');
    if (await d.exists(search)) {
      await d.type(search, 'Marchetti', { delay: 90 });
      await page.waitForTimeout(900);
      await d.say('Searching by surname brings the new record straight back.', 3000);
    }
    await d.step('');
  },
};
