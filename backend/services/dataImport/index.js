/**
 * Data import — bring a clinic's data in from another system, by CSV/XLSX file or by API.
 *
 * Kinds, in the order to import them:
 *   suppliers → products (stock items) → services (with price) → insurers → patients → appointments
 *
 * One published format per kind (FORMATS; served at GET /api/import/formats and as templates),
 * used by both routes, so a file and an API call are checked the same way.
 *
 *   runImport(req, kind, rows, { dryRun, mode })
 *     → { kind, dryRun, mode, received, created, updated, unchanged, written, errors: [{ row, field, message }] }
 *
 * Rules
 * - ALL OR NOTHING: every row is checked first (formats, required fields, links such as the
 *   patient an appointment belongs to). If any row has an error, nothing is written and every
 *   error is reported with its row number. Fix the file and send it again.
 * - RE-RUNNABLE: each kind has a key (patients: mrn; appointments: patient + start time;
 *   products: sku; services and suppliers: name; insurers: payer_id), so sending the same data
 *   twice adds nothing twice. mode "upsert" (default) updates what matched; "create_only" leaves
 *   matched records as they are.
 * - Empty cells never erase stored values.
 * - Patients are imported without portal accounts; the plan's patient limit applies.
 * - Products: quantity_on_hand is the OPENING stock — set when the product is created, never
 *   overwritten by a later import (stock then moves through receipts and issues).
 * - Product and service categories that do not exist yet are created; a product's supplier must
 *   exist (import suppliers first).
 */

const { parseCsv, toCsv } = require('./csv');

const MAX_ROWS = 5000;

// Field types: text | date (YYYY-MM-DD) | datetime (YYYY-MM-DDTHH:MM, clinic local time) |
//   int | number (decimal, '.' or ',' as the decimal mark) | bool (yes/no) | email |
//   enum (values) | list (codes separated by ; or |)
const STATUS_ACTIVE = { name: 'status', type: 'enum', values: ['active', 'inactive'], description: 'active (default) or inactive', example: 'active' };

