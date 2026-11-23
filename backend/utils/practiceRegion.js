/**
 * Which national requirements apply to a practice.
 *
 * US identifiers — the practice NPI on claims and eligibility checks, each clinician's personal NPI
 * and DEA number, X12 270/271 eligibility and Surescripts e-prescribing — exist only in the United
 * States (and its territories, which use the same systems). Elsewhere they are hidden and their
 * checks are off, so a practice in Germany is not told to enter an NPI it can never have.
 *
 * The practice's country decides. When it has not been set, the currency is the clue: USD means
 * the US; anything else (or nothing) means not. Admins set the country in Clinic Settings.
 */

const US_LIKE = new Set(['US', 'PR', 'GU', 'VI', 'AS', 'MP']); // the US and territories on NPI/DEA/Surescripts

function normaliseCountry(country) {
  const c = String(country || '').trim().toUpperCase();
  if (!c) return null;
  if (['USA', 'UNITED STATES', 'UNITED STATES OF AMERICA'].includes(c)) return 'US';
  return /^[A-Z]{2}$/.test(c) ? c : null;
}

/** Do US identifiers (NPI, DEA, X12, Surescripts) apply to this practice row? */
function usIdentifiersApply(practice) {
  if (!practice) return false;
  const country = normaliseCountry(practice.country);
  if (country) return US_LIKE.has(country);
  return String(practice.currency || '').toUpperCase() === 'USD';
}

/** Look the practice up by id (public.practices) and decide. */
async function usIdentifiersApplyFor(db, practiceId) {
  if (!practiceId) return false;
  try {
    const { rows } = await db.query('SELECT country, currency FROM public.practices WHERE id::text = $1::text', [practiceId]);
    return usIdentifiersApply(rows[0]);
  } catch { return false; }
}

/** DEA registration number: 2 letters + 7 digits with the DEA check digit. */
function isValidDea(dea) {
  const s = String(dea || '').trim().toUpperCase();
  if (!/^[A-Z][A-Z9][0-9]{7}$/.test(s)) return false;
  const d = s.slice(2).split('').map(Number);
  const sum = d[0] + d[2] + d[4] + 2 * (d[1] + d[3] + d[5]);
  return sum % 10 === d[6];
}

module.exports = { usIdentifiersApply, usIdentifiersApplyFor, normaliseCountry, isValidDea, US_LIKE };
