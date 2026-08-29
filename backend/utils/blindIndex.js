// SEC-05 Model D — blind index for portal tenant routing (Option D, hardened).
//
// The shared routing table maps an email to a tenant. Storing the address in plaintext
// there would create a readable "this person is a patient at clinic X" map, so the email
// is stored as a keyed hash instead: HMAC-SHA256(lower(trim(email)), pepper).
//
// The pepper lives in the environment (AC_IDX_K), NEVER in the database, so a database
// dump alone cannot reverse the hashes. Email addresses are low-entropy, so a pepper
// that leaks *together with* a dump would make the hashes brute-forceable — keep the
// pepper in a secret manager, out of DB backups, and rotate it via KEY_VERSION.
//
// Honest caveat: a keyed hash of an identifier is a coded identifier, not de-identified
// data under HIPAA Safe Harbor. The routing tables are still PHI and must be treated as
// such (BAA scope, encryption at rest, breach analysis).

const crypto = require('crypto');

// Bump when rotating the pepper. Rows carry the version that produced them, so old and
// new can coexist while logins lazily re-register under the new key.
const KEY_VERSION = parseInt(process.env.AC_IDX_KV || '1', 10);

function getPepper() {
  const pepper = process.env.AC_IDX_K;
  if (!pepper || Buffer.byteLength(String(pepper), 'utf8') < 32) {
    const e = new Error(
      'Portal routing is not configured: set AC_IDX_K to a secret of at least 32 bytes ' +
      '(the blind-index pepper). It must not be stored in the database.'
    );
    e.statusCode = 503;
    throw e;
  }
  return pepper;
}

/** True when a pepper is configured — lets callers degrade instead of throwing. */
function isConfigured() {
  const p = process.env.AC_IDX_K;
  return Boolean(p) && Buffer.byteLength(String(p), 'utf8') >= 32;
}

/**
 * Deterministic keyed hash of an email, for the shared identity route.
 * @param {string} email
 * @returns {string} 64-char lowercase hex
 */
function emailHmac(email) {
  const normalized = String(email || '').trim().toLowerCase();
  return crypto.createHmac('sha256', getPepper()).update(normalized).digest('hex');
}

module.exports = { emailHmac, isConfigured, KEY_VERSION };