const FORMATS = {
  suppliers: {
    label: 'Suppliers',
    description: 'One row per supplier of stock. Matched on name (not case-sensitive). Import before products.',
    key: 'name',
    fields: [
      { name: 'name', type: 'text', max: 200, required: true, description: 'Supplier name, unique in the practice', example: 'MedSupply Iberia' },
      { name: 'contact_name', type: 'text', max: 200, example: 'Lucia Ortega' },
      { name: 'email', type: 'email', max: 255, example: 'orders@medsupply.example' },
      { name: 'phone', type: 'text', max: 50, example: '+34 910 000 000' },
      { name: 'address', type: 'text', max: 500, example: 'Calle Industria 4' },
      { name: 'city', type: 'text', max: 100, example: 'Madrid' },
      { name: 'country', type: 'text', max: 100, example: 'ES' },
      { name: 'payment_terms', type: 'enum', values: ['net_30', 'net_60', 'net_90', 'immediate', 'custom'], description: 'net_30, net_60, net_90, immediate or custom', example: 'net_30' },
      { name: 'tax_id', type: 'text', max: 50, description: 'VAT or tax number', example: 'ESB12345678' },
      { name: 'notes', type: 'text', max: 2000, example: 'Delivers Tuesdays' },
      STATUS_ACTIVE,
    ],
  },
  products: {
    label: 'Products & stock',
    description: 'One row per stock item (medicines, consumables, retail products). Matched on sku. quantity_on_hand is the opening stock, set only when the product is created.',
    key: 'sku',
    fields: [
      { name: 'sku', type: 'text', max: 100, required: true, description: 'Your product code — unique; used to match on re-import', example: 'GLV-NIT-M' },
      { name: 'name', type: 'text', max: 255, required: true, example: 'Nitrile gloves, medium' },
      { name: 'item_type', type: 'enum', required: true, values: ['medication', 'supply', 'equipment', 'consumable', 'reagent', 'implant', 'other'], description: 'medication, supply, equipment, consumable, reagent, implant or other', example: 'consumable' },
      { name: 'unit_of_measure', type: 'enum', required: true, values: ['unit', 'pack', 'box', 'kg', 'g', 'l', 'ml', 'each', 'dozen', 'case'], description: 'unit, pack, box, kg, g, l, ml, each, dozen or case', example: 'box' },
      { name: 'unit_cost', type: 'number', min: 0, required: true, description: 'What you pay per unit', example: '6.50' },
      { name: 'selling_price', type: 'number', min: 0, description: 'Price to patients, if sold', example: '' },
      { name: 'quantity_on_hand', type: 'number', min: 0, description: 'Opening stock (only when the product is new)', example: '40' },
      { name: 'reorder_level', type: 'number', min: 0, description: 'Alert when stock falls to this', example: '10' },
      { name: 'reorder_quantity', type: 'number', min: 0, example: '50' },
      { name: 'category', type: 'text', max: 100, description: 'Created if it does not exist', example: 'Consumables' },
      { name: 'supplier', type: 'text', max: 200, description: 'Supplier name — must exist (import suppliers first)', example: 'MedSupply Iberia' },
      { name: 'barcode', type: 'text', max: 100, example: '8412345678901' },
      { name: 'lot_number', type: 'text', max: 100, example: 'L2611' },
      { name: 'expiry_date', type: 'date', future: true, description: 'YYYY-MM-DD', example: '2027-06-30' },
      { name: 'requires_refrigeration', type: 'bool', description: 'yes or no', example: 'no' },
      { name: 'description', type: 'text', max: 2000, example: 'Powder-free' },
      { name: 'status', type: 'enum', values: ['active', 'inactive', 'discontinued'], description: 'active (default), inactive or discontinued', example: 'active' },
    ],
  },
  services: {
    label: 'Services & prices',
    description: 'One row per service you offer (consultations, treatments). Matched on name (not case-sensitive). price becomes the standard price.',
    key: 'name',
    fields: [
      { name: 'name', type: 'text', max: 255, required: true, example: 'Initial consultation' },
      { name: 'price', type: 'number', min: 0, description: 'Standard price, in the practice currency', example: '60' },
      { name: 'duration_minutes', type: 'int', min: 5, max: 720, example: '30' },
      { name: 'category', type: 'text', max: 100, description: 'Created if it does not exist', example: 'Consultations' },
      { name: 'description', type: 'text', max: 2000, example: 'First visit with history and examination' },
      { name: 'available_online', type: 'bool', description: 'yes (default) or no — bookable online', example: 'yes' },
      { name: 'requires_referral', type: 'bool', description: 'yes or no', example: 'no' },
      { name: 'cpt_codes', type: 'list', max: 500, description: 'US only; separate with ; or |', example: '' },
      STATUS_ACTIVE,
    ],
  },
  insurers: {
    label: 'Insurers',
    description: 'One row per insurer or payer. Matched on payer_id.',
    key: 'payer_id',
    fields: [
      { name: 'payer_id', type: 'text', max: 50, required: true, description: 'Your code for the insurer — unique', example: 'SANITAS' },
      { name: 'name', type: 'text', max: 255, required: true, example: 'Sanitas' },
      { name: 'payer_type', type: 'enum', values: ['insurance', 'government', 'self_pay', 'other'], description: 'insurance (default), government, self_pay or other', example: 'insurance' },
      { name: 'phone', type: 'text', max: 50, example: '+34 900 000 000' },
      { name: 'email', type: 'email', max: 255, example: 'claims@sanitas.example' },
      { name: 'website', type: 'text', max: 255, example: 'https://www.sanitas.example' },
      { name: 'address', type: 'text', max: 500, example: '' },
      { name: 'city', type: 'text', max: 100, example: 'Madrid' },
      { name: 'state', type: 'text', max: 100, example: '' },
      { name: 'zip', type: 'text', max: 20, example: '' },
      { name: 'electronic_payer_id', type: 'text', max: 50, description: 'US clearinghouse payer ID', example: '' },
      { name: 'timely_filing_limit', type: 'int', min: 1, max: 3650, description: 'Days to submit a claim', example: '90' },
      { name: 'prior_authorization_required', type: 'bool', description: 'yes or no', example: 'no' },
      { name: 'notes', type: 'text', max: 2000, example: '' },
      STATUS_ACTIVE,
    ],
  },
  patients: {
    label: 'Patients',
    description: 'One row per patient. Matched on mrn: an existing MRN is updated (mode "upsert") or left as it is ("create_only").',
    key: 'mrn',
    fields: [
      { name: 'mrn', type: 'text', max: 50, required: true, description: 'Medical record number — your old system\'s patient ID works well. Unique in the practice.', example: 'P-10023' },
      { name: 'first_name', type: 'text', max: 100, required: true, description: 'Given name', example: 'Maria' },
      { name: 'last_name', type: 'text', max: 100, required: true, description: 'Family name', example: 'Lopez' },
      { name: 'date_of_birth', type: 'date', required: true, description: 'YYYY-MM-DD', example: '1984-03-17' },
      { name: 'gender', type: 'enum', values: ['male', 'female', 'other', 'unknown'], description: 'male, female, other or unknown', example: 'female' },
      { name: 'email', type: 'email', max: 255, description: 'Unique among the practice\'s patients', example: 'maria.lopez@example.com' },
      { name: 'phone', type: 'text', max: 30, description: 'With country code, e.g. +34…', example: '+34 600 123 456' },
      { name: 'address', type: 'text', max: 500, description: 'Street and number', example: 'Calle Mayor 12' },
      { name: 'city', type: 'text', max: 100, example: 'Madrid' },
      { name: 'state', type: 'text', max: 100, description: 'State, province or region', example: 'Madrid' },
      { name: 'zip', type: 'text', max: 20, description: 'Postal code', example: '28013' },
      { name: 'country', type: 'text', max: 100, description: 'Two-letter code (ES, DE, US…) or name', example: 'ES' },
      { name: 'insurance', type: 'text', max: 255, description: 'Insurer or plan name', example: 'Sanitas' },
      { name: 'insurance_id', type: 'text', max: 100, description: 'Member or policy number', example: 'SAN-778812' },
      { name: 'allergies', type: 'text', max: 2000, example: 'Penicillin' },
      { name: 'current_medications', type: 'text', max: 2000, example: 'Metformin 500 mg twice daily' },
      { name: 'past_history', type: 'text', max: 5000, description: 'Past medical history', example: 'Type 2 diabetes since 2019' },
      { name: 'family_history', type: 'text', max: 5000, example: 'Father: hypertension' },
      STATUS_ACTIVE,
    ],
  },
  appointments: {
    label: 'Appointments',
    description: 'One row per appointment. The patient must exist (import patients first). Matched on patient + start time.',
    key: 'patient_mrn + start_time',
    fields: [
      { name: 'patient_mrn', type: 'text', max: 50, required: true, description: 'The patient\'s MRN, as imported', example: 'P-10023' },
      { name: 'start_time', type: 'datetime', required: true, description: 'YYYY-MM-DDTHH:MM in the clinic\'s local time', example: '2026-12-01T09:30' },
      { name: 'end_time', type: 'datetime', description: 'YYYY-MM-DDTHH:MM; or give duration_minutes', example: '2026-12-01T10:00' },
      { name: 'duration_minutes', type: 'int', min: 5, max: 720, description: 'Used when end_time is empty; 30 if both are empty', example: '30' },
      { name: 'provider_email', type: 'email', max: 255, description: 'Email of a provider who is a member of this practice; empty = no provider', example: 'dr.garcia@clinic.example' },
      { name: 'appointment_type', type: 'text', max: 100, description: 'e.g. Consultation, Follow-up', example: 'Follow-up' },
      { name: 'reason', type: 'text', max: 1000, example: 'Diabetes review' },
      { name: 'notes', type: 'text', max: 5000, example: 'Bring glucose diary' },
      { name: 'status', type: 'enum', values: ['scheduled', 'confirmed', 'completed', 'cancelled', 'no-show'], description: 'scheduled (default), confirmed, completed, cancelled or no-show', example: 'scheduled' },
      { name: 'timezone', type: 'text', max: 64, description: 'IANA time zone of start_time, e.g. Europe/Madrid; empty = UTC', example: 'Europe/Madrid' },
    ],
  },
};

