/**
 * CSV (RFC 4180) without a dependency: comma or semicolon separated (Excel in much of Europe
 * saves with semicolons), quoted fields with "" escapes and line breaks inside quotes, CRLF or
 * LF line ends, and a UTF-8 byte-order mark at the start.
 */

function detectDelimiter(text) {
  // Count separators in the header line, outside quotes.
  let commas = 0; let semis = 0; let inQ = false;
  for (const ch of text) {
    if (ch === '"') inQ = !inQ;
    else if (!inQ && (ch === '\n' || ch === '\r')) break;
    else if (!inQ && ch === ',') commas += 1;
    else if (!inQ && ch === ';') semis += 1;
  }
  return semis > commas ? ';' : ',';
}

/** CSV text → array of rows (arrays of strings). */
function parseCsv(input) {
  let text = String(input || '');
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  if (!text.trim()) return [];
  const sep = detectDelimiter(text);
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; } else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"' && field === '') inQuotes = true;
    else if (ch === sep) { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/** Rows (arrays) → CSV text with CRLF line ends, quoting only where needed. */
function toCsv(rows) {
  const cell = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\r\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return `${rows.map((r) => r.map(cell).join(',')).join('\r\n')}\r\n`;
}

module.exports = { parseCsv, toCsv };
