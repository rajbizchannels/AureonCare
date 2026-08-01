/**
 * V08 — What your patients see.
 * Recorded from inside a patient's own account, not the staff-side preview.
 */

const F = require('../fixtures');

const sarah = F.patients[0];

module.exports = {
  id: 'V08',
  slug: 'v08-what-your-patients-see',
  title: 'What your patients see',
  thumbHeadline: 'The patient portal',
  moduleLabel: 'Patient Portal',
  audience: 'Front desk · clinician',
  intro: 'The portal from the patient’s side, so you can answer their questions with confidence.',
  journey: 'Patient signs in → overview → appointments → diagnoses → prescriptions → records → forms requested',
  youtubeTitle: 'AureonCare: What Your Patients See in the Portal',
  description:
    'A tour of the AureonCare patient portal from the patient’s own account: appointments, '
    + 'diagnoses, prescriptions, records and requested forms. Watch this so you can answer portal '
    + 'questions at the desk, and so you know what publishing to the chart exposes.\n\n'
    + 'Part of the AureonCare Getting Started series.',
  tags: [
    'AureonCare', 'patient portal', 'patient engagement', 'healthcare portal tutorial',
    'patient experience', 'medical records access', 'practice management software',
    'patient self service', 'clinic software', 'online health records',
  ],
  recap: [
    'Patients see appointments, diagnoses, prescriptions, records and requested forms',
    'What you save in the chart is what appears here — write for both readers',
    'Patients can book and complete forms themselves, which saves the desk a call',
  ],

  // Recorded from the patient's own session, so this is genuinely their view.
  sessionUser: {
    id: sarah.id,
    first_name: sarah.first_name,
    last_name: sarah.last_name,
    email: sarah.email,
    role: 'patient',
    patient_id: sarah.id,
    avatar: 'SW',
    practice: F.clinic.clinic_name,
    preferences: { darkMode: true, planTier: 'enterprise' },
  },

  async run(d, page) {
    d.chapter('The patient’s view');
    await d.step('Step 1 — Their account');
    await d.say(
      'This is not a staff preview. We are signed in as the patient — the portal is their whole app.',
      3800
    );
    await d.say(
      'The <b>Overview</b> opens on what is next: their upcoming appointment and anything waiting for them.',
      3600
    );
    await d.scrollBy(280);
    await d.scrollBy(-280);

    d.chapter('Appointments');
    await d.step('Step 2 — Appointments');
    await d.click(page.getByRole('button', { name: /^Appointments/ }).first(), { pause: 2400 });
    await d.say(
      'Patients see their own history and what is booked — which is most of the calls your desk takes.',
      3800
    );

    d.chapter('Diagnoses and prescriptions');
    await d.step('Step 3 — Their record');
    await d.click(page.getByRole('button', { name: /^Diagnoses/ }).first(), { pause: 2400 });
    await d.say('<b>Diagnoses</b> shows the problem list in plain terms, with the date each was made.', 3400);

    await d.click(page.getByRole('button', { name: /^Prescriptions/ }).first(), { pause: 2400 });
    await d.say('<b>Prescriptions</b> lists what is active, the dose, and how many refills remain.', 3400);

    await d.click(page.getByRole('button', { name: /^Records/ }).first(), { pause: 2400 });
    await d.say(
      '<b>Records</b> is the visit notes you save in the chart. Write them knowing the patient will read them.',
      4000
    );

    d.chapter('Forms and booking');
    await d.step('Step 4 — What they can do');
    const forms = page.getByRole('button', { name: /Forms Requested/ }).first();
    if (await d.exists(forms)) {
      await d.click(forms, { pause: 2400 });
      await d.say(
        '<b>Forms Requested</b> is where intake and consent forms land. Completed here, they arrive back on the chart.',
        4000
      );
    }

    const book = page.getByRole('button', { name: /Book Appointment/ }).first();
    if (await d.exists(book)) {
      await d.say('Patients can also book for themselves, within the rules you set.', 3000);
      await d.click(book, { pause: 2600 });
      await page.keyboard.press('Escape').catch(() => {});
    }
    await d.step('');
  },
};
