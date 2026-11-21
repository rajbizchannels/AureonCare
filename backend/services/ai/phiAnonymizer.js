// PHI anonymizer for outbound AI calls.
//
// Before a prompt leaves AureonCare, every PHI value we can find is swapped for a
// placeholder such as [[PATIENT_NAME_1]]. The provider only ever sees placeholders. When
// the answer comes back, the placeholders are swapped back to the real values
// ("re-identification") so the reviewer reads a normal draft.
//
// Two detection passes, in this order:
//   1. record  — exact values we already hold for the patient (name, MRN, date of birth,
//                phone, email, address, insurance ID). Most reliable, so it runs first.
//   2. pattern — regexes for PHI shapes we were not told about (emails, phone numbers,
//                SSNs, dates, URLs, IP addresses, long ID numbers).
//
// Limits, stated plainly: pattern matching cannot find every name written in free text
// (for example a relative mentioned only by first name). That is why the gateway also
// requires a signed BAA/DPA with any cloud provider, and why every result is a draft a
// person reviews. This module reduces exposure; it is not a de-identification
// certificate.
//
// Pure functions, no I/O — the gateway persists the map (ai_phi_token_map).

const TOKEN_RE = /\[\[\s*([A-Z_]+_\d+)\s*\]\]/g;

// Letter/number boundaries that also work for Arabic and accented names, where \b fails.
const NOT_WORD_BEFORE = '(?<![\\p{L}\\p{N}])';
const NOT_WORD_AFTER = '(?![\\p{L}\\p{N}])';

const MONTHS = 'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';

