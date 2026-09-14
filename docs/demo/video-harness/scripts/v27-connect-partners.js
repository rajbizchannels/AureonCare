/**
 * V27 — Connect pharmacy, lab and payment partners.
 * Configure first, enable second — the screen enforces that order.
 */

module.exports = {
  id: 'V27',
  wave: 4,
  slug: 'v27-connect-pharmacy-lab-payment-partners',
  title: 'Connect pharmacy, lab and payment partners',
  thumbHeadline: 'Integrations',
  moduleLabel: 'Settings ▸ Integrations',
  audience: 'Admin',
  intro: 'Credentials in, sandbox first, then switch it on — and watch where each one surfaces.',
  journey: 'Integrations → configure Surescripts → sandbox vs live → enable → where each partner shows up',
  youtubeTitle: 'AureonCare: Connect Surescripts, Labcorp, Optum and Stripe',
  description:
    'Partner integrations in AureonCare. Configures Surescripts for ePrescribing with client '
    + 'credentials and a sandbox base URL, then enables it — and covers Labcorp for lab orders, '
    + 'Optum for claims and Stripe for payments, including what sandbox mode really means and '
    + 'where each integration shows up in daily work.\n\nPart of the AureonCare training series.',
  tags: [
    'AureonCare', 'healthcare integrations', 'surescripts', 'eprescribing setup',
    'labcorp integration', 'stripe healthcare payments', 'claims clearinghouse',
    'practice management software', 'clinic software setup', 'sandbox mode',
  ],
  recap: [
    'An integration must be configured before it can be enabled',
    'Sandbox proves the wiring; live is a deliberate, separate switch',
    'Each partner surfaces in one place — prescribing, lab orders, claims or payments',
  ],

  async run(d, page) {
    d.chapter('What can be connected');
    await d.step('Step 1 — Integrations');
    await d.nav('Settings', 'Integrations');
    await d.say(
      'Settings ▸ <b>Integrations</b> is every outside partner the clinic talks to, in one place.',
      4200
    );
    await d.say(
      '<b>Surescripts</b> for prescribing, <b>Labcorp</b> for lab orders, <b>Optum</b> for claims, <b>Stripe</b> for payments.',
      4600
    );
    await d.say(
      'Each one shows its state plainly: <b>Not Configured</b>, or <b>Active</b>. There is no in-between.',
      4200
    );

    d.chapter('Configuring one');
    await d.step('Step 2 — Open Surescripts');
    // Cards are ordered Stripe, Surescripts, Labcorp, Optum, then the
    // telehealth providers; the expand control carries no visible label.
    const expand = page.getByRole('button', { name: /Expand to configure/i }).nth(1);
    if (await d.exists(expand, 6000)) {
      await d.click(expand, { pause: 2000 });
    }
    await d.say(
      'Every partner asks for the same shape of thing: an <b>ID</b>, a <b>secret</b>, and the <b>URL</b> to talk to.',
      4600
    );

    await d.step('Step 3 — Credentials');
    const clientId = page.getByPlaceholder(/Enter client ID/i).first();
    if (await d.exists(clientId, 5000)) await d.type(clientId, 'aureoncare-demo-clinic', { delay: 35 });
    const clientSecret = page.getByPlaceholder(/Enter client secret/i).first();
    if (await d.exists(clientSecret, 3000)) await d.type(clientSecret, 'ss_demo_7f21c94a', { delay: 30 });
    const baseUrl = page.getByPlaceholder(/Enter base URL/i).first();
    if (await d.exists(baseUrl, 3000)) await d.type(baseUrl, 'https://sandbox.surescripts.example/v3', { delay: 20 });
    await d.say(
      'The secret is write-only. Once saved it is never shown again, not even to you.',
      4200
    );

    await d.step('Step 4 — Sandbox first');
    const sandbox = page.locator('input[type="checkbox"]').first();
    if (await d.exists(sandbox, 4000)) {
      await d.click(sandbox, { pause: 1600 });
    }
    await d.say(
      '<b>Sandbox mode</b> points at the partner&rsquo;s test system: real messages, real errors, no real prescriptions.',
      5000
    );
    await d.say(
      'Prove the wiring in sandbox, then clear this box. Going live should be a decision, not an accident.',
      4800
    );
    const saveCfg = page.getByRole('button', { name: /Save Configuration/i }).first();
    if (await d.exists(saveCfg, 3000)) await d.click(saveCfg, { pause: 2800 });

    d.chapter('Enabling, and where it lands');
    await d.step('Step 5 — Enable');
    await d.say(
      'Saved credentials turn the toggle live. Before that it reads <b>Configure integration first</b> and does nothing.',
      5000
    );
    await d.say(
      'That order is the whole rule of this screen: configure, then enable.',
      3800
    );

    await d.step('Step 6 — In daily work');
    await d.nav('Clinical', 'Pharmacies');
    await d.say(
      'Surescripts is what sends a prescription to the pharmacy the patient chose.',
      4000
    );
    await d.nav('Clinical', 'Laboratories');
    await d.say(
      'Labcorp is what carries a lab order out and the result back. Optum carries the claims, Stripe the card payments.',
      5000
    );
    await d.say(
      'Four integrations, four places they show up — and one screen that decides whether they are on.',
      4400
    );
    await d.step('');
  },
};
