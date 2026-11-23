/**
 * Data import — patients and appointments from another system, by CSV file or by API.
 *
 * One published format per kind (FORMATS below; served at GET /api/import/formats and as CSV
 * templates), used by both routes, so a file and an API call are checked the same way.
 *
 *   runImport(req, kind, rows, { dryRun, mode })
 *     → { kind, dryRun, mode, received, created, updated, unchanged, errors: [{ row, field, message }] }
 *
 * Rules
 * - ALL OR NOTHING: every row is checked first (formats, required fields, links such as the
 *   patient an appointment belongs to). If any row has an error, nothing is written and every
 *   error is reported with its row number. Fix the file and send it again.
 * - RE-RUNNABLE: patients are matched on MRN, appointments on patient + start time, so sending
 *   the same data twice changes nothing. mode "upsert" (default) updates what matched;
 *   "create_only" leaves matched records as they are.
 * - Patients are imported without portal accounts; invite them from the patient record later.
 * - The plan's patient limit applies to new patients.
 */

const { parseCsv, toCsv } = require('./csv');

const MAX_ROWS = 5000;

// type: text | date (YYYY-MM-DD) | datetime (YYYY-MM-DDTHH:MM[:SS], clinic local time) |
//       int | email | enum (values)
const FORMATS = {
  patients: {
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
      { name: 'status', type: 'enum', values: ['active', 'inactive'], description: 'active (default) or inactive', example: 'active' },
    ],
  },
  appointments: {
    description: 'One row per appointment. The patient must exist (import patients first, or in the same session). Matched on patient + start time.',
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

/** The CSV template: the header row, then one example row. */
function templateCsv(kind) {
  const f = FORMATS[kind];
  if (!f) return null;
  return toCsv([f.fields.map((x) => x.name), f.fields.map((x) => x.example || '')]);
}

/** The published format, as served by GET /api/import/formats. */
function publishedFormats() {
  return {
    version: 1,
    maxRowsPerRequest: MAX_ROWS,
    rules: [
      'All or nothing: if any row has an error, nothing is written and all errors are listed.',
      'Re-runnable: patients match on mrn, appointments on patient_mrn + start_time.',
      'mode "upsert" (default) updates matched records; "create_only" leaves them unchanged.',
      'dryRun true checks everything and reports what would happen, writing nothing.',
      'Empty cells are ignored when updating, so they never erase what is already stored.',
    ],
    kinds: Object.fromEntries(KINDS.map((k) => [k, {
      description: FORMATS[k].description, key: FORMATS[k].key,
      fields: FORMATS[k].fields.map(({ name, type, required, description, values, max, min, example }) => ({
        name, type, required: Boolean(required), description: description || null,
        values: values || undefined, maxLength: type === 'int' ? undefined : max, min, max: type === 'int' ? max : undefined, example,
      })),
    }])),
  };
}

/** CSV text → rows keyed by header. Header names are matched case-insensitively. */
function rowsFromCsv(text) {
  const table = parseCsv(String(text || ''));
  if (!table.length) return { rows: [], unknownColumns: [] };
  const header = table[0].map((h) => String(h || '').trim().toLowerCase());
  const rows = table.slice(1)
    .filter((r) => r.some((c) => String(c || '').trim() !== ''))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] === undefined ? '' : r[i]])));
  return { rows, header };
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

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
    if (f.max && f.type !== 'int' && v.length > f.max) { err(f.name, `is longer than ${f.max} characters`); continue; }
    switch (f.type) {
      case 'date': {
        const m = DATE_RE.exec(v);
        if (!m || !validDate(m[1], m[2], m[3])) { err(f.name, `"${v}" is not a date in the form YYYY-MM-DD`); continue; }
        if (v > new Date().toISOString().slice(0, 10)) { err(f.name, 'is in the future'); continue; }
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
      case 'email':
        v = v.toLowerCase();
        if (!EMAIL_RE.test(v)) { err(f.name, `"${v}" is not an email address`); continue; }
        break;
      case 'enum': {
        const lv = v.toLowerCase().replace(/_/g, '-');
        const hit = f.values.find((x) => x === lv || x.replace(/-/g, '') === lv.replace(/-/g, ''));
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

/** Look up everything the rows refer to and plan each write. Adds errors for broken links. */
async function plan(db, kind, checked, { practiceId }) {
  const errors = [];
  const ops = [];
  if (kind === 'patients') {
    const mrns = checked.map((c) => c.value.mrn);
    const dupe = mrns.find((m, i) => mrns.indexOf(m) !== i);
    if (dupe) checked.forEach((c) => { if (c.value.mrn === dupe) errors.push({ row: c.row, field: 'mrn', message: `MRN ${dupe} appears more than once in this import` }); });
    const emails = checked.map((c) => c.value.email).filter(Boolean);
    const dupeEmail = emails.find((m, i) => emails.indexOf(m) !== i);
    if (dupeEmail) checked.forEach((c) => { if (c.value.email === dupeEmail) errors.push({ row: c.row, field: 'email', message: `${dupeEmail} appears more than once in this import` }); });

    const { rows: existing } = await db.query('SELECT id, mrn, lower(email) AS email FROM patients WHERE mrn = ANY($1::text[])', [mrns]);
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

const PATIENT_COLS = ['first_name', 'last_name', 'date_of_birth', 'gender', 'email', 'phone', 'address', 'city', 'state', 'zip',
  'country', 'insurance', 'insurance_id', 'allergies', 'current_medications', 'past_history', 'family_history', 'status'];
const APPT_COLS = ['provider_id', 'appointment_type', 'end_time', 'duration_minutes', 'reason', 'notes', 'status', 'timezone'];

async function write(client, kind, ops, mode, practiceId) {
  let created = 0; let updated = 0; let unchanged = 0;
  for (const o of ops) {
    if (kind === 'patients') {
      const v = o.value;
      if (o.existing) {
        const set = PATIENT_COLS.filter((c) => v[c] !== undefined);
        if (mode === 'create_only' || !set.length) { unchanged += 1; continue; }
        await client.query(
          `UPDATE patients SET ${set.map((c, i) => `${c} = $${i + 2}`).join(', ')}, updated_at = NOW() WHERE id = $1`,
          [o.existing.id, ...set.map((c) => v[c])]);
        updated += 1;
      } else {
        const cols = ['mrn', ...PATIENT_COLS.filter((c) => v[c] !== undefined)];
        const vals = cols.map((c) => (c === 'status' ? v.status : v[c]));
        if (!cols.includes('status')) { cols.push('status'); vals.push('active'); }
        cols.push('practice_id'); vals.push(practiceId);
        await client.query(
          `INSERT INTO patients (id, ${cols.join(', ')}, created_at, updated_at)
           VALUES (gen_random_uuid(), ${cols.map((_, i) => `$${i + 1}`).join(', ')}, NOW(), NOW())`, vals);
        created += 1;
      }
    } else {
      const v = { ...o.value, provider_id: o.providerId };
      if (o.existing) {
        const set = APPT_COLS.filter((c) => v[c] !== undefined && v[c] !== null);
        if (mode === 'create_only' || !set.length) { unchanged += 1; continue; }
        await client.query(
          `UPDATE appointments SET ${set.map((c, i) => `${c} = $${i + 2}`).join(', ')}, updated_at = NOW() WHERE id = $1`,
          [o.existing, ...set.map((c) => v[c])]);
        updated += 1;
      } else {
        await client.query(
          `INSERT INTO appointments (patient_id, provider_id, practice_id, appointment_type, start_time, end_time, duration_minutes,
                                     reason, notes, status, timezone, booking_source, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'import',NOW(),NOW())`,
          [o.patientId, o.providerId, practiceId, v.appointment_type || null, v.start_time, v.end_time, v.duration_minutes,
           v.reason || null, v.notes || null, v.status || 'scheduled', v.timezone || 'UTC']);
        created += 1;
      }
    }
  }
  return { created, updated, unchanged };
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
  const client = await req.app.locals.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL search_path TO ${schema}, public, control`);
    const counts = await write(client, kind, planned.ops, mode, practiceId);
    await client.query('COMMIT');
    return { status: 200, body: { ...summary, ...counts, written: true, errors: [] } };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[import] write failed:', e.message);
    const detail = e.code === '23505' ? 'a record with the same MRN or email was added at the same time — run the import again' : 'the database refused it';
    return { status: 500, body: { ...summary, created: 0, updated: 0, unchanged: 0, written: false, errors: [{ row: null, field: null, message: `Nothing was imported: ${detail}.` }] } };
  } finally {
    client.release();
  }
}

module.exports = { FORMATS, KINDS, MAX_ROWS, templateCsv, publishedFormats, rowsFromCsv, checkRow, runImport };
