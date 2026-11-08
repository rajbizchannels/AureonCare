import React from 'react';

// Small Markdown support for AI drafts.
//
//  * MarkdownView renders headings, bold/italic, inline code, code blocks, bullet and
//    numbered lists, block quotes, rules and simple tables. It builds React elements —
//    never innerHTML — so model output cannot inject markup or scripts.
//  * toPlainText strips the Markdown for plain-text fields (SOAP notes, message replies).
//  * extractSoap / extractCodes pull the parts a form can use out of a draft.

// ── inline ────────────────────────────────────────────────────────────────────────

const INLINE_RE = /(`[^`]+`)|(\*\*[^*]+\*\*|__[^_]+__)|(\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;

function renderInline(text, keyPrefix) {
  const out = [];
  let last = 0;
  let m;
  let i = 0;
  INLINE_RE.lastIndex = 0;
  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const token = m[0];
    const key = `${keyPrefix}-${i++}`;
    if (m[1]) out.push(<code key={key} className="px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono text-[0.9em]">{token.slice(1, -1)}</code>);
    else if (m[2]) out.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    else out.push(<em key={key}>{token.slice(1, -1)}</em>);
    last = m.index + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

// ── blocks ────────────────────────────────────────────────────────────────────────

const isTableRow = (l) => /^\s*\|.*\|\s*$/.test(l);
const isTableSep = (l) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l);
const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());

export function parseBlocks(md) {
  const lines = String(md || '').replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i += 1; continue; }

    if (/^\s*```/.test(line)) {
      const body = [];
      i += 1;
      while (i < lines.length && !/^\s*```/.test(lines[i])) { body.push(lines[i]); i += 1; }
      i += 1;
      blocks.push({ type: 'code', text: body.join('\n') });
      continue;
    }
    const h = line.match(/^\s*(#{1,6})\s+(.*)$/);
    if (h) { blocks.push({ type: 'heading', level: h[1].length, text: h[2].replace(/\s*#+\s*$/, '') }); i += 1; continue; }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { blocks.push({ type: 'rule' }); i += 1; continue; }

    if (isTableRow(line) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const head = cells(line);
      const rows = [];
      i += 2;
      while (i < lines.length && isTableRow(lines[i])) { rows.push(cells(lines[i])); i += 1; }
      blocks.push({ type: 'table', head, rows });
      continue;
    }
    if (/^\s*>/.test(line)) {
      const body = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) { body.push(lines[i].replace(/^\s*>\s?/, '')); i += 1; }
      blocks.push({ type: 'quote', text: body.join(' ') });
      continue;
    }
    const listMatch = line.match(/^\s*([-*+]|\d+[.)])\s+/);
    if (listMatch) {
      const ordered = /\d/.test(listMatch[1]);
      const items = [];
      while (i < lines.length) {
        const lm = lines[i].match(/^\s*([-*+]|\d+[.)])\s+(.*)$/);
        if (lm && /\d/.test(lm[1]) === ordered) { items.push(lm[2]); i += 1; }
        else if (lines[i].trim() && /^\s{2,}\S/.test(lines[i]) && items.length) { items[items.length - 1] += ` ${lines[i].trim()}`; i += 1; }
        else break;
      }
      blocks.push({ type: ordered ? 'ol' : 'ul', items });
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim()
      && !/^\s*(#{1,6}\s|```|>|([-*+]|\d+[.)])\s)/.test(lines[i])
      && !(isTableRow(lines[i]) && i + 1 < lines.length && isTableSep(lines[i + 1]))) {
      para.push(lines[i].trim());
      i += 1;
    }
    blocks.push({ type: 'p', text: para.join('\n') });
  }
  return blocks;
}

const HEADING_CLS = {
  1: 'text-lg font-bold mt-3 mb-1',
  2: 'text-base font-bold mt-3 mb-1',
  3: 'text-sm font-semibold mt-2 mb-1',
};

export function MarkdownView({ text, className = '' }) {
  const blocks = parseBlocks(text);
  return (
    <div className={`text-sm leading-relaxed space-y-2 break-words ${className}`}>
      {blocks.map((b, bi) => {
        const k = `b${bi}`;
        switch (b.type) {
          case 'heading': {
            const Tag = `h${Math.min(b.level + 2, 6)}`;
            return <Tag key={k} className={HEADING_CLS[b.level] || HEADING_CLS[3]}>{renderInline(b.text, k)}</Tag>;
          }
          case 'code':
            return <pre key={k} className="p-2 rounded bg-black/10 dark:bg-white/10 overflow-x-auto font-mono text-xs whitespace-pre">{b.text}</pre>;
          case 'rule':
            return <hr key={k} className="opacity-30" />;
          case 'quote':
            return <blockquote key={k} className="pl-3 border-l-4 border-indigo-400/50 opacity-90">{renderInline(b.text, k)}</blockquote>;
          case 'ul':
            return <ul key={k} className="list-disc pl-5 space-y-1">{b.items.map((it, ii) => <li key={`${k}-${ii}`}>{renderInline(it, `${k}-${ii}`)}</li>)}</ul>;
          case 'ol':
            return <ol key={k} className="list-decimal pl-5 space-y-1">{b.items.map((it, ii) => <li key={`${k}-${ii}`}>{renderInline(it, `${k}-${ii}`)}</li>)}</ol>;
          case 'table':
            return (
              <div key={k} className="overflow-x-auto">
                <table className="min-w-full text-xs border-collapse">
                  <thead><tr>{b.head.map((c, ci) => <th key={ci} className="border border-current/20 px-2 py-1 text-left font-semibold">{renderInline(c, `${k}h${ci}`)}</th>)}</tr></thead>
                  <tbody>{b.rows.map((r, ri) => <tr key={ri}>{r.map((c, ci) => <td key={ci} className="border border-current/20 px-2 py-1 align-top">{renderInline(c, `${k}r${ri}c${ci}`)}</td>)}</tr>)}</tbody>
                </table>
              </div>
            );
          default:
            return <p key={k} className="whitespace-pre-line">{renderInline(b.text, k)}</p>;
        }
      })}
    </div>
  );
}

