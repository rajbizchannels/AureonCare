// SEC-26: encrypt PHI backups before they leave the infrastructure.
//
// routes/backup.js dumps whole tables (SELECT * FROM ...) and uploads the JSON to Google
// Drive or OneDrive. Unencrypted, that puts a complete copy of the clinical database in a
// third party's storage, where its confidentiality depends entirely on that account
// staying uncompromised — including against anyone who later gains access to the linked
// Drive/OneDrive account.
//
// The payload is sealed with AES-256-GCM (authenticated, so tampering is detected) using
// the same key management as message encryption, rather than introducing a second scheme.
//
// The envelope is self-describing, which matters for restore: backups taken BEFORE this
// change are plain JSON and must still be restorable. isEncryptedBackup() distinguishes
// them, so the restore path handles both.
//
// KEY MANAGEMENT: the key comes from AC_MSG_KEY (or, in development, an HKDF of the JWT
// secret). Losing it makes existing backups unrecoverable, so it must be escrowed
// separately from the backups themselves — a key stored alongside the ciphertext protects
// nobody.

const { encrypt, decryptToBuffer, CURRENT_KEY_VERSION } = require('./messageCrypto');

const ENVELOPE_MARKER = 'aureoncare-encrypted-backup';
const ENVELOPE_VERSION = 1;

/**
 * Seal a backup object into an encrypted envelope.
 * @param {any} data the backup payload (will be JSON-serialised)
 * @returns {string} JSON string to upload
 */
function sealBackup(data) {
  const plaintext = JSON.stringify(data);
  const { ciphertext, iv, tag, keyVersion } = encrypt(plaintext);
  return JSON.stringify({
    marker: ENVELOPE_MARKER,
    envelopeVersion: ENVELOPE_VERSION,
    algorithm: 'aes-256-gcm',
    keyVersion: keyVersion ?? CURRENT_KEY_VERSION,
    createdAt: new Date().toISOString(),
    iv,
    tag,
    ciphertext,
  }, null, 2);
}

/** True when the parsed content is one of our encrypted envelopes. */
function isEncryptedBackup(parsed) {
  return Boolean(parsed && typeof parsed === 'object' && parsed.marker === ENVELOPE_MARKER && parsed.ciphertext);
}

/**
 * Open a backup produced by sealBackup. Throws if the payload was altered (GCM tag) or
 * the key is wrong.
 * @returns {any} the original backup object
 */
function openBackup(parsed) {
  if (!isEncryptedBackup(parsed)) {
    throw new Error('Not an encrypted AureonCare backup envelope');
  }
  const buf = decryptToBuffer({ ciphertext: parsed.ciphertext, iv: parsed.iv, tag: parsed.tag });
  return JSON.parse(buf.toString('utf8'));
}

/**
 * Accepts either an encrypted envelope or a legacy plaintext backup and returns the
 * payload, so restore keeps working for archives taken before SEC-26.
 * @returns {{ data: any, wasEncrypted: boolean }}
 */
function openAnyBackup(parsed) {
  if (isEncryptedBackup(parsed)) return { data: openBackup(parsed), wasEncrypted: true };
  return { data: parsed, wasEncrypted: false };
}

module.exports = { sealBackup, openBackup, openAnyBackup, isEncryptedBackup, ENVELOPE_MARKER };
