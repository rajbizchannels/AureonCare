// SEC-12: centralized password policy for the whole backend.
// Previously the minimum was 6 characters with no complexity, and bcrypt ran at
// cost factor 10. For a healthcare system handling PHI we require at least 12
// characters spanning multiple character classes, and hash at cost factor 12.

// bcrypt work factor. 12 is ~4x the work of 10 — still well under ~250ms/hash on
// modern hardware, but materially harder to brute-force if the hash table leaks.
const BCRYPT_COST = 12;

const MIN_LENGTH = 12;
const MAX_LENGTH = 128; // guard against DoS via absurdly long bcrypt inputs

/**
 * Validate a plaintext password against the policy.
 * @param {string} password
 * @returns {{ valid: boolean, message?: string }}
 */
const validatePassword = (password) => {
  if (typeof password !== 'string' || password.length === 0) {
    return { valid: false, message: 'Password is required' };
  }
  if (password.length < MIN_LENGTH) {
    return { valid: false, message: `Password must be at least ${MIN_LENGTH} characters long` };
  }
  if (password.length > MAX_LENGTH) {
    return { valid: false, message: `Password must be at most ${MAX_LENGTH} characters long` };
  }

  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);

  if (!(hasLower && hasUpper && hasDigit && hasSymbol)) {
    return {
      valid: false,
      message: 'Password must include lowercase, uppercase, a number, and a special character'
    };
  }

  return { valid: true };
};

module.exports = { BCRYPT_COST, MIN_LENGTH, MAX_LENGTH, validatePassword };
