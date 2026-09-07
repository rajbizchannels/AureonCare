/**
 * V23 — Package services and run a promotion.
 */

module.exports = {
  id: 'V23',
  wave: 3,
  slug: 'v23-package-services-and-promotions',
  title: 'Package services and run a promotion',
  thumbHeadline: 'Packages & promotions',
  moduleLabel: 'Growth ▸ Service Catalog',
  audience: 'Manager',
  intro: 'Price a service once, and it follows through booking, quotes and invoices.',
  journey: 'Services → categories → packages → promotions → statistics',
  youtubeTitle: 'AureonCare: Service Packages and Promotions',
  description:
    'The service catalogue in AureonCare: services and their prices, grouping them into '
    + 'categories, bundling them into packages with a saving, running a time-limited '
    + 'promotion, and reading which of them actually sell.\n\n'
    + 'Part of the AureonCare training series.',
  tags: [
    'AureonCare', 'service catalog', 'healthcare pricing', 'medical service packages',
    'clinic promotions', 'practice management software', 'patient billing',
    'healthcare marketing', 'service bundles', 'clinic revenue',
  ],
  recap: [
    'A service is priced once and that price follows it everywhere',
    'Packages bundle services and show the saving explicitly',
    'Promotions are time-limited and tracked against usage',
  ],

  async run(d, page) {
    d.chapter('The catalogue');
    await d.step('Step 1 — Services');
    await d.nav('Growth', 'Services');
    await d.say(
      'Growth ▸ <b>Services</b> is the catalogue: everything the clinic sells, priced once.',
      3800
    );
    await d.say(
      'That price is what booking, quotes and invoices all read — change it here and it changes everywhere.',
      4400
    );

    d.chapter('Grouping and bundling');
    await d.step('Step 2 — Categories');
    const categories = page.getByRole('button', { name: /^Categories/ }).first();
    if (await d.exists(categories)) {
      await d.click(categories, { pause: 2200 });
      await d.say('<b>Categories</b> group them for the patient — chronic care, preventive, and so on.', 3800);
    }

    await d.step('Step 3 — Packages');
    const packages = page.getByRole('button', { name: /^Packages/ }).first();
    if (await d.exists(packages)) {
      await d.click(packages, { pause: 2400 });
      await d.say(
        '<b>Packages</b> bundle services at a set price, and show the saving explicitly — that is what makes them sell.',
        4600
      );
    }

    d.chapter('Promotions, and what sells');
    await d.step('Step 4 — Promotions');
    const promos = page.getByRole('button', { name: /^Promotions/ }).first();
    if (await d.exists(promos)) {
      await d.click(promos, { pause: 2400 });
      await d.say(
        '<b>Promotions</b> carry a code, a discount and a window. They expire on their own, so nothing runs forever by accident.',
        4800
      );
    }

    await d.step('Step 5 — Statistics');
    const stats = page.getByRole('button', { name: /^Statistics/ }).first();
    if (await d.exists(stats)) {
      await d.click(stats, { pause: 2400 });
      await d.say(
        '<b>Statistics</b> closes the loop: which services and packages actually get booked.',
        3800
      );
    }
    await d.step('');
  },
};
