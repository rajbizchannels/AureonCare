/**
 * Low-stock alerts.
 *
 * When stock of an item falls to or below its reorder level, everyone in the practice whose role
 * can act on stock (raise purchase orders or edit items, by the practice's own inventory
 * permissions) is told — each on the channels they chose in Notification settings. When nobody
 * but the admin can (a solo practice, or a practice where only admins handle stock), the admin is
 * told instead. See services/staffNotifications.js.
 *
 * One alert per dip: `low_stock_alerted_at` is set when the alert goes out and cleared when stock
 * is back above the reorder level, so a busy item does not alert on every movement.
 *
 * Call AFTER the transaction that changed stock has committed. Never throws.
 */

const { notifyEligible } = require('./staffNotifications');
const { buildEmailHtml, detailRow, escapeHtml } = require('./notificationService');

const fmtQty = (n) => {
  const v = Number(n);
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/\.?0+$/, '');
};

async function checkItems(db, itemIds, { practiceId = null } = {}) {
  const ids = [...new Set((itemIds || []).filter(Boolean).map(String))];
  const alerted = [];
  if (!ids.length) return alerted;
  try {
    // Back above the line: re-arm the alert for the next dip.
    await db.query(
      `UPDATE inventory_items SET low_stock_alerted_at = NULL
        WHERE id::text = ANY($1::text[]) AND low_stock_alerted_at IS NOT NULL
          AND (reorder_level <= 0 OR quantity_on_hand > reorder_level)`, [ids]);

    // At or below: claim the alert atomically, so two concurrent movements send one alert.
    const { rows } = await db.query(
      `UPDATE inventory_items SET low_stock_alerted_at = now()
        WHERE id::text = ANY($1::text[]) AND low_stock_alerted_at IS NULL
          AND reorder_level > 0 AND quantity_on_hand <= reorder_level
          AND COALESCE(status, 'active') = 'active'
        RETURNING id, name, item_number, sku, quantity_on_hand, reorder_level, reorder_quantity, unit_of_measure`, [ids]);

    for (const item of rows) {
      const unit = item.unit_of_measure ? ` ${item.unit_of_measure}` : '';
      const out = Number(item.quantity_on_hand) <= 0;
      const line = `${out ? 'Out of stock' : 'Low stock'}: ${item.name} — ${fmtQty(item.quantity_on_hand)}${unit} left (reorder level ${fmtQty(item.reorder_level)}${unit}).`;
      const rowsHtml = [
        detailRow('Item', item.name),
        detailRow('Item number', item.item_number || item.sku || null),
        detailRow('In stock', `${fmtQty(item.quantity_on_hand)}${unit}`),
        detailRow('Reorder level', `${fmtQty(item.reorder_level)}${unit}`),
        detailRow('Suggested order', Number(item.reorder_quantity) > 0 ? `${fmtQty(item.reorder_quantity)}${unit}` : null),
      ].join('');
      const sent = await notifyEligible(db, practiceId, 'inventory.low_stock', {
        type: 'inventory',
        inApp: line,
        subject: `${out ? 'Out of stock' : 'Low stock'}: ${item.name}`,
        html: buildEmailHtml(out ? 'Out of Stock' : 'Low Stock', '#F59E0B', 'Hello,',
          escapeHtml(`${item.name} has reached its reorder level. Raise a purchase order under Operations → Inventory.`), rowsHtml, null),
        whatsappText: `*${out ? 'Out of stock' : 'Low stock'}*\n\n${line}\n\nRaise a purchase order under Operations → Inventory.`,
        whatsappSummary: line,
      });
      alerted.push({ itemId: item.id, recipients: sent });
    }
  } catch (err) {
    if (err.code === '42703') {
      console.error('[lowStockAlerts] low_stock_alerted_at missing — run migration 100');
    } else {
      console.error('[lowStockAlerts] check failed:', err.message);
    }
  }
  return alerted;
}

module.exports = { checkItems };
