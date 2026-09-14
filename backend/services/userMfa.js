// TOTP second factor for staff accounts.
//
// Same mechanism the platform console has used for operators, applied to the accounts that
// actually touch PHI. Kept in a service rather than inline in the auth routes because three
// separate paths need to agree on what "this code is valid" means — password login, social
// login, and disabling the factor — and a rule re-implemented three times is a rule that
// will eventually differ in one of them.

const crypto = require('crypto');
const speakeasy = require('speakeasy');

// One step either side of the current one. TOTP steps are 30 seconds, so this tolerates a
// phone clock up to ~30s out. Widening it is how a stolen code stays useful for minutes.
const TOTP_WINDOW = 1;

const BACKUP_CODE_COUNT = 10;

const hashCode = (code) =>
  crypto.createHash('sha256').update(String(code).replace(/\s|-/g, '').toUpperCase()).digest('hex');

/**
 * Recovery codes, for the phone that was lost or wiped.
 *
 * Without these, enabling 2FA on a clinical system means a clinician who breaks their phone
 * cannot reach patient records until an administrator intervenes — which is how people end
 * up disabling 2FA entirely. Only the hashes are stored; the plaintext is returned once and
 * cannot be recovered.
 */
function generateBackupCodes(count = BACKUP_CODE_COUNT) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    // Crockford-ish alphabet: no O/0, I/1 confusion when someone reads these off paper.
    const raw = crypto.randomBytes(8).toString('base64').replace(/[^A-Z2-9]/gi, '').toUpperCase().slice(0, 10);
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5, 10)}`);
  }
  return { codes, hashes: codes.map(hashCode) };
}

/** A fresh secret plus everything the enrolling client needs to display it. */
async function beginEnrolment(email) {
  const secret = speakeasy.generateSecret({
    name: `AureonCare (${email})`,
    issuer: 'AureonCare',
    length: 20,
  });
  // Two forms on purpose. A QR encodes the whole otpauth:// URL; manual entry takes the
  // base32 key alone. Showing the URL as something to type is what makes an authenticator
  // app report "illegal characters" — base32 is A–Z and 2–7, so ':' '/' '?' '=' are not in it.
  let qrDataUrl = null;
  try {
    qrDataUrl = await require('qrcode').toDataURL(secret.otpauth_url, { margin: 1, width: 220 });
  } catch (err) {
    console.error('[userMfa] QR generation failed:', err.message);
  }
  return { base32: secret.base32, otpauthUrl: secret.otpauth_url, qrDataUrl };
}

/** Is this a valid TOTP code for that secret right now? */
function verifyTotp(secret, code) {
  if (!secret || !code) return false;
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token: String(code).replace(/\s/g, ''),
    window: TOTP_WINDOW,
  });
}

/**
 * Check a code against the account's second factor, accepting either a TOTP code or an
 * unused backup code.
 *
 * Returns what was used, because a consumed backup code must be struck from the list — and
 * doing that is the caller's job, since it is a write and this must stay side-effect free.
 */
function verifySecondFactor(user, code) {
  if (!code) return { ok: false };
  if (verifyTotp(user.mfa_secret, code)) return { ok: true, usedBackupCode: null };

  const hash = hashCode(code);
  const stored = Array.isArray(user.mfa_backup_codes) ? user.mfa_backup_codes : [];
  // Compare against every stored hash rather than short-circuiting, so the time taken does
  // not reveal how many codes remain.
  let matched = null;
  for (const h of stored) {
    if (h.length === hash.length && crypto.timingSafeEqual(Buffer.from(h), Buffer.from(hash))) {
      matched = h;
    }
  }
  return matched ? { ok: true, usedBackupCode: matched } : { ok: false };
}

module.exports = {
  beginEnrolment,
  verifyTotp,
  verifySecondFactor,
  generateBackupCodes,
  hashCode,
  BACKUP_CODE_COUNT,
};
