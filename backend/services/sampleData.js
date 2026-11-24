/**
 * Sample data for free-trial workspaces — so a new practice sees a working clinic, not an
 * empty screen: suppliers, stock, services with prices, insurers, patients and a week of
 * appointments.
 *
 * It goes in through the same importer clinics use for their own data (services/dataImport),
 * so it is checked the same way. Every sample record carries a marker, and removeSampleData()
 * deletes exactly those records — never anything the practice entered itself:
 *   patients     mrn starts with SAMPLE-          (their appointments go with them)
 *   services     description starts with [Sample data]
 *   products     description starts with [Sample data]
 *   suppliers    notes = [Sample data]
 *   insurers     notes = [Sample data]
 *
 *   seedSampleData(pool, { practiceId, schemaName, userId }) → { created: { kind: n } }
 *   sampleDataStatus(db) → { present, counts }
 *   removeSampleData(pool, { schemaName }) → { removed: { kind: n } }
 */
const { makeTenantDb } = require('../db/requestTenantDb');
const { runImport } = require('./dataImport');

const MARK = '[Sample data]';
const pad = (n) => String(n).padStart(2, '0');
const localDateTime = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const localDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function sampleRows(now = new Date()) {
  const inDays = (days, hour, minute = 0) => { const d = new Date(now); d.setDate(d.getDate() + days); d.setHours(hour, minute, 0, 0); return localDateTime(d); };
  const yearsAgo = (y, m, d) => localDate(new Date(now.getFullYear() - y, m, d));
  const patients = [
    ['SAMPLE-001', 'Maria', 'Lopez', yearsAgo(42, 2, 17), 'female', 'Penicillin'],
    ['SAMPLE-002', 'James', 'Okafor', yearsAgo(35, 7, 3), 'male', ''],
    ['SAMPLE-003', 'Sofia', 'Rossi', yearsAgo(28, 10, 21), 'female', ''],
    ['SAMPLE-004', 'Lukas', 'Becker', yearsAgo(61, 0, 9), 'male', 'Latex'],
    ['SAMPLE-005', 'Amira', 'Haddad', yearsAgo(19, 4, 30), 'female', ''],
    ['SAMPLE-006', 'Tom', 'Murphy', yearsAgo(54, 5, 12), 'male', 'Ibuprofen'],
    ['SAMPLE-007', 'Chloé', 'Martin', yearsAgo(8, 8, 2), 'female', ''],
    ['SAMPLE-008', 'Daniel', 'García', yearsAgo(47, 11, 25), 'male', ''],
  ].map(([mrn, first, last, dob, gender, allergies], i) => ({
    mrn, first_name: first, last_name: last, date_of_birth: dob, gender, allergies,
    // example.com addresses never reach a real inbox, so reminders sent to them go nowhere.
    email: `${first.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '')}.${last.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '')}.sample${i + 1}@example.com`,
    insurance: i % 3 === 0 ? 'Sample Health Insurance' : '',
  }));
  const appointments = [
    ['SAMPLE-001', inDays(1, 9, 0), 30, 'Follow-up', 'Diabetes review'],
    ['SAMPLE-002', inDays(1, 10, 0), 45, 'Initial consultation', 'Back pain'],
    ['SAMPLE-003', inDays(2, 11, 30), 30, 'Follow-up', 'Blood test results'],
    ['SAMPLE-004', inDays(2, 15, 0), 30, 'Follow-up', 'Blood pressure check'],
    ['SAMPLE-005', inDays(3, 9, 30), 45, 'Initial consultation', 'Skin rash'],
    ['SAMPLE-006', inDays(4, 12, 0), 30, 'Follow-up', 'Physiotherapy progress'],
    ['SAMPLE-007', inDays(5, 16, 0), 20, 'Vaccination', 'Childhood vaccination'],
    ['SAMPLE-008', inDays(7, 10, 30), 30, 'Initial consultation', 'Annual check-up'],
    ['SAMPLE-001', inDays(-7, 9, 0), 30, 'Follow-up', 'Medication review', 'completed'],
    ['SAMPLE-004', inDays(-3, 14, 0), 30, 'Follow-up', 'Missed appointment', 'no-show'],
  ].map(([patient_mrn, start_time, duration_minutes, appointment_type, reason, status]) => ({
    patient_mrn, start_time, duration_minutes: String(duration_minutes), appointment_type, reason, status: status || 'scheduled', notes: MARK,
  }));
  return {
    suppliers: [
      { name: 'Sample Medical Supplies', contact_name: 'Order desk', email: 'orders@sample-supplies.example.com', payment_terms: 'net_30', notes: MARK },
      { name: 'Sample Pharma Distribution', payment_terms: 'immediate', notes: MARK },
    ],
    products: [
      { sku: 'SAMPLE-GLV-M', name: 'Nitrile gloves, medium (box of 100)', item_type: 'consumable', unit_of_measure: 'box', unit_cost: '6.50', quantity_on_hand: '12', reorder_level: '5', reorder_quantity: '20', category: 'Consumables', supplier: 'Sample Medical Supplies', description: `${MARK} Powder-free` },
      { sku: 'SAMPLE-SYR-5', name: 'Syringes 5 ml (box of 100)', item_type: 'supply', unit_of_measure: 'box', unit_cost: '9.80', quantity_on_hand: '4', reorder_level: '5', reorder_quantity: '10', category: 'Consumables', supplier: 'Sample Medical Supplies', description: `${MARK} Below its reorder level, to show a low-stock alert` },
      { sku: 'SAMPLE-FLU-VAC', name: 'Influenza vaccine', item_type: 'medication', unit_of_measure: 'each', unit_cost: '9.00', selling_price: '25', quantity_on_hand: '20', reorder_level: '5', category: 'Vaccines', supplier: 'Sample Pharma Distribution', requires_refrigeration: 'yes', description: MARK },
      { sku: 'SAMPLE-BAND', name: 'Elastic bandage 10 cm', item_type: 'consumable', unit_of_measure: 'each', unit_cost: '1.20', selling_price: '4', quantity_on_hand: '30', reorder_level: '10', category: 'Consumables', supplier: 'Sample Medical Supplies', description: MARK },
    ],
    services: [
      { name: 'Initial consultation (sample)', price: '60', duration_minutes: '45', category: 'Consultations', description: `${MARK} First visit with history and examination` },
      { name: 'Follow-up consultation (sample)', price: '40', duration_minutes: '30', category: 'Consultations', description: MARK },
      { name: 'Vaccination (sample)', price: '25', duration_minutes: '20', category: 'Preventive care', description: MARK },
      { name: 'Telehealth consultation (sample)', price: '35', duration_minutes: '20', category: 'Consultations', description: MARK },
    ],
    insurers: [
      { payer_id: 'SAMPLE-HEALTH', name: 'Sample Health Insurance', timely_filing_limit: '90', notes: MARK },
      { payer_id: 'SAMPLE-SELFPAY', name: 'Self-pay (sample)', payer_type: 'self_pay', notes: MARK },
    ],
    patients,
    appointments,
  };
}