const KINDS = Object.keys(FORMATS);

/** Header row + one example row, as rows (for CSV or a spreadsheet). */
function templateRows(kind) {
  const f = FORMATS[kind];
  return f ? [f.fields.map((x) => x.name), f.fields.map((x) => x.example || '')] : null;
}

/** The CSV template: the header row, then one example row. */
function templateCsv(kind) {
  const rows = templateRows(kind);
  return rows ? toCsv(rows) : null;
}

/** The published format, as served by GET /api/import/formats. */
function publishedFormats() {
  return {
    version: 2,
    maxRowsPerRequest: MAX_ROWS,
    order: KINDS,
    fileTypes: ['csv', 'xlsx (Settings → Import Data only; the API takes CSV or JSON)'],
    rules: [
      'All or nothing: if any row has an error, nothing is written and all errors are listed.',
      'Re-runnable: each kind matches existing records on its key, so nothing is added twice.',
      'mode "upsert" (default) updates matched records; "create_only" leaves them unchanged.',
      'dryRun true checks everything and reports what would happen, writing nothing.',
      'Empty cells are ignored when updating, so they never erase what is already stored.',
      'Import in this order: suppliers, products, services, insurers, patients, appointments.',
    ],
    kinds: Object.fromEntries(KINDS.map((k) => [k, {
      label: FORMATS[k].label, description: FORMATS[k].description, key: FORMATS[k].key,
      fields: FORMATS[k].fields.map(({ name, type, required, description, values, max, min, example }) => ({
        name, type, required: Boolean(required), description: description || null,
        values: values || undefined,
        maxLength: ['int', 'number'].includes(type) ? undefined : max,
        min, max: ['int', 'number'].includes(type) ? max : undefined, example,
      })),
    }])),
  };
}

/** CSV text → rows keyed by header. Header names are matched case-insensitively. */
function rowsFromCsv(text) {
  const table = parseCsv(String(text || ''));
  if (!table.length) return { rows: [], header: [] };
  const header = table[0].map((h) => String(h || '').trim().toLowerCase());
  const rows = table.slice(1)
    .filter((r) => r.some((c) => String(c || '').trim() !== ''))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] === undefined ? '' : r[i]])));
  return { rows, header };
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/;
// The same rule the database applies to supplier emails, used for every email.
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const YES = ['yes', 'y', 'true', '1', 'si', 'sí', 'oui', 'ja'];
const NO = ['no', 'n', 'false', '0', 'non', 'nein'];

function validDate(y, m, d) {
  const dt = new Date(Date.UTC(+y, +m - 1, +d));
  return dt.getUTCFullYear() === +y && dt.getUTCMonth() === +m - 1 && dt.getUTCDate() === +d;
}

