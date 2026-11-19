// SEC-12: reject passwords that already appear in public breach corpora.
//
// Length and character classes do not stop "Summer2024!abc" — it satisfies every rule and
// is in every credential-stuffing list. NIST SP 800-63B asks verifiers to check new
// passwords against known-compromised values, which is what this does, using the Have I
// Been Pwned "range" API with k-anonymity:
//
//   - the password is SHA-1 hashed locally;
//   - only the first 5 hex characters of that hash are sent;
//   - the service returns every suffix sharing that prefix (hundreds, padded with decoys
//     via Add-Padding so the response size leaks nothing), and the match is made here.
//
// Neither the password nor its full hash ever leaves the process.
//
// FAILS OPEN. If the service is slow or unreachable the password is accepted and a warning
// is logged. A third-party outage must never stop a clinician resetting a password; the
// length/complexity policy still applies regardless.
//
// AC_PW_BREACH_CHECK=false disables the check (e.g. an air-gapped deployment).

const crypto = require('crypto');

const RANGE_URL = 'https://api.pwnedpasswords.com/range/';
const TIMEOUT_MS = Number(process.env.AC_PW_BREACH_TIMEOUT_MS) || 2000;

const enabled = () => String(process.env.AC_PW_BREACH_CHECK || 'true').toLowerCase() !== 'false';

const defaultFetchRange = async (prefix) => {
  const res = await fetch(RANGE_URL + prefix, {
    headers: { 'Add-Padding': 'true', 'User-Agent': 'AureonCare-password-check' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`range API answered ${res.status}`);
  return res.text();
};

let fetchRange = defaultFetchRange;

// One warning a minute at most, so an outage does not flood the log.
let lastWarn = 0;
const warn = (msg) => {
  const now = Date.now();
  if (now - lastWarn > 60 * 1000) {
    lastWarn = now;
    console.warn(`[passwordBreachCheck] ${msg} — password accepted without the breach check (fail-open).`);
  }
};

/**
 * How many times this password appears in known breaches.
 * @returns {Promise<number|null>} the count (0 = not found), or null when the check could
 *   not be performed (disabled, timeout, network error) — callers treat null as "allow".
 */
async function breachCount(password) {
  if (!enabled() || typeof password !== 'string' || !password) return null;
  const sha1 = crypto.createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);
  try {
    const body = await fetchRange(prefix);
    for (const line of String(body).split('\n')) {
      const [s, c] = line.trim().split(':');
      // Padding entries have a count of 0 and must not count as a hit.
      if (s === suffix) return Number(c) || 0;
    }
    return 0;
  } catch (err) {
    warn(err && err.cause && err.cause.code ? err.cause.code : (err && err.message) || String(err));
    return null;
  }
}

/** Test seam: replace the range fetcher (pass nothing to restore the real one). */
function _setRangeFetcher(fn) { fetchRange = fn || defaultFetchRange; lastWarn = 0; }

module.exports = { breachCount, _setRangeFetcher };