// ── plain text ────────────────────────────────────────────────────────────────────

const stripInline = (s) => String(s)
  .replace(/`([^`]+)`/g, '$1')
  .replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, (_, a, b) => a || b)
  .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1$2')
  .replace(/(^|[\s(])_([^_\s][^_]*)_/g, '$1$2');

/** Markdown -> readable plain text for fields that do not render Markdown. */
export function toPlainText(md) {
  return parseBlocks(md).map((b) => {
    switch (b.type) {
      case 'heading': return stripInline(b.text).toUpperCase() === stripInline(b.text) ? stripInline(b.text) : `${stripInline(b.text)}:`;
      case 'ul': return b.items.map((it) => `- ${stripInline(it)}`).join('\n');
      case 'ol': return b.items.map((it, n) => `${n + 1}. ${stripInline(it)}`).join('\n');
      case 'table': return [b.head, ...b.rows].map((r) => r.map(stripInline).join(' | ')).join('\n');
      case 'rule': return '';
      case 'code': return b.text;
      default: return stripInline(b.text);
    }
  }).filter((s) => s !== '').join('\n\n').trim();
}

// ── SOAP + codes ──────────────────────────────────────────────────────────────────

/**
 * The SOAP part of a draft: from a heading mentioning SOAP (or the start) up to a heading
 * about codes. Returns Markdown, or '' when the draft has no SOAP content.
 */
export function extractSoap(md) {
  const lines = String(md || '').replace(/\r\n?/g, '\n').split('\n');
  const isHeading = (l) => /^\s*#{1,6}\s+/.test(l);
  const isCodesHeading = (l) => isHeading(l) && /code|icd|cpt/i.test(l);
  let start = lines.findIndex((l) => isHeading(l) && /soap/i.test(l));
  const hasSoapWords = /\b(subjective|objective|assessment|plan)\b/i.test(md || '');
  if (start === -1 && !hasSoapWords) return '';
  start = start === -1 ? 0 : start + 1;
  let end = lines.findIndex((l, idx) => idx >= start && isCodesHeading(l));
  if (end === -1) end = lines.length;
  return lines.slice(start, end).join('\n').trim();
}

// ICD-10-CM: letter (not U), digit, alphanumeric, optional . and up to 4 more.
const ICD_RE = /\b([A-TV-Z][0-9][0-9A-Z](?:\.[0-9A-Z]{1,4})?)\b/;
// CPT: 5 characters, four digits then a digit or F/T/U (Category II/III, PLA).
const CPT_RE = /\b(\d{4}[0-9FTU])\b/;

const cleanDesc = (s) => stripInline(s)
  .replace(/^[\s:–—\-|`*]+/, '')
  .split(/\s+[—–]\s+|\s+-\s+(?=["“])|\s+\|\s+/)[0]
  .replace(/[`*"“”]+/g, '')
  .replace(/[\s.;,]+$/, '')
  .trim();

/**
 * Pull ICD-10 and CPT codes out of a draft. A line that names "CPT" is read as CPT, one
 * that names "ICD" as ICD-10; otherwise the shape of the code decides.
 * @returns {{icd: Array<{code, description}>, cpt: Array<{code, description}>}}
 */
export function extractCodes(md) {
  const icd = new Map();
  const cpt = new Map();
  let section = null; // set by a heading such as "### ICD-10" or "### CPT"
  String(md || '').split(/\r?\n/).forEach((raw) => {
    const line = raw.replace(/^\s*([-*+]|\d+[.)])\s+/, '').trim();
    if (!line) return;
    if (/^#{1,6}\s/.test(raw.trim())) {
      // Medication and lab-test sections are read by their own helpers; a lab test's CPT
      // code is an order, not a procedure code for this diagnosis.
      section = isOrderHeading(line) ? 'skip'
        : /cpt|procedure/i.test(line) ? 'cpt' : /icd|diagnos/i.test(line) ? 'icd' : section === 'skip' ? null : section;
      return;
    }
    if (section === 'skip') return;
    if (isTableSep(raw)) return;
    const text = isTableRow(raw) ? cells(raw).join(' — ') : line;
    const saysCpt = /\bCPT\b/i.test(text);
    const saysIcd = /\bICD(-?10)?\b/i.test(text);
    const kind = saysCpt && !saysIcd ? 'cpt' : saysIcd && !saysCpt ? 'icd' : section;

    const tryCpt = () => {
      const m = text.match(CPT_RE);
      if (!m) return false;
      if (!cpt.has(m[1])) cpt.set(m[1], { code: m[1], description: cleanDesc(text.slice(m.index + m[1].length)) });
      return true;
    };
    const tryIcd = () => {
      const m = text.match(ICD_RE);
      if (!m) return false;
      const code = m[1].toUpperCase();
      if (!icd.has(code)) icd.set(code, { code, description: cleanDesc(text.slice(m.index + m[1].length)) });
      return true;
    };
    if (kind === 'cpt') tryCpt();
    else if (kind === 'icd') tryIcd();
    else if (!tryIcd()) tryCpt();
  });
  return { icd: [...icd.values()], cpt: [...cpt.values()] };
}

// ── medications + lab tests ───────────────────────────────────────────────────────

const MED_HEADING = /medication|prescri|\bdrugs?\b|\brx\b/i;
const LAB_HEADING = /\blab|tests?\b|investigation|diagnostics?\b|work-?up/i;
function isOrderHeading(line) {
  return (MED_HEADING.test(line) || LAB_HEADING.test(line)) && !/icd|cpt|code/i.test(line);
}

/** List items under headings matching `re`, until the next heading. */
function sectionItems(md, re) {
  const out = [];
  let inSection = false;
  String(md || '').split(/\r?\n/).forEach((raw) => {
    const t = raw.trim();
    if (/^#{1,6}\s/.test(t)) { inSection = re.test(t) && !/icd|cpt|code/i.test(t); return; }
    if (!inSection || !t) return;
    const m = t.match(/^([-*+]|\d+[.)])\s+(.*)$/);
    if (m) out.push(m[2].trim());
    else if (isTableRow(t) && !isTableSep(t)) out.push(cells(t).join(' — '));
  });
  return out.filter((x) => !/^(none|n\/a|no (medications?|tests?))\.?$/i.test(stripInline(x)));
}

/**
 * Medications from a "## Medications" section.
 * Expected line: - `Drug name` strength — dose and frequency — duration
 * @returns {Array<{name, strength, instructions}>}
 */
export function extractMedications(md) {
  const seen = new Set();
  return sectionItems(md, MED_HEADING).map((item) => {
    const code = item.match(/`([^`]+)`/);
    const parts = stripInline(item).split(/\s+[—–]\s+|\s+-\s+|\s*;\s*/).map((x) => x.trim()).filter(Boolean);
    let head = code ? code[1].trim() : parts[0] || '';
    let rest = code ? stripInline(item).replace(code[1], '').replace(/^[\s:—–-]+/, '') : parts.slice(1).join(' — ');
    // "Drug 500 mg" -> name "Drug", strength "500 mg"
    const UNIT = '(?:mg|mcg|µg|g|ml|mL|units?|iu|IU|%)';
    const inHead = head.match(new RegExp(`\\s+(\\d+(?:\\.\\d+)?\\s*${UNIT}(?:\\s*\\/\\s*\\d*\\s*(?:mg|ml|mL))?)(?![A-Za-z])`));
    const atRestStart = rest.match(new RegExp(`^(\\d+(?:\\.\\d+)?\\s*${UNIT})(?![A-Za-z])\\s*[—–-]?\\s*`));
    let strength = '';
    if (inHead) {
      strength = inHead[1].trim();
      head = head.replace(inHead[0], '').trim();
    } else if (atRestStart) {
      strength = atRestStart[1].trim();
      rest = rest.slice(atRestStart[0].length);
    }
    const name = head.replace(/[`*]+/g, '').trim();
    return { name, strength, instructions: rest.replace(/^[\s—–-]+/, '').trim() };
  }).filter((m) => {
    const key = m.name.toLowerCase();
    if (!m.name || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Lab tests from a "## Lab tests" section.
 * Expected line: - Test name — CPT `CODE` (the code is optional)
 * @returns {Array<{name, cpt}>}
 */
export function extractLabTests(md) {
  const seen = new Set();
  return sectionItems(md, LAB_HEADING).map((item) => {
    const plain = stripInline(item);
    const code = plain.match(/\b(8\d{4})\b/);
    const name = plain
      .replace(/\(?\s*CPT[:\s]*\d{5}\s*\)?/i, '')
      .replace(code ? code[1] : /$^/, '')
      .split(/\s+[—–]\s+|\s+-\s+/)[0]
      .replace(/[()[\]]/g, '')
      .replace(/[\s,;:.—–-]+$/, '')
      .trim();
    return { name, cpt: code ? code[1] : null };
  }).filter((t) => {
    const key = (t.cpt || t.name).toLowerCase();
    if (!t.name || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