/** Check and normalise one row against its format. → { value, errors[] } */
function checkRow(kind, raw, rowNumber) {
  const errors = [];
  const value = {};
  const err = (field, message) => errors.push({ row: rowNumber, field, message });
  for (const f of FORMATS[kind].fields) {
    let v = raw[f.name];
    v = v === undefined || v === null ? '' : String(v).trim();
    if (v === '') { if (f.required) err(f.name, 'is required'); continue; }
    if (f.max && !['int', 'number'].includes(f.type) && v.length > f.max) { err(f.name, `is longer than ${f.max} characters`); continue; }
    switch (f.type) {
      case 'date': {
        const m = DATE_RE.exec(v);
        if (!m || !validDate(m[1], m[2], m[3])) { err(f.name, `"${v}" is not a date in the form YYYY-MM-DD`); continue; }
        if (!f.future && v > new Date().toISOString().slice(0, 10)) { err(f.name, 'is in the future'); continue; }
        break;
      }
      case 'datetime': {
        const m = DATETIME_RE.exec(v);
        if (!m || !validDate(m[1], m[2], m[3]) || +m[4] > 23 || +m[5] > 59 || (m[6] && +m[6] > 59)) {
          err(f.name, `"${v}" is not a date and time in the form YYYY-MM-DDTHH:MM`); continue;
        }
        v = `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${m[6] || '00'}`;
        break;
      }
      case 'int': {
        if (!/^\d+$/.test(v)) { err(f.name, `"${v}" is not a whole number`); continue; }
        const n = Number(v);
        if ((f.min !== undefined && n < f.min) || (f.max !== undefined && n > f.max)) { err(f.name, `must be between ${f.min} and ${f.max}`); continue; }
        v = n;
        break;
      }
      case 'number': {
        // 1234.5, 1234,5 (European decimal comma) — no thousands separators.
        const s = v.replace(/\s/g, '').replace(/^(-?\d+),(\d+)$/, '$1.$2');
        if (!/^-?\d+(\.\d+)?$/.test(s)) { err(f.name, `"${v}" is not a number (use 12.50 or 12,50)`); continue; }
        const n = Number(s);
        if ((f.min !== undefined && n < f.min) || (f.max !== undefined && n > f.max)) {
          err(f.name, f.max !== undefined ? `must be between ${f.min} and ${f.max}` : `must be ${f.min} or more`); continue;
        }
        v = n;
        break;
      }
      case 'bool': {
        const lv = v.toLowerCase();
        if (YES.includes(lv)) v = true;
        else if (NO.includes(lv)) v = false;
        else { err(f.name, `"${v}" must be yes or no`); continue; }
        break;
      }
      case 'list':
        v = v.split(/[;|]/).map((x) => x.trim()).filter(Boolean);
        break;
      case 'email':
        v = v.toLowerCase();
        if (!EMAIL_RE.test(v)) { err(f.name, `"${v}" is not an email address`); continue; }
        break;
      case 'enum': {
        const lv = v.toLowerCase().replace(/[\s_]/g, '-');
        const hit = f.values.find((x) => x.replace(/_/g, '-') === lv || x.replace(/[-_]/g, '') === lv.replace(/-/g, ''));
        if (!hit) { err(f.name, `must be one of: ${f.values.join(', ')}`); continue; }
        v = hit;
        break;
      }
      default: break;
    }
    value[f.name] = v;
  }
  if (kind === 'appointments' && value.start_time && value.end_time && value.end_time <= value.start_time) {
    err('end_time', 'must be after start_time');
  }
  if (kind === 'appointments' && value.timezone) {
    try { new Intl.DateTimeFormat('en', { timeZone: value.timezone }); } catch { err('timezone', `"${value.timezone}" is not a time zone (e.g. Europe/Madrid)`); }
  }
  return { value, errors };
}

const plusMinutes = (local, minutes) => {
  const d = new Date(`${local.replace(' ', 'T')}Z`);
  return new Date(d.getTime() + minutes * 60000).toISOString().slice(0, 19).replace('T', ' ');
};

const lc = (s) => String(s || '').trim().toLowerCase();

/** Rows whose key repeats inside this import → errors. */
function duplicateKeyErrors(checked, keyOf, field, label) {
  const errors = [];
  const first = new Map();
  for (const c of checked) {
    const k = keyOf(c.value);
    if (!k) continue;
    if (first.has(k)) errors.push({ row: c.row, field, message: `${label} "${c.value[field]}" is also on row ${first.get(k)}` });
    else first.set(k, c.row);
  }
  return errors;
}

