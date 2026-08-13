/**
 * V26 — Connect a video provider.
 * One clinic account, connected once, used by every provider.
 */

module.exports = {
  id: 'V26',
  wave: 4,
  slug: 'v26-connect-a-video-provider',
  title: 'Connect a video provider',
  thumbHeadline: 'Video setup',
  moduleLabel: 'Settings ▸ Telehealth Setup',
  audience: 'Admin',
  intro: 'Connect one account for the clinic, and every provider can start a visit.',
  journey: 'Telehealth Setup → connect an account → test the connection → enable → it powers Telehealth',
  youtubeTitle: 'AureonCare: Connect a Video Provider for Telehealth',
  description:
    'Telehealth setup in AureonCare. Connects a clinic video-conferencing account — Google Meet, '
    + 'Zoom, Webex or Microsoft Teams — tests the connection, enables it, and shows where it then '
    + 'takes effect: the join link on every telehealth appointment.\n\nPart of the AureonCare training series.',
  tags: [
    'AureonCare', 'telehealth setup', 'google meet integration', 'zoom for healthcare',
    'video visits', 'telemedicine software', 'practice management software',
    'virtual care setup', 'HIPAA telehealth', 'clinic video conferencing',
  ],
  recap: [
    'One clinic account — connected once, used by every provider',
    'Connect, test, then enable — in that order',
    'The active provider is what generates the join link on each visit',
  ],

  async run(d, page) {
    d.chapter('Where video is set up');
    await d.step('Step 1 — Telehealth Setup');
    await d.nav('Settings', 'Telehealth Setup');
    await d.say(
      'Settings ▸ <b>Telehealth Setup</b> holds the clinic&rsquo;s video account. Connect it once, and every provider uses it.',
      4800
    );
    await d.say(
      'Four providers are supported: <b>Google Meet</b>, <b>Zoom</b>, <b>Cisco Webex</b> and <b>Microsoft Teams</b>.',
      4200
    );

    d.chapter('Connecting an account');
    await d.step('Step 2 — Connect');
    await d.say(
      'Connecting is an <b>OAuth sign-in</b>: you approve it in the provider&rsquo;s own window and no password is ever stored here.',
      5000
    );
    await d.say(
      'Google Meet is already connected on this clinic — you can see the account it is connected as.',
      4400
    );

    await d.step('Step 3 — Test the connection');
    const test = page.getByRole('button', { name: /Test Connection/i }).first();
    if (await d.exists(test, 5000)) {
      await d.click(test, { pause: 2800 });
      await d.say(
        '<b>Test Connection</b> proves the token still works before a patient is waiting on it.',
        4200
      );
    }
    await d.say(
      'If a token has expired, <b>Reconnect</b> re-runs the sign-in — nothing else needs changing.',
      4200
    );

    d.chapter('Turning it on');
    await d.step('Step 4 — Enable');
    await d.say(
      'The switch on the right makes it the <b>active</b> provider. An account that is not connected cannot be switched on.',
      4800
    );
    await d.say(
      'That is deliberate: it stops a half-configured provider from becoming the one your visits depend on.',
      4400
    );

    await d.step('Step 5 — Where it shows up');
    await d.nav('Clinical', 'Telehealth');
    await d.say(
      'And this is the payoff. Every telehealth appointment now gets a join link from that account.',
      4400
    );
    await d.say(
      'Provider and patient both open the same link. Change the provider here and every future visit follows.',
      4600
    );
    await d.step('');
  },
};
