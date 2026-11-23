// Which national identifiers a practice uses — the same rule as backend/utils/practiceRegion.js.
// NPI, DEA, X12 eligibility and Surescripts exist only in the US (and its territories). The
// practice's country decides; with no country set, a USD currency means the US.

const US_LIKE = new Set(['US', 'PR', 'GU', 'VI', 'AS', 'MP']);

export const usIdentifiersApply = ({ country, currency } = {}) => {
  const c = String(country || '').trim().toUpperCase();
  if (c) return US_LIKE.has(c === 'USA' ? 'US' : c);
  return String(currency || '').toUpperCase() === 'USD';
};

/** NPI: 10 digits with the Luhn check over "80840" + the first nine. */
export const isValidNpi = (npi) => {
  const s = String(npi || '');
  if (!/^\d{10}$/.test(s)) return false;
  const digits = ('80840' + s.slice(0, 9)).split('').map(Number);
  let sum = 0;
  for (let i = digits.length - 1, dbl = true; i >= 0; i -= 1, dbl = !dbl) {
    let d = digits[i];
    if (dbl) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return (10 - (sum % 10)) % 10 === Number(s[9]);
};

/** DEA number: 2 letters + 7 digits with the DEA check digit. */
export const isValidDea = (dea) => {
  const s = String(dea || '').trim().toUpperCase();
  if (!/^[A-Z][A-Z9][0-9]{7}$/.test(s)) return false;
  const d = s.slice(2).split('').map(Number);
  return (d[0] + d[2] + d[4] + 2 * (d[1] + d[3] + d[5])) % 10 === d[6];
};

// ISO 3166-1 alpha-2 codes, named in the viewer's language by the browser.
const CODES = 'AD AE AF AG AL AM AO AR AT AU AZ BA BB BD BE BF BG BH BI BJ BN BO BR BS BT BW BY BZ CA CD CF CG CH CI CL CM CN CO CR CU CV CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FR GA GB GD GE GH GM GN GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IN IQ IR IS IT JM JO JP KE KG KH KM KN KR KW KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MK ML MM MN MO MR MT MU MV MW MX MY MZ NA NE NG NI NL NO NP NZ OM PA PE PG PH PK PL PR PS PT PY QA RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SY SZ TD TG TH TJ TL TM TN TO TR TT TW TZ UA UG US UY UZ VA VC VE VI VN VU WS YE ZA ZM ZW'.split(' ');

export const countryOptions = (locale = 'en') => {
  let names = null;
  try { names = new Intl.DisplayNames([locale, 'en'], { type: 'region' }); } catch { names = null; }
  return CODES.map((code) => ({ code, name: (names && names.of(code)) || code }))
    .sort((a, b) => a.name.localeCompare(b.name));
};