// ── simple kinds: one table, one key ────────────────────────────────────────────────
// map: field → column. lookup: SQL returning id + key for a list of keys.
const SIMPLE = {
  suppliers: {
    table: 'inventory_suppliers', keyField: 'name',
    lookup: 'SELECT id, lower(name) AS k FROM inventory_suppliers WHERE lower(name) = ANY($1::text[])',
    keyOf: (v) => lc(v.name),
    map: { name: 'name', contact_name: 'contact_name', email: 'email', phone: 'phone', address: 'address', city: 'city',
      country: 'country', payment_terms: 'payment_terms', tax_id: 'tax_id', notes: 'notes', status: 'status' },
    stamp: true,
  },
  insurers: {
    table: 'insurance_payers', keyField: 'payer_id',
    lookup: 'SELECT id, payer_id AS k FROM insurance_payers WHERE payer_id = ANY($1::text[])',
    keyOf: (v) => v.payer_id,
    map: { payer_id: 'payer_id', name: 'name', payer_type: 'payer_type', phone: 'phone', email: 'email', website: 'website',
      address: 'address', city: 'city', state: 'state', zip: 'zip_code', electronic_payer_id: 'electronic_payer_id',
      timely_filing_limit: 'timely_filing_limit', prior_authorization_required: 'prior_authorization_required', notes: 'notes',
      status: (v) => ['is_active', v === 'active'] },
  },
  services: {
    table: 'healthcare_offerings', keyField: 'name',
    lookup: 'SELECT id, lower(name) AS k FROM healthcare_offerings WHERE lower(name) = ANY($1::text[])',
    keyOf: (v) => lc(v.name),
    map: { name: 'name', description: 'description', duration_minutes: 'duration_minutes', available_online: 'available_online',
      requires_referral: 'requires_referral', cpt_codes: 'cpt_codes', status: (v) => ['is_active', v === 'active'] },
  },
  products: {
    table: 'inventory_items', keyField: 'sku',
    lookup: 'SELECT id, sku AS k FROM inventory_items WHERE sku = ANY($1::text[])',
    keyOf: (v) => v.sku,
    map: { sku: 'sku', name: 'name', item_type: 'item_type', unit_of_measure: 'unit_of_measure', unit_cost: 'unit_cost',
      selling_price: 'selling_price', reorder_level: 'reorder_level', reorder_quantity: 'reorder_quantity', barcode: 'barcode',
      lot_number: 'lot_number', expiry_date: 'expiry_date', requires_refrigeration: 'requires_refrigeration',
      description: 'description', status: 'status' },
    createOnly: { quantity_on_hand: 'quantity_on_hand' }, // opening stock
    stamp: true,
  },
};