/** Put the sample data into a practice. Each kind is its own all-or-nothing import. */
async function seedSampleData(pool, { practiceId, schemaName, userId = null, now = new Date() }) {
  const db = makeTenantDb(pool, schemaName);
  const req = { tenant: { practiceId, schemaName }, db, user: { id: userId }, app: { locals: { pool } } };
  const created = {};
  try {
    const rows = sampleRows(now);
    for (const kind of ['suppliers', 'products', 'services', 'insurers', 'patients', 'appointments']) {
      const out = await runImport(req, kind, rows[kind], { mode: 'create_only' });
      if (out.status !== 200) {
        console.warn(`[sampleData] ${kind} not seeded:`, JSON.stringify(out.error || (out.body && out.body.errors)).slice(0, 300));
        created[kind] = 0;
      } else created[kind] = out.body.created;
    }
  } finally {
    db.release();
  }
  return { created };
}

const COUNTS = {
  patients: "SELECT count(*)::int AS n FROM patients WHERE mrn LIKE 'SAMPLE-%'",
  services: "SELECT count(*)::int AS n FROM healthcare_offerings WHERE description LIKE '[Sample data]%'",
  products: "SELECT count(*)::int AS n FROM inventory_items WHERE description LIKE '[Sample data]%'",
  suppliers: "SELECT count(*)::int AS n FROM inventory_suppliers WHERE notes = '[Sample data]'",
  insurers: "SELECT count(*)::int AS n FROM insurance_payers WHERE notes = '[Sample data]'",
};

async function sampleDataStatus(db) {
  const counts = {};
  for (const [k, sql] of Object.entries(COUNTS)) counts[k] = (await db.query(sql)).rows[0].n;
  return { present: Object.values(counts).some((n) => n > 0), counts };
}

/** Delete the sample records (and only them), in one transaction. */
async function removeSampleData(pool, { schemaName }) {
  if (!/^[a-z_][a-z0-9_]*$/.test(String(schemaName || ''))) throw new Error('Unsafe schema');
  const client = await pool.connect();
  const removed = {};
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL search_path TO ${schemaName}, public, control`);
    const run = async (k, sql) => { removed[k] = (await client.query(sql)).rowCount; };
    // A sample patient the practice has since billed (accounting records point at it) stays,
    // so removing samples never breaks the books; it is reported as kept.
    const inUse = `EXISTS (SELECT 1 FROM account_journal_lines j WHERE j.patient_id = p.id)
      OR EXISTS (SELECT 1 FROM account_receivables r WHERE r.patient_id = p.id)
      OR EXISTS (SELECT 1 FROM account_statements st WHERE st.patient_id = p.id)`;
    await run('appointments', `DELETE FROM appointments WHERE patient_id IN (SELECT p.id FROM patients p WHERE p.mrn LIKE 'SAMPLE-%' AND NOT (${inUse}))`);
    await run('patients', `DELETE FROM patients p WHERE p.mrn LIKE 'SAMPLE-%' AND NOT (${inUse})`);
    await run('services', "DELETE FROM healthcare_offerings WHERE description LIKE '[Sample data]%'");
    const itemFree = "i.description LIKE '[Sample data]%' AND NOT EXISTS (SELECT 1 FROM camp_inventory_allocations c WHERE c.item_id = i.id)";
    await client.query(`DELETE FROM inventory_stock_movements WHERE item_id IN (SELECT i.id FROM inventory_items i WHERE ${itemFree})`);
    await run('products', `DELETE FROM inventory_items i WHERE ${itemFree}`);
    // A supplier the practice has since used on its own products stays.
    await run('suppliers', "DELETE FROM inventory_suppliers s WHERE notes = '[Sample data]' AND NOT EXISTS (SELECT 1 FROM inventory_items i WHERE i.supplier_id = s.id)");
    await run('insurers', "DELETE FROM insurance_payers p WHERE notes = '[Sample data]' AND NOT EXISTS (SELECT 1 FROM patients x WHERE x.insurance_payer_id = p.id)");
    const kept = (await sampleDataStatus(client)).counts; // what stayed because it is in use
    await client.query('COMMIT');
    return { removed, kept };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { seedSampleData, sampleDataStatus, removeSampleData, sampleRows, MARK };
