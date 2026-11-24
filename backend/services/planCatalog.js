/**
 * Which plans a clinic sees: per plan TIER, the variant in the clinic's currency if the platform
 * has one, otherwise the tier's DEFAULT variant (migration 107).
 *
 *   currencyForCountry('ES') → 'eur'          a clinic's likely currency from its country
 *   practiceCurrency(db, practiceId) → 'eur'  the currency set in Clinic Settings (else from country)
 *   pickForCurrency(plans, currency, { keepIds }) → plans, one per tier, cheapest first
 *
 * `plans` are rows of public.subscription_plans with tier, is_tier_default and currency. A plan in
 * `keepIds` (the practice's current plan) is always the one shown for its tier, so a practice is
 * never shown a different variant of the plan it is already on.
 */

const EUR = ['AT', 'BE', 'CY', 'EE', 'FI', 'FR', 'DE', 'GR', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PT', 'SK', 'SI', 'ES', 'HR',
  'AD', 'MC', 'SM', 'VA', 'ME', 'XK'];
const BY_COUNTRY = {
  ...Object.fromEntries(EUR.map((c) => [c, 'eur'])),
  US: 'usd', PR: 'usd', GU: 'usd', VI: 'usd', AS: 'usd', MP: 'usd', EC: 'usd', SV: 'usd',
  GB: 'gbp', IM: 'gbp', JE: 'gbp', GG: 'gbp',
  CH: 'chf', LI: 'chf', CA: 'cad', AU: 'aud', NZ: 'nzd', IN: 'inr', SG: 'sgd', JP: 'jpy', ZA: 'zar',
  AE: 'aed', SA: 'sar', QA: 'qar', KW: 'kwd', BH: 'bhd', OM: 'omr',
  SE: 'sek', NO: 'nok', DK: 'dkk', PL: 'pln', CZ: 'czk', HU: 'huf', RO: 'ron', MX: 'mxn', BR: 'brl',
};

function currencyForCountry(country) {
  const c = String(country || '').trim().toUpperCase();
  return BY_COUNTRY[c] || null;
}

const norm = (c) => (c ? String(c).trim().toLowerCase() : null);

/** The clinic's currency preference: Clinic Settings currency, else its country's. */
async function practiceCurrency(db, practiceId) {
  if (!practiceId) return null;
  try {
    const { rows: [p] } = await db.query('SELECT currency, country FROM public.practices WHERE id::text = $1::text', [practiceId]);
    if (!p) return null;
    return norm(p.currency) || currencyForCountry(p.country);
  } catch { return null; }
}

/** One plan per tier: the clinic's currency if offered, else the tier's default. */
function pickForCurrency(plans, currency, { keepIds = [] } = {}) {
  const want = norm(currency);
  const keep = new Set(keepIds.filter(Boolean).map(String));
  const byTier = new Map();
  for (const p of plans) {
    const tier = p.tier || p.name;
    if (!byTier.has(tier)) byTier.set(tier, []);
    byTier.get(tier).push(p);
  }
  const out = [];
  for (const variants of byTier.values()) {
    const chosen = variants.find((p) => keep.has(String(p.id)))
      || (want && variants.find((p) => norm(p.currency) === want))
      || variants.find((p) => p.is_tier_default)
      || variants.slice().sort((a, b) => a.id - b.id)[0];
    out.push(chosen);
  }
  return out.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0) || a.id - b.id);
}

module.exports = { currencyForCountry, practiceCurrency, pickForCurrency };