/** Look up everything the rows refer to and plan each write. Adds errors for broken links. */
async function plan(db, kind, checked, { practiceId }) {
  const errors = [];
  const ops = [];

  if (SIMPLE[kind]) {
    const s = SIMPLE[kind];
    errors.push(...duplicateKeyErrors(checked, s.keyOf, s.keyField, s.keyField));
    const keys = [...new Set(checked.map((c) => s.keyOf(c.value)))];
    const { rows } = await db.query(s.lookup, [keys]);
    const byKey = new Map(rows.map((r) => [r.k, r.id]));
    let supplierOf = new Map();
    if (kind === 'products') {
      const names = [...new Set(checked.map((c) => lc(c.value.supplier)).filter(Boolean))];
      if (names.length) {
        const { rows: sup } = await db.query('SELECT id, lower(name) AS k FROM inventory_suppliers WHERE lower(name) = ANY($1::text[])', [names]);
        supplierOf = new Map(sup.map((r) => [r.k, r.id]));
      }
    }
    for (const c of checked) {
      if (kind === 'products' && c.value.supplier && !supplierOf.get(lc(c.value.supplier))) {
        errors.push({ row: c.row, field: 'supplier', message: `no supplier named "${c.value.supplier}" — import suppliers first` });
        continue;
      }
      ops.push({ row: c.row, value: c.value, existing: byKey.get(s.keyOf(c.value)) || null,
        supplierId: kind === 'products' && c.value.supplier ? supplierOf.get(lc(c.value.supplier)) : undefined });
    }
    return { ops, errors };
  }

  if (kind === 'patients') {
    errors.push(...duplicateKeyErrors(checked, (v) => v.mrn, 'mrn', 'MRN'));
    errors.push(...duplicateKeyErrors(checked, (v) => v.email, 'email', 'Email'));
    const mrns = checked.map((c) => c.value.mrn);
    const emails = checked.map((c) => c.value.email).filter(Boolean);
    const { rows: existing } = await db.query('SELECT id, mrn FROM patients WHERE mrn = ANY($1::text[])', [mrns]);
    const byMrn = new Map(existing.map((r) => [r.mrn, r]));
    const { rows: emailOwners } = emails.length
      ? await db.query('SELECT mrn, lower(email) AS email FROM patients WHERE lower(email) = ANY($1::text[])', [emails])
      : { rows: [] };
    const ownerOf = new Map(emailOwners.map((r) => [r.email, r.mrn]));
    for (const c of checked) {
      const owner = c.value.email ? ownerOf.get(c.value.email) : null;
      if (owner && owner !== c.value.mrn) errors.push({ row: c.row, field: 'email', message: `${c.value.email} already belongs to the patient with MRN ${owner}` });
      ops.push({ row: c.row, value: c.value, existing: byMrn.get(c.value.mrn) || null });
    }
    return { ops, errors };
  }

  // appointments
  const mrns = [...new Set(checked.map((c) => c.value.patient_mrn))];
  const { rows: pts } = await db.query('SELECT id, mrn FROM patients WHERE mrn = ANY($1::text[])', [mrns]);
  const patientOf = new Map(pts.map((r) => [r.mrn, r.id]));
  const emails = [...new Set(checked.map((c) => c.value.provider_email).filter(Boolean))];
  const { rows: provs } = emails.length
    ? await db.query(
      `SELECT p.id, lower(p.email) AS email FROM providers p
        WHERE lower(p.email) = ANY($1::text[])
          AND EXISTS (SELECT 1 FROM public.memberships m WHERE m.user_id = p.id AND m.practice_id = $2 AND m.status = 'active')`,
      [emails, practiceId])
    : { rows: [] };
  const providerOf = new Map(provs.map((r) => [r.email, r.id]));
  const seen = new Map();
  for (const c of checked) {
    const v = c.value;
    const patientId = patientOf.get(v.patient_mrn);
    if (!patientId) { errors.push({ row: c.row, field: 'patient_mrn', message: `no patient with MRN ${v.patient_mrn} — import patients first` }); continue; }
    let providerId = null;
    if (v.provider_email) {
      providerId = providerOf.get(v.provider_email) || null;
      if (!providerId) { errors.push({ row: c.row, field: 'provider_email', message: `${v.provider_email} is not a provider in this practice` }); continue; }
    }
    const key = `${patientId}|${v.start_time}`;
    if (seen.has(key)) { errors.push({ row: c.row, field: 'start_time', message: `same patient and start time as row ${seen.get(key)}` }); continue; }
    seen.set(key, c.row);
    const duration = v.duration_minutes || (v.end_time ? null : 30);
    const end = v.end_time || plusMinutes(v.start_time, duration);
    const minutes = Math.round((new Date(`${end.replace(' ', 'T')}Z`) - new Date(`${v.start_time.replace(' ', 'T')}Z`)) / 60000);
    ops.push({ row: c.row, value: { ...v, end_time: end, duration_minutes: minutes }, patientId, providerId });
  }
  if (ops.length) {
    const { rows: found } = await db.query(
      `SELECT id, patient_id::text AS patient_id, to_char(start_time, 'YYYY-MM-DD HH24:MI:SS') AS start_time FROM appointments
        WHERE patient_id = ANY($1::uuid[]) AND start_time = ANY($2::timestamp[])`,
      [ops.map((o) => o.patientId), ops.map((o) => o.value.start_time)]);
    const existing = new Map(found.map((r) => [`${r.patient_id}|${r.start_time}`, r.id]));
    for (const o of ops) o.existing = existing.get(`${o.patientId}|${o.value.start_time}`) || null;
  }
  return { ops, errors };
}

/** Find or create a category by name; returns its id. Cached per import. */
async function categoryId(client, table, name, cache, userId) {
  const key = lc(name);
  if (cache.has(key)) return cache.get(key);
  const { rows: [hit] } = await client.query(`SELECT id FROM ${table} WHERE lower(name) = $1 LIMIT 1`, [key]);
  let id = hit && hit.id;
  if (!id && table === 'service_categories') {
    id = (await client.query('INSERT INTO service_categories (name) VALUES ($1) RETURNING id', [String(name).trim()])).rows[0].id;
  } else if (!id) {
    // inventory_categories needs a unique upper-case code; derive it from the name.
    const base = String(name).toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 20) || 'CAT';
    let code = base;
    for (let i = 2; (await client.query('SELECT 1 FROM inventory_categories WHERE code = $1', [code])).rowCount; i += 1) code = `${base}-${i}`;
    id = (await client.query('INSERT INTO inventory_categories (code, name, created_by) VALUES ($1, $2, $3) RETURNING id', [code, String(name).trim(), userId || null])).rows[0].id;
  }
  cache.set(key, id);
  return id;
}

const PATIENT_COLS = ['first_name', 'last_name', 'date_of_birth', 'gender', 'email', 'phone', 'address', 'city', 'state', 'zip',
  'country', 'insurance', 'insurance_id', 'allergies', 'current_medications', 'past_history', 'family_history', 'status'];
const APPT_COLS = ['provider_id', 'appointment_type', 'end_time', 'duration_minutes', 'reason', 'notes', 'status', 'timezone'];