// Order matters: wider shapes first so an email is not half-eaten by the URL rule, and an
// ISO date is not read as a phone number.
const PATTERNS = [
  { category: 'EMAIL', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  { category: 'URL', re: /\bhttps?:\/\/[^\s<>"')\]]*[^\s<>"')\].,;:!?]/gi },
  { category: 'IP_ADDRESS', re: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g },
  { category: 'SSN', re: /\b\d{3}-\d{2}-\d{4}\b/g },
  { category: 'DATE', re: /\b\d{4}-\d{1,2}-\d{1,2}\b/g },
  { category: 'DATE', re: /\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/g },
  { category: 'DATE', re: new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${MONTHS})\\.?,?\\s+\\d{4}\\b`, 'gi') },
  { category: 'DATE', re: new RegExp(`\\b(?:${MONTHS})\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4}\\b`, 'gi') },
  { category: 'MRN', re: /\b(?:MRN|medical record(?: number| no\.?)?)\s*[:#]?\s*([A-Za-z0-9-]{4,})/gi, group: 1 },
  { category: 'PHONE', re: /(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)[\s.-]?|\b\d{2,4}[\s.-])\d{3,4}[\s.-]\d{3,4}\b/g },
  // Long digit runs: account, policy, card or member numbers.
  { category: 'ID_NUMBER', re: /\b\d{8,}\b/g },
];

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalise(value) {
  return String(value).trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Turn a patient row into the list of known values to remove. */
function entitiesFromPatient(patient) {
  if (!patient) return [];
  const out = [];
  const add = (category, value) => {
    if (value == null) return;
    const v = String(value).trim();
    if (v.length >= 2) out.push({ category, value: v });
  };

  const first = patient.first_name || patient.firstName;
  const last = patient.last_name || patient.lastName;
  if (first && last) {
    add('PATIENT_NAME', `${first} ${last}`);
    add('PATIENT_NAME', `${last}, ${first}`);
    add('PATIENT_NAME', `${last} ${first}`);
  }
  add('PATIENT_NAME', first);
  add('PATIENT_NAME', last);
  add('MRN', patient.mrn);

  const dob = patient.date_of_birth || patient.dateOfBirth;
  if (dob) {
    const d = dob instanceof Date ? dob : new Date(dob);
    if (!Number.isNaN(d.getTime())) {
      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(d.getUTCDate()).padStart(2, '0');
      add('DATE_OF_BIRTH', `${yyyy}-${mm}-${dd}`);
      add('DATE_OF_BIRTH', `${mm}/${dd}/${yyyy}`);
      add('DATE_OF_BIRTH', `${dd}/${mm}/${yyyy}`);
      add('DATE_OF_BIRTH', `${dd}.${mm}.${yyyy}`);
    } else {
      add('DATE_OF_BIRTH', dob);
    }
  }

  add('PHONE', patient.phone);
  add('EMAIL', patient.email);
  add('ADDRESS', patient.address);
  add('ADDRESS', patient.city);
  add('ZIP', patient.zip);
  add('INSURANCE_ID', patient.insurance_id || patient.insuranceId);
  return out;
}

/**
 * Replace PHI in `text` with placeholders.
 *
 * @param {string} text
 * @param {{entities?: Array<{category: string, value: string}>}} [options]
 *        entities: known values (from entitiesFromPatient, provider names, ...)
 * @returns {{text: string, entries: Array<{token, category, method, value, occurrences}>}}
 */
function anonymize(text, options = {}) {
  let out = String(text == null ? '' : text);
  const byValue = new Map();   // normalised value -> entry (same value, same token)
  const counters = new Map();  // category -> last number used
  const entries = [];

  const tokenFor = (category, value, method) => {
    const key = `${category}|${normalise(value)}`;
    let entry = byValue.get(key);
    if (!entry) {
      // One value can appear under different spellings (e.g. a date-of-birth that the
      // pattern pass also sees as a DATE). Reuse an existing token for the same value.
      entry = [...byValue.values()].find((e) => normalise(e.value) === normalise(value));
    }
    if (!entry) {
      const n = (counters.get(category) || 0) + 1;
      counters.set(category, n);
      entry = { token: `[[${category}_${n}]]`, category, method, value: String(value).trim(), occurrences: 0 };
      byValue.set(key, entry);
      entries.push(entry);
    }
    entry.occurrences += 1;
    return entry.token;
  };

  // Pass 1: known record values, longest first so "Maria Garcia" wins over "Maria".
  const known = (options.entities || [])
    .filter((e) => e && e.value && String(e.value).trim().length >= 2)
    .sort((a, b) => String(b.value).length - String(a.value).length);

  for (const { category, value } of known) {
    const re = new RegExp(`${NOT_WORD_BEFORE}${escapeRegex(String(value).trim()).replace(/\s+/g, '\\s+')}${NOT_WORD_AFTER}`, 'giu');
    out = out.replace(re, (match) => tokenFor(category, match, 'record'));
  }

  // Pass 2: patterns. Never touch text that is already a placeholder.
  for (const { category, re, group } of PATTERNS) {
    re.lastIndex = 0;
    out = splitAroundTokens(out, (chunk) => chunk.replace(re, (match, ...args) => {
      if (group) {
        const captured = args[group - 1];
        if (!captured) return match;
        return match.replace(captured, tokenFor(category, captured, 'pattern'));
      }
      return tokenFor(category, match, 'pattern');
    }));
  }

  return {
    text: out,
    entries: entries.map(({ token, category, method, value, occurrences }) => ({ token, category, method, value, occurrences })),
  };
}

/** Apply fn to the parts of `text` outside [[...]] placeholders. */
function splitAroundTokens(text, fn) {
  const parts = text.split(/(\[\[[A-Z_]+_\d+\]\])/);
  return parts.map((p, i) => (i % 2 === 1 ? p : fn(p))).join('');
}

/**
 * Put real values back into a provider response ("onymize").
 *
 * Tolerates small changes the model may make to a placeholder (spaces inside the
 * brackets). A placeholder we never issued is left as-is and reported in `unknownTokens`
 * so the reviewer sees it instead of a silently invented value.
 *
 * @returns {{text: string, restoredTokens: string[], unknownTokens: string[]}}
 */
function deanonymize(text, entries) {
  const map = new Map((entries || []).map((e) => [e.token.replace(/^\[\[|\]\]$/g, ''), e.value]));
  const restored = new Set();
  const unknown = new Set();
  const out = String(text == null ? '' : text).replace(TOKEN_RE, (match, inner) => {
    if (map.has(inner)) {
      restored.add(`[[${inner}]]`);
      return map.get(inner);
    }
    unknown.add(`[[${inner}]]`);
    return match;
  });
  return { text: out, restoredTokens: [...restored], unknownTokens: [...unknown] };
}

/** deanonymize for any JSON-shaped value (strings inside objects/arrays). */
function deanonymizeDeep(value, entries) {
  if (typeof value === 'string') return deanonymize(value, entries).text;
  if (Array.isArray(value)) return value.map((v) => deanonymizeDeep(v, entries));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = deanonymizeDeep(v, entries);
    return out;
  }
  return value;
}

module.exports = {
  anonymize,
  deanonymize,
  deanonymizeDeep,
  entitiesFromPatient,
  TOKEN_RE,
};
