const crypto = require('crypto');

/**
 * Envelope encryption for secure-messaging payloads.
 *
 * Message bodies and attachment blobs are encrypted with AES-256-GCM before
 * they reach Postgres, so a database dump, a stray backup or a read-replica
 * leak yields ciphertext rather than PHI. GCM is used rather than CBC because
 * it authenticates as well as encrypts — a tampered row fails to decrypt
 * instead of silently returning altered text.
 *
 * Scope, stated plainly: this is encryption *at rest* under a server-held key,
 * combined with TLS in transit. It is not zero-knowledge end-to-end encryption.
 * The server can read message bodies, and that is deliberate — the practice
 * has to satisfy record-retention, legal-hold, audit and coverage obligations
 * (a covering clinician must be able to open a colleague's thread), none of
 * which survive a design where only the two endpoints hold keys.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;   // GCM standard nonce length
const KEY_BYTES = 32;  // AES-256

/** Current key version written to new rows. Bump when rotating. */
const CURRENT_KEY_VERSION = 1;

let cachedKey = null;

/**
 * Resolve the 32-byte data key.
 *
 * Preferred: AC_MSG_KEY holding 32 bytes as hex (64 chars) or base64.
 * Fallback: derive from the JWT signing secret with a domain-separated HKDF,
 * so a development install works without a second secret while still never
 * reusing the raw JWT key as an encryption key. Production should set
 * AC_MSG_KEY explicitly — rotating the JWT secret otherwise renders every
 * stored message unreadable.
 */
const getKey = () => {
  if (cachedKey) return cachedKey;

  const configured = process.env.AC_MSG_KEY;
  if (configured) {
    const buf = /^[0-9a-fA-F]{64}$/.test(configured)
      ? Buffer.from(configured, 'hex')
      : Buffer.from(configured, 'base64');

    if (buf.length !== KEY_BYTES) {
      throw new Error(
        `AC_MSG_KEY must decode to ${KEY_BYTES} bytes (got ${buf.length}). ` +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
      );
    }
    cachedKey = buf;
    return cachedKey;
  }

  const jwtSecret = process.env.AC_TK_S;
  if (!jwtSecret) {
    throw new Error(
      'Secure messaging needs an encryption key: set AC_MSG_KEY (32 bytes, hex or base64).'
    );
  }

  console.warn(
    '[messageCrypto] AC_MSG_KEY is not set — deriving the message key from AC_TK_S. ' +
    'Set AC_MSG_KEY in production: rotating AC_TK_S would otherwise make every stored message unreadable.'
  );
  cachedKey = crypto.hkdfSync(
    'sha256',
    Buffer.from(jwtSecret, 'utf8'),
    Buffer.from('aureoncare/secure-messaging/v1', 'utf8'), // salt
    Buffer.from('message-body-encryption', 'utf8'),        // info
    KEY_BYTES
  );
  cachedKey = Buffer.from(cachedKey);
  return cachedKey;
};

/**
 * Encrypt a UTF-8 string (or Buffer) for storage.
 * @returns {{ciphertext: string, iv: string, tag: string, keyVersion: number}}
 *          all three payload fields base64-encoded
 */
const encrypt = (plaintext) => {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);

  const input = Buffer.isBuffer(plaintext) ? plaintext : Buffer.from(String(plaintext), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(input), cipher.final()]);

  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    keyVersion: CURRENT_KEY_VERSION,
  };
};

/**
 * Reverse of {@link encrypt}, returning a Buffer.
 * Throws if the auth tag does not verify — i.e. the row was altered.
 */
const decryptToBuffer = ({ ciphertext, iv, tag }) => {
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64')),
    decipher.final(),
  ]);
};

/**
 * Decrypt to a string, never throwing.
 *
 * A single unreadable row — written under a rotated key, or corrupted — must
 * not take down the whole thread, so the failure is contained to that message
 * and surfaced in place.
 */
const decrypt = (row) => {
  try {
    return decryptToBuffer(row).toString('utf8');
  } catch (error) {
    console.error('[messageCrypto] Failed to decrypt payload:', error.message);
    return null;
  }
};

module.exports = {
  encrypt,
  decrypt,
  decryptToBuffer,
  CURRENT_KEY_VERSION,
};