async function writeSimple(client, kind, o, mode, ctx) {
  const s = SIMPLE[kind];
  const cols = []; const vals = [];
  for (const [field, target] of Object.entries(s.map)) {
    if (o.value[field] === undefined) continue;
    // The key matched (names ignore case): keep it as stored rather than re-casing it.
    if (o.existing && field === s.keyField) continue;
    if (typeof target === 'function') { const [c, v] = target(o.value[field]); cols.push(c); vals.push(v); } else { cols.push(target); vals.push(o.value[field]); }
  }
  if (o.supplierId) { cols.push('supplier_id'); vals.push(o.supplierId); }
  if (o.value.category && kind === 'products') { cols.push('category_id'); vals.push(await categoryId(client, 'inventory_categories', o.value.category, ctx.cats, ctx.userId)); }
  if (o.value.category && kind === 'services') { cols.push('category_id'); vals.push(await categoryId(client, 'service_categories', o.value.category, ctx.svcCats, ctx.userId)); }

  let id = o.existing;
  if (id) {
    if (mode === 'create_only') return 'unchanged';
    if (cols.length) {
      if (s.stamp) { cols.push('updated_by'); vals.push(ctx.userId); }
      await client.query(`UPDATE ${s.table} SET ${cols.map((c, i) => `${c} = $${i + 2}`).join(', ')}, updated_at = NOW() WHERE id = $1`, [id, ...vals]);
    }
  } else {
    for (const [field, col] of Object.entries(s.createOnly || {})) if (o.value[field] !== undefined) { cols.push(col); vals.push(o.value[field]); }
    if (kind === 'products') { cols.push('item_number'); vals.push((await client.query('SELECT generate_item_number() AS n')).rows[0].n); }
    if (kind === 'services') { cols.push('gender_restriction'); vals.push('any'); }
    if (s.stamp) { cols.push('created_by', 'updated_by'); vals.push(ctx.userId, ctx.userId); }
    if (kind === 'services' || kind === 'insurers') { cols.push('created_at'); vals.push(new Date()); }
    id = (await client.query(`INSERT INTO ${s.table} (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`, vals)).rows[0].id;
  }
  if (kind === 'services' && o.value.price !== undefined) {
    const upd = await client.query(
      `UPDATE offering_pricing SET base_price = $2, final_price = $2 - ($2 * COALESCE(discount_percentage, 0) / 100), updated_at = NOW()
        WHERE offering_id = $1 AND pricing_type = 'standard'`, [id, o.value.price]);
    if (!upd.rowCount) {
      await client.query(
        `INSERT INTO offering_pricing (offering_id, pricing_type, pricing_name, base_price, discount_percentage, final_price, is_active)
         VALUES ($1, 'standard', 'Standard price', $2, 0, $2, true)`, [id, o.value.price]);
    }
  }
  if (kind === 'products') ctx.productIds.push(id);
  return o.existing ? 'updated' : 'created';
}

async function write(client, kind, ops, mode, ctx) {
  const counts = { created: 0, updated: 0, unchanged: 0 };
  for (const o of ops) {
    if (SIMPLE[kind]) { counts[await writeSimple(client, kind, o, mode, ctx)] += 1; continue; }
    if (kind === 'patients') {
      const v = o.value;
      if (o.existing) {
        const set = PATIENT_COLS.filter((c) => v[c] !== undefined);
        if (mode === 'create_only' || !set.length) { counts.unchanged += 1; continue; }
        await client.query(
          `UPDATE patients SET ${set.map((c, i) => `${c} = $${i + 2}`).join(', ')}, updated_at = NOW() WHERE id = $1`,
          [o.existing.id, ...set.map((c) => v[c])]);
        counts.updated += 1;
      } else {
        const cols = ['mrn', ...PATIENT_COLS.filter((c) => v[c] !== undefined)];
        const vals = cols.map((c) => v[c]);
        if (!cols.includes('status')) { cols.push('status'); vals.push('active'); }
        cols.push('practice_id'); vals.push(ctx.practiceId);
        await client.query(
          `INSERT INTO patients (id, ${cols.join(', ')}, created_at, updated_at)
           VALUES (gen_random_uuid(), ${cols.map((_, i) => `$${i + 1}`).join(', ')}, NOW(), NOW())`, vals);
        counts.created += 1;
      }
      continue;
    }
    // appointments
    const v = { ...o.value, provider_id: o.providerId };
    if (o.existing) {
      const set = APPT_COLS.filter((c) => v[c] !== undefined && v[c] !== null);
      if (mode === 'create_only' || !set.length) { counts.unchanged += 1; continue; }
      await client.query(
        `UPDATE appointments SET ${set.map((c, i) => `${c} = $${i + 2}`).join(', ')}, updated_at = NOW() WHERE id = $1`,
        [o.existing, ...set.map((c) => v[c])]);
      counts.updated += 1;
    } else {
      await client.query(
        `INSERT INTO appointments (patient_id, provider_id, practice_id, appointment_type, start_time, end_time, duration_minutes,
                                   reason, notes, status, timezone, booking_source, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'import',NOW(),NOW())`,
        [o.patientId, o.providerId, ctx.practiceId, v.appointment_type || null, v.start_time, v.end_time, v.duration_minutes,
         v.reason || null, v.notes || null, v.status || 'scheduled', v.timezone || 'UTC']);
      counts.created += 1;
    }
  }
  return counts;
}

