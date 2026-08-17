/**
 * V28 — Stock: item to purchase order to receipt.
 * The full loop, ending with the stock number actually moving.
 */

module.exports = {
  id: 'V28',
  wave: 4,
  slug: 'v28-stock-item-to-purchase-order-to-receipt',
  title: 'Stock: item to purchase order to receipt',
  thumbHeadline: 'Stock control',
  moduleLabel: 'Operations ▸ Inventory',
  audience: 'Ops',
  intro: 'Set a reorder level once, and the shelf tells you when to order.',
  journey: 'Overview → new item → record a movement → approve a purchase order → receive it',
  youtubeTitle: 'AureonCare: Inventory from Item to Purchase Order to Receipt',
  description:
    'Inventory management in AureonCare. Creates an item with a category, supplier and reorder '
    + 'level, records a stock movement, then approves a purchase order and receives it — with the '
    + 'stock level updating on receipt. Explains why the reorder level is the setting that makes '
    + 'low-stock alerts worth having.\n\nPart of the AureonCare training series.',
  tags: [
    'AureonCare', 'medical inventory management', 'clinic stock control', 'purchase orders',
    'reorder level', 'inventory software healthcare', 'practice management software',
    'stock movements', 'medical supplies tracking', 'vaccine inventory',
  ],
  recap: [
    'The reorder level is what turns a stock count into an alert',
    'Every movement is recorded — dispensed, adjusted, written off',
    'Receiving a purchase order is what actually raises the stock',
  ],

  async run(d, page) {
    d.chapter('What is on the shelf');
    await d.step('Step 1 — Inventory Overview');
    await d.nav('Operations', 'Inventory Overview');
    await d.say(
      'Operations ▸ <b>Inventory</b> opens on the numbers that matter: total value, what is low, what is about to expire.',
      4800
    );
    await d.say(
      '<b>Low Stock Alerts</b> is the working list — two items are below the level someone set for them.',
      4400
    );

    d.chapter('Adding an item');
    await d.step('Step 2 — New item');
    await d.nav('Operations', 'Items');
    const newItem = page.getByRole('button', { name: /New Item/i }).first();
    if (await d.exists(newItem, 5000)) await d.click(newItem, { pause: 2000 });

    // The form opens inline on the page, not in an overlay, so its fields are
    // addressed directly — and each select is found by an option only it has,
    // which survives the filter dropdowns above it being reordered.
    const selectWith = (value) =>
      page.locator('select').filter({ has: page.locator(`option[value="${value}"]`) }).first();

    const name = page.getByPlaceholder(/Nitrile Gloves/i).first();
    if (await d.exists(name, 5000)) await d.type(name, 'Nitrile gloves, large (box of 100)', { delay: 30 });
    const sku = page.getByPlaceholder(/Stock-keeping unit/i).first();
    if (await d.exists(sku, 3000)) await d.type(sku, 'CON-GLV-L', { delay: 40 });

    const unit = selectWith('box');
    if (await d.exists(unit, 3000)) await d.select(unit, 'box').catch(() => {});
    await d.say(
      'An item needs a <b>name</b>, a <b>type</b> and the <b>unit</b> you actually count it in — boxes, vials, doses.',
      4800
    );

    const category = page.locator('select').filter({ hasText: 'Consumables' }).first();
    if (await d.exists(category, 3000)) {
      const value = await category.locator('option', { hasText: /Consumables/ }).first()
        .getAttribute('value').catch(() => null);
      if (value) await d.select(category, value).catch(() => {});
    }
    const supplier = page.locator('select').filter({ hasText: 'Cascade Medical Supply' }).first();
    if (await d.exists(supplier, 3000)) {
      const value = await supplier.locator('option', { hasText: /Cascade/ }).first()
        .getAttribute('value').catch(() => null);
      if (value) await d.select(supplier, value).catch(() => {});
    }
    await d.say(
      'A <b>category</b> groups it on the overview, and a <b>supplier</b> is who the purchase order goes to.',
      4400
    );

    const cost = page.getByPlaceholder('0.00').first();
    if (await d.exists(cost, 3000)) await d.fill(cost, '7.40');
    const reorder = page.getByPlaceholder(/Minimum qty before reorder/i).first();
    if (await d.exists(reorder, 3000)) await d.fill(reorder, '20');
    const reorderQty = page.getByPlaceholder(/Qty to reorder/i).first();
    if (await d.exists(reorderQty, 3000)) await d.fill(reorderQty, '40');
    await d.say(
      'The <b>reorder level</b> is the one setting that earns its keep — it is what turns a count into an alert.',
      4800
    );
    await d.say(
      'Set it to what you get through between deliveries, plus a little. Too low and you find out by running out.',
      4800
    );

    const create = page.getByRole('button', { name: /^Create Item$/i }).first();
    if (await d.exists(create, 3000)) await d.click(create, { pause: 2800 });

    d.chapter('Stock going out');
    await d.step('Step 3 — Record a movement');
    await d.nav('Operations', 'Stock');
    const record = page.getByRole('button', { name: /Record Movement/i }).first();
    if (await d.exists(record, 5000)) await d.click(record, { pause: 2000 });

    // Also an inline form. The item picker is the select that lists the stock
    // items; the type picker is the one carrying the movement values.
    const itemSel = page.locator('select').filter({ hasText: 'Influenza' }).first();
    if (await d.exists(itemSel, 5000)) {
      const value = await itemSel.locator('option', { hasText: /Influenza/i }).first()
        .getAttribute('value').catch(() => null);
      if (value) await d.select(itemSel, value).catch(() => {});
    }
    const typeSel = page.locator('select').filter({ has: page.locator('option[value="adjustment"]') }).first();
    if (await d.exists(typeSel, 3000)) await d.select(typeSel, 'out').catch(() => {});
    const qty = page.getByPlaceholder(/Always positive/i).first();
    if (await d.exists(qty, 3000)) await d.fill(qty, '4');
    const notes = page.getByPlaceholder(/Reason, reference/i).first();
    if (await d.exists(notes, 3000)) await d.type(notes, 'Administered — Tuesday flu clinic', { delay: 20 });
    await d.say(
      'Every change is a <b>movement</b>: dispensed, received, adjusted after a count, or written off when it expires.',
      5000
    );
    const submitMov = page.getByRole('button', { name: /^Record Movement$/i }).last();
    if (await d.exists(submitMov, 3000)) await d.click(submitMov, { pause: 2800 });
    await d.say(
      'The stock drops, and the reason stays attached to it. That is what makes a count worth trusting.',
      4400
    );

    d.chapter('Ordering more');
    await d.step('Step 4 — Approve the order');
    await d.nav('Operations', 'Purchase Orders');
    await d.say(
      '<b>Purchase Orders</b> is what you send a supplier. This one is pending — raised against the low flu-vaccine stock.',
      4800
    );
    const approve = page.getByRole('button', { name: /^Approve$/i }).first();
    if (await d.exists(approve, 5000)) {
      await d.click(approve, { pause: 2600 });
      await d.say(
        'Approving is the sign-off. Nothing has arrived yet, and the stock has not moved.',
        4200
      );
    }

    await d.step('Step 5 — Receive it');
    const receive = page.getByRole('button', { name: /^Receive$/i }).first();
    if (await d.exists(receive, 5000)) {
      await d.click(receive, { pause: 3000 });
    }
    await d.say(
      '<b>Receiving</b> is what raises the stock — one action, and every line on the order lands on the shelf.',
      4800
    );

    await d.step('Step 6 — Back to the shelf');
    await d.nav('Operations', 'Inventory Overview');
    await d.say(
      'Back on the overview the levels have moved and the alert has cleared. Item, order, receipt — that is the whole loop.',
      5200
    );
    await d.step('');
  },
};
