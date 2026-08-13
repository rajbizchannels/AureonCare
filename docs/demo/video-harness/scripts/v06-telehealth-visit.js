/**
 * V06 — Run a telehealth visit.
 * Scheduled session vs instant meeting, and where the join link comes from.
 */

module.exports = {
  id: 'V06',
  slug: 'v06-run-a-telehealth-visit',
  title: 'Run a telehealth visit',
  thumbHeadline: 'Run a virtual visit',
  moduleLabel: 'Clinical ▸ Telehealth',
  audience: 'Clinician',
  intro: 'Create a virtual visit from an appointment, attach a consent form, and join it.',
  journey: 'Active provider → New Session → pick appointment → session created with join link → Join',
  youtubeTitle: 'AureonCare: Run a Telehealth Visit (Start to Finish)',
  description:
    'Running a virtual visit in AureonCare. Covers the active provider banner, creating a session '
    + 'from a scheduled appointment, attaching a pre-session consent form, the difference between a '
    + 'scheduled session and an instant meeting, and joining the call.\n\n'
    + 'Part of the AureonCare Getting Started series.',
  tags: [
    'AureonCare', 'telehealth software', 'virtual visit', 'telemedicine tutorial',
    'video consultation', 'healthcare software', 'remote patient visit', 'telehealth workflow',
    'practice management software', 'Google Meet telehealth',
  ],
  recap: [
    'Clinical ▸ Telehealth ▸ New Session, built from a scheduled appointment',
    'Pre-session forms land in the patient’s portal before the call',
    'Instant meeting is for now; a session is for a booked visit',
  ],

  async run(d, page) {
    d.chapter('The telehealth module');
    await d.step('Step 1 — Open Telehealth');
    await d.nav('Clinical', 'Telehealth');
    await d.say(
      'Clinical ▸ <b>Telehealth</b>. The green banner names the connected platform — here, Google Meet.',
      3600
    );
    await d.say(
      'Your administrator connects that account once. Clinicians never touch credentials.',
      3200
    );

    d.chapter('Creating the session');
    await d.step('Step 2 — New Session');
    await d.click(page.getByRole('button', { name: /New Session/i }), { pause: 1800 });
    await d.say(
      'A session is built <b>from a booked appointment</b>, so the patient, provider and time are already right.',
      3800
    );

    const forms = page.getByRole('button', { name: /Pre-Session Forms/i });
    if (await d.exists(forms)) {
      await d.click(forms, { pause: 1400 });
      const consent = page.getByText(/Telehealth consent/i).first();
      if (await d.exists(consent)) {
        await d.click(consent, { pause: 1200 });
      }
      await d.say(
        'Attach a consent form and it arrives in the patient’s portal before the call, not during it.',
        3800
      );
      await d.click(forms, { pause: 900 });
    }

    await d.step('Step 3 — Create it');
    const create = page.getByRole('button', { name: /^Create Session$/ }).first();
    await d.click(create, { pause: 1500 });
    const dialog = page.locator('div.fixed.inset-0').filter({ hasText: 'Create Telehealth Session' }).last();
    await dialog.waitFor({ timeout: 15000 }).catch(() => {});
    await d.say('AureonCare confirms what it is about to do, then creates the meeting.', 2800);
    await d.click(dialog.getByRole('button', { name: /^Create Session$/ }), { pause: 3000 });

    d.chapter('Joining the visit');
    await d.say(
      'The visit now sits under <b>Upcoming Sessions</b>, tagged with the platform and carrying its join link.',
      3800
    );
    await d.scrollBy(280);

    await d.step('Step 4 — Join');
    const join = page.getByRole('button', { name: /^Join$/ }).first();
    if (await d.exists(join)) {
      await d.click(join, { pause: 1400 });
      const joinDialog = page.locator('div.fixed.inset-0').filter({ hasText: 'Join Telehealth Session' }).last();
      await joinDialog.waitFor({ timeout: 15000 }).catch(() => {});
      await d.say('Joining marks the session in progress, so the rest of the team can see you are in it.', 3400);
      await d.click(joinDialog.getByRole('button', { name: /^Join Session$/ }), { pause: 2600 });
      const links = await page.evaluate(() => window.__demoOpenedUrls || []);
      const meet = [...links].reverse().find((u) => String(u).includes('meet.google.com'));
      if (meet) {
        await d.say(`The meeting room opens in a new tab: <b>${meet}</b>`, 3600);
      }
    }

    await d.say(
      'Need a call right now with no booking behind it? <b>Instant</b> creates a room immediately — use it for the unplanned.',
      4000
    );
    await d.step('');
  },
};