/** Would these new patients exceed the plan's limit? → error message or null */
async function patientQuotaProblem(req, db, newPatients) {
  if (!newPatients) return null;
  try {
    const { loadPlan, isPlanExpired, UNLIMITED } = require('../../middleware/planEnforcement');
    const plan = await loadPlan(req.app.locals.pool, req);
    if (!plan || !plan.enforcement_enabled || plan.max_patients === UNLIMITED) return null;
    if (isPlanExpired(plan)) return `The ${plan.plan_name} plan has expired.`;
    const { rows: [{ cnt }] } = await db.query("SELECT COUNT(*)::int AS cnt FROM patients WHERE lower(status) = 'active'");
    if (cnt + newPatients > plan.max_patients) {
      return `This import adds ${newPatients} patients; the ${plan.plan_name} plan allows ${plan.max_patients} and ${cnt} are active. Upgrade the plan or import fewer.`;
    }
  } catch (e) {
    console.warn('[import] plan check skipped:', e.message);
  }
  return null;
}

async function runImport(req, kind, rawRows, { dryRun = false, mode = 'upsert' } = {}) {
  if (!FORMATS[kind]) return { status: 404, error: `Unknown import kind. Use one of: ${KINDS.join(', ')}.` };
  if (!['upsert', 'create_only'].includes(mode)) return { status: 400, error: 'mode must be "upsert" or "create_only".' };
  if (!Array.isArray(rawRows)) return { status: 400, error: 'rows must be an array of objects.' };
  if (!rawRows.length) return { status: 400, error: 'There are no rows to import.' };
  if (rawRows.length > MAX_ROWS) return { status: 413, error: `At most ${MAX_ROWS} rows per request; split the import into batches.` };
  const practiceId = req.tenant && req.tenant.practiceId;
  const db = req.db;
  if (!practiceId || !db || !req.tenant.schemaName || req.tenant.schemaName === 'public') {
    return { status: 409, error: 'This account is not linked to a practice.' };
  }

  const known = new Set(FORMATS[kind].fields.map((f) => f.name));
  const unknown = new Set();
  const checked = [];
  const errors = [];
  rawRows.forEach((raw, i) => {
    const rowNumber = i + 1;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) { errors.push({ row: rowNumber, field: null, message: 'must be an object' }); return; }
    const lowered = Object.fromEntries(Object.entries(raw).map(([k, v]) => [String(k).trim().toLowerCase(), v]));
    Object.keys(lowered).forEach((k) => { if (!known.has(k)) unknown.add(k); });
    const r = checkRow(kind, lowered, rowNumber);
    errors.push(...r.errors);
    if (!r.errors.length) checked.push({ row: rowNumber, value: r.value });
  });

  const planned = await plan(db, kind, checked, { practiceId });
  errors.push(...planned.errors);
  const newCount = planned.ops.filter((o) => !o.existing).length;
  const existingCount = planned.ops.length - newCount;
  const summary = {
    kind, dryRun, mode, received: rawRows.length,
    ignoredColumns: [...unknown],
    created: newCount,
    updated: mode === 'upsert' ? existingCount : 0,
    unchanged: mode === 'upsert' ? 0 : existingCount,
  };

  if (kind === 'patients' && !errors.length) {
    const q = await patientQuotaProblem(req, db, newCount);
    if (q) errors.push({ row: null, field: null, message: q });
  }
  errors.sort((a, b) => (a.row || 0) - (b.row || 0));
  if (errors.length) {
    return { status: 422, body: { ...summary, created: 0, updated: 0, unchanged: 0, written: false, errors } };
  }
  if (dryRun) return { status: 200, body: { ...summary, written: false, errors: [] } };

  // One transaction for the whole import, on the practice's own schema.
  const schema = req.tenant.schemaName;
  if (!/^[a-z_][a-z0-9_]*$/.test(schema)) return { status: 409, error: 'This account is not linked to a practice.' };
  const ctx = { practiceId, userId: (req.user && req.user.id) || null, cats: new Map(), svcCats: new Map(), productIds: [] };
  const client = await req.app.locals.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL search_path TO ${schema}, public, control`);
    const counts = await write(client, kind, planned.ops, mode, ctx);
    await client.query('COMMIT');
    if (ctx.productIds.length) {
      // Imported stock below its reorder level tells the people who reorder, as usual.
      try { require('../lowStockAlerts').checkItems(db, ctx.productIds, { practiceId }).catch(() => {}); } catch { /* best effort */ }
    }
    return { status: 200, body: { ...summary, ...counts, written: true, errors: [] } };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[import] write failed:', e.message);
    const detail = e.code === '23505' ? 'a record with the same key was added at the same time — run the import again'
      : e.code === '23514' ? `a value was refused by the database (${e.constraint || 'check'})` : 'the database refused it';
    return { status: 500, body: { ...summary, created: 0, updated: 0, unchanged: 0, written: false, errors: [{ row: null, field: null, message: `Nothing was imported: ${detail}.` }] } };
  } finally {
    client.release();
  }
}

module.exports = { FORMATS, KINDS, MAX_ROWS, templateRows, templateCsv, publishedFormats, rowsFromCsv, checkRow, runImport };
