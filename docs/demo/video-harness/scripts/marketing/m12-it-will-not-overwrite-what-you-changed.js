/**
 * M12 — It will not overwrite the thing you changed
 *
 * The configuration cut, aimed at whoever has been burned by a vendor "update"
 * that restored its own defaults over a year of local edits.
 *
 * A new practice starts generic: every module, every menu item, no services.
 * The wizard asks what the practice actually does and creates the starter
 * content for it. The reason that is safe — and the whole reason this is a
 * video rather than a release note — is the preview: nothing is written until
 * the last step, and anything the practice has already edited is reported and
 * then left alone rather than restored.
 *
 * Deviation from the plan: the plan wanted terminology overrides shown too
 * ("provider" becoming "clinician"). Cut for time — it is a genuinely good
 * detail but it needs the shell re-rendered to land, and the never-overwrite
 * rule is the claim that actually sells the feature.
 */

module.exports = {
  id: 'M12',
  slug: 'm12-it-will-not-overwrite-what-you-changed',
  marketing: true,
  pace: 0.5,
  title: 'It will not overwrite the thing you changed',
  thumbHeadline: 'Set up in a minute.',
  thumbSub: 'Nothing written until you say so.',
  moduleLabel: 'Settings ▸ Practice Setup',
  audience: 'New practice owner, implementation lead, CMO',
  intro: 'Starter content for your specialty — that never restores itself over your edits.',
  journey: 'Practice Setup → pick specialties → preview → what is left alone → apply',
  youtubeTitle: 'Specialty setup that never overwrites your edits | AureonCare',
  description:
    'Every practice management system starts the same way: generic. Every module switched on, no '
    + 'services, and a week of typing before it resembles the practice using it.\n\n'
    + 'The specialty wizard asks what this practice actually does and creates the services, '
    + 'appointment types and forms to match. The part worth watching is the preview: nothing is '
    + 'written until the final step, and anything the practice has already edited is listed and '
    + 'then left exactly as it is. A later pack update will not quietly restore its own version '
    + 'over yours.',
  tags: [
    'AureonCare', 'practice setup', 'EHR onboarding', 'specialty configuration',
    'clinic software setup', 'healthcare implementation', 'practice management', 'healthcare IT',
  ],
  recap: [
    'Pick a specialty, get the services and forms for it',
    'Preview shows exactly what changes before anything is written',
    'Rows you already edited are reported and left alone',
  ],

  async run(d, page) {
    d.chapter('Generic by default');
    await d.card({
      heading: 'Every system starts generic.',
      body: 'Yours does not have to stay that way.',
      holdMs: 2800,
      logo: false,
    });

    await d.step('Set it up');
    await d.nav('Settings', 'Practice Setup');
    await d.say('Six steps, and nothing is written until the last one.', 2800);

    d.chapter('What this practice does');
    await d.step('What this practice does');
    await d.click(page.getByRole('button', { name: /^Next$/ }).first(), { pause: 1400 });
    await d.say('Pick what the practice actually is.', 2200);
    // The specialty name shares its element with the pack-version badge
    // ("Family medicine  pack v1.2"), so there is no element whose text is the
    // name alone. Click the row's label, which also toggles its checkbox.
    await d.click(page.locator('label').filter({ hasText: 'Family medicine' }).first(), { pause: 1100 });
    await d.click(page.locator('label').filter({ hasText: 'Paediatrics' }).first(), { pause: 1300 });
    // The first pick leads. A multi-specialty practice needs a tie-breaker for
    // terminology and defaults, and this is where it is decided.
    await d.say('More than one is fine. The first one leads where packs disagree.', 3200);

    d.chapter('Before anything is written');
    await d.step('Before anything is written');
    // Specialty is step 2 of 6, so four Nexts reach Review and apply.
    for (let i = 0; i < 4; i += 1) {
      await d.click(page.getByRole('button', { name: /^Next$/ }).first(), { pause: 900 });
    }
    await d.say('Then the step that matters.', 1800);
    await d.click(page.getByRole('button', { name: /^Preview changes$/ }).first(), { pause: 1800 });
    await d.say('Twenty-three things to create. Four already there.', 2800);

    await d.step('And two it will not touch');
    await d.scrollBy(300);
    await d.say('And two it refuses to touch.', 2200);
    await d.say('You changed the annual physical to forty minutes. It stays forty minutes.', 3400);
    await d.say('A pack never restores its own version over an edit you made.', 3000);

    await d.card({
      heading: 'Configured, not overwritten.',
      body: 'Your edits outrank the vendor’s defaults.',
      holdMs: 3800,
      keep: true,
    });
  },
};
