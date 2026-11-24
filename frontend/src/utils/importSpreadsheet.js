// Spreadsheet side of Settings → Import Data: read a CSV or Excel file into rows, and build
// the CSV / Excel templates from the published format (GET /api/import/formats).
//
// Excel is read in the browser (SheetJS, already part of the app) and sent to the server as
// rows of text, so the server never opens a spreadsheet itself. Cells Excel turned into dates
// or numbers are written back in the format the import expects (YYYY-MM-DD, YYYY-MM-DDTHH:MM).

const pad = (n) => String(n).padStart(2, '0');

/** One cell → the text the import expects. */
export function cellText(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return '';
    const d = `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
    return v.getHours() || v.getMinutes() ? `${d}T${pad(v.getHours())}:${pad(v.getMinutes())}` : d;
  }
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  return String(v).trim();
}

/** Rows as arrays (first = header) → objects keyed by lower-case header; blank rows dropped. */
export function rowsFromTable(table) {
  if (!Array.isArray(table) || !table.length) return [];
  const header = (table[0] || []).map((h) => cellText(h).toLowerCase());
  return table.slice(1)
    .map((r) => Object.fromEntries(header.map((h, i) => [h, cellText((r || [])[i])]).filter(([h]) => h)))
    .filter((o) => Object.values(o).some((x) => x !== ''));
}

export const isSpreadsheetName = (name) => /\.(xlsx|xls)$/i.test(String(name || ''));

/** Read the chosen file. → { kind: 'csv', text } | { kind: 'rows', rows, sheet } */
export async function readImportFile(file, preferredSheet) {
  if (!isSpreadsheetName(file.name)) return { kind: 'csv', text: await file.text() };
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  // The template workbook has one sheet per kind; use the one for this kind if it is there.
  const names = wb.SheetNames.filter((n) => !/^(read me|instructions)$/i.test(n));
  const sheet = names.find((n) => n.toLowerCase() === String(preferredSheet || '').toLowerCase()) || names[0];
  if (!sheet) return { kind: 'rows', rows: [], sheet: null };
  const table = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, raw: true, defval: '', blankrows: false });
  return { kind: 'rows', rows: rowsFromTable(table), sheet };
}

/** Template rows for a kind: header + example. */
export function templateTable(kindFormat) {
  return [kindFormat.fields.map((f) => f.name), kindFormat.fields.map((f) => f.example || '')];
}

const fieldRule = (f) => [
  f.values ? `One of: ${f.values.join(', ')}` : null,
  f.type === 'date' ? 'Date YYYY-MM-DD' : null,
  f.type === 'datetime' ? 'Date and time YYYY-MM-DDTHH:MM' : null,
  f.type === 'bool' ? 'yes or no' : null,
  f.type === 'int' ? `Whole number${f.min !== undefined ? ` ${f.min}–${f.max}` : ''}` : null,
  f.type === 'number' ? `Number${f.min !== undefined ? `, ${f.min} or more` : ''}` : null,
  f.type === 'list' ? 'Several values separated by ;' : null,
  f.maxLength ? `Up to ${f.maxLength} characters` : null,
  f.description,
].filter(Boolean).join('. ');

/**
 * An Excel template workbook: a "Read me" sheet (import order and every column's rules), then
 * one sheet per kind with the header and an example row. Text cells stay text, so Excel does not
 * turn MRNs or phone numbers into numbers.
 */
export async function downloadXlsxTemplate(formats, kinds, fileName) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const readMe = [['AureonCare import template'], [''],
    ['Fill in one sheet per kind, or keep only the sheet you need. Delete the example row before importing.'],
    ['Import in this order: ' + (formats.order || kinds).map((k) => formats.kinds[k].label).join(' → ')],
    ['Dates: YYYY-MM-DD. Date and time: YYYY-MM-DDTHH:MM. Required columns are marked yes.'], [''],
    ['Sheet', 'Column', 'Required', 'Rules', 'Example']];
  for (const k of kinds) {
    for (const f of formats.kinds[k].fields) readMe.push([formats.kinds[k].label, f.name, f.required ? 'yes' : '', fieldRule(f), f.example || '']);
  }
  const rm = XLSX.utils.aoa_to_sheet(readMe);
  rm['!cols'] = [{ wch: 18 }, { wch: 24 }, { wch: 9 }, { wch: 70 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(wb, rm, 'Read me');
  for (const k of kinds) {
    const table = templateTable(formats.kinds[k]);
    const ws = XLSX.utils.aoa_to_sheet(table.map((r) => r.map((c) => ({ t: 's', v: String(c), z: '@' }))));
    ws['!cols'] = table[0].map((h) => ({ wch: Math.max(14, h.length + 4) }));
    XLSX.utils.book_append_sheet(wb, ws, k);
  }
  XLSX.writeFile(wb, fileName);
}

/** A CSV template built from the format (the server serves the same at /templates/<kind>.csv). */
export function csvTemplateText(kindFormat) {
  const q = (s) => (/[",;\r\n]/.test(s) ? `"${String(s).replace(/"/g, '""')}"` : String(s));
  return `${templateTable(kindFormat).map((r) => r.map(q).join(',')).join('\r\n')}\r\n`;
}
